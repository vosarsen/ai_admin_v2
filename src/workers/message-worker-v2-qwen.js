// src/workers/message-worker-v2-qwen.js
const { Worker } = require('bullmq');
const config = require('../config');
const { getBullMQRedisConfig } = require('../config/redis-config');
const logger = require('../utils/logger');

// Выбираем AI провайдер на основе переменной окружения
const useQwen = process.env.USE_QWEN === 'true';
const aiAdminV2 = useQwen 
  ? require('../services/ai-admin-v2/index-qwen-simple')
  : require('../services/ai-admin-v2');

if (useQwen) {
  logger.info('🚀 Worker started with Qwen AI integration enabled');
} else {
  logger.info('Worker started with default AI provider');
}

const whatsappClient = require('../integrations/whatsapp/client');
const messageQueue = require('../queue/message-queue');
const errorMessages = require('../utils/error-messages');
const criticalErrorLogger = require('../utils/critical-error-logger');

/**
 * Упрощенный Message Worker для AI Admin v2
 */
class MessageWorkerV2 {
  constructor(workerId) {
    this.workerId = workerId;
    this.isRunning = false;
    this.processedCount = 0;
    this.workers = [];
    this.connection = getBullMQRedisConfig();
    
    logger.debug('MessageWorkerV2 Redis config:', {
      host: this.connection.host,
      port: this.connection.port,
      hasPassword: !!this.connection.password,
      aiProvider: useQwen ? 'Qwen' : 'Default'
    });
  }

  async start() {
    if (this.isRunning) {
      logger.warn(`Worker ${this.workerId} is already running`);
      return;
    }

    this.isRunning = true;
    logger.info(`Starting AI Message Worker v2 ${this.workerId}...`);

    try {
      // Создаем worker для обработки сообщений
      const messageWorker = new Worker('messages', this.processMessage.bind(this), {
        connection: this.connection,
        concurrency: 1
      });

      messageWorker.on('completed', (job) => {
        this.processedCount++;
        logger.info(`✅ Job ${job.id} completed by worker ${this.workerId}`, {
          processedCount: this.processedCount
        });
      });

      messageWorker.on('failed', (job, err) => {
        logger.error(`❌ Job ${job?.id} failed:`, err);
      });

      this.workers.push(messageWorker);
      logger.info(`✅ AI Message Worker v2 ${this.workerId} started successfully`);

    } catch (error) {
      logger.error(`Failed to start worker ${this.workerId}:`, error);
      await this.stop();
      throw error;
    }
  }

  async processMessage(job) {
    const { message, isRapidFire } = job.data;
    const startTime = Date.now();
    
    logger.info(`🔄 Processing message from ${message.from}`, {
      messageId: message.id,
      text: message.body?.substring(0, 50) + '...',
      isRapidFire
    });

    try {
      // AI Admin v2 - один вызов с полным контекстом
      const response = await aiAdminV2.generateResponse(
        message.body, 
        message.from, 
        message.companyId
      );
      
      logger.info(`🤖 Bot response to ${message.from}: ${response.substring(0, 200)}...`);

      // Отправляем ответ
      await whatsappClient.sendMessage(message.from, response, message.companyId);

      // Помечаем сообщение как обработанное
      await messageQueue.markProcessed(message.id);

      logger.info(`✅ Message processed in ${Date.now() - startTime}ms`, {
        messageId: message.id,
        responseLength: response.length
      });

    } catch (error) {
      logger.error('Failed to process message:', error);
      
      // Критическая ошибка
      if (error.critical) {
        await criticalErrorLogger.log({
          error,
          message,
          workerId: this.workerId
        });
      }

      // Отправляем сообщение об ошибке пользователю
      try {
        const errorMsg = errorMessages.getGenericError();
        await whatsappClient.sendMessage(message.from, errorMsg, message.companyId);
      } catch (sendError) {
        logger.error('Failed to send error message:', sendError);
      }

      throw error;
    }
  }

  async stop() {
    logger.info(`Stopping worker ${this.workerId}...`);
    this.isRunning = false;

    // Закрываем всех воркеров
    await Promise.all(this.workers.map(worker => worker.close()));
    
    logger.info(`Worker ${this.workerId} stopped`);
  }
}

module.exports = MessageWorkerV2;