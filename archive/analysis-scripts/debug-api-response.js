const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function debugAPIResponse() {
  console.log('🔍 DEBUG: АНАЛИЗ ОТВЕТОВ API ДЛЯ РАЗНЫХ КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Берем клиентов: один с визитами и один без
  const { data: clientWithVisits } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('id', 1453) // Клиент с 32 визитами в нашей БД
    .single();
    
  const { data: clientWithoutVisits } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('name', 'Александр')
    .eq('visit_count', 11) // Клиент с 11 визитами по счетчику, но без данных в visits
    .limit(1)
    .single();
    
  console.log('📌 Тестовые клиенты:');
  console.log(`1. ${clientWithVisits.name} (ID: ${clientWithVisits.id}, YClients: ${clientWithVisits.yclients_id})`);
  console.log(`   Visit count: ${clientWithVisits.visit_count}, В нашей visits: ДА`);
  console.log(`2. ${clientWithoutVisits.name} (ID: ${clientWithoutVisits.id}, YClients: ${clientWithoutVisits.yclients_id})`);
  console.log(`   Visit count: ${clientWithoutVisits.visit_count}, В нашей visits: НЕТ`);
  console.log('');
  
  // Тестируем API для обоих
  for (const client of [clientWithVisits, clientWithoutVisits]) {
    console.log(`\n🔍 Проверяем ${client.name} (YClients ID: ${client.yclients_id}):`);
    console.log('─────────────────────────────────────────────');
    
    try {
      const url = `https://api.yclients.com/api/v1/records/${companyId}`;
      
      console.log('Запрос с параметрами:');
      console.log(`  client_id: ${client.yclients_id}`);
      console.log(`  start_date: 2020-01-01`);
      console.log(`  end_date: 2025-12-31`);
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
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
      console.log(`\n📥 API вернул ${records.length} записей`);
      
      if (records.length > 0) {
        // Анализируем записи
        const clientIds = new Set();
        const clientNames = new Set();
        let ourClientRecords = 0;
        let otherClientRecords = 0;
        
        records.forEach(record => {
          const recordClientId = record.client?.id;
          const recordClientName = record.client?.name;
          
          if (recordClientId) clientIds.add(recordClientId);
          if (recordClientName) clientNames.add(recordClientName);
          
          if (recordClientId === client.yclients_id) {
            ourClientRecords++;
          } else {
            otherClientRecords++;
          }
        });
        
        console.log('📊 Анализ записей:');
        console.log(`  • Записей для нашего клиента: ${ourClientRecords}`);
        console.log(`  • Записей для других клиентов: ${otherClientRecords}`);
        console.log(`  • Уникальных client_id: ${clientIds.size}`);
        console.log(`  • Уникальных имен: ${clientNames.size}`);
        
        if (clientIds.size > 1) {
          console.log('  ⚠️ API вернул записи РАЗНЫХ клиентов!');
          console.log(`     Client IDs: ${Array.from(clientIds).join(', ')}`);
        }
        
        // Показываем примеры записей
        console.log('\n📝 Примеры записей:');
        records.slice(0, 3).forEach((record, i) => {
          console.log(`  ${i+1}. Дата: ${record.date}`);
          console.log(`     Client ID: ${record.client?.id} (запрошен: ${client.yclients_id})`);
          console.log(`     Client Name: ${record.client?.name}`);
          console.log(`     Deleted: ${record.deleted}`);
          console.log(`     Attendance: ${record.attendance}`);
        });
      } else {
        console.log('❌ API не вернул записей для этого клиента');
      }
      
    } catch (error) {
      console.log('❌ Ошибка запроса:', error.message);
      if (error.response?.data) {
        console.log('   Ответ API:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
  
  // Дополнительная проверка - запрос БЕЗ client_id
  console.log('\n\n🔍 КОНТРОЛЬНАЯ ПРОВЕРКА - запрос БЕЗ client_id:');
  console.log('─────────────────────────────────────────────');
  
  try {
    const url = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    const response = await axios.get(url, {
      params: {
        start_date: '2025-08-01',
        end_date: '2025-08-31',
        page: 1,
        count: 10
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const records = response.data?.data || [];
    console.log(`API вернул ${records.length} записей за последний месяц`);
    
    const uniqueClients = new Set();
    records.forEach(r => {
      if (r.client?.id) uniqueClients.add(r.client.id);
    });
    
    console.log(`Уникальных клиентов: ${uniqueClients.size}`);
    console.log(`Client IDs: ${Array.from(uniqueClients).slice(0, 10).join(', ')}`);
    
  } catch (error) {
    console.log('❌ Ошибка:', error.message);
  }
}

debugAPIResponse().catch(console.error);