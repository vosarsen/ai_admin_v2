#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = process.env.SECRET_KEY || 'defaultSecretKey123';
const COMPANY_ID = 962302;

// Генерация HMAC подписи
function generateSignature(payload, timestamp) {
  const method = 'POST';
  const path = '/webhook/whatsapp/ai-admin';
  const body = JSON.stringify(payload);
  const signaturePayload = `${method}:${path}:${timestamp}:${body}`;
  
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(signaturePayload)
    .digest('hex');
}

async function sendToWebhook(messages) {
  const payload = {
    messages: messages.map(msg => ({
      from: '79001234567',
      body: msg,
      type: 'chat',
      timestamp: new Date().toISOString()
    })),
    companyId: COMPANY_ID
  };

  const timestamp = Date.now().toString();
  const signature = generateSignature(payload, timestamp);

  try {
    const response = await axios.post(
      `${API_URL}/webhook/whatsapp/ai-admin`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp
        }
      }
    );
    
    console.log('✅ Webhook response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Webhook error:', error.response?.data || error.message);
    return null;
  }
}

async function testRapidFire() {
  console.log('🚀 Testing rapid-fire protection with new webhook...\n');
  
  // Отправляем сообщения по частям
  const messages = [
    'Привет,',
    'запишите',
    'меня на',
    'стрижку',
    'к Бари',
    'на завтра',
    'в 8',
    'вечера'
  ];
  
  console.log('📤 Sending messages separately with small delays...');
  
  for (let i = 0; i < messages.length; i++) {
    console.log(`\n[${i + 1}/${messages.length}] Sending: "${messages[i]}"`);
    
    await sendToWebhook([messages[i]]);
    
    // Небольшая задержка между сообщениями (меньше 5 секунд)
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n⏳ Waiting for processing...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('\n✅ Test completed!');
  console.log('\n📝 Check server logs to see if messages were combined:');
  console.log('ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep -E \\"Rapid-fire|Processing rapid-fire\\""');
}

testRapidFire().catch(console.error);