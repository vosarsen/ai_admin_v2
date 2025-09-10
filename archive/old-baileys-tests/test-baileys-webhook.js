#!/usr/bin/env node

const crypto = require('crypto');
const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const SECRET_KEY = process.env.SECRET_KEY || process.env.VENOM_SECRET_KEY || 'your-secret-key-here';

async function sendMessage(phone, message, companyId = 962302) {
  try {
    const endpoint = '/webhook/whatsapp/baileys';
    const url = `${API_URL}${endpoint}`;
    const timestamp = Date.now().toString();
    
    const body = {
      phone: phone.toString(),
      message: message,
      company_id: companyId,
      action: 'incoming_message' // Simulate incoming message
    };
    
    // Calculate signature
    const method = 'POST';
    const bodyStr = JSON.stringify(body);
    const payload = `${method}:${endpoint}:${timestamp}:${bodyStr}`;
    
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payload)
      .digest('hex');
    
    console.log('📤 Sending message to webhook...');
    console.log('URL:', url);
    console.log('Phone:', phone);
    console.log('Message:', message);
    console.log('Timestamp:', timestamp);
    
    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-timestamp': timestamp
      }
    });
    
    console.log('✅ Response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Main execution
async function main() {
  const phone = process.argv[2] || '79001234567';
  const message = process.argv[3] || 'Привет! Хочу записаться на стрижку завтра в 15:00';
  
  console.log('🚀 Testing Baileys webhook...');
  console.log('================================');
  
  try {
    await sendMessage(phone, message);
    console.log('================================');
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.log('================================');
    console.log('❌ Test failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendMessage };