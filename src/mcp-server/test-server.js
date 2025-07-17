#!/usr/bin/env node
// Test script for Supabase MCP Server

const { spawn } = require('child_process');
const path = require('path');

async function testServer() {
  console.log('🧪 Testing Supabase MCP Server...\n');
  
  // Start the server
  const serverPath = path.join(__dirname, 'supabase-server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  
  server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server output:', data.toString());
  });
  
  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test commands
  const testCommands = [
    {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    },
    {
      jsonrpc: '2.0', 
      method: 'tools/call',
      params: {
        name: 'list_tables',
        arguments: {}
      },
      id: 2
    }
  ];
  
  // Send test commands
  for (const cmd of testCommands) {
    console.log('\n📤 Sending:', JSON.stringify(cmd, null, 2));
    server.stdin.write(JSON.stringify(cmd) + '\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Clean up
  setTimeout(() => {
    server.kill();
    console.log('\n✅ Test completed');
    process.exit(0);
  }, 5000);
}

// Run test
testServer().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});