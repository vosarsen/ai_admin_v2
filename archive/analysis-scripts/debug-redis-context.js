#!/usr/bin/env node

import { createClient } from 'redis';

const redis = createClient({
  url: 'redis://localhost:6380',
  socket: {
    connectTimeout: 5000,
    commandTimeout: 5000
  }
});

redis.on('error', (err) => console.error('Redis Client Error', err));

async function debugContext() {
  await redis.connect();
  
  const phone = '+79686484488';
  const companyId = '962302';
  
  // Check what's in the hash
  const contextKey = `context:${companyId}:${phone}`;
  const fullContextKey = `full_context:${companyId}:${phone}`;
  const preferencesKey = `preferences:${companyId}:${phone}`;
  
  console.log('=== DEBUG REDIS CONTEXT ===');
  console.log(`Context key: ${contextKey}`);
  
  // Check if keys exist
  const contextExists = await redis.exists(contextKey);
  const fullContextExists = await redis.exists(fullContextKey);
  const preferencesExists = await redis.exists(preferencesKey);
  
  console.log('Key existence:');
  console.log(`- ${contextKey}: ${contextExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`- ${fullContextKey}: ${fullContextExists ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`- ${preferencesKey}: ${preferencesExists ? 'EXISTS' : 'NOT FOUND'}`);
  
  if (contextExists) {
    console.log('\n=== HASH CONTEXT DATA ===');
    const contextHash = await redis.hGetAll(contextKey);
    console.log('Hash keys:', Object.keys(contextHash));
    console.log('Hash data:', JSON.stringify(contextHash, null, 2));
  }
  
  if (fullContextExists) {
    console.log('\n=== FULL CONTEXT DATA ===');
    const fullContext = await redis.get(fullContextKey);
    console.log('Full context (string):', fullContext);
  }
  
  if (preferencesExists) {
    console.log('\n=== PREFERENCES DATA ===');
    const preferencesType = await redis.type(preferencesKey);
    console.log('Preferences type:', preferencesType);
    
    if (preferencesType === 'hash') {
      const prefs = await redis.hGetAll(preferencesKey);
      console.log('Preferences (hash):', JSON.stringify(prefs, null, 2));
    } else if (preferencesType === 'string') {
      const prefs = await redis.get(preferencesKey);
      console.log('Preferences (string):', prefs);
    }
  }
  
  await redis.quit();
}

debugContext().catch(console.error);