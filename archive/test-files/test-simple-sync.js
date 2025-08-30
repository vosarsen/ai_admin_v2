require('dotenv').config();
const { getSyncManager } = require('./src/sync/sync-manager');
const { supabase } = require('./src/database/supabase');

async function simpleTest() {
  console.log('🔄 ПРОСТОЙ ТЕСТ СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  // Обнуляем одного конкретного клиента
  console.log('\n1. Обнуляем Леонида (phone: 79035059524)...');
  
  await supabase
    .from('clients')
    .update({ 
      total_spent: 0, 
      visit_count: 0,
      loyalty_level: 'New'
    })
    .eq('phone', '79035059524');
  
  // Проверяем
  const { data: before } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .eq('phone', '79035059524')
    .single();
    
  console.log('   До синхронизации:', before);
  
  // Запускаем ТОЛЬКО синхронизацию клиентов (без инициализации)
  console.log('\n2. Запускаем синхронизацию БЕЗ инициализации sync-manager...');
  
  const syncManager = getSyncManager();
  
  // Синхронизируем только этого клиента если возможно
  // Или всех, но проверим результат для одного
  const result = await syncManager.syncClients({
    syncVisitHistory: false
  });
  
  console.log('   Результат:', result.success ? 'Успех' : 'Ошибка');
  console.log('   Обработано:', result.processed);
  
  // Проверяем результат
  const { data: after } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .eq('phone', '79035059524')
    .single();
    
  console.log('\n3. После синхронизации:', after);
  
  console.log('\n' + '='.repeat(50));
  if (after.total_spent > 0) {
    console.log('✅ СИНХРОНИЗАЦИЯ РАБОТАЕТ!');
    console.log(`   Восстановлено: ${after.total_spent} руб`);
  } else {
    console.log('❌ СИНХРОНИЗАЦИЯ НЕ РАБОТАЕТ');
    console.log('   total_spent остался 0');
  }
  
  process.exit(0);
}

simpleTest().catch(console.error);