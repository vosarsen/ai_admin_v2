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
        AI_PROMPT_VERSION: 'enhanced-prompt' // Оптимальный промпт для DeepSeek
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
      name: 'ai-admin-reminder',
      script: './src/workers/index-reminder.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/reminder-error.log',
      out_file: './logs/reminder-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '200M',
      kill_timeout: 5000
    },
    {
      name: 'venom-bot',
      script: '/opt/venom-bot/index.js',
      instances: 1,
      exec_mode: 'fork',
      cwd: '/opt/venom-bot',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/opt/venom-bot/logs/error.log',
      out_file: '/opt/venom-bot/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
    // ВРЕМЕННО ОТКЛЮЧЕНО - booking-monitor отправляет дублирующие уведомления
    // {
    //   name: 'ai-admin-booking-monitor',
    //   script: './src/workers/booking-monitor-worker.js',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: {
    //     NODE_ENV: 'production'
    //   },
    //   error_file: './logs/booking-monitor-error.log',
    //   out_file: './logs/booking-monitor-out.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss',
    //   max_memory_restart: '200M',
    //   kill_timeout: 5000,
    //   autorestart: true
    // }
  ]
};