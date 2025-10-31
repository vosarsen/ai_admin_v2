#!/usr/bin/env node

/**
 * Тестирование отмены множественных записей
 * Проверяет что система правильно обрабатывает несколько активных записей
 */

const axios = require('axios');
const config = require('./src/config');

const TEST_PHONE = process.env.TEST_PHONE || '+79686484488';
const API_URL = process.env.AI_ADMIN_API_URL || 'http://46.149.70.219:3000';
const SECRET_KEY = process.env.SECRET_KEY || config.auth.secretKey;

// Генерация HMAC подписи
const crypto = require('crypto');
function generateHmacSignature(data, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
}

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sendMessage(text) {
  const messageData = {
    from: TEST_PHONE.replace('+', '') + '@c.us',
    to: 'bot@c.us',
    body: text,
    timestamp: Date.now(),
    messageId: `test_${Date.now()}_${Math.random()}`
  };

  const signature = generateHmacSignature(messageData, SECRET_KEY);
  
  try {
    log(`\n📤 Отправка: "${text}"`, 'cyan');
    
    const response = await axios.post(
      `${API_URL}/webhook/whatsapp/batched`,
      messageData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': `sha256=${signature}`
        }
      }
    );

    if (response.status === 200) {
      log('✅ Сообщение отправлено', 'green');
      
      // Ждем обработки
      log('⏳ Ожидание обработки...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      return true;
    }
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

async function runTest() {
  log('\n🧪 ТЕСТ ОТМЕНЫ МНОЖЕСТВЕННЫХ ЗАПИСЕЙ', 'bright');
  log('=====================================\n', 'bright');
  
  try {
    // Шаг 1: Создаем первую запись
    log('📝 Шаг 1: Создание первой записи', 'magenta');
    await sendMessage('Запишите меня на стрижку к Бари завтра в 15:00');
    
    // Шаг 2: Создаем вторую запись
    log('\n📝 Шаг 2: Создание второй записи', 'magenta');
    await sendMessage('Запишите меня на стрижку к Бари послезавтра в 17:00');
    
    // Шаг 3: Проверяем список записей
    log('\n📋 Шаг 3: Проверка списка записей', 'magenta');
    await sendMessage('Покажите мои записи');
    
    // Шаг 4: Отменяем первую запись (ближайшую)
    log('\n❌ Шаг 4: Отмена первой записи', 'magenta');
    await sendMessage('Отмените мою запись на завтра');
    
    // Шаг 5: Проверяем что осталась только вторая
    log('\n📋 Шаг 5: Проверка оставшихся записей', 'magenta');
    await sendMessage('Покажите мои записи');
    
    // Шаг 6: Отменяем вторую запись
    log('\n❌ Шаг 6: Отмена второй записи', 'magenta');
    await sendMessage('Отмените мою запись');
    
    // Шаг 7: Финальная проверка
    log('\n📋 Шаг 7: Финальная проверка', 'magenta');
    await sendMessage('Покажите мои записи');
    
    log('\n✅ ТЕСТ ЗАВЕРШЕН', 'green');
    log('\n⚠️  ВАЖНО: Проверьте логи на сервере:', 'yellow');
    log('ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100 | grep -E \\"(cancel|CANCEL|booking|attendance)\\""\n', 'cyan');
    
  } catch (error) {
    log(`\n❌ Ошибка теста: ${error.message}`, 'red');
    console.error(error);
  }
}

// Запуск теста
runTest();