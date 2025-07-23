// test-redis-info.js
require('dotenv').config();
const { createRedisClient } = require('./src/utils/redis-factory');
const config = require('./src/config');

async function test() {
  const processName = process.argv[2] || 'unknown';
  console.log(`\nTesting Redis connection for: ${processName}`);
  console.log('='.repeat(50));
  
  // Показываем конфигурацию
  console.log('Configuration:');
  console.log(`  config.redis.url: ${config.redis.url}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
  
  // Показываем временный фикс
  let redisUrlString = config.redis.url;
  console.log(`\nBefore temp fix: ${redisUrlString}`);
  if (redisUrlString && redisUrlString.includes('6380')) {
    redisUrlString = redisUrlString.replace('6380', '6379');
  }
  console.log(`After temp fix: ${redisUrlString}`);
  
  try {
    const redis = createRedisClient(`info-${processName}`);
    await redis.ping();
    
    // Получаем информацию о сервере
    const info = await redis.info('server');
    const serverInfo = info.split('\r\n').reduce((acc, line) => {
      const [key, value] = line.split(':');
      if (key && value) acc[key] = value;
      return acc;
    }, {});
    
    console.log('\nRedis Server Info:');
    console.log(`  redis_version: ${serverInfo.redis_version}`);
    console.log(`  tcp_port: ${serverInfo.tcp_port}`);
    console.log(`  process_id: ${serverInfo.process_id}`);
    
    // Проверяем текущую базу данных
    const clientInfo = await redis.client('LIST');
    console.log('\nClient connection info:');
    const currentClient = clientInfo.split('\n').find(line => line.includes(`name=info-${processName}`));
    if (currentClient) {
      const dbMatch = currentClient.match(/db=(\d+)/);
      console.log(`  Current database: ${dbMatch ? dbMatch[1] : '0'}`);
    }
    
    // Проверяем SELECT команду
    console.log('\nTrying to select database 0...');
    await redis.select(0);
    console.log('✅ Selected database 0');
    
    // Добавляем тестовый ключ
    const testKey = `test:db:${processName}:${Date.now()}`;
    await redis.set(testKey, 'test', 'EX', 10);
    console.log(`✅ Added test key: ${testKey}`);
    
    // Проверяем все тестовые ключи
    const keys = await redis.keys('test:db:*');
    console.log(`\nTest keys in DB: ${keys.length}`);
    keys.forEach(key => console.log(`  - ${key}`));
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();