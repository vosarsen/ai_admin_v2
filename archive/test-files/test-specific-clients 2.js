const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testSpecificClients() {
  console.log('🔍 ТЕСТИРУЕМ КЛИЕНТОВ ИЗ СКРИНШОТА');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Клиенты из скриншота с их данными
  const testClients = [
    { name: 'Илья', phone: '79999054501', visits: 4 },
    { name: 'Маргарита', phone: '79266082244', visits: 1 },
    { name: 'Харальд', phone: '79268004645', visits: 5 },
    { name: 'Кирилл', phone: '79853627032', visits: 4 },
    { name: 'Константин', phone: '79261159593', visits: 22 },
    { name: 'Денис', phone: '79163849098', visits: 2 },
    { name: 'Геннадий', phone: '79880757777', visits: 18 },
    { name: 'Никита', phone: '79257751488', visits: 13 }
  ];
  
  console.log('Проверяем клиентов из YClients...\n');
  
  for (const client of testClients) {
    console.log(`\n📌 ${client.name} (${client.phone}, ${client.visits} визитов):`);
    console.log('─'.repeat(50));
    
    // Проверяем есть ли в нашей БД
    const { data: dbClient } = await supabase
      .from('clients')
      .select('id, yclients_id, visit_count')
      .eq('phone', client.phone.replace(/\D/g, ''))
      .eq('company_id', companyId)
      .single();
      
    if (dbClient) {
      console.log(`  ✓ Найден в БД: ID ${dbClient.id}, YClients: ${dbClient.yclients_id}`);
      console.log(`    Visit count: ${dbClient.visit_count}`);
      
      // Проверяем есть ли в visits
      const { count: visitsCount } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', dbClient.id);
        
      console.log(`    Визитов в таблице visits: ${visitsCount || 0}`);
      
      // Тестируем API
      try {
        const url = `https://api.yclients.com/api/v1/records/${companyId}`;
        
        const response = await axios.get(url, {
          params: {
            client_id: dbClient.yclients_id,
            start_date: '2020-01-01',
            end_date: '2025-12-31',
            include_finance_transactions: 1,
            with_deleted: 1
          },
          headers: {
            'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
            'Accept': 'application/vnd.api.v2+json',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        const records = response.data?.data || [];
        const clientRecords = records.filter(r => r.client?.id === dbClient.yclients_id);
        
        console.log(`    API вернул: ${clientRecords.length} записей`);
        
        if (clientRecords.length !== client.visits) {
          console.log(`    ⚠️ НЕСООТВЕТСТВИЕ: YClients показывает ${client.visits}, API дает ${clientRecords.length}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Ошибка API: ${error.message}`);
      }
      
    } else {
      console.log(`  ❌ НЕ найден в БД!`);
      
      // Пробуем найти по имени
      const { data: byName } = await supabase
        .from('clients')
        .select('id, phone, yclients_id')
        .eq('name', client.name)
        .eq('company_id', companyId);
        
      if (byName && byName.length > 0) {
        console.log(`    Найдены клиенты с таким именем:`);
        byName.slice(0, 3).forEach(c => {
          console.log(`      - ID ${c.id}, телефон: ${c.phone}, YClients: ${c.yclients_id}`);
        });
      }
    }
  }
  
  console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('═══════════════════════════════════════════════════');
  
  // Общая статистика
  const { count: totalInDb } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
    
  const { data: visitsData } = await supabase
    .from('visits')
    .select('client_id');
  const uniqueInVisits = new Set(visitsData?.map(v => v.client_id).filter(id => id)).size;
  
  console.log(`  • Клиентов в БД: ${totalInDb}`);
  console.log(`  • Клиентов в YClients: 1098`);
  console.log(`  • Разница: ${1098 - totalInDb}`);
  console.log(`  • Синхронизировано визитов для: ${uniqueInVisits} клиентов`);
  console.log(`  • Процент синхронизации: ${Math.round(uniqueInVisits / totalInDb * 100)}%`);
}

testSpecificClients().catch(console.error);