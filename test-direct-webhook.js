const axios = require('axios');
const crypto = require('crypto');

async function testBookingTomorrow() {
    const webhook = {
        from: '79001234567',
        message: 'Хочу записаться на завтра',
        timestamp: Date.now()
    };

    // Create signature
    const timestamp = Date.now().toString();
    const secretKey = 'sk_venom_webhook_3553';
    const method = 'POST';
    const path = '/webhook/whatsapp';
    const body = JSON.stringify(webhook);
    const payload = `${method}:${path}:${timestamp}:${body}`;
    const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

    try {
        console.log('📤 Отправляю сообщение:', webhook.message);
        
        const response = await axios.post('http://46.149.70.219:3000/webhook/whatsapp', webhook, {
            headers: { 
                'Content-Type': 'application/json',
                'x-signature': signature,
                'x-timestamp': timestamp
            }
        });
        
        console.log('✅ Webhook отправлен:', response.status);
        console.log('📥 Ответ:', response.data);
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
    }
}

// Запускаем тест
testBookingTomorrow();