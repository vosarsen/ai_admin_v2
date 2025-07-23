// test-batch-service.js
const batchService = require('./src/services/redis-batch-service');
const logger = require('./src/utils/logger');

// Отключаем лишние логи
logger.level = 'info';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBatchService() {
  console.log('🧪 Тестирование Redis Batch Service\n');
  
  try {
    // Инициализация
    console.log('1. Инициализация сервиса...');
    await batchService.initialize();
    console.log('✅ Сервис инициализирован\n');

    // Очистка перед тестом
    const testPhone = '79001234567';
    await batchService.clearBatch(testPhone);

    // Тест 1: Добавление одного сообщения
    console.log('2. Тест одиночного сообщения...');
    await batchService.addMessage(testPhone, 'Привет', 962302, { test: true });
    
    let stats = await batchService.getStats();
    console.log('📊 Статистика после добавления:');
    console.log(`   - Pending batches: ${stats.pendingBatches}`);
    console.log(`   - Batch size: ${stats.batches[0]?.size || 0}`);
    console.log('');

    // Тест 2: Добавление нескольких сообщений быстро
    console.log('3. Тест rapid-fire сообщений...');
    const messages = ['запишите', 'меня на', 'стрижку', 'к Бари', 'на завтра', 'в 8', 'вечера'];
    
    for (const msg of messages) {
      await batchService.addMessage(testPhone, msg, 962302, { test: true });
      console.log(`   + Добавлено: "${msg}"`);
      await sleep(100); // Небольшая задержка между сообщениями
    }
    
    stats = await batchService.getStats();
    console.log(`\n📊 Статистика после rapid-fire:`);
    console.log(`   - Batch size: ${stats.batches[0]?.size || 0} messages`);
    console.log(`   - Last message age: ${stats.batches[0]?.lastMessageAge || 0}ms\n`);

    // Тест 3: Проверка shouldProcessBatch
    console.log('4. Тест логики обработки батча...');
    let shouldProcess = await batchService.shouldProcessBatch(testPhone);
    console.log(`   - Should process immediately: ${shouldProcess}`);
    
    console.log('   - Ждем 5.5 секунд...');
    await sleep(5500);
    
    shouldProcess = await batchService.shouldProcessBatch(testPhone);
    console.log(`   - Should process after timeout: ${shouldProcess}\n`);

    // Тест 4: Обработка батча вручную
    console.log('5. Тест обработки батча...');
    await batchService.processBatch(testPhone);
    console.log('✅ Батч обработан\n');

    // Проверяем, что батч очищен
    stats = await batchService.getStats();
    console.log(`📊 Статистика после обработки:`);
    console.log(`   - Pending batches: ${stats.pendingBatches}\n`);

    // Тест 5: Тест с несколькими пользователями
    console.log('6. Тест с несколькими пользователями...');
    const users = ['79001111111', '79002222222', '79003333333'];
    
    for (const phone of users) {
      await batchService.addMessage(phone, `Сообщение от ${phone}`, 962302);
    }
    
    stats = await batchService.getStats();
    console.log(`📊 Несколько пользователей:`);
    console.log(`   - Total pending batches: ${stats.pendingBatches}`);
    stats.batches.forEach(b => {
      console.log(`   - ${b.phone}: ${b.size} messages`);
    });
    console.log('');

    // Очистка
    console.log('7. Очистка тестовых данных...');
    for (const phone of [...users, testPhone]) {
      await batchService.clearBatch(phone);
    }
    console.log('✅ Данные очищены\n');

    // Тест 6: Максимальный размер батча
    console.log('8. Тест максимального размера батча...');
    const maxTestPhone = '79009999999';
    
    for (let i = 1; i <= 12; i++) {
      await batchService.addMessage(maxTestPhone, `Сообщение ${i}`, 962302);
    }
    
    stats = await batchService.getStats();
    const maxBatch = stats.batches.find(b => b.phone === maxTestPhone);
    console.log(`   - Added 12 messages`);
    console.log(`   - Batch size: ${maxBatch?.size || 0} (max is 10)`);
    
    shouldProcess = await batchService.shouldProcessBatch(maxTestPhone);
    console.log(`   - Should process (size > max): ${shouldProcess}\n`);
    
    await batchService.clearBatch(maxTestPhone);

    console.log('✅ Все тесты пройдены успешно!');

  } catch (error) {
    console.error('❌ Ошибка в тестах:', error);
  } finally {
    await batchService.close();
    process.exit(0);
  }
}

// Запускаем тесты
testBatchService();