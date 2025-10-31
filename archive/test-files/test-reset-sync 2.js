require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const { getSyncManager } = require('./src/sync/sync-manager');

async function testResetSync() {
  console.log('🔄 ТЕСТ СИНХРОНИЗАЦИИ С ОБНУЛЕНИЕМ');
  console.log('='.repeat(50));
  
  // 1. Проверяем сколько сейчас клиентов с покупками
  const { count: beforeWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ДО ОБНУЛЕНИЯ:`);
  console.log(`   Клиентов с покупками: ${beforeWithSpent}`);
  
  // 2. Обнуляем total_spent у всех клиентов
  console.log('\n🔧 Обнуляем total_spent у всех клиентов...');
  const { error: updateError } = await supabase
    .from('clients')
    .update({ 
      total_spent: 0,
      visit_count: 0,
      loyalty_level: 'New'
    })
    .gte('id', 0);
    
  if (updateError) {
    console.error('Ошибка при обнулении:', updateError);
    process.exit(1);
  }
  
  // 3. Проверяем что все обнулилось
  const { count: zeroCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`   Обнулено. Клиентов с покупками: ${zeroCount}`);
  
  // 4. Запускаем синхронизацию через sync-manager
  console.log('\n🚀 Запускаем синхронизацию через sync-manager...');
  console.log(`   SYNC_CLIENT_VISITS = ${process.env.SYNC_CLIENT_VISITS}`);
  
  const syncManager = getSyncManager();
  const startTime = Date.now();
  
  const result = await syncManager.syncClients({ 
    syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true' 
  });
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`\n✅ Синхронизация завершена за ${duration} сек:`);
  console.log(`   Обработано: ${result.processed}`);
  console.log(`   Ошибок: ${result.errors}`);
  
  // 5. Проверяем результат
  const { count: afterWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  console.log(`\n📊 ПОСЛЕ СИНХРОНИЗАЦИИ:`);
  console.log(`   Клиентов с покупками: ${afterWithSpent}`);
  
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
  console.log('📈 РЕЗУЛЬТАТ:');
  console.log(`   Было с покупками: ${beforeWithSpent} → стало 0 → восстановлено ${afterWithSpent}`);
  
  if (afterWithSpent > 1000) {
    console.log('   ✅ СИНХРОНИЗАЦИЯ РАБОТАЕТ ПРАВИЛЬНО\!');
  } else {
    console.log('   ❌ ПРОБЛЕМА: восстановилось мало клиентов с покупками');
    console.log('   Ожидалось ~1222, получилось', afterWithSpent);
  }
  
  process.exit(0);
}

testResetSync().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});
