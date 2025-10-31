#!/usr/bin/env node
/**
 * Проверка статуса автоматической синхронизации
 */

require('dotenv').config();
const { getSyncManager } = require('../src/sync/sync-manager');

async function checkSyncStatus() {
  console.log('🔍 ПРОВЕРКА СТАТУСА СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  const syncManager = getSyncManager();
  const status = await syncManager.getStatus();
  
  console.log('\n📊 Статус менеджера:');
  console.log('  Инициализирован:', status.initialized ? '✅' : '❌');
  console.log('  Выполняется сейчас:', status.running ? '🔄' : '⏸️');
  console.log('  Запланированных задач:', status.scheduledJobs);
  
  console.log('\n⏰ Расписание синхронизации (Moscow time):');
  Object.entries(status.schedule).forEach(([entity, cron]) => {
    const description = getScheduleDescription(entity, cron);
    console.log(`  ${entity}: ${description}`);
  });
  
  console.log('\n💡 Подсказки:');
  console.log('  - Синхронизация запускается автоматически при старте сервера');
  console.log('  - Для ручного запуска: node scripts/manual-sync.js [entity]');
  console.log('  - Логи: pm2 logs ai-admin-api');
  
  process.exit(0);
}

function getScheduleDescription(entity, cron) {
  const descriptions = {
    'services': '01:00 каждый день',
    'staff': '02:00 каждый день',
    'clients': '03:00 каждый день',
    'schedules': 'Каждые 4 часа',
    'company': '00:00 по воскресеньям'
  };
  return `${cron} (${descriptions[entity] || 'неизвестно'})`;
}

checkSyncStatus().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});