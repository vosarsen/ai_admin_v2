#!/usr/bin/env node

/**
 * Тестирование ReAct на сервере через WhatsApp API
 */

const axios = require('axios');

const API_URL = 'https://ai-admin-api.veritas-agency.ru/webhook/whatsapp/direct';
const SECRET_KEY = 'BvdqVMCLDBgdBOwrQR23Daf1n9u5v3K6D5NRhCqvmBvwQXDzUdMhQmNudxJqGqJG';

async function sendTestMessage(message) {
  try {
    const payload = {
      from: '79001234567@c.us',
      body: message,
      timestamp: Date.now()
    };
    
    const response = await axios.post(API_URL, payload, {
      headers: {
        'X-Secret-Key': SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Sent: "${message}"`);
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error(`❌ Error:`, error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing ReAct pattern on server...\n');
  
  const tests = [
    {
      message: 'Запиши меня на стрижку сегодня в 19:00',
      description: 'Тест записи на конкретное время',
      wait: 10000
    },
    {
      message: 'Запиши меня на стрижку сегодня в 17:00',
      description: 'Тест записи на занятое время',
      wait: 10000
    },
    {
      message: 'Какое время свободно на стрижку завтра?',
      description: 'Тест запроса доступных слотов',
      wait: 10000
    }
  ];
  
  for (const test of tests) {
    console.log('\n' + '='.repeat(60));
    console.log(`📝 ${test.description}`);
    console.log('Message:', test.message);
    console.log('='.repeat(60));
    
    await sendTestMessage(test.message);
    
    console.log(`⏳ Waiting ${test.wait/1000}s for processing...`);
    await new Promise(resolve => setTimeout(resolve, test.wait));
  }
  
  console.log('\n✅ All tests sent! Check logs with:');
  console.log('ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100"');
}

runTests();