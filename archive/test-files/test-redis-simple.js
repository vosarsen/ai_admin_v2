// test-redis-simple.js
const { createRedisClient } = require('./src/utils/redis-factory');
const logger = require('./src/utils/logger');

async function testRedis() {
  process.env.NODE_ENV = 'production';
  
  const client = createRedisClient('test');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n=== Testing Redis Keys ===\n');
  
  // Test 1: All keys
  const allKeys = await client.keys('*');
  console.log(`Total keys: ${allKeys.length}`);
  
  // Test 2: Rapid-fire keys
  const rapidKeys = await client.keys('rapid-fire:*');
  console.log(`Rapid-fire keys: ${rapidKeys.length}`);
  if (rapidKeys.length > 0) {
    console.log('Examples:', rapidKeys.slice(0, 3));
  }
  
  // Test 3: Create and find
  const testKey = 'rapid-fire:+79686484488-test';
  await client.rpush(testKey, JSON.stringify({message: 'test'}));
  await client.expire(testKey, 60);
  
  const found = await client.keys('rapid-fire:*');
  console.log(`After creating test key, found: ${found.length} keys`);
  console.log('Keys:', found);
  
  const ttl = await client.ttl(testKey);
  console.log(`Test key TTL: ${ttl}`);
  
  await client.del(testKey);
  await client.quit();
}

testRedis().catch(console.error);