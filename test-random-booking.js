#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Генерируем рандомный номер телефона
const randomPhone = '7900' + Math.floor(Math.random() * 9000000 + 1000000);
const randomName = ['Василий', 'Петр', 'Николай', 'Александр', 'Дмитрий'][Math.floor(Math.random() * 5)];

console.log(`📱 Отправка тестового сообщения от ${randomPhone} с именем ${randomName}`);

const webhookUrl = 'http://46.149.70.219:3000/webhook/whatsapp';
const secretKey = process.env.SECRET_KEY || 'ef2e34ba82ed1e8edb0e83b0c03e3f6a01a96b8d49c8d5b8f4e8b2a5c7d9e3f2';

// Функция для генерации HMAC подписи
function generateSignature(payload, secret) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

async function sendTestMessage() {
  try {
    // Сначала отправляем запрос на запись
    const message1 = `Хочу записаться к Сергею завтра в 15:00`;
    const timestamp1 = Date.now();
    const payload1 = {
      from: `${randomPhone}@c.us`,
      message: message1,
      timestamp: new Date().toISOString()
    };
    
    // Создаем подпись как в webhook-auth.js
    const method = 'POST';
    const path = '/webhook/whatsapp';
    const body = JSON.stringify(payload1);
    const signaturePayload = `${method}:${path}:${timestamp1}:${body}`;
    const signature1 = crypto.createHmac('sha256', secretKey)
      .update(signaturePayload)
      .digest('hex');
    
    console.log('📤 Отправка первого сообщения:', message1);
    const response1 = await axios.post(webhookUrl, payload1, {
      headers: {
        'x-signature': signature1,
        'x-timestamp': timestamp1.toString(),
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Первое сообщение отправлено:', response1.data);
    
    // Ждем 2 секунды
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Теперь представляемся
    const message2 = `меня зовут ${randomName}`;
    const timestamp2 = Date.now();
    const payload2 = {
      from: `${randomPhone}@c.us`,
      message: message2,
      timestamp: new Date().toISOString()
    };
    
    // Создаем подпись как в webhook-auth.js
    const method2 = 'POST';
    const path2 = '/webhook/whatsapp';
    const body2 = JSON.stringify(payload2);
    const signaturePayload2 = `${method2}:${path2}:${timestamp2}:${body2}`;
    const signature2 = crypto.createHmac('sha256', secretKey)
      .update(signaturePayload2)
      .digest('hex');
    
    console.log('📤 Отправка второго сообщения:', message2);
    const response2 = await axios.post(webhookUrl, payload2, {
      headers: {
        'x-signature': signature2,
        'x-timestamp': timestamp2.toString(),
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Второе сообщение отправлено:', response2.data);
    
    console.log(`\n🔍 Проверьте логи: ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep ${randomPhone}"`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

sendTestMessage();