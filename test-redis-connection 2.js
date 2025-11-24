#!/usr/bin/env node

import { createClient } from 'redis';

const REDIS_URL = 'redis://localhost:6380';
const REDIS_PASSWORD = '70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg=';

async function testRedis() {
  console.log('🔌 Connecting to Redis at', REDIS_URL);
  
  try {
    // Create Redis client with password
    const url = new URL(REDIS_URL);
    url.password = REDIS_PASSWORD;
    
    const redis = createClient({ 
      url: url.toString(),
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false // Don't retry on failure
      }
    });
    
    redis.on('error', err => console.error('❌ Redis Client Error:', err));
    redis.on('connect', () => console.log('🔗 Redis connecting...'));
    redis.on('ready', () => console.log('✅ Redis ready'));
    
    console.log('📡 Attempting to connect...');
    await redis.connect();
    console.log('✅ Connected successfully!');
    
    // Test operations
    console.log('\n📝 Testing operations:');
    
    // 1. Set a test key
    console.log('1. Setting test key...');
    await redis.set('test:key', 'test value');
    console.log('✅ Set successful');
    
    // 2. Get the key
    console.log('2. Getting test key...');
    const value = await redis.get('test:key');
    console.log(`✅ Got value: ${value}`);
    
    // 3. Delete the key
    console.log('3. Deleting test key...');
    await redis.del('test:key');
    console.log('✅ Delete successful');
    
    // 4. Test clear_context operation
    console.log('\n4. Testing clear_context operation...');
    const phone = '79001234567';
    const company_id = 962302;
    const keys = [
      `context:${phone}:${company_id}`,
      `conversation:${phone}:${company_id}`,
      `preferences:${phone}:${company_id}`,
      `booking:${phone}:${company_id}`
    ];
    
    console.log('   Setting test context keys...');
    await Promise.all(keys.map(key => redis.set(key, 'test data')));
    console.log('✅ Test keys set');
    
    console.log('   Clearing context (deleting keys)...');
    const startTime = Date.now();
    await Promise.all(keys.map(key => redis.del(key)));
    const duration = Date.now() - startTime;
    console.log(`✅ Context cleared in ${duration}ms`);
    
    // 5. Close connection
    console.log('\n5. Closing connection...');
    await redis.quit();
    console.log('✅ Connection closed');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    });
  }
}

testRedis();