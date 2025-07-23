// test-redis-connections.js
require('dotenv').config();
const Redis = require('ioredis');
const config = require('./src/config');

async function test() {
  console.log('Testing Redis connections...\n');
  
  // Проверка конфигурации
  console.log('Configuration:');
  console.log('REDIS_URL:', process.env.REDIS_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Config redis.url:', config.redis.url);
  
  // Тест прямого подключения к 6379
  console.log('\n1. Direct connection to port 6379:');
  const redis1 = new Redis({
    host: 'localhost',
    port: 6379,
    password: config.redis.password
  });
  
  try {
    await redis1.ping();
    console.log('✅ Connected to 6379');
    
    // Добавляем тестовый ключ
    await redis1.set('test:direct:6379', 'value-6379', 'EX', 60);
    const keys1 = await redis1.keys('test:*');
    console.log('Keys on 6379:', keys1);
  } catch (error) {
    console.error('❌ Failed to connect to 6379:', error.message);
  }
  
  // Тест с временным фиксом (как в redis-factory)
  console.log('\n2. Connection with temp fix (6380→6379):');
  let redisUrlString = config.redis.url;
  if (redisUrlString && redisUrlString.includes('6380')) {
    redisUrlString = redisUrlString.replace('6380', '6379');
  }
  const redisUrl = new URL(redisUrlString);
  
  const redis2 = new Redis({
    host: redisUrl.hostname,
    port: redisUrl.port || 6379,
    password: config.redis.password
  });
  
  try {
    await redis2.ping();
    console.log('✅ Connected with temp fix');
    
    // Добавляем тестовый ключ
    await redis2.set('test:tempfix', 'value-tempfix', 'EX', 60);
    const keys2 = await redis2.keys('test:*');
    console.log('Keys with temp fix:', keys2);
  } catch (error) {
    console.error('❌ Failed with temp fix:', error.message);
  }
  
  // Тест batch service
  console.log('\n3. Test batch service:');
  const batchService = require('./src/services/redis-batch-service');
  
  try {
    await batchService.initialize();
    console.log('✅ Batch service initialized');
    
    // Добавляем сообщение
    await batchService.addMessage('79000000000', 'Test message', 962302);
    
    // Проверяем через прямое подключение
    const batchKeys = await redis1.keys('rapid-fire:*');
    console.log('Batch keys via direct connection:', batchKeys);
    
    const batchKeys2 = await redis2.keys('rapid-fire:*');
    console.log('Batch keys via temp fix:', batchKeys2);
    
  } catch (error) {
    console.error('❌ Batch service error:', error.message);
  }
  
  // Очистка
  await redis1.del('test:direct:6379', 'test:tempfix');
  await redis1.quit();
  await redis2.quit();
  await batchService.close();
  
  console.log('\n✅ Test completed');
  process.exit(0);
}

test().catch(console.error);