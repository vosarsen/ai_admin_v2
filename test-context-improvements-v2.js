#!/usr/bin/env node
/**
 * Тестирование всех улучшений системы контекста v2
 * Проверяет все внедрённые улучшения
 */

const contextService = require('./src/services/context/context-service-v2');
const smartCache = require('./src/services/cache/smart-cache');
const { metrics } = require('./src/utils/performance-metrics');
const dataLoader = require('./src/services/ai-admin-v2/modules/data-loader');
const logger = require('./src/utils/logger');

const TEST_PHONE = '79001234567';
const TEST_COMPANY_ID = 962302;

// Цвета для вывода
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

class ContextSystemTestsV2 {
  constructor() {
    this.testResults = [];
    this.testCount = 0;
    this.passedCount = 0;
  }

  /**
   * Запустить все тесты
   */
  async runAll() {
    console.log(`${colors.blue}🧪 Starting Context System v2 Tests${colors.reset}\n`);
    
    await this.testDataLoaderValidation();
    await this.testPhoneFormatConsistency();
    await this.testMemoryFallbackCache();
    await this.testMetadataSizeLimit();
    await this.testHealthCheck();
    await this.testUsageStats();
    await this.testRaceConditionProtection();
    
    this.printSummary();
  }

  /**
   * Тест 1: Проверка исправления validateInput в data-loader
   */
  async testDataLoaderValidation() {
    this.testCount++;
    console.log(`${colors.blue}Test 1: Data Loader Validation${colors.reset}`);
    
    try {
      // Тест валидации companyId
      const validCompanyId = dataLoader.validateInput(TEST_COMPANY_ID, 'companyId');
      if (validCompanyId !== TEST_COMPANY_ID) {
        throw new Error('Valid companyId validation failed');
      }
      
      // Тест невалидного companyId
      try {
        dataLoader.validateInput('invalid', 'companyId');
        throw new Error('Should have thrown for invalid companyId');
      } catch (e) {
        if (!e.message.includes('Invalid')) {
          throw e;
        }
      }
      
      // Тест валидации телефона
      const validPhone = dataLoader.validateInput('+79001234567', 'phone');
      if (!validPhone) {
        throw new Error('Valid phone validation failed');
      }
      
      // Тест saveContext с validateInput
      const testContext = {
        currentMessage: 'Test message',
        conversation: []
      };
      
      const testResult = {
        response: 'Test response',
        executedCommands: []
      };
      
      // Должно работать без ошибок
      await dataLoader.saveContext(TEST_PHONE, TEST_COMPANY_ID, testContext, testResult);
      
      console.log(`${colors.green}✅ Data Loader validation works correctly${colors.reset}`);
      this.passedCount++;
      this.testResults.push({ test: 'DataLoaderValidation', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Data Loader validation failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'DataLoaderValidation', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 2: Проверка согласованности форматов телефонов
   */
  async testPhoneFormatConsistency() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 2: Phone Format Consistency${colors.reset}`);
    
    try {
      // Тестируем разные форматы телефонов
      const formats = [
        '79001234567',
        '+79001234567',
        '79001234567@c.us',
        '+79001234567@c.us'
      ];
      
      const keys = new Set();
      
      for (const format of formats) {
        // Внутренний метод должен давать одинаковый результат
        const key = contextService._getKey('test', TEST_COMPANY_ID, format);
        keys.add(key);
      }
      
      // Все ключи должны быть одинаковыми
      if (keys.size !== 1) {
        throw new Error(`Inconsistent keys generated: ${Array.from(keys).join(', ')}`);
      }
      
      const normalizedKey = Array.from(keys)[0];
      console.log(`  Normalized key format: ${normalizedKey}`);
      
      // Проверяем что ключ не содержит + и @c.us
      if (normalizedKey.includes('+') || normalizedKey.includes('@')) {
        throw new Error('Key contains special characters that should be normalized');
      }
      
      console.log(`${colors.green}✅ Phone format consistency maintained${colors.reset}`);
      this.passedCount++;
      this.testResults.push({ test: 'PhoneFormatConsistency', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Phone format test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'PhoneFormatConsistency', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 3: Проверка memory fallback cache
   */
  async testMemoryFallbackCache() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 3: Memory Fallback Cache${colors.reset}`);
    
    try {
      const testKey = 'test_memory_fallback';
      const testData = { test: true, timestamp: Date.now() };
      
      // Сохраняем в memory cache напрямую
      smartCache._saveToMemoryCache(testKey, testData, 5000);
      
      // Проверяем что можем получить из memory cache
      const retrieved = smartCache._getFromMemoryCache(testKey);
      
      if (!retrieved || retrieved.test !== testData.test) {
        throw new Error('Memory cache save/retrieve failed');
      }
      
      // Проверяем TTL
      await new Promise(resolve => setTimeout(resolve, 5100));
      const expiredData = smartCache._getFromMemoryCache(testKey);
      
      if (expiredData !== null) {
        throw new Error('Memory cache TTL not working');
      }
      
      // Проверяем ограничение размера
      const oldMaxSize = smartCache.memoryCacheMaxSize;
      smartCache.memoryCacheMaxSize = 5;
      
      for (let i = 0; i < 10; i++) {
        smartCache._saveToMemoryCache(`test_${i}`, { i }, 60000);
      }
      
      if (smartCache.memoryCache.size > 5) {
        throw new Error('Memory cache size limit not enforced');
      }
      
      smartCache.memoryCacheMaxSize = oldMaxSize;
      
      console.log(`${colors.green}✅ Memory fallback cache works correctly${colors.reset}`);
      console.log(`  Memory cache size: ${smartCache.memoryCache.size}`);
      console.log(`  Fallback used count: ${smartCache.stats.memoryFallbackUsed}`);
      
      this.passedCount++;
      this.testResults.push({ test: 'MemoryFallbackCache', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Memory cache test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'MemoryFallbackCache', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 4: Проверка ограничения размера metadata
   */
  async testMetadataSizeLimit() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 4: Metadata Size Limit${colors.reset}`);
    
    try {
      // Создаём большой metadata объект (больше 1000 символов)
      const largeString = 'x'.repeat(500);
      const largeMetadata = {
        bigString: largeString,
        anotherBigString: 'y'.repeat(400),
        normalField: 'normal',
        objectField: { nested: { deep: 'value' } },
        arrayField: [1, 2, 3, 4, 5]
      };
      
      // Записываем метрику с большим metadata
      metrics._recordMetric('test_metric', {
        duration: 100,
        success: true,
        metadata: largeMetadata,
        timestamp: new Date().toISOString()
      });
      
      // Получаем записанную метрику
      const metric = metrics.metrics.get('test_metric');
      const lastEntry = metric.history[metric.history.length - 1];
      
      // Проверяем что metadata был обрезан
      if (!lastEntry.metadata._truncated) {
        throw new Error('Large metadata was not truncated');
      }
      
      if (lastEntry.metadata.bigString.length > 103) { // 100 + '...'
        throw new Error('String field was not truncated properly');
      }
      
      if (lastEntry.metadata.anotherBigString && lastEntry.metadata.anotherBigString.length > 103) {
        throw new Error('Second string field was not truncated properly');
      }
      
      if (lastEntry.metadata.objectField !== '[object]') {
        throw new Error('Object field was not replaced');
      }
      
      console.log(`${colors.green}✅ Metadata size limiting works${colors.reset}`);
      console.log(`  Original string length: ${largeString.length}`);
      console.log(`  Truncated string length: ${lastEntry.metadata.bigString.length}`);
      
      this.passedCount++;
      this.testResults.push({ test: 'MetadataSizeLimit', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Metadata limit test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'MetadataSizeLimit', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 5: Проверка health check
   */
  async testHealthCheck() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 5: Health Check${colors.reset}`);
    
    try {
      const health = await contextService.healthCheck();
      
      if (!health.status || !health.checks) {
        throw new Error('Health check returned invalid structure');
      }
      
      console.log(`  Overall status: ${health.status}`);
      console.log(`  Redis status: ${health.checks.redis.status}`);
      
      if (health.checks.redis.status === 'healthy') {
        console.log(`    Response time: ${health.checks.redis.responseTime}`);
      }
      
      if (health.checks.memory) {
        console.log(`  Memory status: ${health.checks.memory.status}`);
        console.log(`    Usage: ${health.checks.memory.usage}`);
        console.log(`    Total keys: ${health.checks.memory.totalKeys}`);
      }
      
      if (health.checks.performance) {
        console.log(`  Performance status: ${health.checks.performance.status}`);
        console.log(`    Write time: ${health.checks.performance.writeTime}`);
        console.log(`    Read time: ${health.checks.performance.readTime}`);
      }
      
      console.log(`${colors.green}✅ Health check system works${colors.reset}`);
      this.passedCount++;
      this.testResults.push({ test: 'HealthCheck', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Health check test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'HealthCheck', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 6: Проверка usage stats
   */
  async testUsageStats() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 6: Usage Statistics${colors.reset}`);
    
    try {
      // Создаём тестовые данные
      await contextService.updateDialogContext(TEST_PHONE, TEST_COMPANY_ID, {
        state: 'test',
        selection: { service: 'test' }
      });
      
      await contextService.saveClientCache(TEST_PHONE, TEST_COMPANY_ID, {
        id: 1,
        name: 'Test Client'
      });
      
      await contextService.addMessage(TEST_PHONE, TEST_COMPANY_ID, {
        role: 'user',
        content: 'Test message'
      });
      
      // Получаем статистику
      const stats = await contextService.getUsageStats(TEST_COMPANY_ID);
      
      if (!stats) {
        throw new Error('Usage stats returned null');
      }
      
      console.log(`  Total contexts: ${stats.totalContexts}`);
      console.log(`  Active dialogs: ${stats.activeDialogs}`);
      console.log(`  Cached clients: ${stats.cachedClients}`);
      console.log(`  Message histories: ${stats.messageHistories}`);
      console.log(`  Average context size: ${stats.avgContextSize} bytes`);
      
      if (stats.totalContexts === 0) {
        throw new Error('No contexts found in usage stats');
      }
      
      console.log(`${colors.green}✅ Usage statistics collection works${colors.reset}`);
      this.passedCount++;
      this.testResults.push({ test: 'UsageStats', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Usage stats test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'UsageStats', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 7: Проверка защиты от race conditions
   */
  async testRaceConditionProtection() {
    this.testCount++;
    console.log(`\n${colors.blue}Test 7: Race Condition Protection${colors.reset}`);
    
    try {
      const updates = [];
      const updateCount = 10;
      
      // Запускаем параллельные обновления
      for (let i = 0; i < updateCount; i++) {
        updates.push(
          contextService.updateDialogContext(TEST_PHONE, TEST_COMPANY_ID, {
            state: `state_${i}`,
            selection: {
              service: `service_${i}`,
              staff: i
            }
          })
        );
      }
      
      const results = await Promise.allSettled(updates);
      
      // Подсчитываем успешные обновления
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      
      console.log(`  Parallel updates: ${updateCount}`);
      console.log(`  Successful updates: ${successful.length}`);
      
      if (successful.length < updateCount * 0.8) {
        throw new Error('Too many updates failed due to race conditions');
      }
      
      // Проверяем финальное состояние
      const finalContext = await contextService.getDialogContext(TEST_PHONE, TEST_COMPANY_ID);
      
      if (!finalContext) {
        throw new Error('Final context is null after updates');
      }
      
      console.log(`  Final state: ${finalContext.state}`);
      console.log(`  Final selection service: ${finalContext.selection?.service}`);
      
      console.log(`${colors.green}✅ Race condition protection works${colors.reset}`);
      this.passedCount++;
      this.testResults.push({ test: 'RaceConditionProtection', status: 'PASS' });
      
    } catch (error) {
      console.error(`${colors.red}❌ Race condition test failed:${colors.reset}`, error.message);
      this.testResults.push({ test: 'RaceConditionProtection', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Вывести итоговую статистику
   */
  printSummary() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${colors.blue}📊 Test Results Summary${colors.reset}`);
    console.log(`${'='.repeat(50)}`);
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      const color = result.status === 'PASS' ? colors.green : colors.red;
      console.log(`${icon} ${result.test}: ${color}${result.status}${colors.reset}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n${'='.repeat(50)}`);
    const successRate = Math.round((this.passedCount / this.testCount) * 100);
    const summaryColor = successRate === 100 ? colors.green : 
                         successRate >= 80 ? colors.yellow : 
                         colors.red;
    
    console.log(`Total: ${this.passedCount}/${this.testCount} tests passed`);
    console.log(`Success Rate: ${summaryColor}${successRate}%${colors.reset}`);
    
    if (successRate === 100) {
      console.log(`\n${colors.green}🎉 All tests passed! Context system v2 improvements are working correctly.${colors.reset}`);
    } else if (successRate >= 80) {
      console.log(`\n${colors.yellow}⚠️ Most tests passed, but some issues need attention.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}⚠️ Multiple tests failed. Please review the errors above.${colors.reset}`);
    }
    
    console.log(`${'='.repeat(50)}\n`);
    
    // Cleanup
    this.cleanup();
  }

  /**
   * Очистка после тестов
   */
  async cleanup() {
    try {
      // Очищаем тестовые данные
      await contextService.clearDialogContext(TEST_PHONE, TEST_COMPANY_ID);
      
      // Останавливаем сбор метрик
      metrics.stop();
      
      console.log(`${colors.blue}Cleanup completed${colors.reset}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    // Завершаем процесс
    process.exit(this.passedCount === this.testCount ? 0 : 1);
  }
}

// Запуск тестов
async function main() {
  const tester = new ContextSystemTestsV2();
  await tester.runAll();
}

main().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});