#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const logger = require('./src/utils/logger');

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_BEARER_TOKEN,
  userToken: process.env.YCLIENTS_USER_TOKEN || '16e0dffa0d71350dcb83381e03e7af29',
  partnerId: process.env.YCLIENTS_PARTNER_ID || '8444',
  companyId: 962302
};

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.yclients.v2+json',
  'Authorization': `Bearer ${config.bearerToken}, User ${config.userToken}`,
  'X-Partner-Id': config.partnerId
};

async function testEndpoint(method, endpoint, description, data = null) {
  try {
    logger.info(`\n🧪 Testing: ${description}`);
    logger.info(`${method} ${endpoint}`);
    
    const url = `${config.baseUrl}${endpoint}`;
    const requestConfig = { headers };
    
    let response;
    switch (method) {
      case 'GET':
        response = await axios.get(url, requestConfig);
        break;
      case 'POST':
        response = await axios.post(url, data, requestConfig);
        break;
      case 'PUT':
        response = await axios.put(url, data, requestConfig);
        break;
      case 'DELETE':
        response = await axios.delete(url, requestConfig);
        break;
    }
    
    logger.info(`✅ Success! Status: ${response.status}`);
    if (response.data?.data) {
      logger.info(`Data sample:`, JSON.stringify(response.data.data).slice(0, 200) + '...');
    }
    return true;
  } catch (error) {
    if (error.response) {
      logger.error(`❌ Failed! Status: ${error.response.status} - ${error.response.data?.meta?.message || error.response.statusText}`);
    } else {
      logger.error(`❌ Network error: ${error.message}`);
    }
    return false;
  }
}

async function runTests() {
  logger.info('🔍 Testing YClients API capabilities with current credentials...\n');
  
  const tests = [
    // Booking endpoints (known to work)
    ['GET', `/book_services/${config.companyId}`, 'Get services (booking)'],
    ['GET', `/book_times/${config.companyId}/2025-07-23`, 'Get time slots (booking)'],
    
    // Record management
    ['GET', `/records/${config.companyId}?client_phone=79001234567`, 'Get client records'],
    ['GET', `/record/${config.companyId}/1199516451`, 'Get specific record'],
    ['DELETE', `/record/${config.companyId}/1199516451`, 'Delete record (admin)'],
    ['PUT', `/record/${config.companyId}/1199516451`, 'Update record', { attendance: -1 }],
    
    // Visit management
    ['GET', `/visits/1199516451`, 'Get visit info'],
    ['PUT', `/visits/1199516451/1199516451`, 'Update visit status', { attendance: 2 }],
    
    // Staff and company
    ['GET', `/staff/${config.companyId}`, 'Get staff list'],
    ['GET', `/company/${config.companyId}`, 'Get company info'],
    
    // Client management
    ['POST', `/clients/search/${config.companyId}`, 'Search clients', { search_term: '79001234567' }],
    ['GET', `/clients/${config.companyId}`, 'Get clients list']
  ];
  
  const results = [];
  for (const [method, endpoint, description, data] of tests) {
    const success = await testEndpoint(method, endpoint, description, data);
    results.push({ description, success });
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  logger.info('\n📊 Summary:');
  logger.info('✅ Working endpoints:');
  results.filter(r => r.success).forEach(r => logger.info(`  - ${r.description}`));
  
  logger.info('\n❌ Failed endpoints:');
  results.filter(r => !r.success).forEach(r => logger.info(`  - ${r.description}`));
}

runTests()
  .then(() => {
    logger.info('\n✅ Testing completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('\n❌ Test failed:', error);
    process.exit(1);
  });