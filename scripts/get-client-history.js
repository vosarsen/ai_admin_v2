#!/usr/bin/env node

const axios = require('axios');
const config = require('../src/config');
const logger = require('../src/utils/logger');

/**
 * Скрипт для получения истории записей клиента из YClients
 */

const PHONE = process.argv[2]; // Телефон клиента передается как аргумент

if (!PHONE) {
  console.log('Использование: node scripts/get-client-history.js +79XXXXXXXXX');
  process.exit(1);
}

async function findClientByPhone(phone) {
  try {
    const normalizedPhone = phone.replace(/\D/g, ''); // Убираем все нецифровые символы
    
    // Поиск клиента по телефону
    const response = await axios.get(
      `${config.yclients.apiUrl}/company/${config.yclients.companyId}/clients/search`,
      {
        headers: {
          'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        },
        params: {
          phone: normalizedPhone
        }
      }
    );

    if (response.data.success && response.data.data.length > 0) {
      return response.data.data[0]; // Возвращаем первого найденного клиента
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding client:', error.response?.data || error.message);
    return null;
  }
}

async function getClientRecords(clientId) {
  try {
    // Получаем записи клиента
    const response = await axios.get(
      `${config.yclients.apiUrl}/records/${config.yclients.companyId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        },
        params: {
          client_id: clientId,
          count: 50 // Максимум записей
        }
      }
    );

    return response.data.data || [];
  } catch (error) {
    logger.error('Error getting client records:', error.response?.data || error.message);
    return [];
  }
}

async function getRecordsByPhone(phone) {
  try {
    const normalizedPhone = phone.replace(/\D/g, ''); // Убираем все нецифровые символы
    
    // Пробуем получить записи по телефону напрямую
    const response = await axios.get(
      `${config.yclients.apiUrl}/records/${config.yclients.companyId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.yclients.bearerToken}, User ${config.yclients.userToken}`,
          'Accept': 'application/vnd.yclients.v2+json',
          'Content-Type': 'application/json'
        },
        params: {
          phone: normalizedPhone,
          count: 100
        }
      }
    );

    return response.data.data || [];
  } catch (error) {
    logger.error('Error getting records by phone:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  console.log(`🔍 Ищем записи по телефону: ${PHONE}`);
  
  // Пробуем разные методы получения данных
  
  // 1. Сначала пытаемся найти клиента
  const client = await findClientByPhone(PHONE);
  
  let records = [];
  
  if (client) {
    console.log(`✅ Найден клиент: ${client.name} (ID: ${client.id})`);
    console.log('\n📋 Получаем историю записей по ID клиента...');
    records = await getClientRecords(client.id);
  } else {
    console.log('⚠️  Клиент не найден через поиск, пробуем получить записи напрямую по телефону...');
    records = await getRecordsByPhone(PHONE);
  }
  
  if (records.length === 0) {
    console.log('\n🔍 Пробуем получить все записи компании для поиска...');
    
    // Последняя попытка - получить все записи за последний месяц
    try {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      const response = await axios.get(
        `${config.yclients.apiUrl}/records/${config.yclients.companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.yclients.bearerToken}${config.yclients.partnerId ? `, Partner ${config.yclients.partnerId}` : ''}, User ${config.yclients.userToken}`,
            'Accept': 'application/vnd.yclients.v2+json',
            'Content-Type': 'application/json'
          },
          params: {
            start_date: monthAgo.toISOString().split('T')[0],
            end_date: today.toISOString().split('T')[0],
            count: 300
          }
        }
      );
      
      const allRecords = response.data.data || [];
      console.log(`📊 Найдено записей за месяц: ${allRecords.length}`);
      
      // Фильтруем по телефону
      const normalizedSearchPhone = PHONE.replace(/\D/g, '');
      records = allRecords.filter(record => {
        // Проверяем телефон в разных местах
        const clientPhone = record.client?.phone?.replace(/\D/g, '');
        const recordPhone = record.phone?.replace(/\D/g, '');
        return clientPhone === normalizedSearchPhone || recordPhone === normalizedSearchPhone;
      });
      
      if (records.length > 0) {
        console.log(`✅ Найдено записей с вашим телефоном: ${records.length}`);
      }
    } catch (error) {
      console.error('❌ Не удалось получить записи:', error.response?.data || error.message);
    }
  }
  
  if (records.length === 0) {
    console.log('\n📭 История записей не найдена');
    console.log('Возможные причины:');
    console.log('- Телефон не зарегистрирован в системе');
    console.log('- Нет прав доступа к данным клиентов');
    console.log('- Записи были сделаны под другим номером');
    return;
  }
  
  // 3. Выводим историю
  console.log(`\n📊 Найдено записей: ${records.length}\n`);
  
  records.forEach((record, index) => {
    console.log(`${index + 1}. Запись #${record.id}`);
    console.log(`   📅 Дата: ${record.date}`);
    console.log(`   👤 Мастер: ${record.staff?.name || 'Не указан'}`);
    console.log(`   📋 Услуги:`);
    record.services.forEach(service => {
      console.log(`      - ${service.title} (${service.cost}₽)`);
    });
    console.log(`   💰 Общая стоимость: ${record.services.reduce((sum, s) => sum + s.cost, 0)}₽`);
    console.log(`   📌 Статус: ${record.deleted ? 'Отменена' : (record.attendance === 1 ? 'Клиент пришел' : 'Ожидается')}`);
    console.log(`   💬 Комментарий: ${record.comment || 'Нет'}`);
    console.log('---');
  });
}

main().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});