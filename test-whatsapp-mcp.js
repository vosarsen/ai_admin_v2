#!/usr/bin/env node

import crypto from 'crypto';

const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = 'sk_venom_webhook_3553';
const PHONE = '79001234567';
const MESSAGE = 'Привет! Какие услуги у вас есть?';

async function testMCPFormat() {
  // Test correct format
  const webhookPayload = {
    from: PHONE,
    message: MESSAGE,
    timestamp: Date.now()
  };

  // Create signature
  const timestamp = Date.now().toString();
  const method = 'POST';
  const path = '/webhook/whatsapp';
  const body = JSON.stringify(webhookPayload);
  const payload = `${method}:${path}:${timestamp}:${body}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

  console.log('📤 Sending to:', `${API_URL}/webhook/whatsapp`);
  console.log('📝 Payload:', webhookPayload);
  console.log('🔐 Signature:', signature);

  try {
    const response = await fetch(`${API_URL}/webhook/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-timestamp': timestamp
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log('📥 Response status:', response.status, response.statusText);
    const responseData = await response.json();
    console.log('📥 Response data:', responseData);

    if (response.ok) {
      console.log('✅ Success! Message sent to WhatsApp bot');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMCPFormat();