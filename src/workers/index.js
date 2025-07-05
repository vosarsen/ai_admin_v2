// src/workers/index.js
require('dotenv').config();
const config = require('../config');
const logger = require('../utils/logger');
const MessageWorker = require('./message-worker');
const ReminderWorker = require('./reminder-worker');
const secureConfig = require('../config/secure-config');

// Single worker process
async function startWorker() {
  const workerId = `worker-${process.pid}`;
  
  try {
    logger.info(`👷 Worker ${workerId} starting...`);
    
    // Initialize secure config
    logger.info('🔑 Initializing secure configuration...');
    await secureConfig.initialize();
    
    // Create and start workers
    const messageWorker = new MessageWorker(workerId);
    const reminderWorker = new ReminderWorker(workerId);
    
    // Start processing
    await Promise.all([
      messageWorker.start(),
      reminderWorker.start()
    ]);
    
    logger.info(`✅ All workers started for ${workerId}`);
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('🛑 Worker received SIGTERM, shutting down...');
      // TODO: Add cleanup logic here
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      logger.info('🛑 Worker received SIGINT, shutting down...');
      // TODO: Add cleanup logic here
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Failed to start worker ${workerId}:`, error);
    process.exit(1);
  }
}

// Start the worker
startWorker().catch(error => {
  logger.error('Failed to initialize worker:', error);
  process.exit(1);
});
