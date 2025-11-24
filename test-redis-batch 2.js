// test-redis-batch.js
require('dotenv').config();
const batchService = require('./src/services/redis-batch-service');

async function test() {
  console.log('Testing Redis batch service...');
  console.log('REDIS_URL:', process.env.REDIS_URL);
  console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET');
  
  try {
    // Инициализируем сервис
    await batchService.initialize();
    console.log('✅ Batch service initialized');
    
    // Добавляем тестовое сообщение
    const testPhone = '79001234567';
    await batchService.addMessage(testPhone, 'Test message 1', 962302);
    console.log('✅ Added message 1');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await batchService.addMessage(testPhone, 'Test message 2', 962302);
    console.log('✅ Added message 2');
    
    // Проверяем статистику
    const stats = await batchService.getStats();
    console.log('📊 Stats:', JSON.stringify(stats, null, 2));
    
    // Ждем timeout
    console.log('⏳ Waiting for batch timeout (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 11000));
    
    // Обрабатываем батчи
    console.log('🔄 Processing batches...');
    const result = await batchService.processPendingBatches();
    console.log('✅ Processing result:', result);
    
    // Проверяем статистику после обработки
    const statsAfter = await batchService.getStats();
    console.log('📊 Stats after processing:', JSON.stringify(statsAfter, null, 2));
    
    await batchService.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();