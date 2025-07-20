#!/usr/bin/env node

import crypto from 'crypto';
// Use native fetch (available in Node.js 18+)

const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = 'sk_venom_webhook_3553';
const PHONE = '79001234567';
const MESSAGE = 'Привет! Хочу записаться на стрижку';

function createWebhookSignature(data) {
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
}

async function sendMessage() {
  const webhookData = {
    event: 'message',
    instanceId: 'test-instance',
    data: {
      pushName: 'Test User',
      message: {
        id: `test_msg_${Date.now()}`,
        body: MESSAGE,
        type: 'chat',
        t: Math.floor(Date.now() / 1000),
        from: `${PHONE}@c.us`,
        to: '962302@c.us',
        isGroupMsg: false
      }
    }
  };

  console.log('Sending webhook to:', `${API_URL}/api/webhooks/whatsapp`);
  console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

  try {
    const response = await fetch(`${API_URL}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': createWebhookSignature(webhookData)
      },
      body: JSON.stringify(webhookData)
    });

    console.log('Response status:', response.status, response.statusText);
    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      throw new Error(`Failed: ${response.statusText} - ${responseText}`);
    }

    console.log('✅ Message sent successfully!');
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
  }
}

sendMessage();