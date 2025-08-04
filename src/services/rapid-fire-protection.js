// src/services/rapid-fire-protection.js
const smartCache = require('./cache/smart-cache');
const logger = require('../utils/logger');

/**
 * 🔥 RAPID-FIRE PROTECTION
 * Защита от множественных сообщений за короткий период
 * 
 * По ТЗ:
 * - Ждем 5 секунд после получения сообщения
 * - Если за это время приходят еще сообщения, ждем еще 5 секунд
 * - Максимум ожидания: 15 секунд
 * - Все сообщения объединяются в одно и обрабатываются вместе
 */
class RapidFireProtection {
  constructor() {
    this.pendingMessages = new Map(); // phone -> { messages, timer, startTime }
    this.config = {
      waitTime: 5000,      // 5 секунд ожидания
      maxWaitTime: 15000,  // 15 секунд максимум
      maxMessages: 10      // Максимум сообщений для объединения
    };
  }

  /**
   * Обработка входящего сообщения с rapid-fire защитой
   */
  async processMessage(phone, message, callback) {
    const normalizedPhone = phone.replace('@c.us', '');
    
    logger.debug(`🔥 Rapid-fire check for ${normalizedPhone}: "${message}"`);

    // Проверяем есть ли уже pending сообщения от этого номера
    if (this.pendingMessages.has(normalizedPhone)) {
      return this._addToPendingBatch(normalizedPhone, message, callback);
    } else {
      return this._startNewBatch(normalizedPhone, message, callback);
    }
  }

  /**
   * Начинаем новую партию сообщений
   */
  _startNewBatch(phone, message, callback) {
    logger.info(`🆕 Starting new message batch for ${phone}`);
    
    const batchData = {
      messages: [message],
      callback,
      startTime: Date.now(),
      timer: null
    };

    // Устанавливаем таймер на первое ожидание
    batchData.timer = setTimeout(() => {
      this._processBatch(phone);
    }, this.config.waitTime);

    this.pendingMessages.set(phone, batchData);
    
    logger.debug(`⏱️ Timer set for ${this.config.waitTime}ms for ${phone}`);
  }

  /**
   * Добавляем сообщение к существующей партии
   */
  _addToPendingBatch(phone, message, callback) {
    const batchData = this.pendingMessages.get(phone);
    
    if (!batchData) {
      return this._startNewBatch(phone, message, callback);
    }

    // Добавляем сообщение к партии
    batchData.messages.push(message);
    
    const timeElapsed = Date.now() - batchData.startTime;
    const remainingTime = this.config.maxWaitTime - timeElapsed;
    
    logger.info(`🔥 Added message to existing batch for ${phone}. Messages: ${batchData.messages.length}, Time elapsed: ${timeElapsed}ms`);

    // Проверяем лимиты
    if (batchData.messages.length >= this.config.maxMessages) {
      logger.warn(`📨 Max messages limit reached for ${phone}, processing immediately`);
      clearTimeout(batchData.timer);
      return this._processBatch(phone);
    }

    if (remainingTime <= 0) {
      logger.warn(`⏰ Max wait time reached for ${phone}, processing immediately`);
      clearTimeout(batchData.timer);
      return this._processBatch(phone);
    }

    // Сбрасываем таймер и устанавливаем новый
    clearTimeout(batchData.timer);
    batchData.timer = setTimeout(() => {
      this._processBatch(phone);
    }, Math.min(this.config.waitTime, remainingTime));
    
    logger.debug(`⏱️ Timer reset for ${Math.min(this.config.waitTime, remainingTime)}ms for ${phone}`);
  }

  /**
   * Обрабатываем накопившуюся партию сообщений
   */
  async _processBatch(phone) {
    const batchData = this.pendingMessages.get(phone);
    
    if (!batchData) {
      logger.warn(`No batch data found for ${phone}`);
      return;
    }

    // Удаляем из pending
    this.pendingMessages.delete(phone);
    clearTimeout(batchData.timer);

    const { messages, callback, startTime } = batchData;
    const totalWaitTime = Date.now() - startTime;
    
    logger.info(`📦 Processing message batch for ${phone}:`, {
      messageCount: messages.length,
      totalWaitTime: `${totalWaitTime}ms`,
      messages: messages.map(m => m.substring(0, 50) + (m.length > 50 ? '...' : ''))
    });

    try {
      // Объединяем сообщения в одно
      const combinedMessage = this._combineMessages(messages);
      
      // Вызываем callback с объединенным сообщением
      await callback(combinedMessage, {
        isRapidFireBatch: true,
        originalMessagesCount: messages.length,
        totalWaitTime,
        originalMessages: messages
      });
      
      logger.info(`✅ Rapid-fire batch processed successfully for ${phone}`);
      
    } catch (error) {
      logger.error(`❌ Error processing rapid-fire batch for ${phone}:`, error);
      
      // В случае ошибки пытаемся обработать последнее сообщение отдельно
      try {
        const lastMessage = messages[messages.length - 1];
        await callback(lastMessage, {
          isRapidFireFallback: true,
          error: error.message
        });
      } catch (fallbackError) {
        logger.error(`❌ Fallback also failed for ${phone}:`, fallbackError);
      }
    }
  }

  /**
   * Объединение нескольких сообщений в одно логичное
   */
  _combineMessages(messages) {
    if (messages.length === 1) {
      return messages[0];
    }

    // Убираем дубликаты
    const uniqueMessages = [...new Set(messages)];
    
    if (uniqueMessages.length === 1) {
      return uniqueMessages[0];
    }

    // Проверяем есть ли развитие мысли
    const combined = uniqueMessages.join(' ');
    
    // Если сообщения короткие, объединяем через точку
    if (combined.length < 200) {
      return uniqueMessages.join('. ');
    }

    // Для длинных сообщений добавляем префикс
    return `Несколько сообщений: ${uniqueMessages.join('. ')}`;
  }

  /**
   * Принудительная обработка всех pending сообщений
   */
  async flushAll() {
    logger.info(`🚿 Flushing all pending messages (${this.pendingMessages.size} batches)`);
    
    const phones = Array.from(this.pendingMessages.keys());
    
    for (const phone of phones) {
      await this._processBatch(phone);
    }
    
    logger.info(`✅ All pending messages flushed`);
  }

  /**
   * Принудительная обработка сообщений конкретного номера
   */
  async flushPhone(phone) {
    const normalizedPhone = phone.replace('@c.us', '');
    
    if (this.pendingMessages.has(normalizedPhone)) {
      logger.info(`🚿 Flushing pending messages for ${normalizedPhone}`);
      await this._processBatch(normalizedPhone);
    }
  }

  /**
   * Получение статистики rapid-fire защиты
   */
  getStats() {
    const pending = Array.from(this.pendingMessages.entries()).map(([phone, data]) => ({
      phone,
      messageCount: data.messages.length,
      waitingTime: Date.now() - data.startTime,
      maxWaitTime: this.config.maxWaitTime
    }));

    return {
      config: this.config,
      pendingBatches: this.pendingMessages.size,
      pending,
      totalPendingMessages: pending.reduce((sum, batch) => sum + batch.messageCount, 0)
    };
  }

  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('🔧 Rapid-fire protection config updated:', this.config);
  }

  /**
   * Graceful shutdown
   */
  async destroy() {
    logger.info('🛑 Shutting down rapid-fire protection...');
    await this.flushAll();
    logger.info('✅ Rapid-fire protection shutdown complete');
  }
}

// Singleton instance
module.exports = new RapidFireProtection();