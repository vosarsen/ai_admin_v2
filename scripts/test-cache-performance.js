#!/usr/bin/env node

// scripts/test-cache-performance.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cachedDataLoader = require('../src/services/ai-admin-v2/modules/cached-data-loader');
const dataLoader = require('../src/services/ai-admin-v2/modules/data-loader');
const localCache = require('../src/utils/local-cache');
const logger = require('../src/utils/logger').child({ module: 'cache-performance-test' });

/**
 * Тест производительности с и без кэша
 */
async function testCachePerformance() {
  console.log('🚀 Testing cache performance...\n');
  
  const testPhone = '79001234567';
  const testCompanyId = 962302;
  const iterations = 5;
  
  try {
    // Очищаем все кэши перед тестом
    localCache.flush();
    console.log('✅ Cache cleared\n');
    
    // Тест БЕЗ кэша (прямые вызовы)
    console.log('📊 Testing WITHOUT cache:');
    console.log('━'.repeat(50));
    
    const withoutCacheTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      await dataLoader.loadFullContext(testPhone, testCompanyId);
      
      const time = Date.now() - start;
      withoutCacheTimes.push(time);
      console.log(`  Iteration ${i + 1}: ${time}ms`);
    }
    
    const avgWithoutCache = withoutCacheTimes.reduce((a, b) => a + b, 0) / iterations;
    console.log(`\n  Average time WITHOUT cache: ${avgWithoutCache.toFixed(2)}ms`);
    console.log('━'.repeat(50));
    
    // Очищаем кэш перед тестом с кэшем
    localCache.flush();
    
    // Тест С кэшем
    console.log('\n📊 Testing WITH cache:');
    console.log('━'.repeat(50));
    
    const withCacheTimes = [];
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      await cachedDataLoader.loadFullContext(testPhone, testCompanyId);
      
      const time = Date.now() - start;
      withCacheTimes.push(time);
      console.log(`  Iteration ${i + 1}: ${time}ms ${i > 0 ? '(cached)' : '(initial load)'}`);
    }
    
    const avgWithCache = withCacheTimes.reduce((a, b) => a + b, 0) / iterations;
    const avgCachedOnly = withCacheTimes.slice(1).reduce((a, b) => a + b, 0) / (iterations - 1);
    
    console.log(`\n  Average time WITH cache: ${avgWithCache.toFixed(2)}ms`);
    console.log(`  Average time (cached only): ${avgCachedOnly.toFixed(2)}ms`);
    console.log('━'.repeat(50));
    
    // Статистика улучшения
    const improvement = ((avgWithoutCache - avgWithCache) / avgWithoutCache * 100).toFixed(2);
    const cachedImprovement = ((avgWithoutCache - avgCachedOnly) / avgWithoutCache * 100).toFixed(2);
    
    console.log('\n📈 Performance improvement:');
    console.log(`  Overall: ${improvement}% faster`);
    console.log(`  Cached requests: ${cachedImprovement}% faster`);
    console.log(`  Speed up: ${(avgWithoutCache / avgCachedOnly).toFixed(1)}x`);
    
    // Показываем статистику кэша
    console.log('\n📊 Cache statistics:');
    const stats = localCache.getStats();
    console.log(`  Hit rate: ${stats.overall.hitRate}`);
    console.log(`  Total hits: ${stats.overall.hits}`);
    console.log(`  Total misses: ${stats.overall.misses}`);
    console.log(`  Total sets: ${stats.overall.sets}`);
    
    console.log('\n📊 Cache breakdown:');
    Object.entries(stats.caches).forEach(([name, cacheStats]) => {
      console.log(`  ${name}: ${cacheStats.keys} keys, ${cacheStats.hits} hits`);
    });
    
    // Тестируем отдельные операции
    console.log('\n📊 Testing individual operations:');
    console.log('━'.repeat(50));
    
    // Очищаем кэш
    localCache.flush();
    
    // Компания
    let start = Date.now();
    await cachedDataLoader.loadCompanyData(testCompanyId);
    const companyTime1 = Date.now() - start;
    
    start = Date.now();
    await cachedDataLoader.loadCompanyData(testCompanyId);
    const companyTime2 = Date.now() - start;
    
    console.log(`  Company data: ${companyTime1}ms → ${companyTime2}ms (${(companyTime1/companyTime2).toFixed(1)}x faster)`);
    
    // Услуги
    start = Date.now();
    await cachedDataLoader.loadServices(testCompanyId);
    const servicesTime1 = Date.now() - start;
    
    start = Date.now();
    await cachedDataLoader.loadServices(testCompanyId);
    const servicesTime2 = Date.now() - start;
    
    console.log(`  Services: ${servicesTime1}ms → ${servicesTime2}ms (${(servicesTime1/servicesTime2).toFixed(1)}x faster)`);
    
    // Персонал
    start = Date.now();
    await cachedDataLoader.loadStaff(testCompanyId);
    const staffTime1 = Date.now() - start;
    
    start = Date.now();
    await cachedDataLoader.loadStaff(testCompanyId);
    const staffTime2 = Date.now() - start;
    
    console.log(`  Staff: ${staffTime1}ms → ${staffTime2}ms (${(staffTime1/staffTime2).toFixed(1)}x faster)`);
    
    console.log('\n✅ Cache performance test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Cache performance test error:', error);
  }
  
  process.exit(0);
}

// Запуск теста
testCachePerformance();