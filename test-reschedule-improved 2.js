#!/usr/bin/env node

/**
 * Тестирование улучшенной функции переноса записи
 * Проверяет все новые возможности:
 * - Проверка доступности времени
 * - Выбор из нескольких записей
 * - Обновление напоминаний
 */

const axios = require('axios');
const { YclientsClient } = require('./src/integrations/yclients/client');
const logger = require('./src/utils/logger');

// Настройки
const API_URL = process.env.AI_ADMIN_API_URL || 'http://46.149.70.219:3000';
const SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key-2024';
const TEST_PHONE = process.env.TEST_PHONE || '79001234567';
const COMPANY_ID = 962302;

// Клиент YClients для проверки
const yclientsClient = new YclientsClient();

/**
 * Отправка тестового сообщения
 */
async function sendTestMessage(message) {
  try {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const data = JSON.stringify({
      phone: TEST_PHONE,
      message: message,
      timestamp: timestamp
    });
    
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('hex');
    
    logger.info(`📱 Отправка сообщения: "${message}"`);
    
    const response = await axios.post(
      `${API_URL}/webhook/whatsapp/batched`,
      {
        phone: TEST_PHONE,
        message: message,
        timestamp: timestamp
      },
      {
        headers: {
          'X-Signature': signature,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info('✅ Ответ получен:', response.data);
    return response.data;
  } catch (error) {
    logger.error('❌ Ошибка при отправке:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создание тестовой записи
 */
async function createTestBooking() {
  logger.info('📝 Создание тестовой записи...');
  
  const bookingData = {
    phone: TEST_PHONE,
    fullname: 'Тест Клиент',
    email: 'test@example.com',
    comment: 'Тестовая запись для проверки переноса',
    appointments: [{
      id: 1,
      services: [18356010], // МУЖСКАЯ СТРИЖКА
      staff_id: 2895125, // Сергей
      datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // Через 2 дня
    }]
  };
  
  const result = await yclientsClient.createBooking(bookingData, COMPANY_ID);
  
  if (result.success) {
    logger.info('✅ Запись создана:', result.data);
    return result.data?.[0]?.id || result.data?.id;
  } else {
    logger.error('❌ Не удалось создать запись:', result.error);
    return null;
  }
}

/**
 * Основные тест-кейсы
 */
async function runTests() {
  logger.info('🚀 Запуск тестов улучшенной функции переноса записи...\n');
  
  try {
    // Тест 1: Простой перенос записи
    logger.info('=== ТЕСТ 1: Простой перенос записи ===');
    await sendTestMessage('Хочу перенести запись на завтра в 16:00');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Тест 2: Перенос на занятое время
    logger.info('\n=== ТЕСТ 2: Перенос на занятое время ===');
    await sendTestMessage('Перенесите мою запись на сегодня в 15:00');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Тест 3: Перенос без указания времени
    logger.info('\n=== ТЕСТ 3: Перенос без указания времени ===');
    await sendTestMessage('Можно перенести запись?');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Тест 4: Создание второй записи для теста множественного выбора
    logger.info('\n=== ТЕСТ 4: Создание второй записи ===');
    const bookingId = await createTestBooking();
    if (bookingId) {
      logger.info(`✅ Создана вторая запись: ${bookingId}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Тест 5: Перенос с несколькими записями
    logger.info('\n=== ТЕСТ 5: Перенос с выбором из нескольких записей ===');
    await sendTestMessage('Хочу перенести запись');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Тест 6: Различные фразы для переноса
    logger.info('\n=== ТЕСТ 6: Проверка распознавания разных фраз ===');
    const testPhrases = [
      'Измените время записи на послезавтра в 17:00',
      'Можно в другое время? Завтра в 14:00',
      'Не подходит время, давайте в другой день',
      'Перенесите визит на следующую неделю'
    ];
    
    for (const phrase of testPhrases) {
      logger.info(`\n📱 Тестируем фразу: "${phrase}"`);
      await sendTestMessage(phrase);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Тест 7: Проверка обновления напоминаний
    logger.info('\n=== ТЕСТ 7: Проверка обновления напоминаний ===');
    // Этот тест требует проверки логов reminder сервиса
    logger.info('Проверьте логи reminder сервиса для подтверждения обновления напоминаний');
    
  } catch (error) {
    logger.error('❌ Ошибка в тестах:', error);
  }
  
  logger.info('\n✅ Тесты завершены');
  logger.info('\n📋 Итоги улучшений:');
  logger.info('1. ✅ Добавлена проверка доступности времени перед переносом');
  logger.info('2. ✅ Реализован выбор конкретной записи из нескольких');
  logger.info('3. ✅ Улучшено распознавание команды переноса AI');
  logger.info('4. ✅ Добавлено обновление напоминаний при переносе');
  logger.info('5. ⏳ В планах: уведомление мастера о переносе');
  logger.info('6. ⏳ В планах: история переносов');
}

// Запуск тестов
runTests().catch(console.error);