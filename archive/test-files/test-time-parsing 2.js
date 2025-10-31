#!/usr/bin/env node

/**
 * Тест парсинга временных выражений
 */

const config = require('./src/config');
const messageQueue = require('./src/queue/message-queue');
const logger = require('./src/utils/logger');

async function testTimeParsing() {
  try {
    logger.info('🧪 Тестируем парсинг временных выражений');
    
    // Тест 1: "Давай на час"
    await messageQueue.addMessage(config.yclients.companyId, {
      from: '79001234567',
      message: 'Хочу записаться на стрижку сегодня. Свободно что-то?',
      metadata: {
        test: true,
        scenario: 'time-parsing-test'
      }
    });
    
    // Даем время на обработку
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Тест 2: "на час"
    await messageQueue.addMessage(config.yclients.companyId, {
      from: '79001234567',
      message: 'Давай на час',
      metadata: {
        test: true,
        scenario: 'time-parsing-test-hour'
      }
    });
    
    logger.info('✅ Тестовые сообщения отправлены в очередь');
    logger.info('Проверьте логи worker-а для анализа результатов');
    
  } catch (error) {
    logger.error('Ошибка тестирования:', error);
  }
}

// Запускаем тест
testTimeParsing()
  .then(() => {
    logger.info('Тест завершен');
    setTimeout(() => process.exit(0), 1000);
  })
  .catch(error => {
    logger.error('Критическая ошибка:', error);
    process.exit(1);
  });