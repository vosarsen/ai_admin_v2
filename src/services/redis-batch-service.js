// src/services/redis-batch-service.js
const { createRedisClient } = require('../utils/redis-factory');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');

class RedisBatchService {
  constructor() {
    this.redis = null;
    this.batchPrefix = 'rapid-fire:';
    this.lastMessagePrefix = 'last-msg:';
    this.defaultTTL = 60; // секунд - должно быть больше чем batchTimeout
    this.batchTimeout = 10000; // 10 секунд после последнего сообщения
    this.maxBatchSize = 10; // максимум сообщений в батче
  }

  async initialize() {
    try {
      this.redis = createRedisClient('batch-service');
      await this.redis.ping();
      logger.info('RedisBatchService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RedisBatchService:', error);
      throw error;
    }
  }

  /**
   * Добавляет сообщение в батч
   * @param {string} phone - номер телефона
   * @param {string} message - текст сообщения
   * @param {number} companyId - ID компании
   * @param {object} metadata - дополнительные данные
   */
  async addMessage(phone, message, companyId, metadata = {}) {
    const batchKey = `${this.batchPrefix}${phone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${phone}`;

    try {
      // Добавляем сообщение в список
      await this.redis.rpush(batchKey, JSON.stringify({
        message,
        companyId,
        metadata,
        timestamp: Date.now()
      }));

      // Обновляем время последнего сообщения
      await this.redis.set(lastMsgKey, Date.now());

      // Обновляем TTL при каждом новом сообщении для автоматической очистки
      // TTL должен быть больше чем batchTimeout + запас на обработку
      await this.redis.expire(batchKey, this.defaultTTL);
      await this.redis.expire(lastMsgKey, this.defaultTTL);

      logger.debug(`Added message to batch for ${phone}`, {
        batchKey,
        message: message.substring(0, 50) + '...'
      });

      return true;
    } catch (error) {
      logger.error('Failed to add message to batch:', error);
      throw error;
    }
  }

  /**
   * Проверяет и обрабатывает готовые батчи
   */
  async processPendingBatches() {
    try {
      // Получаем все ключи батчей
      logger.debug(`Searching for batch keys with pattern: ${this.batchPrefix}*`);
      const keys = await this.redis.keys(`${this.batchPrefix}*`);
      
      if (keys.length === 0) {
        logger.debug('No pending batches found');
        return { processed: 0 };
      }

      logger.debug(`Found ${keys.length} pending batches`);
      let processedCount = 0;

      for (const batchKey of keys) {
        const phone = batchKey.replace(this.batchPrefix, '');
        const shouldProcess = await this.shouldProcessBatch(phone);

        if (shouldProcess) {
          await this.processBatch(phone);
          processedCount++;
        }
      }

      return { processed: processedCount };
    } catch (error) {
      logger.error('Failed to process pending batches:', error);
      throw error;
    }
  }

  /**
   * Определяет, готов ли батч к обработке
   */
  async shouldProcessBatch(phone) {
    const batchKey = `${this.batchPrefix}${phone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${phone}`;

    try {
      // Получаем количество сообщений в батче
      const batchSize = await this.redis.llen(batchKey);
      
      if (batchSize === 0) {
        return false;
      }
      
      logger.debug(`Checking batch for ${phone}: size=${batchSize}, maxSize=${this.maxBatchSize}`);

      // Если достигнут максимальный размер батча
      if (batchSize >= this.maxBatchSize) {
        logger.debug(`Batch for ${phone} reached max size (${batchSize})`);
        return true;
      }

      // Проверяем время последнего сообщения
      const lastMessageTime = await this.redis.get(lastMsgKey);
      if (!lastMessageTime) {
        // Если нет времени, но есть батч - возможно TTL истек
        logger.warn(`No last message time for ${phone}, checking if batch exists`);
        const exists = await this.redis.exists(batchKey);
        return exists > 0; // Обрабатываем только если батч существует
      }

      const idleTime = Date.now() - parseInt(lastMessageTime);
      const shouldProcess = idleTime >= this.batchTimeout;

      if (shouldProcess) {
        logger.debug(`Batch for ${phone} idle for ${idleTime}ms, processing`);
      } else {
        // Добавляем логирование для отладки
        logger.debug(`Batch for ${phone} not ready: idle ${idleTime}ms < timeout ${this.batchTimeout}ms`);
      }

      return shouldProcess;
    } catch (error) {
      logger.error(`Failed to check batch status for ${phone}:`, error);
      return false;
    }
  }

