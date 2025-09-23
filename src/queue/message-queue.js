// src/queue/message-queue.js
const { Queue } = require('bullmq');
const config = require('../config');
const { getBullMQRedisConfig } = require('../config/redis-config');
const logger = require('../utils/logger');

class MessageQueue {
  constructor() {
    this.queues = new Map();
    this.connection = getBullMQRedisConfig();
    
    logger.debug('MessageQueue Redis config:', {
      host: this.connection.host,
      port: this.connection.port,
      hasPassword: !!this.connection.password
    });
  }

  /**
   * Get or create a queue
   */
  getQueue(queueName) {
    if (!queueName) {
      logger.error('Queue name is undefined!', new Error().stack);
      throw new Error('Queue name is required and cannot be undefined');
    }
    
    if (!this.queues.has(queueName)) {
      logger.info(`🔧 Creating BullMQ queue: ${queueName}`);
      
      // Validate configuration before creating queue
      if (!config.redis.password) {
        logger.warn('Redis password is not set');
      }
      
      logger.debug('Creating BullMQ queue with options:', {
        queueName,
        connection: {
          host: this.connection.host,
          port: this.connection.port,
          passwordLength: this.connection.password ? this.connection.password.length : 0
        },
        defaultJobOptions: config.queue.defaultJobOptions
      });
      
      try {
        const queue = new Queue(queueName, {
          connection: this.connection,
          defaultJobOptions: config.queue.defaultJobOptions
        });
        
        logger.info(`✅ BullMQ queue created successfully: ${queueName}`);

        this.queues.set(queueName, queue);
      } catch (error) {
        logger.error(`Failed to create BullMQ queue ${queueName}:`, error);
        throw error;
      }
    }

    return this.queues.get(queueName);
  }

  /**
   * Add message to queue
   */
  async addMessage(companyId, data, options = {}) {
    try {
      if (!companyId) {
        throw new Error('CompanyId is required and cannot be undefined');
      }
      
      const queueName = `company-${companyId}-messages`;
      logger.debug(`📤 Adding message to queue: ${queueName}`);
      
      const queue = this.getQueue(queueName);
      
      const job = await queue.add('process-message', {
        ...data,
        companyId,
        timestamp: new Date().toISOString()
      }, {
        ...options,
        priority: options.priority || 0
      });

      logger.info(`📤 Message added to queue ${queueName}, job ID: ${job.id}`);
      return { success: true, jobId: job.id };
    } catch (error) {
      logger.error('Failed to add message to queue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add reminder to queue
   */
  async addReminder(data, scheduledTime) {
    try {
      const queue = this.getQueue(config.queue.reminderQueue);
      const delay = scheduledTime.getTime() - Date.now();

      if (delay < 0) {
        logger.warn('Reminder scheduled for past time, sending immediately');
      }

      // Generate unique job ID based on booking and reminder type
      const jobId = `reminder-${data.bookingId || data.booking?.record_id}-${data.type}-${data.phone}`;

      const job = await queue.add('send-reminder', data, {
        jobId, // Prevent duplicate jobs with same ID
        delay: Math.max(0, delay),
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 60000 // 1 minute between retries
        }
      });

      logger.info(`⏰ Reminder scheduled for ${scheduledTime.toISOString()}, job ID: ${job.id}, unique ID: ${jobId}`);
      return { success: true, jobId: job.id };
    } catch (error) {
      // Check if it's a duplicate job error
      if (error.message && error.message.includes('Job already exists')) {
        logger.debug(`Reminder already scheduled with ID: ${jobId}, skipping duplicate`);
        return { success: true, duplicate: true, jobId };
      }
      logger.error('Failed to schedule reminder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get queue metrics
   */
  async getMetrics(queueName) {
    try {
      const queue = this.getQueue(queueName);
      
      const [
        waiting,
        active,
        completed,
        failed,
        delayed
      ] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed
      };
    } catch (error) {
      logger.error('Failed to get queue metrics:', error);
      return null;
    }
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(queueName, grace = 3600000) { // 1 hour default
    try {
      const queue = this.getQueue(queueName);
      
      await queue.clean(grace, 'completed');
      await queue.clean(grace * 24, 'failed'); // Keep failed jobs longer
      
      logger.info(`🧹 Cleaned old jobs from queue ${queueName}`);
    } catch (error) {
      logger.error('Failed to clean queue:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🛑 Shutting down message queues...');
    
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`📪 Queue ${name} closed`);
    }
    
    logger.info('✅ Message queues shutdown complete');
  }
}

// Singleton instance
module.exports = new MessageQueue();