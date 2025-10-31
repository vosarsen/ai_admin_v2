#!/usr/bin/env node

const Redis = require('ioredis');
const config = require('../src/config');

async function clearContext(phone, companyId = 962302) {
  console.log(`🧹 Clearing context for ${phone} in company ${companyId}`);
  
  try {
    // Create Redis client using environment config
    const redis = new Redis(config.redis.url, {
      password: config.redis.password,
      ...config.redis.options
    });
    
    console.log('✅ Connected to Redis');
    
    const keys = [
      `context:${phone}:${companyId}`,
      `conversation:${phone}:${companyId}`,
      `preferences:${phone}:${companyId}`,
      `booking:${phone}:${companyId}`
    ];
    
    console.log('🗑️  Deleting keys:', keys.join(', '));
    const startTime = Date.now();
    
    const results = await Promise.all(
      keys.map(key => redis.del(key))
    );
    
    const duration = Date.now() - startTime;
    const deletedCount = results.reduce((sum, count) => sum + count, 0);
    
    console.log(`✅ Deleted ${deletedCount} keys in ${duration}ms`);
    
    await redis.quit();
    console.log('👋 Disconnected from Redis');
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Get parameters from command line
const args = process.argv.slice(2);
const phone = args[0] || '79001234567';
const companyId = args[1] ? parseInt(args[1]) : 962302;

clearContext(phone, companyId);