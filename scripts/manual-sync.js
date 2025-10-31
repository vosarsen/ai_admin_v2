#!/usr/bin/env node
/**
 * Скрипт для ручного запуска синхронизации данных YClients → Supabase
 * 
 * Использование:
 * node scripts/manual-sync.js              # Полная синхронизация
 * node scripts/manual-sync.js company      # Только компания
 * node scripts/manual-sync.js services     # Только услуги
 * node scripts/manual-sync.js staff        # Только мастера
 * node scripts/manual-sync.js clients      # Только клиенты
 * node scripts/manual-sync.js schedules    # Только расписания
 * node scripts/manual-sync.js status       # Показать статус
 */

require('dotenv').config();
const { getSyncManager } = require('../src/sync/sync-manager');
const logger = require('../src/utils/logger');

async function main() {
  const command = process.argv[2] || 'full';
  
  try {
    logger.info(`🚀 Starting manual sync: ${command}`);
    
    // Получаем экземпляр менеджера синхронизации
    const syncManager = getSyncManager();
    
    // Инициализируем менеджер если еще не инициализирован
    if (!syncManager.isInitialized) {
      await syncManager.initialize();
    }
    
    let result;
    
    switch (command) {
      case 'full':
        logger.info('Running full synchronization...');
        result = await syncManager.runFullSync();
        break;
        
      case 'company':
        logger.info('Syncing company data...');
        result = await syncManager.syncCompany();
        break;
        
      case 'services':
        logger.info('Syncing services...');
        result = await syncManager.syncServices();
        break;
        
      case 'staff':
        logger.info('Syncing staff...');
        result = await syncManager.syncStaff();
        break;
        
      case 'clients':
        logger.info('Syncing clients...');
        result = await syncManager.syncClients({ 
          syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true' 
        });
        break;
        
      case 'schedules':
        logger.info('Syncing schedules...');
        result = await syncManager.syncSchedules();
        break;
        
      case 'status':
        logger.info('Getting sync status...');
        result = await syncManager.getStatus();
        console.log('\n📊 Sync Status:');
        console.log('================\n');
        console.log(`Initialized: ${result.initialized}`);
        console.log(`Running: ${result.running}`);
        console.log(`Scheduled Jobs: ${result.scheduledJobs}`);
        console.log('\nSchedule:');
        Object.entries(result.schedule).forEach(([type, cron]) => {
          console.log(`  ${type}: ${cron}`);
        });
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('\nAvailable commands:');
        console.log('  full      - Full synchronization');
        console.log('  company   - Sync company info');
        console.log('  services  - Sync services');
        console.log('  staff     - Sync staff');
        console.log('  clients   - Sync clients');
        console.log('  schedules - Sync schedules');
        console.log('  status    - Show sync status');
        process.exit(1);
    }
    
    // Показываем результат
    if (result) {
      console.log('\n✅ Sync completed!');
      console.log('Result:', JSON.stringify(result, null, 2));
    }
    
    // Останавливаем менеджер
    await syncManager.shutdown();
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

// Запуск
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});