  /**
   * Обрабатывает батч сообщений
   */
  async processBatch(phone) {
    const batchKey = `${this.batchPrefix}${phone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${phone}`;

    logger.info(`Starting to process batch for ${phone}`);

    try {
      // Получаем все сообщения из батча
      const rawMessages = await this.redis.lrange(batchKey, 0, -1);
      
      if (rawMessages.length === 0) {
        logger.warn(`Batch for ${phone} is empty - possibly expired by TTL`);
        // Очищаем ключи на всякий случай
        await this.redis.del(batchKey, lastMsgKey);
        return;
      }

      // Парсим сообщения
      const messages = rawMessages.map(raw => {
        try {
          return JSON.parse(raw);
        } catch (e) {
          logger.error('Failed to parse message:', e);
          return null;
        }
      }).filter(Boolean);

      if (messages.length === 0) {
        await this.redis.del(batchKey, lastMsgKey);
        return;
      }

      // Объединяем текст сообщений
      const combinedMessage = messages
        .map(m => m.message)
        .join(' ')
        .trim();

      // Берем companyId и metadata из первого сообщения
      const { companyId, metadata } = messages[0];
      const firstTimestamp = messages[0].timestamp;
      const lastTimestamp = messages[messages.length - 1].timestamp;

      logger.info(`Processing batch for ${phone}:`, {
        messagesCount: messages.length,
        combinedLength: combinedMessage.length,
        timeSpan: lastTimestamp - firstTimestamp,
        preview: combinedMessage.substring(0, 100) + '...'
      });

      // Добавляем объединенное сообщение в очередь
      await messageQueue.addMessage(companyId, {
        from: phone,
        message: combinedMessage,
        metadata: {
          ...metadata,
          isRapidFireBatch: true,
          batchSize: messages.length,
          batchTimeSpan: lastTimestamp - firstTimestamp,
          originalMessages: messages.map(m => m.message)
        }
      });

      // Удаляем обработанный батч
      await this.redis.del(batchKey, lastMsgKey);

      logger.info(`Batch processed successfully for ${phone}`);
    } catch (error) {
      logger.error(`Failed to process batch for ${phone}:`, error);
      // Не удаляем батч при ошибке, попробуем еще раз
    }
  }

  /**
   * Получает статистику по батчам
   */
  async getStats() {
    try {
      const keys = await this.redis.keys(`${this.batchPrefix}*`);
      const stats = {
        pendingBatches: keys.length,
        batches: []
      };

      for (const key of keys) {
        const phone = key.replace(this.batchPrefix, '');
        const size = await this.redis.llen(key);
        const lastMsgTime = await this.redis.get(`${this.lastMessagePrefix}${phone}`);
        
        stats.batches.push({
          phone,
          size,
          lastMessageAge: lastMsgTime ? Date.now() - parseInt(lastMsgTime) : null
        });
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get batch stats:', error);
      throw error;
    }
  }

  /**
   * Очищает батч для конкретного телефона
   */
  async clearBatch(phone) {
    const batchKey = `${this.batchPrefix}${phone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${phone}`;

    try {
      await this.redis.del(batchKey, lastMsgKey);
      logger.info(`Cleared batch for ${phone}`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear batch for ${phone}:`, error);
      throw error;
    }
  }

  /**
   * Закрывает соединение с Redis
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('RedisBatchService closed');
    }
  }
}

// Создаем singleton экземпляр
const batchService = new RedisBatchService();

module.exports = batchService;