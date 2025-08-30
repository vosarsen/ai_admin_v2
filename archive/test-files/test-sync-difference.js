require('dotenv').config();
const { getSyncManager } = require('./src/sync/sync-manager');
const { supabase } = require('./src/database/supabase');

async function testDifference() {
  console.log('🔍 ТЕСТИРОВАНИЕ РАЗНИЦЫ В СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  // Проверим состояние базы ДО синхронизации
  const { count: beforeCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
  
  console.log(`\n📊 До синхронизации: ${beforeCount} клиентов с total_spent > 0`);
  
  const syncManager = getSyncManager();
  
  // Инициализируем если нужно
  if (!syncManager.isInitialized) {
    console.log('Инициализация sync manager...');
    // НЕ инициализируем, чтобы не запускать cron задачи
    // await syncManager.initialize();
  }
  
  console.log('\n1. Вызов как в sync-manager (без опций):');
  console.log('   await syncManager.syncClients()');
  const result1 = await syncManager.syncClients();
  console.log('   Обработано:', result1.processed, 'Ошибок:', result1.errors);
  
  // Проверим состояние после первой синхронизации
  const { count: afterCount1 } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
  console.log(`   После: ${afterCount1} клиентов с total_spent > 0`);
  
  // Ждем немного
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n2. Вызов как в manual-sync (с опциями):');
  console.log('   await syncManager.syncClients({ syncVisitHistory: false })');
  const result2 = await syncManager.syncClients({ 
    syncVisitHistory: false // Явно false для теста
  });
  console.log('   Обработано:', result2.processed, 'Ошибок:', result2.errors);
  
  // Проверим состояние после второй синхронизации
  const { count: afterCount2 } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
  console.log(`   После: ${afterCount2} клиентов с total_spent > 0`);
  
  console.log('\n📈 ИТОГИ:');
  console.log('   Было клиентов с покупками:', beforeCount);
  console.log('   После вызова без опций:', afterCount1);
  console.log('   После вызова с опциями:', afterCount2);
  
  // НЕ вызываем shutdown чтобы не остановить cron задачи если они были
  process.exit(0);
}

testDifference().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});