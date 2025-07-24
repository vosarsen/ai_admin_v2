// src/workers/index-reminder.js
const logger = require('../utils/logger');
const ReminderWorker = require('./reminder-worker');

// Start reminder worker
const workerId = `reminder-${process.pid}`;
const worker = new ReminderWorker(workerId);

logger.info('🚀 Starting reminder worker...');

// Start processing
worker.start().catch(error => {
  logger.error('Failed to start reminder worker:', error);
  process.exit(1);
});

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