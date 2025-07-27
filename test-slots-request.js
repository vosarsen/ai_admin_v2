const axios = require('axios');

const message = {
  id: '3AEB055F82CA2ABC2FF7' + Date.now(),
  rowId: '3AEB055F82CA2ABC2FF7' + Date.now(),
  body: 'какие есть слоты на завтра?',
  from: '79001234567@c.us',
  to: '79686484488@c.us',
  author: null,
  chatId: '79001234567@c.us',
  fromMe: false,
  type: 'chat',
  isGroupMsg: false,
  quotedMsg: null,
  timestamp: Math.floor(Date.now() / 1000),
  verifiedBizName: null,
  chatName: 'Тестовый клиент'
};

const secret = process.env.VENOM_SECRET_KEY || 'sk_venom_webhook_3553';

const send = async () => {
  try {
    console.log('📤 Отправляю сообщение:', message.body);
    
    const response = await axios.post('http://46.149.70.219:3005/webhook/whatsapp/batched', message, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': secret
      }
    });
    
    console.log('✅ Webhook отправлен:', response.status);
    console.log('📥 Ответ:', response.data);
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
};

send();
