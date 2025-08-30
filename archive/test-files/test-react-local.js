#!/usr/bin/env node

/**
 * Тестирование ReAct локально через прямой вызов AI Admin
 */

const AIAdminService = require('./src/services/ai-admin-v2');

async function testReAct() {
  console.log('🚀 Testing ReAct pattern locally...\n');
  
  const tests = [
    {
      message: 'Запиши меня на стрижку сегодня в 19:00',
      description: 'Тест записи на конкретное время'
    },
    {
      message: 'Запиши меня на стрижку сегодня в 17:00',
      description: 'Тест записи на занятое время'
    },
    {
      message: 'Какое время свободно на стрижку завтра?',
      description: 'Тест запроса доступных слотов'
    }
  ];
  
  for (const test of tests) {
    console.log('='.repeat(60));
    console.log(`📝 ${test.description}`);
    console.log(`Message: ${test.message}`);
    console.log('='.repeat(60));
    
    try {
      const result = await AIAdminService.processMessage(
        test.message,
        '79001234567',
        962302 // company ID для тестов
      );
      
      console.log('✅ Response:', result.response);
      if (result.commands) {
        console.log('📊 Commands executed:', result.commands.length);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    console.log('\n');
  }
}

testReAct().catch(console.error);