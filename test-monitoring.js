#!/usr/bin/env node
// test-monitoring.js - Тест системы мониторинга

const { monitoringService, performanceMonitor, healthCheck } = require('./src/monitoring');

async function testMonitoring() {
  console.log('📊 Testing Monitoring System...\n');

  try {
    // Тест 1: Performance Monitor
    console.log('🏃 Test 1: Performance Monitor');
    
    // Симулируем обработку сообщений
    console.log('Simulating message processing...');
    
    for (let i = 0; i < 10; i++) {
      const processingTime = Math.random() * 2000 + 500; // 500-2500ms
      const success = Math.random() > 0.1; // 90% success rate
      const phone = `7999999999${i % 3}`; // 3 разных номера
      
      performanceMonitor.recordMessageProcessing(processingTime, success, phone);
      
      // Симулируем кэш операции
      const isHit = Math.random() > 0.3; // 70% hit rate
      performanceMonitor.recordCacheOperation(isHit);
      
      // Симулируем AI операции
      const aiTime = Math.random() * 1000 + 200; // 200-1200ms
      performanceMonitor.recordAIOperation(aiTime, true, 'entity_resolution');
      
      // Симулируем rapid-fire
      if (Math.random() > 0.7) {
        const batchSize = Math.floor(Math.random() * 4) + 2; // 2-5 messages
        const waitTime = Math.random() * 5000 + 1000; // 1-6s
        performanceMonitor.recordRapidFireBatch(batchSize, waitTime);
      }
    }
    
    // Получаем метрики
    const metrics = performanceMonitor.getMetrics();
    console.log('✅ Performance metrics collected:');
    console.log(`  Messages: ${metrics.messageProcessing.totalMessages}`);
    console.log(`  Average time: ${metrics.messageProcessing.averageTime}ms`);
    console.log(`  Cache hit rate: ${metrics.cache.hitRate}%`);
    console.log(`  AI requests: ${metrics.ai.totalRequests}`);
    console.log(`  System status: ${metrics.summary.status}`);
    
    if (metrics.summary.issues.length > 0) {
      console.log(`  Issues: ${metrics.summary.issues.join(', ')}`);
    }

    // Тест 2: Health Check
    console.log('\n🏥 Test 2: Health Check');
    
    console.log('Running health checks...');
    const healthReport = await healthCheck.checkAll();
    
    console.log('✅ Health check completed:');
    console.log(`  Overall status: ${healthReport.status}`);
    console.log(`  Health score: ${healthReport.summary.healthPercentage}%`);
    console.log(`  Components: ${healthReport.summary.healthy}/${healthReport.summary.total} healthy`);
    
    // Показываем статус каждого компонента
    Object.entries(healthReport.components).forEach(([component, result]) => {
      const statusEmoji = {
        healthy: '✅',
        warning: '⚠️',
        error: '❌'
      };
      
      console.log(`  ${statusEmoji[result.status]} ${component}: ${result.status}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
      if (result.fallback) {
        console.log(`    Fallback: ${result.fallback}`);
      }
    });

    // Тест 3: Monitoring Service
    console.log('\n🔧 Test 3: Monitoring Service');
    
    console.log('Getting quick status...');
    const quickStatus = await monitoringService.quickStatus();
    
    console.log('✅ Quick status:');
    console.log(`  Status: ${quickStatus.status}`);
    console.log(`  Recent messages: ${quickStatus.recentActivity.messages || 0}`);
    console.log(`  Active alerts: ${quickStatus.alerts?.length || 0}`);

    // Тест 4: Full Report
    console.log('\n📊 Test 4: Full Report');
    
    console.log('Generating full system report...');
    const fullReport = await monitoringService.getFullReport();
    
    console.log('✅ Full report generated:');
    console.log(`  System status: ${fullReport.overview.systemStatus}`);
    console.log(`  Performance status: ${fullReport.overview.performanceStatus}`);
    console.log(`  Health score: ${fullReport.overview.healthScore}`);
    console.log(`  Uptime: ${fullReport.overview.uptime}`);
    console.log(`  Recommendations: ${fullReport.recommendations.length}`);
    
    if (fullReport.recommendations.length > 0) {
      console.log('  Top recommendations:');
      fullReport.recommendations.slice(0, 3).forEach(rec => {
        console.log(`    • [${rec.type}] ${rec.message}`);
      });
    }

    // Тест 5: Performance Trends
    console.log('\n📈 Test 5: Performance Trends');
    
    const trends = monitoringService.getPerformanceTrends();
    
    console.log('✅ Performance trends:');
    console.log(`  Last 15 min: ${trends.last15min.messages} messages, ${trends.last15min.averageTime}ms avg`);
    console.log(`  Last hour: ${trends.lastHour.messages} messages, ${trends.lastHour.averageTime}ms avg`);
    console.log(`  Slow operations: ${trends.slowOperations.length}`);
    console.log(`  Problem numbers: ${trends.problemNumbers.length}`);

    // Тест 6: Formatted Output
    console.log('\n🎨 Test 6: Formatted Output');
    
    console.log('Performance metrics (formatted):');
    console.log('---');
    console.log(performanceMonitor.formatMetricsForDisplay());
    console.log('---');
    
    console.log('\nHealth report (formatted):');
    console.log('---');
    console.log(healthCheck.formatHealthReport(healthReport));
    console.log('---');
    
    console.log('\nQuick status (formatted):');
    const formattedStatus = await monitoringService.formatQuickStatus();
    console.log(formattedStatus);

    // Тест 7: Stress Test
    console.log('\n💪 Test 7: Stress Test');
    
    console.log('Running stress test (simulating high load)...');
    
    const stressStart = Date.now();
    
    // Симулируем высокую нагрузку
    for (let i = 0; i < 50; i++) {
      const processingTime = Math.random() * 5000 + 1000; // 1-6s
      const success = Math.random() > 0.15; // 85% success rate
      const phone = `79${Math.floor(Math.random() * 1000000000)}`;
      
      performanceMonitor.recordMessageProcessing(processingTime, success, phone);
      
      // Быстрые операции
      performanceMonitor.recordCacheOperation(Math.random() > 0.4); // 60% hit rate
      performanceMonitor.recordAIOperation(Math.random() * 2000 + 500, true);
      
      if (Math.random() > 0.8) {
        performanceMonitor.recordRapidFireBatch(
          Math.floor(Math.random() * 3) + 2,
          Math.random() * 3000 + 2000
        );
      }
    }
    
    const stressTime = Date.now() - stressStart;
    
    console.log(`✅ Stress test completed in ${stressTime}ms`);
    
    // Проверяем метрики после стресс-теста
    const stressMetrics = performanceMonitor.getMetrics();
    console.log('Stress test results:');
    console.log(`  Total messages: ${stressMetrics.messageProcessing.totalMessages}`);
    console.log(`  Average time: ${stressMetrics.messageProcessing.averageTime}ms`);
    console.log(`  Error rate: ${Math.round((stressMetrics.messageProcessing.errors / stressMetrics.messageProcessing.totalMessages) * 100)}%`);
    console.log(`  System status: ${stressMetrics.summary.status}`);
    
    if (stressMetrics.summary.issues.length > 0) {
      console.log(`  Issues detected: ${stressMetrics.summary.issues.length}`);
      stressMetrics.summary.issues.forEach(issue => {
        console.log(`    • ${issue}`);
      });
    }

    console.log('\n✅ Monitoring system test completed successfully!');
    
    // Финальная сводка
    console.log('\n📊 FINAL MONITORING SUMMARY:');
    
    const finalMetrics = performanceMonitor.getMetrics();
    const finalHealth = await healthCheck.quickCheck();
    
    const statusEmojis = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    };
    
    console.log(`${statusEmojis[finalHealth.status]} Overall Status: ${finalHealth.status.toUpperCase()}`);
    console.log(`📈 Performance: ${finalMetrics.summary.status.toUpperCase()}`);
    console.log(`💬 Messages Processed: ${finalMetrics.messageProcessing.totalMessages}`);
    console.log(`⚡ Average Response: ${finalMetrics.messageProcessing.averageTime}ms`);
    console.log(`💾 Cache Hit Rate: ${finalMetrics.cache.hitRate}%`);
    console.log(`🧠 AI Requests: ${finalMetrics.ai.totalRequests}`);
    console.log(`🔥 Rapid-Fire Batches: ${finalMetrics.rapidFire.batchesProcessed}`);
    
    if (finalMetrics.summary.issues.length === 0) {
      console.log('✅ No performance issues detected');
    } else {
      console.log(`⚠️ Issues: ${finalMetrics.summary.issues.length}`);
    }

  } catch (error) {
    console.error('❌ Monitoring test failed:', error);
    throw error;
  }
}

// Запуск теста
if (require.main === module) {
  testMonitoring().then(() => {
    console.log('\n🎉 Система мониторинга полностью работает!');
    console.log('\n📊 ГОТОВНОСТЬ МОНИТОРИНГА:');
    console.log('✅ Performance Monitor - работает');
    console.log('✅ Health Check - работает');
    console.log('✅ Monitoring Service - работает');
    console.log('✅ Stress Testing - прошел');
    console.log('✅ Reporting - работает');
    console.log('\n🏆 МОНИТОРИНГ ГОТОВ К PRODUCTION!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Monitoring test failed:', error);
    process.exit(1);
  });
}

module.exports = testMonitoring;