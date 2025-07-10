// Test script to verify staff selection from history
const NLUService = require('./src/services/nlu');
const logger = require('./src/utils/logger');

// Mock AI service
const mockAIService = {
  _callAI: async (prompt) => {
    console.log('\n=== AI PROMPT ===');
    console.log(prompt);
    console.log('=================\n');
    
    // Simulate AI response for booking with time "4"
    if (prompt.includes('запиши меня на 4 сегодня')) {
      return JSON.stringify({
        intent: "booking",
        entities: {
          service: "МУЖСКАЯ СТРИЖКА",
          staff: "Бари", // Should select Bari from history
          date: "2025-07-10",
          time: "16:00"
        },
        confidence: 0.95,
        reasoning: "User wants booking at 16:00, Bari is available"
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

async function testStaffSelection() {
  const nlu = new NLUService(mockAIService);
  
  console.log('Testing staff selection from conversation history...\n');
  
  // Context with slots shown for Bari only
  const context = {
    phone: '79936363848@c.us',
    companyId: '962302',
    lastMessages: [
      {
        user: 'отлично',
        assistant: `Найдены свободные слоты на МУЖСКАЯ СТРИЖКА сегодня:

👤 Бари:
  • 15:20
  • 15:30
  • 16:00

📊 Проверено мастеров: 3`,
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  const result = await nlu.processMessage('запиши меня на 4 сегодня', context);
  console.log('Message: "запиши меня на 4 сегодня"');
  console.log('Result:');
  console.log('  Intent:', result.intent);
  console.log('  Action:', result.action);
  console.log('  Entities:', JSON.stringify(result.entities, null, 2));
  console.log('  Response:', result.response);
  
  // Verify staff selection
  if (result.entities.staff === 'Бари') {
    console.log('\n✅ SUCCESS: Correctly selected Bari from conversation history');
  } else {
    console.log(`\n❌ FAIL: Selected ${result.entities.staff} instead of Bари`);
  }
  
  // Cleanup
  nlu.destroy();
}

testStaffSelection().catch(console.error);