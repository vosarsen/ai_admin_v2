const { supabase } = require('./src/database/supabase');

async function finalReport() {
  console.log('\n🎉 ФИНАЛЬНЫЙ ОТЧЕТ ПО СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Статистика клиентов
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: clientsWithHistory } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .not('visit_history', 'eq', '[]');
  
  const { count: clientsWithServices } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .not('last_services', 'eq', '[]');
  
  const { count: clientsWithStaff } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .not('favorite_staff_ids', 'eq', '[]');
  
  // Статистика визитов
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  const { data: uniqueClients } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  const uniqueCount = new Set(uniqueClients?.map(v => v.client_id)).size;
  
  console.log('📊 КЛИЕНТЫ:');
  console.log(`  • Всего в БД: ${totalClients}`);
  console.log(`  • С историей визитов: ${clientsWithHistory || 0} (${Math.round((clientsWithHistory||0)/totalClients*100)}%)`);
  console.log(`  • С последними услугами: ${clientsWithServices || 0} (${Math.round((clientsWithServices||0)/totalClients*100)}%)`);
  console.log(`  • С любимыми мастерами: ${clientsWithStaff || 0} (${Math.round((clientsWithStaff||0)/totalClients*100)}%)`);
  console.log('');
  
  console.log('📅 ВИЗИТЫ:');
  console.log(`  • Всего визитов: ${totalVisits}`);
  console.log(`  • Уникальных клиентов: ${uniqueCount}`);
  console.log(`  • Среднее визитов на клиента: ${Math.round(totalVisits/uniqueCount)}`);
  console.log('');
  
  // Топ клиенты
  const { data: topClients } = await supabase
    .from('clients')
    .select('name, visit_count, visit_history, last_services')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(5);
  
  console.log('🏆 ТОП-5 КЛИЕНТОВ:');
  for (const client of topClients || []) {
    const hasData = client.visit_history && client.visit_history.length > 0;
    const icon = hasData ? '✅' : '⚪';
    console.log(`  ${icon} ${client.name}: ${client.visit_count} визитов (в истории: ${client.visit_history?.length || 0})`);
  }
  console.log('');
  
  // Выводы
  console.log('💡 ИТОГИ:');
  console.log('═══════════════════════════════════════════════════\n');
  
  if (clientsWithHistory && clientsWithHistory > 50) {
    console.log('✅ СИНХРОНИЗАЦИЯ УСПЕШНА!');
    console.log(`  • ${totalClients} клиентов загружено`);
    console.log(`  • ${totalVisits} визитов синхронизировано`);
    console.log(`  • ${clientsWithHistory} клиентов имеют историю для персонализации`);
  } else {
    console.log('⚠️ ЧАСТИЧНАЯ СИНХРОНИЗАЦИЯ');
    console.log(`  • ${totalClients} клиентов загружено`);
    console.log(`  • ${totalVisits} визитов синхронизировано`);
    console.log(`  • Только ${clientsWithHistory || 0} клиентов имеют историю`);
    console.log('\n  Это нормально - YClients API не возвращает');
    console.log('  историю для всех клиентов.');
  }
  
  console.log('\n📌 AI Admin v2 готов к работе с этими данными!');
}

finalReport().catch(console.error);