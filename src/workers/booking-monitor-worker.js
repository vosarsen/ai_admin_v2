// CRITICAL: Import instrument.js FIRST for Sentry initialization
require('../instrument');

const logger = require('../utils/logger');
const bookingMonitor = require('../services/booking-monitor');

/**
 * Worker для мониторинга новых записей в YClients
 */
async function startBookingMonitorWorker() {
  logger.info('🚀 Starting booking monitor worker');

  // Запускаем мониторинг
  bookingMonitor.start();

  // Обработка сигналов для graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('📛 SIGTERM received, stopping booking monitor...');
    bookingMonitor.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('📛 SIGINT received, stopping booking monitor...');
    bookingMonitor.stop();
    process.exit(0);
  });

  // Держим процесс активным
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught exception:', error);
    bookingMonitor.stop();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled rejection:', reason);
    bookingMonitor.stop();
    process.exit(1);
  });
}

// Запускаем worker
startBookingMonitorWorker().catch((error) => {
  logger.error('❌ Failed to start booking monitor worker:', error);
  process.exit(1);
});