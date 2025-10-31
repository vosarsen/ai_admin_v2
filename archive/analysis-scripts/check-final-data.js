const { supabase } = require('./src/database/supabase');

async function checkFinalData() {
  console.log('\n📊 ПРОВЕРКА ФИНАЛЬНЫХ ДАННЫХ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Общая статистика
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  // Проверяем заполненность полей
  const { data: clientsWithData } = await supabase
    .from('clients')
    .select('id, name, visit_history, last_services, favorite_staff_ids')
    .eq('company_id', 962302)
    .not('visit_history', 'is', null)
    .not('last_services', 'is', null)
    .limit(10);
  
  console.log('📈 СТАТИСТИКА:');
  console.log(`  • Всего клиентов: ${totalClients}`);
  console.log(`  • Всего визитов: ${totalVisits}\n`);
  
  if (!clientsWithData || clientsWithData.length === 0) {
    console.log('❌ НЕТ клиентов с заполненными данными!\n');
    
    // Проверяем есть ли вообще данные в visit_history
    const { data: anyData } = await supabase
      .from('clients')
      .select('id, name, visit_history, last_services')
      .eq('company_id', 962302)
      .limit(5);
    
    console.log('Примеры данных в таблице clients:');
    for (const client of anyData || []) {
      console.log(`\n${client.name} (ID: ${client.id}):`);
      console.log(`  visit_history: ${JSON.stringify(client.visit_history)}`);
      console.log(`  last_services: ${JSON.stringify(client.last_services)}`);
    }
    
    // Проверяем связь visits -> clients
    const { data: visitsWithClients } = await supabase
      .from('visits')
      .select('client_id, service_names, visit_date')
      .not('client_id', 'is', null)
      .limit(5);
    
    console.log('\n\nПримеры визитов с client_id:');
    for (const visit of visitsWithClients || []) {
      console.log(`  Client ID ${visit.client_id}: ${visit.service_names?.join(', ')} (${visit.visit_date})`);
    }
    
  } else {
    console.log('✅ Клиенты с заполненными данными:');
    for (const client of clientsWithData) {
      console.log(`\n${client.name}:`);
      console.log(`  • История: ${client.visit_history?.length || 0} визитов`);
      console.log(`  • Услуги: ${client.last_services?.slice(0,2).join(', ')}`);
      console.log(`  • Мастера: ${client.favorite_staff_ids?.length || 0}`);
    }
  }
  
  // Проверяем конкретного клиента
  const { data: topClient } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(1)
    .single();
  
  if (topClient) {
    console.log(`\n\n🔍 ТОП КЛИЕНТ: ${topClient.name} (visit_count: ${topClient.visit_count})`);
    console.log(`  visit_history: ${topClient.visit_history ? topClient.visit_history.length + ' записей' : 'пусто'}`);
    console.log(`  last_services: ${topClient.last_services || 'пусто'}`);
    console.log(`  favorite_staff_ids: ${topClient.favorite_staff_ids || 'пусто'}`);
    
    // Проверяем его визиты
    const { count: hisVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', topClient.id);
    
    console.log(`  Визитов в таблице visits: ${hisVisits}`);
  }
}

checkFinalData().catch(console.error);