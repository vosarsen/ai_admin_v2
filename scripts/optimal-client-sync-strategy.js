#!/usr/bin/env node
/**
 * 🎯 OPTIMAL CLIENT SYNC STRATEGY
 * 
 * Анализирует API лимиты YClients и создает оптимальную стратегию
 * для синхронизации 1000 клиентов с историей визитов
 * 
 * API LIMITS:
 * - 200 запросов/минуту
 * - 5 запросов/секунду  
 * - Минимум 250ms между запросами
 * 
 * CURRENT STATUS:
 * - Уже синхронизировано: 100 клиентов
 * - Осталось: 900 клиентов
 * - Каждый клиент: ~0.5 сек + 300ms задержка = 800ms
 */

const syncConfig = require('../src/config/sync-config');

class OptimalSyncStrategy {
  constructor() {
    this.API_LIMITS = {
      REQUESTS_PER_MINUTE: 200,
      REQUESTS_PER_SECOND: 5,
      MIN_DELAY_MS: 250,
      VISIT_SYNC_DELAY_MS: 300,
      SAFE_MARGIN: 0.8 // 80% от лимита для безопасности
    };
    
    this.CURRENT_STATUS = {
      TOTAL_CLIENTS: 1000,
      SYNCED_CLIENTS: 100,
      REMAINING_CLIENTS: 900,
      TIME_PER_CLIENT_MS: 800 // 0.5s processing + 0.3s delay
    };
  }

  /**
   * Рассчитать оптимальные размеры батчей
   */
  calculateOptimalBatch() {
    console.log('🎯 CALCULATING OPTIMAL BATCH STRATEGY');
    console.log('=====================================\n');

    // Безопасные лимиты (80% от максимума)
    const safeRequestsPerMinute = Math.floor(this.API_LIMITS.REQUESTS_PER_MINUTE * this.API_LIMITS.SAFE_MARGIN);
    const safeRequestsPerSecond = Math.floor(this.API_LIMITS.REQUESTS_PER_SECOND * this.API_LIMITS.SAFE_MARGIN);
    
    console.log(`📊 API Limits Analysis:`);
    console.log(`   Raw limits: ${this.API_LIMITS.REQUESTS_PER_MINUTE}/min, ${this.API_LIMITS.REQUESTS_PER_SECOND}/sec`);
    console.log(`   Safe limits: ${safeRequestsPerMinute}/min, ${safeRequestsPerSecond}/sec`);
    console.log(`   Min delay: ${this.API_LIMITS.MIN_DELAY_MS}ms between requests\n`);

    // Рассчитать оптимальный размер батча
    const timePerClientSec = this.CURRENT_STATUS.TIME_PER_CLIENT_MS / 1000;
    const clientsPerMinute = Math.floor(60 / timePerClientSec);
    const optimalBatchSize = Math.min(safeRequestsPerMinute, clientsPerMinute, 100); // Не больше 100 за раз

    console.log(`⏱️ Time Analysis:`);
    console.log(`   Time per client: ${timePerClientSec}s`);
    console.log(`   Max clients per minute: ${clientsPerMinute}`);
    console.log(`   Optimal batch size: ${optimalBatchSize}\n`);

    return {
      batchSize: optimalBatchSize,
      safeRequestsPerMinute,
      clientsPerMinute,
      timePerClientSec
    };
  }

  /**
   * Создать расписание синхронизации
   */
  createSyncSchedule() {
    console.log('📅 SYNC SCHEDULE CALCULATION');
    console.log('=============================\n');

    const { batchSize, clientsPerMinute } = this.calculateOptimalBatch();
    
    const remainingClients = this.CURRENT_STATUS.REMAINING_CLIENTS;
    const totalBatches = Math.ceil(remainingClients / batchSize);
    const timePerBatchMinutes = Math.ceil(batchSize / clientsPerMinute);
    
    // Добавляем буферное время между батчами
    const bufferTimeMinutes = 2;
    const totalTimePerBatch = timePerBatchMinutes + bufferTimeMinutes;
    
    const totalTimeHours = Math.ceil((totalBatches * totalTimePerBatch) / 60);
    const totalTimeDays = Math.ceil(totalTimeHours / 24);

    console.log(`📈 Schedule Analysis:`);
    console.log(`   Remaining clients: ${remainingClients}`);
    console.log(`   Batch size: ${batchSize} clients`);
    console.log(`   Total batches needed: ${totalBatches}`);
    console.log(`   Time per batch: ${timePerBatchMinutes}min + ${bufferTimeMinutes}min buffer = ${totalTimePerBatch}min`);
    console.log(`   Total time: ~${totalTimeHours} hours (~${totalTimeDays} days)\n`);

    return {
      batchSize,
      totalBatches,
      timePerBatchMinutes: totalTimePerBatch,
      totalTimeHours,
      totalTimeDays
    };
  }

