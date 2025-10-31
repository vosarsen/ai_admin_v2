const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testFiltering() {
  // Берем клиента с визитами
  const { data: client } = await supabase
    .from('clients')
    .select('id, yclients_id, phone, name, visit_count')
    .eq('company_id', 962302)
    .eq('name', 'Алексей')
    .order('visit_count', { ascending: false })
    .limit(1)
    .single();
    
  console.log('🔍 АНАЛИЗ ПРОБЛЕМЫ ФИЛЬТРАЦИИ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Тестовый клиент:');
  console.log('  • Имя: ' + client.name);
  console.log('  • YClients ID: ' + client.yclients_id + ' (тип: ' + typeof client.yclients_id + ')');
  console.log('  • Visit count: ' + client.visit_count);
  console.log('');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  try {
    const url = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    const response = await axios.get(url, {
      params: {
        client_id: client.yclients_id,
        start_date: '2020-01-01',
        end_date: '2025-12-31',
        include_finance_transactions: 1
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    
    const records = response.data?.data || [];
    console.log('📥 API вернул ' + records.length + ' записей');
    console.log('');
    
    // Анализируем записи
    const clientIds = new Set();
    const clientNames = new Set();
    let ourClientRecords = 0;
    
    records.forEach(record => {
      const recordClientId = record.client?.id;
      const recordClientName = record.client?.name;
      
      if (recordClientId) clientIds.add(recordClientId);
      if (recordClientName) clientNames.add(recordClientName);
      
      // Проверяем разные способы сравнения
      const match1 = recordClientId === client.yclients_id;
      const match2 = recordClientId === parseInt(client.yclients_id);
      const match3 = String(recordClientId) === String(client.yclients_id);
      
      if (match1 || match2 || match3) {
        ourClientRecords++;
        if (ourClientRecords <= 3) {
          console.log(`✅ Запись клиента ${client.name}:`);
          console.log(`   record.client.id: ${recordClientId} (тип: ${typeof recordClientId})`);
          console.log(`   client.yclients_id: ${client.yclients_id} (тип: ${typeof client.yclients_id})`);
          console.log(`   Сравнения: === ${match1}, parseInt === ${match2}, String === ${match3}`);
          console.log(`   Дата: ${record.date}`);
          console.log('');
        }
      }
    });
    
    console.log('📊 РЕЗУЛЬТАТЫ АНАЛИЗА:');
    console.log('  • Уникальных client_id в ответе: ' + clientIds.size);
    console.log('  • Уникальных имен клиентов: ' + clientNames.size);
    console.log('  • Записей нашего клиента: ' + ourClientRecords);
    console.log('');
    
    if (clientIds.size > 1) {
      console.log('⚠️ ПРОБЛЕМА: API вернул записи РАЗНЫХ клиентов!');
      console.log('  Примеры client_id: ' + Array.from(clientIds).slice(0, 5).join(', '));
      console.log('  Примеры имен: ' + Array.from(clientNames).slice(0, 5).join(', '));
    } else if (ourClientRecords === 0) {
      console.log('⚠️ ПРОБЛЕМА: API не вернул записи для запрошенного клиента!');
      console.log('  Запрошен client_id: ' + client.yclients_id);
      console.log('  Получены client_id: ' + Array.from(clientIds).join(', '));
    } else {
      console.log('✅ Фильтрация работает корректно');
    }
    
  } catch (error) {
    console.error('Ошибка:', error.response?.status, error.message);
  }
}

testFiltering().catch(console.error);