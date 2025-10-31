const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Дебаунсер для webhook событий
 * Предотвращает дублирование уведомлений при множественных событиях
 */
class WebhookDebouncer {
  constructor() {
    // Хранилище хешей последних обработанных событий
    this.processedHashes = new Map();
    
    // Время жизни хеша в памяти (5 минут)
    this.hashTTL = 5 * 60 * 1000;
    
    // Очистка старых хешей каждую минуту
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldHashes();
    }, 60 * 1000);
  }

  /**
   * Генерирует хеш для записи на основе важных полей
   */
  generateRecordHash(recordData) {
    // Выбираем только важные поля для хеша
    const significantData = {
      id: recordData.id,
      datetime: recordData.datetime,
      staff_id: recordData.staff?.id,
      services: recordData.services?.map(s => ({
        id: s.id,
        cost: s.cost,
        discount: s.discount
      })).sort((a, b) => a.id - b.id), // Сортируем для консистентности
      client_phone: recordData.client?.phone,
      deleted: recordData.deleted,
      attendance: recordData.visit_attendance,
      confirmed: recordData.confirmed
    };

    // Создаем хеш
    const dataString = JSON.stringify(significantData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Проверяет, изменились ли данные записи
   */
  hasRecordChanged(eventType, recordData) {
    const recordId = recordData.id;
    const currentHash = this.generateRecordHash(recordData);
    const key = `${eventType}:${recordId}`;
    
    // Получаем предыдущий хеш
    const previousEntry = this.processedHashes.get(key);
    
    if (!previousEntry) {
      // Первый раз видим эту запись
      this.processedHashes.set(key, {
        hash: currentHash,
        timestamp: Date.now(),
        processCount: 1
      });
      logger.info(`🆕 First time processing ${eventType} for record ${recordId}`);
      return true;
    }

    // Проверяем, изменился ли хеш
    if (previousEntry.hash === currentHash) {
      // Данные не изменились
      previousEntry.processCount++;
      logger.info(`🔄 Duplicate event detected for record ${recordId} (${previousEntry.processCount} times)`);
      return false;
    }

    // Данные изменились, обновляем хеш
    logger.info(`✅ Record ${recordId} has real changes`);
    this.processedHashes.set(key, {
      hash: currentHash,
      timestamp: Date.now(),
      processCount: 1
    });
    return true;
  }

  /**
   * Проверяет, нужно ли обрабатывать событие
   */
  shouldProcessEvent(eventType, recordData) {
    // Для событий создания всегда обрабатываем
    if (eventType === 'record.created') {
      return this.checkCreateEvent(recordData);
    }

    // Для update и delete проверяем изменения
    return this.hasRecordChanged(eventType, recordData);
  }

  /**
   * Специальная проверка для событий создания
   */
  checkCreateEvent(recordData) {
    const recordId = recordData.id;
    const key = `created:${recordId}`;
    
    // Проверяем, обрабатывали ли мы уже это создание
    if (this.processedHashes.has(key)) {
      logger.warn(`⚠️ Duplicate create event for record ${recordId}`);
      return false;
    }

    // Помечаем как обработанное
    this.processedHashes.set(key, {
      hash: this.generateRecordHash(recordData),
      timestamp: Date.now(),
      processCount: 1
    });
    
    return true;
  }

  /**
   * Очистка старых хешей из памяти
   */
  cleanupOldHashes() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.processedHashes.entries()) {
      if (now - entry.timestamp > this.hashTTL) {
        this.processedHashes.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned ${cleaned} old hashes from memory`);
    }
  }

  /**
   * Получить статистику дебаунсера
   */
  getStats() {
    const stats = {
      totalEntries: this.processedHashes.size,
      duplicates: 0,
      byEventType: {}
    };

    for (const [key, entry] of this.processedHashes.entries()) {
      const [eventType] = key.split(':');
      
      if (!stats.byEventType[eventType]) {
        stats.byEventType[eventType] = {
          total: 0,
          duplicates: 0
        };
      }
      
      stats.byEventType[eventType].total++;
      
      if (entry.processCount > 1) {
        stats.duplicates += entry.processCount - 1;
        stats.byEventType[eventType].duplicates += entry.processCount - 1;
      }
    }

    return stats;
  }

  /**
   * Остановка дебаунсера
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.processedHashes.clear();
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new WebhookDebouncer();
    }
    return instance;
  },
  WebhookDebouncer
};