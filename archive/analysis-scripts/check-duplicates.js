const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function checkDuplicates() {
  console.log('🔍 ПРОВЕРКА ДУБЛИКАТОВ КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // Получаем всех клиентов
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 0);
    
  // Группируем по имени
  const nameGroups = {};
  allClients?.forEach(c => {
    const name = c.name;
    if (!nameGroups[name]) nameGroups[name] = [];
    nameGroups[name].push(c);
  });
  
  // Находим дубликаты
  const duplicates = Object.entries(nameGroups)
    .filter(([name, clients]) => clients.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
    
  console.log('📊 Статистика:');
  console.log('  • Всего клиентов с визитами: ' + allClients?.length);
  console.log('  • Уникальных имен: ' + Object.keys(nameGroups).length);
  console.log('  • Имен с дубликатами: ' + duplicates.length);
  console.log('');
  
  console.log('🔝 Топ имен с дубликатами:');
  duplicates.slice(0, 10).forEach(([name, clients]) => {
    console.log(`  • ${name}: ${clients.length} записей`);
    const sample = clients.slice(0, 3);
    sample.forEach(c => {
      console.log(`    - ID: ${c.id}, YClients: ${c.yclients_id}, Визиты: ${c.visit_count}`);
    });
  });
  
  // Проверяем клиентов в visits
  const { data: visitsData } = await supabase
    .from('visits')
    .select('client_id, client_name');
    
  const uniqueVisitClientIds = new Set(visitsData?.map(v => v.client_id).filter(id => id));
  const uniqueVisitNames = new Set(visitsData?.map(v => v.client_name).filter(n => n));
  
  // Находим клиентов из visits в общем списке
  const clientsInVisits = allClients?.filter(c => uniqueVisitClientIds.has(c.id));
  const namesOfClientsInVisits = new Set(clientsInVisits?.map(c => c.name));
  
  console.log('');
  console.log('📌 Анализ таблицы visits:');
  console.log('  • Уникальных client_id: ' + uniqueVisitClientIds.size);
  console.log('  • Уникальных имен в visits: ' + uniqueVisitNames.size);
  console.log('  • Имен клиентов (по ID из visits): ' + namesOfClientsInVisits.size);
  
  // Считаем сколько всего клиентов с такими же именами
  let totalClientsWithSameNames = 0;
  let examplesOfDuplicates = [];
  
  namesOfClientsInVisits.forEach(name => {
    const clientsWithThisName = nameGroups[name] || [];
    totalClientsWithSameNames += clientsWithThisName.length;
    
    if (clientsWithThisName.length > 1) {
      const inVisits = clientsWithThisName.filter(c => uniqueVisitClientIds.has(c.id));
      const notInVisits = clientsWithThisName.filter(c => !uniqueVisitClientIds.has(c.id));
      
      if (inVisits.length > 0 && notInVisits.length > 0 && examplesOfDuplicates.length < 5) {
        examplesOfDuplicates.push({
          name: name,
          inVisits: inVisits,
          notInVisits: notInVisits
        });
      }
    }
  });
  
  console.log('');
  console.log('💡 ГЛАВНЫЙ ВЫВОД:');
  console.log(`  • В visits синхронизированы ${uniqueVisitClientIds.size} клиентов`);
  console.log(`  • У них ${namesOfClientsInVisits.size} уникальных имен`);
  console.log(`  • Всего в БД ${totalClientsWithSameNames} клиентов с такими же именами`);
  console.log(`  • То есть ${totalClientsWithSameNames - uniqueVisitClientIds.size} клиентов - это ДУБЛИ!`);
  
  if (examplesOfDuplicates.length > 0) {
    console.log('');
    console.log('📝 Примеры дубликатов:');
    examplesOfDuplicates.forEach(ex => {
      console.log(`  • ${ex.name}:`);
      console.log(`    В visits: ID ${ex.inVisits[0].id} (YClients: ${ex.inVisits[0].yclients_id})`);
      console.log(`    НЕ в visits: ID ${ex.notInVisits[0].id} (YClients: ${ex.notInVisits[0].yclients_id})`);
    });
  }
  
  console.log('');
  console.log('❌ ПРОБЛЕМА:');
  console.log('  YClients API возвращает визиты только для некоторых из дубликатов.');
  console.log('  Вероятно, это разные версии одного клиента (старый и новый ID).');
  console.log('  Или YClients API имеет ограничения на выдачу истории.');
}

checkDuplicates().catch(console.error);