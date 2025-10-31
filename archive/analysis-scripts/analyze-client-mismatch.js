#!/usr/bin/env node

/**
 * Анализ несоответствия клиентов между API и БД
 * Почему из 3614 записей только 2179 связаны с нашими клиентами?
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./src/database/supabase');

async function analyzeClientMismatch() {
  console.log('🔍 АНАЛИЗ НЕСООТВЕТСТВИЯ КЛИЕНТОВ МЕЖДУ API И БД');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  try {
    // 1. Получаем клиентов из БД
    console.log('📋 Загружаем клиентов из БД...');
    const { data: dbClients } = await supabase
      .from('clients')
      .select('id, yclients_id, phone, name')
      .eq('company_id', companyId);
    
    const dbYclientsIds = new Set(dbClients?.map(c => c.yclients_id).filter(id => id));
    const dbPhones = new Set();
    const dbNames = new Set();
    
    dbClients?.forEach(client => {
      if (client.phone) {
        const normalized = client.phone.replace(/\D/g, '').replace(/^8/, '7');
        dbPhones.add(normalized);
      }
      if (client.name) {
        dbNames.add(client.name.toLowerCase());
      }
    });
    
    console.log(`✅ Загружено ${dbClients?.length || 0} клиентов из БД`);
    console.log(`   YClients IDs: ${dbYclientsIds.size}`);
    console.log(`   Телефонов: ${dbPhones.size}`);
    console.log(`   Имен: ${dbNames.size}\n`);
    
    // 2. Получаем записи из API (первая страница для анализа)
    console.log('📡 Получаем записи из YClients API...');
    const url = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    const response = await axios.get(url, {
      params: {
        start_date: '2025-07-01',
        end_date: '2025-08-31',
        include_finance_transactions: 1,
        with_deleted: 0,
        page: 1,
        count: 300
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const records = response.data?.data || [];
    console.log(`✅ Получено ${records.length} записей из API\n`);
    
    // 3. Анализируем клиентов в записях
    console.log('📊 Анализ клиентов в записях API:\n');
    
    const apiClients = new Map();
    let matchedByYclientsId = 0;
    let matchedByPhone = 0;
    let matchedByName = 0;
    let notMatched = 0;
    
    const notMatchedClients = [];
    
    records.forEach(record => {
      const clientId = record.client?.id;
      const clientPhone = record.client?.phone?.replace(/\D/g, '').replace(/^8/, '7');
      const clientName = record.client?.name;
      
      if (!clientId) return;
      
      if (!apiClients.has(clientId)) {
        apiClients.set(clientId, {
          id: clientId,
          phone: clientPhone,
          name: clientName,
          records: 0,
          matched: false,
          matchType: null
        });
      }
      
      const client = apiClients.get(clientId);
      client.records++;
      
      // Проверяем соответствие
      if (dbYclientsIds.has(clientId)) {
        client.matched = true;
        client.matchType = 'yclients_id';
        matchedByYclientsId++;
      } else if (clientPhone && dbPhones.has(clientPhone)) {
        client.matched = true;
        client.matchType = 'phone';
        matchedByPhone++;
      } else if (clientName && dbNames.has(clientName.toLowerCase())) {
        client.matched = true;
        client.matchType = 'name';
        matchedByName++;
      } else {
        notMatched++;
        if (notMatchedClients.length < 10) {
          notMatchedClients.push({
            id: clientId,
            name: clientName,
            phone: clientPhone
          });
        }
      }
    });
    
    const uniqueApiClients = apiClients.size;
    const matchedClients = Array.from(apiClients.values()).filter(c => c.matched).length;
    
    console.log(`📈 Уникальных клиентов в API: ${uniqueApiClients}`);
    console.log(`✅ Найдены в нашей БД: ${matchedClients} (${Math.round(matchedClients/uniqueApiClients*100)}%)`);
    console.log(`   • По YClients ID: ${matchedByYclientsId}`);
    console.log(`   • По телефону: ${matchedByPhone}`);
    console.log(`   • По имени: ${matchedByName}`);
    console.log(`❌ НЕ найдены в БД: ${uniqueApiClients - matchedClients} (${Math.round((uniqueApiClients - matchedClients)/uniqueApiClients*100)}%)\n`);
    
    // 4. Примеры несовпавших клиентов
    if (notMatchedClients.length > 0) {
      console.log('📝 Примеры клиентов из API, которых нет в БД:');
      notMatchedClients.forEach((client, i) => {
        console.log(`  ${i+1}. ${client.name || 'Без имени'}`);
        console.log(`     YClients ID: ${client.id}`);
        console.log(`     Телефон: ${client.phone || 'не указан'}`);
      });
      console.log('');
    }
    
    // 5. Проверяем обратное - клиенты в БД которых нет в API
    console.log('🔄 Проверяем клиентов из БД в последних записях API:\n');
    
    const apiYclientsIds = new Set(Array.from(apiClients.keys()));
    const dbClientsNotInApi = dbClients?.filter(c => 
      c.yclients_id && !apiYclientsIds.has(c.yclients_id)
    );
    
    console.log(`📊 Клиентов в БД: ${dbClients?.length || 0}`);
    console.log(`   Из них в последних записях API: ${dbClients?.length - dbClientsNotInApi?.length}`);
    console.log(`   НЕ в последних записях: ${dbClientsNotInApi?.length}\n`);
    
    // 6. Получаем клиентов напрямую из YClients
    console.log('👥 Получаем список клиентов напрямую из YClients...');
    
    const clientsUrl = `https://api.yclients.com/api/v1/company/${companyId}/clients/search`;
    
    const clientsResponse = await axios.post(clientsUrl, {
      fields: [],
      filters: [],
      order_by: 'id',
      order_by_direction: 'DESC',
      limit: 50,
      page: 1
    }, {
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const yclientsClients = clientsResponse.data?.data || [];
    console.log(`✅ Получено ${yclientsClients.length} клиентов из YClients\n`);
    
    // Сравниваем
    const ycIds = new Set(yclientsClients.map(c => c.id));
    const matchingInDb = dbClients?.filter(c => ycIds.has(c.yclients_id)).length || 0;
    
    console.log(`📊 Из ${yclientsClients.length} клиентов YClients:`);
    console.log(`   • Есть в нашей БД: ${matchingInDb}`);
    console.log(`   • Нет в нашей БД: ${yclientsClients.length - matchingInDb}\n`);
    
    // 7. ВЫВОДЫ
    console.log('💡 ВЫВОДЫ:');
    console.log('═══════════════════════════════════════════════════\n');
    
    const matchPercentage = Math.round(matchedClients/uniqueApiClients*100);
    
    if (matchPercentage < 50) {
      console.log('⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА СИНХРОНИЗАЦИИ!');
      console.log(`   Только ${matchPercentage}% клиентов из записей API есть в нашей БД.`);
      console.log('\n   Возможные причины:');
      console.log('   1. База клиентов не синхронизирована с YClients');
      console.log('   2. Клиенты были удалены из БД, но остались в YClients');
      console.log('   3. Используются разные YClients аккаунты/компании');
      console.log('   4. Проблема с синхронизацией yclients_id\n');
      
      console.log('   РЕКОМЕНДАЦИИ:');
      console.log('   1. Выполнить полную синхронизацию клиентов из YClients');
      console.log('   2. Проверить правильность company_id');
      console.log('   3. Убедиться что используется правильный API токен');
    } else {
      console.log(`✅ ${matchPercentage}% клиентов из API найдены в БД`);
      console.log('   Синхронизация работает в пределах нормы');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response?.data) {
      console.error('Ответ API:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

analyzeClientMismatch().catch(console.error);