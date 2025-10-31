require('dotenv').config();
const { getSyncManager } = require('./src/sync/sync-manager');
const { supabase } = require('./src/database/supabase');

async function testOptimized() {
  console.log('🚀 ТЕСТ ОПТИМИЗИРОВАННОЙ СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  // Обнуляем несколько клиентов для теста
  console.log('\n1. Обнуляем топ-10 клиентов для теста...');
  
  await supabase
    .from('clients')
    .update({ 
      total_spent: 0, 
      visit_count: 0,
      loyalty_level: 'New'
    })
    .in('name', ['Леонид', 'Сергей', 'Алексей', 'Геннадий', 'Левон', 
                 'Евгений', 'Владимир', 'Александр', 'Максим', 'Дмитрий']);
  
  // Проверяем
  const { count: zeroCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('total_spent', 0);
    
  console.log(`   Обнулено клиентов: ${zeroCount}`);
  
  // Запускаем оптимизированную синхронизацию
  console.log('\n2. Запускаем ОПТИМИЗИРОВАННУЮ синхронизацию...');
  
  const syncManager = getSyncManager();
  const startTime = Date.now();
  
  const result = await syncManager.syncClients({
    syncVisitHistory: false
  });
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`\n✅ Синхронизация завершена за ${duration} секунд!`);
  console.log('   Обработано:', result.processed);
  console.log('   Ошибок:', result.errors);
  
  // Проверяем результат
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .order('total_spent', { ascending: false })
    .limit(5);
    
  console.log('\n💰 ТОП-5 клиентов после синхронизации:');
  topClients.forEach((client, i) => {
    console.log(`   ${i+1}. ${client.name}: ${client.total_spent} руб`);
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (duration < 60) {
    console.log('🚀 ОТЛИЧНО! Синхронизация теперь работает БЫСТРО!');
    console.log(`   Ускорение: с ~6 минут до ${duration} секунд`);
  } else if (duration < 120) {
    console.log('✅ Хорошо! Синхронизация работает достаточно быстро');
    console.log(`   Время: ${duration} секунд`);
  } else {
    console.log('⚠️ Синхронизация все еще медленная');
    console.log(`   Время: ${duration} секунд`);
  }
  
  process.exit(0);
}

testOptimized().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});