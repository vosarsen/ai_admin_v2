// Патч для исправления Venom Bot webhook с подписью
const crypto = require('crypto');

// Функция для генерации подписи webhook
function generateWebhookSignature(method, path, timestamp, body, secret) {
  const payload = `${method}:${path}:${timestamp}:${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Исправленный код отправки webhook
async function sendWebhookWithSignature(messageData) {
  try {
    const timestamp = Date.now();
    const method = 'POST';
    const path = '/webhook/whatsapp';
    const body = JSON.stringify(messageData);
    const secret = 'sk_venom_webhook_3553'; // Тот же что в .env
    
    const signature = generateWebhookSignature(method, path, timestamp, body, secret);
    
    const response = await fetch('http://localhost:3000/webhook/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature
      },
      body: body
    });

    console.log(`📨 Message forwarded with signature: ${messageData.from} -> AI Admin`);
    return response;
  } catch (error) {
    console.error('❌ Error forwarding message:', error);
    throw error;
  }
}

// Заменить в client.onMessage:
// client.onMessage(async (message) => {
//   await sendWebhookWithSignature({
//     from: message.from,
//     message: message.body,
//     timestamp: message.timestamp
//   });
// });