// src/workers/index-v2.js
const cluster = require('cluster');
const os = require('os');
const logger = require('../utils/logger');
const config = require('../config');

// Используем новый воркер
const MessageWorker = require('./message-worker-v2');

if (cluster.isMaster) {
  const numWorkers = config.workers?.messageWorkers || 1;
  
  logger.info(`🚀 Starting AI Admin v2 with ${numWorkers} workers...`);
  logger.info(`📍 Company ID: ${config.yclients.companyId}`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  // Handle worker deaths
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id].send('shutdown');
    }
  });
  
} else {
  // Worker process
  const workerId = `worker-${process.pid}`;
  const worker = new MessageWorker(workerId);
  
  // Start processing
  worker.start().catch(error => {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  });
  
  // Handle shutdown
  process.on('message', async (msg) => {
    if (msg === 'shutdown') {
      logger.info(`Worker ${workerId} shutting down...`);
      await worker.stop();
      process.exit(0);
    }
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
}

logger.info('✨ AI Admin v2 workers started successfully');