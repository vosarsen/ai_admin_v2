const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function testWithRealClient() {
  // Берем клиента с максимальным visit_count
  const { data: topClient } = await supabase
    .from('clients')
    .select('id, yclients_id, phone, name, visit_count')
    .eq('company_id', 962302)
    .order('visit_count', { ascending: false })
    .limit(1)
    .single();
    
  if (!topClient) {
    console.log('Клиент не найден');
    return;
  }
  
  console.log('🔍 ТЕСТИРУЕМ С РЕАЛЬНЫМ КЛИЕНТОМ');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('Клиент: ' + topClient.name);
  console.log('YClients ID: ' + topClient.yclients_id);
  console.log('Visit count: ' + topClient.visit_count);
  console.log('');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  try {
    // Метод GET /records
    const url1 = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    console.log('📌 Тестируем GET /records с разными параметрами:');
    console.log('');
    
    // 1. Базовый запрос
    const response1 = await axios.get(url1, {
      params: {
        client_id: topClient.yclients_id
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    console.log('1. Базовый (только client_id): ' + (response1.data?.data?.length || 0) + ' записей');
    
    // 2. С датами
    const response2 = await axios.get(url1, {
      params: {
        client_id: topClient.yclients_id,
        start_date: '2020-01-01',
        end_date: '2025-12-31'
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    console.log('2. С широким диапазоном дат: ' + (response2.data?.data?.length || 0) + ' записей');
    
    // 3. С include_finance_transactions
    const response3 = await axios.get(url1, {
      params: {
        client_id: topClient.yclients_id,
        include_finance_transactions: 1
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    console.log('3. С include_finance_transactions: ' + (response3.data?.data?.length || 0) + ' записей');
    
    // 4. С with_deleted
    const response4 = await axios.get(url1, {
      params: {
        client_id: topClient.yclients_id,
        with_deleted: 1
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    console.log('4. С with_deleted: ' + (response4.data?.data?.length || 0) + ' записей');
    
    // 5. ВСЕ параметры вместе
    const response5 = await axios.get(url1, {
      params: {
        client_id: topClient.yclients_id,
        start_date: '2020-01-01',
        end_date: '2025-12-31',
        include_finance_transactions: 1,
        with_deleted: 1
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      }
    });
    console.log('5. ВСЕ параметры: ' + (response5.data?.data?.length || 0) + ' записей');
    
    // Показываем примеры записей
    if (response5.data?.data?.length > 0) {
      console.log('\n📝 Примеры найденных записей:');
      response5.data.data.slice(0, 3).forEach(r => {
        console.log(`  - ${r.date} | attendance: ${r.attendance} | deleted: ${r.deleted} | client: ${r.client?.name || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('Ошибка:', error.response?.status, error.message);
  }
  
  // Проверяем, что в нашей БД
  const { data: ourVisits } = await supabase
    .from('visits')
    .select('visit_date, status, attendance')
    .eq('client_id', topClient.id)
    .order('visit_date', { ascending: false })
    .limit(3);
    
  console.log('\n📊 В нашей БД для этого клиента:');
  console.log('  • Визитов сохранено: ' + (ourVisits?.length || 0));
  if (ourVisits?.length > 0) {
    ourVisits.forEach(v => {
      console.log(`    - ${v.visit_date} | attendance: ${v.attendance} | status: ${v.status}`);
    });
  }
  
  // Тестируем альтернативный метод
  console.log('\n📌 Тестируем POST /clients/visits/search:');
  
  try {
    const url2 = `https://api.yclients.com/api/v1/company/${companyId}/clients/visits/search`;
    
    const response6 = await axios.post(url2, {
      client_id: topClient.yclients_id,
      client_phone: null,
      from: null,
      to: null,
      payment_statuses: [],
      attendance: null
    }, {
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('  • Визитов найдено: ' + (response6.data?.data?.visits?.length || 0));
    
  } catch (error) {
    console.error('  • Ошибка:', error.response?.status, error.response?.data?.meta?.message || error.message);
  }
}

testWithRealClient().catch(console.error);