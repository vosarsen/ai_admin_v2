#!/usr/bin/env node

// Test script for new Baileys WhatsApp client
const whatsappClient = require('./src/integrations/whatsapp/client');

async function testClient() {
  console.log('🧪 Testing new Baileys WhatsApp client...\n');

  // Test phone number (replace with your test number)
  const testPhone = '79001234567';
  const testMessage = '🧪 Test message from new Baileys client';

  try {
    // 1. Check status
    console.log('1️⃣ Checking WhatsApp status...');
    const statusResult = await whatsappClient.checkStatus();
    console.log('   Status:', statusResult);
    console.log('');

    // 2. Send test message
    console.log('2️⃣ Sending test message...');
    const sendResult = await whatsappClient.sendMessage(testPhone, testMessage);
    console.log('   Result:', sendResult);
    console.log('');

    // 3. Send reaction
    console.log('3️⃣ Sending reaction...');
    const reactionResult = await whatsappClient.sendReaction(testPhone, '👍');
    console.log('   Result:', reactionResult);
    console.log('');

    // 4. Diagnose connection
    console.log('4️⃣ Running diagnosis...');
    const diagnosisResult = await whatsappClient.diagnoseProblem(testPhone);
    console.log('   Diagnosis:', diagnosisResult);

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testClient().catch(console.error);