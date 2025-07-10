// Test script to verify context-aware responses
const NLUService = require('./src/services/nlu');
const logger = require('./src/utils/logger');

// Mock AI service
const mockAIService = {
  _callAI: async (prompt) => {
    console.log('\n=== AI PROMPT ===');
    console.log(prompt);
    console.log('=================\n');
    
    // Simulate AI response based on message
    if (prompt.includes('"отлично"')) {
      return JSON.stringify({
        intent: "other",
        entities: {},
        confidence: 0.8,
        reasoning: "User acknowledged previous message"
      });
    }
    
    return JSON.stringify({
      intent: "other", 
      entities: {},
      confidence: 0.9,
      reasoning: "Greeting detected"
    });
  }
};

async function testContextualResponses() {
  const nlu = new NLUService(mockAIService);
  
  console.log('Testing contextual responses...\n');
  
  // Test 1: First message (no context)
  const context1 = {
    phone: '79936363848@c.us',
    companyId: '962302',
    lastMessages: []
  };
  
  const result1 = await nlu.processMessage('привет', context1);
  console.log('Message 1: "привет"');
  console.log('Response:', result1.response);
  console.log('Intent:', result1.intent);
  console.log('Action:', result1.action);
  
  // Test 2: Second message (with context)
  const context2 = {
    phone: '79936363848@c.us',
    companyId: '962302',
    lastMessages: [{
      user: 'привет',
      assistant: 'Здравствуйте! Я помогу вам записаться на услуги. Скажите, на какую дату и время вы хотели бы записаться?',
      timestamp: new Date().toISOString()
    }]
  };
  
  console.log('\n---\n');
  const result2 = await nlu.processMessage('отлично', context2);
  console.log('Message 2: "отлично"');
  console.log('Response:', result2.response);
  console.log('Intent:', result2.intent);
  console.log('Action:', result2.action);
  
  // Cleanup
  nlu.destroy();
}

testContextualResponses().catch(console.error);