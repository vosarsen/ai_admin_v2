// src/workers/reminder-worker.js
const config = require('../config');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');
const aiService = require('../services/ai');
const whatsappClient = require('../integrations/whatsapp/client');

class ReminderWorker {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
  }

  /**
   * Start processing reminders
   */
  async start() {
    logger.info(`⏰ Reminder worker ${this.workerId} starting...`);
    this.isRunning = true;

    const queue = messageQueue.getQueue(config.queue.reminderQueue);
    
    // Process reminders
    queue.process('send-reminder', this.processReminder.bind(this));
    
    logger.info(`⏰ Reminder worker ${this.workerId} started`);
  }

  /**
   * Process single reminder
   */
  async processReminder(job) {
    const startTime = Date.now();
    const { type, booking, phone, hours } = job.data;
    
    logger.info(`📨 Processing reminder ${type} for ${phone}`);
    
    try {
      // 1. Generate reminder message
      let message;
      if (type === 'day_before') {
        message = this._generateDayBeforeReminder(booking);
      } else if (type === 'hours_before') {
        message = this._generateHoursBeforeReminder(booking, hours);
      } else {
        throw new Error(`Unknown reminder type: ${type}`);
      }
      
      // 2. Send via WhatsApp
      const sendResult = await whatsappClient.sendMessage(phone, message);
      
      if (!sendResult.success) {
        throw new Error(`Failed to send reminder: ${sendResult.error}`);
      }
      
      // 3. Log success
      this.processedCount++;
      const processingTime = Date.now() - startTime;
      
      logger.info(`✅ Reminder sent in ${processingTime}ms`);
      
      return {
        success: true,
        processingTime,
        type,
        booking: booking.id
      };
      
    } catch (error) {
      logger.error(`Failed to process reminder:`, error);
      throw error; // Bull will handle retry
    }
  }

  /**
   * Generate day before reminder
   */
  _generateDayBeforeReminder(booking) {
    const date = new Date(booking.datetime);
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `Добрый вечер! 🌙\n\n` +
           `Напоминаем о вашей записи завтра:\n` +
           `📅 ${booking.service}\n` +
           `👤 Мастер: ${booking.staff}\n` +
           `🕐 Время: ${timeStr}\n\n` +
           `Будете завтра? Ответьте:\n` +
           `✅ Да - подтвердить\n` +
           `❌ Нет - отменить запись`;
  }

  /**
   * Generate hours before reminder
   */
  _generateHoursBeforeReminder(booking, hours) {
    const date = new Date(booking.datetime);
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `Напоминание! ⏰\n\n` +
           `Через ${hours} ${this._getHoursWord(hours)} у вас запись:\n` +
           `📅 ${booking.service}\n` +
           `👤 Мастер: ${booking.staff}\n` +
           `🕐 Время: ${timeStr}\n\n` +
           `Ждем вас! До встречи 😊`;
  }

  /**
   * Get correct hours word form
   */
  _getHoursWord(hours) {
    if (hours === 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
  }

  /**
   * Stop worker
   */
  async stop() {
    logger.info(`🛑 Stopping reminder worker ${this.workerId}...`);
    this.isRunning = false;
    
    // TODO: Gracefully stop queue processing
    
    logger.info(`✅ Reminder worker ${this.workerId} stopped. Processed ${this.processedCount} reminders`);
  }

  /**
   * Get worker stats
   */
  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      type: 'reminder'
    };
  }
}

module.exports = ReminderWorker;