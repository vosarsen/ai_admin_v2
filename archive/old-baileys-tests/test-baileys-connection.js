#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_URL = 'http://46.149.70.219:3000';
const COMPANY_ID = '962302';
const TEST_PHONE = '79686484488'; // Your test phone

async function testBaileysConnection() {
  try {
    console.log('🚀 Testing Baileys WhatsApp connection...');
    console.log('================================');
    
    // 1. Check current status
    console.log('📊 Checking current session status...');
    const statusResponse = await axios.get(`${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}`);
    console.log('Status:', JSON.stringify(statusResponse.data, null, 2));
    
    if (statusResponse.data.status?.connected) {
      console.log('✅ WhatsApp is connected!');
      
      // 2. Send test message
      console.log('\n📤 Sending test message...');
      const sendResponse = await axios.post(`${API_URL}/webhook/whatsapp/baileys/send`, {
        companyId: COMPANY_ID,
        phone: TEST_PHONE,
        message: 'Тестовое сообщение от Baileys! Бот работает корректно.'
      });
      
      console.log('Send response:', JSON.stringify(sendResponse.data, null, 2));
      
      // 3. Test webhook with incoming message simulation
      console.log('\n📨 Simulating incoming message...');
      const webhookResponse = await axios.post(`${API_URL}/webhook/whatsapp/baileys`, {
        companyId: COMPANY_ID,
        phone: TEST_PHONE,
        message: 'Привет! Хочу записаться на стрижку завтра в 15:00',
        action: 'message',
        clientName: 'Test Client'
      });
      
      console.log('Webhook response:', JSON.stringify(webhookResponse.data, null, 2));
      
    } else {
      console.log('⚠️ WhatsApp not connected');
      console.log('Please scan QR code first or check authentication');
      
      // Try to get QR code
      console.log('\n📱 Attempting to get QR code...');
      try {
        const qrResponse = await axios.get(`${API_URL}/webhook/whatsapp/baileys/qr/${COMPANY_ID}`);
        if (qrResponse.data.qr) {
          console.log('QR Code available! Scan with WhatsApp to connect.');
          // You can display QR here if needed
        }
      } catch (qrError) {
        console.log('No QR code available:', qrError.response?.data?.error || qrError.message);
      }
    }
    
    console.log('================================');
    console.log('✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testBaileysConnection();