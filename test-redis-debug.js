// test-redis-debug.js
require('dotenv').config();
const config = require('./src/config');

console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('Config redis.url:', config.redis.url);

// Тестируем временный фикс
let redisUrlString = config.redis.url;
console.log('\nBefore fix:', redisUrlString);
if (redisUrlString && redisUrlString.includes('6380')) {
  redisUrlString = redisUrlString.replace('6380', '6379');
}
console.log('After fix:', redisUrlString);

// Тестируем, что webhook добавляет
const batchService = require('./src/services/redis-batch-service');

async function test() {
  try {
    await batchService.initialize();
    console.log('\n✅ Batch service initialized');
    
    // Добавляем тестовое сообщение
    const phone = '79999999999';
    console.log(`\nAdding test message for ${phone}...`);
    await batchService.addMessage(phone, 'Test message', 962302);
    
    // Проверяем статистику
    const stats = await batchService.getStats();
    console.log('\nStats after add:', JSON.stringify(stats, null, 2));
    
    // Проверяем напрямую через Redis
    const Redis = require('ioredis');
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
      password: config.redis.password
    });
    
    const keys = await redis.keys('rapid-fire:*');
    console.log('\nRedis keys found:', keys);
    
    await redis.quit();
    await batchService.close();
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

test();