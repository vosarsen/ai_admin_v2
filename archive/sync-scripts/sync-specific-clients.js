#!/usr/bin/env node

/**
 * Синхронизация визитов для конкретных клиентов
 * Для отладки проблемы с топ клиентами
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('./src/database/supabase');

async function syncSpecificClients() {
  console.log('🔧 СИНХРОНИЗАЦИЯ ВИЗИТОВ ДЛЯ КОНКРЕТНЫХ КЛИЕНТОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
  const userToken = process.env.YCLIENTS_USER_TOKEN;
  const companyId = 962302;
  
  // Топ клиенты которые должны иметь визиты
  const topClients = [
    { id: 1453, yclients_id: 212316367, name: 'Алексей', visit_count: 33 },
    { id: 2210, yclients_id: 212393401, name: 'Леонид', visit_count: 27 },
    { id: 2002, yclients_id: 227109800, name: 'Евгений', visit_count: 27 },
    { id: 17222, yclients_id: 207690339, name: 'Сергей', visit_count: 25 },
    { id: 1941, yclients_id: 207700705, name: 'Дмитрий', visit_count: 25 }
  ];
  
  console.log(`Синхронизируем ${topClients.length} топ клиентов\n`);
  
  let totalVisitsSaved = 0;
  
  for (const client of topClients) {
    console.log(`\n📌 ${client.name} (ID: ${client.id}, YClients: ${client.yclients_id})`);
    console.log('───────────────────────────────────────');
    
    try {
      // Получаем записи клиента
      const url = `https://api.yclients.com/api/v1/records/${companyId}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2020-01-01',
          end_date: '2025-12-31',
          include_finance_transactions: 1,
          with_deleted: 0
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
      
      console.log(`  📥 Получено ${clientRecords.length} записей из API`);
      
      if (clientRecords.length === 0) {
        console.log(`  ❌ Нет записей для синхронизации`);
        continue;
      }
      
      // Форматируем визиты
      const visitsToSave = [];
      
      for (const record of clientRecords) {
        const services = record.services || [];
        const staff = record.staff || {};
        
        const visit = {
          yclients_visit_id: record.visit_id || null,
          yclients_record_id: record.id,
          company_id: companyId,
          
          // ВАЖНО: связываем с нашим клиентом по ID
          client_id: client.id,
          client_yclients_id: client.yclients_id,
          client_phone: record.client?.phone?.replace(/\D/g, '').replace(/^8/, '7') || '',
          client_name: record.client?.name || client.name,
          
          staff_id: staff.id || null,
          staff_name: staff.name || '',
          staff_yclients_id: staff.id || null,
          
          services: services.map(s => ({
            id: s.id,
            name: s.title || s.name,
            cost: s.cost || s.price_min || 0,
            duration: s.duration || 0
          })),
          service_names: services.map(s => s.title || s.name),
          service_ids: services.map(s => s.id),
          services_cost: services.reduce((sum, s) => sum + (s.cost || s.price_min || 0), 0),
          
          visit_date: record.date,
          visit_time: record.datetime ? record.datetime.split(' ')[1]?.substring(0, 5) : null,
          datetime: record.datetime || record.date + ' 12:00:00',
          duration: services.reduce((sum, s) => sum + (s.duration || 0), 0),
          
          total_cost: record.cost || 0,
          paid_amount: record.paid_full || record.paid || 0,
          discount_amount: record.discount || 0,
          tips_amount: record.tips || 0,
          payment_status: record.paid_full >= (record.cost || 0) ? 'paid_full' : 'not_paid',
          payment_method: record.payment_method || 'unknown',
          
          attendance: record.attendance || 1,
          status: record.deleted ? 'cancelled' : (record.attendance === -1 ? 'no_show' : 'completed'),
          is_online: record.online || false,
          
          comment: record.comment || null,
          rating: record.rate || null,
          review: record.review || null,
          source: record.from_url ? 'online' : 'unknown'
        };
        
        visitsToSave.push(visit);
      }
      
      console.log(`  💾 Сохраняем ${visitsToSave.length} визитов...`);
      
      // Сохраняем визиты
      const { data, error } = await supabase
        .from('visits')
        .upsert(visitsToSave, {
          onConflict: 'company_id,yclients_record_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) {
        console.error(`  ❌ Ошибка сохранения:`, error.message);
      } else {
        console.log(`  ✅ Сохранено ${data?.length || 0} визитов`);
        totalVisitsSaved += data?.length || 0;
        
        // Обновляем статистику клиента
        const visitHistory = visitsToSave.slice(0, 50).map(v => ({
          date: v.visit_date,
          time: v.visit_time,
          services: v.service_names
        }));
        
        const lastServices = visitsToSave[0]?.service_names || [];
        
        const staffCounts = {};
        visitsToSave.forEach(v => {
          if (v.staff_name) {
            staffCounts[v.staff_name] = (staffCounts[v.staff_name] || 0) + 1;
          }
        });
        
        const favoriteStaff = Object.entries(staffCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
        
        const updateData = {
          visit_history: visitHistory,
          last_services: lastServices,
          favorite_staff_ids: favoriteStaff
        };
        
        delete updateData.id;
        
        await supabase
          .from('clients')
          .update(updateData)
          .eq('id', client.id);
        
        console.log(`  ✅ Обновлены данные клиента`);
      }
      
    } catch (error) {
      console.error(`  ❌ Ошибка:`, error.message);
    }
  }
  
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА');
  console.log(`\n📊 Всего сохранено визитов: ${totalVisitsSaved}`);
  
  // Проверяем результаты
  console.log('\n📊 Проверка результатов:\n');
  
  for (const client of topClients) {
    const { count } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);
    
    console.log(`  • ${client.name}: ${count || 0} визитов в БД (ожидалось ~${client.visit_count})`);
  }
}

syncSpecificClients().catch(console.error);