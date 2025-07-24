#!/usr/bin/env node

/**
 * Тест системы напоминаний
 */

require('dotenv').config();
const messageQueue = require('./src/queue/message-queue');
const logger = require('./src/utils/logger');

async function testReminder() {
  try {
    // Тестовая запись
    const testBooking = {
      record_id: 'TEST123',
      datetime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Завтра в это же время
      service_name: 'Мужская стрижка',
      staff_name: 'Сергей'
    };
    
    const testPhone = '79001234567@c.us';
    
    console.log('📅 Планирование тестовых напоминаний...');
    console.log('Запись на:', new Date(testBooking.datetime).toLocaleString('ru-RU'));
    
    // Напоминание через 1 минуту (для теста)
    const testTime1 = new Date(Date.now() + 60 * 1000);
    await messageQueue.addReminder({
      type: 'day_before',
      booking: testBooking,
      phone: testPhone
    }, testTime1);
    console.log('✅ Напоминание за день запланировано на:', testTime1.toLocaleString('ru-RU'));
    
    // Напоминание через 2 минуты (для теста)
    const testTime2 = new Date(Date.now() + 120 * 1000);
    await messageQueue.addReminder({
      type: 'hours_before',
      booking: testBooking,
      phone: testPhone,
      hours: 2
    }, testTime2);
    console.log('✅ Напоминание за 2 часа запланировано на:', testTime2.toLocaleString('ru-RU'));
    
    console.log('\n⏳ Ожидайте напоминания через 1 и 2 минуты...');
    console.log('📱 На номер:', testPhone.replace('@c.us', ''));
    
    // Ждем немного чтобы увидеть статус очереди
    setTimeout(() => {
      console.log('\n✅ Тестовые напоминания запланированы!');
      console.log('Проверьте логи reminder worker для отслеживания отправки.');
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запуск теста
testReminder();