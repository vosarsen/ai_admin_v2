// scripts/test-flow.js
/**
 * Test script to verify the complete flow
 */

const axios = require('axios');
const config = require('../src/config');

const API_URL = `http://localhost:${config.app.port}`;

async function testFlow() {
  console.log('🧪 Testing AI Admin MVP Flow\n');
  
  try {
    // 1. Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const health = await axios.get(`${API_URL}/health`);
    console.log(`✅ Health status: ${health.data.status}`);
    console.log(`   WhatsApp: ${health.data.services.whatsapp}`);
    console.log(`   Redis: ${health.data.services.redis}\n`);
    
    // 2. Test webhook with booking request
    console.log('2️⃣ Testing booking request...');
    const bookingRequest = await axios.post(`${API_URL}/webhook/whatsapp`, {
      from: '79999999999@c.us',
      message: 'Здравствуйте! Хочу записаться на стрижку к Саше завтра в 15:00',
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Message queued: ${bookingRequest.data.queued}`);
    console.log(`   Job ID: ${bookingRequest.data.jobId}\n`);
    
    // 3. Wait for processing
    console.log('⏳ Waiting 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Check queue metrics
    console.log('3️⃣ Checking queue metrics...');
    const metrics = await axios.get(`${API_URL}/api/metrics?companyId=${config.yclients.companyId}`);
    console.log(`✅ Queue metrics:`);
    console.log(`   Completed: ${metrics.data.metrics.completed}`);
    console.log(`   Failed: ${metrics.data.metrics.failed}`);
    console.log(`   Active: ${metrics.data.metrics.active}\n`);
    
    // 5. Test info request
    console.log('4️⃣ Testing info request...');
    const infoRequest = await axios.post(`${API_URL}/webhook/whatsapp`, {
      from: '79999999999@c.us',
      message: 'Сколько стоит мужская стрижка?',
      timestamp: new Date().toISOString()
    });
    console.log(`✅ Info request queued: ${infoRequest.data.jobId}\n`);
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
testFlow();