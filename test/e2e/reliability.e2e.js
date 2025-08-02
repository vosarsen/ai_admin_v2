#!/usr/bin/env node

// test/e2e/reliability.e2e.js
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';
const API_KEY = process.env.API_KEY || 'test-api-key';

/**
 * E2E тесты для проверки надежности системы
 */
class ReliabilityE2ETest {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'X-API-Key': API_KEY
      }
    });
  }

  generateSignature(payload) {
    return 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async sendWebhook(message, from = '79001234567@c.us') {
    const payload = {
      id: `msg-${Date.now()}`,
      from,
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
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Тест 1: Обработка дубликатов сообщений
   */
  async testDuplicateHandling() {
    console.log('\n🔄 Testing duplicate message handling');
    
    const messageId = `msg-duplicate-${Date.now()}`;
    const payload = {
      id: messageId,
      from: '79001234567@c.us',
      body: 'Тест дубликатов',
      type: 'chat',
      timestamp: Math.floor(Date.now() / 1000)
    };

    const results = [];
    
    // Отправляем одно и то же сообщение 3 раза
    for (let i = 0; i < 3; i++) {
      const response = await this.apiClient.post('/webhook/whatsapp', payload, {
        headers: {
          'X-Hub-Signature': this.generateSignature(payload)
        }
      }).catch(e => ({ data: { error: e.message } }));
      
      results.push(response.data);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Проверяем, что только первое сообщение было обработано
    const processed = results.filter(r => r.queued).length;
    
    return {
      passed: processed === 1,
      message: `Processed ${processed}/3 duplicate messages`,
      results
    };
  }

  /**
   * Тест 2: Восстановление после сбоев
   */
  async testErrorRecovery() {
    console.log('\n🔧 Testing error recovery');
    
    const results = {
      malformedJson: false,
      emptyMessage: false,
      invalidSignature: false,
      recoveryAfterError: false
    };

    // Отправляем некорректный JSON
    try {
      await this.apiClient.post('/webhook/whatsapp', 'invalid json', {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature': 'invalid'
        }
      });
    } catch (error) {
      results.malformedJson = error.response?.status === 400;
    }

    // Отправляем пустое сообщение
    const emptyResponse = await this.sendWebhook('', '79001234567@c.us');
    results.emptyMessage = !emptyResponse.success;

    // Отправляем с неверной подписью
    try {
      await this.apiClient.post('/webhook/whatsapp', 
        { from: '79001234567@c.us', message: 'Test' },
        { headers: { 'X-Hub-Signature': 'wrong-signature' } }
      );
    } catch (error) {
      results.invalidSignature = error.response?.status === 401;
    }

    // Проверяем, что система работает после ошибок
    const validResponse = await this.sendWebhook('Проверка после ошибок');
    results.recoveryAfterError = validResponse.success;

    return {
      passed: Object.values(results).every(v => v),
      results
    };
  }

  /**
   * Тест 3: Обработка больших сообщений
   */
  async testLargeMessages() {
    console.log('\n📏 Testing large message handling');
    
    const results = [];
    const messageSizes = [100, 1000, 5000, 10000]; // символов
    
    for (const size of messageSizes) {
      const largeMessage = 'А'.repeat(size);
      const response = await this.sendWebhook(largeMessage);
      
      results.push({
        size,
        success: response.success,
        truncated: response.data?.truncated || false
      });
    }

    return {
      passed: results.every(r => r.success),
      results
    };
  }

  /**
   * Тест 4: Параллельная обработка от разных пользователей
   */
  async testConcurrentUsers() {
    console.log('\n👥 Testing concurrent users');
    
    const users = 10;
    const promises = [];
    
    for (let i = 0; i < users; i++) {
      const phone = `7900${i.toString().padStart(7, '0')}@c.us`;
      promises.push(this.sendWebhook(`Сообщение от пользователя ${i}`, phone));
    }
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successful = results.filter(r => r.success).length;
    
    return {
      passed: successful === users,
      totalUsers: users,
      successful,
      duration: `${duration}ms`,
      avgPerUser: `${(duration / users).toFixed(2)}ms`
    };
  }

  /**
   * Тест 5: Долгая сессия
   */
  async testLongSession() {
    console.log('\n⏱️  Testing long session handling');
    
    const sessionPhone = '79998887766@c.us';
    const messages = [
      { text: 'Привет', delay: 0 },
      { text: 'Хочу записаться', delay: 30000 }, // 30 сек
      { text: 'На маникюр', delay: 60000 }, // 1 мин
      { text: 'Завтра можно?', delay: 120000 }, // 2 мин
      { text: 'В 15:00', delay: 180000 } // 3 мин
    ];
    
    const results = [];
    
    for (const msg of messages) {
      if (msg.delay > 0) {
        console.log(`  Waiting ${msg.delay / 1000}s before next message...`);
        await new Promise(resolve => setTimeout(resolve, msg.delay));
      }
      
      const response = await this.sendWebhook(msg.text, sessionPhone);
      results.push({
        message: msg.text,
        success: response.success,
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      passed: results.every(r => r.success),
      totalMessages: messages.length,
      successful: results.filter(r => r.success).length,
      sessionDuration: '3+ minutes'
    };
  }

  /**
   * Тест 6: Обработка спецсимволов и эмодзи
   */
  async testSpecialCharacters() {
    console.log('\n🔤 Testing special characters and emoji');
    
    const testMessages = [
      'Привет! 😊',
      'Запись на 15:00 ⏰',
      'Маникюр + педикюр = ❤️',
      'Тест "кавычек" и \'апострофов\'',
      'Новая\nстрока\nв сообщении',
      'Спецсимволы: @#$%^&*()',
      '🇷🇺 Русский текст с флагом'
    ];
    
    const results = [];
    
    for (const msg of testMessages) {
      const response = await this.sendWebhook(msg);
      results.push({
        message: msg,
        success: response.success
      });
    }
    
    return {
      passed: results.every(r => r.success),
      results
    };
  }

  /**
   * Тест 7: Circuit Breaker
   */
  async testCircuitBreaker() {
    console.log('\n⚡ Testing circuit breaker');
    
    // Проверяем статус circuit breakers
    const cbStatus = await this.apiClient.get('/api/circuit-breakers')
      .catch(e => ({ data: { circuitBreakers: {} } }));
    
    return {
      passed: cbStatus.data.success !== false,
      circuitBreakers: cbStatus.data.circuitBreakers
    };
  }
}

// Главная функция
async function runReliabilityTests() {
  console.log('🛡️  AI Admin v2 Reliability E2E Tests');
  console.log('═'.repeat(50));
  
  const tester = new ReliabilityE2ETest();
  const testResults = [];
  
  try {
    // Проверяем здоровье сервиса
    const health = await tester.apiClient.get('/health');
    console.log('✅ Service is healthy:', health.data.status);
    
    // Запускаем тесты
    const tests = [
      { name: 'Duplicate Handling', fn: () => tester.testDuplicateHandling() },
      { name: 'Error Recovery', fn: () => tester.testErrorRecovery() },
      { name: 'Large Messages', fn: () => tester.testLargeMessages() },
      { name: 'Concurrent Users', fn: () => tester.testConcurrentUsers() },
      { name: 'Special Characters', fn: () => tester.testSpecialCharacters() },
      { name: 'Circuit Breaker', fn: () => tester.testCircuitBreaker() },
      // Long session test отключен по умолчанию из-за длительности
      // { name: 'Long Session', fn: () => tester.testLongSession() }
    ];
    
    for (const test of tests) {
      try {
        const result = await test.fn();
        testResults.push({
          name: test.name,
          passed: result.passed,
          details: result
        });
        
        console.log(`${result.passed ? '✅' : '❌'} ${test.name}`);
      } catch (error) {
        testResults.push({
          name: test.name,
          passed: false,
          error: error.message
        });
        console.log(`❌ ${test.name}: ${error.message}`);
      }
      
      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Итоговый отчет
    console.log('\n📊 Reliability Test Summary');
    console.log('═'.repeat(50));
    
    const passed = testResults.filter(t => t.passed).length;
    const total = testResults.length;
    const reliability = (passed / total * 100).toFixed(2);
    
    console.log(`Overall: ${passed}/${total} tests passed (${reliability}% reliability)`);
    
    for (const result of testResults) {
      if (!result.passed) {
        console.log(`\n❌ ${result.name} failed:`);
        console.log(JSON.stringify(result.details || result.error, null, 2));
      }
    }
    
    // Сохраняем результаты
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(__dirname, `reliability-results-${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(testResults, null, 2));
    console.log(`\n📁 Detailed results saved to: ${filename}`);
    
  } catch (error) {
    console.error('\n❌ Reliability test suite failed:', error);
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  runReliabilityTests().catch(console.error);
}

module.exports = { ReliabilityE2ETest, runReliabilityTests };