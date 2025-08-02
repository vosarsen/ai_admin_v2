#!/usr/bin/env node

// test/e2e/performance.e2e.js
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';
const API_KEY = process.env.API_KEY || 'test-api-key';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  concurrentUsers: [1, 5, 10, 20], // Тестируем с разным количеством пользователей
  messagesPerUser: 5,
  testDuration: 60000, // 1 минута
  targetResponseTime: 5000, // 5 секунд
  targetThroughput: 100 // 100 сообщений в минуту
};

class PerformanceE2ETest {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'X-API-Key': API_KEY
      },
      timeout: 30000
    });
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };
  }

  generateSignature(payload) {
    return 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async sendMessage(userId, message) {
    const startTime = Date.now();
    const payload = {
      id: `msg-${userId}-${Date.now()}`,
      from: `7900${userId.toString().padStart(7, '0')}@c.us`,
      body: message,
      type: 'chat',
      timestamp: Math.floor(Date.now() / 1000)
    };

    try {
      const response = await this.apiClient.post('/webhook/whatsapp', payload, {
        headers: {
          'X-Hub-Signature': this.generateSignature(payload)
        }
      });

      const responseTime = Date.now() - startTime;
      this.metrics.responseTimes.push(responseTime);
      this.metrics.successfulRequests++;
      
      return { success: true, responseTime, jobId: response.data.jobId };
    } catch (error) {
      this.metrics.failedRequests++;
      this.metrics.errors.push({
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    } finally {
      this.metrics.totalRequests++;
    }
  }

  async simulateUser(userId, messages) {
    const results = [];
    
    for (const message of messages) {
      const result = await this.sendMessage(userId, message);
      results.push(result);
      
      // Пауза между сообщениями (1-3 секунды)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    }
    
    return results;
  }

  async runLoadTest(concurrentUsers) {
    console.log(`\n🏃 Running load test with ${concurrentUsers} concurrent users`);
    this.resetMetrics();
    
    const testMessages = [
      'Привет',
      'Хочу записаться',
      'На маникюр',
      'Завтра можно?',
      'В 15:00'
    ];
    
    const startTime = Date.now();
    const userPromises = [];
    
    // Запускаем пользователей
    for (let i = 0; i < concurrentUsers; i++) {
      userPromises.push(this.simulateUser(i, testMessages));
    }
    
    // Ждем завершения
    await Promise.all(userPromises);
    const duration = Date.now() - startTime;
    
    return this.analyzeResults(duration);
  }

  async runStressTest() {
    console.log('\n💪 Running stress test - finding breaking point');
    this.resetMetrics();
    
    let concurrentRequests = 10;
    let breakingPoint = null;
    
    while (concurrentRequests <= 100) {
      console.log(`Testing with ${concurrentRequests} concurrent requests...`);
      
      const promises = [];
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(this.sendMessage(i, 'Stress test message'));
      }
      
      const results = await Promise.all(promises);
      const failureRate = results.filter(r => !r.success).length / results.length;
      
      if (failureRate > 0.1) { // 10% failure rate
        breakingPoint = concurrentRequests;
        break;
      }
      
      concurrentRequests += 10;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return { breakingPoint };
  }

  async runSpikeTest() {
    console.log('\n📈 Running spike test');
    this.resetMetrics();
    
    // Normal load
    console.log('Normal load phase (5 users)...');
    await this.runLoadTest(5);
    
    // Spike
    console.log('Spike phase (50 users)...');
    const spikeResults = await this.runLoadTest(50);
    
    // Recovery
    console.log('Recovery phase (5 users)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    const recoveryResults = await this.runLoadTest(5);
    
    return {
      spike: spikeResults,
      recovery: recoveryResults
    };
  }

  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: []
    };
  }

  analyzeResults(duration) {
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;
    
    const minResponseTime = Math.min(...this.metrics.responseTimes);
    const maxResponseTime = Math.max(...this.metrics.responseTimes);
    const p95ResponseTime = this.calculatePercentile(this.metrics.responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(this.metrics.responseTimes, 99);
    
    const throughput = (this.metrics.totalRequests / duration) * 1000 * 60; // per minute
    const successRate = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    
    return {
      duration: `${(duration / 1000).toFixed(2)}s`,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: `${successRate.toFixed(2)}%`,
      throughput: `${throughput.toFixed(2)} req/min`,
      responseTime: {
        avg: `${avgResponseTime.toFixed(2)}ms`,
        min: `${minResponseTime}ms`,
        max: `${maxResponseTime}ms`,
        p95: `${p95ResponseTime.toFixed(2)}ms`,
        p99: `${p99ResponseTime.toFixed(2)}ms`
      }
    };
  }

  calculatePercentile(array, percentile) {
    if (array.length === 0) return 0;
    
    const sorted = array.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}

// Main test runner
async function runPerformanceTests() {
  console.log('🚀 AI Admin v2 Performance E2E Tests');
  console.log('═'.repeat(50));
  
  const tester = new PerformanceE2ETest();
  const results = {
    loadTests: [],
    stressTest: null,
    spikeTest: null
  };
  
  try {
    // Check service health first
    const health = await tester.apiClient.get('/health');
    console.log('✅ Service health:', health.data.status);
    
    // Load tests with different concurrent users
    for (const users of PERFORMANCE_CONFIG.concurrentUsers) {
      const result = await tester.runLoadTest(users);
      results.loadTests.push({ users, ...result });
      
      // Pause between tests
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Stress test
    results.stressTest = await tester.runStressTest();
    
    // Spike test
    results.spikeTest = await tester.runSpikeTest();
    
    // Print results
    console.log('\n📊 Performance Test Results');
    console.log('═'.repeat(50));
    
    console.log('\n📈 Load Test Results:');
    for (const test of results.loadTests) {
      console.log(`\n${test.users} concurrent users:`);
      console.log(`  Success Rate: ${test.successRate}`);
      console.log(`  Throughput: ${test.throughput}`);
      console.log(`  Avg Response Time: ${test.responseTime.avg}`);
      console.log(`  P95 Response Time: ${test.responseTime.p95}`);
      console.log(`  P99 Response Time: ${test.responseTime.p99}`);
      
      // Check against targets
      const avgMs = parseFloat(test.responseTime.avg);
      const throughputNum = parseFloat(test.throughput);
      
      if (avgMs > PERFORMANCE_CONFIG.targetResponseTime) {
        console.log(`  ⚠️  Response time exceeds target (${PERFORMANCE_CONFIG.targetResponseTime}ms)`);
      }
      
      if (throughputNum < PERFORMANCE_CONFIG.targetThroughput) {
        console.log(`  ⚠️  Throughput below target (${PERFORMANCE_CONFIG.targetThroughput} req/min)`);
      }
    }
    
    console.log('\n💪 Stress Test Results:');
    console.log(`  Breaking point: ${results.stressTest.breakingPoint || 'Not found'} concurrent requests`);
    
    console.log('\n📈 Spike Test Results:');
    console.log('  Spike performance:', results.spikeTest.spike.successRate);
    console.log('  Recovery performance:', results.spikeTest.recovery.successRate);
    
    // Save detailed results
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, `performance-results-${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`\n📁 Detailed results saved to: ${filename}`);
    
  } catch (error) {
    console.error('\n❌ Performance test failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { PerformanceE2ETest, runPerformanceTests };