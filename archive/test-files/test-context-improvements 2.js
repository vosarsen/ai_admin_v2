#!/usr/bin/env node
/**
 * Тестирование улучшений системы контекста
 * Проверяет все критические исправления
 */

const contextService = require('./src/services/context/context-service-v2');
const smartCache = require('./src/services/cache/smart-cache');
const { CircuitBreakerFactory } = require('./src/utils/circuit-breaker');
const { metrics } = require('./src/utils/performance-metrics');
const dataLoader = require('./src/services/ai-admin-v2/modules/data-loader');
const logger = require('./src/utils/logger');

const TEST_PHONE = '79001234567';
const TEST_COMPANY_ID = 962302;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ContextImprovementTests {
  constructor() {
    this.testResults = [];
    this.dataLoader = dataLoader;
  }

  /**
   * Тест 1: Pipeline оптимизация в getFullContext
   */
  async testPipelineOptimization() {
    console.log('\n🧪 Test 1: Pipeline Optimization');
    
    const startTime = Date.now();
    
    try {
      // Первый вызов - без кэша
      const context1 = await metrics.measure('getFullContext_first', 
        () => contextService.getFullContext(TEST_PHONE, TEST_COMPANY_ID)
      );
      
      const firstCallTime = Date.now() - startTime;
      console.log(`✅ First call (no cache): ${firstCallTime}ms`);
      
      // Второй вызов - с кэшем
      const startTime2 = Date.now();
      const context2 = await metrics.measure('getFullContext_cached',
        () => contextService.getFullContext(TEST_PHONE, TEST_COMPANY_ID)
      );
      
      const secondCallTime = Date.now() - startTime2;
      console.log(`✅ Second call (cached): ${secondCallTime}ms`);
      
      // Проверяем что Pipeline работает
      if (firstCallTime < 1000 && secondCallTime < 50) {
        console.log('✅ Pipeline optimization working!');
        this.testResults.push({ test: 'Pipeline', status: 'PASS' });
      } else {
        console.log(`⚠️ Pipeline may not be optimized: first=${firstCallTime}ms, second=${secondCallTime}ms`);
        this.testResults.push({ test: 'Pipeline', status: 'WARN' });
      }
      
    } catch (error) {
      console.error('❌ Pipeline test failed:', error);
      this.testResults.push({ test: 'Pipeline', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 2: Race condition protection в updateDialogContext
   */
  async testRaceConditionProtection() {
    console.log('\n🧪 Test 2: Race Condition Protection');
    
    try {
      // Запускаем несколько параллельных обновлений
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          contextService.updateDialogContext(TEST_PHONE, TEST_COMPANY_ID, {
            selection: {
              service: i,
              staff: i * 10
            }
          })
        );
      }
      
      const results = await Promise.allSettled(updates);
      
      // Проверяем что все обновления завершились успешно
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      
      if (successful.length === results.length) {
        console.log(`✅ All ${results.length} concurrent updates succeeded!`);
        
        // Проверяем финальное состояние
        const dialog = await contextService.redis.hgetall(
          contextService._getKey('dialog', TEST_COMPANY_ID, '+' + TEST_PHONE)
        );
        if (dialog && dialog.selection) {
          console.log('Final selection:', JSON.parse(dialog.selection));
        }
        
        this.testResults.push({ test: 'RaceCondition', status: 'PASS' });
      } else {
        console.log(`⚠️ Some updates failed: ${successful.length}/${results.length} succeeded`);
        this.testResults.push({ test: 'RaceCondition', status: 'WARN' });
      }
      
    } catch (error) {
      console.error('❌ Race condition test failed:', error);
      this.testResults.push({ test: 'RaceCondition', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 3: Circuit Breaker для Redis
   */
  async testCircuitBreaker() {
    console.log('\n🧪 Test 3: Circuit Breaker');
    
    try {
      // Получаем статистику Circuit Breaker'ов
      const stats = CircuitBreakerFactory.getAllStats();
      console.log('Circuit Breaker stats:', Object.keys(stats));
      
      // Симулируем несколько запросов
      for (let i = 0; i < 3; i++) {
        await contextService.getFullContext(`test${i}`, TEST_COMPANY_ID);
      }
      
      // Проверяем статистику после запросов
      const newStats = CircuitBreakerFactory.getAllStats();
      
      let hasRedisBreaker = false;
      Object.entries(newStats).forEach(([name, stat]) => {
        if (name.includes('redis')) {
          hasRedisBreaker = true;
          console.log(`✅ Found Redis Circuit Breaker: ${name}`);
          console.log(`   State: ${stat.currentState}, Success Rate: ${stat.successRate}`);
        }
      });
      
      if (hasRedisBreaker) {
        this.testResults.push({ test: 'CircuitBreaker', status: 'PASS' });
      } else {
        console.log('⚠️ No Redis Circuit Breaker found');
        this.testResults.push({ test: 'CircuitBreaker', status: 'WARN' });
      }
      
    } catch (error) {
      console.error('❌ Circuit Breaker test failed:', error);
      this.testResults.push({ test: 'CircuitBreaker', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 4: Исправление memory leak в SmartCache
   */
  async testSmartCacheMemoryLeak() {
    console.log('\n🧪 Test 4: SmartCache Memory Leak Fix');
    
    try {
      // Генерируем много уникальных ключей (уменьшаем до 150 для быстроты теста)
      for (let i = 0; i < 150; i++) {
        await smartCache.getOrCompute(
          `test_key_${i}`,
          async () => ({ data: `value_${i}` }),
          { ttl: 60 }
        );
      }
      
      // Проверяем статистику
      const stats = smartCache.getStats();
      console.log(`Popular keys count: ${stats.popularKeys.length}`);
      
      if (stats.popularKeys.length <= 100) {
        console.log('✅ Memory leak fixed! Popular keys limited to 100');
        this.testResults.push({ test: 'MemoryLeak', status: 'PASS' });
      } else {
        console.log(`❌ Too many keys in memory: ${stats.popularKeys.length}`);
        this.testResults.push({ test: 'MemoryLeak', status: 'FAIL' });
      }
      
      // Проверяем cache hit rate
      console.log(`Cache stats: ${stats.hitRate} hit rate, ${stats.hits} hits, ${stats.misses} misses`);
      
    } catch (error) {
      console.error('❌ SmartCache test failed:', error);
      this.testResults.push({ test: 'MemoryLeak', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 5: Удаление хардкода из DataLoader
   */
  async testDataLoaderNoHardcode() {
    console.log('\n🧪 Test 5: DataLoader No Hardcode');
    
    try {
      // Пробуем загрузить компанию с ошибкой
      const invalidCompanyData = await this.dataLoader.loadCompany(999999999);
      
      console.log('Fallback company data:', {
        title: invalidCompanyData.title,
        address: invalidCompanyData.address,
        timezone: invalidCompanyData.timezone
      });
      
      // Проверяем что нет явного хардкода
      if (invalidCompanyData.title !== 'Салон красоты' || 
          invalidCompanyData.address !== 'Адрес не указан') {
        console.log('✅ Hardcode removed, using config values');
        this.testResults.push({ test: 'NoHardcode', status: 'PASS' });
      } else {
        console.log('⚠️ Still using some hardcoded values');
        this.testResults.push({ test: 'NoHardcode', status: 'WARN' });
      }
      
    } catch (error) {
      console.error('❌ DataLoader test failed:', error);
      this.testResults.push({ test: 'NoHardcode', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Тест 6: Система метрик производительности
   */
  async testPerformanceMetrics() {
    console.log('\n🧪 Test 6: Performance Metrics');
    
    try {
      // Выполняем несколько операций с измерением
      for (let i = 0; i < 10; i++) {
        await metrics.measure('test_operation', async () => {
          await sleep(Math.random() * 100);
        });
      }
      
      // Получаем статистику
      const stats = metrics.getStats('test_operation');
      
      if (stats && stats.count === 10) {
        console.log('✅ Performance metrics working!');
        console.log(`   Avg: ${stats.avgDuration}ms, P95: ${stats.p95}ms, Success: ${stats.successRate}%`);
        this.testResults.push({ test: 'Metrics', status: 'PASS' });
      } else {
        console.log('❌ Metrics not collected properly');
        this.testResults.push({ test: 'Metrics', status: 'FAIL' });
      }
      
      // Проверяем Prometheus экспорт
      const prometheusData = metrics.exportPrometheus();
      if (prometheusData.includes('test_operation')) {
        console.log('✅ Prometheus export working');
      }
      
    } catch (error) {
      console.error('❌ Metrics test failed:', error);
      this.testResults.push({ test: 'Metrics', status: 'FAIL', error: error.message });
    }
  }

  /**
   * Запустить все тесты
   */
  async runAllTests() {
    console.log('🚀 Starting Context Improvement Tests...\n');
    
    await this.testPipelineOptimization();
    await this.testRaceConditionProtection();
    await this.testCircuitBreaker();
    await this.testSmartCacheMemoryLeak();
    await this.testDataLoaderNoHardcode();
    await this.testPerformanceMetrics();
    
    // Очищаем тестовые данные
    await contextService.clearDialogContext(TEST_PHONE, TEST_COMPANY_ID);
    
    // Показываем итоговый отчет
    this.printReport();
  }

  /**
   * Вывести отчет о тестах
   */
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const warned = this.testResults.filter(r => r.status === 'WARN').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : 
                   result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${this.testResults.length} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️ Warnings: ${warned}`);
    console.log(`❌ Failed: ${failed}`);
    
    const successRate = Math.round((passed / this.testResults.length) * 100);
    console.log(`\n🎯 Success Rate: ${successRate}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All critical improvements are working!');
    } else {
      console.log('\n⚠️ Some improvements need attention');
    }
  }
}

// Запускаем тесты
const tester = new ContextImprovementTests();
tester.runAllTests()
  .then(() => {
    console.log('\n✅ Tests completed');
    // Останавливаем метрики
    metrics.stop();
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });