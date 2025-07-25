#!/usr/bin/env node

// Тестовый скрипт для проверки передачи данных в напоминания

const messageQueue = require('./src/queue/message-queue');
const logger = require('./src/utils/logger');

async function testReminder() {
  try {
    // Создаем тестовое напоминание через 1 минуту
    const reminderTime = new Date(Date.now() + 60 * 1000); // через 1 минуту
    
    const bookingData = {
      datetime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // запись через 2 часа
      service_name: 'МУЖСКАЯ СТРИЖКА',
      staff_name: 'Сергей',
      record_id: 'TEST_REMINDER_123'
    };
    
    await messageQueue.addReminder({
      type: 'hours_before',
      booking: bookingData,
      phone: '79001234567@c.us',
      hours: 2
    }, reminderTime);
    
    logger.info('✅ Тестовое напоминание создано, будет отправлено через 1 минуту', {
      bookingData,
      reminderTime: reminderTime.toISOString()
    });
    
    // Ждем немного и выходим
    setTimeout(() => {
      logger.info('Скрипт завершен. Проверьте логи воркера напоминаний.');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    logger.error('Ошибка при создании тестового напоминания:', error);
    process.exit(1);
  }
}

testReminder();