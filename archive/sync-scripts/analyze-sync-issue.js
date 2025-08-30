const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function analyzeIssue() {
  console.log('🔍 АНАЛИЗ ПРОБЛЕМЫ СИНХРОНИЗАЦИИ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // 1. Проверяем клиентов в таблице clients
  const { data: clientsWithVisits } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 0)
    .order('id')
    .limit(10);
    
  console.log('📝 Примеры клиентов с visit_count > 0:');
  clientsWithVisits?.forEach(c => {
    console.log(`  • ID: ${c.id}, YClients: ${c.yclients_id}, Имя: ${c.name}, Визиты: ${c.visit_count}`);
  });
  
  // 2. Проверяем визиты в таблице visits
  const { data: allVisits } = await supabase
    .from('visits')
    .select('client_id, client_yclients_id, client_name');
    
  const uniqueClientIds = new Set(allVisits?.map(v => v.client_id).filter(id => id));
  const uniqueYclientsIds = new Set(allVisits?.map(v => v.client_yclients_id).filter(id => id));
  const clientIdCounts = {};
  
  allVisits?.forEach(v => {
    if (v.client_id) {
      clientIdCounts[v.client_id] = (clientIdCounts[v.client_id] || 0) + 1;
    }
  });
  
  console.log('');
  console.log('📊 Анализ таблицы visits:');
  console.log('  • Всего визитов: ' + (allVisits?.length || 0));
  console.log('  • Уникальных client_id: ' + uniqueClientIds.size);
  console.log('  • Уникальных client_yclients_id: ' + uniqueYclientsIds.size);
  
  // Находим топ client_id по количеству визитов
  const topClientIds = Object.entries(clientIdCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  console.log('');
  console.log('🔝 Топ client_id по количеству визитов:');
  topClientIds.forEach(([id, count]) => {
    const client = clientsWithVisits?.find(c => c.id == id);
    console.log(`  • client_id ${id} (${client?.name || 'Unknown'}): ${count} визитов`);
  });
  
  // 3. Проверяем соответствие между client_id и yclients_id
  console.log('');
  console.log('🔍 Проверка маппинга ID:');
  
  // Берем несколько визитов для анализа
  const { data: sampleVisits } = await supabase
    .from('visits')
    .select('client_id, client_yclients_id, client_name')
    .limit(100);
    
  // Получаем клиентов по их yclients_id
  const yclientsIdsToCheck = [...new Set(sampleVisits?.map(v => v.client_yclients_id).filter(id => id))];
  
  const { data: clientsFromDb } = await supabase
    .from('clients')
    .select('id, yclients_id, name')
    .in('yclients_id', yclientsIdsToCheck)
    .eq('company_id', 962302);
    
  const yclientsToClientId = {};
  clientsFromDb?.forEach(c => {
    yclientsToClientId[c.yclients_id] = c.id;
  });
  
  // Проверяем соответствие
  let correctMappings = 0;
  let wrongMappings = 0;
  const wrongExamples = [];
  
  sampleVisits?.forEach(v => {
    const expectedClientId = yclientsToClientId[v.client_yclients_id];
    if (expectedClientId) {
      if (expectedClientId === v.client_id) {
        correctMappings++;
      } else {
        wrongMappings++;
        if (wrongExamples.length < 5) {
          wrongExamples.push({
            visit_client_id: v.client_id,
            expected_client_id: expectedClientId,
            yclients_id: v.client_yclients_id,
            client_name: v.client_name
          });
        }
      }
    }
  });
  
  console.log('  • Правильных маппингов: ' + correctMappings);
  console.log('  • Неправильных маппингов: ' + wrongMappings);
  
  if (wrongExamples.length > 0) {
    console.log('');
    console.log('❌ ПРОБЛЕМА НАЙДЕНА: Неправильные client_id в визитах!');
    console.log('Примеры:');
    wrongExamples.forEach(w => {
      console.log(`  • ${w.client_name} (YClients ${w.yclients_id}):`);
      console.log(`    Записан client_id: ${w.visit_client_id}`);
      console.log(`    Должен быть: ${w.expected_client_id}`);
    });
    
    console.log('');
    console.log('💡 ПРИЧИНА: При синхронизации используется неправильный client_id!');
    console.log('   Вместо ID из таблицы clients используется какой-то другой ID.');
  }
  
  // 4. Проверяем, откуда берутся эти 69 client_id
  console.log('');
  console.log('📌 Анализ 69 уникальных client_id:');
  const uniqueIds = Array.from(uniqueClientIds);
  
  // Проверяем, есть ли эти ID в таблице clients
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name, yclients_id')
    .in('id', uniqueIds.slice(0, 100))
    .eq('company_id', 962302);
    
  console.log('  • Из 69 client_id найдено в таблице clients: ' + (existingClients?.length || 0));
  
  if (existingClients && existingClients.length > 0) {
    console.log('  • Примеры найденных:');
    existingClients.slice(0, 3).forEach(c => {
      console.log(`    - ID ${c.id}: ${c.name} (YClients: ${c.yclients_id})`);
    });
  }
}

analyzeIssue().catch(console.error);