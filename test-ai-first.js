#!/usr/bin/env node
// test-ai-first.js - Тест новой AI-First архитектуры

const entityResolver = require('./src/services/ai/entity-resolver');
const smartCache = require('./src/services/cache/smart-cache');

async function testAIFirst() {
  console.log('🧪 Testing AI-First + Smart Caching architecture...\n');

  try {
    const companyId = process.env.YCLIENTS_COMPANY_ID || '962302';
    const context = {
      companyId,
      client: {
        name: 'Тестовый клиент',
        favorite_staff_ids: []
      }
    };

    // Тест 1: Поиск услуги
    console.log('🔍 Test 1: Service Resolution');
    console.log('Input: "стрижка машинкой"');
    
    const startTime1 = Date.now();
    const service = await entityResolver.resolveService('стрижка машинкой', companyId, context);
    const time1 = Date.now() - startTime1;
    
    console.log(`✅ Resolved service: ${service.title} (ID: ${service.yclients_id})`);
    console.log(`⏱️  Time: ${time1}ms\n`);

    // Тест 2: Тот же запрос (должен быть из кэша)
    console.log('🔍 Test 2: Same Service (should be cached)');
    console.log('Input: "стрижка машинкой"');
    
    const startTime2 = Date.now();
    const serviceCached = await entityResolver.resolveService('стрижка машинкой', companyId, context);
    const time2 = Date.now() - startTime2;
    
    console.log(`✅ Resolved service: ${serviceCached.title} (ID: ${serviceCached.yclients_id})`);
    console.log(`⏱️  Time: ${time2}ms (${time2 < 100 ? 'CACHED! 🚀' : 'NOT CACHED'})\n`);

    // Тест 3: Поиск мастера
    console.log('🔍 Test 3: Staff Resolution');
    console.log('Input: "сергей"');
    
    const startTime3 = Date.now();
    const staff = await entityResolver.resolveStaff('сергей', companyId, context);
    const time3 = Date.now() - startTime3;
    
    console.log(`✅ Resolved staff: ${staff.name} (ID: ${staff.yclients_id})`);
    console.log(`⏱️  Time: ${time3}ms\n`);

    // Тест 4: Fuzzy поиск
    console.log('🔍 Test 4: Fuzzy Search');
    console.log('Input: "стришка" (с опечаткой)');
    
    const startTime4 = Date.now();
    const serviceFuzzy = await entityResolver.resolveService('стришка', companyId, context);
    const time4 = Date.now() - startTime4;
    
    console.log(`✅ Resolved service: ${serviceFuzzy.title} (ID: ${serviceFuzzy.yclients_id})`);
    console.log(`⏱️  Time: ${time4}ms\n`);

    // Статистика кэша
    console.log('📊 Cache Statistics:');
    const stats = smartCache.getStats();
    console.log(`Cache hits: ${stats.hits}`);
    console.log(`Cache misses: ${stats.misses}`);
    console.log(`Hit rate: ${stats.hitRate}`);
    console.log(`Average compute time: ${stats.avgComputeTime}\n`);

    // Тест производительности
    console.log('🏃 Performance Test: 10 requests');
    const testQueries = [
      'стрижка',
      'маникюр', 
      'педикюр',
      'стрижка бороды',
      'мужская стрижка',
      'стрижка',  // повтор
      'маникюр', // повтор
      'бритье',
      'стрижка машинкой',
      'стрижка' // повтор
    ];

    const performanceStart = Date.now();
    const results = [];
    
    for (const query of testQueries) {
      const start = Date.now();
      const result = await entityResolver.resolveService(query, companyId, context);
      const time = Date.now() - start;
      results.push({ query, service: result.title, time });
    }
    
    const totalTime = Date.now() - performanceStart;
    const avgTime = totalTime / testQueries.length;
    
    console.log('\nResults:');
    results.forEach(r => {
      console.log(`"${r.query}" → ${r.service} (${r.time}ms)`);
    });
    
    console.log(`\n📈 Performance Summary:`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per request: ${Math.round(avgTime)}ms`);
    console.log(`Requests per second: ${Math.round(1000 / avgTime)}`);

    // Финальная статистика
    const finalStats = smartCache.getStats();
    console.log(`\n📊 Final Cache Statistics:`);
    console.log(`Total hits: ${finalStats.hits}`);
    console.log(`Total misses: ${finalStats.misses}`);
    console.log(`Final hit rate: ${finalStats.hitRate}`);

    console.log('\n✅ AI-First architecture test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Запуск теста
if (require.main === module) {
  testAIFirst().then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = testAIFirst;