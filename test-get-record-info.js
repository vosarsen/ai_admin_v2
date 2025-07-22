#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const logger = require('./src/utils/logger');

// Конфигурация
const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_BEARER_TOKEN,
  userToken: process.env.YCLIENTS_USER_TOKEN || '16e0dffa0d71350dcb83381e03e7af29',
  partnerId: process.env.YCLIENTS_PARTNER_ID || '8444'
};

// Тестовые данные
const recordId = 1199484063;
const recordHash = 'fb469b3be1c74f599c46e6cf5c88ba72';

async function testGetUserRecord() {
  try {
    logger.info('🧪 Testing GET user record...');
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.yclients.v2+json',
      'Authorization': `Bearer ${config.bearerToken}, User ${config.userToken}`,
      'X-Partner-Id': config.partnerId
    };
    
    const url = `${config.baseUrl}/user/records/${recordId}/${recordHash}`;
    
    logger.info('URL:', url);
    logger.info('Headers:', JSON.stringify(headers, null, 2));
    
    const response = await axios.get(url, { headers });
    
    logger.info('✅ Success! Record info:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      logger.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      logger.error('❌ Network Error:', error.message);
    }
  }
}

// Запускаем тест
testGetUserRecord()
  .then(() => {
    logger.info('✅ Test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  });