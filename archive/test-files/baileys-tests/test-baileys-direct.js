#!/usr/bin/env node

// tests/manual/test-baileys-direct.js
// Test script for Baileys WhatsApp integration

require('dotenv').config();
const chalk = require('chalk');

console.log(chalk.blue.bold('\n📱 Baileys Direct Test\n'));

async function testBaileysDirectMessage() {
  try {
    // Use client factory to get Baileys client
    const clientFactory = require('../../src/integrations/whatsapp/client-factory');
    const whatsappClient = clientFactory.getClient();
    
    console.log(chalk.cyan('Provider:', clientFactory.getCurrentProvider()));
    
    // Initialize client
    console.log(chalk.yellow('Initializing Baileys client...'));
    await whatsappClient.initialize();
    
    // Check status
    console.log(chalk.yellow('Checking connection status...'));
    const status = await whatsappClient.checkStatus();
    
    if (!status.connected) {
      console.log(chalk.red('❌ Not connected to WhatsApp'));
      console.log(chalk.yellow('Please run: node tests/test-baileys.js to authenticate'));
      return;
    }
    
    console.log(chalk.green('✅ Connected to WhatsApp'));
    
    // Test phone number
    const testPhone = process.argv[2] || '79001234567';
    const testMessage = process.argv[3] || 'Привет! Хочу записаться на стрижку завтра в 15:00';
    
    console.log(chalk.cyan('\n📤 Sending test message:'));
    console.log(`  Phone: ${testPhone}`);
    console.log(`  Message: ${testMessage}`);
    
    // Send message
    const result = await whatsappClient.sendMessage(testPhone, testMessage);
    
    if (result.success) {
      console.log(chalk.green('✅ Message sent successfully!'));
      console.log('  Message ID:', result.messageId || result.data?.messageId);
      
      // Send typing indicator
      console.log(chalk.yellow('\n⌨️  Sending typing indicator...'));
      await whatsappClient.sendTyping(testPhone);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Send follow-up
      const followUp = await whatsappClient.sendMessage(
        testPhone,
        '✅ Тест Baileys провайдера успешно завершен!'
      );
      
      if (followUp.success) {
        console.log(chalk.green('✅ Follow-up sent'));
      }
      
    } else {
      console.log(chalk.red('❌ Failed to send message:'), result.error);
    }
    
    // Test multi-tenant if enabled
    if (process.env.WHATSAPP_MULTI_TENANT === 'true') {
      console.log(chalk.cyan('\n🏢 Testing multi-tenant functionality...'));
      
      const testCompanyId = 'test_company_' + Date.now();
      console.log(`  Creating session for: ${testCompanyId}`);
      
      try {
        await whatsappClient.initializeCompany(testCompanyId);
        console.log(chalk.green(`  ✅ Company session created`));
        
        // Get all sessions
        const sessions = whatsappClient.getAllSessions();
        console.log(`  Active sessions: ${sessions.length}`);
        
        sessions.forEach(session => {
          console.log(`    - ${session.companyId}: ${session.status.status}`);
        });
        
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  Multi-tenant test failed: ${error.message}`));
      }
    }
    
    console.log(chalk.blue.bold('\n✨ Test complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
  }
}

// Run test
testBaileysDirectMessage()
  .then(() => {
    console.log(chalk.gray('Exiting in 5 seconds...'));
    setTimeout(() => process.exit(0), 5000);
  })
  .catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });

// Usage help
if (process.argv.includes('--help')) {
  console.log(chalk.cyan(`
Usage: node test-baileys-direct.js [phone] [message]

Examples:
  node test-baileys-direct.js
  node test-baileys-direct.js 79001234567
  node test-baileys-direct.js 79001234567 "Привет! Хочу записаться"

Environment variables:
  WHATSAPP_PROVIDER=baileys
  WHATSAPP_MULTI_TENANT=true
  `));
  process.exit(0);
}