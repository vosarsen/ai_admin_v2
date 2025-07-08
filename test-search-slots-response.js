// Test to reproduce the "Укажите, пожалуйста, услугу и мастера" issue
require('dotenv').config();
const messageQueue = require('./src/queue/message-queue');
const logger = require('./src/utils/logger');

async function testSearchSlotsResponse() {
  logger.info('🧪 Testing search_slots response generation...');
  
  const testCases = [
    {
      name: 'Basic booking request',
      message: 'Хочу записаться',
      from: '79999999999'
    },
    {
      name: 'Booking with service only',
      message: 'Хочу записаться на стрижку',
      from: '79999999998'
    },
    {
      name: 'Booking with date',
      message: 'Запишите меня завтра',
      from: '79999999997'
    },
    {
      name: 'Vague booking request',
      message: 'Можно записаться?',
      from: '79999999996'
    }
  ];
  
  for (const testCase of testCases) {
    logger.info(`\n📝 Test case: ${testCase.name}`);
    logger.info(`📨 Message: "${testCase.message}"`);
    
    try {
      // Add message to queue
      const job = await messageQueue.addMessage({
        from: testCase.from,
        message: testCase.message,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Message queued with job ID: ${job.id}`);
      
      // Wait a bit to see the processing logs
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      logger.error(`❌ Error in test case "${testCase.name}":`, error);
    }
  }
  
  logger.info('\n🏁 Test completed. Check the logs above for responses.');
  
  // Keep process alive to see worker logs
  logger.info('⏳ Waiting 30 seconds to see all processing logs...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  process.exit(0);
}

// Run test
testSearchSlotsResponse().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});