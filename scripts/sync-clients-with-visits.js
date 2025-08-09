#!/usr/bin/env node

/**
 * Синхронизация ТОЛЬКО клиентов с visit_count > 0
 * Более быстрый вариант для важных клиентов
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class ClientsWithVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.PARALLEL_REQUESTS = 5; // Параллельные запросы
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      processed: 0,
      synced: 0,
      totalVisits: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 СИНХРОНИЗАЦИЯ КЛИЕНТОВ С ВИЗИТАМИ');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Получаем клиентов с визитами
    const { data: clients } = await supabase
      .from('clients')
      .select('id, yclients_id, name, visit_count')
      .eq('company_id', this.COMPANY_ID)
      .gt('visit_count', 0)
      .order('visit_count', { ascending: false });
    
    console.log(`📊 Найдено ${clients?.length || 0} клиентов с визитами\n`);
    
    // Обрабатываем батчами
    for (let i = 0; i < clients.length; i += this.PARALLEL_REQUESTS) {
      const batch = clients.slice(i, i + this.PARALLEL_REQUESTS);
      
      // Параллельная обработка
      const promises = batch.map(client => this.syncClient(client));
      await Promise.all(promises);
      
      const progress = Math.round(((i + batch.length) / clients.length) * 100);
      console.log(`Прогресс: ${progress}% (${this.stats.processed}/${clients.length})`);
      
      // Пауза между батчами
      if (i + this.PARALLEL_REQUESTS < clients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Обновляем данные клиентов
    console.log('\n📊 Обновляем данные клиентов...');
    await this.updateClientsData();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!');
    console.log(`  • Обработано: ${this.stats.processed} клиентов`);
    console.log(`  • Синхронизировано: ${this.stats.synced} клиентов`);
    console.log(`  • Всего визитов: ${this.stats.totalVisits}`);
    console.log(`  • Время: ${duration} секунд`);
  }
  
  async syncClient(client) {
    this.stats.processed++;
    
    if (!client.yclients_id) return;
    
    try {
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2023-12-11',
          end_date: '2025-12-31',
          include_finance_transactions: 1
        },
        headers: {
          'Authorization': `Bearer ${this.bearerToken}, User ${this.userToken}`,
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
        const visitsToSave = clientRecords.map(record => ({
          yclients_visit_id: record.visit_id || null,
          yclients_record_id: record.id,
          company_id: this.COMPANY_ID,
          client_id: client.id,
          client_yclients_id: client.yclients_id,
          client_phone: record.client?.phone?.replace(/\D/g, '').replace(/^8/, '7') || '',
          client_name: record.client?.name || client.name,
          staff_id: record.staff?.id || null,
          staff_name: record.staff?.name || '',
          staff_yclients_id: record.staff?.id || null,
          services: (record.services || []).map(s => ({
            id: s.id,
            name: s.title || s.name,
            cost: s.cost || 0,
            duration: s.duration || 0
          })),
          service_names: (record.services || []).map(s => s.title || s.name),
          service_ids: (record.services || []).map(s => s.id),
          services_cost: (record.services || []).reduce((sum, s) => sum + (s.cost || 0), 0),
          visit_date: record.date?.split(' ')[0] || record.date,
          visit_time: record.datetime ? record.datetime.split(' ')[1]?.substring(0, 5) : null,
          datetime: record.datetime || record.date,
          duration: (record.services || []).reduce((sum, s) => sum + (s.duration || 0), 0),
          total_cost: record.cost || 0,
          paid_amount: record.paid_full || record.paid || 0,
          discount_amount: record.discount || 0,
          payment_status: record.paid_full >= (record.cost || 0) ? 'paid_full' : 'not_paid',
          attendance: record.attendance || 1,
          status: record.deleted ? 'cancelled' : 'completed'
        }));
        
        await supabase
          .from('visits')
          .upsert(visitsToSave, {
            onConflict: 'company_id,yclients_record_id',
            ignoreDuplicates: true
          });
        
        this.stats.synced++;
        this.stats.totalVisits += visitsToSave.length;
        console.log(`  ✅ ${client.name}: ${visitsToSave.length} визитов`);
      }
    } catch (error) {
      if (error.response?.status !== 429) {
        console.log(`  ❌ ${client.name}: ${error.message}`);
      }
    }
  }
  
  async updateClientsData() {
    // Получаем мастеров
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, yclients_id')
      .eq('company_id', this.COMPANY_ID);
    
    const staffMap = {};
    staffList?.forEach(s => {
      if (s.yclients_id) staffMap[s.yclients_id] = s.id;
    });
    
    // Обновляем клиентов
    const { data: clientsWithVisits } = await supabase
      .from('visits')
      .select('client_id')
      .not('client_id', 'is', null);
    
    const uniqueIds = [...new Set(clientsWithVisits?.map(v => v.client_id))];
    
    for (const clientId of uniqueIds) {
      const { data: visits } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', clientId)
        .order('visit_date', { ascending: false });
      
      if (!visits || visits.length === 0) continue;
      
      const visitHistory = visits.slice(0, 50).map(v => ({
        date: v.visit_date,
        time: v.visit_time,
        services: v.service_names || []
      }));
      
      const lastServices = visits[0]?.service_names || [];
      
      const staffCounts = {};
      visits.forEach(v => {
        if (v.staff_yclients_id && staffMap[v.staff_yclients_id]) {
          const staffId = staffMap[v.staff_yclients_id];
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
    }
    
    console.log(`  ✅ Обновлено ${uniqueIds.length} клиентов`);
  }
}

const sync = new ClientsWithVisitsSync();
sync.syncAll().catch(console.error);