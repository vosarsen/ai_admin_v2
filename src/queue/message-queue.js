// src/queue/message-queue.js
const Bull = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const { createRedisClient } = require('../utils/redis-factory');

class MessageQueue {
  constructor() {
    // Create Redis client with authentication
    this.redis = createRedisClient('queue');
    this.queues = new Map();
    
    // Monitor Redis connection
    this.redis.on('connect', () => {
      logger.info('📗 Redis connected for queues');
    });
    
    this.redis.on('error', (err) => {
      logger.error('📕 Redis queue error:', err);
    });
  }

  /**
   * Get or create a queue
   */
  getQueue(queueName) {
    if (!this.queues.has(queueName)) {
      // Create queue with authenticated Redis connection
      const redisOpts = {
        redis: {
          host: new URL(config.redis.url).hostname,
          port: new URL(config.redis.url).port || 6379,
          password: config.redis.password,
          ...config.redis.options
        },
        defaultJobOptions: config.queue.defaultJobOptions
      };
      
      const queue = new Bull(queueName, redisOpts);

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

      this.queues.set(queueName, queue);
    }

    return this.queues.get(queueName);
  }

  /**
   * Add message to queue
   */
  async addMessage(companyId, data, options = {}) {
    try {
      const queueName = `company:${companyId}:messages`;
      const queue = this.getQueue(queueName);
      
      const job = await queue.add( {
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
    
    await this.redis.quit();
    logger.info('✅ Message queues shutdown complete');
  }
}

// Singleton instance
module.exports = new MessageQueue();