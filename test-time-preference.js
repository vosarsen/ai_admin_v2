// Test script to verify time preference handling
const NLUService = require('./src/services/nlu');
const ActionResolver = require('./src/services/nlu/action-resolver');
const logger = require('./src/utils/logger');

// Mock AI service
const mockAIService = {
  _callAI: async (prompt) => {
    console.log('\n=== AI PROMPT (partial) ===');
    console.log(prompt.substring(0, 500) + '...');
    console.log('========================\n');
    
    // Simulate AI response for "сегодня вечером"
    if (prompt.includes('хочу записаться сегодня вечером')) {
      return JSON.stringify({
        intent: "booking",
        entities: {
          service: null,
          staff: null,
          date: "2025-07-10",
          time: null,
          time_preference: "evening"
        },
        confidence: 0.9,
        reasoning: "User wants booking today evening - time preference not specific"
      });
    }
    
    return JSON.stringify({
      intent: "other", 
      entities: {},
      confidence: 0.9,
      reasoning: "Default response"
    });
  }
};

async function testTimePreference() {
  const nlu = new NLUService(mockAIService);
  const actionResolver = new ActionResolver();
  
  console.log('Testing time preference vs specific time...\n');
  
  // Test 1: Time preference (should be search_slots)
  const context1 = {
    phone: '79936363848@c.us',
    companyId: '962302',
    lastMessages: []
  };
  
  const result1 = await nlu.processMessage('хочу записаться сегодня вечером', context1);
  console.log('Test 1: "хочу записаться сегодня вечером"');
  console.log('  Intent:', result1.intent);
  console.log('  Action:', result1.action);
  console.log('  Entities:', JSON.stringify(result1.entities, null, 2));
  
  if (result1.action === 'search_slots') {
    console.log('✅ SUCCESS: Correctly determined search_slots for time preference');
  } else {
    console.log(`❌ FAIL: Got ${result1.action} instead of search_slots`);
  }
  
  console.log('\n---\n');
  
  // Test 2: Direct action resolver test
  const testParsed = {
    intent: 'booking',
    entities: {
      date: '2025-07-10',
      time: '18:00',
      staff: 'Рамзан',
      time_preference: 'evening'
    }
  };
  
  const action = actionResolver.determineAction(testParsed);
  console.log('Test 2: With time_preference present');
  console.log('  Entities:', JSON.stringify(testParsed.entities, null, 2));
  console.log('  Determined action:', action);
  
  if (action === 'search_slots') {
    console.log('✅ SUCCESS: ActionResolver correctly ignores booking with time_preference');
  } else {
    console.log('❌ FAIL: ActionResolver returned', action);
  }
  
  // Cleanup
  nlu.destroy();
}

testTimePreference().catch(console.error);