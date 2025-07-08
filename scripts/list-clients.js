#!/usr/bin/env node

const axios = require('axios');
const config = require('../src/config');

/**
 * Скрипт для получения списка всех клиентов компании
 */

async function getClients(page = 1) {
  try {
    const response = await axios.get(
      `${config.yclients.apiUrl}/company/${config.yclients.companyId}/clients`,
      {
        headers: {
          'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        },
        params: {
          page,
          count: 20
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error getting clients:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('📋 Получаем список клиентов...\n');
  
  const result = await getClients();
  
  if (!result || !result.success) {
    console.log('❌ Не удалось получить список клиентов');
    return;
  }
  
  console.log(`Найдено клиентов: ${result.meta?.total_count || result.data.length}`);
  console.log('Страница 1:\n');
  
  result.data.forEach((client, index) => {
    console.log(`${index + 1}. ${client.name || 'Без имени'}`);
    console.log(`   📱 Телефон: ${client.phone}`);
    console.log(`   📧 Email: ${client.email || 'Не указан'}`);
    console.log(`   🎂 Дата рождения: ${client.birth_date || 'Не указана'}`);
    console.log(`   📅 Дата регистрации: ${client.created_at || 'Не указана'}`);
    console.log(`   💳 ID: ${client.id}`);
    console.log('---');
  });
  
  if (result.meta && result.meta.total_count > 20) {
    console.log(`\n⚠️  Показаны первые 20 клиентов из ${result.meta.total_count}`);
  }
}

main().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});