// test-redis-isolation.js
require('dotenv').config();
const { createRedisClient } = require('./src/utils/redis-factory');

async function test() {
  console.log('Testing Redis isolation between processes...\n');
  
  const processName = process.argv[2] || 'unknown';
  console.log(`Running as: ${processName}`);
  console.log(`PID: ${process.pid}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL}\n`);
  
  try {
    // Создаем клиента как в реальном коде
    const redis = createRedisClient(`test-${processName}`);
    await redis.ping();
    console.log('✅ Connected to Redis');
    
    // Добавляем уникальный ключ для этого процесса
    const testKey = `test:process:${processName}:${process.pid}`;
    await redis.set(testKey, JSON.stringify({
      processName,
      pid: process.pid,
      timestamp: Date.now()
    }), 'EX', 60);
    
    console.log(`✅ Added key: ${testKey}`);
    
    // Проверяем все ключи test:process:*
    const allKeys = await redis.keys('test:process:*');
    console.log('\nAll test keys in Redis:');
    for (const key of allKeys) {
      const value = await redis.get(key);
      console.log(`  ${key}: ${value}`);
    }
    
    // Проверяем rapid-fire ключи
    const batchKeys = await redis.keys('rapid-fire:*');
    console.log(`\nRapid-fire keys found: ${batchKeys.length}`);
    if (batchKeys.length > 0) {
      console.log('Keys:', batchKeys);
    }
    
    // Если это API процесс, добавим тестовый батч
    if (processName === 'api') {
      const batchKey = 'rapid-fire:test-isolation';
      const lastMsgKey = 'last-msg:test-isolation';
      
      await redis.rpush(batchKey, JSON.stringify({
        message: 'Test from API process',
        timestamp: Date.now()
      }));
      await redis.set(lastMsgKey, Date.now());
      await redis.expire(batchKey, 60);
      await redis.expire(lastMsgKey, 60);
      
      console.log(`\n✅ Added test batch: ${batchKey}`);
    }
    
    // Ждем 2 секунды и проверяем снова
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalBatchKeys = await redis.keys('rapid-fire:*');
    console.log(`\nFinal rapid-fire keys: ${finalBatchKeys.length}`);
    if (finalBatchKeys.length > 0) {
      for (const key of finalBatchKeys) {
        const ttl = await redis.ttl(key);
        const len = await redis.llen(key);
        console.log(`  ${key}: length=${len}, ttl=${ttl}`);
      }
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();