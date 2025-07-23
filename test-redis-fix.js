// test-redis-fix.js
require('dotenv').config();
const batchService = require('./src/services/redis-batch-service');
const Redis = require('ioredis');
const config = require('./src/config');

async function test() {
  console.log('Testing fixed Redis batch service...');
  
  // Временный фикс для порта
  let redisUrlString = config.redis.url;
  if (redisUrlString && redisUrlString.includes('6380')) {
    redisUrlString = redisUrlString.replace('6380', '6379');
  }
  
  const redisUrl = new URL(redisUrlString);
  const redis = new Redis({
    host: redisUrl.hostname,
    port: redisUrl.port || 6379,
    password: config.redis.password
  });
  
  try {
    // Инициализируем сервис
    await batchService.initialize();
    console.log('✅ Batch service initialized');
    
    // Тест 1: Создаем батч без lastMessageTime
    console.log('\n📝 Test 1: Batch without lastMessageTime');
    const testPhone1 = '79001111111';
    const batchKey1 = `rapid-fire:${testPhone1}`;
    
    // Добавляем сообщения напрямую без lastMessageTime
    await redis.rpush(batchKey1, JSON.stringify({
      message: 'Test without time',
      timestamp: Date.now()
    }));
    await redis.expire(batchKey1, 60);
    
    // Проверяем, что батч НЕ обрабатывается
    const shouldProcess1 = await batchService.shouldProcessBatch(testPhone1);
    console.log(`Should process: ${shouldProcess1} (expected: false)`);
    
    // Проверяем, что ключ все еще существует
    const exists1 = await redis.exists(batchKey1);
    console.log(`Key exists after check: ${exists1} (expected: 1)`);
    
    // Очищаем
    await redis.del(batchKey1);
    
    // Тест 2: Нормальный батч с lastMessageTime
    console.log('\n📝 Test 2: Normal batch with timeout');
    const testPhone2 = '79002222222';
    
    await batchService.addMessage(testPhone2, 'Message 1', 962302);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await batchService.addMessage(testPhone2, 'Message 2', 962302);
    
    const stats1 = await batchService.getStats();
    console.log('Stats before timeout:', JSON.stringify(stats1, null, 2));
    
    // Ждем таймаут
    console.log('⏳ Waiting 11 seconds for timeout...');
    await new Promise(resolve => setTimeout(resolve, 11000));
    
    // Обрабатываем
    const result = await batchService.processPendingBatches();
    console.log('Processing result:', result);
    
    const stats2 = await batchService.getStats();
    console.log('Stats after processing:', JSON.stringify(stats2, null, 2));
    
    await batchService.close();
    await redis.quit();
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await batchService.close();
    await redis.quit();
    process.exit(1);
  }
}

test();