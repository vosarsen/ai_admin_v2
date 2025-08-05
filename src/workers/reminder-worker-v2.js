// src/workers/reminder-worker-v2.js
const { Worker } = require('bullmq');
const config = require('../config');
const { getBullMQRedisConfig } = require('../config/redis-config');
const logger = require('../utils/logger');
const reminderService = require('../services/reminder');

class ReminderWorkerV2 {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
    this.worker = null;
    this.connection = getBullMQRedisConfig();
    
    logger.debug('ReminderWorkerV2 Redis config:', {
      host: this.connection.host,
      port: this.connection.port,
      hasPassword: !!this.connection.password
    });
  }

  /**
   * Start processing reminders
   */
  async start() {
    logger.info(`⏰ Reminder worker v2 ${this.workerId} starting...`);
    this.isRunning = true;
    
    this.worker = new Worker(
      'reminders',
      async (job) => {
        const { phone, booking, message } = job.data;
        
        logger.info(`📨 Processing reminder for ${phone}:`, {
          jobId: job.id,
          bookingId: booking.id,
          type: job.name
        });
        
        try {
          // Process reminder through reminder service
          await reminderService.sendReminder(phone, booking, message);
          
          this.processedCount++;
          logger.info(`✅ Reminder sent successfully to ${phone}`);
          
          return { success: true, processedAt: new Date() };
        } catch (error) {
          logger.error(`❌ Failed to send reminder to ${phone}:`, error);
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: 5,
        removeOnComplete: {
          age: 24 * 3600,  // 24 hours
          count: 100
        },
        removeOnFail: {
          age: 7 * 24 * 3600  // 7 days
        }
      }
    );

    // Error handling
    this.worker.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      logger.error('Worker error:', err);
    });

    logger.info(`✅ Reminder worker v2 ${this.workerId} started successfully`);
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    logger.info(`⏹️ Stopping reminder worker v2 ${this.workerId}...`);
    this.isRunning = false;
    
    if (this.worker) {
      await this.worker.close();
    }
    
    logger.info(`✅ Reminder worker v2 ${this.workerId} stopped. Processed ${this.processedCount} reminders`);
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      startTime: this.startTime,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }
}

module.exports = ReminderWorkerV2;