#!/usr/bin/env node
/**
 * Тест благодарностей и реакций
 * Проверяет:
 * 1. Реакция ❤️ на благодарность
 * 2. Отслеживание "Чем еще могу помочь?"
 */

const axios = require('axios');
const logger = require('./src/utils/logger');

const API_URL = 'http://localhost:3000/webhook/whatsapp/batched';
const TEST_PHONE = '79001234567';
const COMPANY_ID = 962302;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(message) {
  try {
    console.log(`\n📤 Отправляем: "${message}"`);
    
    const response = await axios.post(API_URL, {
      messages: [{
        from: TEST_PHONE,
        body: message,
        timestamp: Date.now()
      }],
      companyId: COMPANY_ID
    }, {
      headers: {
        'X-HMAC-Signature': 'test-signature'
      }
    });
    
    console.log(`✅ Ответ получен: ${response.data.message || 'OK'}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

async function runTest() {
  console.log('🧪 Начинаем тест благодарностей и реакций');
  console.log('=========================================\n');
  
  // Тест 1: Обычное сообщение - должен спросить "Чем еще могу помочь?"
  console.log('📌 Тест 1: Обычное сообщение');
  await sendMessage('Какие у вас услуги?');
  await sleep(10000); // Ждем обработки
  
  // Тест 2: Еще одно обычное сообщение - НЕ должен спросить повторно
  console.log('\n📌 Тест 2: Повторное сообщение (не должен спрашивать "Чем еще помочь?")');
  await sendMessage('А цены какие?');
  await sleep(10000);
  
  // Тест 3: Благодарность - должна быть реакция ❤️, без текстового ответа
  console.log('\n📌 Тест 3: Благодарность (должна быть реакция ❤️)');
  await sendMessage('Спасибо!');
  await sleep(5000);
  
  // Тест 4: После благодарности новый вопрос - снова должен спросить "Чем еще помочь?"
  console.log('\n📌 Тест 4: Новый вопрос после благодарности');
  await sendMessage('Можно записаться на завтра?');
  await sleep(10000);
  
  // Тест 5: Завершение диалога
  console.log('\n📌 Тест 5: Завершение диалога');
  await sendMessage('Это всё, больше ничего не надо');
  await sleep(5000);
  
  console.log('\n=========================================');
  console.log('✅ Тест завершен!');
  console.log('\nПроверьте логи сервера для деталей:');
  console.log('pm2 logs ai-admin-worker-v2 --lines 100');
}

// Запуск теста
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});