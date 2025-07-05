// src/workers/index.js
require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const config = require('../config');
const logger = require('../utils/logger');
const MessageWorker = require('./message-worker');
const ReminderWorker = require('./reminder-worker');

// Number of workers to spawn
const numWorkers = config.queue.maxConcurrentWorkers || os.cpus().length;

if (cluster.isMaster) {
  logger.info(`🏭 Master process ${process.pid} starting ${numWorkers} workers...`);
  
  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }
  
  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    logger.info('Starting a new worker...');
    cluster.fork();
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('🛑 Master received SIGTERM, shutting down workers...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    
    process.exit(0);
  });
  
} else {
  // Worker process - make it async
  async function startWorker() {
    const workerId = `worker-${process.pid}`;
    
    logger.info(`👷 Worker ${workerId} started`);
    
    // Initialize secure config
    const secureConfig = require('../config/secure-config');
    await secureConfig.initialize();
    
    // Create and start workers
    const messageWorker = new MessageWorker(workerId);
    const reminderWorker = new ReminderWorker(workerId);
    
    // Start processing
    Promise.all([
      messageWorker.start(),
      reminderWorker.start()
    ]).then(() => {
      logger.info(`✅ All workers started for ${workerId}`);
    }).catch(error => {
      logger.error(`Failed to start workers for ${workerId}:`, error);
      process.exit(1);
    });
  }
  
  // Start the worker
  startWorker().catch(error => {
    logger.error('Failed to initialize worker:', error);
    process.exit(1);
  });
}
