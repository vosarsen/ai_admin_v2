const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function checkCurrentState() {
  console.log('📊 ТЕКУЩЕЕ СОСТОЯНИЕ ПОСЛЕ ОЧИСТКИ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // Клиенты
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 962302)
    .gt('visit_count', 0);
    
  // Визиты
  const { data: visits } = await supabase
    .from('visits')
    .select('client_id');
  const uniqueClientsInVisits = new Set(visits?.map(v => v.client_id).filter(id => id)).size;
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
    
  // Клиенты без визитов в таблице visits
  const clientIdsWithVisits = new Set(visits?.map(v => v.client_id).filter(id => id));
  
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, yclients_id, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 0)
    .order('visit_count', { ascending: false });
    
  const clientsNotSynced = allClients?.filter(c => !clientIdsWithVisits.has(c.id));
  
  console.log('📊 Статистика:');
  console.log('  • Всего клиентов (после очистки): ' + totalClients);
  console.log('  • Клиентов с визитами в таблице visits: ' + uniqueClientsInVisits);
  console.log('  • Всего визитов в БД: ' + totalVisits);
  console.log('');
  console.log('❗ Нужно синхронизировать: ' + (totalClients - uniqueClientsInVisits) + ' клиентов');
  console.log('   Это ' + Math.round((totalClients - uniqueClientsInVisits) / totalClients * 100) + '% всех клиентов');
  
  if (clientsNotSynced && clientsNotSynced.length > 0) {
    console.log('');
    console.log('📝 Примеры несинхронизированных клиентов:');
    clientsNotSynced.slice(0, 10).forEach(c => {
      console.log(`  • ${c.name} (ID: ${c.id}, YClients: ${c.yclients_id}, Визитов: ${c.visit_count})`);
    });
    
    // Анализ по visit_count
    const byVisitCount = {};
    clientsNotSynced.forEach(c => {
      const count = c.visit_count;
      if (!byVisitCount[count]) byVisitCount[count] = 0;
      byVisitCount[count]++;
    });
    
    console.log('');
    console.log('📊 Распределение несинхронизированных по visit_count:');
    Object.entries(byVisitCount)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .slice(0, 10)
      .forEach(([count, num]) => {
        console.log(`  • ${count} визитов: ${num} клиентов`);
      });
  }
  
  // Проверяем дубликаты
  const nameGroups = {};
  allClients?.forEach(c => {
    if (!nameGroups[c.name]) nameGroups[c.name] = [];
    nameGroups[c.name].push(c);
  });
  
  const duplicates = Object.entries(nameGroups)
    .filter(([name, clients]) => clients.length > 1)
    .length;
    
  console.log('');
  console.log('🔍 Анализ дубликатов:');
  console.log('  • Уникальных имен: ' + Object.keys(nameGroups).length);
  console.log('  • Имен с дубликатами: ' + duplicates);
  
  if (duplicates > 0) {
    console.log('');
    console.log('⚠️ Все еще есть дубликаты! Топ-5:');
    Object.entries(nameGroups)
      .filter(([name, clients]) => clients.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .forEach(([name, clients]) => {
        console.log(`  • ${name}: ${clients.length} записей`);
      });
  }
}

checkCurrentState().catch(console.error);