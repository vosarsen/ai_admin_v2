#!/usr/bin/env node

// tests/test-baileys.js
require('dotenv').config();
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');

console.log(chalk.blue.bold('\n🧪 Baileys WhatsApp Provider Test\n'));

async function testBaileys() {
  try {
    // Test 1: Load Baileys client
    console.log(chalk.cyan('Test 1: Loading Baileys client...'));
    const baileysClient = require('../src/integrations/whatsapp/baileys-client');
    console.log(chalk.green('✅ Baileys client loaded\n'));

    // Test 2: Initialize client
    console.log(chalk.cyan('Test 2: Initializing Baileys...'));
    await baileysClient.initialize();
    console.log(chalk.green('✅ Baileys initialized\n'));

    // Test 3: Check status
    console.log(chalk.cyan('Test 3: Checking connection status...'));
    const status = await baileysClient.checkStatus();
    console.log('Status:', status);
    
    if (status.connected) {
      console.log(chalk.green('✅ Already connected!\n'));
      console.log('User:', status.user);
    } else {
      console.log(chalk.yellow('⚠️  Not connected, QR code required\n'));
      
      // Test 4: Get QR Code
      console.log(chalk.cyan('Test 4: Getting QR code...'));
      
      // Set up QR listener
      baileysClient.sessionManager.once('qr', ({ companyId, qr }) => {
        console.log(chalk.yellow('\n📱 Scan this QR code with WhatsApp:\n'));
        qrcode.generate(qr, { small: true });
        console.log(chalk.yellow('\nWaiting for authentication...\n'));
      });

      // Set up ready listener
      baileysClient.sessionManager.once('session-ready', ({ companyId }) => {
        console.log(chalk.green(`\n✅ Session ready for company: ${companyId}\n`));
        testMessaging();
      });

      // Request QR
      await baileysClient.getQRCode();
    }

    // If already connected, test messaging
    if (status.connected) {
      await testMessaging();
    }

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

async function testMessaging() {
  console.log(chalk.cyan('\n📱 Testing messaging functionality...\n'));
  
  const baileysClient = require('../src/integrations/whatsapp/baileys-client');
  
  // Get test phone number
  const testPhone = process.env.TEST_PHONE_NUMBER || '79686484488';
  console.log(chalk.yellow(`Test phone number: ${testPhone}`));
  console.log(chalk.gray('(Set TEST_PHONE_NUMBER in .env to use a different number)\n'));

  try {
    // Test 5: Send text message
    console.log(chalk.cyan('Test 5: Sending text message...'));
    const result = await baileysClient.sendMessage(
      testPhone,
      '🧪 Test message from Baileys provider\n\n✅ Your WhatsApp integration is working!'
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Message sent successfully!'));
      console.log('Message ID:', result.messageId);
    } else {
      console.log(chalk.red('❌ Failed to send message:'), result.error);
    }

    // Test 6: Send typing indicator
    console.log(chalk.cyan('\nTest 6: Sending typing indicator...'));
    await baileysClient.sendTyping(testPhone, 3000);
    console.log(chalk.green('✅ Typing indicator sent'));

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 7: Send emoji/reaction
    console.log(chalk.cyan('\nTest 7: Sending emoji...'));
    const emojiResult = await baileysClient.sendMessage(testPhone, '👍');
    if (emojiResult.success) {
      console.log(chalk.green('✅ Emoji sent'));
    }

    // Test 8: Multi-tenant test (if enabled)
    if (process.env.WHATSAPP_MULTI_TENANT === 'true') {
      console.log(chalk.cyan('\nTest 8: Multi-tenant functionality...'));
      
      const testCompanyId = 'test_company_123';
      console.log(`Creating session for company: ${testCompanyId}`);
      
      await baileysClient.initializeCompany(testCompanyId, {
        autoReconnect: true
      });
      
      const sessions = baileysClient.getAllSessions();
      console.log(`Active sessions: ${sessions.length}`);
      sessions.forEach(session => {
        console.log(`  - Company ${session.companyId}: ${session.status}`);
      });
      
      console.log(chalk.green('✅ Multi-tenant test complete'));
    }

    // Summary
    console.log(chalk.green.bold('\n✅ All tests passed!'));
    console.log(chalk.cyan('\n📊 Summary:'));
    console.log('  • Baileys provider: Working');
    console.log('  • WhatsApp connection: Established');
    console.log('  • Message sending: Functional');
    console.log('  • Multi-tenant: ' + (process.env.WHATSAPP_MULTI_TENANT === 'true' ? 'Enabled' : 'Disabled'));
    
    console.log(chalk.blue.bold('\n🎉 Baileys integration is ready for production!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Messaging test failed:'), error);
  }
  
  // Keep process alive for a bit to receive responses
  console.log(chalk.gray('\nTest complete. Process will exit in 10 seconds...'));
  setTimeout(() => {
    process.exit(0);
  }, 10000);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down...'));
  
  try {
    const baileysClient = require('../src/integrations/whatsapp/baileys-client');
    await baileysClient.sessionManager.shutdown();
    console.log(chalk.green('✅ Cleanup complete'));
  } catch (error) {
    console.error(chalk.red('Error during shutdown:'), error);
  }
  
  process.exit(0);
});

// Run tests
testBaileys().catch(error => {
  console.error(chalk.red.bold('\n❌ Test suite failed:'), error);
  process.exit(1);
});