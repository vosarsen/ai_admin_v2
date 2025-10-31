require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function testUpdate() {
  console.log('🔧 ТЕСТИРУЕМ ОБНОВЛЕНИЕ КОНКРЕТНОГО КЛИЕНТА');
  console.log('═══════════════════════════════════════════════════');
  
  // Берем клиента 17221 (Сергей) с пустыми данными
  const clientId = 17221;
  
  console.log('\nКлиент ID 17221 (Сергей):\n');
  
  // 1. Получаем визиты
  const { data: visits, error: visitsError } = await supabase
    .from('visits')
    .select('*')
    .eq('client_id', clientId)
    .order('visit_date', { ascending: false });
    
  if (visitsError) {
    console.log('❌ Ошибка получения визитов:', visitsError);
    return;
  }
    
  console.log('  • Найдено визитов: ' + (visits ? visits.length : 0));
  
  if (!visits || visits.length === 0) {
    console.log('  ❌ Визиты не найдены!');
    return;
  }
  
  // 2. Формируем данные для обновления
  const lastVisit = visits[0];
  const last_services = lastVisit.service_names || [];
  const last_service_ids = lastVisit.service_ids || [];
  
  // Любимые мастера
  const staffFrequency = {};
  visits.forEach(v => {
    if (v.staff_id) {
      staffFrequency[v.staff_id] = (staffFrequency[v.staff_id] || 0) + 1;
    }
  });
  
  const favorite_staff_ids = Object.entries(staffFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([staffId]) => parseInt(staffId));
  
  // История визитов
  const visit_history = visits.slice(0, 10).map(v => ({
    date: v.visit_date,
    services: v.service_names,
    staff: v.staff_name,
    cost: v.paid_amount || v.total_cost || 0,
    id: v.yclients_record_id
  }));
  
  // Статистика
  const visit_count = visits.length;
  const total_spent = visits.reduce((sum, v) => sum + (v.paid_amount || v.total_cost || 0), 0);
  const average_bill = visit_count > 0 ? Math.round(total_spent / visit_count) : 0;
  
  const updateData = {
    last_services,
    last_service_ids,
    favorite_staff_ids,
    visit_history,
    visit_count,
    total_spent,
    average_bill,
    first_visit_date: visits[visits.length - 1].visit_date,
    last_visit_date: visits[0].visit_date,
    last_sync_at: new Date().toISOString()
  };
  
  console.log('\n📝 Данные для обновления:');
  console.log('  • last_services: ' + JSON.stringify(last_services));
  console.log('  • favorite_staff_ids: ' + JSON.stringify(favorite_staff_ids));
  console.log('  • visit_history: ' + visit_history.length + ' записей');
  console.log('  • total_spent: ' + total_spent);
  
  // 3. Обновляем клиента
  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', clientId)
    .select();
    
  if (error) {
    console.log('\n❌ Ошибка обновления:', error);
  } else {
    console.log('\n✅ Клиент успешно обновлен!');
    console.log('  • last_services теперь: ' + JSON.stringify(data[0].last_services));
  }
}

testUpdate();