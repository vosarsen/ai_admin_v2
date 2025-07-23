#!/usr/bin/env node

require('dotenv').config();
const logger = require('./src/utils/logger');
const bookingService = require('./src/services/booking');

// Получаем YClients клиент
const yclient = bookingService.getYclientsClient();

// ID записи для теста (используем созданную ранее)
const testRecordId = 1199516451;
const companyId = 962302;

async function testReschedule() {
  try {
    logger.info('🧪 Testing booking reschedule...');
    
    // Новые данные для переноса на завтра в 16:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDateTime = `${tomorrow.toISOString().split('T')[0]} 16:00:00`;
    
    const updateData = {
      datetime: newDateTime,
      comment: 'Перенесено через WhatsApp бота'
    };
    
    logger.info(`📅 Rescheduling to: ${newDateTime}`);
    
    const result = await yclient.updateRecord(companyId, testRecordId, updateData);
    
    if (result.success) {
      logger.info('✅ Successfully rescheduled booking!');
      logger.info('Result:', JSON.stringify(result, null, 2));
    } else {
      logger.error('❌ Failed to reschedule:', result.error);
    }
    
  } catch (error) {
    logger.error('💥 Unexpected error:', error);
  }
}

// Запускаем тест
testReschedule()
  .then(() => {
    logger.info('✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  });