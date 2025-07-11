#!/usr/bin/env node
// scripts/manual-sync.js
// Скрипт для ручного запуска синхронизации данных YClients -> Supabase

const { syncManager } = require('../src/sync/sync-manager');
const logger = require('../src/utils/logger');

/**
 * Ручной запуск синхронизации
 * 
 * Использование:
 * node scripts/manual-sync.js              # Полная синхронизация
 * node scripts/manual-sync.js company      # Только компания
 * node scripts/manual-sync.js services     # Только услуги
 * node scripts/manual-sync.js staff        # Только мастера
 * node scripts/manual-sync.js clients      # Только клиенты
 * node scripts/manual-sync.js schedules    # Только расписание
 * node scripts/manual-sync.js appointments # Только записи
 * node scripts/manual-sync.js status       # Показать статус последней синхронизации
 */

async function main() {
  const command = process.argv[2] || 'full';
  
  try {
    logger.info(`🚀 Starting manual sync: ${command}`);
    
    // Инициализируем менеджер синхронизации
    await syncManager.initialize();
    
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
        result = await syncManager.syncClients();
        break;
        
      case 'schedules':
        logger.info('Syncing schedules...');
        result = await syncManager.syncSchedules();
        break;
        
      case 'appointments':
        logger.info('Syncing appointments...');
        result = await syncManager.syncAppointments();
        break;
        
      case 'status':
        logger.info('Getting sync status...');
        result = await syncManager.getSyncStatus();
        
        if (result.success) {
          console.log('\n📊 Sync Status:');
          console.log('================');
          
          Object.entries(result.status).forEach(([table, info]) => {
            const lastSync = info.last_sync_at ? new Date(info.last_sync_at) : null;
            const hoursAgo = lastSync ? 
              Math.round((Date.now() - lastSync.getTime()) / (1000 * 60 * 60)) : 
              'never';
            
            console.log(`\n${table}:`);
            console.log(`  Last sync: ${lastSync ? lastSync.toLocaleString() : 'never'} (${hoursAgo === 'never' ? 'never' : hoursAgo + ' hours ago'})`);
            console.log(`  Status: ${info.sync_status || 'unknown'}`);
            console.log(`  Records: ${info.records_processed || 0}`);
            if (info.error_message) {
              console.log(`  ❌ Error: ${info.error_message}`);
            }
          });
          
          console.log(`\nNext sync: ${result.nextSync ? new Date(result.nextSync).toLocaleString() : 'not scheduled'}`);
        }
        break;
        
      default:
        logger.error(`Unknown command: ${command}`);
        console.log('\nUsage:');
        console.log('  node scripts/manual-sync.js              # Full sync');
        console.log('  node scripts/manual-sync.js company      # Company only');
        console.log('  node scripts/manual-sync.js services     # Services only');
        console.log('  node scripts/manual-sync.js staff        # Staff only');
        console.log('  node scripts/manual-sync.js clients      # Clients only');
        console.log('  node scripts/manual-sync.js schedules    # Schedules only');
        console.log('  node scripts/manual-sync.js appointments # Appointments only');
        console.log('  node scripts/manual-sync.js status       # Show sync status');
        process.exit(1);
    }
    
    if (command !== 'status') {
      if (result.success) {
        logger.info('✅ Sync completed successfully');
        console.log(JSON.stringify(result, null, 2));
      } else {
        logger.error('❌ Sync failed:', result.error);
      }
    }
    
    // Останавливаем менеджер
    await syncManager.shutdown();
    process.exit(0);
    
  } catch (error) {
    logger.error('Manual sync failed:', error);
    process.exit(1);
  }
}

// Запускаем
main();