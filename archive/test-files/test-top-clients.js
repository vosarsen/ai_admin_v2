#!/usr/bin/env node

/**
 * Тестируем топ клиентов с большим количеством визитов
 * Проверяем почему их визиты не синхронизируются
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./src/database/supabase');

async function testTopClients() {
  console.log('🔍 ТЕСТИРУЕМ ТОП КЛИЕНТОВ С БОЛЬШИМ КОЛИЧЕСТВОМ ВИЗИТОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Получаем топ клиентов без визитов в таблице visits
  const { data: visits } = await supabase
    .from('visits')
    .select('client_id');
  const syncedIds = new Set(visits?.map(v => v.client_id).filter(id => id));
  
  const { data: topClients } = await supabase
    .from('clients')
    .select('id, yclients_id, name, phone, visit_count')
    .eq('company_id', companyId)
    .gt('visit_count', 20)
    .order('visit_count', { ascending: false })
    .limit(5);
  
  const unsyncedTopClients = topClients?.filter(c => !syncedIds.has(c.id));
  
  console.log(`Тестируем ${unsyncedTopClients?.length || 0} топ клиентов без синхронизированных визитов:\n`);
  
  for (const client of unsyncedTopClients || []) {
    console.log(`\n📌 ${client.name} (ID: ${client.id}, YClients: ${client.yclients_id})`);
    console.log(`   Телефон: ${client.phone}`);
    console.log(`   Visit count в БД: ${client.visit_count}`);
    console.log('   ───────────────────────────────────────');
    
    try {
      // Пробуем получить записи через API
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
        timeout: 15000
      });
      
      const records = response.data?.data || [];
      const clientRecords = records.filter(r => 
        r.client?.id === client.yclients_id || 
        r.client?.id === parseInt(client.yclients_id)
      );
      
      console.log(`   📥 API ответ:`);
      console.log(`      • Всего записей получено: ${records.length}`);
      console.log(`      • Записей для этого клиента: ${clientRecords.length}`);
      
      if (clientRecords.length === 0 && records.length > 0) {
        // Анализируем какие клиенты в ответе
        const clientsInResponse = new Set();
        records.forEach(r => {
          if (r.client?.id) {
            clientsInResponse.add(r.client.id);
          }
        });
        console.log(`      • Клиентов в ответе: ${Array.from(clientsInResponse).slice(0, 5).join(', ')}...`);
        console.log(`      ⚠️ Клиент ${client.yclients_id} НЕ найден в ответе API!`);
      }
      
      if (clientRecords.length > 0) {
        console.log(`   ✅ Найдены визиты в API!`);
        console.log(`      Примеры дат визитов:`);
        clientRecords.slice(0, 5).forEach((r, i) => {
          console.log(`      ${i+1}. ${r.date} - ${r.services?.map(s => s.title).join(', ')}`);
        });
      } else {
        console.log(`   ❌ API не вернул визитов для этого клиента`);
        console.log(`      Хотя в БД указано ${client.visit_count} визитов`);
      }
      
    } catch (error) {
      console.log(`   ❌ Ошибка API: ${error.message}`);
    }
  }
  
  console.log('\n\n💡 АНАЛИЗ ПРОБЛЕМЫ:');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Проверяем сколько всего уникальных клиентов в таблице visits
  const { data: visitsClients } = await supabase
    .from('visits')
    .select('client_yclients_id');
  const uniqueYclientsIds = new Set(visitsClients?.map(v => v.client_yclients_id).filter(id => id));
  
  console.log(`📊 Статистика визитов:`);
  console.log(`  • Уникальных YClients ID в visits: ${uniqueYclientsIds.size}`);
  console.log(`  • Всего клиентов в БД: 1113`);
  console.log(`  • Процент клиентов с данными от API: ${Math.round(uniqueYclientsIds.size / 1113 * 100)}%`);
  
  console.log('\n⚠️ ВЫВОД:');
  console.log('  YClients API возвращает визиты только для ~10% клиентов.');
  console.log('  Возможные причины:');
  console.log('  1. Старые визиты (до определенной даты) недоступны через API');
  console.log('  2. Ограничения прав доступа токена');
  console.log('  3. Клиенты были импортированы, но визиты не были');
  console.log('  4. Данные в YClients были очищены/архивированы');
}

testTopClients().catch(console.error);