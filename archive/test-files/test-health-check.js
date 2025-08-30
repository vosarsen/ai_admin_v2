#!/usr/bin/env node
/**
 * Test health check system in production
 */

const contextService = require('./src/services/context/context-service-v2');

async function testHealthCheck() {
  console.log('🏥 Testing Health Check System\n');
  
  try {
    // 1. Run health check
    console.log('Running health check...');
    const health = await contextService.healthCheck();
    
    console.log('\n📊 Health Check Results:');
    console.log('=' . repeat(50));
    console.log(`Overall Status: ${health.status}`);
    console.log(`Timestamp: ${health.timestamp}`);
    
    // Redis check
    console.log('\n🔴 Redis Health:');
    console.log(`  Status: ${health.checks.redis.status}`);
    if (health.checks.redis.responseTime) {
      console.log(`  Response Time: ${health.checks.redis.responseTime}`);
    }
    if (health.checks.redis.error) {
      console.log(`  Error: ${health.checks.redis.error}`);
    }
    
    // Memory check
    console.log('\n💾 Memory Health:');
    console.log(`  Status: ${health.checks.memory.status}`);
    if (health.checks.memory.usage) {
      console.log(`  Usage: ${health.checks.memory.usage}`);
      console.log(`  Total Keys: ${health.checks.memory.totalKeys}`);
    }
    
    // Performance check
    console.log('\n⚡ Performance Health:');
    console.log(`  Status: ${health.checks.performance.status}`);
    if (health.checks.performance.writeTime) {
      console.log(`  Write Time: ${health.checks.performance.writeTime}`);
      console.log(`  Read Time: ${health.checks.performance.readTime}`);
    }
    
    // 2. Get usage stats
    console.log('\n📈 Usage Statistics for Company 962302:');
    console.log('=' . repeat(50));
    
    const stats = await contextService.getUsageStats(962302);
    
    if (stats) {
      console.log(`Total Contexts: ${stats.totalContexts}`);
      console.log(`Active Dialogs: ${stats.activeDialogs}`);
      console.log(`Cached Clients: ${stats.cachedClients}`);
      console.log(`Message Histories: ${stats.messageHistories}`);
      console.log(`Preferences: ${stats.preferences}`);
      console.log(`Average Context Size: ${stats.avgContextSize} bytes`);
    } else {
      console.log('Unable to get usage stats');
    }
    
    // 3. Check specific phone context
    console.log('\n📱 Context for +79686484488:');
    console.log('=' . repeat(50));
    
    const fullContext = await contextService.getFullContext('+79686484488', 962302);
    
    if (fullContext) {
      console.log(`Phone: ${fullContext.phone}`);
      console.log(`Company ID: ${fullContext.companyId}`);
      console.log(`Is New Client: ${fullContext.isNewClient}`);
      console.log(`Has Active Dialog: ${fullContext.hasActiveDialog}`);
      console.log(`Dialog State: ${fullContext.dialogState}`);
      console.log(`Messages Count: ${fullContext.messages?.length || 0}`);
      
      if (fullContext.currentSelection && Object.keys(fullContext.currentSelection).length > 0) {
        console.log('\nCurrent Selection:');
        Object.entries(fullContext.currentSelection).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
      
      if (fullContext.preferences && Object.keys(fullContext.preferences).length > 0) {
        console.log('\nPreferences:');
        Object.entries(fullContext.preferences).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    }
    
    console.log('\n✅ Health check completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Health check failed:', error);
  } finally {
    // Clean up
    setTimeout(() => process.exit(0), 1000);
  }
}

// Replace dot concatenation
String.prototype.repeat = function(n) {
  return new Array(n + 1).join(this);
};

testHealthCheck();