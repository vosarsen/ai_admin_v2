#!/usr/bin/env node

/**
 * Синхронизация визитов для АКТИВНЫХ клиентов (последние 6 месяцев)
 * Более быстрая и эффективная синхронизация
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class RecentClientsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.BATCH_SIZE = 10;
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
    
    console.log('\n🚀 СИНХРОНИЗАЦИЯ ВИЗИТОВ ДЛЯ АКТИВНЫХ КЛИЕНТОВ');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // Получаем активных клиентов (последние 6 месяцев)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      console.log(`📅 Ищем клиентов активных после ${sixMonthsAgo.toISOString().split('T')[0]}...\n`);
      
      const { data: activeClients } = await supabase
        .from('clients')
        .select('id, yclients_id, name, phone, visit_count, last_visit_date')
        .eq('company_id', this.COMPANY_ID)
        .gte('last_visit_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('visit_count', { ascending: false });
      
      if (!activeClients || activeClients.length === 0) {
        console.log('❌ Активные клиенты не найдены');
        return;
      }
      
      console.log(`✅ Найдено ${activeClients.length} активных клиентов\n`);
      
      // Проверяем кто уже синхронизирован
      const { data: existingVisits } = await supabase
        .from('visits')
        .select('client_id');
      const alreadySynced = new Set(existingVisits?.map(v => v.client_id).filter(id => id));
      
      const clientsToSync = activeClients.filter(c => !alreadySynced.has(c.id));
      
      console.log(`📊 Уже синхронизировано: ${alreadySynced.size} клиентов`);
      console.log(`📝 Нужно синхронизировать: ${clientsToSync.length} клиентов\n`);
      
      if (clientsToSync.length === 0) {
        console.log('✨ Все активные клиенты уже синхронизированы!');
        return;
      }
      
      // Синхронизируем батчами
      const totalBatches = Math.ceil(clientsToSync.length / this.BATCH_SIZE);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * this.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE, clientsToSync.length);
        const batch = clientsToSync.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Батч ${batchNum + 1}/${totalBatches} (клиенты ${batchStart + 1}-${batchEnd}):`);
        
        // Параллельная обработка клиентов в батче
        const promises = batch.map(client => this.syncClientVisits(client));
        await Promise.all(promises);
        
        // Прогресс
        const progress = Math.round((this.stats.processed / clientsToSync.length) * 100);
        console.log(`\n📈 Прогресс: ${this.stats.processed}/${clientsToSync.length} (${progress}%)`);
        console.log(`   С визитами: ${this.stats.withVisits}, Без визитов: ${this.stats.withoutVisits}`);
        
        // Пауза между батчами
        if (batchNum < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Обработано клиентов: ${this.stats.processed}`);
      console.log(`  • Клиентов с визитами: ${this.stats.withVisits}`);
      console.log(`  • Клиентов без данных: ${this.stats.withoutVisits}`);
      console.log(`  • Всего визитов сохранено: ${this.stats.totalVisits}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
      // Финальная проверка
      const { count: totalVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      const { data: clientsWithVisits } = await supabase
        .from('visits')
        .select('client_id')
        .not('client_id', 'is', null);
      const uniqueClients = new Set(clientsWithVisits?.map(v => v.client_id)).size;
      
      console.log('\n📊 Финальные результаты:');
      console.log(`  • Всего визитов в БД: ${totalVisits}`);
      console.log(`  • Клиентов с визитами: ${uniqueClients}`);
      console.log(`  • Процент активных клиентов с визитами: ${Math.round(uniqueClients / activeClients.length * 100)}%`);
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  async syncClientVisits(client) {
    this.stats.processed++;
    
    try {
      // Получаем визиты клиента
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
      const clientRecords = records.filter(r => 
        r.client?.id === client.yclients_id || 
        r.client?.id === parseInt(client.yclients_id)
      );
      
      if (clientRecords.length === 0) {
        console.log(`  ⚪ ${client.name}: нет визитов`);
        this.stats.withoutVisits++;
        return;
      }
      
      // Форматируем визиты
      const visitsToSave = clientRecords.map(record => this.formatVisit(record, client));
      
      // Сохраняем
      const { data, error } = await supabase
        .from('visits')
        .upsert(visitsToSave, {
          onConflict: 'company_id,yclients_record_id',
          ignoreDuplicates: true
        })
        .select();
      
      if (error) {
        console.log(`  ❌ ${client.name}: ошибка`);
        this.stats.errors++;
      } else {
        const count = data?.length || 0;
        console.log(`  ✅ ${client.name}: ${count} визитов`);
        this.stats.withVisits++;
        this.stats.totalVisits += count;
        
        // Обновляем данные клиента
        await this.updateClientData(client.id, visitsToSave);
      }
      
    } catch (error) {
      console.log(`  ❌ ${client.name}: ${error.message}`);
      this.stats.errors++;
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
  
  async updateClientData(clientId, visits) {
    try {
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      
      const visitHistory = visits.slice(0, 50).map(v => ({
        date: v.visit_date,
        time: v.visit_time,
        services: v.service_names
      }));
      
      const lastServices = visits[0]?.service_names || [];
      
      const staffCounts = {};
      visits.forEach(v => {
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
        .eq('id', clientId);
      
    } catch (error) {
      // Игнорируем ошибки обновления
    }
  }
}

// Запускаем
const sync = new RecentClientsSync();
sync.syncAll().catch(console.error);