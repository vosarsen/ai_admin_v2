#!/usr/bin/env node

const axios = require('axios');
const Table = require('cli-table3');

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function listPrompts() {
  try {
    const response = await axios.get(`${API_URL}/api/ai/prompts`);
    const { prompts, stats, current, abTestEnabled } = response.data;
    
    console.log('\nAvailable Prompts:');
    prompts.forEach(prompt => {
      const marker = prompt.active ? '✓' : ' ';
      console.log(`  ${marker} ${prompt.name} (v${prompt.version})`);
    });
    
    console.log(`\nCurrent: ${current}`);
    console.log(`A/B Testing: ${abTestEnabled ? 'Enabled' : 'Disabled'}\n`);
    
    // Show statistics table
    if (Object.keys(stats).length > 0) {
      const table = new Table({
        head: ['Prompt', 'Used', 'Success', 'Avg Commands', 'Avg Time'],
        colWidths: [20, 10, 15, 15, 15]
      });
      
      Object.entries(stats).forEach(([name, stat]) => {
        table.push([
          name,
          stat.used,
          stat.successRate,
          stat.avgCommandsPerUse,
          stat.avgResponseTime
        ]);
      });
      
      console.log('Statistics:');
      console.log(table.toString());
    }
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

async function switchPrompt(promptName) {
  try {
    const response = await axios.post(`${API_URL}/api/ai/prompts/switch`, {
      prompt: promptName
    });
    
    if (response.data.success) {
      console.log(`✅ Switched to ${promptName} prompt`);
    } else {
      console.error(`❌ Failed to switch: ${response.data.error}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

async function toggleABTest(enabled) {
  try {
    const response = await axios.post(`${API_URL}/api/ai/prompts/ab-test`, {
      enabled: enabled === 'on'
    });
    
    if (response.data.success) {
      console.log(`✅ A/B testing ${response.data.abTestEnabled ? 'enabled' : 'disabled'}`);
    } else {
      console.error(`❌ Failed to toggle A/B test: ${response.data.error}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

async function testPrompt(message, promptName) {
  try {
    const response = await axios.post(`${API_URL}/api/ai/prompts/test`, {
      message,
      promptName
    });
    
    if (response.data.success) {
      console.log(`\n✅ Testing prompt: ${response.data.promptName}`);
      console.log('\n--- PROMPT START ---');
      console.log(response.data.prompt);
      console.log('--- PROMPT END ---\n');
    } else {
      console.error(`❌ Failed to test: ${response.data.error}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
  }
}

// Command line interface
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node manage-prompts.js [command] [options]

Commands:
  list                    List available prompts and statistics
  switch <prompt>         Switch to specified prompt
  ab-test <on|off>        Enable or disable A/B testing
  test <message> [prompt] Test a prompt with a message
  
Examples:
  node manage-prompts.js list
  node manage-prompts.js switch strict-prompt
  node manage-prompts.js ab-test on
  node manage-prompts.js test "Хочу записаться на стрижку"
  node manage-prompts.js test "Когда свободно?" enhanced-prompt
  `);
  process.exit(1);
}

const command = args[0];

switch (command) {
  case 'list':
    listPrompts();
    break;
    
  case 'switch':
    if (args.length < 2) {
      console.error('❌ Please specify prompt name');
      process.exit(1);
    }
    switchPrompt(args[1]);
    break;
    
  case 'ab-test':
    if (args.length < 2 || !['on', 'off'].includes(args[1])) {
      console.error('❌ Please specify "on" or "off"');
      process.exit(1);
    }
    toggleABTest(args[1]);
    break;
    
  case 'test':
    if (args.length < 2) {
      console.error('❌ Please specify a test message');
      process.exit(1);
    }
    testPrompt(args[1], args[2]);
    break;
    
  default:
    console.error(`❌ Unknown command: ${command}`);
    process.exit(1);
}