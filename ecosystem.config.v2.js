// ecosystem.config.v2.js - Конфигурация для AI Admin v2
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
      script: './src/workers/index-v2.js', // ВАЖНО: используем v2!
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-v2-error.log',
      out_file: './logs/worker-v2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '400M',
      kill_timeout: 10000
    }
  ]
};