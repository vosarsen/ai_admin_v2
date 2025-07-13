// test-real-whatsapp.js
// Тестирование через реальный WhatsApp

require('dotenv').config();
const axios = require('axios');

// Конфигурация
const WHATSAPP_API_URL = process.env.VENOM_SERVER_URL || 'http://localhost:3001';
const SECRET_KEY = process.env.VENOM_SECRET_KEY;
const TEST_PHONE = process.env.TEST_PHONE || '79000000001'; // Ваш тестовый номер
const REAL_PHONE = '79266508317'; // Реальный номер бота

// Тестовые сообщения для проверки интентов
const testMessages = [
  // Базовые интенты
  { message: 'Привет', expected: 'приветствие' },
  { message: 'хочу записаться', expected: 'должен предложить услуги или спросить детали' },
  { message: 'сколько стоит стрижка?', expected: 'должен показать цены' },
  { message: 'свободно завтра?', expected: 'должен показать слоты' },
  { message: 'покажи работы мастеров', expected: 'должен показать портфолио' },
  
  // Разговорная речь
  { message: 'че по ценам на бороду?', expected: 'должен показать цены на бороду' },
  { message: 'када можна придти?', expected: 'должен спросить когда удобно' },
  { message: 'запиши плз на стрижку', expected: 'должен уточнить детали записи' },
  
  // Сложные кейсы
  { message: 'можно записаться к Ивану на завтра вечером?', expected: 'должен проверить слоты Ивана' },
  { message: 'есть время в пятницу утром на стрижку и бороду?', expected: 'должен показать утренние слоты пятницы' }
];

// Функция отправки сообщения
async function sendMessage(message) {
  try {
    console.log(`\n📤 Отправляем: "${message}"`);
    
    // Отправляем через API Venom Bot
    const response = await axios.post(
      `${WHATSAPP_API_URL}/api/sendText`,
      {
        phone: REAL_PHONE,
        message: message
      },
      {
        headers: {
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Сообщение отправлено');
    return true;
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
    return false;
  }
}

// Основная функция тестирования
async function runRealTests() {
  console.log('🚀 Запуск реальных тестов через WhatsApp');
  console.log(`📱 Отправляем на номер бота: ${REAL_PHONE}`);
  console.log('⏱️  Между сообщениями будет задержка 10 секунд\n');
  
  console.log('ВАЖНО: Откройте WhatsApp и следите за ответами бота!');
  console.log('После теста проанализируйте, правильно ли бот определил интенты.\n');
  
  // Ждем подтверждения
  console.log('Нажмите Enter для начала тестов...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  
  // Отправляем тестовые сообщения
  for (const test of testMessages) {
    const sent = await sendMessage(test.message);
    
    if (sent) {
      console.log(`💡 Ожидаемый результат: ${test.expected}`);
      console.log('⏳ Ждем 10 секунд перед следующим сообщением...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log('\n✅ Все тесты отправлены!');
  console.log('📊 Проверьте ответы бота в WhatsApp и оцените:');
  console.log('- Правильно ли определены интенты?');
  console.log('- Использовал ли бот команды [SEARCH_SLOTS], [SHOW_PRICES]?');
  console.log('- Были ли ответы полезными и точными?');
}

// Альтернативный вариант - мониторинг логов
async function monitorLogs() {
  console.log('\n📋 Альтернативный вариант - мониторинг логов в реальном времени:');
  console.log('Выполните на сервере команду:');
  console.log('pm2 logs ai-admin-worker-v2 --lines 100 | grep -E "(processMessage|SEARCH_SLOTS|SHOW_PRICES|CREATE_BOOKING)"');
  console.log('\nЭто покажет, какие команды выполняет бот для каждого сообщения.');
}

// Запуск
if (require.main === module) {
  runRealTests()
    .then(() => monitorLogs())
    .catch(console.error);
}