const { supabase } = require('./src/database/supabase');

async function cleanVisits() {
  console.log('🗑️ Очищаем таблицу visits...');
  
  const { error } = await supabase
    .from('visits')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи
  
  if (error) {
    console.error('❌ Ошибка:', error);
  } else {
    console.log('✅ Таблица visits очищена');
  }
  
  // Проверяем
  const { count } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Записей в таблице visits: ${count || 0}`);
}

cleanVisits().catch(console.error);