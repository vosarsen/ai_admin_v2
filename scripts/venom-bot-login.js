#!/usr/bin/env node

require('dotenv').config();
const venom = require('venom-bot');
const qrcode = require('qrcode-terminal');

console.log('🚀 Starting venom-bot login process...');

venom
  .create({
    session: 'ai-admin-session',
    multidevice: false,
    folderNameToken: 'tokens',
    mkdirFolderToken: '',
    headless: true,
    devtools: false,
    useChrome: false,
    debug: false,
    logQR: false, // Disable default QR logging
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    refreshQR: 15000,
    autoClose: 60000
  },
  (base64Qr, asciiQR) => {
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    // Display QR in terminal
    qrcode.generate(base64Qr, { small: true });
    console.log('\n⏳ Waiting for authentication...\n');
  },
  (statusSession, session) => {
    console.log('Status Session:', statusSession);
  })
  .then((client) => {
    console.log('✅ Successfully logged in!');
    console.log('📱 WhatsApp connected');
    
    // Send test message to verify
    client.sendText('79001234567@c.us', '✅ WhatsApp bot successfully logged in!');
    
    setTimeout(() => {
      console.log('👋 Closing browser...');
      client.close();
      process.exit(0);
    }, 5000);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });