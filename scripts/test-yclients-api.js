#!/usr/bin/env node

const axios = require('axios');
const config = require('../src/config');

/**
 * Тестовый скрипт для проверки доступных методов YClients API
 */

async function testEndpoint(name, method, url, params = {}) {
  console.log(`\n🔍 Тестируем ${name}...`);
  
  try {
    const response = await axios({
      method,
      url: `${config.yclients.apiUrl}${url}`,
      headers: {
        'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      params
    });
    
    console.log(`✅ Успешно! Получено записей: ${response.data.data?.length || 0}`);
    return response.data;
  } catch (error) {
    console.log(`❌ Ошибка: ${error.response?.data?.meta?.message || error.message}`);
    return null;
  }
}

async function main() {
  console.log('🧪 Тестирование YClients API\n');
  console.log(`Company ID: ${config.yclients.companyId}`);
  console.log(`Bearer Token: ${config.yclients.bearerToken ? '✓' : '✗'}`);
  console.log(`User Token: ${config.yclients.userToken ? '✓' : '✗'}`);
  
  // Тестируем разные endpoints
  await testEndpoint('Информация о компании', 'GET', `/company/${config.yclients.companyId}`);
  
  await testEndpoint('Список услуг', 'GET', `/company/${config.yclients.companyId}/services`);
  
  await testEndpoint('Список сотрудников', 'GET', `/company/${config.yclients.companyId}/staff`);
  
  await testEndpoint('Список клиентов', 'GET', `/company/${config.yclients.companyId}/clients`);
  
  await testEndpoint('Записи за сегодня', 'GET', `/records/${config.yclients.companyId}`, {
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  
  // Тестируем поиск слотов
  await testEndpoint('Доступные даты', 'GET', `/book_dates/${config.yclients.companyId}`);
  
  // Проверяем доступ к записям с телефоном
  console.log('\n📱 Тестирование поиска по телефону...');
  const phone = process.argv[2] || '+79686484488';
  
  await testEndpoint(`Поиск клиента по телефону ${phone}`, 'GET', `/company/${config.yclients.companyId}/clients/search`, {
    phone: phone.replace(/\D/g, '')
  });
}

main().catch(error => {
  console.error('❌ Критическая ошибка:', error.message);
  process.exit(1);
});