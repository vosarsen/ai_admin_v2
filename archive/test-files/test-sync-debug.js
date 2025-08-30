require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const { getSyncManager } = require('./src/sync/sync-manager');

async function debugSync() {
  console.log('🔍 ОТЛАДКА СИНХРОНИЗАЦИИ');
  console.log('='.repeat(50));
  
  // Проверяем переменные окружения
  console.log('\n📋 Переменные окружения:');
  console.log('  YCLIENTS_BEARER_TOKEN:', process.env.YCLIENTS_BEARER_TOKEN ? '✅ Установлен' : '❌ НЕ установлен');
  console.log('  YCLIENTS_USER_TOKEN:', process.env.YCLIENTS_USER_TOKEN ? '✅ Установлен' : '❌ НЕ установлен');
  console.log('  YCLIENTS_COMPANY_ID:', process.env.YCLIENTS_COMPANY_ID);
  console.log('  SYNC_CLIENT_VISITS:', process.env.SYNC_CLIENT_VISITS);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  
  // Обнуляем несколько клиентов для теста
  console.log('\n🔧 Обнуляем 10 клиентов для теста...');
  const { error: resetError } = await supabase
    .from('clients')
    .update({ total_spent: 0, visit_count: 0 })
    .in('name', ['Леонид', 'Сергей', 'Алексей', 'Геннадий', 'Левон', 
                 'Евгений', 'Владимир', 'Александр', 'Максим', 'Дмитрий'])
    .gt('id', 0);
    
  if (resetError) {
    console.error('Ошибка обнуления:', resetError);
  }
  
  // Проверяем что обнулилось
  const { count: zeroCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .in('name', ['Леонид', 'Сергей', 'Алексей'])
    .eq('total_spent', 0);
    
  console.log(`  Обнулено клиентов: ${zeroCount}`);
  
  // ТЕСТ 1: Прямой вызов sync-manager (как в автоматическом режиме)
  console.log('\n📌 ТЕСТ 1: Прямой вызов через sync-manager');
  console.log('='.repeat(30));
  
  const syncManager1 = getSyncManager();
  
  // НЕ инициализируем, чтобы не запускать cron
  console.log('Вызываем: syncManager.syncClients({ syncVisitHistory: false })');
  
  const result1 = await syncManager1.syncClients({ 
    syncVisitHistory: false 
  });
  
  console.log('Результат:', {
    processed: result1.processed,
    errors: result1.errors
  });
  
  // Проверяем Леонида
  const { data: leonid1 } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .eq('name', 'Леонид')
    .eq('phone', '79035059524')
    .single();
    
  console.log('Леонид после sync-manager:', leonid1);
  
  // Ждем немного
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ТЕСТ 2: Обнуляем снова и пробуем как в manual-sync
  console.log('\n📌 ТЕСТ 2: Вызов как в manual-sync.js');
  console.log('='.repeat(30));
  
  // Обнуляем Леонида снова
  await supabase
    .from('clients')
    .update({ total_spent: 0, visit_count: 0 })
    .eq('name', 'Леонид')
    .eq('phone', '79035059524');
  
  // Создаем новый экземпляр sync-manager
  const syncManager2 = getSyncManager();
  
  // Инициализируем как в manual-sync
  if (!syncManager2.isInitialized) {
    await syncManager2.initialize();
  }
  
  console.log('Вызываем: syncManager.syncClients({ syncVisitHistory: process.env.SYNC_CLIENT_VISITS === "true" })');
  console.log('process.env.SYNC_CLIENT_VISITS === "true":', process.env.SYNC_CLIENT_VISITS === 'true');
  
  const result2 = await syncManager2.syncClients({ 
    syncVisitHistory: process.env.SYNC_CLIENT_VISITS === 'true'
  });
  
  console.log('Результат:', {
    processed: result2.processed,
    errors: result2.errors
  });
  
  // Проверяем Леонида
  const { data: leonid2 } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .eq('name', 'Леонид')
    .eq('phone', '79035059524')
    .single();
    
  console.log('Леонид после manual-sync способа:', leonid2);
  
  // Останавливаем sync-manager
  await syncManager2.shutdown();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 СРАВНЕНИЕ:');
  console.log('Тест 1 (sync-manager):', leonid1?.total_spent || 0);
  console.log('Тест 2 (manual-sync):', leonid2?.total_spent || 0);
  
  if (leonid1?.total_spent === leonid2?.total_spent && leonid2?.total_spent > 0) {
    console.log('✅ Оба метода работают одинаково!');
  } else {
    console.log('❌ Методы работают по-разному!');
    console.log('Нужно искать проблему глубже...');
  }
  
  process.exit(0);
}

debugSync().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});