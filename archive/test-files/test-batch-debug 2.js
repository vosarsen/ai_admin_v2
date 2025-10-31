#!/usr/bin/env node

// test-batch-debug.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const batchService = require('./src/services/redis-batch-service');
const Redis = require('ioredis');
const logger = require('./src/utils/logger');

async function testBatch() {
  console.log('🧪 Testing batch service...\n');
  
  try {
    // Инициализируем batch service
    console.log('1. Initializing batch service...');
    await batchService.initialize();
    console.log('✅ Batch service initialized\n');
    
    // Добавляем тестовое сообщение
    const testPhone = '79001234567';
    const testMessage = 'Тестовое сообщение ' + new Date().toISOString();
    
    console.log('2. Adding message to batch...');
    console.log(`   Phone: ${testPhone}`);
    console.log(`   Message: ${testMessage}`);
    
    const result = await batchService.addMessage(
      testPhone,
      testMessage,
      962302,
      { timestamp: new Date().toISOString() }
    );
    
    console.log('✅ Message added to batch\n');
    
    // Проверяем Redis напрямую
    console.log('3. Checking Redis directly...');
    const redis = new Redis({
      host: 'localhost',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    });
    
    const batchKey = `rapid-fire:${testPhone}`;
    const messages = await redis.lrange(batchKey, 0, -1);
    console.log(`   Batch key: ${batchKey}`);
    console.log(`   Messages in batch: ${messages.length}`);
    
    if (messages.length > 0) {
      console.log('   Messages:');
      messages.forEach((msg, i) => {
        const parsed = JSON.parse(msg);
        console.log(`     ${i + 1}. ${parsed.message.substring(0, 50)}...`);
      });
    }
    
    const ttl = await redis.ttl(batchKey);
    console.log(`   TTL: ${ttl} seconds\n`);
    
    // Проверяем, может ли batch processor увидеть это
    console.log('4. Checking if batch processor can see it...');
    const keys = await redis.keys('rapid-fire:*');
    console.log(`   Found ${keys.length} batch keys`);
    keys.forEach(key => console.log(`     - ${key}`));
    
    await redis.quit();
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Batch test error:', error);
  }
  
  process.exit(0);
}

// Запуск теста
testBatch();