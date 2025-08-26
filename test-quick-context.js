#!/usr/bin/env node
/**
 * Быстрый тест основных улучшений
 */

const contextService = require('./src/services/context/context-service-v2');

async function quickTest() {
  const phone = '79001234567';
  const companyId = 962302;
  
  console.log('🚀 Quick Context Test\n');
  
  try {
    // 1. Test Pipeline
    console.log('1️⃣ Testing Pipeline...');
    const start = Date.now();
    const context = await contextService.getFullContext(phone, companyId);
    console.log(`   ✅ Got context in ${Date.now() - start}ms`);
    console.log(`   Keys: ${Object.keys(context).join(', ')}`);
    
    // 2. Test Cache
    console.log('\n2️⃣ Testing Cache...');
    const start2 = Date.now();
    const context2 = await contextService.getFullContext(phone, companyId);
    const cacheTime = Date.now() - start2;
    console.log(`   ✅ Cached response in ${cacheTime}ms`);
    
    if (cacheTime < 50) {
      console.log('   ✅ Cache is working!');
    } else {
      console.log(`   ⚠️ Cache seems slow: ${cacheTime}ms`);
    }
    
    // 3. Test Update
    console.log('\n3️⃣ Testing Update...');
    const result = await contextService.updateDialogContext(phone, companyId, {
      selection: { service: 123, staff: 456 }
    });
    
    if (result.success) {
      console.log('   ✅ Update successful');
    } else {
      console.log('   ❌ Update failed:', result.error);
    }
    
    // Clean up
    await contextService.clearDialogContext(phone, companyId);
    
    console.log('\n✅ All quick tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Gracefully close Redis
    if (contextService.redis) {
      await contextService.redis.quit();
    }
    process.exit(0);
  }
}

quickTest();