  /**
   * Предложить стратегии синхронизации
   */
  suggestStrategies() {
    console.log('💡 SYNC STRATEGIES');
    console.log('==================\n');

    const schedule = this.createSyncSchedule();
    
    console.log(`🚀 STRATEGY 1: Aggressive (Fast but risky)`);
    console.log(`   Batch size: 80 clients`);
    console.log(`   Frequency: Every 10 minutes`);
    console.log(`   Total time: ~2 hours`);
    console.log(`   Risk: High (near API limits)`);
    console.log(`   Command: node scripts/incremental-client-sync.js --batch-size=80 --interval=10\n`);

    console.log(`⚖️ STRATEGY 2: Balanced (Recommended)`);
    console.log(`   Batch size: ${schedule.batchSize} clients`);
    console.log(`   Frequency: Every ${schedule.timePerBatchMinutes} minutes`);
    console.log(`   Total time: ~${schedule.totalTimeHours} hours`);
    console.log(`   Risk: Low (80% of API limits)`);
    console.log(`   Command: node scripts/incremental-client-sync.js --batch-size=${schedule.batchSize} --interval=${schedule.timePerBatchMinutes}\n`);

    console.log(`🐌 STRATEGY 3: Conservative (Slow but very safe)`);
    console.log(`   Batch size: 50 clients`);
    console.log(`   Frequency: Every 30 minutes`);
    console.log(`   Total time: ~9 hours`);
    console.log(`   Risk: Very low (50% of API limits)`);
    console.log(`   Command: node scripts/incremental-client-sync.js --batch-size=50 --interval=30\n`);

    console.log(`🌙 STRATEGY 4: Night Mode (Background sync)`);
    console.log(`   Batch size: 25 clients`);
    console.log(`   Frequency: Every 60 minutes`);
    console.log(`   Total time: ~36 hours (1.5 days)`);
    console.log(`   Risk: Minimal (25% of API limits)`);
    console.log(`   Command: node scripts/incremental-client-sync.js --batch-size=25 --interval=60 --start-at=22:00\n`);
  }

  /**
   * Показать команды для мониторинга
   */
  showMonitoringCommands() {
    console.log('📊 MONITORING COMMANDS');
    console.log('======================\n');
    
    console.log(`# Check sync progress`);
    console.log(`node scripts/manual-sync.js status\n`);
    
    console.log(`# Monitor API usage in real-time`);
    console.log(`tail -f ~/.pm2/logs/sync-process-out.log | grep "API"\n`);
    
    console.log(`# Check database records`);
    console.log(`# Use MCP Supabase to query:`);
    console.log(`@supabase query_table table:clients select:"count(*)"\n`);
    
    console.log(`# Emergency stop`);
    console.log(`pkill -f "incremental-client-sync"`);
    console.log(`pm2 stop sync-process\n`);
  }

  /**
   * Запустить полный анализ
   */
  runFullAnalysis() {
    console.log('🎯 OPTIMAL CLIENT SYNC STRATEGY FOR 1000 CLIENTS');
    console.log('=================================================\n');
    
    this.calculateOptimalBatch();
    this.createSyncSchedule();
    this.suggestStrategies();
    this.showMonitoringCommands();
    
    console.log('✅ Analysis complete! Choose your preferred strategy above.');
  }
}

// Запуск анализа
if (require.main === module) {
  const strategy = new OptimalSyncStrategy();
  strategy.runFullAnalysis();
}

module.exports = { OptimalSyncStrategy };