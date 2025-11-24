#!/usr/bin/env node

const axios = require('axios');
const logger = require('./src/utils/logger');

const API_URL = 'http://46.149.70.219:3000';
const TEST_PHONE = '79001234567';
const TEST_MESSAGES = [
  'Хочу перенести запись',
  'Перенести на завтра в 16:00',
  'Можно изменить время записи?'
];

async function sendTestMessage(message) {
  try {
    logger.info(`📤 Sending: "${message}"`);
    
    const response = await axios.post(`${API_URL}/webhook/whatsapp`, {
      event: 'message',
      instanceId: 'test-instance',
      data: {
        from: `${TEST_PHONE}@c.us`,
        to: '79686484488@c.us',
        body: message,
        type: 'chat',
        timestamp: Date.now()
      }
    });
    
    logger.info('✅ Response received:', response.data);
    return response.data;
  } catch (error) {
    logger.error('❌ Error:', error.message);
    if (error.response) {
      logger.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function runTests() {
  logger.info('🧪 Starting RESCHEDULE_BOOKING command tests...\n');
  
  for (const message of TEST_MESSAGES) {
    logger.info(`\n${'='.repeat(50)}`);
    await sendTestMessage(message);
    
    // Ждем 3 секунды между сообщениями
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  logger.info('\n✅ All tests completed!');
}

runTests()
  .then(() => process.exit(0))
  .catch(error => {
    logger.error('Test failed:', error);
    process.exit(1);
  });