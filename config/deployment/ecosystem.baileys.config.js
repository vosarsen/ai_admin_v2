module.exports = {
  apps: [
    {
      name: 'baileys-whatsapp',
      script: 'scripts/baileys-service.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        COMPANY_ID: '962302',
        USE_PAIRING_CODE: 'false',
        WHATSAPP_PHONE_NUMBER: '79936363848',
        BAILEYS_PORT: '3003'
      },
      error_file: './logs/baileys-error.log',
      out_file: './logs/baileys-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};