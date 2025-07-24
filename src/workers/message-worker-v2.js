// src/workers/message-worker-v2.js
const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const aiAdminV2 = require('../services/ai-admin-v2');
const whatsappClient = require('../integrations/whatsapp/client');
const messageQueue = require('../queue/message-queue');

/**
 * Упрощенный Message Worker для AI Admin v2
 */
class MessageWorkerV2 {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
    this.workers = [];
    this.connection = {
      host: '127.0.0.1',
      port: 6379,
      password: config.redis.password
    };
  }

  async start() {
    logger.info(`🚀 Message Worker v2 ${this.workerId} starting...`);
    this.isRunning = true;

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
    
    // Очистка кеша каждые 5 минут
    setInterval(() => {
      aiAdminV2.cleanupCache();
    }, 300000);
  }

  async processMessage(job) {
    const startTime = Date.now();
    const { from, message, companyId, metadata = {} } = job.data;
    
    logger.info(`💬 Processing message from ${from}: "${message}"`);
    
    // Проверяем, применялась ли уже rapid-fire protection в webhook
    if (metadata.isRapidFireBatch) {
      logger.info(`🔥 Processing rapid-fire batch: ${metadata.originalMessagesCount} messages combined`);
      logger.info(`Original messages: ${metadata.originalMessages?.join(' | ')}`);
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        // Сообщение уже обработано через rapid-fire в webhook
        const result = await aiAdminV2.processMessage(message, from, companyId);
          
          if (!result.success) {
            throw new Error(result.error || 'Processing failed');
          }
          
          // Отправляем ответ
          if (result.response) {
            logger.info(`🤖 Bot response to ${from}: "${result.response}"`);
            const sendResult = await whatsappClient.sendMessage(from, result.response);
            if (!sendResult.success) {
              throw new Error(`Failed to send message: ${sendResult.error}`);
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
          
          // Отправляем сообщение об ошибке
          try {
            const errorMessage = 'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам.';
            logger.info(`🤖 Bot response to ${from} (error): "${errorMessage}"`);
            await whatsappClient.sendMessage(from, errorMessage);
          } catch (sendError) {
            logger.error('Failed to send error message:', sendError);
          }
          
        resolve({
          success: false,
          error: error.message,
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
          const message = `📅 *Добавить в календарь:*\n\n` +
                         `Нажмите на ссылку ниже, чтобы добавить запись в календарь вашего телефона:\n\n` +
                         `🔗 ${response.data.url}\n\n` +
                         `_Ссылка действительна в течение 1 часа_`;
          
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
      
      // Напоминание за день в случайное время между 19:00 и 21:00
      const dayBefore = new Date(bookingTime);
      dayBefore.setDate(dayBefore.getDate() - 1);
      
      // Выбираем случайное время между 19:00 и 21:00
      const randomHour = 19 + Math.floor(Math.random() * 2); // 19 или 20
      const randomMinute = Math.floor(Math.random() * 60); // 0-59
      dayBefore.setHours(randomHour, randomMinute, 0, 0);
      
      if (dayBefore > new Date()) {
        await messageQueue.addReminder({
          type: 'day_before',
          booking,
          phone
        }, dayBefore);
        logger.info(`📅 Scheduled day-before reminder for ${dayBefore.toLocaleString('ru-RU')}`);
      }
      
      // Напоминание за 2 часа
      const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
      
      if (twoHoursBefore > new Date()) {
        await messageQueue.addReminder({
          type: 'hours_before',
          booking,
          phone,
          hours: 2
        }, twoHoursBefore);
      }
      
      logger.info(`⏰ Scheduled reminders for booking`);
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