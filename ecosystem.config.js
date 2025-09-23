// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ai-admin-api',
      script: './src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M'
    },
    {
      name: 'ai-admin-worker-v2',
      script: './src/workers/index-v2.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        AI_PROVIDER: 'deepseek', // Используем DeepSeek как стабильный провайдер
        AI_PROMPT_VERSION: 'two-stage', // Two-stage для быстрой обработки
        USE_TWO_STAGE: 'true' // Явно включаем two-stage процессор
      },
      error_file: './logs/worker-v2-error.log',
      out_file: './logs/worker-v2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '400M',
      kill_timeout: 10000
    },
    {
      name: 'ai-admin-batch-processor',
      script: './src/workers/batch-processor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/batch-processor-error.log',
      out_file: './logs/batch-processor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      kill_timeout: 5000
    },
    {
      name: 'whatsapp-backup-service',
      script: './scripts/automated-backup-service.js',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        BACKUP_SCHEDULE: '0 */6 * * *', // Every 6 hours
        BACKUP_COMPANIES: '962302',
        BACKUP_RETENTION_DAYS: '7',
        BACKUP_BEFORE_OPS: 'true',
        MAX_BACKUPS_PER_COMPANY: '10'
      },
      error_file: './logs/backup-error.log',
      out_file: './logs/backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '100M'
    },
    {
      name: 'whatsapp-safe-monitor',
      script: './scripts/whatsapp-safe-monitor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        COMPANY_ID: '962302',
        CHECK_INTERVAL: '60000',
        USE_PAIRING_CODE: 'true',
        WHATSAPP_PHONE_NUMBER: '79936363848' // Бизнес номер барбершопа
      },
      error_file: './logs/whatsapp-monitor-error.log',
      out_file: './logs/whatsapp-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '100M',
      autorestart: false // Don't auto-restart if stopped manually
    },
    {
      name: 'ai-admin-booking-monitor',
      script: './src/workers/booking-monitor-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/booking-monitor-error.log',
      out_file: './logs/booking-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      kill_timeout: 5000,
      autorestart: true
    },
    {
      name: 'ai-admin-telegram-bot',
      script: './scripts/telegram-bot.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/telegram-bot-error.log',
      out_file: './logs/telegram-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '100M',
      autorestart: true
    }
  ]
};