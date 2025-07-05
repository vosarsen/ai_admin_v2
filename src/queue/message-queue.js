// src/queue/message-queue.js
const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const { createRedisClient } = require('../utils/redis-factory');

class MessageQueue {
  constructor() {
    this.queues = new Map();
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
      logger.info(`🔧 Creating Bull queue: ${queueName}`);
      
      // Validate configuration before creating queue
      if (!config.redis.password) {
        logger.warn('Redis password is not set');
      }
      
      // Simplified Redis configuration for Bull
      const redisOpts = {
        redis: {
          ...config.redis.options,
          host: '127.0.0.1',
          port: 6379,
          password: config.redis.password
        },
        prefix: 'bull',
        defaultJobOptions: config.queue.defaultJobOptions
      };
      
      logger.debug('Creating Bull queue with options:', {
        queueName,
        redis: {
          host: redisOpts.redis.host,
          port: redisOpts.redis.port,
          passwordLength: redisOpts.redis.password ? redisOpts.redis.password.length : 0,
          options: redisOpts.redis
        },
        prefix: redisOpts.prefix,
        defaultJobOptions: redisOpts.defaultJobOptions
      });
      
      try {
        const queue = new Bull(queueName, redisOpts);
        logger.info(`✅ Bull queue created successfully: ${queueName}`);

        // Queue event monitoring
        queue.on('completed', (job) => {
          logger.info(`✅ Job ${job.id} completed in queue ${queueName}`);
        });

        queue.on('failed', (job, err) => {
          logger.error(`❌ Job ${job.id} failed in queue ${queueName}:`, err);
        });

        queue.on('stalled', (job) => {
          logger.warn(`⚠️ Job ${job.id} stalled in queue ${queueName}`);
        });
        
        queue.on('error', (error) => {
          logger.error(`🚨 Queue error in ${queueName}:`, error);
        });

        this.queues.set(queueName, queue);
      } catch (error) {
        logger.error(`Failed to create Bull queue ${queueName}:`, error);
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
      
      const queueName = `company:${companyId}:messages`;
      logger.debug(`📤 Adding message to queue: ${queueName}`);
      
      const queue = this.getQueue(queueName);
      
      const job = await queue.add({
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

      const job = await queue.add('send-reminder', data, {
        delay: Math.max(0, delay),
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 60000 // 1 minute between retries
        }
      });

      logger.info(`⏰ Reminder scheduled for ${scheduledTime.toISOString()}, job ID: ${job.id}`);
      return { success: true, jobId: job.id };
    } catch (error) {
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