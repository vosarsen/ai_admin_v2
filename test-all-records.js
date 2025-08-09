#!/usr/bin/env node

/**
 * Тест: получить ВСЕ записи компании без фильтрации по клиенту
 * Чтобы понять, сколько вообще записей доступно через API
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./src/database/supabase');

async function testAllRecords() {
  console.log('🔍 ПОЛУЧАЕМ ВСЕ ЗАПИСИ КОМПАНИИ БЕЗ ФИЛЬТРАЦИИ');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  try {
    // 1. Сначала получим записи за последний месяц
    console.log('📅 Получаем записи за последний месяц...\n');
    
    const url = `https://api.yclients.com/api/v1/records/${companyId}`;
    
    const response = await axios.get(url, {
      params: {
        start_date: '2025-07-01',
        end_date: '2025-08-31',
        include_finance_transactions: 1,
        with_deleted: 0, // Только активные записи
        page: 1,
        count: 300 // Максимум записей
      },
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.api.v2+json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const records = response.data?.data || [];
    console.log(`✅ Получено ${records.length} записей за последний месяц\n`);
    
    // Анализируем уникальных клиентов
    const uniqueClients = new Map();
    const clientsWithPhone = new Set();
    
    records.forEach(record => {
      const clientId = record.client?.id;
      const clientName = record.client?.name;
      const clientPhone = record.client?.phone;
      
      if (clientId) {
        if (!uniqueClients.has(clientId)) {
          uniqueClients.set(clientId, {
            id: clientId,
            name: clientName,
            phone: clientPhone,
            visits: 0
          });
        }
        uniqueClients.get(clientId).visits++;
        
        if (clientPhone) {
          clientsWithPhone.add(clientId);
        }
      }
    });
    
    console.log('📊 Анализ записей:');
    console.log(`  • Всего записей: ${records.length}`);
    console.log(`  • Уникальных клиентов: ${uniqueClients.size}`);
    console.log(`  • Клиентов с телефоном: ${clientsWithPhone.size}`);
    console.log(`  • Среднее визитов на клиента: ${(records.length / uniqueClients.size).toFixed(1)}\n`);
    
    // Показываем топ клиентов
    const topClients = Array.from(uniqueClients.values())
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
    
    console.log('🏆 Топ-10 клиентов по визитам в последний месяц:');
    topClients.forEach((client, i) => {
      console.log(`  ${i+1}. ${client.name || 'Без имени'} (ID: ${client.id}): ${client.visits} визитов`);
    });
    
    // 2. Теперь попробуем получить ВСЕ записи за год
    console.log('\n\n📅 Получаем записи за весь 2025 год...\n');
    
    const yearResponse = await axios.get(url, {
      params: {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        include_finance_transactions: 1,
        with_deleted: 1, // Включая удаленные
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
    
    const yearRecords = yearResponse.data?.data || [];
    console.log(`✅ Получено ${yearRecords.length} записей за 2025 год (первая страница)\n`);
    
    // 3. Сравниваем с нашей БД
    console.log('📊 Сравнение с нашей базой данных:\n');
    
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('visit_count', 0);
    
    const { data: visits } = await supabase
      .from('visits')
      .select('client_id');
    const uniqueInVisits = new Set(visits?.map(v => v.client_id).filter(id => id)).size;
    
    console.log('📊 Статистика:');
    console.log(`  • Клиентов в нашей БД: ${totalClients}`);
    console.log(`  • Клиентов с визитами в visits: ${uniqueInVisits}`);
    console.log(`  • Клиентов в API за месяц: ${uniqueClients.size}`);
    console.log(`  • Записей в API за месяц: ${records.length}`);
    console.log(`  • Записей в API за год (страница 1): ${yearRecords.length}\n`);
    
    // 4. Проверяем пагинацию
    console.log('📄 Проверка пагинации API...\n');
    
    const meta = yearResponse.data?.meta;
    if (meta) {
      console.log('Meta информация от API:');
      console.log(`  • Текущая страница: ${meta.page || 1}`);
      console.log(`  • Всего страниц: ${meta.total_pages || 'не указано'}`);
      console.log(`  • Записей на странице: ${meta.count || yearRecords.length}`);
      console.log(`  • Всего записей: ${meta.total_count || 'не указано'}\n`);
    }
    
    // 5. Важный вывод
    console.log('💡 ВЫВОДЫ:');
    console.log('───────────────────────────────────────────────');
    
    if (yearRecords.length >= 300) {
      console.log('⚠️ API вернул максимум записей (300).');
      console.log('   Возможно, есть еще страницы с данными.');
      console.log('   Нужно использовать пагинацию для получения всех записей.');
    }
    
    const apiClientsCount = uniqueClients.size;
    const percentageWithData = Math.round((uniqueInVisits / totalClients) * 100);
    
    console.log(`\n📊 Только ${percentageWithData}% клиентов имеют синхронизированные визиты.`);
    
    if (apiClientsCount < totalClients / 2) {
      console.log('❗ API возвращает данные только для части клиентов.');
      console.log('   Возможные причины:');
      console.log('   1. Ограничения доступа API (права пользователя)');
      console.log('   2. Данные старше определенного периода недоступны');
      console.log('   3. Клиенты без оформленных записей через YClients');
      console.log('   4. Необходима пагинация для получения всех данных');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response?.data) {
      console.error('Ответ API:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAllRecords().catch(console.error);