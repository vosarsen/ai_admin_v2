// src/workers/index-reminder.js
const logger = require('../utils/logger');
const ReminderWorkerV2 = require('./reminder-worker-v2');
const reminderService = require('../services/reminder');

// Start reminder worker v2
const workerId = `reminder-v2-${process.pid}`;
const worker = new ReminderWorkerV2(workerId);

logger.info('🚀 Starting reminder worker...');

// Start processing
worker.start().catch(error => {
  logger.error('Failed to start reminder worker:', error);
  process.exit(1);
});

// Schedule reminders for existing bookings on startup
reminderService.scheduleRemindersForExistingBookings()
  .then(() => logger.info('✅ Initial reminder scheduling completed'))
  .catch(error => logger.error('Failed to schedule initial reminders:', error));

// Schedule reminders check every 30 minutes
setInterval(() => {
  logger.info('🔄 Running periodic reminder scheduling...');
  reminderService.scheduleRemindersForExistingBookings()
    .then(() => logger.info('✅ Periodic reminder scheduling completed'))
    .catch(error => logger.error('Failed to schedule periodic reminders:', error));
}, 30 * 60 * 1000); // 30 minutes

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

logger.info('✨ Reminder worker started successfully');