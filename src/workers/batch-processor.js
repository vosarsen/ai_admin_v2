// src/workers/batch-processor.js
const batchService = require('../services/redis-batch-service');
const logger = require('../utils/logger');
const config = require('../config');

class BatchProcessor {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.checkInterval = 1000; // Проверка каждую секунду
    this.statsInterval = 30000; // Статистика каждые 30 секунд
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Batch processor is already running');
      return;
    }

    try {
      // Инициализируем batch service
      await batchService.initialize();
      
      // Добавляем задержку для синхронизации
      logger.info('Waiting 2 seconds for Redis sync...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.isRunning = true;
      logger.info('Batch processor started');

      // Запускаем периодическую проверку батчей
      this.interval = setInterval(async () => {
        await this.processBatches();
      }, this.checkInterval);

      // Запускаем периодический вывод статистики
      this.statsInterval = setInterval(async () => {
        await this.logStats();
      }, this.statsInterval);

      // Обрабатываем graceful shutdown
      this.setupShutdownHandlers();

      // Сразу проверяем батчи при запуске
      logger.info('Running initial batch check...');
      await this.processBatches();
      logger.info('Initial batch check completed');

    } catch (error) {
      logger.error('Failed to start batch processor:', error);
      throw error;
    }
  }

  async processBatches() {
    if (!this.isRunning) {
      return;
    }

    try {
      const startTime = Date.now();
      logger.debug('Calling processPendingBatches...');
      const result = await batchService.processPendingBatches();
      
      if (result.processed > 0) {
        const duration = Date.now() - startTime;
        logger.info(`Processed ${result.processed} batches in ${duration}ms`);
      }
    } catch (error) {
      logger.error('Error processing batches:', error);
      // Не останавливаем процессор при ошибке
    }
  }

  async logStats() {
    try {
      const stats = await batchService.getStats();
      
      if (stats.pendingBatches > 0) {
        logger.info('Batch processor stats:', {
          pendingBatches: stats.pendingBatches,
          details: stats.batches.map(b => ({
            phone: b.phone.substring(0, 5) + '***',
            size: b.size,
            ageMs: b.lastMessageAge
          }))
        });
      }
    } catch (error) {
      logger.error('Failed to log stats:', error);
    }
  }

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down batch processor...`);
      
      this.isRunning = false;
      
      if (this.interval) {
        clearInterval(this.interval);
      }
      
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
      }

      // Обрабатываем оставшиеся батчи перед выходом
      try {
        logger.info('Processing remaining batches before shutdown...');
        const result = await batchService.processPendingBatches();
        logger.info(`Processed ${result.processed} batches during shutdown`);
      } catch (error) {
        logger.error('Error during shutdown batch processing:', error);
      }

      await batchService.close();
      logger.info('Batch processor stopped');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    await batchService.close();
    logger.info('Batch processor stopped');
  }
}

// Если запускается как отдельный процесс
if (require.main === module) {
  const processor = new BatchProcessor();
  
  processor.start().catch(error => {
    logger.error('Failed to start batch processor:', error);
    process.exit(1);
  });

  // Держим процесс живым
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', reason);
    process.exit(1);
  });
}

module.exports = BatchProcessor;