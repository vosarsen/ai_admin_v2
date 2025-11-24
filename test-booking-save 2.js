#!/usr/bin/env node

/**
 * Тест сохранения записи без показа номера клиенту
 */

const axios = require('axios');

async function testBookingMessage() {
  const phone = '79001234567';
  const message = 'хочу записаться к Сергею завтра на 3 часа дня';
  
  const url = 'http://localhost:3000/webhook/whatsapp/batched';
  
  try {
    console.log('📱 Отправка сообщения от:', phone);
    console.log('💬 Сообщение:', message);
    
    const response = await axios.post(url, {
      messages: [{
        id: { id: Date.now().toString() },
        from: phone + '@c.us',
        type: 'chat',
        body: message,
        timestamp: Date.now()
      }]
    });
    
    console.log('✅ Ответ сервера:', response.status);
    console.log('📝 Данные:', response.data);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

// Запуск теста
testBookingMessage();