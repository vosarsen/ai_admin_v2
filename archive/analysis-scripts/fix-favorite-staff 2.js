const { supabase } = require('./src/database/supabase');

async function fixFavoriteStaff() {
  console.log('🔧 ИСПРАВЛЕНИЕ ДАННЫХ favorite_staff_ids');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Получаем всех клиентов с визитами
  const { data: visits } = await supabase
    .from('visits')
    .select('client_id, staff_name')
    .not('client_id', 'is', null)
    .not('staff_name', 'is', null);
  
  if (!visits || visits.length === 0) {
    console.log('Нет визитов для обработки');
    return;
  }
  
  // Группируем по клиентам
  const clientStaff = {};
  
  visits.forEach(visit => {
    if (!clientStaff[visit.client_id]) {
      clientStaff[visit.client_id] = {};
    }
    
    if (visit.staff_name) {
      clientStaff[visit.client_id][visit.staff_name] = 
        (clientStaff[visit.client_id][visit.staff_name] || 0) + 1;
    }
  });
  
  console.log(`Обрабатываем ${Object.keys(clientStaff).length} клиентов...\n`);
  
  let updated = 0;
  
  for (const [clientId, staffCounts] of Object.entries(clientStaff)) {
    // Сортируем и берем топ-3 мастеров
    const favoriteStaff = Object.entries(staffCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    
    if (favoriteStaff.length > 0) {
      const { error } = await supabase
        .from('clients')
        .update({ favorite_staff_ids: favoriteStaff })
        .eq('id', parseInt(clientId));
      
      if (!error) {
        updated++;
      }
    }
  }
  
  console.log(`✅ Обновлено ${updated} клиентов\n`);
  
  // Проверяем результат
  const { count: withStaff } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('favorite_staff_ids', 'eq', '[]');
  
  console.log(`Клиентов с любимыми мастерами: ${withStaff}`);
}

fixFavoriteStaff().catch(console.error);