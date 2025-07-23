// test-redis-batch-detailed.js
require('dotenv').config();
const Redis = require('ioredis');
const config = require('./src/config');

async function test() {
  console.log('Testing Redis batch with direct access...');
  console.log('REDIS_URL:', process.env.REDIS_URL);
  console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET');
  
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
    await redis.ping();
    console.log('✅ Redis connected');
    
    const batchKey = 'rapid-fire:79001234567';
    const lastMsgKey = 'last-msg:79001234567';
    
    // Добавляем данные
    await redis.rpush(batchKey, JSON.stringify({
      message: 'Test message 1',
      timestamp: Date.now()
    }));
    await redis.set(lastMsgKey, Date.now());
    await redis.expire(batchKey, 60);
    await redis.expire(lastMsgKey, 60);
    
    console.log('✅ Added batch data');
    
    // Проверяем сразу
    const exists1 = await redis.exists(batchKey);
    const ttl1 = await redis.ttl(batchKey);
    const size1 = await redis.llen(batchKey);
    console.log(`Check 1: exists=${exists1}, ttl=${ttl1}, size=${size1}`);
    
    // Ждем 5 секунд
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const exists2 = await redis.exists(batchKey);
    const ttl2 = await redis.ttl(batchKey);
    const size2 = await redis.llen(batchKey);
    console.log(`Check 2 (after 5s): exists=${exists2}, ttl=${ttl2}, size=${size2}`);
    
    // Ждем еще 6 секунд (всего 11)
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const exists3 = await redis.exists(batchKey);
    const ttl3 = await redis.ttl(batchKey);
    const size3 = await redis.llen(batchKey);
    console.log(`Check 3 (after 11s): exists=${exists3}, ttl=${ttl3}, size=${size3}`);
    
    // Проверяем все ключи с префиксом
    const keys = await redis.keys('rapid-fire:*');
    console.log('Keys found:', keys);
    
    // Очищаем
    await redis.del(batchKey, lastMsgKey);
    await redis.quit();
    
    console.log('✅ Test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await redis.quit();
    process.exit(1);
  }
}

test();