#!/usr/bin/env node

/**
 * Clear BullMQ message queue
 * ОСТОРОЖНО: Удаляет все задачи из очереди!
 */

const { Queue } = require('bullmq');
const { createRedisClient } = require('../src/utils/redis-factory');

async function clearQueue() {
  const redis = createRedisClient('queue-clear');

  const messageQueue = new Queue('message-processing', {
    connection: redis
  });

  console.log('📊 Checking queue status...');

  const counts = await messageQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  console.log('Current queue status:', counts);

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log(`Total jobs: ${total}`);

  if (total === 0) {
    console.log('✅ Queue is already empty');
    await redis.quit();
    process.exit(0);
  }

  console.log('\n⚠️  WARNING: This will delete ALL jobs from the queue!');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🗑️  Clearing queue...');

  // Clean all job states
  await messageQueue.obliterate({ force: true });

  console.log('✅ Queue cleared successfully!');

  // Verify
  const newCounts = await messageQueue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  console.log('New queue status:', newCounts);

  await redis.quit();
  process.exit(0);
}

clearQueue().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
