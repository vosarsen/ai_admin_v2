// test-production-batching.js
const axios = require('axios');

// Настройки для production
const API_URL = 'http://46.149.70.219:3000';
const TEST_PHONE = '79001234567';
const SECRET_KEY = 'sk_venom_webhook_3553'; // из конфига

// Функция для создания HMAC подписи
function createSignature(method, path, timestamp, body) {
  const crypto = require('crypto');
  const payload = `${method}:${path}:${timestamp}:${JSON.stringify(body)}`;
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(payload);
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

  const timestamp = Date.now();
  const path = '/webhook/whatsapp/batched';
  const signature = createSignature('POST', path, timestamp, payload);

  try {
    const response = await axios.post(`${API_URL}${path}`, payload, {
      headers: {
        'x-signature': signature,
        'x-timestamp': timestamp,
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

async function testProductionBatching() {
  console.log('🧪 Тестирование Redis батчинга на PRODUCTION сервере\n');
  console.log(`📞 Тестовый номер: ${TEST_PHONE}`);
  console.log(`🌐 API URL: ${API_URL}`);
  console.log('');

  // Тест rapid-fire сообщений
  console.log('📋 Отправляем 8 сообщений быстро (имитация разбитого ввода):\n');

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

  // Отправляем сообщения с минимальной задержкой
  for (let i = 0; i < messages.length; i++) {
    await sendMessage(messages[i], i === 0 ? 0 : 100);
  }

  console.log('\n⏳ Ждем 2 секунды и проверяем статистику батча...\n');
  await sleep(2000);

  let stats = await checkBatchStats();
  if (stats) {
    console.log('📊 Статистика батчей:');
    console.log(`   - Активных батчей: ${stats.pendingBatches}`);
    if (stats.batches.length > 0) {
      stats.batches.forEach(batch => {
        console.log(`   - Phone ${batch.phone}: ${batch.size} сообщений, возраст: ${batch.lastMessageAge}ms`);
      });
    }
  }

  console.log('\n⏳ Ждем еще 4 секунды для обработки батча...\n');
  await sleep(4000);

  stats = await checkBatchStats();
  if (stats) {
    console.log('📊 Статистика после обработки:');
    console.log(`   - Активных батчей: ${stats.pendingBatches}`);
    if (stats.pendingBatches === 0) {
      console.log('✅ Батч обработан успешно!');
    }
  }

  console.log('\n💡 Проверьте логи worker-а для подтверждения:');
  console.log('   ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep \\"isRapidFireBatch\\""');
  console.log('\n✅ Тестирование завершено!');
}

// Запускаем тест
testProductionBatching().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});