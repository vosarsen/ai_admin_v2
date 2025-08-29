// src/services/reminder/reminder-context-tracker.js
/**
 * Отслеживание контекста напоминаний
 * Сохраняет информацию о последнем отправленном напоминании в Redis
 * чтобы правильно обрабатывать ответы клиентов
 */

const logger = require('../../utils/logger');
const { createRedisClient } = require('../../utils/redis-factory');
const config = require('../../config');

class ReminderContextTracker {
  constructor() {
    this.redisPrefix = 'reminder_context:';
    this.ttl = 24 * 60 * 60; // 24 часа
    this.redis = null;
    this._initRedis();
  }

  async _initRedis() {
    try {
      this.redis = await createRedisClient();
      logger.info('✅ Redis client initialized for ReminderContextTracker');
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
    }
  }

  /**
   * Сохранить информацию о последнем отправленном напоминании
   */
  async saveReminderContext(phone, bookingData, reminderType) {
    try {
      if (!this.redis) {
        logger.warn('Redis client not initialized, trying to reconnect...');
        await this._initRedis();
        if (!this.redis) {
          logger.error('Failed to initialize Redis client');
          return false;
        }
      }
      
      const key = `${this.redisPrefix}${phone}`;
      
      const context = {
        type: reminderType, // 'day_before', '2hours'
        sentAt: new Date().toISOString(),
        booking: {
          recordId: bookingData.record_id || bookingData.id,
          datetime: bookingData.datetime,
          serviceName: bookingData.service_name,
          staffName: bookingData.staff_name
        },
        awaitingConfirmation: true
      };

      await this.redis.set(key, JSON.stringify(context), 'EX', this.ttl);
      
      logger.info(`📝 Saved reminder context for ${phone}:`, {
        type: reminderType,
        recordId: context.booking.recordId
      });

      return true;
    } catch (error) {
      logger.error('Failed to save reminder context:', error);
      return false;
    }
  }

  /**
   * Получить контекст последнего напоминания
   */
  async getReminderContext(phone) {
    try {
      const key = `${this.redisPrefix}${phone}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }

      const context = JSON.parse(data);
      
      // Проверяем актуальность (не старше 12 часов для ожидания подтверждения)
      const sentAt = new Date(context.sentAt);
      const hoursAgo = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60);
      
      if (context.awaitingConfirmation && hoursAgo > 12) {
        // Контекст устарел
        await this.clearReminderContext(phone);
        return null;
      }

      return context;
    } catch (error) {
      logger.error('Failed to get reminder context:', error);
      return null;
    }
  }

  /**
   * Очистить контекст напоминания (после обработки ответа)
   */
  async clearReminderContext(phone) {
    try {
      const key = `${this.redisPrefix}${phone}`;
      await this.redis.del(key);
      logger.debug(`🗑️ Cleared reminder context for ${phone}`);
      return true;
    } catch (error) {
      logger.error('Failed to clear reminder context:', error);
      return false;
    }
  }

  /**
   * Пометить, что подтверждение получено
   */
  async markAsConfirmed(phone) {
    try {
      const context = await this.getReminderContext(phone);
      if (!context) {
        return false;
      }

      context.awaitingConfirmation = false;
      context.confirmedAt = new Date().toISOString();

      const key = `${this.redisPrefix}${phone}`;
      await this.redis.set(key, JSON.stringify(context), 'EX', this.ttl);
      
      logger.info(`✅ Marked reminder as confirmed for ${phone}`);
      return true;
    } catch (error) {
      logger.error('Failed to mark reminder as confirmed:', error);
      return false;
    }
  }

  /**
   * Проверить, является ли сообщение подтверждением напоминания
   */
  isConfirmationMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }

    const lowerMessage = message.toLowerCase().trim();
    
    // Паттерны подтверждения
    const confirmationPatterns = [
      'ок', 'ok', 'да', 'yes', 'конечно', 'обязательно', 
      'приду', 'придем', 'буду', 'будем', 'спасибо', 'хорошо',
      'договорились', 'подтверждаю', 'согласен', 'согласна',
      '👍', '👌', '✅', '💯', '+', '++', 'подтверждено'
    ];

    // Проверяем точное совпадение
    if (confirmationPatterns.includes(lowerMessage)) {
      return true;
    }

    // Проверяем, начинается ли сообщение с паттерна подтверждения
    return confirmationPatterns.some(pattern => 
      lowerMessage.startsWith(pattern + ' ') || 
      lowerMessage.startsWith(pattern + ',') ||
      lowerMessage.startsWith(pattern + '.')
    );
  }

  /**
   * Проверить, нужно ли обрабатывать сообщение как ответ на напоминание
   */
  async shouldHandleAsReminderResponse(phone, message) {
    const context = await this.getReminderContext(phone);
    
    if (!context || !context.awaitingConfirmation) {
      return false;
    }

    // Проверяем, прошло ли меньше 30 минут с момента отправки
    const sentAt = new Date(context.sentAt);
    const minutesAgo = (Date.now() - sentAt.getTime()) / (1000 * 60);
    
    if (minutesAgo > 30) {
      // Слишком много времени прошло
      return false;
    }

    // Проверяем, похоже ли сообщение на подтверждение
    return this.isConfirmationMessage(message);
  }
}

module.exports = new ReminderContextTracker();