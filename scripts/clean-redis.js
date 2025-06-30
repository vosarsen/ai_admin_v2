// scripts/clean-redis.js
/**
 * Clean Redis database - USE WITH CAUTION
 */

const Redis = require('ioredis');
const config = require('../src/config');

const redis = new Redis(config.redis.url);

async function cleanRedis() {
  console.log('🧹 Redis Cleanup Tool');
  console.log('====================\n');
  
  // Get current stats
  const dbSize = await redis.dbsize();
  console.log(`Current keys in database: ${dbSize}\n`);
  
  if (dbSize === 0) {
    console.log('✅ Database is already empty');
    process.exit(0);
  }
  
  // Show what will be deleted
  const keys = await redis.keys('*');
  const keyTypes = {};
  
  for (const key of keys.slice(0, 10)) {
    const type = key.split(':')[0];
    keyTypes[type] = (keyTypes[type] || 0) + 1;
  }
  
  console.log('Key types to be deleted:');
  Object.entries(keyTypes).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}+ keys`);
  });
  
  // Confirm deletion
  console.log('\n⚠️  WARNING: This will delete ALL Redis data!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Clean database
  console.log('🗑️  Flushing database...');
  await redis.flushdb();
  
  const newSize = await redis.dbsize();
  console.log(`\n✅ Database cleaned. Current keys: ${newSize}`);
  
  await redis.quit();
}

// Run cleanup
cleanRedis().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});