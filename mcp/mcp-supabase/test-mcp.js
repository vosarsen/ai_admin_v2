#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve } from 'path';

const serverPath = resolve('server.js');

console.log('Testing MCP Supabase Server...');
console.log('Server path:', serverPath);

// Spawn the MCP server
const mcpServer = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
  }
});

// Listen for server output
mcpServer.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

mcpServer.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Send initialization request
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-01',
      capabilities: {}
    },
    id: 1
  };
  
  console.log('Sending initialization request...');
  mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// Send tool list request
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  };
  
  console.log('Sending tools list request...');
  mcpServer.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 2000);

// Exit after 5 seconds
setTimeout(() => {
  console.log('Test completed.');
  mcpServer.kill();
  process.exit(0);
}, 5000);