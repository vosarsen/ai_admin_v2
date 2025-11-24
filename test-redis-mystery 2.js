// test-redis-mystery.js
require('dotenv').config();
const Redis = require('ioredis');
const config = require('./src/config');

async function monitorKey(redis, key, duration) {
  console.log(`\n🔍 Monitoring key "${key}" for ${duration/1000} seconds...`);
  const startTime = Date.now();
  let lastExists = null;
  
  while (Date.now() - startTime < duration) {
    const exists = await redis.exists(key);
    const ttl = await redis.ttl(key);
    const now = Date.now() - startTime;
    
    if (exists !== lastExists) {
      console.log(`[${(now/1000).toFixed(1)}s] Key ${exists ? 'EXISTS' : 'DELETED'}, TTL: ${ttl}`);
      lastExists = exists;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Проверка каждые 100мс
  }
}

async function test() {
  console.log('Testing Redis key deletion mystery...');
  
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
  
  // Создаем второй клиент для мониторинга
  const monitor = new Redis({
    host: redisUrl.hostname,
    port: redisUrl.port || 6379,
    password: config.redis.password
  });
  
  try {
    await redis.ping();
    console.log('✅ Redis connected');
    
    // Тест 1: Обычный ключ с TTL
    console.log('\n📝 Test 1: Regular key with TTL');
    const testKey1 = 'test:ttl:key1';
    await redis.set(testKey1, 'value', 'EX', 60);
    await monitorKey(monitor, testKey1, 15000);
    
    // Тест 2: Ключ с префиксом rapid-fire
    console.log('\n📝 Test 2: Key with rapid-fire prefix');
    const testKey2 = 'rapid-fire:test:key2';
    await redis.set(testKey2, 'value', 'EX', 60);
    await monitorKey(monitor, testKey2, 15000);
    
    // Тест 3: List с TTL
    console.log('\n📝 Test 3: List with TTL');
    const testKey3 = 'rapid-fire:test:list';
    await redis.rpush(testKey3, 'item1', 'item2');
    await redis.expire(testKey3, 60);
    await monitorKey(monitor, testKey3, 15000);
    
    // Очищаем
    await redis.del(testKey1, testKey2, testKey3);
    await redis.quit();
    await monitor.quit();
    
    console.log('\n✅ Test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await redis.quit();
    await monitor.quit();
    process.exit(1);
  }
}

test();