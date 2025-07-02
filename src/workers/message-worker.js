// src/workers/message-worker.js
const config = require('../config');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');
const aiService = require('../services/ai');
const bookingService = require('../services/booking');
const contextService = require('../services/context');
const whatsappClient = require('../integrations/whatsapp/client');

// Helper function to find service by name
async function findServiceByName(serviceName, context) {
  if (!serviceName) return 18356041; // Default: СТРИЖКА МАШИНКОЙ
  
  const serviceMap = {
    "мужская стрижка": 18356010,
    "стрижка машинкой": 18356041,
    "стрижка ножницами": 18356056,
    "детская стрижка": 18356024,
    "стрижка бороды": 18356113,
    "моделирование бороды": 18356102,
    "бритье": 18356121,
    "культурное бритье": 18356121,
    "бритье головы": 18356066
  };
  
  const lowerName = serviceName.toLowerCase();
  
  // Exact match
  if (serviceMap[lowerName]) {
    return serviceMap[lowerName];
  }
  
  // Partial match
  for (const [key, id] of Object.entries(serviceMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return id;
    }
  }
  
  // Default fallback
  return 18356041; // СТРИЖКА МАШИНКОЙ
}

// Helper function to find staff by name
async function findStaffByName(staffName, context) {
  if (!staffName) return 2895125; // Default: Сергей
  
  const staffMap = {
    "сергей": 2895125,
    "бари": 3413963,
    "рамзан": 3820250
  };
  
  const lowerName = staffName.toLowerCase();
  
  // Exact match
  if (staffMap[lowerName]) {
    return staffMap[lowerName];
  }
  
  // Partial match
  for (const [key, id] of Object.entries(staffMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return id;
    }
  }
  
  // Default fallback
  return 2895125; // Сергей
}

class MessageWorker {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
  }

  /**
   * Start processing messages
   */
  async start() {
    logger.info(`🚀 Message worker ${this.workerId} starting...`);
    this.isRunning = true;

    // Process multiple company queues
    const companyIds = [config.yclients.companyId]; // TODO: Get from database
    
    for (const companyId of companyIds) {
      const queueName = `company:${companyId}:messages`;
      const queue = messageQueue.getQueue(queueName);
      
      // Process messages with concurrency
      queue.process(3, 
        this.processMessage.bind(this)
      );
      
      logger.info(`👷 Worker ${this.workerId} listening to ${queueName}`);
    }
  }

  /**
   * Process single message
   */
  async processMessage(job) {
    const startTime = Date.now();
    const { from, message, companyId, timestamp } = job.data;
    
    logger.info(`💬 Worker ${this.workerId} processing message from ${from}`);
    
    try {
      // 1. Get or create context
      const context = await contextService.getContext(from, companyId);
      
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
      
      // 4. Build final response
      const finalResponse = this.buildResponse(aiResult, actionResult);
      
      logger.info("📤 Final response to send:", {
        message: finalResponse.message,
        attachment: finalResponse.attachment
      });
      
      // 5. Send response via WhatsApp
      
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
      
      return {
        success: true,
        processingTime,
        response: finalResponse.message
      };
      
    } catch (error) {
      logger.error(`Worker ${this.workerId} failed to process message:`, error);
      
      // Send error message to user
      await whatsappClient.sendMessage(from, 
        'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам.'
      );
      
      throw error; // Bull will handle retry
    }
  }

  /**
   * Execute action based on AI decision
   */
  async executeAction(aiResult, context) {
    const { action, entities } = aiResult;
    
    logger.info(`⚡ Executing action: ${action}`);
        logger.info("🔍 Entities extracted:", entities);
    
    switch (action) {
      case 'search_slots':
        return await bookingService.findSuitableSlot({
          companyId: context.companyId,
          service: entities.service,
          staff: entities.staff,
          date: entities.date,
          time: entities.time
        });
        
      case "create_booking":
        // Формируем данные для YClients API согласно документации
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
              services: [await findServiceByName(entities.service, context)],
              staff_id: await findStaffByName(entities.staff, context),
              datetime: `${entities.date} ${entities.time}:00`
            }
          ]
        };
        
        logger.info("📋 Booking data:", bookingData);
        const bookingResult = await bookingService.createBooking(bookingData, context.companyId);
        
        logger.info("📊 Booking result:", {
          success: bookingResult.success,
          status: bookingResult.status,
          data: bookingResult.data
        });
        
        return bookingResult;
        
      case 'get_info':
        return await bookingService.getServiceInfo({
          companyId: context.companyId,
          service: entities.service
        });
        
      default:
        logger.warn(`Unknown action: ${action}`);
        return null;
    }
  }

  /**
   * Build final response based on AI and action results
   */
  buildResponse(aiResult, actionResult) {
    let message = aiResult.response;
    let attachment = null;
    
    // Enhance response based on action result
    if (actionResult) {
      // Для успешного создания записи - добавляем подтверждение к ответу AI
      if (actionResult.success && aiResult.action === 'create_booking') {
        message = `✅ Отлично! Ваша запись успешно создана.\n\n${aiResult.response}`;
      }
      
      // Для поиска слотов - добавляем найденные слоты к ответу AI
      if (actionResult.success && actionResult.data && Array.isArray(actionResult.data) && actionResult.data.length > 0) {
        const slotsText = actionResult.data.slice(0, 5).map(slot => 
          `• ${slot.time || slot.datetime} ${slot.staff_name ? '- ' + slot.staff_name : ''}`
        ).join('\n');
        
        message += `\n\nДоступные варианты:\n${slotsText}`;
      }
      
      // Для ошибок - сообщаем пользователю
      if (!actionResult.success && actionResult.error) {
        message = `${aiResult.response}\n\nК сожалению, возникла техническая проблема. Попробуйте еще раз или позвоните нам.`;
      }
    }
    
    return { message, attachment };
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
    
    // TODO: Gracefully stop queue processing
    
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