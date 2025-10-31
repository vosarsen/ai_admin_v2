/**
 * Конфигурация синхронизации данных из YClients
 */
module.exports = {
  // Основные настройки
  COMPANY_ID: process.env.YCLIENTS_COMPANY_ID || 962302,
  
  // Расписание синхронизации (время московское UTC+3)
  SCHEDULE: {
    SERVICES: '0 1 * * *',       // 01:00 - Услуги (редко меняются)
    STAFF: '0 2 * * *',          // 02:00 - Мастера (редко меняются) 
    CLIENTS: '0 3 * * *',        // 03:00 - Клиенты (часто меняются)
    APPOINTMENTS: '0 4 * * *',   // 04:00 - Записи (очень часто меняются)
    SCHEDULES: '0 5 * * *',      // 05:00 - Расписания мастеров
    CLEANUP: '0 6 * * *'         // 06:00 - Очистка старых данных
  },
  
  // Настройки синхронизации клиентов
  CLIENTS: {
    // Синхронизировать историю визитов
    SYNC_VISIT_HISTORY: process.env.SYNC_CLIENT_VISITS === 'true' || false,
    
    // Максимальное количество клиентов для синхронизации истории за раз
    // (для предотвращения превышения лимитов API)
    MAX_VISITS_SYNC_PER_RUN: parseInt(process.env.MAX_VISITS_SYNC_PER_RUN) || 100,
    
    // Синхронизировать только клиентов с визитами за последние N дней
    // 0 = синхронизировать всех
    SYNC_RECENT_DAYS: parseInt(process.env.SYNC_RECENT_DAYS) || 0,
    
    // Минимальное количество визитов для синхронизации
    MIN_VISITS_TO_SYNC: parseInt(process.env.MIN_VISITS_TO_SYNC) || 1
  },
  
  // Настройки API лимитов
  API_LIMITS: {
    REQUESTS_PER_MINUTE: 200,
    REQUESTS_PER_SECOND: 5,
    MIN_DELAY_MS: 250,        // Минимум 250мс между запросами
    VISIT_SYNC_DELAY_MS: 300, // Задержка между синхронизацией визитов
    BATCH_SIZE: 200,          // Максимум записей за раз
    MAX_RETRIES: 3
  },
  
  // Режимы синхронизации
  MODES: {
    // Полная синхронизация всех данных
    FULL: 'full',
    
    // Инкрементальная синхронизация только изменений
    INCREMENTAL: 'incremental',
    
    // Синхронизация только критичных данных
    CRITICAL: 'critical'
  },
  
  // Приоритеты синхронизации
  PRIORITIES: {
    // Клиенты с записями на сегодня/завтра
    ACTIVE_CLIENTS: 1,
    
    // Клиенты с недавними визитами (последние 30 дней)
    RECENT_CLIENTS: 2,
    
    // Все остальные клиенты
    ALL_CLIENTS: 3
  }
};