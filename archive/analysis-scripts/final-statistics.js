const { supabase } = require('./src/database/supabase');

async function finalStatistics() {
  console.log('\n📊 ФИНАЛЬНАЯ СТАТИСТИКА СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Общая статистика
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302);
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  // Клиенты с визитами
  const { data: clientsWithVisits } = await supabase
    .from('visits')
    .select('client_id')
    .not('client_id', 'is', null);
  
  const uniqueClientIds = new Set(clientsWithVisits?.map(v => v.client_id));
  const uniqueClientsCount = uniqueClientIds.size;
  
  // Проверяем топ клиентов
  const topClients = [
    { id: 1453, name: 'Алексей', expected: 33 },
    { id: 2210, name: 'Леонид', expected: 27 },
    { id: 2002, name: 'Евгений', expected: 27 },
    { id: 17222, name: 'Сергей', expected: 25 },
    { id: 1941, name: 'Дмитрий', expected: 25 }
  ];
  
  console.log('📈 ОСНОВНЫЕ ПОКАЗАТЕЛИ:');
  console.log(`  • Всего клиентов в БД: ${totalClients}`);
  console.log(`  • Всего визитов в БД: ${totalVisits}`);
  console.log(`  • Клиентов с визитами: ${uniqueClientsCount}`);
  console.log(`  • Процент синхронизации: ${Math.round(uniqueClientsCount / totalClients * 100)}%`);
  console.log(`  • Среднее визитов на клиента: ${Math.round(totalVisits / uniqueClientsCount)}\n`);
  
  console.log('✅ ПРОВЕРКА ТОП КЛИЕНТОВ:');
  console.log('───────────────────────────────────────────────');
  
  let allSynced = true;
  for (const client of topClients) {
    const { count } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);
    
    const status = count > 0 ? '✅' : '❌';
    console.log(`  ${status} ${client.name}: ${count || 0} визитов (ожидалось ~${client.expected})`);
    
    if (count === 0) allSynced = false;
  }
  
  // Анализ по датам
  const { data: visitDates } = await supabase
    .from('visits')
    .select('visit_date')
    .order('visit_date', { ascending: true })
    .limit(1);
  
  const { data: latestVisit } = await supabase
    .from('visits')
    .select('visit_date')
    .order('visit_date', { ascending: false })
    .limit(1);
  
  console.log('\n📅 ДИАПАЗОН ДАТ ВИЗИТОВ:');
  console.log(`  • Самый ранний визит: ${visitDates?.[0]?.visit_date || 'н/д'}`);
  console.log(`  • Самый поздний визит: ${latestVisit?.[0]?.visit_date || 'н/д'}`);
  
  // Статистика по услугам
  const { data: servicesData } = await supabase
    .from('visits')
    .select('service_names')
    .not('service_names', 'is', null);
  
  const serviceCounts = {};
  servicesData?.forEach(visit => {
    visit.service_names?.forEach(service => {
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
  });
  
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log('\n🏆 ТОП-5 ПОПУЛЯРНЫХ УСЛУГ:');
  topServices.forEach(([service, count], i) => {
    console.log(`  ${i+1}. ${service}: ${count} раз`);
  });
  
  // ВЫВОДЫ
  console.log('\n💡 ВЫВОДЫ:');
  console.log('═══════════════════════════════════════════════════\n');
  
  if (allSynced && uniqueClientsCount > 100) {
    console.log('✅ СИНХРОНИЗАЦИЯ УСПЕШНА!');
    console.log(`   • ${uniqueClientsCount} клиентов имеют синхронизированные визиты`);
    console.log(`   • ${totalVisits} визитов успешно импортированы`);
    console.log('   • Все топ клиенты имеют историю визитов');
  } else if (uniqueClientsCount > 0) {
    console.log('⚠️ ЧАСТИЧНАЯ СИНХРОНИЗАЦИЯ');
    console.log(`   • Только ${uniqueClientsCount} из ${totalClients} клиентов имеют визиты`);
    console.log('   • Возможные причины:');
    console.log('     - YClients API не возвращает старые данные');
    console.log('     - Многие клиенты не имеют реальных визитов');
    console.log('     - Ограничения прав доступа API');
  } else {
    console.log('❌ СИНХРОНИЗАЦИЯ НЕ УДАЛАСЬ');
    console.log('   Проверьте логи и настройки API');
  }
  
  // Проверяем клиентов с заполненными данными
  const { data: clientsWithData } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', 962302)
    .not('visit_history', 'is', null);
  
  console.log(`\n📊 Клиентов с заполненной историей: ${clientsWithData?.length || 0} из ${totalClients}`);
}

finalStatistics().catch(console.error);