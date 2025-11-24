require('dotenv').config();
const Redis = require('ioredis');

async function checkBatches() {
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0
  });

  try {
    console.log('Checking Redis batches...');
    
    const keys = await redis.keys('rapid-fire:*');
    console.log('\nFound', keys.length, 'batch keys:');
    
    for (const key of keys) {
      const size = await redis.llen(key);
      const ttl = await redis.ttl(key);
      const lastMsgKey = key.replace('rapid-fire:', 'last-msg:');
      const lastMsgTime = await redis.get(lastMsgKey);
      
      console.log(`\n  Key: ${key}`);
      console.log(`  Size: ${size} messages`);
      console.log(`  TTL: ${ttl} seconds`);
      if (lastMsgTime) {
        const idleTime = Date.now() - parseInt(lastMsgTime);
        console.log(`  Idle time: ${idleTime}ms`);
      }
    }
    
    await redis.quit();
  } catch (err) {
    console.error('Error:', err);
    await redis.quit();
  }
}

checkBatches();