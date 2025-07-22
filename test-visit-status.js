#!/usr/bin/env node

require('dotenv').config();
const bookingService = require('./src/services/booking');
const logger = require('./src/utils/logger');

// Для теста нужны visitId и recordId
// Обычно visitId совпадает с recordId, но не всегда
const testData = {
  recordId: 1199484063,  // ID нашей тестовой записи
  visitId: 1199484063    // Предполагаем что visitId = recordId
};

async function testVisitStatuses() {
  logger.info('🧪 Testing visit status updates...');
  
  // Тест 1: Подтверждение записи
  logger.info('\n📋 Test 1: Confirming booking...');
  const confirmResult = await bookingService.confirmBooking(testData.visitId, testData.recordId);
  logger.info('Confirm result:', JSON.stringify(confirmResult, null, 2));
  
  // Ждем 2 секунды между тестами
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Тест 2: Отметка о неявке
  logger.info('\n📋 Test 2: Marking no-show...');
  const noShowResult = await bookingService.markNoShow(
    testData.visitId, 
    testData.recordId,
    'Клиент не ответил на звонки'
  );
  logger.info('No-show result:', JSON.stringify(noShowResult, null, 2));
  
  // Ждем 2 секунды
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Тест 3: Отметка о приходе
  logger.info('\n📋 Test 3: Marking arrived...');
  const arrivedResult = await bookingService.markArrived(testData.visitId, testData.recordId);
  logger.info('Arrived result:', JSON.stringify(arrivedResult, null, 2));
}

// Запускаем тесты
testVisitStatuses()
  .then(() => {
    logger.info('\n✅ All tests completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('\n❌ Test failed:', error);
    process.exit(1);
  });