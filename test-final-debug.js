// test-final-debug.js
require('dotenv').config();
const { getRedisConfig } = require('./src/config/redis-config');
const Redis = require('ioredis');

async function test() {
  console.log('Final debugging test...\n');
  
  // Создаем клиент с той же конфигурацией
  const config = getRedisConfig();
  console.log('Using config:', config);
  
  const redis = new Redis(config);
  
  try {
    await redis.ping();
    console.log('✅ Connected to Redis\n');
    
    // Проверяем текущие ключи
    console.log('Checking for rapid-fire keys...');
    const keys = await redis.keys('rapid-fire:*');
    console.log(`Found ${keys.length} rapid-fire keys`);
    
    if (keys.length > 0) {
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        const len = await redis.llen(key);
        const data = await redis.lrange(key, 0, 0);
        console.log(`  ${key}: len=${len}, ttl=${ttl}, first=${data[0] ? data[0].substring(0, 50) : 'empty'}`);
      }
    }
    
    // Добавляем тестовый ключ
    console.log('\nAdding test batch...');
    const testKey = 'rapid-fire:test-debug';
    await redis.rpush(testKey, JSON.stringify({ message: 'test', timestamp: Date.now() }));
    await redis.expire(testKey, 30);
    
    // Проверяем, видят ли его
    const exists = await redis.exists(testKey);
    const ttl = await redis.ttl(testKey);
    console.log(`Test key exists: ${exists}, ttl: ${ttl}`);
    
    // Ждем секунду
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Проверяем снова
    const keys2 = await redis.keys('rapid-fire:*');
    console.log(`\nAfter 1 second: found ${keys2.length} keys`);
    
    // Информация о сервере
    const info = await redis.info('server');
    const lines = info.split('\r\n');
    const version = lines.find(l => l.startsWith('redis_version'));
    const tcpPort = lines.find(l => l.startsWith('tcp_port'));
    console.log(`\nRedis server: ${version}, ${tcpPort}`);
    
    // Проверка выбранной БД
    const clientList = await redis.client('LIST');
    console.log('\nActive clients:');
    const clients = clientList.split('\n').filter(c => c.includes('cmd='));
    clients.forEach(c => {
      const db = c.match(/db=(\d+)/);
      const name = c.match(/name=([^ ]+)/);
      if (db || name) {
        console.log(`  ${name ? name[1] : 'unnamed'}: db=${db ? db[1] : '0'}`);
      }
    });
    
    // Очистка
    await redis.del(testKey);
    await redis.quit();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await redis.quit();
  }
}

test();