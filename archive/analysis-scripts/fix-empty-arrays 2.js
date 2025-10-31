const { supabase } = require('./src/database/supabase');

async function fixEmptyArrays() {
  console.log('🔧 ИСПРАВЛЕНИЕ ПУСТЫХ МАССИВОВ В ПОЛЯХ КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Получаем клиентов с визитами
  const { data: clientsWithVisits } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  
  const uniqueClientIds = [...new Set(clientsWithVisits?.map(v => v.client_id))];
  console.log(`Найдено ${uniqueClientIds.length} клиентов с визитами\n`);
  
  let updated = 0;
  let errors = 0;
  
  for (const clientId of uniqueClientIds) {
    // Получаем визиты клиента
    const { data: visits } = await supabase
      .from('visits')
      .select('*')
      .eq('client_id', clientId)
      .order('visit_date', { ascending: false });
    
    if (!visits || visits.length === 0) continue;
    
    // Формируем данные
    const visitHistory = visits.slice(0, 50).map(v => ({
      date: v.visit_date,
      time: v.visit_time,
      services: v.service_names || []
    }));
    
    const lastServices = visits[0]?.service_names || [];
    
    // Считаем мастеров
    const staffCounts = {};
    visits.forEach(v => {
      if (v.staff_name) {
        staffCounts[v.staff_name] = (staffCounts[v.staff_name] || 0) + 1;
      }
    });
    
    const favoriteStaff = Object.entries(staffCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    
    // Обновляем клиента
    const { error } = await supabase
      .from('clients')
      .update({
        visit_history: visitHistory,
        last_services: lastServices,
        favorite_staff_ids: favoriteStaff
      })
      .eq('id', clientId);
    
    if (error) {
      console.log(`❌ Ошибка для клиента ${clientId}: ${error.message}`);
      errors++;
    } else {
      updated++;
      if (updated % 10 === 0) {
        console.log(`  Обновлено ${updated} клиентов...`);
      }
    }
  }
  
  console.log(`\n✅ Обновлено ${updated} клиентов`);
  console.log(`❌ Ошибок: ${errors}\n`);
  
  // Проверяем результат
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, visit_history, last_services, favorite_staff_ids')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(5);
  
  console.log('📊 ПРОВЕРКА ТОП-5 КЛИЕНТОВ:');
  for (const client of topClients || []) {
    console.log(`\n${client.name}:`);
    console.log(`  • История: ${client.visit_history?.length || 0} записей`);
    console.log(`  • Последние услуги: ${client.last_services?.join(', ') || 'пусто'}`);
    console.log(`  • Любимые мастера: ${client.favorite_staff_ids?.join(', ') || 'пусто'}`);
  }
}

fixEmptyArrays().catch(console.error);