// test-redis-ttl.js
require('dotenv').config();
const Redis = require('ioredis');
const config = require('./src/config');

async function test() {
  console.log('Testing Redis TTL behavior...\n');
  
  // Временный фикс
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
    const testKey = 'test:ttl:check';
    
    // Тест 1: Создаем ключ с TTL
    console.log('Test 1: Create key with TTL');
    await redis.set(testKey, 'value1', 'EX', 60);
    let ttl = await redis.ttl(testKey);
    console.log(`Initial TTL: ${ttl}`);
    
    // Ждем 2 секунды
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Тест 2: Обновляем значение БЕЗ TTL
    console.log('\nTest 2: Update value WITHOUT TTL');
    await redis.set(testKey, 'value2'); // БЕЗ EX!
    ttl = await redis.ttl(testKey);
    console.log(`TTL after SET without EX: ${ttl}`);
    
    // Тест 3: Используем EXPIRE после обновления
    console.log('\nTest 3: Use EXPIRE after update');
    await redis.set(testKey, 'value3');
    await redis.expire(testKey, 60);
    ttl = await redis.ttl(testKey);
    console.log(`TTL after EXPIRE: ${ttl}`);
    
    // Тест 4: RPUSH к списку с TTL
    console.log('\nTest 4: RPUSH to list with TTL');
    const listKey = 'test:list:ttl';
    await redis.rpush(listKey, 'item1');
    await redis.expire(listKey, 60);
    ttl = await redis.ttl(listKey);
    console.log(`Initial list TTL: ${ttl}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Добавляем еще элементы
    await redis.rpush(listKey, 'item2');
    ttl = await redis.ttl(listKey);
    console.log(`TTL after RPUSH: ${ttl} (should be ~58)`);
    
    // Обновляем TTL
    await redis.expire(listKey, 60);
    ttl = await redis.ttl(listKey);
    console.log(`TTL after new EXPIRE: ${ttl}`);
    
    // Тест 5: Проверяем существующий TTL
    console.log('\nTest 5: Check if key has TTL');
    const hasTTL = await redis.ttl(listKey);
    console.log(`Key has TTL: ${hasTTL > 0 ? 'yes' : 'no'} (${hasTTL})`);
    
    // Очищаем
    await redis.del(testKey, listKey);
    await redis.quit();
    
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await redis.quit();
  }
}

test();