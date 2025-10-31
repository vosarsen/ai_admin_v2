#!/usr/bin/env node

const axios = require('axios');
const logger = require('../src/utils/logger').child({ module: 'switch-ai-provider' });

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function switchProvider(provider) {
  try {
    const response = await axios.post(`${API_URL}/api/ai/providers/switch`, {
      provider
    });
    
    if (response.data.success) {
      console.log(`✅ Switched to ${provider} provider`);
    } else {
      console.error(`❌ Failed to switch: ${response.data.error}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

async function listProviders() {
  try {
    const response = await axios.get(`${API_URL}/api/ai/providers`);
    
    console.log('\nAvailable AI Providers:');
    response.data.providers.forEach(provider => {
      const marker = provider === response.data.current ? '✓' : ' ';
      console.log(`  ${marker} ${provider}`);
    });
    console.log(`\nCurrent: ${response.data.current}`);
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

// Command line interface
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node switch-ai-provider.js [command] [options]

Commands:
  list              List available providers
  switch <provider> Switch to specified provider
  
Examples:
  node switch-ai-provider.js list
  node switch-ai-provider.js switch qwen
  node switch-ai-provider.js switch deepseek
  `);
  process.exit(1);
}

const command = args[0];

switch (command) {
  case 'list':
    listProviders();
    break;
    
  case 'switch':
    if (args.length < 2) {
      console.error('❌ Please specify provider name');
      process.exit(1);
    }
    switchProvider(args[1]);
    break;
    
  default:
    console.error(`❌ Unknown command: ${command}`);
    process.exit(1);
}