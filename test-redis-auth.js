#!/usr/bin/env node

/**
 * Test Redis connection with authentication
 */

const Redis = require('ioredis');
const { getRedisConfig } = require('./src/config/redis-config');

async function testRedisConnection() {
  console.log('🧪 Testing Redis connection with authentication...\n');
  
  // Get configuration
  const config = getRedisConfig();
  
  console.log('📋 Configuration:');
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Password: ${config.password ? '✅ Set (' + config.password.length + ' chars)' : '❌ Not set'}`);
  console.log(`  Database: ${config.db}`);
  console.log('');
  
  // Create client
  const redis = new Redis(config);
  
  try {
    // Test ping
    console.log('🏓 Testing PING...');
    const pingResult = await redis.ping();
    console.log(`  Result: ${pingResult}`);
    
    // Test write
    console.log('\n📝 Testing WRITE...');
    const testKey = 'test:auth:' + Date.now();
    const testValue = 'Redis authentication test';
    await redis.set(testKey, testValue, 'EX', 10);
    console.log(`  Written key: ${testKey}`);
    
    // Test read
    console.log('\n📖 Testing READ...');
    const readValue = await redis.get(testKey);
    console.log(`  Read value: ${readValue}`);
    
    if (readValue === testValue) {
      console.log('  ✅ Read/Write test passed');
    } else {
      console.log('  ❌ Read/Write test failed');
    }
    
    // Test delete
    console.log('\n🗑️  Testing DELETE...');
    await redis.del(testKey);
    const afterDelete = await redis.get(testKey);
    if (!afterDelete) {
      console.log('  ✅ Delete test passed');
    } else {
      console.log('  ❌ Delete test failed');
    }
    
    // Get server info
    console.log('\n📊 Redis Server Info:');
    const info = await redis.info('server');
    const lines = info.split('\n');
    for (const line of lines) {
      if (line.startsWith('redis_version:') || 
          line.startsWith('redis_mode:') ||
          line.startsWith('process_id:') ||
          line.startsWith('tcp_port:')) {
        console.log(`  ${line}`);
      }
    }
    
    // Check if password is configured on server
    console.log('\n🔒 Security Check:');
    try {
      const configGet = await redis.config('GET', 'requirepass');
      const hasPassword = configGet && configGet[1] && configGet[1].length > 0;
      console.log(`  Password protection: ${hasPassword ? '✅ Enabled' : '⚠️  Disabled'}`);
    } catch (err) {
      console.log('  Cannot check password config (CONFIG command may be renamed for security)');
    }
    
    console.log('\n✅ All tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Redis connection test failed:');
    console.error(`  Error: ${error.message}`);
    
    if (error.message.includes('NOAUTH')) {
      console.error('\n⚠️  Authentication required but no password provided');
      console.error('  Please set REDIS_PASSWORD in .env file');
    } else if (error.message.includes('invalid password')) {
      console.error('\n⚠️  Invalid password');
      console.error('  Please check REDIS_PASSWORD in .env file');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Connection refused');
      console.error('  Please check:');
      console.error('  1. Redis is running');
      console.error('  2. SSH tunnel is active (for development)');
      console.error('  3. Host and port are correct');
    }
    
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

// Run test
testRedisConnection().catch(console.error);