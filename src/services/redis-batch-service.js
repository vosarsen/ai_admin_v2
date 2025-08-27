// src/services/redis-batch-service.js
const { createRedisClient } = require('../utils/redis-factory');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');
const InternationalPhone = require('../utils/international-phone');

class RedisBatchService {
  constructor() {
    this.redis = null;
    this.batchPrefix = 'rapid-fire:';
    this.lastMessagePrefix = 'last-msg:';
    this.defaultTTL = 600; // 600 секунд (10 минут) - достаточный запас для батчинга и обработки
    this.batchTimeout = 9000; // 9 секунд после последнего сообщения
    this.maxBatchSize = 10; // максимум сообщений в батче
  }

  async initialize() {
    try {
      logger.info('Initializing RedisBatchService...');
      
      // Получаем конфигурацию Redis для диагностики
      const { getRedisConfig } = require('../config/redis-config');
      const redisConfig = getRedisConfig();
      logger.info('RedisBatchService Redis config:', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        hasPassword: !!redisConfig.password
      });
      
      this.redis = createRedisClient('batch-service');
      await this.redis.ping();
      
      // Проверяем подключение записав тестовый ключ
      await this.redis.set('test:batch-service', 'ok', 'EX', 10);
      const testResult = await this.redis.get('test:batch-service');
      
      if (testResult !== 'ok') {
        throw new Error('Redis connection test failed');
      }
      
      // Проверяем, какая БД используется
      const dbInfo = await this.redis.info('keyspace');
      logger.info('Redis database info:', dbInfo);
      
      // Проверяем количество ключей
      const dbSize = await this.redis.dbsize();
      logger.info(`Redis DB size: ${dbSize} keys`);
      
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
    // Нормализуем номер телефона к единому формату
    const normalizedPhone = InternationalPhone.normalize(phone);
    logger.debug(`Phone normalization: ${phone} -> ${normalizedPhone}`);
    
    const batchKey = `${this.batchPrefix}${normalizedPhone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${normalizedPhone}`;

    try {
      // Диагностика подключения
      if (!this.redis) {
        logger.error('Redis client is not initialized in addMessage');
        throw new Error('Redis client not initialized');
      }
      // Добавляем сообщение в список
      const messageData = JSON.stringify({
        message,
        companyId,
        metadata,
        timestamp: Date.now()
      });
      
      await this.redis.rpush(batchKey, messageData);
      logger.info(`RPUSH executed for key: ${batchKey}, data length: ${messageData.length}`);

      // Обновляем время последнего сообщения
      const now = Date.now();
      await this.redis.set(lastMsgKey, now);
      logger.info(`SET executed for key: ${lastMsgKey}, value: ${now}`);

      // Обновляем TTL при каждом новом сообщении для автоматической очистки
      // TTL должен быть больше чем batchTimeout + запас на обработку
      const ttl1 = await this.redis.expire(batchKey, this.defaultTTL);
      const ttl2 = await this.redis.expire(lastMsgKey, this.defaultTTL);
      logger.info(`EXPIRE executed - batch: ${ttl1}, lastMsg: ${ttl2}, TTL: ${this.defaultTTL}`);
      
      // Проверяем что ключи действительно существуют
      const exists1 = await this.redis.exists(batchKey);
      const exists2 = await this.redis.exists(lastMsgKey);
      logger.info(`Keys exist check - batch: ${exists1}, lastMsg: ${exists2}`);
      
      // Дополнительная диагностика - проверяем что ключи видны через keys
      const foundKeys = await this.redis.keys('rapid-fire:*');
      logger.info(`Found rapid-fire keys: ${foundKeys.length}, keys: ${foundKeys.join(', ')}`);
      
      // Проверяем содержимое батча
      const batchContent = await this.redis.lrange(batchKey, 0, -1);
      logger.info(`Batch content length: ${batchContent.length}`);

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
      // Диагностируем подключение к Redis
      if (!this.redis) {
        logger.error('Redis client is not initialized in processPendingBatches');
        throw new Error('Redis client not initialized');
      }
      
      // Проверяем все ключи для диагностики (первый запуск)
      if (!this._debuggedKeys) {
        const allKeys = await this.redis.keys('*');
        logger.info(`Total keys in Redis: ${allKeys.length}`);
        const rapidFireKeys = allKeys.filter(k => k.includes('rapid-fire'));
        if (rapidFireKeys.length > 0) {
          logger.info(`Found rapid-fire keys: ${rapidFireKeys.join(', ')}`);
        }
        this._debuggedKeys = true;
      }
      
      // Получаем все ключи батчей
      logger.debug(`Searching for batch keys with pattern: ${this.batchPrefix}*`);
      const keys = await this.redis.keys(`${this.batchPrefix}*`);
      
      // Дополнительная диагностика для отладки
      if (keys.length === 0) {
        // Проверяем SELECT команду
        const currentDb = await this.redis.config('GET', 'databases');
        logger.debug(`Current Redis DB config: ${JSON.stringify(currentDb)}`);
        
        // Проверяем другие ключи для отладки
        const allKeysCount = await this.redis.dbsize();
        const sampleKeys = await this.redis.keys('*');
        const rapidKeys = sampleKeys.filter(k => k.includes('rapid'));
        if (rapidKeys.length > 0) {
          logger.warn(`Found rapid keys but with different pattern: ${rapidKeys.join(', ')}`);
        }
        
        // Проверяем первые 20 ключей для полной диагностики
        const first20Keys = sampleKeys.slice(0, 20);
        logger.info(`First 20 keys in Redis: ${first20Keys.join(', ')}`);
        
        // Проверяем есть ли ключи с + в начале
        const plusKeys = sampleKeys.filter(k => k.includes('+'));
        if (plusKeys.length > 0) {
          logger.info(`Keys with + symbol: ${plusKeys.slice(0, 5).join(', ')}`);
        }
        
        logger.debug(`Total keys in DB: ${allKeysCount}, sample: ${sampleKeys.slice(0, 5).join(', ')}`);
      }
      
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
          logger.info(`Will process batch for ${phone}`);
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
    // Нормализуем номер для консистентности
    const normalizedPhone = InternationalPhone.normalize(phone);
    
    const batchKey = `${this.batchPrefix}${normalizedPhone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${normalizedPhone}`;

    try {
      // Проверяем TTL батча для отладки
      const ttl = await this.redis.ttl(batchKey);
      if (ttl > 0 && ttl < 5) {
        logger.warn(`Batch ${batchKey} TTL is very low: ${ttl} seconds`);
      }
      
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
        // Если нет времени, но есть батч - возможно TTL истек или ключ не был создан
        logger.warn(`No last message time for ${phone}, skipping batch processing`);
        // НЕ обрабатываем батч без времени последнего сообщения
        // Это предотвратит преждевременное удаление батчей
        return false;
      }

      const idleTime = Date.now() - parseInt(lastMessageTime);
      const shouldProcess = idleTime >= this.batchTimeout;

      if (shouldProcess) {
        logger.info(`Batch for ${phone} idle for ${idleTime}ms, processing`);
      } else {
        // Добавляем логирование для отладки
        if (idleTime > 9500) {
          // Критически близко к таймауту
          logger.warn(`Batch for ${phone} VERY close to timeout: idle ${idleTime}ms, need ${this.batchTimeout}ms, diff=${this.batchTimeout - idleTime}ms`);
        } else if (idleTime > 9000) {
          // Логируем подробнее когда близко к таймауту
          logger.info(`Batch for ${phone} approaching timeout: idle ${idleTime}ms, need ${this.batchTimeout}ms`);
        } else {
          logger.debug(`Batch for ${phone} not ready: idle ${idleTime}ms < timeout ${this.batchTimeout}ms`);
        }
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
    // Нормализуем номер для консистентности
    const normalizedPhone = InternationalPhone.normalize(phone);
    
    const batchKey = `${this.batchPrefix}${normalizedPhone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${normalizedPhone}`;

    logger.info(`🔄 Starting to process batch for ${phone} (normalized: ${normalizedPhone})`);

    try {
      // Получаем все сообщения из батча
      const rawMessages = await this.redis.lrange(batchKey, 0, -1);
      
      if (rawMessages.length === 0) {
        logger.warn(`Batch for ${phone} is empty - possibly expired by TTL`);
        // НЕ удаляем ключи автоматически - пусть истекут по TTL
        // Это предотвратит race conditions между добавлением и обработкой
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

      // Добавляем объединенное сообщение в очередь с нормализованным номером
      await messageQueue.addMessage(companyId, {
        from: normalizedPhone,
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
    // Нормализуем номер для консистентности
    const normalizedPhone = InternationalPhone.normalize(phone);
    
    const batchKey = `${this.batchPrefix}${normalizedPhone}`;
    const lastMsgKey = `${this.lastMessagePrefix}${normalizedPhone}`;

    try {
      await this.redis.del(batchKey, lastMsgKey);
      logger.info(`Cleared batch for ${phone} (normalized: ${normalizedPhone})`);
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