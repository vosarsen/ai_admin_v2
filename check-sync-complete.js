const { supabase } = require('./src/database/supabase');

async function checkSyncComplete() {
  console.log('\n📊 ПРОВЕРКА ПОЛНОТЫ СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Статистика клиентов
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: clientsWithVisits } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .gt('visit_count', 0);
  
  // Статистика визитов
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  const { data: uniqueClients } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  
  const uniqueClientIds = new Set(uniqueClients?.map(v => v.client_id));
  
  // Даты
  const { data: firstVisit } = await supabase
    .from('visits')
    .select('visit_date')
    .order('visit_date', { ascending: true })
    .limit(1);
  
  const { data: lastVisit } = await supabase
    .from('visits')
    .select('visit_date')
    .order('visit_date', { ascending: false })
    .limit(1);
  
  console.log('📈 СТАТИСТИКА КЛИЕНТОВ:');
  console.log(`  • Всего клиентов в БД: ${totalClients}`);
  console.log(`  • Клиентов с visit_count > 0: ${clientsWithVisits}`);
  console.log(`  • Клиентов с визитами в таблице visits: ${uniqueClientIds.size}`);
  console.log('');
  
  console.log('📅 СТАТИСТИКА ВИЗИТОВ:');
  console.log(`  • Всего визитов в БД: ${totalVisits}`);
  console.log(`  • Первый визит: ${firstVisit?.[0]?.visit_date || 'н/д'} (открытие: 11.12.2023)`);
  console.log(`  • Последний визит: ${lastVisit?.[0]?.visit_date || 'н/д'}`);
  console.log('');
  
  // Анализ несоответствий
  const percentWithVisits = Math.round((uniqueClientIds.size / clientsWithVisits) * 100);
  
  console.log('🔍 АНАЛИЗ:');
  console.log(`  • ${percentWithVisits}% клиентов с visit_count > 0 имеют записи в visits`);
  
  if (percentWithVisits < 50) {
    console.log('\n⚠️ ПРОБЛЕМА СИНХРОНИЗАЦИИ:');
    console.log(`  Только ${uniqueClientIds.size} из ${clientsWithVisits} клиентов имеют визиты`);
    
    // Проверяем сколько клиентов были активны в последние 6 месяцев
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { count: recentClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', 962302)
      .gte('last_visit_date', sixMonthsAgo.toISOString().split('T')[0]);
    
    console.log(`\n  Активных клиентов за последние 6 месяцев: ${recentClients}`);
    console.log('  Возможные причины низкой синхронизации:');
    console.log('  1. YClients API требует запрос для КАЖДОГО клиента отдельно');
    console.log('  2. Процесс синхронизации еще идет (проверьте через несколько минут)');
    console.log('  3. Многие клиенты импортированы, но не имеют реальных визитов');
    
    // Рекомендация
    console.log('\n📌 РЕКОМЕНДАЦИЯ:');
    console.log('  Запустите синхронизацию только для активных клиентов:');
    console.log('  node scripts/sync-recent-clients.js');
  } else {
    console.log('\n✅ СИНХРОНИЗАЦИЯ УСПЕШНА!');
    console.log(`  ${percentWithVisits}% клиентов имеют синхронизированные визиты`);
  }
  
  // Проверяем клиентов без визитов в API
  const { data: clientsSample } = await supabase
    .from('clients')
    .select('id, name, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 5)
    .limit(10);
  
  let clientsWithoutVisits = 0;
  for (const client of clientsSample || []) {
    const { count } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);
    
    if (count === 0) clientsWithoutVisits++;
  }
  
  if (clientsWithoutVisits > 5) {
    console.log('\n⚠️ Найдены клиенты с visit_count > 5, но без записей в visits');
    console.log('  Это означает что синхронизация еще не завершена или');
    console.log('  YClients API не возвращает данные для этих клиентов');
  }
}

checkSyncComplete().catch(console.error);