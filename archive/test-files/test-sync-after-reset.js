require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const { getSyncManager } = require('./src/sync/sync-manager');

async function testSync() {
  console.log('🔄 ТЕСТ СИНХРОНИЗАЦИИ ПОСЛЕ РУЧНОГО ОБНУЛЕНИЯ');
  console.log('='.repeat(50));
  
  // 1. Проверяем текущее состояние
  const { count: beforeCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ПЕРЕД СИНХРОНИЗАЦИЕЙ:`);
  console.log(`   Клиентов с покупками: ${beforeCount}`);
  
  // 2. Запускаем синхронизацию через sync-manager (как будет в cron)
  console.log('\n🚀 Запускаем синхронизацию через sync-manager...');
  console.log(`   Используется параметр: syncVisitHistory = ${process.env.SYNC_CLIENT_VISITS === 'true'}`);
  
  const syncManager = getSyncManager();
  const startTime = Date.now();
  
  // Вызываем так же как будет вызываться из cron
  const result = await syncManager.syncClients({ 
    syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true' 
  });
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`\n✅ Синхронизация завершена за ${duration} сек:`);
  console.log(`   Обработано: ${result.processed}`);
  console.log(`   Ошибок: ${result.errors}`);
  
  // 3. Проверяем результат
  const { count: afterCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ПОСЛЕ СИНХРОНИЗАЦИИ:`);
  console.log(`   Клиентов с покупками: ${afterCount}`);
  console.log(`   Восстановлено: ${afterCount - beforeCount} записей`);
  
  // 4. Проверяем топ клиентов
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, phone, total_spent, visit_count')
    .order('total_spent', { ascending: false })
    .limit(5);
    
  console.log('\n💰 ТОП-5 клиентов после синхронизации:');
  topClients.forEach((client, i) => {
    console.log(`   ${i+1}. ${client.name}: ${client.total_spent} руб (${client.visit_count} визитов)`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 ИТОГ:');
  
  if (afterCount >= 1200) {
    console.log(`   ✅ УСПЕХ! Восстановлено ${afterCount} клиентов с покупками`);
    console.log('   Синхронизация через sync-manager работает правильно!');
  } else {
    console.log(`   ⚠️ Восстановлено только ${afterCount} клиентов`);
    console.log('   Ожидалось ~1222 клиентов с покупками');
  }
  
  process.exit(0);
}

testSync().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});