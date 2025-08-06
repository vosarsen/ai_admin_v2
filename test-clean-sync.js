require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const { getSyncManager } = require('./src/sync/sync-manager');

async function testCleanSync() {
  console.log('🧹 ТЕСТ ЧИСТОЙ СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  // 1. Проверяем сколько сейчас клиентов
  const { count: beforeCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });
  
  const { count: beforeWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ДО ОЧИСТКИ:`);
  console.log(`   Всего клиентов: ${beforeCount}`);
  console.log(`   С покупками (total_spent > 0): ${beforeWithSpent}`);
  
  // 2. Очищаем таблицу
  console.log('\n🗑️  Очищаем таблицу clients...');
  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .gte('id', 0); // Удаляем все записи
    
  if (deleteError) {
    console.error('Ошибка при очистке:', deleteError);
    process.exit(1);
  }
  
  // 3. Проверяем что таблица пустая
  const { count: emptyCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });
    
  console.log(`   Таблица очищена. Записей: ${emptyCount}`);
  
  // 4. Запускаем синхронизацию через sync-manager
  console.log('\n🔄 Запускаем синхронизацию через sync-manager...');
  console.log(`   SYNC_CLIENT_VISITS = ${process.env.SYNC_CLIENT_VISITS}`);
  
  const syncManager = getSyncManager();
  const result = await syncManager.syncClients({ 
    syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true' 
  });
  
  console.log(`\n✅ Синхронизация завершена:`);
  console.log(`   Обработано: ${result.processed}`);
  console.log(`   Ошибок: ${result.errors}`);
  
  // 5. Проверяем результат
  const { count: afterCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });
    
  const { count: afterWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ПОСЛЕ СИНХРОНИЗАЦИИ:`);
  console.log(`   Всего клиентов: ${afterCount}`);
  console.log(`   С покупками (total_spent > 0): ${afterWithSpent}`);
  
  // 6. Проверяем топ клиентов
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, phone, total_spent, visit_count')
    .order('total_spent', { ascending: false })
    .limit(5);
    
  console.log('\n💰 ТОП-5 клиентов:');
  topClients.forEach((client, i) => {
    console.log(`   ${i+1}. ${client.name}: ${client.total_spent} руб (${client.visit_count} визитов)`);
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 ИТОГ:');
  console.log(`   Должно быть ~1422 клиента и ~1222 с покупками`);
  console.log(`   Получилось: ${afterCount} клиентов и ${afterWithSpent} с покупками`);
  
  if (afterWithSpent > 1000) {
    console.log('   ✅ СИНХРОНИЗАЦИЯ РАБОТАЕТ ПРАВИЛЬНО\!');
  } else {
    console.log('   ❌ ПРОБЛЕМА: мало клиентов с покупками');
  }
  
  process.exit(0);
}

testCleanSync().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});
