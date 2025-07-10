// Debug script to check context storage
const contextService = require('./index');
const logger = require('../../utils/logger');

async function debugContext() {
  const testPhone = '79936363848@c.us';
  const testCompanyId = '962302';
  
  console.log('\n=== Testing Context Service ===\n');
  
  // Get context
  const context = await contextService.getContext(testPhone, testCompanyId);
  console.log('Current context for', testPhone);
  console.log('Last messages:', context.lastMessages);
  console.log('Last messages count:', context.lastMessages?.length || 0);
  
  if (context.lastMessages && context.lastMessages.length > 0) {
    console.log('\nMessage history:');
    context.lastMessages.forEach((msg, index) => {
      console.log(`\n[${index + 1}] ${msg.timestamp}`);
      console.log(`User: ${msg.user}`);
      console.log(`Assistant: ${msg.assistant}`);
    });
  }
  
  // Test adding a message
  console.log('\n=== Testing message storage ===');
  await contextService.updateContext(testPhone, testCompanyId, {
    lastMessage: {
      user: 'Test message',
      assistant: 'Test response',
      timestamp: new Date().toISOString()
    }
  });
  
  // Get context again
  const updatedContext = await contextService.getContext(testPhone, testCompanyId);
  console.log('\nUpdated messages count:', updatedContext.lastMessages?.length || 0);
  
  process.exit(0);
}

debugContext().catch(console.error);