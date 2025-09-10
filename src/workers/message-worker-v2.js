// src/workers/message-worker-v2.js
const { Worker } = require('bullmq');
const config = require('../config');
const { getBullMQRedisConfig } = require('../config/redis-config');
const logger = require('../utils/logger');
const aiAdminV2 = require('../services/ai-admin-v2');
// Use API client instead of direct WhatsApp connection in worker
const WhatsAppAPIClient = require('../integrations/whatsapp/api-client');
const whatsappClient = new WhatsAppAPIClient();
const messageQueue = require('../queue/message-queue');
const errorMessages = require('../utils/error-messages');
const criticalErrorLogger = require('../utils/critical-error-logger');
const reminderContextTracker = require('../services/reminder/reminder-context-tracker');
const { YclientsClient } = require('../integrations/yclients/client');
const { createRedisClient } = require('../utils/redis-factory');

/**
 * Упрощенный Message Worker для AI Admin v2
 */
class MessageWorkerV2 {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
    this.workers = [];
    this.connection = getBullMQRedisConfig();
    
    // Redis клиент для отслеживания состояния диалога
    // (отдельный от BullMQ для изоляции и логирования)
    this.conversationTracker = null; // Инициализируем в start()
    
    // Паттерны благодарности (для мгновенной реакции ❤️)
    // Не используем \b с кириллицей - он не работает правильно
    this.thanksPatterns = /(спасибо|спасиб|спс|благодар|пасиб|пасибо|сенкс|thanks|thank you|thx|ty)/i;
    
    // Паттерны завершения диалога
    this.closingPatterns = /(это\s+всё|^всё$|больше\s+(ничего|не\s+надо|ничем)|не\s+нужно|достаточно)/i;
    
