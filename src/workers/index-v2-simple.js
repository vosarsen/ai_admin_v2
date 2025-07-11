// src/workers/index-v2-simple.js
// Упрощенная версия без cluster для тестирования

const logger = require('../utils/logger');
const config = require('../config');
const MessageWorker = require('./message-worker-v2');

async function startWorker() {
  try {
    logger.info('🚀 Starting AI Admin v2 worker (simple mode)...');
    logger.info(`📍 Company ID: ${config.yclients.companyId}`);
    
    const worker = new MessageWorker('worker-main');
    
    await worker.start();
    
    logger.info('✅ AI Admin v2 worker started successfully');
    
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
    
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start the worker
startWorker();