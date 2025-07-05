// src/workers/message-worker.js
const { Worker } = require('bullmq');
const config = require('../config');
const logger = require('../utils/logger');
const aiService = require('../services/ai');
const bookingService = require('../services/booking');
const contextService = require('../services/context');
const whatsappClient = require('../integrations/whatsapp/client');
const entityResolver = require('../services/ai/entity-resolver');
const rapidFireProtection = require('../services/rapid-fire-protection');
const proactiveSuggestions = require('../services/ai/proactive-suggestions');
const messageQueue = require('../queue/message-queue');

class MessageWorker {
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

  /**
   * Start processing messages
   */
  async start() {
    logger.info(`🚀 Message worker ${this.workerId} starting...`);
    this.isRunning = true;

    // Process multiple company queues
    const companyId = config.yclients.companyId;
    
    if (!companyId) {
      logger.error('❌ CompanyId is undefined! Check YCLIENTS_COMPANY_ID in .env');
      logger.error('Current config:', JSON.stringify(config.yclients, null, 2));
      throw new Error('CompanyId is required but not configured');
    }
    
    const companyIds = [companyId]; // TODO: Get from database
    
    logger.info(`🏢 Processing companies: ${companyIds.join(', ')}`);
    
    for (const companyId of companyIds) {
      const queueName = `company:${companyId}:messages`;
      logger.info(`🔧 Creating BullMQ Worker for queue: ${queueName}`);
      
      // Create BullMQ Worker
      const worker = new Worker(
        queueName,
        async (job) => {
          logger.info(`🔥 Processing job ${job.id} in worker ${this.workerId}`);
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
      
      // Add event listeners
      worker.on('completed', (job) => {
        logger.info(`✅ Job ${job.id} completed in queue ${queueName}`);
        this.processedCount++;
      });
      
      worker.on('failed', (job, err) => {
        logger.error(`❌ Job ${job.id} failed in queue ${queueName}:`, err);
      });
      
      worker.on('active', (job) => {
        logger.info(`🎯 Job ${job.id} is now active in queue ${queueName}`);
      });
      
      worker.on('error', (error) => {
        logger.error(`🚨 Worker error in ${queueName}:`, error);
      });
      
      this.workers.push(worker);
      logger.info(`👷 Worker ${this.workerId} started for ${queueName}`);
    }
  }

  /**
   * 🔥 Process single message with Rapid-Fire Protection
   */
  async processMessage(job) {
    const startTime = Date.now();
    
    logger.info(`🎯 Starting to process job ${job.id}`);
    
    const { from, message, companyId, timestamp } = job.data;
    
    logger.info(`💬 Worker ${this.workerId} processing message from ${from}: "${message}"`);
    
    // Rapid-Fire Protection: объединяем быстрые сообщения
    return new Promise((resolve, reject) => {
      rapidFireProtection.processMessage(from, message, async (combinedMessage, metadata = {}) => {
        try {
          await this._processMessageInternal(from, combinedMessage, companyId, metadata, startTime, resolve);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Внутренняя обработка сообщения (после rapid-fire защиты)
   */
  async _processMessageInternal(from, message, companyId, metadata, startTime, resolve) {
    try {
      // Логируем информацию о rapid-fire обработке
      if (metadata.isRapidFireBatch) {
        logger.info(`🔥 Processing rapid-fire batch from ${from}:`, {
          originalMessages: metadata.originalMessagesCount,
          waitTime: metadata.totalWaitTime,
          combinedMessage: message.substring(0, 100) + (message.length > 100 ? '...' : '')
        });
      }

      // 1. Get or create context
      const context = await contextService.getContext(from, companyId);
      
      // Добавляем информацию о rapid-fire в контекст
      if (metadata.isRapidFireBatch) {
        context.rapidFire = {
          messagesCount: metadata.originalMessagesCount,
          waitTime: metadata.totalWaitTime,
          originalMessages: metadata.originalMessages
        };
      }
      
      // 2. Process with AI
      const aiResult = await aiService.processMessage(message, context);
      
      logger.info("🤖 AI Result:", {
        success: aiResult.success,
        action: aiResult.action,
        response: aiResult.response,
        entities: aiResult.entities
      });
      
      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI processing failed');
      }
      
      // 3. Execute action if needed
      let actionResult = null;
      if (aiResult.action && aiResult.action !== 'none') {
        actionResult = await this.executeAction(aiResult, context);
      }
      
      // 4. Build final response with proactive suggestions
      const finalResponse = await this.buildResponse(aiResult, actionResult, context);
      
      logger.info("📤 Final response to send:", {
        message: finalResponse.message,
        attachment: finalResponse.attachment
      });
      
      // 5. Send response via WhatsApp
      logger.info("📡 Sending WhatsApp message:", {
        to: from,
        message: finalResponse.message,
        messageLength: finalResponse.message.length
      });
      
      const sendResult = await whatsappClient.sendMessage(from, finalResponse.message);
      
      if (!sendResult.success) {
        throw new Error(`Failed to send WhatsApp message: ${sendResult.error}`);
      }
      
      // 6. Send additional content if any
      if (finalResponse.attachment) {
        await whatsappClient.sendFile(from, finalResponse.attachment.url, 
          finalResponse.attachment.caption);
      }
      
      // 7. Update context
      await contextService.updateContext(from, companyId, {
        lastMessage: {
          user: message,
          assistant: finalResponse.message,
          timestamp: new Date().toISOString()
        },
        lastAction: aiResult.action,
        actionResult: actionResult
      });
      
      // 8. Schedule follow-ups if needed
      if (actionResult?.success && aiResult.action === 'create_booking' && actionResult.data) {
        // Извлекаем данные для напоминания из результата
        const bookingInfo = {
          id: actionResult.data.id || actionResult.data.record_id || Date.now(),
          datetime: actionResult.data.datetime || `${aiResult.entities.date} ${aiResult.entities.time}:00`
        };
        await this.scheduleReminders(bookingInfo, from);
      }
      
      this.processedCount++;
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ Message processed by worker ${this.workerId} in ${processingTime}ms`);
      
      const result = {
        success: true,
        processingTime,
        response: finalResponse.message,
        rapidFire: metadata.isRapidFireBatch ? {
          messagesCount: metadata.originalMessagesCount,
          waitTime: metadata.totalWaitTime
        } : null
      };
      
      // Resolving Promise для Bull Queue
      resolve(result);
      
    } catch (error) {
      logger.error(`Worker ${this.workerId} failed to process message:`, error);
      
      // Send error message to user
      try {
        const errorMessage = metadata.isRapidFireFallback 
          ? 'Извините, не удалось обработать ваши сообщения. Попробуйте написать одно сообщение.'
          : 'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам.';
          
        await whatsappClient.sendMessage(from, errorMessage);
      } catch (sendError) {
        logger.error('Failed to send error message:', sendError);
      }
      
      // Resolving с ошибкой для Bull Queue
      resolve({
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }
  }

  /**
   * 🎯 Execute action based on AI decision - AI-First approach
   */
  async executeAction(aiResult, context) {
    const { action, entities } = aiResult;
    
    logger.info(`⚡ Executing action: ${action}`);
    logger.info("🔍 Entities extracted:", entities);
    
    try {
      switch (action) {
        case 'search_slots':
          return await this._handleSearchSlots(entities, context);
          
        case 'create_booking':
          return await this._handleCreateBooking(entities, context);
          
        case 'get_info':
          return await this._handleGetInfo(entities, context);
          
        default:
          logger.warn(`Unknown action: ${action}`);
          return {
            success: false,
            error: `Неизвестное действие: ${action}`,
            fallback: true
          };
      }
    } catch (error) {
      logger.error(`Error executing action ${action}:`, error);
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * 🔍 Поиск слотов через Entity Resolver
   */
  async _handleSearchSlots(entities, context) {
    logger.info('🔍 Handling search slots with AI-powered entity resolution');
    
    // Разрешаем сущности через AI + Smart Cache
    const service = await entityResolver.resolveService(
      entities.service, 
      context.companyId, 
      context
    );
    
    const staff = await entityResolver.resolveStaff(
      entities.staff,
      context.companyId,
      context
    );
    
    logger.info('✅ Entities resolved:', {
      service: `${service.title} (ID: ${service.yclients_id})`,
      staff: `${staff.name} (ID: ${staff.yclients_id})`
    });
    
    // Выполняем поиск слотов
    const slotsResult = await bookingService.findSuitableSlot({
      companyId: context.companyId,
      serviceId: service.yclients_id,
      staffId: staff.yclients_id,
      preferredDate: entities.date,
      preferredTime: entities.time
    });
    
    // Обогащаем результат информацией о разрешенных сущностях
    if (slotsResult.success) {
      slotsResult.resolvedEntities = {
        service: {
          title: service.title,
          price: service.price_min ? `от ${service.price_min}₽` : null,
          duration: service.duration ? `${service.duration} мин` : null
        },
        staff: {
          name: staff.name,
          rating: staff.rating
        }
      };
    }
    
    return slotsResult;
  }

  /**
   * 📝 Создание записи через Entity Resolver
   */
  async _handleCreateBooking(entities, context) {
    logger.info('📝 Handling create booking with AI-powered entity resolution');
    
    // Разрешаем сущности
    const service = await entityResolver.resolveService(
      entities.service, 
      context.companyId, 
      context
    );
    
    const staff = await entityResolver.resolveStaff(
      entities.staff,
      context.companyId,
      context
    );
    
    // Формируем данные для YClients API
    const bookingData = {
      phone: context.phone.replace("+", "").replace("@c.us", ""),
      fullname: context.client?.name || "Клиент",
      email: context.client?.email || `${context.phone.replace("+", "").replace("@c.us", "")}@whatsapp.local`,
      comment: "Запись через WhatsApp AI",
      type: "mobile",
      api_id: `wa_${Date.now()}`,
      appointments: [
        {
          id: 1,
          services: [service.yclients_id],
          staff_id: staff.yclients_id,
          datetime: `${entities.date} ${entities.time}:00`
        }
      ]
    };
    
    logger.info("📋 Booking data:", {
      ...bookingData,
      resolvedService: service.title,
      resolvedStaff: staff.name
    });
    
    const bookingResult = await bookingService.createBooking(bookingData, context.companyId);
    
    // Обогащаем результат информацией о разрешенных сущностях
    if (bookingResult.success) {
      bookingResult.resolvedEntities = {
        service: {
          title: service.title,
          price: service.price_min ? `от ${service.price_min}₽` : null
        },
        staff: {
          name: staff.name
        }
      };
    }
    
    logger.info("📊 Booking result:", {
      success: bookingResult.success,
      status: bookingResult.status,
      resolvedService: service.title,
      resolvedStaff: staff.name
    });
    
    return bookingResult;
  }

  /**
   * ℹ️ Получение информации об услуге через Entity Resolver
   */
  async _handleGetInfo(entities, context) {
    logger.info('ℹ️ Handling get info with AI-powered entity resolution');
    
    try {
      // Разрешаем услугу через AI
      const service = await entityResolver.resolveService(
        entities.service || 'услуга', 
        context.companyId, 
        context
      );
      
      return {
        success: true,
        data: {
          service: service.title,
          price: service.price_min ? 
            (service.price_max && service.price_max !== service.price_min ? 
              `от ${service.price_min}₽ до ${service.price_max}₽` : 
              `от ${service.price_min}₽`) : 
            'уточнить у мастера',
          duration: service.duration ? `${service.duration} минут` : '30-60 минут',
          description: service.description || 'Профессиональное оформление'
        },
        resolvedEntity: {
          yclients_id: service.yclients_id,
          title: service.title
        }
      };
      
    } catch (error) {
      logger.error('Error getting service info:', error);
      
      // Fallback к общей информации
      return {
        success: true,
        data: {
          service: entities.service || 'услуга',
          price: 'уточнить у мастера',
          duration: '30-60 минут',
          description: 'Профессиональное оформление'
        },
        fallback: true
      };
    }
  }

  /**
   * 🤖 Build final response with proactive suggestions
   */
  async buildResponse(aiResult, actionResult, context) {
    let message = aiResult.response;
    let attachment = null;
    
    // Для search_slots генерируем ответ только после выполнения действия
    if (aiResult.action === 'search_slots' && message === null) {
      message = this._generateSearchSlotsResponse(aiResult, actionResult, context);
    }
    
    // Enhance response based on action result
    if (actionResult) {
      // ✅ Успешное создание записи
      if (actionResult.success && aiResult.action === 'create_booking') {
        message = `✅ Отлично! Ваша запись успешно создана.\n\n${aiResult.response}`;
        
        // Добавляем детали о записи если есть
        if (actionResult.resolvedEntities) {
          const details = [];
          if (actionResult.resolvedEntities.service.title) {
            details.push(`📋 Услуга: ${actionResult.resolvedEntities.service.title}`);
          }
          if (actionResult.resolvedEntities.staff.name) {
            details.push(`👤 Мастер: ${actionResult.resolvedEntities.staff.name}`);
          }
          if (actionResult.resolvedEntities.service.price) {
            details.push(`💰 Стоимость: ${actionResult.resolvedEntities.service.price}`);
          }
          
          if (details.length > 0) {
            message += `\n\n${details.join('\n')}`;
          }
        }
      }
      
      // 🔍 Успешный поиск слотов - формируем полный ответ
      else if (aiResult.action === 'search_slots' && actionResult.success && actionResult.data && Array.isArray(actionResult.data) && actionResult.data.length > 0) {
        // Генерируем начальную часть ответа на основе запроса
        let response = 'Найдены свободные слоты';
        
        if (actionResult.resolvedEntities?.service?.title) {
          response += ` на ${actionResult.resolvedEntities.service.title}`;
        } else if (aiResult.entities.service) {
          response += ` на ${aiResult.entities.service}`;
        }
        
        if (aiResult.entities.date) {
          response += ` ${this._formatDateForUser(aiResult.entities.date)}`;
        }
        
        if (actionResult.resolvedEntities?.staff?.name) {
          response += ` у мастера ${actionResult.resolvedEntities.staff.name}`;
        } else if (aiResult.entities.staff) {
          response += ` у мастера ${aiResult.entities.staff}`;
        }
        
        // Добавляем список слотов
        const slotsText = actionResult.data.slice(0, 5).map(slot => 
          `• ${slot.time || slot.datetime} ${slot.staff_name ? '- ' + slot.staff_name : ''}`
        ).join('\n');
        
        message = `${response}:\n\n${slotsText}`;
      }
      
      // ❌ Нет доступных слотов для search_slots - ПРОАКТИВНЫЕ ПРЕДЛОЖЕНИЯ
      else if (aiResult.action === 'search_slots' && (!actionResult.success || (actionResult.data && Array.isArray(actionResult.data) && actionResult.data.length === 0))) {
        message = await this._buildProactiveResponse(aiResult, actionResult, context);
      }
      
      // 🔧 Технические ошибки
      else if (!actionResult.success && actionResult.error) {
        message = `${aiResult.response}\n\nК сожалению, возникла техническая проблема. Попробуйте еще раз или позвоните нам.`;
      }
    }
    
    return { message, attachment };
  }

  /**
   * 🔍 Генерация ответа для search_slots на основе результата
   */
  _generateSearchSlotsResponse(aiResult, actionResult, context) {
    const { entities } = aiResult;
    
    // Генерируем интеллектуальный ответ на основе извлеченных entities
    let response = 'Ищу доступные слоты';
    
    if (entities.service) {
      response += ` на ${entities.service}`;
    }
    
    if (entities.date) {
      response += ` ${this._formatDateForUser(entities.date)}`;
    }
    
    if (entities.staff) {
      response += ` у мастера ${entities.staff}`;
    }
    
    response += '...';
    return response;
  }

  /**
   * Форматирование даты для пользователя
   */
  _formatDateForUser(date) {
    if (!date) return '';
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (date === today) return 'сегодня';
    if (date === tomorrowStr) return 'завтра';
    
    return date;
  }

  /**
   * 🚀 Построение проактивного ответа при отсутствии слотов
   */
  async _buildProactiveResponse(aiResult, actionResult, context) {
    logger.info('🤖 Building proactive response for no available slots');
    
    try {
      // Подготавливаем контекст для проактивных предложений
      const suggestionContext = {
        originalRequest: {
          service_id: actionResult.resolvedEntities?.service?.yclients_id,
          service_name: actionResult.resolvedEntities?.service?.title,
          staff_id: actionResult.resolvedEntities?.staff?.yclients_id,
          staff_name: actionResult.resolvedEntities?.staff?.name,
          requested_date: aiResult.entities?.date,
          requested_time: aiResult.entities?.time
        },
        noSlotsReason: actionResult.reason || 'fully_booked',
        availableSlots: actionResult.alternativeSlots || [],
        client: context.client,
        companyId: context.companyId
      };
      
      // Генерируем проактивные предложения
      const suggestions = await proactiveSuggestions.generateSuggestions(suggestionContext);
      
      // Форматируем в текст
      const proactiveText = proactiveSuggestions.formatSuggestionsAsText(suggestions);
      
      logger.info('✅ Generated proactive response', {
        hasAlternatives: suggestions.alternatives.length > 0,
        hasAdditional: suggestions.additional.length > 0,
        hasUrgent: suggestions.urgent.length > 0
      });
      
      return proactiveText;
      
    } catch (error) {
      logger.error('Error building proactive response:', error);
      
      // Fallback к стандартному сообщению
      return `${aiResult.response}\n\nК сожалению, это время недоступно. Попробуйте выбрать другое время или обратитесь к нам по телефону.`;
    }
  }

  /**
   * Schedule reminders for booking
   */
  async scheduleReminders(booking, phone) {
    const bookingTime = new Date(booking.datetime);
    
    // Reminder 1 day before at 20:00
    const dayBefore = new Date(bookingTime);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(20, 0, 0, 0);
    
    if (dayBefore > new Date()) {
      await messageQueue.addReminder({
        type: 'day_before',
        booking,
        phone
      }, dayBefore);
    }
    
    // Reminder 2 hours before
    const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
    
    if (twoHoursBefore > new Date()) {
      await messageQueue.addReminder({
        type: 'hours_before',
        booking,
        phone,
        hours: 2
      }, twoHoursBefore);
    }
    
    logger.info(`⏰ Scheduled reminders for booking ${booking.id}`);
  }

  /**
   * Stop worker
   */
  async stop() {
    logger.info(`🛑 Stopping worker ${this.workerId}...`);
    this.isRunning = false;
    
    // Close all BullMQ workers
    for (const worker of this.workers) {
      await worker.close();
    }
    
    logger.info(`✅ Worker ${this.workerId} stopped. Processed ${this.processedCount} messages`);
  }

  /**
   * Get worker stats
   */
  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      uptime: process.uptime()
    };
  }
}

module.exports = MessageWorker;