// Test to verify the search_slots duplicate message fix
require('dotenv').config();
const logger = require('./src/utils/logger');
const aiService = require('./src/services/ai');
const contextService = require('./src/services/context');

async function testSearchSlotsFix() {
  logger.info('🧪 Testing search_slots duplicate message fix...');
  
  const testCases = [
    {
      name: 'Basic booking request',
      message: 'Хочу записаться',
      expectedAction: 'search_slots',
      shouldHaveResponse: false
    },
    {
      name: 'Booking with service',
      message: 'Хочу записаться на стрижку',
      expectedAction: 'search_slots',
      shouldHaveResponse: false
    },
    {
      name: 'Booking with date',
      message: 'Запишите меня завтра',
      expectedAction: 'search_slots',
      shouldHaveResponse: false
    },
    {
      name: 'Complete booking info',
      message: 'Запишите меня к Бари завтра в 15:00',
      expectedAction: 'create_booking',
      shouldHaveResponse: true
    },
    {
      name: 'Information request',
      message: 'Какие цены на стрижку?',
      expectedAction: 'get_info',
      shouldHaveResponse: true
    }
  ];
  
  // Create mock context
  const mockContext = {
    phone: '79999999999',
    companyId: '123456',
    client: { name: 'Test User' },
    services: [
      { title: 'Стрижка', price_min: 1500, duration: 30 },
      { title: 'Стрижка бороды', price_min: 800, duration: 20 }
    ],
    staff: [
      { name: 'Бари', specialization: 'Барбер' },
      { name: 'Сергей', specialization: 'Барбер' }
    ],
    lastMessages: []
  };
  
  for (const testCase of testCases) {
    logger.info(`\n📝 Test case: ${testCase.name}`);
    logger.info(`📨 Message: "${testCase.message}"`);
    
    try {
      // Process message with AI
      const result = await aiService.processMessage(testCase.message, mockContext);
      
      logger.info('🤖 AI Result:', {
        success: result.success,
        action: result.action,
        response: result.response,
        entities: result.entities
      });
      
      // Verify results
      const actionCorrect = result.action === testCase.expectedAction;
      const responseCorrect = testCase.shouldHaveResponse ? 
        (result.response !== null && result.response !== undefined) : 
        (result.response === null || result.response === undefined);
      
      if (actionCorrect && responseCorrect) {
        logger.info(`✅ PASSED: Action=${result.action}, Response=${result.response ? 'present' : 'null'}`);
      } else {
        logger.error(`❌ FAILED:`);
        if (!actionCorrect) {
          logger.error(`   Expected action: ${testCase.expectedAction}, got: ${result.action}`);
        }
        if (!responseCorrect) {
          logger.error(`   Expected response: ${testCase.shouldHaveResponse ? 'present' : 'null'}, got: ${result.response}`);
        }
      }
      
    } catch (error) {
      logger.error(`❌ Error in test case "${testCase.name}":`, error.message);
    }
  }
  
  logger.info('\n🏁 Test completed.');
}

// Run test
testSearchSlotsFix().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});