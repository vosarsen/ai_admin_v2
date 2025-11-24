// test-rapid-fire-batched.js
const axios = require('axios');
const config = require('./src/config');

// Настройки
const API_URL = process.env.AI_ADMIN_API_URL || 'http://localhost:3000';
const TEST_PHONE = '79001234567';
const SECRET_KEY = config.app.secretKey;

// Функция для создания HMAC подписи
function createSignature(payload) {
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(message, delay = 0) {
  if (delay > 0) {
    await sleep(delay);
  }

  const payload = {
    from: TEST_PHONE,
    message: message,
    timestamp: new Date().toISOString()
  };

  const signature = createSignature(payload);

  try {
    const response = await axios.post(`${API_URL}/webhook/whatsapp/batched`, payload, {
      headers: {
        'X-Webhook-Signature': signature,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📤 Отправлено: "${message}"`);
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка отправки "${message}":`, error.response?.data || error.message);
    return null;
  }
}

async function checkBatchStats() {
  try {
    const response = await axios.get(`${API_URL}/webhook/whatsapp/batched/stats`);
    return response.data.stats;
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return null;
  }
}

async function testRapidFireBatching() {
  console.log('🧪 Тестирование Rapid-Fire батчинга через новый webhook\n');
  console.log(`📞 Тестовый номер: ${TEST_PHONE}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('');

  // Сценарий 1: Быстрая отправка сообщений (rapid-fire)
  console.log('📋 Сценарий 1: Rapid-fire сообщения');
  console.log('Отправляем 8 сообщений с задержкой 200ms:\n');

  const messages = [
    'Привет,',
    'запишите',
    'меня на',
    'стрижку',
    'к Бари',
    'на завтра',
    'в 8',
    'вечера'
  ];

  // Отправляем сообщения быстро
  for (let i = 0; i < messages.length; i++) {
    await sendMessage(messages[i], i === 0 ? 0 : 200);
  }

  console.log('\n⏳ Ждем 2 секунды и проверяем статистику батча...\n');
  await sleep(2000);

  let stats = await checkBatchStats();
  if (stats) {
    console.log('📊 Статистика батчей:');
    console.log(`   - Pending batches: ${stats.pendingBatches}`);
    if (stats.batches.length > 0) {
      stats.batches.forEach(batch => {
        console.log(`   - Phone ${batch.phone}: ${batch.size} messages, age: ${batch.lastMessageAge}ms`);
      });
    }
  }

  console.log('\n⏳ Ждем еще 4 секунды для обработки батча...\n');
  await sleep(4000);

  stats = await checkBatchStats();
  if (stats) {
    console.log('📊 Статистика после обработки:');
    console.log(`   - Pending batches: ${stats.pendingBatches}`);
    if (stats.pendingBatches === 0) {
      console.log('✅ Батч обработан успешно!');
    }
  }

  // Сценарий 2: Сообщения с большими паузами
  console.log('\n\n📋 Сценарий 2: Сообщения с большими паузами');
  console.log('Отправляем 3 сообщения с паузой 6 секунд:\n');

  await sendMessage('Доброе утро!');
  console.log('⏳ Пауза 6 секунд...');
  await sleep(6000);
  
  await sendMessage('Можно записаться?');
  console.log('⏳ Пауза 6 секунд...');
  await sleep(6000);
  
  await sendMessage('На стрижку');

  console.log('\n📊 Проверяем статистику:');
  stats = await checkBatchStats();
  if (stats) {
    console.log(`   - Pending batches: ${stats.pendingBatches}`);
    console.log('   ℹ️  Каждое сообщение должно обработаться отдельно из-за большой паузы');
  }

  // Сценарий 3: Максимальный размер батча
  console.log('\n\n📋 Сценарий 3: Превышение максимального размера батча');
  console.log('Отправляем 12 сообщений подряд:\n');

  for (let i = 1; i <= 12; i++) {
    await sendMessage(`Сообщение ${i}`, 50);
  }

  console.log('\n⏳ Ждем 1 секунду...\n');
  await sleep(1000);

  stats = await checkBatchStats();
  if (stats) {
    console.log('📊 Статистика:');
    console.log(`   - Pending batches: ${stats.pendingBatches}`);
    if (stats.batches.length > 0) {
      console.log('   ℹ️  Батч должен автоматически обработаться при достижении 10 сообщений');
    }
  }

  console.log('\n✅ Тестирование завершено!');
  console.log('\n💡 Проверьте логи сервера для подтверждения объединения сообщений:');
  console.log('   ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep \\"Processing batch\\""');
}

// Запускаем тест
testRapidFireBatching().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});