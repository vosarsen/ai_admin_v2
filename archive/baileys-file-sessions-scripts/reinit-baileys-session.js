#!/usr/bin/env node
// scripts/reinit-baileys-session.js
// Script to reinitialize Baileys WhatsApp session with fresh QR code

require('dotenv').config();
const qrcode = require('qrcode-terminal');
const baileysProvider = require('../src/integrations/whatsapp/providers/baileys-provider');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

const COMPANY_ID = process.env.COMPANY_ID || '962302';

async function cleanupOldSession() {
  console.log('🧹 Cleaning up old session...');
  
  // Delete session files
  const sessionsPath = path.join(process.cwd(), 'sessions', `company_${COMPANY_ID}`);
  try {
    await fs.rm(sessionsPath, { recursive: true, force: true });
    console.log('✅ Old session files deleted');
  } catch (error) {
    console.log('⚠️ No old session files found');
  }
}

async function initializeNewSession() {
  console.log(`\n📱 Initializing new WhatsApp session for company ${COMPANY_ID}...`);
  console.log('⏳ Waiting for QR code...\n');
  
  // Initialize provider
  await baileysProvider.initialize();
  
  // Listen for QR code
  baileysProvider.on('qr', ({ companyId, qr }) => {
    if (companyId === COMPANY_ID) {
      console.log('📱 QR Code received! Please scan with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for authentication...');
    }
  });
  
  // Listen for ready event
  baileysProvider.on('ready', ({ companyId }) => {
    if (companyId === COMPANY_ID) {
      console.log('\n✅ WhatsApp session connected successfully!');
      console.log('📊 Session details:');
      const status = baileysProvider.getSessionStatus(companyId);
      console.log('  - Phone:', status.user?.id);
      console.log('  - Name:', status.user?.name);
      console.log('\n🎉 You can now send messages through the API!');
      
      // Test message
      setTimeout(async () => {
        console.log('\n📤 Sending test message...');
        try {
          const testPhone = process.env.TEST_PHONE || '79686484488';
          await baileysProvider.sendMessage(companyId, testPhone, '✅ Baileys session reinitialized successfully!');
          console.log('✅ Test message sent!');
          console.log('\n💡 Session is ready for use. You can close this script with Ctrl+C');
        } catch (error) {
          console.error('❌ Failed to send test message:', error.message);
        }
      }, 2000);
    }
  });
  
  // Listen for disconnection
  baileysProvider.on('disconnected', ({ companyId, reason }) => {
    if (companyId === COMPANY_ID) {
      console.log(`\n❌ Session disconnected: ${reason}`);
      if (reason === 'max_attempts') {
        console.log('⚠️ Maximum reconnection attempts reached. Please run the script again.');
        process.exit(1);
      }
    }
  });
  
  // Connect session
  try {
    await baileysProvider.connectSession(COMPANY_ID);
  } catch (error) {
    console.error('❌ Failed to connect session:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('=================================');
  console.log('  Baileys Session Reinitializer');
  console.log('=================================\n');
  
  try {
    // Step 1: Clean up old session
    await cleanupOldSession();
    
    // Step 2: Initialize new session
    await initializeNewSession();
    
    // Keep script running
    console.log('\n💡 Script is running. Press Ctrl+C to exit after successful connection.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Run the script
main().catch(console.error);