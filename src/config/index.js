// src/config/index.js
require('dotenv').config();
const secureConfig = require('./secure-config');

// Helper to get config value with secure fallback
const getConfig = (key) => secureConfig.get(key) || process.env[key];

// Export as getter functions to ensure fresh values
module.exports = {
  get app() {
    return {
      env: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 3000,
      logLevel: process.env.LOG_LEVEL || 'info',
      version: process.env.npm_package_version || '2.0.0'
    };
  },

  get redis() {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: getConfig('REDIS_PASSWORD')
    };
  },

  get whatsapp() {
    return {
      venomServerUrl: process.env.VENOM_SERVER_URL || 'http://localhost:3001',
      apiKey: getConfig('VENOM_API_KEY'),
      secretKey: getConfig('VENOM_SECRET_KEY'),
      webhookUrl: process.env.WEBHOOK_URL
    };
  },

  get yclients() {
    return {
      bearerToken: process.env.YCLIENTS_BEARER_TOKEN,
      userToken: process.env.YCLIENTS_USER_TOKEN,
      partnerId: process.env.YCLIENTS_PARTNER_ID,
      companyId: process.env.YCLIENTS_COMPANY_ID,
      apiUrl: 'https://api.yclients.com/api/v1',
      timeout: 30000,
      rateLimit: {
        requestsPerHour: 450,
        burstLimit: 10
      }
    };
  },

  get ai() {
    return {
      apiKey: getConfig('DEEPSEEK_API_KEY'),
      apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 1500,
      timeout: 30000
    };
  },

  get database() {
    return {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: getConfig('SUPABASE_KEY')
    };
  },

  get queue() {
    return {
      maxConcurrentWorkers: parseInt(process.env.MAX_CONCURRENT_WORKERS) || 3,
      messageQueueName: process.env.MESSAGE_QUEUE_NAME || 'whatsapp-messages',
      reminderQueueName: process.env.REMINDER_QUEUE_NAME || 'reminders'
    };
  },

  get business() {
    return {
      reminderAdvanceHours: parseInt(process.env.REMINDER_ADVANCE_HOURS) || 2,
      reminderDayBeforeTime: process.env.REMINDER_DAY_BEFORE_TIME || '20:00',
      maxBookingDaysAhead: parseInt(process.env.MAX_BOOKING_DAYS_AHEAD) || 30,
      minBookingMinutesAhead: parseInt(process.env.MIN_BOOKING_MINUTES_AHEAD) || 30,
      timezone: 'Europe/Moscow'
    };
  },

  get security() {
    return {
      masterKey: getConfig('MASTER_KEY'),
      secretsPath: process.env.SECRETS_PATH || '.secrets'
    };
  }
};
