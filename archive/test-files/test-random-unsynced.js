const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testRandomClients() {
  console.log('🔍 ТЕСТИРУЕМ СЛУЧАЙНЫХ НЕСИНХРОНИЗИРОВАННЫХ КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // Получаем клиентов БЕЗ визитов в visits
  const { data: visits } = await supabase
    .from('visits')
    .select('client_id');
  const syncedIds = new Set(visits?.map(v => v.client_id).filter(id => id));
  
  const { data: unsyncedClients } = await supabase
    .from('clients')
    .select('id, yclients_id, name, phone, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 5)
    .order('visit_count', { ascending: false })
    .limit(50);
    
  const testClients = unsyncedClients?.filter(c => !syncedIds.has(c.id)).slice(0, 10);
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  console.log(`Тестируем ${testClients?.length || 0} несинхронизированных клиентов:\n`);
  
  let apiWorks = 0;
  let apiEmpty = 0;
  let apiError = 0;
  const results = [];
  
  for (const client of testClients || []) {
    console.log(`\n📌 ${client.name} (ID: ${client.id}, YClients: ${client.yclients_id}):`);
    console.log('  Phone: ' + client.phone);
    console.log('  Visit count: ' + client.visit_count);
    
    try {
      const url = `https://api.yclients.com/api/v1/records/${companyId}`;
      
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
      const clientRecords = records.filter(r => r.client?.id === client.yclients_id);
      
      if (clientRecords.length > 0) {
        console.log(`  ✅ API вернул ${clientRecords.length} записей`);
        apiWorks++;
        
        // Показываем даты
        const dates = clientRecords.slice(0, 3).map(r => r.date);
        console.log(`  Примеры дат: ${dates.join(', ')}`);
        
        results.push({
          client: client.name,
          id: client.id,
          yclients_id: client.yclients_id,
          visit_count: client.visit_count,
          api_records: clientRecords.length,
          status: 'HAS_DATA'
        });
      } else {
        console.log('  ❌ API вернул 0 записей (хотя visit_count = ' + client.visit_count + ')');
        apiEmpty++;
        
        results.push({
          client: client.name,
          id: client.id,
          yclients_id: client.yclients_id,
          visit_count: client.visit_count,
          api_records: 0,
          status: 'NO_DATA'
        });
      }
      
    } catch (error) {
      console.log(`  ❌ Ошибка API: ${error.message}`);
      apiError++;
      
      results.push({
        client: client.name,
        id: client.id,
        yclients_id: client.yclients_id,
        visit_count: client.visit_count,
        api_records: -1,
        status: 'ERROR'
      });
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
  console.log(`  • API работает и возвращает данные: ${apiWorks}/${testClients?.length || 0}`);
  console.log(`  • API работает, но данных нет: ${apiEmpty}/${testClients?.length || 0}`);
  console.log(`  • Ошибки API: ${apiError}/${testClients?.length || 0}`);
  
  if (apiWorks > 0) {
    console.log('\n✅ Клиенты с данными в API:');
    results.filter(r => r.status === 'HAS_DATA').forEach(r => {
      console.log(`  • ${r.client}: ${r.api_records} записей (visit_count: ${r.visit_count})`);
    });
  }
  
  if (apiEmpty > 0) {
    console.log('\n❌ Клиенты БЕЗ данных в API:');
    results.filter(r => r.status === 'NO_DATA').forEach(r => {
      console.log(`  • ${r.client} (YClients: ${r.yclients_id}, visit_count: ${r.visit_count})`);
    });
  }
  
  console.log('\n💡 ВЫВОД:');
  if (apiWorks > apiEmpty) {
    console.log('  Большинство клиентов имеют данные в API.');
    console.log('  Проблема в процессе синхронизации!');
  } else if (apiEmpty > apiWorks) {
    console.log('  Большинство клиентов НЕ имеют данных в API.');
    console.log('  Возможно, это старые/неактуальные записи.');
  }
}

testRandomClients().catch(console.error);