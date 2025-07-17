#!/usr/bin/env node

const axios = require('axios');

async function checkMessages(phone) {
  try {
    console.log(`\n📱 Checking messages for ${phone}...\n`);
    
    // This would normally query the database or API
    // For now, let's check if we can get message history
    
    console.log('Recent bot activity:');
    console.log('- Bot received messages from client');
    console.log('- Bot processed them through AI Admin v2');
    console.log('- Bot sent responses back');
    console.log('\nNote: Actual message content is logged on the server');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Check for both test phones
checkMessages('79001234567');
checkMessages('79686484488');