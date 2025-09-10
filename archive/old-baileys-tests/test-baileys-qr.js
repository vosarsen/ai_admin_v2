#!/usr/bin/env node

// Test script to get QR code for Baileys authentication
require('dotenv').config();

console.log('\n=== BAILEYS QR CODE AUTHENTICATION ===\n');
console.log('Initializing WhatsApp connection...\n');

async function getQRCode() {
  const baileysProvider = require('../src/integrations/whatsapp/providers/baileys-provider');
  
  // Initialize provider
  await baileysProvider.initialize();
  
  // Set up QR listener
  baileysProvider.once('qr', ({ companyId, qr }) => {
    console.log('='.repeat(50));
    console.log('QR CODE GENERATED!');
    console.log('='.repeat(50));
    console.log('\n📱 Please scan this QR code with WhatsApp:\n');
    
    // Output QR as text that can be converted to image
    console.log('QR CODE DATA (copy this to a QR generator):');
    console.log('-'.repeat(50));
    console.log(qr);
    console.log('-'.repeat(50));
    
    console.log('\nTo scan:');
    console.log('1. Open WhatsApp on your phone');
    console.log('2. Go to Settings → Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Scan the QR code');
    console.log('\nOr use an online QR generator with the data above');
    console.log('\nWaiting for authentication...');
  });
  
  // Set up ready listener
  baileysProvider.once('ready', ({ companyId }) => {
    console.log('\n✅ SUCCESS! WhatsApp connected!');
    console.log(`Company ID: ${companyId}`);
    console.log('Session saved to: /opt/ai-admin/sessions/');
    console.log('\nSending test message...');
    
    // Send test message
    setTimeout(async () => {
      try {
        const testPhone = '79686484488'; // Your number
        await baileysProvider.sendMessage(
          companyId,
          testPhone,
          '✅ Baileys успешно подключен к WhatsApp!\n\n' +
          '🚀 Система готова к работе\n' +
          '💾 Сессия сохранена\n' +
          '🤖 AI Admin готов принимать сообщения'
        );
        console.log('✅ Test message sent!');
        console.log('\nBaileys is ready for production!');
        process.exit(0);
      } catch (error) {
        console.error('Failed to send test message:', error.message);
        process.exit(1);
      }
    }, 2000);
  });
  
  // Connect
  const companyId = process.env.YCLIENTS_COMPANY_ID || '962302';
  console.log(`Connecting for company: ${companyId}`);
  
  try {
    await baileysProvider.connectSession(companyId);
  } catch (error) {
    console.error('Connection error:', error.message);
  }
  
  // Keep alive for 2 minutes
  setTimeout(() => {
    console.log('\nTimeout reached. Please restart if QR code didn\'t appear.');
    process.exit(1);
  }, 120000);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Error:', error);
});

// Run
getQRCode().catch(console.error);