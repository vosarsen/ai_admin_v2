#!/usr/bin/env node
const crypto = require('crypto');

// Test webhook with proper signature
const secretKey = 'webhook_secret_key_3553';
const timestamp = Date.now();
const method = 'POST';
const path = '/webhook/whatsapp';
const body = JSON.stringify({
  "from": "79686484488@c.us",
  "message": "тест с подписью",
  "timestamp": new Date().toISOString()
});

// Generate signature
const payload = `${method}:${path}:${timestamp}:${body}`;
const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

console.log('Test webhook call with signature:');
console.log('curl -X POST "http://localhost:3000/webhook/whatsapp" \\');
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "X-Timestamp: ${timestamp}" \\`);
console.log(`  -H "X-Signature: ${signature}" \\`);
console.log(`  -d '${body}'`);