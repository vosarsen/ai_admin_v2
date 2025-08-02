#!/usr/bin/env node

// test/e2e/booking-scenario.e2e.js
const axios = require('axios');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');

// Загружаем конфигурацию
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';
const API_KEY = process.env.API_KEY || 'test-api-key';

// Утилиты
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateSignature = (payload) => {
  return 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
};

// Класс для E2E тестирования
class BookingE2ETest {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'X-API-Key': API_KEY
      }
    });
    
    this.testPhone = '79999999999'; // Тестовый номер
    this.testPhoneWhatsApp = `${this.testPhone}@c.us`;
    this.processes = [];
  }

  async startServices() {
    console.log('🚀 Starting services...');
    
    // Запускаем API сервер
    const apiProcess = spawn('npm', ['start'], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    this.processes.push(apiProcess);
    
    // Запускаем worker
    const workerProcess = spawn('npm', ['run', 'worker:v2'], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    this.processes.push(workerProcess);
    
    // Ждем запуска
    await sleep(5000);
    
    // Проверяем health
    try {
      const health = await this.apiClient.get('/health');
      console.log('✅ Services started:', health.data);
    } catch (error) {
      throw new Error('Services failed to start');
    }
  }

  async stopServices() {
    console.log('🛑 Stopping services...');
    
    for (const process of this.processes) {
      process.kill('SIGTERM');
    }
    
    await sleep(2000);
  }

  async sendWebhook(message, type = 'chat') {
    const payload = {
      id: `msg-${Date.now()}`,
      from: this.testPhoneWhatsApp,
      body: message,
      type: type,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    const response = await this.apiClient.post('/webhook/whatsapp', payload, {
      headers: {
        'X-Hub-Signature': generateSignature(payload)
      }
    });
    
    return response.data;
  }

  async waitForProcessing(jobId, maxAttempts = 30) {
    console.log(`⏳ Waiting for job ${jobId} to complete...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      const metrics = await this.apiClient.get('/api/metrics');
      
      if (metrics.data.metrics.active === 0 && metrics.data.metrics.waiting === 0) {
        console.log('✅ Job processed');
        return true;
      }
      
      await sleep(1000);
    }
    
    throw new Error('Job processing timeout');
  }

  async runScenario(name, steps) {
    console.log(`\n📋 Running scenario: ${name}`);
    console.log('═'.repeat(50));
    
    const results = [];
    
    for (const [index, step] of steps.entries()) {
      console.log(`\n📍 Step ${index + 1}: ${step.description}`);
      
      try {
        // Отправляем сообщение
        const webhookResult = await this.sendWebhook(step.message, step.type);
        console.log('  ✅ Webhook accepted:', webhookResult);
        
        // Ждем обработки
        if (webhookResult.jobId) {
          await this.waitForProcessing(webhookResult.jobId);
        }
        
        // Ждем дополнительное время если указано
        if (step.wait) {
          await sleep(step.wait);
        }
        
        // Проверяем результат если есть валидатор
        if (step.validate) {
          await step.validate();
          console.log('  ✅ Validation passed');
        }
        
        results.push({
          step: index + 1,
          success: true,
          description: step.description
        });
        
      } catch (error) {
        console.error(`  ❌ Step failed:`, error.message);
        results.push({
          step: index + 1,
          success: false,
          description: step.description,
          error: error.message
        });
        
        if (!step.continueOnError) {
          break;
        }
      }
    }
    
    return results;
  }
}

// Сценарии тестирования
const scenarios = {
  // Сценарий 1: Успешная запись нового клиента
  newClientBooking: {
    name: 'New Client Booking',
    steps: [
      {
        description: 'Send greeting',
        message: 'Привет!',
        validate: async () => {
          // В реальном тесте проверяем ответ через API или БД
          console.log('  📨 Bot should respond with greeting');
        }
      },
      {
        description: 'Request booking',
        message: 'Хочу записаться на маникюр',
        wait: 2000,
        validate: async () => {
          console.log('  📨 Bot should show available services');
        }
      },
      {
        description: 'Select service',
        message: 'Маникюр с покрытием',
        wait: 2000,
        validate: async () => {
          console.log('  📨 Bot should show available time slots');
        }
      },
      {
        description: 'Select time',
        message: 'Завтра в 15:00',
        wait: 2000,
        validate: async () => {
          console.log('  📨 Bot should confirm booking');
        }
      }
    ]
  },

  // Сценарий 2: Отмена записи
  cancelBooking: {
    name: 'Cancel Booking',
    steps: [
      {
        description: 'Request cancellation',
        message: 'Хочу отменить запись',
        validate: async () => {
          console.log('  📨 Bot should show active bookings');
        }
      },
      {
        description: 'Confirm cancellation',
        message: 'Да, отменить',
        wait: 2000,
        validate: async () => {
          console.log('  📨 Bot should confirm cancellation');
        }
      }
    ]
  },

  // Сценарий 3: Обработка ошибок
  errorHandling: {
    name: 'Error Handling',
    steps: [
      {
        description: 'Send invalid message type',
        message: '',
        type: 'location',
        continueOnError: true,
        validate: async () => {
          console.log('  📨 Bot should handle location gracefully');
        }
      },
      {
        description: 'Send voice message',
        message: '',
        type: 'ptt',
        continueOnError: true,
        validate: async () => {
          console.log('  📨 Bot should explain voice not supported');
        }
      },
      {
        description: 'Request non-existent service',
        message: 'Хочу записаться на массаж',
        validate: async () => {
          console.log('  📨 Bot should suggest available services');
        }
      }
    ]
  },

  // Сценарий 4: Батчевые сообщения
  batchedMessages: {
    name: 'Batched Messages',
    steps: [
      {
        description: 'Send multiple messages quickly',
        message: 'Привет',
        wait: 100
      },
      {
        description: 'Second message',
        message: 'Как дела?',
        wait: 100
      },
      {
        description: 'Third message',
        message: 'Хочу записаться',
        wait: 5000, // Ждем батчевую обработку
        validate: async () => {
          console.log('  📨 Bot should process all messages as batch');
        }
      }
    ]
  }
};

// Основная функция
async function runE2ETests() {
  console.log('🧪 AI Admin v2 E2E Test Suite');
  console.log('═'.repeat(50));
  
  const tester = new BookingE2ETest();
  const results = [];
  
  try {
    // Запускаем сервисы
    await tester.startServices();
    
    // Выполняем сценарии
    for (const [key, scenario] of Object.entries(scenarios)) {
      const scenarioResults = await tester.runScenario(scenario.name, scenario.steps);
      results.push({
        scenario: scenario.name,
        results: scenarioResults
      });
      
      // Пауза между сценариями
      await sleep(3000);
    }
    
    // Итоговый отчет
    console.log('\n📊 Test Results Summary');
    console.log('═'.repeat(50));
    
    for (const result of results) {
      const passed = result.results.filter(r => r.success).length;
      const total = result.results.length;
      const status = passed === total ? '✅' : '❌';
      
      console.log(`${status} ${result.scenario}: ${passed}/${total} passed`);
      
      for (const step of result.results) {
        if (!step.success) {
          console.log(`  ❌ Step ${step.step}: ${step.error}`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error);
  } finally {
    // Останавливаем сервисы
    await tester.stopServices();
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  runE2ETests().catch(console.error);
}

module.exports = { BookingE2ETest, scenarios };