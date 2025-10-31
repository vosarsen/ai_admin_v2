const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testMultipleClients() {
  console.log('🔍 ТЕСТИРУЕМ МНОЖЕСТВО КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  
  // Берем клиентов с разным количеством визитов
  const { data: clients } = await supabase
    .from('clients')
    .select('id, yclients_id, phone, name, visit_count')
    .eq('company_id', 962302)
    .gt('visit_count', 5)
    .order('visit_count', { ascending: false })
    .limit(20);
    
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  const results = {
    withData: [],
    withoutData: []
  };
  
  console.log('Проверяем ' + clients.length + ' клиентов...\n');
  
  for (const client of clients) {
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
        timeout: 5000
      });
      
      const records = response.data?.data || [];
      
      // Фильтруем записи этого клиента
      const clientRecords = records.filter(r => r.client?.id === client.yclients_id);
      
      if (clientRecords.length > 0) {
        results.withData.push({
          name: client.name,
          yclients_id: client.yclients_id,
          visit_count: client.visit_count,
          api_records: clientRecords.length
        });
        console.log(`✅ ${client.name}: ${clientRecords.length} записей в API (visit_count: ${client.visit_count})`);
      } else {
        results.withoutData.push({
          name: client.name,
          yclients_id: client.yclients_id,
          visit_count: client.visit_count
        });
        console.log(`❌ ${client.name}: 0 записей в API (visit_count: ${client.visit_count})`);
      }
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`⚠️ ${client.name}: Ошибка запроса`);
    }
  }
  
  console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Клиентов с данными в API: ${results.withData.length}`);
  console.log(`❌ Клиентов БЕЗ данных в API: ${results.withoutData.length}`);
  
  if (results.withData.length > 0) {
    console.log('\n📝 Клиенты С данными:');
    results.withData.forEach(c => {
      console.log(`  • ${c.name}: ${c.api_records} записей (visit_count: ${c.visit_count})`);
    });
  }
  
  if (results.withoutData.length > 0) {
    console.log('\n📝 Примеры клиентов БЕЗ данных:');
    results.withoutData.slice(0, 5).forEach(c => {
      console.log(`  • ${c.name} (YClients ID: ${c.yclients_id}, visit_count: ${c.visit_count})`);
    });
  }
  
  // Анализ закономерностей
  console.log('\n🔍 АНАЛИЗ ЗАКОНОМЕРНОСТЕЙ:');
  
  // Проверяем YClients ID
  const withDataIds = results.withData.map(c => c.yclients_id);
  const withoutDataIds = results.withoutData.map(c => c.yclients_id);
  
  if (withDataIds.length > 0 && withoutDataIds.length > 0) {
    const minWithData = Math.min(...withDataIds);
    const maxWithData = Math.max(...withDataIds);
    const minWithoutData = Math.min(...withoutDataIds);
    const maxWithoutData = Math.max(...withoutDataIds);
    
    console.log(`  • YClients ID с данными: от ${minWithData} до ${maxWithData}`);
    console.log(`  • YClients ID без данных: от ${minWithoutData} до ${maxWithoutData}`);
    
    // Проверяем, есть ли корреляция с ID
    if (minWithData > maxWithoutData || minWithoutData > maxWithData) {
      console.log('  ⚠️ Возможна корреляция с YClients ID!');
    }
  }
}

testMultipleClients().catch(console.error);