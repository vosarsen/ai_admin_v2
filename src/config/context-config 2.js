/**
 * Конфигурация системы контекста
 * Централизованное управление TTL и другими параметрами
 */

module.exports = {
  // TTL для разных типов данных (в секундах)
  ttl: {
    // Контекст текущего диалога
    dialog: {
      messages: process.env.CONTEXT_TTL_MESSAGES || 24 * 60 * 60,        // 24 часа
      selection: process.env.CONTEXT_TTL_SELECTION || 2 * 60 * 60,       // 2 часа
      pendingAction: process.env.CONTEXT_TTL_PENDING || 30 * 60,         // 30 минут
    },
    
    // Кэш данных
    cache: {
      client: process.env.CONTEXT_TTL_CLIENT_CACHE || 24 * 60 * 60,     // 24 часа
      services: process.env.CONTEXT_TTL_SERVICES || 12 * 60 * 60,       // 12 часов
      staff: process.env.CONTEXT_TTL_STAFF || 12 * 60 * 60,             // 12 часов
      fullContext: process.env.CONTEXT_TTL_FULL || 12 * 60 * 60,        // 12 часов
    },
    
    // Долгосрочные данные
    persistent: {
      preferences: process.env.CONTEXT_TTL_PREFERENCES || 30 * 24 * 60 * 60,  // 30 дней
      clientInfo: process.env.CONTEXT_TTL_CLIENT_INFO || 7 * 24 * 60 * 60,   // 7 дней
    },
    
    // Временные данные
    temporary: {
      processing: process.env.CONTEXT_TTL_PROCESSING || 5 * 60,         // 5 минут
      intermediate: process.env.CONTEXT_TTL_INTERMEDIATE || 5 * 60,     // 5 минут
    },
    
    // Старая система (для обратной совместимости)
    legacy: {
      context: process.env.CONTEXT_TTL_LEGACY || 30 * 24 * 60 * 60,    // 30 дней
      shortTerm: process.env.CONTEXT_TTL_SHORT || 24 * 60 * 60,        // 24 часа
    }
  },

  // Лимиты
  limits: {
    maxMessages: process.env.CONTEXT_MAX_MESSAGES || 50,               // Макс сообщений в истории
    maxCacheSize: process.env.CONTEXT_MAX_CACHE_SIZE || 100,          // Макс элементов в кэше
    maxSelectionAge: process.env.CONTEXT_MAX_SELECTION_AGE || 7200,   // Макс возраст selection (сек)
  },

  // Redis конфигурация
  redis: {
    keyPrefix: process.env.REDIS_KEY_PREFIX || '',
    
    // Префиксы для разных систем
    prefixes: {
      v1: 'context:',
      v2: {
        dialog: 'dialog:',
        client: 'client:',
        preferences: 'prefs:',
        messages: 'messages:',
        fullContext: 'full_ctx:',
        processing: 'processing:'
      },
      intermediate: 'intermediate:',
      cache: 'cache:'
    }
  },

  // Флаги миграции
  migration: {
    useV2: process.env.USE_CONTEXT_V2 === 'true',
    autoMigrate: process.env.AUTO_MIGRATE_CONTEXT === 'true',
    logMigration: process.env.LOG_CONTEXT_MIGRATION === 'true'
  },

  // Логирование
  logging: {
    // НЕ логировать персональные данные
    logPersonalData: process.env.LOG_PERSONAL_DATA === 'true' || false,
    logFullContext: process.env.LOG_FULL_CONTEXT === 'true' || false,
    logRedisOperations: process.env.LOG_REDIS_OPS === 'true' || false,
    
    // Поля для маскирования в логах
    sensitiveFields: [
      'phone',
      'clientName', 
      'name',
      'email',
      'fullData',
      'messages',
      'data'
    ]
  },

  // Валидация
  validation: {
    enabled: process.env.CONTEXT_VALIDATION === 'true' || true,
    strictMode: process.env.CONTEXT_STRICT_MODE === 'true' || false,
    
    // Обязательные поля
    requiredFields: {
      getContext: ['phone', 'companyId'],
      saveContext: ['phone', 'companyId'],
      updateDialog: ['phone', 'companyId', 'selection']
    }
  },

  // Производительность
  performance: {
    enableCache: process.env.ENABLE_CONTEXT_CACHE !== 'false',
    cacheType: process.env.CONTEXT_CACHE_TYPE || 'memory', // memory | redis
    batchOperations: process.env.BATCH_REDIS_OPS === 'true' || false,
    parallelLoads: process.env.PARALLEL_CONTEXT_LOADS === 'true' || true
  },

  // Метрики
  metrics: {
    enabled: process.env.CONTEXT_METRICS === 'true' || true,
    reportInterval: process.env.METRICS_INTERVAL || 60000, // 1 минута
    
    // Что отслеживать
    track: {
      cacheHitRate: true,
      operationTime: true,
      errorRate: true,
      migrationProgress: true
    }
  }
};

// Вспомогательная функция для безопасного логирования
module.exports.sanitizeForLogging = function(data) {
  if (!module.exports.logging.logPersonalData) {
    const sanitized = { ...data };
    
    module.exports.logging.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        if (typeof sanitized[field] === 'string') {
          // Маскируем строки
          sanitized[field] = sanitized[field].substring(0, 3) + '***';
        } else if (Array.isArray(sanitized[field])) {
          // Маскируем массивы
          sanitized[field] = `[${sanitized[field].length} items]`;
        } else if (typeof sanitized[field] === 'object') {
          // Маскируем объекты
          sanitized[field] = '[REDACTED]';
        }
      }
    });
    
    return sanitized;
  }
  
  return data;
};