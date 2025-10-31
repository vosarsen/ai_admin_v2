#!/usr/bin/env node

const crypto = require('crypto');

async function sendTestMessage(message = "Привет! Хочу записаться на стрижку завтра в 15:00") {
  const timestamp = Date.now();
  const method = 'POST';
  const path = '/webhook/whatsapp/batched';
  const secret = 'sk_venom_webhook_3553';
  
  const messageData = {
    from: '79686484488@c.us', // Тестовый номер
    message: message,
    timestamp: timestamp
  };
  
  const body = JSON.stringify(messageData);
  const payload = `${method}:${path}:${timestamp}:${body}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
  console.log('📤 Sending test message:', message);
  console.log('From:', messageData.from);
  
  try {
    const response = await fetch('http://46.149.70.219:3000/webhook/whatsapp/batched', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature
      },
      body: body
    });
    
    const result = await response.json();
    console.log('✅ Response:', result);
    
    if (result.success) {
      console.log('\n⏳ Message added to batch. Wait 10 seconds for processing...');
      console.log('Check logs with: ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get message from command line or use default
const message = process.argv[2] || "Привет! Хочу записаться на стрижку завтра в 15:00";
sendTestMessage(message);