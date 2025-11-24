#!/usr/bin/env node

/**
 * Тест команд управления статусом посещения через WhatsApp
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('./src/utils/logger');

const config = {
  apiUrl: process.env.AI_ADMIN_API_URL || 'http://46.149.70.219:3000',
  secretKey: process.env.SECRET_KEY || 'your-secret-key',
  testPhone: '79001234567',
  companyId: 962302
};

// Генерация подписи для webhook
function generateSignature(data) {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', config.secretKey)
    .update(JSON.stringify(data))
    .digest('hex');
}

// Отправка тестового сообщения
async function sendTestMessage(message) {
  const webhookData = {
    event: 'message',
    instanceId: 'test-instance',
    data: {
      from: `${config.testPhone}@c.us`,
      to: '79686484488@c.us',
      body: message,
      type: 'chat',
      timestamp: Date.now()
    }
  };

  try {
    logger.info(`📤 Sending: "${message}"`);
    
    const response = await axios.post(
      `${config.apiUrl}/webhook/whatsapp`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(webhookData)
        },
        timeout: 30000
      }
    );

    if (response.status === 200) {
      logger.info('✅ Message processed successfully');
    }
  } catch (error) {
    if (error.response) {
      logger.error(`❌ API Error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
    } else {
      logger.error(`❌ Network Error: ${error.message}`);
    }
  }
}

// Тестовые сценарии
async function runTests() {
  logger.info('🧪 Testing attendance status commands...\n');

  const testCases = [
    {
      name: 'Подтверждение записи',
      messages: [
        'привет',
        'хочу подтвердить свою запись',
        'да, я приду'
      ]
    },
    {
      name: 'Отметка о неявке',
      messages: [
        'не смогу прийти на запись',
        'заболел, не приду',
        'опоздаю больше чем на 20 минут'
      ]
    },
    {
      name: 'Отмена записи',
      messages: [
        'хочу отменить запись',
        'отмените мою запись пожалуйста'
      ]
    }
  ];

  for (const testCase of testCases) {
    logger.info(`\n📋 Test: ${testCase.name}`);
    logger.info('─'.repeat(50));
    
    for (const message of testCase.messages) {
      await sendTestMessage(message);
      // Ждем 3 секунды между сообщениями
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Ждем 5 секунд между тестами
    logger.info('⏳ Waiting before next test...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Запуск тестов
runTests()
  .then(() => {
    logger.info('\n✅ All tests completed!');
    logger.info('\n📱 Check WhatsApp for bot responses');
    logger.info('📄 Check server logs: ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100"');
    process.exit(0);
  })
  .catch(error => {
    logger.error('\n❌ Test failed:', error);
    process.exit(1);
  });