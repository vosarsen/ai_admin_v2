const { supabase } = require('./src/database/supabase');

async function checkTopClientsVisits() {
  console.log('🔍 ПРОВЕРКА ВИЗИТОВ ТОП КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Получаем топ клиентов
  const { data: topClients } = await supabase
    .from('clients')
    .select('id, name, yclients_id, visit_count')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(5);
  
  for (const client of topClients || []) {
    console.log(`\n📌 ${client.name} (ID: ${client.id}, YClients: ${client.yclients_id})`);
    console.log(`   visit_count: ${client.visit_count}`);
    
    // Проверяем визиты
    const { data: visits, count } = await supabase
      .from('visits')
      .select('*', { count: 'exact' })
      .eq('client_id', client.id)
      .limit(3);
    
    console.log(`   Визитов в таблице visits: ${count || 0}`);
    
    if (visits && visits.length > 0) {
      console.log('   Примеры визитов:');
      visits.forEach(v => {
        console.log(`     • ${v.visit_date}: ${v.service_names?.join(', ') || 'без услуг'}`);
      });
    } else {
      console.log('   ❌ Визиты не найдены в таблице visits');
      
      // Проверяем может быть визиты есть но не связаны
      const { data: unlinkedVisits } = await supabase
        .from('visits')
        .select('id, client_yclients_id, client_name, visit_date')
        .eq('client_yclients_id', client.yclients_id)
        .limit(3);
      
      if (unlinkedVisits && unlinkedVisits.length > 0) {
        console.log(`   ⚠️ Найдены несвязанные визиты по yclients_id:`);
        unlinkedVisits.forEach(v => {
          console.log(`     • ${v.visit_date}: client_name=${v.client_name}`);
        });
      }
    }
  }
  
  // Проверяем сколько всего визитов не связано
  const { count: unlinkedCount } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .is('client_id', null);
  
  console.log(`\n\n⚠️ Всего несвязанных визитов (client_id = null): ${unlinkedCount || 0}`);
}

checkTopClientsVisits().catch(console.error);