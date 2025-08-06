require('dotenv').config();
const { getSyncManager } = require('./src/sync/sync-manager');

async function testFix() {
  console.log('🔧 ТЕСТ ИСПРАВЛЕННОЙ СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  const syncManager = getSyncManager();
  
  console.log('SYNC_CLIENT_VISITS =', process.env.SYNC_CLIENT_VISITS);
  console.log('Параметр syncVisitHistory будет:', process.env.SYNC_CLIENT_VISITS === 'true');
  
  console.log('\nЗапуск полной синхронизации (как будет в cron)...');
  const result = await syncManager.runFullSync();
  
  console.log('\n✅ Результат:');
  console.log('  Клиенты:', result.results.clients);
  
  process.exit(0);
}

testFix().catch(console.error);
