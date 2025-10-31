#!/usr/bin/env node

/**
 * Скрипт для ручной синхронизации истории визитов
 * Использование:
 *   node scripts/sync-visits.js                    # Синхронизировать всех клиентов
 *   node scripts/sync-visits.js --limit 10         # Только 10 клиентов
 *   node scripts/sync-visits.js --vip              # Только VIP клиентов
 *   node scripts/sync-visits.js --min-visits 5     # Клиенты с 5+ визитами
 */

require('dotenv').config();
const VisitsSync = require('../src/sync/visits-sync');
const logger = require('../src/utils/logger').child({ module: 'sync-visits-script' });

async function main() {
  try {
    logger.info('🚀 Starting visits synchronization script...');
    
    // Парсим аргументы командной строки
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--limit':
        case '-l':
          options.limit = parseInt(args[++i]) || 10;
          break;
        case '--vip':
        case '-v':
          options.onlyVip = true;
          break;
        case '--min-visits':
        case '-m':
          options.minVisits = parseInt(args[++i]) || 1;
          break;
        case '--help':
        case '-h':
          console.log(`
Синхронизация истории визитов из YClients в Supabase

Использование:
  node scripts/sync-visits.js [опции]

Опции:
  --limit, -l <число>      Ограничить количество клиентов для синхронизации
  --vip, -v                Синхронизировать только VIP и Gold клиентов
  --min-visits, -m <число> Минимальное количество визитов (по умолчанию: 1)
  --help, -h               Показать эту справку

Примеры:
  node scripts/sync-visits.js                    # Все клиенты
  node scripts/sync-visits.js --limit 10         # Первые 10 клиентов
  node scripts/sync-visits.js --vip              # Только VIP
  node scripts/sync-visits.js --min-visits 5     # Клиенты с 5+ визитами
  node scripts/sync-visits.js -l 20 -m 10        # 20 клиентов с 10+ визитами
          `);
          process.exit(0);
      }
    }
    
    logger.info('📋 Sync options:', options);
    
    // Создаем экземпляр синхронизатора
    const visitsSync = new VisitsSync();
    
    // Запускаем синхронизацию
    const result = await visitsSync.syncAll(options);
    
    if (result.success) {
      logger.info('✅ Synchronization completed successfully!', {
        clientsProcessed: result.clientsProcessed,
        visitsProcessed: result.visitsProcessed,
        errors: result.errors,
        duration: `${Math.round(result.duration / 1000)} seconds`
      });
      
      // Обновляем статистику
      await visitsSync.updateSyncStats();
      
    } else {
      logger.error('❌ Synchronization failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('❌ Fatal error in sync script:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Запускаем скрипт
main().then(() => {
  logger.info('👋 Script finished');
  process.exit(0);
}).catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});