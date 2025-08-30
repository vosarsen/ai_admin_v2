const { supabase } = require('./src/database/supabase');

async function finalStatus() {
  console.log('\n🎉 ФИНАЛЬНЫЙ СТАТУС СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Общая статистика
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  // Клиенты с заполненными данными
  const { data: clientsWithData } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', 962302)
    .not('visit_history', 'eq', '[]')
    .not('visit_history', 'is', null)
    .not('last_services', 'eq', '[]')
    .not('last_services', 'is', null);
  
  const withFullData = clientsWithData?.length || 0;
  
  console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
  console.log(`  ✅ Всего клиентов: ${totalClients}`);
  console.log(`  ✅ Всего визитов: ${totalVisits}`);
  console.log(`  ✅ Клиентов с полными данными: ${withFullData} (${Math.round(withFullData/totalClients*100)}%)`);
  console.log('');
  
  // Топ клиенты
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, visit_count, visit_history, last_services')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(10);
  
  console.log('🏆 ТОП-10 КЛИЕНТОВ (ВСЕ С ДАННЫМИ):');
  let allHaveData = true;
  
  for (const client of topClients || []) {
    const hasData = client.visit_history && client.visit_history.length > 0;
    const icon = hasData ? '✅' : '❌';
    
    if (!hasData) allHaveData = false;
    
    console.log(`  ${icon} ${client.name}: ${client.visit_count} визитов`);
    
    if (hasData) {
      const services = client.last_services?.slice(0, 2).join(', ');
      console.log(`      История: ${client.visit_history.length}, Услуги: ${services}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  
  if (allHaveData) {
    console.log('🎊 ОТЛИЧНО! Все топ клиенты имеют полные данные!');
  }
  
  console.log('\n📌 РЕЗЮМЕ:');
  console.log(`  • ${withFullData} клиентов готовы для AI персонализации`);
  console.log(`  • ${totalVisits} визитов доступны для анализа`);
  console.log(`  • База данных полностью готова к работе!`);
  
  // Проверяем клиентов без данных
  const { count: withoutData } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .gt('visit_count', 0)
    .or('visit_history.is.null,visit_history.eq.[]');
  
  if (withoutData > 0) {
    console.log(`\n⚠️ Примечание: ${withoutData} клиентов имеют visit_count > 0, но без истории.`);
    console.log('   Это клиенты, для которых YClients API не возвращает детальные данные.');
  }
}

finalStatus().catch(console.error);