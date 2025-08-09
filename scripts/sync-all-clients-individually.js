#!/usr/bin/env node

/**
 * ПОЛНАЯ синхронизация визитов - запрашиваем для КАЖДОГО клиента отдельно
 * Это единственный способ получить ВСЕ визиты из YClients
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class IndividualClientsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.BATCH_SIZE = 20; // Обрабатываем по 20 клиентов за раз
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      processed: 0,
      withVisits: 0,
      withoutVisits: 0,
      totalVisits: 0,
      errors: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 ПОЛНАЯ СИНХРОНИЗАЦИЯ ВИЗИТОВ (ИНДИВИДУАЛЬНЫЕ ЗАПРОСЫ)');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // Получаем ВСЕХ клиентов
      console.log('📋 Загружаем всех клиентов из БД...');
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, yclients_id, name, phone, visit_count')
        .eq('company_id', this.COMPANY_ID)
        .order('visit_count', { ascending: false });
      
      if (!allClients || allClients.length === 0) {
        console.log('❌ Клиенты не найдены');
        return;
      }
      
      console.log(`✅ Найдено ${allClients.length} клиентов\n`);
      
      // Разбиваем на батчи
      const totalBatches = Math.ceil(allClients.length / this.BATCH_SIZE);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * this.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE, allClients.length);
        const batch = allClients.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Батч ${batchNum + 1}/${totalBatches} (клиенты ${batchStart + 1}-${batchEnd}):`);
        console.log('───────────────────────────────────────────────');
        
        // Обрабатываем каждого клиента
        for (const client of batch) {
          await this.syncClientVisits(client);
        }
        
        // Статистика
        const progress = Math.round((this.stats.processed / allClients.length) * 100);
        console.log(`\n📈 Прогресс: ${this.stats.processed}/${allClients.length} (${progress}%)`);
        console.log(`   С визитами: ${this.stats.withVisits}, Без визитов: ${this.stats.withoutVisits}`);
        console.log(`   Всего визитов сохранено: ${this.stats.totalVisits}`);
        
        // Пауза между батчами
        if (batchNum < totalBatches - 1) {
          console.log(`⏳ Пауза 3 секунды...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Обновляем данные в таблице clients
      console.log('\n\n📊 Обновляем данные клиентов из визитов...');
      await this.updateClientsData();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Обработано клиентов: ${this.stats.processed}`);
      console.log(`  • Клиентов с визитами в API: ${this.stats.withVisits}`);
      console.log(`  • Клиентов без данных в API: ${this.stats.withoutVisits}`);
      console.log(`  • Всего визитов сохранено: ${this.stats.totalVisits}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  async syncClientVisits(client) {
    this.stats.processed++;
    
    if (!client.yclients_id) {
      console.log(`  ⚪ ${client.name}: нет yclients_id`);
      this.stats.withoutVisits++;
      return;
    }
    
    try {
      // Запрашиваем визиты для конкретного клиента
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2023-12-11', // С открытия барбершопа
          end_date: '2025-12-31',
          include_finance_transactions: 1,
          with_deleted: 0
        },
        headers: {
          'Authorization': `Bearer ${this.bearerToken}, User ${this.userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const records = response.data?.data || [];
      
      // Фильтруем только записи этого клиента
      const clientRecords = records.filter(r => 
        String(r.client?.id) === String(client.yclients_id)
      );
      
      if (clientRecords.length === 0) {
        console.log(`  ⚪ ${client.name}: 0 визитов`);
        this.stats.withoutVisits++;
        return;
      }
      
      // Форматируем и сохраняем визиты
      const visitsToSave = clientRecords.map(record => this.formatVisit(record, client));
      
      const { data, error } = await supabase
        .from('visits')
        .upsert(visitsToSave, {
          onConflict: 'company_id,yclients_record_id',
          ignoreDuplicates: true
        })
        .select();
      
      if (error) {
        console.log(`  ❌ ${client.name}: ошибка сохранения`);
        this.stats.errors++;
      } else {
        const savedCount = data?.length || 0;
        console.log(`  ✅ ${client.name}: ${savedCount} визитов`);
        this.stats.withVisits++;
        this.stats.totalVisits += savedCount;
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`  ⚠️ ${client.name}: rate limit`);
        // Ждем и пробуем еще раз
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.syncClientVisits(client);
      } else {
        console.log(`  ❌ ${client.name}: ${error.message}`);
        this.stats.errors++;
      }
    }
  }
  
  formatVisit(record, client) {
    const services = record.services || [];
    const staff = record.staff || {};
    
    return {
      yclients_visit_id: record.visit_id || null,
      yclients_record_id: record.id,
      company_id: this.COMPANY_ID,
      
      client_id: client.id,
      client_yclients_id: client.yclients_id,
      client_phone: this.normalizePhone(record.client?.phone) || client.phone || '',
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
      
      visit_date: record.date?.split(' ')[0] || record.date,
      visit_time: record.datetime ? record.datetime.split(' ')[1]?.substring(0, 5) : null,
      datetime: record.datetime || record.date,
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
  }
  
  normalizePhone(phone) {
    if (!phone) return null;
    return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
  }
  
  async updateClientsData() {
    // Получаем мастеров для маппинга
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, yclients_id')
      .eq('company_id', this.COMPANY_ID);
    
    const staffYclientsToId = {};
    staffList?.forEach(staff => {
      if (staff.yclients_id) staffYclientsToId[staff.yclients_id] = staff.id;
    });
    
    // Получаем клиентов с визитами
    const { data: clientsWithVisits } = await supabase
      .from('visits')
      .select('client_id')
      .not('client_id', 'is', null);
    
    const uniqueClientIds = [...new Set(clientsWithVisits?.map(v => v.client_id))];
    console.log(`  Обновляем данные для ${uniqueClientIds.length} клиентов...`);
    
    let updated = 0;
    
    for (const clientId of uniqueClientIds) {
      // Получаем визиты
      const { data: visits } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', clientId)
        .order('visit_date', { ascending: false });
      
      if (!visits || visits.length === 0) continue;
      
      // Формируем данные
      const visitHistory = visits.slice(0, 50).map(v => ({
        date: v.visit_date,
        time: v.visit_time,
        services: v.service_names || []
      }));
      
      const lastServices = visits[0]?.service_names || [];
      
      // Считаем мастеров
      const staffCounts = {};
      visits.forEach(v => {
        if (v.staff_yclients_id && staffYclientsToId[v.staff_yclients_id]) {
          const staffId = staffYclientsToId[v.staff_yclients_id];
          staffCounts[staffId] = (staffCounts[staffId] || 0) + 1;
        }
      });
      
      const favoriteStaffIds = Object.entries(staffCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => parseInt(id));
      
      const updateData = {
        visit_history: visitHistory,
        last_services: lastServices
      };
      
      if (favoriteStaffIds.length > 0) {
        updateData.favorite_staff_ids = favoriteStaffIds;
      }
      
      await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);
      
      updated++;
      if (updated % 50 === 0) {
        console.log(`    Обновлено ${updated} клиентов...`);
      }
    }
    
    console.log(`  ✅ Обновлено ${updated} клиентов`);
  }
}

// Запускаем
const sync = new IndividualClientsSync();
sync.syncAll().catch(console.error);