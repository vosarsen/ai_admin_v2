#!/usr/bin/env node

/**
 * Clear old BullMQ queue keys from Redis
 * Удаляет старые ключи bull:company-*-messages:*
 */

const { createRedisClient } = require('../src/utils/redis-factory');

async function clearOldQueueKeys() {
  const redis = createRedisClient('queue-cleanup');

  console.log('📊 Searching for old queue keys...');

  // Find all old queue keys
  const queueKeys = await redis.keys('bull:company-*-messages:*');
  const rapidFireKeys = await redis.keys('rapid-fire:*');

  console.log(`Found ${queueKeys.length} queue keys`);
  console.log(`Found ${rapidFireKeys.length} rapid-fire keys`);

  const totalKeys = queueKeys.length + rapidFireKeys.length;

  if (totalKeys === 0) {
    console.log('✅ No old keys to clean');
    await redis.quit();
    process.exit(0);
  }

  console.log(`\n⚠️  WARNING: This will delete ${totalKeys} keys from Redis!`);
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🗑️  Deleting keys...');

  let deleted = 0;

  // Delete queue keys
  if (queueKeys.length > 0) {
    deleted += await redis.del(...queueKeys);
  }

  // Delete rapid-fire keys
  if (rapidFireKeys.length > 0) {
    deleted += await redis.del(...rapidFireKeys);
  }

  console.log(`✅ Deleted ${deleted} keys`);

  // Verify
  const remainingQueue = await redis.keys('bull:company-*-messages:*');
  const remainingRapid = await redis.keys('rapid-fire:*');

  console.log(`\nRemaining queue keys: ${remainingQueue.length}`);
  console.log(`Remaining rapid-fire keys: ${remainingRapid.length}`);

  await redis.quit();
  process.exit(0);
}

clearOldQueueKeys().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
