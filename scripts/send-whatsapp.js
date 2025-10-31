#!/usr/bin/env node

import crypto from 'crypto';

const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = 'sk_venom_webhook_3553';

async function sendMessage(phone, message) {
  const webhookPayload = {
    from: phone,
    message: message,
    timestamp: Date.now()
  };

  // Create signature
  const timestamp = Date.now().toString();
  const method = 'POST';
  const path = '/webhook/whatsapp';
  const body = JSON.stringify(webhookPayload);
  const payload = `${method}:${path}:${timestamp}:${body}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

  console.log(`📤 Отправляю: "${message}" на номер ${phone}`);

  try {
    const response = await fetch(`${API_URL}/webhook/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-timestamp': timestamp
      },
      body: body
    });

    const responseData = await response.json();
    
    if (response.ok) {
      console.log(`✅ Успешно отправлено! Job ID: ${responseData.jobId}`);
      return responseData;
    } else {
      console.error(`❌ Ошибка: ${responseData.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
    return null;
  }
}

// Получаем параметры из командной строки
const args = process.argv.slice(2);
const phone = args[0] || '79001234567';
const message = args[1] || 'Привет! Сколько стоит стрижка?';

sendMessage(phone, message);