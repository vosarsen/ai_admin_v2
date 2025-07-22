const axios = require('axios');

const API_URL = 'http://46.149.70.219:3002';
const SECRET_KEY = '5jZ8kR3p9$vQ@mN7';

// Тестовые телефоны
const testPhones = {
  client1: '79001234567',  // Клиент с записями
  client2: '79001234568',  // Клиент без записей
};

const headers = {
  'Content-Type': 'application/json',
  'X-Secret-Key': SECRET_KEY
};

async function sendMessage(phone, message) {
  try {
    console.log(`\n📱 ${phone}: "${message}"`);
    
    const response = await axios.post(`${API_URL}/webhook`, {
      messages: [{
        phone: phone + '@c.us',
        body: message,
        fromMe: false,
        type: 'message'
      }]
    }, { headers });

    console.log('✅ Sent successfully');
    
    // Ждем обработки и ответа
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function testCancelBookingFlow() {
  console.log('🧪 Testing Cancel Booking Flow');
  console.log('================================\n');

  // Тест 1: Сначала создадим запись
  console.log('1️⃣ ТЕСТ: Создание записи для последующей отмены');
  console.log('-------------------------------------------');
  
  await sendMessage(testPhones.client1, 'Хочу записаться на стрижку завтра');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Предположим, что бот показал слоты и клиент выбрал время
  await sendMessage(testPhones.client1, 'Запишите на 14:00');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Тест 2: Отмена записи - клиент с записями
  console.log('\n2️⃣ ТЕСТ: Отмена записи - клиент с активными записями');
  console.log('-------------------------------------------');
  
  await sendMessage(testPhones.client1, 'Хочу отменить запись');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Предположим, бот показал список записей и клиент выбирает
  await sendMessage(testPhones.client1, '1');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Тест 3: Отмена записи - клиент без записей
  console.log('\n3️⃣ ТЕСТ: Отмена записи - клиент без записей');
  console.log('-------------------------------------------');
  
  await sendMessage(testPhones.client2, 'Отменить визит');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Тест 4: Некорректный выбор при отмене
  console.log('\n4️⃣ ТЕСТ: Некорректный ввод при выборе записи для отмены');
  console.log('-------------------------------------------');
  
  await sendMessage(testPhones.client1, 'Отмените мою запись');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Вводим неправильный номер
  await sendMessage(testPhones.client1, 'привет');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Бот должен сбросить состояние и обработать как обычное сообщение
  
  console.log('\n✅ Тестирование завершено');
  console.log('\n📋 Проверьте логи бота для анализа результатов:');
  console.log('ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100 | grep -E \\"CANCEL|отмен|запись\\""');
}

// Запускаем тесты
testCancelBookingFlow().catch(console.error);