#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Конфигурация
const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = 'sk_venom_webhook_3553';
const PHONE = '79001234567';
const COMPANY_ID = 962302;

async function sendTestMessage(message) {
  try {
    // Подготовка данных webhook в правильном формате
    const webhookData = {
      from: PHONE,
      message: message,
      timestamp: new Date().toISOString()
    };

    // Создание timestamp
    const timestamp = Date.now();
    
    // Создание подписи HMAC по формату из webhook-auth.js
    const method = 'POST';
    const path = '/webhook/whatsapp';
    const body = JSON.stringify(webhookData);
    const payload = `${method}:${path}:${timestamp}:${body}`;
    
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payload)
      .digest('hex');

    // Отправка webhook
    console.log(`📤 Отправка сообщения: "${message}"`);
    
    const response = await axios.post(
      `${API_URL}/webhook/whatsapp`,
      webhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': signature,
          'x-timestamp': timestamp.toString()
        }
      }
    );

    console.log('✅ Webhook отправлен успешно');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('❌ Ошибка отправки webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Получение сообщения из аргументов или использование дефолтного
const message = process.argv[2] || 'хочу записаться';

// Отправка тестового сообщения
sendTestMessage(message);