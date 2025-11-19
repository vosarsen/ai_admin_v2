#!/usr/bin/env node

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const COMPANY_ID = process.env.COMPANY_ID || '962302';

async function initSession() {
  try {
    console.log('🚀 Initializing Baileys session...');
    console.log('Company ID:', COMPANY_ID);
    
    // Initialize session
    const initUrl = `${API_URL}/webhook/whatsapp/baileys/init/${COMPANY_ID}`;
    console.log('📱 Initializing session at:', initUrl);
    
    const initResponse = await axios.post(initUrl);
    console.log('✅ Session initialization response:', initResponse.data);
    
    // Check status
    const statusUrl = `${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}`;
    console.log('📊 Checking status at:', statusUrl);
    
    const statusResponse = await axios.get(statusUrl);
    console.log('📊 Session status:', statusResponse.data);
    
    if (statusResponse.data.status?.connected) {
      console.log('✅ WhatsApp connected successfully!');
    } else if (statusResponse.data.status?.qr) {
      console.log('📱 Please scan QR code to connect WhatsApp');
      console.log('QR Code:', statusResponse.data.status.qr);
    } else {
      console.log('⚠️ Session not connected. Status:', statusResponse.data.status);
    }
    
    return statusResponse.data;
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('================================');
  console.log('Baileys Session Initialization');
  console.log('================================');
  
  try {
    const result = await initSession();
    console.log('================================');
    console.log('✅ Initialization completed!');
    return result;
  } catch (error) {
    console.log('================================');
    console.log('❌ Initialization failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { initSession };