const axios = require('axios');

// Конфигурация
const API_URL = 'http://46.149.70.219:3000/webhook/whatsapp/batched';
const SECRET_KEY = '0Jzt70K6QdCQv9s3xOBWRXN6lqCyNnI+X5r5K2Kq8qUoJJ8lHdHekE4L2z+v3bfE=';
const PHONE = '79001234567';

// Генерация HMAC подписи
function generateSignature(data) {
  const crypto = require('crypto');
  const payload = JSON.stringify(data);
  return crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
}

// Отправка сообщения
async function sendMessage(text) {
  const data = {
    from: PHONE,
    body: text,
    timestamp: Date.now(),
    type: 'text'
  };

  const signature = generateSignature(data);

  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${signature}`
      }
    });
    console.log('✅ Сообщение отправлено:', text);
    console.log('Ответ сервера:', response.data);
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

// Тестовые сценарии
async function test() {
  console.log('🧪 Тестирование CHECK_STAFF_SCHEDULE');
  console.log('=====================================\n');
  
  // Тест 1: Спрашиваем про конкретного мастера
  console.log('Тест 1: Проверка расписания конкретного мастера');
  await sendMessage('Когда работает Сергей?');
  
  // Ждем 3 секунды перед следующим тестом
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Тест 2: Спрашиваем про мастера в конкретный день
  console.log('\nТест 2: Проверка мастера на конкретную дату');
  await sendMessage('Работает ли Бари завтра?');
  
  // Ждем 3 секунды
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Тест 3: Общий вопрос о расписании
  console.log('\nТест 3: Общее расписание на сегодня');
  await sendMessage('Кто работает сегодня?');
  
  console.log('\n✅ Тесты отправлены. Проверьте логи сервера для результатов.');
}

// Запуск тестов
test().catch(console.error);