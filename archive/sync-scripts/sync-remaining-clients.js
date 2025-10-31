#!/usr/bin/env node

const axios = require('axios');
const { supabase } = require('./src/database/supabase');
require('dotenv').config();

async function syncRemainingClients() {
  console.log('\n🔧 СИНХРОНИЗАЦИЯ ОСТАВШИХСЯ КЛИЕНТОВ БЕЗ ДАННЫХ');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Находим клиентов без данных
  const { data: clientsWithoutData } = await supabase
    .from('clients')
    .select('id, yclients_id, name, visit_count')
    .eq('company_id', companyId)
    .gt('visit_count', 0)
    .or('visit_history.is.null,visit_history.eq.[]');
  
  console.log(`📊 Найдено ${clientsWithoutData?.length || 0} клиентов без данных\n`);
  
  if (!clientsWithoutData || clientsWithoutData.length === 0) {
    console.log('✅ Все клиенты синхронизированы!');
    return;
  }
  
  let synced = 0;
  let notFound = 0;
  
  // Обрабатываем по батчам
  for (let i = 0; i < clientsWithoutData.length; i++) {
    const client = clientsWithoutData[i];
    
    if (!client.yclients_id) {
      notFound++;
      continue;
    }
    
    try {
      const url = `https://api.yclients.com/api/v1/records/${companyId}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2023-12-11',
          end_date: '2025-12-31',
          include_finance_transactions: 1
        },
        headers: {
          'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const records = response.data?.data || [];
      const clientRecords = records.filter(r => 
        String(r.client?.id) === String(client.yclients_id)
      );
      
      if (clientRecords.length > 0) {
        // Сохраняем визиты
        const visitsToSave = clientRecords.map(record => ({
          yclients_visit_id: record.visit_id || null,
          yclients_record_id: record.id,
          company_id: companyId,
          client_id: client.id,
          client_yclients_id: client.yclients_id,
          client_name: record.client?.name || client.name,
          staff_name: record.staff?.name || '',
          staff_yclients_id: record.staff?.id || null,
          service_names: (record.services || []).map(s => s.title || s.name),
          visit_date: record.date?.split(' ')[0] || record.date,
          visit_time: record.datetime ? record.datetime.split(' ')[1]?.substring(0, 5) : null,
          datetime: record.datetime || record.date,
          total_cost: record.cost || 0,
          status: 'completed'
        }));
        
        await supabase
          .from('visits')
          .upsert(visitsToSave, {
            onConflict: 'company_id,yclients_record_id',
            ignoreDuplicates: true
          });
        
        // Обновляем клиента
        const visitHistory = visitsToSave.slice(0, 50).map(v => ({
          date: v.visit_date,
          time: v.visit_time,
          services: v.service_names || []
        }));
        
        const lastServices = visitsToSave[0]?.service_names || [];
        
        await supabase
          .from('clients')
          .update({
            visit_history: visitHistory,
            last_services: lastServices
          })
          .eq('id', client.id);
        
        console.log(`✅ ${client.name}: ${visitsToSave.length} визитов`);
        synced++;
      } else {
        console.log(`⚪ ${client.name}: нет данных в API`);
        notFound++;
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`⏳ Rate limit, ждем 5 сек...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        i--; // Повторяем этого клиента
      } else {
        console.log(`❌ ${client.name}: ${error.message}`);
        notFound++;
      }
    }
    
    // Прогресс
    if ((i + 1) % 20 === 0) {
      const progress = Math.round(((i + 1) / clientsWithoutData.length) * 100);
      console.log(`\n📈 Прогресс: ${progress}% (${i + 1}/${clientsWithoutData.length})\n`);
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
  console.log(`📊 Результаты:`);
  console.log(`  • Синхронизировано: ${synced} клиентов`);
  console.log(`  • Без данных в API: ${notFound} клиентов`);
  
  // Финальная статистика
  const { data: finalStats } = await supabase
    .from('clients')
    .select('id')
    .eq('company_id', companyId)
    .not('visit_history', 'eq', '[]')
    .not('visit_history', 'is', null);
  
  const { count: totalClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);
  
  console.log(`\n📊 Итого в БД:`);
  console.log(`  • Всего клиентов: ${totalClients}`);
  console.log(`  • С историей визитов: ${finalStats?.length || 0} (${Math.round((finalStats?.length || 0)/totalClients*100)}%)`);
}

syncRemainingClients().catch(console.error);