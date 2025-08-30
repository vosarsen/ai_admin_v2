const { supabase } = require('./src/database/supabase');

async function checkClientsData() {
  console.log('\n🔍 ПРОВЕРКА СИНХРОНИЗАЦИИ ДАННЫХ visits → clients');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Получаем клиентов с визитами
  const { data: clientsWithVisits } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  
  const uniqueClientIds = [...new Set(clientsWithVisits?.map(v => v.client_id))];
  console.log(`📊 Клиентов с визитами в таблице visits: ${uniqueClientIds.length}\n`);
  
  // Проверяем несколько клиентов
  const sampleIds = uniqueClientIds.slice(0, 10);
  
  console.log('📝 Проверка заполнения данных в clients (первые 10):');
  console.log('───────────────────────────────────────────────\n');
  
  let filled = 0;
  let empty = 0;
  
  for (const clientId of sampleIds) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, visit_history, last_services, favorite_staff_ids, total_spent')
      .eq('id', clientId)
      .single();
    
    if (client) {
      const hasHistory = client.visit_history && client.visit_history.length > 0;
      const hasServices = client.last_services && client.last_services.length > 0;
      const hasStaff = client.favorite_staff_ids && client.favorite_staff_ids.length > 0;
      
      const status = (hasHistory || hasServices || hasStaff) ? '✅' : '❌';
      
      console.log(`${status} ${client.name} (ID: ${client.id})`);
      console.log(`   • visit_history: ${client.visit_history?.length || 0} записей`);
      console.log(`   • last_services: ${client.last_services?.join(', ') || 'пусто'}`);
      console.log(`   • favorite_staff: ${client.favorite_staff_ids?.join(', ') || 'пусто'}`);
      console.log(`   • total_spent: ${client.total_spent || 0}₽`);
      console.log('');
      
      if (hasHistory || hasServices || hasStaff) filled++;
      else empty++;
    }
  }
  
  console.log(`📊 Из проверенных: ${filled} заполнены, ${empty} пустые\n`);
  
  // Общая статистика
  console.log('📈 ОБЩАЯ СТАТИСТИКА:');
  console.log('───────────────────────────────────────────────\n');
  
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: clientsWithHistory } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('visit_history', 'is', null);
  
  const { count: clientsWithServices } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('last_services', 'is', null);
  
  const { count: clientsWithStaff } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .not('favorite_staff_ids', 'is', null);
  
  const { count: clientsWithSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
  
  console.log(`• Всего клиентов: ${totalClients}`);
  console.log(`• С visit_history: ${clientsWithHistory} (${Math.round(clientsWithHistory/totalClients*100)}%)`);
  console.log(`• С last_services: ${clientsWithServices} (${Math.round(clientsWithServices/totalClients*100)}%)`);
  console.log(`• С favorite_staff_ids: ${clientsWithStaff} (${Math.round(clientsWithStaff/totalClients*100)}%)`);
  console.log(`• С total_spent > 0: ${clientsWithSpent} (${Math.round(clientsWithSpent/totalClients*100)}%)`);
  
  // Проверяем конкретного клиента с визитами
  const { data: alexey } = await supabase
    .from('clients')
    .select('*')
    .eq('id', 1453)
    .single();
  
  console.log('\n\n🔍 ДЕТАЛЬНАЯ ПРОВЕРКА (Алексей, ID: 1453):');
  console.log('───────────────────────────────────────────────\n');
  
  const { count: alexeyVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', 1453);
  
  console.log(`• Визитов в таблице visits: ${alexeyVisits}`);
  console.log(`• visit_history: ${alexey?.visit_history?.length || 0} записей`);
  console.log(`• last_services: ${JSON.stringify(alexey?.last_services || [])}`);
  console.log(`• favorite_staff_ids: ${JSON.stringify(alexey?.favorite_staff_ids || [])}`);
  console.log(`• total_spent: ${alexey?.total_spent || 0}₽`);
  console.log(`• visit_count: ${alexey?.visit_count || 0}`);
  
  // ВЫВОД
  console.log('\n\n💡 ВЫВОД:');
  console.log('═══════════════════════════════════════════════════\n');
  
  if (clientsWithHistory < uniqueClientIds.length) {
    console.log('⚠️ ДАННЫЕ НЕ ПОЛНОСТЬЮ СИНХРОНИЗИРОВАНЫ!');
    console.log(`   Только ${clientsWithHistory} клиентов имеют visit_history`);
    console.log(`   Но ${uniqueClientIds.length} клиентов имеют визиты в таблице visits`);
    console.log('\n📌 НУЖНО ЗАПУСТИТЬ ОБНОВЛЕНИЕ:');
    console.log('   node scripts/update-clients-from-visits.js');
  } else {
    console.log('✅ Данные синхронизированы!');
    console.log(`   ${clientsWithHistory} клиентов имеют заполненные данные`);
  }
}

checkClientsData().catch(console.error);