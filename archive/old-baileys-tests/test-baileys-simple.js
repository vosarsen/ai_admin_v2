#!/usr/bin/env node

// Simple Baileys test without database dependencies
require('dotenv').config();
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');

console.log(chalk.blue.bold('\n🧪 Simple Baileys Test\n'));

async function testBaileysSimple() {
  try {
    // Direct Baileys provider test
    console.log(chalk.cyan('Loading Baileys provider directly...'));
    const baileysProvider = require('../src/integrations/whatsapp/providers/baileys-provider');
    
    // Initialize provider
    await baileysProvider.initialize();
    console.log(chalk.green('✅ Provider initialized\n'));
    
    // Set up QR listener
    baileysProvider.once('qr', ({ companyId, qr }) => {
      console.log(chalk.yellow('\n📱 Scan this QR code with WhatsApp:\n'));
      qrcode.generate(qr, { small: true });
      console.log(chalk.yellow('\nWaiting for authentication...\n'));
    });
    
    // Set up ready listener
    baileysProvider.once('ready', ({ companyId }) => {
      console.log(chalk.green(`\n✅ WhatsApp connected for company: ${companyId}`));
      console.log(chalk.green('Session saved successfully!\n'));
      
      // Test sending message
      testSendMessage(companyId);
    });
    
    // Connect session
    const companyId = process.env.YCLIENTS_COMPANY_ID || 'default';
    console.log(chalk.cyan(`Connecting session for company: ${companyId}...`));
    
    await baileysProvider.connectSession(companyId);
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

async function testSendMessage(companyId) {
  const baileysProvider = require('../src/integrations/whatsapp/providers/baileys-provider');
  
  try {
    const testPhone = process.env.TEST_PHONE || '79686484488';
    
    console.log(chalk.cyan('\n📤 Sending test message...'));
    console.log(`  To: ${testPhone}`);
    
    const result = await baileysProvider.sendMessage(
      companyId,
      testPhone,
      '🎉 Baileys успешно подключен!\n\n' +
      '✅ Система готова к работе\n' +
      '🚀 Multi-tenant поддержка активна\n' +
      '💾 Сессия сохранена'
    );
    
    console.log(chalk.green('✅ Message sent successfully!'));
    console.log('  Message ID:', result.messageId);
    
    // Send typing
    await baileysProvider.sendTyping(companyId, testPhone);
    
    setTimeout(async () => {
      await baileysProvider.sendMessage(
        companyId,
        testPhone,
        '👍 Все системы работают нормально!'
      );
      
      console.log(chalk.green('\n✅ All tests completed successfully!'));
      console.log(chalk.blue('\nBaileys is ready for production!\n'));
      
      // Keep alive for a bit
      setTimeout(() => process.exit(0), 5000);
    }, 3000);
    
  } catch (error) {
    console.error(chalk.red('Failed to send message:'), error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down...'));
  process.exit(0);
});

// Run test
testBaileysSimple().catch(error => {
  console.error(chalk.red.bold('\n❌ Fatal error:'), error);
  process.exit(1);
});