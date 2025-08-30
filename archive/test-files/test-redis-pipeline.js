#!/usr/bin/env node
/**
 * Тест Redis Pipeline для проверки правильности синтаксиса
 */

const { createRedisClient } = require('./src/utils/redis-factory');

async function testPipeline() {
  const redis = createRedisClient('test');
  
  console.log('Testing Redis Pipeline...\n');
  
  try {
    // Устанавливаем тестовые данные
    await redis.hset('test:dialog', 'field1', 'value1', 'field2', 'value2');
    await redis.set('test:client', JSON.stringify({ name: 'Test Client' }));
    await redis.lpush('test:messages', 'msg1', 'msg2', 'msg3');
    
    // Проверяем что Pipeline работает правильно
    const pipeline = redis.pipeline();
    
    console.log('Pipeline object:', typeof pipeline);
    console.log('Pipeline methods:', Object.keys(pipeline).slice(0, 10));
    
    // Добавляем команды
    pipeline.hgetall('test:dialog');
    pipeline.get('test:client');
    pipeline.lrange('test:messages', 0, -1);
    
    // Выполняем
    const results = await pipeline.exec();
    
    console.log('\nPipeline Results:');
    console.log('Results type:', typeof results, 'is array:', Array.isArray(results));
    console.log('Results length:', results.length);
    
    results.forEach((result, i) => {
      console.log(`Result ${i}:`, result);
    });
    
    // Очищаем тестовые данные
    await redis.del('test:dialog', 'test:client', 'test:messages');
    
    console.log('\n✅ Pipeline test completed');
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
  } finally {
    await redis.quit();
  }
}

testPipeline();