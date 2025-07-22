#!/usr/bin/env node

require('dotenv').config();
const bookingService = require('./src/services/booking');
const logger = require('./src/utils/logger');

// Тестовые данные из созданной записи
const testRecordId = 1199484063;
const testRecordHash = 'fb469b3be1c74f599c46e6cf5c88ba72';

async function testCancelWithHash() {
  try {
    logger.info('🧪 Testing cancellation with record hash...');
    
    // Пробуем отменить через user endpoint с hash
    const result = await bookingService.cancelUserBooking(testRecordId, testRecordHash);
    
    if (result.success) {
      logger.info('✅ Successfully canceled booking with hash!');
      logger.info('Result:', JSON.stringify(result, null, 2));
    } else {
      logger.error('❌ Failed to cancel booking:', result.error);
    }
    
  } catch (error) {
    logger.error('💥 Unexpected error:', error);
  }
}

// Запускаем тест
testCancelWithHash()
  .then(() => {
    logger.info('✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  });