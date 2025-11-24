// test-expire-behavior.js
require('dotenv').config();
const Redis = require('ioredis');
const config = require('./src/config');

async function test() {
  console.log('Testing Redis EXPIRE behavior with rapid updates...\n');
  
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
    const listKey = 'test:expire:list';
    
    console.log('Adding first item and setting TTL to 20s...');
    await redis.rpush(listKey, 'item1');
    await redis.expire(listKey, 20);
    let ttl = await redis.ttl(listKey);
    console.log(`TTL after first item: ${ttl}s`);
    
    // Симулируем rapid-fire сообщения
    for (let i = 2; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунды между сообщениями
      
      console.log(`\nAdding item ${i}...`);
      await redis.rpush(listKey, `item${i}`);
      
      // Проверяем TTL ДО expire
      let ttlBefore = await redis.ttl(listKey);
      console.log(`TTL before expire: ${ttlBefore}s`);
      
      // Обновляем TTL
      await redis.expire(listKey, 20);
      
      // Проверяем TTL ПОСЛЕ expire
      let ttlAfter = await redis.ttl(listKey);
      console.log(`TTL after expire: ${ttlAfter}s`);
    }
    
    // Финальная проверка
    console.log('\nFinal check:');
    const finalTtl = await redis.ttl(listKey);
    const listLen = await redis.llen(listKey);
    console.log(`List length: ${listLen}, TTL: ${finalTtl}s`);
    
    // Очищаем
    await redis.del(listKey);
    await redis.quit();
    
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await redis.quit();
  }
}

test();