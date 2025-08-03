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
      // Создаем worker для обработки сообщений с правильной очередью
      const queueName = `company-${config.yclients.companyId || 962302}-messages`;
      const messageWorker = new Worker(queueName, this.processMessage.bind(this), {
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
    // Логируем полную структуру данных для отладки
    logger.debug('Job data structure:', JSON.stringify(job.data, null, 2));
    
    const startTime = Date.now();
    
    // Поддерживаем два формата данных:
    // 1. Старый формат: { message: {...}, isRapidFire: bool }
    // 2. Новый формат: данные прямо в job.data
    let messageData;
    let isRapidFire = false;
    
    if (job.data.message && typeof job.data.message === 'object') {
      // Старый формат
      messageData = job.data.message;
      isRapidFire = job.data.isRapidFire || false;
    } else if (job.data.from && job.data.message) {
      // Новый формат - данные прямо в job.data
      messageData = {
        from: job.data.from,
        body: job.data.message,
        companyId: job.data.companyId,
        id: job.data.id || job.data.timestamp,
        metadata: job.data.metadata || {}
      };
      isRapidFire = job.data.metadata?.isRapidFireBatch || false;
    } else {
      logger.error('Unknown message structure:', { jobData: job.data });
      throw new Error('Unknown message structure in job data');
    }
    
    logger.info(`🔄 Processing message from ${messageData.from || 'unknown'}`, {
      messageId: messageData.id,
      text: messageData.body ? messageData.body.substring(0, 50) + '...' : 'no body',
      isRapidFire
    });

    try {
      // Извлекаем данные с проверкой на существование
      const messageBody = messageData.body || messageData.text || '';
      const messageFrom = messageData.from || messageData.phone || 'unknown';
      const companyId = messageData.companyId || messageData.metadata?.companyId || config.yclients.companyId;
      
      if (!messageBody) {
        logger.warn('Empty message body received');
        throw new Error('Empty message body');
      }
      
      // AI Admin v2 - один вызов с полным контекстом
      const response = await aiAdminV2.processMessage(
        messageBody, 
        messageFrom, 
        companyId
      );
      
      logger.info(`🤖 Bot response to ${messageFrom}: ${(response.response || response).substring(0, 200)}...`);

      // Отправляем ответ (извлекаем текст если response - объект)
      const responseText = response.response || response;
      await whatsappClient.sendMessage(messageFrom, responseText, companyId);

      // Помечаем сообщение как обработанное (если метод существует)
      if (messageQueue.markProcessed) {
        await messageQueue.markProcessed(messageData.id);
      }

      logger.info(`✅ Message processed in ${Date.now() - startTime}ms`, {
        messageId: messageData.id,
        responseLength: responseText.length
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
        const errorMsg = errorMessages.generic || "Произошла ошибка. Попробуйте еще раз.";
        const messageFrom = messageData.from || messageData.phone || 'unknown';
        const companyId = messageData.companyId || messageData.metadata?.companyId || config.yclients.companyId;
        
        if (messageFrom !== 'unknown') {
          await whatsappClient.sendMessage(messageFrom, errorMsg, companyId);
        }
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