const logger = require('./src/utils/logger');
const bookingMonitor = require('./src/services/booking-monitor');

/**
 * Тест для проверки работы мониторинга новых записей
 */
async function testBookingMonitor() {
  try {
    logger.info('🧪 Testing booking monitor...');

    // Проверяем один раз
    await bookingMonitor.checkNewBookings();

    logger.info('✅ Test completed. Check logs for details.');

  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

// Запускаем тест
testBookingMonitor();