    logger.debug('MessageWorkerV2 Redis config:', {
      host: this.connection.host,
      port: this.connection.port,
      hasPassword: !!this.connection.password
    });
  }

  async start() {
    logger.info(`🚀 Message Worker v2 ${this.workerId} starting...`);
    this.isRunning = true;

    // Initialize conversation tracker Redis client
    try {
      this.conversationTracker = await createRedisClient('conversation-tracker');
      logger.info('✅ Conversation tracker Redis client initialized');
      
      // Тестируем подключение
      await this.conversationTracker.ping();
      logger.info('✅ Conversation tracker Redis ping successful');
    } catch (error) {
      logger.error('Failed to initialize conversation tracker:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      // Продолжаем работу без трекера - просто не будем отслеживать "Чем еще помочь?"
      this.conversationTracker = null;
    }

    // Initialize WhatsApp API client (no actual connection, just API proxy)
    try {
      await whatsappClient.initialize();
      logger.info('✅ WhatsApp API client initialized in worker (using API proxy)');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp API client:', error);
    }

    const companyId = config.yclients.companyId;
    if (!companyId) {
      throw new Error('CompanyId is required but not configured');
    }
    
    const companyIds = [companyId];
    
    for (const companyId of companyIds) {
      const queueName = `company-${companyId}-messages`;
      logger.info(`🔧 Creating worker for queue: ${queueName}`);
      
      const worker = new Worker(
        queueName,
        async (job) => {
          try {
            return await this.processMessage(job);
          } catch (error) {
            logger.error(`Failed to process job ${job.id}:`, error);
            throw error;
          }
        },
        {
          connection: this.connection,
          concurrency: 3
        }
      );
      
      worker.on('completed', (job) => {
        logger.info(`✅ Job ${job.id} completed`);
        this.processedCount++;
      });
      
      worker.on('failed', (job, err) => {
        logger.error(`❌ Job ${job.id} failed:`, err);
      });
      
      this.workers.push(worker);
    }
    
    // Очистка кеша больше не нужна - используем Redis с TTL
  }

  async processMessage(job) {
    const startTime = Date.now();
    const { from, message, companyId, metadata = {} } = job.data;
    
    // Добавляем валидацию номера телефона
    if (!from || from === '+' || from.length < 5) {
      logger.error(`❌ Invalid phone number in job ${job.id}: "${from}"`);
      logger.error('Full job data:', job.data);
      throw new Error(`Invalid phone number: ${from}`);
    }
    
    logger.info(`💬 Processing message from ${from}: "${message}"`);
    logger.info(`📝 Worker patterns loaded - thanks: ${this.thanksPatterns}, closing: ${this.closingPatterns}`);
    logger.info(`🔌 Conversation tracker status: ${this.conversationTracker ? 'initialized' : 'not initialized'}`);
    
    // Проверяем, применялась ли уже rapid-fire protection в webhook
    if (metadata.isRapidFireBatch) {
      logger.info(`🔥 Processing rapid-fire batch: ${metadata.originalMessagesCount} messages combined`);
      logger.info(`Original messages: ${metadata.originalMessages?.join(' | ')}`);
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        // Проверяем, является ли это подтверждением напоминания
        const isReminderResponse = await reminderContextTracker.shouldHandleAsReminderResponse(from, message);
        
        if (isReminderResponse) {
          logger.info(`✅ Detected reminder confirmation from ${from}: "${message}"`);
          
          // Получаем контекст напоминания
          const reminderContext = await reminderContextTracker.getReminderContext(from);
          
          if (reminderContext && reminderContext.booking) {
            try {
              // Отправляем реакцию сердечком
              await whatsappClient.sendReaction(from, '❤️');
              logger.info(`❤️ Sent heart reaction to ${from}`);
              
              // Обновляем статус записи в YClients на "подтвержден" (attendance = 2)
              const yclientsClient = new YclientsClient();
              const updateResult = await yclientsClient.updateBookingStatus(
                reminderContext.booking.recordId,
                2 // attendance = 2 (подтвержден)
              );
              
              if (updateResult.success) {
                logger.info(`✅ Updated booking ${reminderContext.booking.recordId} status to confirmed`);
              } else {
                logger.warn(`Failed to update booking status: ${updateResult.error}`);
              }
              
              // Помечаем напоминание как подтвержденное
              await reminderContextTracker.markAsConfirmed(from);
              
              // Возвращаем успешный результат без отправки дополнительных сообщений
              resolve({
                success: true,
                processingTime: Date.now() - startTime,
                response: null, // Не отправляем текстовый ответ
                isReminderConfirmation: true
              });
              return;
            } catch (error) {
              logger.error('Error handling reminder confirmation:', error);
              // Продолжаем обработку как обычное сообщение если что-то пошло не так
            }
          }
        }
        
        // НОВАЯ ЛОГИКА: Проверяем благодарности и завершение диалога
        logger.info(`🔍 Checking message for thanks/closing patterns: "${message}"`);
        const isThankYou = this.thanksPatterns.test(message);
        const isClosing = this.closingPatterns.test(message);
        logger.info(`📊 Pattern check results - isThankYou: ${isThankYou}, isClosing: ${isClosing}`);
        
        if (isThankYou || isClosing) {
          logger.info(`💬 Detected ${isThankYou ? 'thank you' : 'closing'} message from ${from}: "${message}"`);
          
          try {
            // Отправляем реакцию сердечком на благодарность
            if (isThankYou) {
              await whatsappClient.sendReaction(from, '❤️');
              logger.info(`❤️ Sent heart reaction to ${from} for thank you message`);
            }
            
            // Сбрасываем флаг "спрашивали ли мы уже"
            if (this.conversationTracker) {
              const helpAskedKey = `asked_help:${from}:${companyId}`;
              await this.conversationTracker.del(helpAskedKey);
              logger.debug(`Reset "asked help" flag for ${from}`);
            }
            
            // Если это явное завершение диалога - не отправляем текстовый ответ
            if (isClosing || (isThankYou && message.length < 20)) {
              // Короткое "спасибо" или явное завершение - просто реакция, без ответа
              resolve({
                success: true,
                processingTime: Date.now() - startTime,
                response: null,
                isThanksMessage: true
              });
              return;
            }
            
            // Если благодарность с дополнительным текстом - обрабатываем через AI
            // но с флагом, что не нужно спрашивать "Чем еще помочь?"
          } catch (error) {
            logger.error('Error handling thanks/closing message:', error);
            // Продолжаем обработку если что-то пошло не так
          }
        }
        
        // Проверяем, нужно ли спрашивать "Чем еще могу помочь?"
        let shouldAskHowToHelp = false;
        if (this.conversationTracker && !isThankYou && !isClosing) {
          const helpAskedKey = `asked_help:${from}:${companyId}`;
          const alreadyAsked = await this.conversationTracker.get(helpAskedKey);
          shouldAskHowToHelp = !alreadyAsked;
          
          logger.debug(`Should ask "how to help": ${shouldAskHowToHelp} (already asked: ${!!alreadyAsked})`);
        }
        
        // Сообщение уже обработано через rapid-fire в webhook
        const result = await aiAdminV2.processMessage(message, from, companyId, {
          shouldAskHowToHelp,
          isThankYouMessage: isThankYou
        });
          
          if (!result.success) {
            throw new Error(result.error || 'Processing failed');
          }
          
          // Отправляем ответ (разделяем на несколько сообщений)
          if (result.response) {
            // Фильтруем служебные блоки - они не должны отправляться пользователю
            let cleanResponse = result.response
              .replace(/\[THINK\][\s\S]*?\[\/THINK\]/g, '') // Убираем [THINK] блоки
              .replace(/\[RESPOND\]/g, '') // Убираем открывающий [RESPOND]
              .replace(/\[\/RESPOND\]/g, '') // Убираем закрывающий [/RESPOND]
              .trim();
            
            // Разделяем ответ на отдельные сообщения по двойному переносу строки
            // Это стандартный способ разделения абзацев/сообщений
            const messages = cleanResponse.split('\n\n').map(msg => msg.trim()).filter(msg => msg);
            
            if (messages.length === 0) {
              // Если после фильтрации не осталось сообщений, пропускаем отправку
              logger.warn(`No messages to send after filtering [THINK] blocks from response`);
            } else {
              logger.info(`🤖 Bot sending ${messages.length} messages to ${from}`);
              
              // Отправляем каждое сообщение с небольшой задержкой
              for (let i = 0; i < messages.length; i++) {
              const message = messages[i];
              logger.info(`🤖 Message ${i + 1}/${messages.length} to ${from}: "${message}"`);
              
              const sendResult = await whatsappClient.sendMessage(from, message);
              if (!sendResult.success) {
                throw new Error(`Failed to send message ${i + 1}: ${sendResult.error}`);
              }
              
              // Добавляем задержку между сообщениями (кроме последнего)
              if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms задержка
              }
            }
            
            // Проверяем, содержит ли ответ вопрос "Чем еще могу помочь?"
            if (this.conversationTracker && cleanResponse.includes('Чем еще могу помочь') || cleanResponse.includes('Чем ещё могу помочь')) {
              const helpAskedKey = `asked_help:${from}:${companyId}`;
              await this.conversationTracker.set(helpAskedKey, '1', 'EX', 1800); // Храним 30 минут
              logger.debug(`Set "asked help" flag for ${from}`);
            }
            }
          }
          
          // Планируем напоминания и отправляем .ics файл если создана запись
          const commands = result.executedCommands || result.commands;
          if (commands?.some(cmd => cmd.command === 'CREATE_BOOKING')) {
            const bookingResult = result.results?.find(r => r.type === 'booking_created');
            if (bookingResult?.data) {
              // Планируем напоминания
              await this.scheduleReminders(bookingResult.data, from);
              logger.info('📅 Reminders scheduled for booking:', {
                recordId: bookingResult.data.record_id,
                datetime: bookingResult.data.datetime
              });
              
              // Генерируем и отправляем .ics файл
              try {
                await this.sendCalendarInvite(bookingResult.data, from, job.data.companyId);
              } catch (error) {
                logger.error('Failed to send calendar invite:', error);
                // Не прерываем основной процесс если не удалось отправить календарь
              }
            } else {
              logger.warn('CREATE_BOOKING command executed but no booking data found');
            }
          }
          
          resolve({
            success: true,
            processingTime: Date.now() - startTime,
            response: result.response
          });
          
        } catch (error) {
          logger.error('Processing error:', error);
          
          // Получаем user-friendly сообщение об ошибке
          const errorContext = {
            operation: 'message_processing',
            companyId: job.data.companyId,
            hasMessage: !!message,
            userId: from,
            jobId: job.id,
            requestId: job.data.requestId
          };
          
          const errorResult = errorMessages.getUserMessage(error, errorContext);
          const userErrorMessage = errorMessages.formatUserResponse(errorResult);
          
          // Логируем критичные ошибки
          if (errorResult.severity === 'high' || errorResult.severity === 'critical') {
            await criticalErrorLogger.logCriticalError(error, {
              ...errorContext,
              messageContent: message,
              attemptNumber: job.attemptsMade,
              workerInfo: {
                workerId: this.workerId,
                processTime: Date.now() - startTime
              }
            });
          }
          
          // Отправляем сообщение об ошибке
          try {
            logger.info(`🤖 Bot response to ${from} (error): "${userErrorMessage}"`);
            await whatsappClient.sendMessage(from, userErrorMessage);
            
            // Если ошибка временная, добавляем job в retry очередь
            if (errorResult.needsRetry && job.attemptsMade < 3) {
              logger.info(`Scheduling retry for job ${job.id}, attempt ${job.attemptsMade + 1}/3`);
            }
          } catch (sendError) {
            logger.error('Failed to send error message:', sendError);
            
            // Это критично - не можем отправить сообщение пользователю
            await criticalErrorLogger.logCriticalError(sendError, {
              operation: 'send_error_message',
              originalError: error.message,
              userId: from,
              companyId: job.data.companyId
            });
          }
          
        resolve({
          success: false,
          error: error.message,
          userMessage: userErrorMessage,
          technical: errorResult.technical,
          processingTime: Date.now() - startTime
        });
      }
    });
  }

  async sendCalendarInvite(booking, phone, companyId) {
    try {
      const axios = require('axios');
      const { supabase } = require('../database/supabase');
      
      // Получаем данные компании для названия
      let companyName = 'Салон красоты';
      try {
        const { data: company } = await supabase
          .from('companies')
          .select('title')
          .eq('company_id', companyId)
          .maybeSingle();
        
        if (company?.title) {
          companyName = company.title;
        }
      } catch (error) {
        logger.warn('Failed to fetch company name for ICS:', error);
      }
      
      // Генерируем ссылку через API
      const apiBaseUrl = process.env.API_BASE_URL || 'http://46.149.70.219:3000';
      try {
        const response = await axios.post(`${apiBaseUrl}/api/calendar/generate-ics-link`, {
          booking,
          companyName
        });
        
        if (response.data.success && response.data.url) {
          // Отправляем ссылку на скачивание .ics файла
          const message = `📅 Добавить в календарь:\n\n` +
                         `Нажмите на ссылку ниже, чтобы добавить запись в календарь вашего телефона:\n\n` +
                         `🔗 ${response.data.url}\n\n` +
                         `Ссылка действительна в течение 1 часа`;
          
          const sendResult = await whatsappClient.sendMessage(phone, message);
          
          if (sendResult.success) {
            logger.info('📅 Calendar link sent successfully', { url: response.data.url });
          } else {
            logger.error('Failed to send calendar link:', sendResult.error);
          }
        }
      } catch (error) {
        logger.error('Failed to generate calendar link:', error);
        // Не прерываем основной процесс если не удалось создать ссылку
      }
      
    } catch (error) {
      logger.error('Error in sendCalendarInvite:', error);
      // Не пробрасываем ошибку, чтобы не прервать основной процесс
    }
  }

  async scheduleReminders(booking, phone) {
    try {
      const bookingTime = new Date(booking.datetime || `${booking.date} ${booking.time}`);
      const now = new Date();
      const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);
      
      // ВАЖНО: Не создаем напоминания если до записи менее 4 часов
      if (hoursUntilBooking < 4) {
        logger.info(`⏭️ Skipping reminders - booking in ${hoursUntilBooking.toFixed(1)} hours (less than 4 hours)`);
        return;
      }
      
      // Напоминание за день в случайное время между 19:00 и 21:00
      const dayBefore = new Date(bookingTime);
      dayBefore.setDate(dayBefore.getDate() - 1);
      
      // Выбираем случайное время между 19:00 и 21:00
      const randomHour = 19 + Math.floor(Math.random() * 2); // 19 или 20
      const randomMinute = Math.floor(Math.random() * 60); // 0-59
      dayBefore.setHours(randomHour, randomMinute, 0, 0);
      
      if (dayBefore > now) {
        await messageQueue.addReminder({
          type: 'day_before',
          booking,
          phone
        }, dayBefore);
        logger.info(`📅 Scheduled day-before reminder for ${dayBefore.toLocaleString('ru-RU')}`);
      }
      
      // Напоминание за 2 часа (только если запись не раньше чем через 4 часа)
      const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
      
      if (twoHoursBefore > now) {
        await messageQueue.addReminder({
          type: 'hours_before',
          booking,
          phone,
          hours: 2
        }, twoHoursBefore);
        logger.info(`⏰ Scheduled 2-hour reminder for ${twoHoursBefore.toLocaleString('ru-RU')}`);
      }
      
      logger.info(`✅ Reminders scheduled for booking at ${bookingTime.toLocaleString('ru-RU')}`);
    } catch (error) {
      logger.error('Failed to schedule reminders:', error);
    }
  }

  async stop() {
    logger.info(`🛑 Stopping worker ${this.workerId}...`);
    this.isRunning = false;
    
    for (const worker of this.workers) {
      await worker.close();
    }
    
    logger.info(`✅ Worker stopped. Processed ${this.processedCount} messages`);
  }

  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      uptime: process.uptime()
    };
  }
}

module.exports = MessageWorkerV2;