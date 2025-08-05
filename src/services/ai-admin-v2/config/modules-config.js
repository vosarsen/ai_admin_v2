/**
 * Конфигурация для модулей AI Admin v2
 * 
 * Все магические числа и захардкоженные значения вынесены сюда
 * для централизованного управления и легкой настройки
 */

module.exports = {
  /**
   * LRU Cache конфигурация
   */
  cache: {
    defaultMaxSize: 100,                    // Максимальный размер кеша по умолчанию
    defaultTTL: 5 * 60 * 1000,             // 5 минут TTL по умолчанию
    cleanupInterval: 5 * 60 * 1000,        // Интервал очистки кеша - 5 минут
    contextCacheSize: 500,                  // Размер кеша контекстов
    contextCacheTTL: 5 * 60 * 1000,        // TTL для кеша контекстов - 5 минут
  },

  /**
   * Circuit Breaker конфигурация
   */
  circuitBreaker: {
    defaultFailureThreshold: 5,             // Порог ошибок для открытия
    defaultResetTimeout: 60000,             // 1 минута до попытки восстановления
    defaultMonitoringPeriod: 10000,         // 10 секунд окно мониторинга
    defaultTimeout: 30000,                  // 30 секунд таймаут запроса
  },

  /**
   * Rate Limiter конфигурация
   */
  rateLimiter: {
    defaultWindowMs: 60000,                 // 1 минута окно
    defaultMaxRequests: 30,                 // Максимум 30 запросов в окно
    defaultBlockDuration: 300000,           // 5 минут блокировки
    violationsBeforeBlock: 3,               // Количество нарушений до блокировки
    cleanupIntervalMin: 60000,              // Минимальный интервал очистки - 1 минута
  },

  /**
   * Performance Metrics конфигурация
   */
  performanceMetrics: {
    maxSamples: 1000,                       // Максимум сэмплов для процентилей
    percentileCalculationInterval: 60000,   // Расчет процентилей каждую минуту
    sampleBatchRemovePercent: 0.2,          // Удалять 20% старых сэмплов при достижении лимита
    memoryEstimates: {
      bytesPerSample: 8,                    // Примерно 8 байт на число
      bytesPerOperation: 100,               // Примерно 100 байт на операцию
    }
  },

  /**
   * Error Handler конфигурация
   */
  errorHandler: {
    retry: {
      maxAttempts: 3,                       // Максимум попыток
      initialDelay: 1000,                   // Начальная задержка - 1 секунда
      maxDelay: 10000,                      // Максимальная задержка - 10 секунд
      backoffFactor: 2,                     // Фактор экспоненциальной задержки
      jitterPercent: 0.1,                   // 10% случайного разброса
    },
    retryableCodes: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR', 
      'RATE_LIMIT_ERROR',
      'TEMPORARY_ERROR'
    ]
  },

  /**
   * Service Matcher конфигурация
   */
  serviceMatcher: {
    scoring: {
      exactMatch: 1000,                     // Баллы за точное совпадение
      allWordsMatch: 500,                   // Баллы за совпадение всех слов
      titleContainsQuery: 80,               // Баллы если название содержит запрос
      queryContainsTitle: 70,               // Баллы если запрос содержит название
      wordMatch: 20,                        // Баллы за каждое совпавшее слово
      synonymMatch: 30,                     // Баллы за совпадение синонимов
      popularServiceBonus: 5,               // Бонус за популярную услугу
      simpleServiceBonus: 25,               // Бонус за простую услугу
      longTitlePenalty: -20,                // Штраф за длинное название
      complexServicePenalty: -30,           // Штраф за каждый "+" в услуге
      premiumPenalty: -15,                  // Штраф за премиум услуги
    },
    thresholds: {
      minWordLength: 2,                     // Минимальная длина значимого слова
      maxSimpleServiceWords: 2,             // Максимум слов для "простой" услуги
      longTitleWords: 5,                    // Порог для "длинного" названия
      popularServiceBookings: 100,          // Порог для "популярной" услуги
      logScoreThreshold: 50,                // Минимальный score для логирования
    },
    topMatchesLimit: 3,                     // Лимит топ совпадений для логирования
    defaultSearchLimit: 3,                  // Лимит результатов поиска по умолчанию
  },

  /**
   * Context Manager конфигурация
   */
  contextManager: {
    memoryCheckInterval: 60 * 1000,         // Проверка памяти каждую минуту
    processingTimeout: 3000,                // Таймаут ожидания обработки - 3 секунды
    topServicesLimit: 10,                   // Лимит топ услуг для отображения
    scoring: {
      frequentService: 1000,                // Баллы за частую услугу
      hasBooking: 100,                      // Баллы за наличие записи
    }
  },

  /**
   * Message Processor конфигурация  
   */
  messageProcessor: {
    intermediateContextTimeout: 3000,       // Таймаут ожидания промежуточного контекста
    criticalCommands: [
      'CREATE_BOOKING',
      'CANCEL_BOOKING', 
      'RESCHEDULE_BOOKING',
      'SAVE_CLIENT_NAME'
    ]
  },

  /**
   * Command Executor конфигурация
   */
  commandExecutor: {
    criticalCommands: [
      'CREATE_BOOKING',
      'CANCEL_BOOKING',
      'RESCHEDULE_BOOKING', 
      'CONFIRM_BOOKING',
      'MARK_NO_SHOW'
    ]
  },

  /**
   * Date/Time конфигурация
   */
  dateTime: {
    dayInMs: 86400000,                     // День в миллисекундах
    formats: {
      date: 'YYYY-MM-DD',
      time: 'HH:mm',
      datetime: 'YYYY-MM-DD HH:mm'
    },
    timeMapping: {
      'утро 10': '10:00',
      'на утро 10': '10:00',
      'вечер 8': '20:00',
      'день 3': '15:00'
    }
  }
};