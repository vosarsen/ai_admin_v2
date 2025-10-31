/**
 * Конфигурация синхронизации данных из YClients
 * 
 * UPDATED: 2025-08-05T13:14:36.762Z
 */
module.exports = {
  // Основные настройки
  COMPANY_ID: process.env.YCLIENTS_COMPANY_ID || 962302,
  
  // Расписание синхронизации (время московское UTC+3)
  SCHEDULE: {
    'SERVICES': '0 1 * * *',
    'STAFF': '0 2 * * *',
    'CLIENTS': '0 3 * * *',
    'APPOINTMENTS': '0 4 * * *',
    'SCHEDULES': '0 5 * * *',              // Полная синхронизация на 30 дней (ночью)
    'SCHEDULES_TODAY': '0 8-23 * * *',     // Инкрементальная синхронизация сегодня+завтра (каждый час с 8:00 до 23:00)
    'CLEANUP': '0 6 * * *'
},
  
  // Настройки синхронизации клиентов
  CLIENTS: {
    // Синхронизировать историю визитов
    SYNC_VISIT_HISTORY: process.env.SYNC_CLIENT_VISITS === 'true' || false,
    
    // Максимальное количество клиентов для синхронизации истории за раз
    // (для предотвращения превышения лимитов API)
    MAX_VISITS_SYNC_PER_RUN: parseInt(process.env.MAX_VISITS_SYNC_PER_RUN) || 75,
    
    // Синхронизировать только клиентов с визитами за последние N дней
    // 0 = синхронизировать всех
    SYNC_RECENT_DAYS: parseInt(process.env.SYNC_RECENT_DAYS) || 60,
    
    // Минимальное количество визитов для синхронизации
    MIN_VISITS_TO_SYNC: parseInt(process.env.MIN_VISITS_TO_SYNC) || 1
  },
  
  // Настройки API лимитов
  API_LIMITS: {
    REQUESTS_PER_MINUTE: 160,
    REQUESTS_PER_SECOND: 4,
    MIN_DELAY_MS: 300,        // Минимум между запросами
    VISIT_SYNC_DELAY_MS: 400, // Задержка между синхронизацией визитов
    BATCH_SIZE: 150,          // Максимум записей за раз
    MAX_RETRIES: 3
  },
  
  // Режимы синхронизации
  MODES: {
    'FULL': 'full',
    'INCREMENTAL': 'incremental',
    'CRITICAL': 'critical'
},
  
  // Приоритеты синхронизации
  PRIORITIES: {
    'ACTIVE_CLIENTS': 1,
    'RECENT_CLIENTS': 2,
    'ALL_CLIENTS': 3
}
};