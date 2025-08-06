#!/usr/bin/env node

/**
 * Скрипт для исправления total_spent у всех клиентов
 * Проблема: YClients API возвращает sold_amount, а не spent
 * Решение: Перезагрузить всех клиентов и использовать sold_amount
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

const CONFIG = {
  COMPANY_ID: 962302,
  BASE_URL: 'https://api.yclients.com/api/v1',
  BEARER_TOKEN: process.env.YCLIENTS_BEARER_TOKEN,
  USER_TOKEN: process.env.YCLIENTS_USER_TOKEN,
};

async function fetchAllClients() {
  console.log('🔄 Загрузка ВСЕХ клиентов из YClients...');
  
  const headers = {
    'Authorization': `Bearer ${CONFIG.BEARER_TOKEN}, User ${CONFIG.USER_TOKEN}`,
    'Accept': 'application/vnd.api.v2+json',
    'Content-Type': 'application/json'
  };

  let allClients = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`📄 Запрашиваем страницу ${page}...`);
      
      const response = await axios.post(
        `${CONFIG.BASE_URL}/company/${CONFIG.COMPANY_ID}/clients/search`,
        {
          page: page,
          page_size: 200,
          fields: [
            "id", "name", "phone", "email", "discount",
            "first_visit_date", "last_visit_date",
            "sold_amount", "spent", "visits_count"
          ],
          order_by: "name",
          order_by_direction: "ASC"
        },
        { headers }
      );

      const clients = response.data?.data || [];
      console.log(`   ✅ Получено ${clients.length} клиентов`);
      
      // Логируем примеры данных для отладки
      if (page === 1 && clients.length > 0) {
        console.log('\n📊 Пример данных клиента:');
        const sample = clients.find(c => c.sold_amount > 0) || clients[0];
        console.log(`   Имя: ${sample.name}`);
        console.log(`   Телефон: ${sample.phone}`);
        console.log(`   sold_amount: ${sample.sold_amount}`);
        console.log(`   spent: ${sample.spent}`);
        console.log(`   visits_count: ${sample.visits_count}`);
      }

      allClients = allClients.concat(clients);

      // Проверяем есть ли еще страницы
      const totalCount = response.data?.meta?.total_count || 0;
      hasMore = allClients.length < totalCount && clients.length === 200;
      page++;

      // Небольшая задержка для соблюдения rate limits
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error) {
      console.error(`❌ Ошибка на странице ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`\n✅ Загружено всего: ${allClients.length} клиентов`);
  return allClients;
}

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
}

function calculateLoyaltyLevel(visits, totalSpent) {
  if (visits >= 20 && totalSpent >= 50000) return 'VIP';
  if (visits >= 10 && totalSpent >= 20000) return 'Gold';
  if (visits >= 5 && totalSpent >= 8000) return 'Silver';
  if (visits >= 2) return 'Bronze';
  return 'New';
}

async function updateClientInSupabase(client) {
  // ВАЖНО: используем sold_amount как основной источник данных о потраченных суммах
  const totalSpent = client.sold_amount || client.spent || 0;
  const visits = client.visits_count || 0;
  
  const clientData = {
    yclients_id: client.id,
    company_id: CONFIG.COMPANY_ID,
    name: client.name || 'Без имени',
    phone: normalizePhone(client.phone),
    raw_phone: client.phone,
    email: client.email || null,
    discount: client.discount || 0,
    visit_count: visits,
    total_spent: totalSpent,  // КЛЮЧЕВОЕ ПОЛЕ!
    first_visit_date: client.first_visit_date || null,
    last_visit_date: client.last_visit_date || null,
    loyalty_level: calculateLoyaltyLevel(visits, totalSpent),
    average_bill: visits > 0 ? Math.round(totalSpent / visits) : 0,
    last_sync_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('clients')
    .upsert(clientData, { 
      onConflict: 'yclients_id,company_id',
      ignoreDuplicates: false  // ВАЖНО: форсируем обновление
    });

  if (error) {
    throw error;
  }

  return { totalSpent, visits };
}

async function main() {
  console.log('🚀 ЗАПУСК ИСПРАВЛЕНИЯ total_spent ДЛЯ ВСЕХ КЛИЕНТОВ');
  console.log('=' .repeat(60));
  
  try {
    // 1. Загружаем всех клиентов из YClients
    const clients = await fetchAllClients();
    
    // 2. Статистика по загруженным данным
    const withSpent = clients.filter(c => (c.sold_amount || c.spent) > 0);
    console.log(`\n📊 Статистика загруженных данных:`);
    console.log(`   Всего клиентов: ${clients.length}`);
    console.log(`   С суммами > 0: ${withSpent.length}`);
    
    // Топ-5 по суммам
    const topSpenders = [...withSpent]
      .sort((a, b) => (b.sold_amount || 0) - (a.sold_amount || 0))
      .slice(0, 5);
    
    console.log(`\n💰 ТОП-5 по потраченным суммам:`);
    topSpenders.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.name} (${c.phone}): ${c.sold_amount || c.spent} руб`);
    });

    // 3. Обновляем всех клиентов в Supabase
    console.log(`\n🔄 Начинаем обновление в Supabase...`);
    
    let processed = 0;
    let errors = 0;
    let totalUpdatedSpent = 0;
    let clientsWithSpent = 0;

    for (const client of clients) {
      try {
        const result = await updateClientInSupabase(client);
        processed++;
        
        if (result.totalSpent > 0) {
          totalUpdatedSpent += result.totalSpent;
          clientsWithSpent++;
        }

        // Прогресс каждые 100 клиентов
        if (processed % 100 === 0) {
          console.log(`   📊 Обработано: ${processed}/${clients.length}`);
        }

      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`   ❌ Ошибка для ${client.name}: ${error.message}`);
        }
      }
    }

    // 4. Финальная статистика
    console.log(`\n✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!`);
    console.log('=' .repeat(60));
    console.log(`   Обработано: ${processed} клиентов`);
    console.log(`   Ошибки: ${errors}`);
    console.log(`   Клиентов с суммами: ${clientsWithSpent}`);
    console.log(`   Общая сумма: ${totalUpdatedSpent.toLocaleString('ru-RU')} руб`);

    // 5. Проверяем результат для Леонида
    console.log(`\n🔍 Проверка конкретных клиентов:`);
    
    const { data: leonid } = await supabase
      .from('clients')
      .select('name, phone, visit_count, total_spent, loyalty_level')
      .eq('phone', '79035059524')
      .single();
    
    if (leonid) {
      console.log(`   Леонид: ${leonid.total_spent.toLocaleString('ru-RU')} руб (${leonid.loyalty_level})`);
    }

    // Проверяем топ-5 в базе
    const { data: topInDb } = await supabase
      .from('clients')
      .select('name, phone, total_spent')
      .order('total_spent', { ascending: false })
      .limit(5);

    console.log(`\n💎 ТОП-5 в базе после обновления:`);
    topInDb.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.name}: ${c.total_spent.toLocaleString('ru-RU')} руб`);
    });

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { fetchAllClients, updateClientInSupabase };