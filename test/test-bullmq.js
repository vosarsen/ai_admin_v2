// test/test-bullmq.js
require('dotenv').config();
const { Queue } = require('bullmq');

async function testBullMQ() {
  console.log('Testing BullMQ...');
  
  const connection = {
    host: '127.0.0.1',
    port: 6379,
    password: process.env.REDIS_PASSWORD
  };
  
  try {
    // Create queue
    const queue = new Queue('test-queue', { connection });
    console.log('✅ Queue created successfully');
    
    // Add a job
    const job = await queue.add('test-job', {
      message: 'Hello BullMQ!',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Job added successfully:', job.id);
    
    // Check queue status
    const waiting = await queue.getWaitingCount();
    console.log('📊 Waiting jobs:', waiting);
    
    // Clean up
    await queue.close();
    console.log('✅ Queue closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBullMQ();