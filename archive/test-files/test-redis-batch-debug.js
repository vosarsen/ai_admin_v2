#!/usr/bin/env node

require('dotenv').config();
const { createRedisClient } = require('./src/utils/redis-factory');

async function debugRedisBatch() {
  console.log('🔍 Testing Redis Batch Connection...\n');
  
  try {
    // Создаем два клиента - как в API и как в batch processor
    const apiClient = createRedisClient('api');
    const batchClient = createRedisClient('batch-service');
    
    await apiClient.ping();
    await batchClient.ping();
    console.log('✅ Both Redis clients connected\n');
    
    // Проверяем существующие ключи
    console.log('📋 Checking rapid-fire keys:');
    const keys1 = await apiClient.keys('rapid-fire:*');
    console.log(`API client sees: ${keys1.length} keys`);
    if (keys1.length > 0) {
      console.log('Keys:', keys1);
    }
    
    const keys2 = await batchClient.keys('rapid-fire:*');
    console.log(`Batch client sees: ${keys2.length} keys`);
    if (keys2.length > 0) {
      console.log('Keys:', keys2);
    }
    
    // Проверяем конкретный ключ
    const testKey = 'rapid-fire:79686484488';
    console.log(`\n🔍 Checking specific key: ${testKey}`);
    
    const exists1 = await apiClient.exists(testKey);
    const exists2 = await batchClient.exists(testKey);
    console.log(`API client: exists = ${exists1}`);
    console.log(`Batch client: exists = ${exists2}`);
    
    if (exists1) {
      const len = await apiClient.llen(testKey);
      const ttl = await apiClient.ttl(testKey);
      console.log(`List length: ${len}, TTL: ${ttl}s`);
      
      const items = await apiClient.lrange(testKey, 0, -1);
      console.log(`\nMessages in batch:`);
      items.forEach((item, i) => {
        const msg = JSON.parse(item);
        console.log(`${i+1}. ${msg.message} (${new Date(msg.timestamp).toLocaleTimeString()})`);
      });
    }
    
    // Тестируем добавление и чтение
    console.log('\n🧪 Testing add and read:');
    const testBatchKey = 'rapid-fire:test-debug';
    
    // API добавляет
    await apiClient.rpush(testBatchKey, JSON.stringify({
      message: 'Test from API',
      timestamp: Date.now()
    }));
    console.log('✅ API client added message');
    
    // Batch читает
    const testExists = await batchClient.exists(testBatchKey);
    const testLen = await batchClient.llen(testBatchKey);
    console.log(`✅ Batch client sees: exists=${testExists}, length=${testLen}`);
    
    // Очищаем тест
    await apiClient.del(testBatchKey);
    
    // Проверяем конфигурацию Redis
    console.log('\n📊 Redis configuration:');
    const apiInfo = await apiClient.info('server');
    const batchInfo = await batchClient.info('server');
    
    const getVersion = (info) => {
      const match = info.match(/redis_version:(.+)/);
      return match ? match[1].trim() : 'unknown';
    };
    
    console.log(`API client: Redis ${getVersion(apiInfo)}`);
    console.log(`Batch client: Redis ${getVersion(batchInfo)}`);
    
    // Проверяем выбранную базу данных
    const apiDb = await apiClient.client('list');
    const batchDb = await batchClient.client('list');
    
    console.log('\n🗄️  Database selection:');
    const getDb = (clientList) => {
      const match = clientList.match(/db=(\d+)/);
      return match ? match[1] : '0';
    };
    
    console.log(`API client: db=${getDb(apiDb)}`);
    console.log(`Batch client: db=${getDb(batchDb)}`);
    
    await apiClient.quit();
    await batchClient.quit();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugRedisBatch();