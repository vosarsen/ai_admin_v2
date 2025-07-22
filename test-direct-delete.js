const axios = require('axios');

const API_URL = 'http://46.149.70.219:3002';
const SECRET_KEY = '5jZ8kR3p9$vQ@mN7';

const headers = {
  'Content-Type': 'application/json',
  'X-Secret-Key': SECRET_KEY
};

async function sendMessage(phone, message) {
  try {
    console.log(`\n📱 ${phone}: "${message}"`);
    
    const response = await axios.post(`${API_URL}/webhook`, {
      messages: [{
        phone: phone + '@c.us',
        body: message,
        fromMe: false,
        type: 'message'
      }]
    }, { headers });

    console.log('✅ Sent successfully');
    
    // Ждем обработки и ответа
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

async function testDirectDelete() {
  console.log('🧪 Testing Direct Delete with Record ID');
  console.log('=======================================\n');

  // Отправляем команду с известным ID записи
  await sendMessage('79001234567', 'Отмени запись номер 1199065365');
  
  console.log('\n✅ Test completed');
  console.log('\n📋 Check logs for results:');
  console.log('ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"');
}

// Запускаем тест
testDirectDelete().catch(console.error);