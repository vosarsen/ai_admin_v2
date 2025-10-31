#!/usr/bin/env node
// scripts/test-redis-visibility.js

const { createRedisClient } = require('../src/utils/redis-factory');
const logger = require('../src/utils/logger');

async function testRedisVisibility() {
  logger.info('Testing Redis visibility between processes...');
  
  // Создаем два клиента как в разных процессах
  const apiClient = createRedisClient('api-test');
  const batchClient = createRedisClient('batch-test');
  
  try {
    // Ждем подключения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 1. API пишет ключ
    const testKey = 'rapid-fire:+79686484488';
    const testValue = JSON.stringify({
      message: 'Test message',
      timestamp: Date.now()
    });
    
    logger.info('API client writing key:', testKey);
    await apiClient.rpush(testKey, testValue);
    await apiClient.expire(testKey, 120);
    
    // 2. Проверяем что API видит свой ключ
    const apiKeys = await apiClient.keys('rapid-fire:*');
    logger.info('API client sees keys:', apiKeys);
    
    // 3. Проверяем что Batch processor видит тот же ключ
    const batchKeys = await batchClient.keys('rapid-fire:*');
    logger.info('Batch client sees keys:', batchKeys);
    
    // 4. Проверяем содержимое
    const apiContent = await apiClient.lrange(testKey, 0, -1);
    const batchContent = await batchClient.lrange(testKey, 0, -1);
    
    logger.info('API client content length:', apiContent.length);
    logger.info('Batch client content length:', batchContent.length);
    
    // 5. Проверяем информацию о базе данных
    const apiInfo = await apiClient.info('keyspace');
    const batchInfo = await batchClient.info('keyspace');
    
    logger.info('API client DB info:', apiInfo);
    logger.info('Batch client DB info:', batchInfo);
    
    // 6. Проверяем что используется одна база
    const apiDB = await apiClient.config('GET', 'databases');
    const batchDB = await batchClient.config('GET', 'databases');
    
    logger.info('API client databases config:', apiDB);
    logger.info('Batch client databases config:', batchDB);
    
    // Очистка
    await apiClient.del(testKey);
    
    if (batchKeys.length === 0 && apiKeys.length > 0) {
      logger.error('❌ PROBLEM: Batch client cannot see keys created by API client!');
      
      // Дополнительная диагностика
      logger.info('\nAdditional diagnostics:');
      
      // Проверяем SELECT команду
      await apiClient.select(0);
      await batchClient.select(0);
      
      // Создаем ключ снова
      await apiClient.set('test:visibility', 'test');
      
      const apiTest = await apiClient.get('test:visibility');
      const batchTest = await batchClient.get('test:visibility');
      
      logger.info('API sees test key:', apiTest);
      logger.info('Batch sees test key:', batchTest);
      
      // Проверяем конфигурацию
      const apiClientInfo = await apiClient.client('LIST');
      const batchClientInfo = await batchClient.client('LIST');
      
      logger.info('API client info:', apiClientInfo);
      logger.info('Batch client info:', batchClientInfo);
    } else {
      logger.info('✅ Both clients see the same keys!');
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await apiClient.quit();
    await batchClient.quit();
  }
}

// Запускаем тест
testRedisVisibility().catch(console.error);