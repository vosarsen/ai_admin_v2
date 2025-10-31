#!/usr/bin/env node

/**
 * Тестирование YClients API для получения истории визитов
 */

require('dotenv').config();
const axios = require('axios');

const YCLIENTS_API_KEY = process.env.YCLIENTS_API_KEY;
const YCLIENTS_BEARER_TOKEN = process.env.YCLIENTS_BEARER_TOKEN;
const COMPANY_ID = 962302;

async function testVisitsAPI() {
  console.log('🔍 Testing YClients Visits API\n');
  console.log('='.repeat(60));
  
  // Тестируем на клиенте Алексей с 28 визитами
  const clientId = 212316367; // Алексей
  const clientPhone = '+79031243097';
  
  console.log(`\nТестовый клиент:`);
  console.log(`  ID: ${clientId}`);
  console.log(`  Phone: ${clientPhone}`);
  console.log(`  Expected visits: 28\n`);
  
  // Пробуем разные варианты API
  const tests = [
    {
      name: 'Visits Search API v2',
      url: `https://api.yclients.com/api/v1/company/${COMPANY_ID}/clients/visits/search`,
      headers: {
        'Authorization': `Bearer ${YCLIENTS_BEARER_TOKEN}, User ${YCLIENTS_API_KEY}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      data: {
        client_id: clientId,
        client_phone: null,
        from: null,
        to: null,
        payment_statuses: [],
        attendance: null
      }
    },
    {
      name: 'Visits Search API - with attendance',
      url: `https://api.yclients.com/api/v1/company/${COMPANY_ID}/clients/visits/search`,
      headers: {
        'Authorization': `Bearer ${YCLIENTS_BEARER_TOKEN}, User ${YCLIENTS_API_KEY}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      data: {
        client_id: clientId,
        client_phone: null,
        from: '2024-01-01',
        to: '2025-12-31',
        payment_statuses: [],
        attendance: 1
      }
    },
    {
      name: 'Records API with client filter',
      url: `https://api.yclients.com/api/v1/records/${COMPANY_ID}`,
      headers: {
        'Authorization': `Bearer ${YCLIENTS_BEARER_TOKEN}, User ${YCLIENTS_API_KEY}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      params: {
        client_id: clientId,
        start_date: '2024-01-01',
        end_date: '2025-12-31',
        include_finance_transactions: 1
      }
    },
    {
      name: 'Client Records Search',
      url: `https://api.yclients.com/api/v1/records/${COMPANY_ID}/search`,
      headers: {
        'Authorization': `Bearer ${YCLIENTS_BEARER_TOKEN}, User ${YCLIENTS_API_KEY}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      data: {
        client_id: clientId,
        page: 1,
        count: 300
      }
    }
  ];
  
  for (const test of tests) {
    console.log(`\n📌 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    try {
      const config = {
        headers: test.headers
      };
      
      let response;
      if (test.data) {
        response = await axios.post(test.url, test.data, config);
      } else {
        config.params = test.params;
        response = await axios.get(test.url, config);
      }
      
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   Success: ${response.data?.success || 'N/A'}`);
      
      if (response.data?.data) {
        if (Array.isArray(response.data.data)) {
          console.log(`   Records found: ${response.data.data.length}`);
          
          // Показываем первые несколько записей
          if (response.data.data.length > 0) {
            const first = response.data.data[0];
            console.log(`   First record:`, {
              id: first.id,
              date: first.date || first.datetime,
              client: first.client?.name || 'N/A',
              services: first.services?.map(s => s.title || s.name).join(', ') || 'N/A'
            });
          }
        } else if (response.data.data.visits) {
          console.log(`   Visits found: ${response.data.data.visits.length}`);
          
          if (response.data.data.visits.length > 0) {
            const firstVisit = response.data.data.visits[0];
            console.log(`   First visit:`, {
              id: firstVisit.id,
              date: firstVisit.date,
              records: firstVisit.records?.length || 0,
              goods: firstVisit.goods_transactions?.length || 0
            });
          }
        } else {
          console.log(`   Data structure:`, Object.keys(response.data.data));
        }
      } else {
        console.log(`   No data field in response`);
        console.log(`   Response keys:`, Object.keys(response.data));
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || error.response.data}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Recommendations:');
  console.log('1. Check if Bearer token is valid and has necessary permissions');
  console.log('2. Verify that client_id exists in YClients');
  console.log('3. Try different date ranges or remove date filters');
  console.log('4. Check YClients documentation for API changes\n');
}

// Запуск
testVisitsAPI().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});