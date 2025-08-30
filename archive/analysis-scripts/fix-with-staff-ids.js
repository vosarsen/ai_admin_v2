const { supabase } = require('./src/database/supabase');

async function fixWithStaffIds() {
  console.log('🔧 ИСПРАВЛЕНИЕ ДАННЫХ С ПРАВИЛЬНЫМИ ID МАСТЕРОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Получаем мастеров
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, name, yclients_id')
    .eq('company_id', 962302);
  
  // Создаем маппинг имя -> id
  const staffNameToId = {};
  const staffYclientsToId = {};
  
  staffList?.forEach(staff => {
    if (staff.name) staffNameToId[staff.name] = staff.id;
    if (staff.yclients_id) staffYclientsToId[staff.yclients_id] = staff.id;
  });
  
  console.log(`Загружено ${staffList?.length || 0} мастеров\n`);
  
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
    
    // Считаем мастеров (используем staff_yclients_id или staff_name)
    const staffCounts = {};
    visits.forEach(v => {
      let staffId = null;
      
      // Сначала пробуем по yclients_id
      if (v.staff_yclients_id && staffYclientsToId[v.staff_yclients_id]) {
        staffId = staffYclientsToId[v.staff_yclients_id];
      }
      // Потом по имени
      else if (v.staff_name && staffNameToId[v.staff_name]) {
        staffId = staffNameToId[v.staff_name];
      }
      
      if (staffId) {
        staffCounts[staffId] = (staffCounts[staffId] || 0) + 1;
      }
    });
    
    const favoriteStaffIds = Object.entries(staffCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => parseInt(id));
    
    // Обновляем клиента
    const updateData = {
      visit_history: visitHistory,
      last_services: lastServices
    };
    
    // Добавляем favorite_staff_ids только если есть данные
    if (favoriteStaffIds.length > 0) {
      updateData.favorite_staff_ids = favoriteStaffIds;
    }
    
    const { error } = await supabase
      .from('clients')
      .update(updateData)
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
    
    // Получаем имена мастеров по ID
    if (client.favorite_staff_ids && client.favorite_staff_ids.length > 0) {
      const { data: staffNames } = await supabase
        .from('staff')
        .select('name')
        .in('id', client.favorite_staff_ids);
      
      const names = staffNames?.map(s => s.name).join(', ') || 'неизвестные';
      console.log(`  • Любимые мастера: ${names} (ID: ${client.favorite_staff_ids.join(', ')})`);
    } else {
      console.log(`  • Любимые мастера: пусто`);
    }
  }
}

fixWithStaffIds().catch(console.error);