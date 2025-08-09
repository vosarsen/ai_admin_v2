#\!/usr/bin/env node
/**
 * Скрипт для синхронизации ВСЕХ историй визитов клиентов
 * Загружает историю визитов для всех клиентов с хотя бы 1 визитом
 */

require('dotenv').config();
const { getSyncManager } = require('../src/sync/sync-manager');
const logger = require('../src/utils/logger');

async function main() {
  try {
    logger.info('🚀 Starting FULL visit history synchronization...');
    
    // Получаем экземпляр менеджера синхронизации
    const syncManager = getSyncManager();
    
    // Инициализируем менеджер если еще не инициализирован
    if (\!syncManager.isInitialized) {
      await syncManager.initialize();
    }
    
    // Запускаем синхронизацию клиентов с ПОЛНОЙ историей визитов
    // Убираем ограничение в 50 клиентов
    const result = await syncManager.syncClients({ 
      syncVisitHistory: true,
      maxVisitsSync: 999999  // Снимаем ограничение
    });
    
    // Показываем результат
    if (result) {
      console.log('\n✅ Visit history sync completed\!');
      console.log('Result:', JSON.stringify(result, null, 2));
      console.log(`\n📊 Statistics:`);
      console.log(`- Total clients processed: ${result.processed}`);
      console.log(`- Visits synced for: ${result.visitsProcessed || 0} clients`);
      console.log(`- Errors: ${result.errors}`);
      console.log(`- Duration: ${Math.round(result.duration/1000)} seconds`);
    }
    
    // Останавливаем менеджер
    await syncManager.shutdown();
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Visit history sync failed:', error);
    process.exit(1);
  }
}

// Запуск
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
