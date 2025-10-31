// test-redis-sync.js
const { createRedisClient } = require('./src/utils/redis-factory');
const logger = require('./src/utils/logger');

async function testRedisSync() {
  logger.info('Testing Redis synchronization between processes...');
  
  // Создаем два клиента как будто из разных процессов
  const client1 = createRedisClient('test-api');
  const client2 = createRedisClient('test-batch');
  
  try {
    // Ждем подключения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 1: Проверяем что оба клиента видят одну БД
    const testKey = 'test:sync:' + Date.now();
    const testValue = 'test-value-' + Date.now();
    
    // Client1 (API) записывает
    await client1.set(testKey, testValue, 'EX', 60);
    logger.info(`Client1 (API) set key: ${testKey}`);
    
    // Client2 (Batch) читает
    const readValue = await client2.get(testKey);
    logger.info(`Client2 (Batch) read value: ${readValue}`);
    
    if (readValue === testValue) {
      logger.info('✅ Basic sync test PASSED');
    } else {
      logger.error('❌ Basic sync test FAILED');
    }
    
    // Тест 2: Проверяем rapid-fire ключи
    const rapidFireKey = 'rapid-fire:+79686484488';
    const messageData = JSON.stringify({
      message: 'Test message',
      companyId: 962302,
      metadata: {},
      timestamp: Date.now()
    });
    
    // Client1 создает rapid-fire ключ
    await client1.rpush(rapidFireKey, messageData);
    await client1.expire(rapidFireKey, 600);
    logger.info(`Client1 created rapid-fire key: ${rapidFireKey}`);
    
    // Client2 ищет rapid-fire ключи
    const keys = await client2.keys('rapid-fire:*');
    logger.info(`Client2 found rapid-fire keys: ${keys.length}`);
    if (keys.length > 0) {
      logger.info(`Keys found: ${keys.join(', ')}`);
      
      // Проверяем содержимое
      const messages = await client2.lrange(rapidFireKey, 0, -1);
      logger.info(`Messages in batch: ${messages.length}`);
    }
    
    // Тест 3: Проверяем что оба клиента используют одинаковую БД
    const dbInfo1 = await client1.config('GET', 'databases');
    const dbInfo2 = await client2.config('GET', 'databases');
    logger.info('Client1 DB info:', dbInfo1);
    logger.info('Client2 DB info:', dbInfo2);
    
    // Очистка
    await client1.del(testKey);
    await client1.del(rapidFireKey);
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await client1.quit();
    await client2.quit();
  }
}

// Запускаем тест
testRedisSync().catch(console.error);