#!/usr/bin/env node

/**
 * ФИНАЛЬНАЯ синхронизация ВСЕХ визитов
 * Синхронизирует визиты для КАЖДОГО клиента индивидуально
 * Решает проблему когда API возвращает визиты только при запросе с client_id
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class FinalVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.BATCH_SIZE = 20; // Клиентов за раз
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      processedClients: 0,
      clientsWithVisits: 0,
      clientsWithoutVisits: 0,
      totalVisitsSaved: 0,
      errors: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 ФИНАЛЬНАЯ СИНХРОНИЗАЦИЯ ВСЕХ ВИЗИТОВ');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // 1. Получаем ВСЕХ клиентов с visit_count > 0
      console.log('📋 Загружаем клиентов из БД...');
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, yclients_id, name, phone, visit_count')
        .eq('company_id', this.COMPANY_ID)
        .gt('visit_count', 0)
        .order('visit_count', { ascending: false });
      
      if (!allClients || allClients.length === 0) {
        console.log('❌ Нет клиентов для синхронизации');
        return;
      }
      
      console.log(`✅ Найдено ${allClients.length} клиентов с визитами\n`);
      
      // 2. Проверяем кто уже синхронизирован
      const { data: existingVisits } = await supabase
        .from('visits')
        .select('client_id');
      const alreadySynced = new Set(existingVisits?.map(v => v.client_id).filter(id => id));
      
      console.log(`📊 Уже синхронизировано: ${alreadySynced.size} клиентов`);
      
      // Фильтруем только несинхронизированных
      const clientsToSync = allClients.filter(c => !alreadySynced.has(c.id));
      
      if (clientsToSync.length === 0) {
        console.log('✨ Все клиенты уже синхронизированы!');
        return;
      }
      
      console.log(`📝 Нужно синхронизировать: ${clientsToSync.length} клиентов\n`);
      
      // 3. Синхронизируем клиентов батчами
      const totalBatches = Math.ceil(clientsToSync.length / this.BATCH_SIZE);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * this.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE, clientsToSync.length);
        const batch = clientsToSync.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Батч ${batchNum + 1}/${totalBatches} (клиенты ${batchStart + 1}-${batchEnd}):`);
        console.log('───────────────────────────────────────────────');
        
        // Обрабатываем каждого клиента в батче
        for (const client of batch) {
          await this.syncClientVisits(client);
        }
        
        // Прогресс
        const progress = Math.round((this.stats.processedClients / clientsToSync.length) * 100);
        console.log(`\n📈 Прогресс: ${this.stats.processedClients}/${clientsToSync.length} (${progress}%)`);
        console.log(`   С визитами: ${this.stats.clientsWithVisits}, Без визитов: ${this.stats.clientsWithoutVisits}`);
        console.log(`   Всего визитов сохранено: ${this.stats.totalVisitsSaved}`);
        
        // Пауза между батчами
        if (batchNum < totalBatches - 1) {
          console.log(`\n⏳ Пауза 3 секунды перед следующим батчем...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // 4. Финальная статистика
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Обработано клиентов: ${this.stats.processedClients}`);
      console.log(`  • Клиентов с визитами в API: ${this.stats.clientsWithVisits}`);
      console.log(`  • Клиентов без данных в API: ${this.stats.clientsWithoutVisits}`);
      console.log(`  • Всего визитов сохранено: ${this.stats.totalVisitsSaved}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
      // Проверка результатов
      const { count: totalVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      const { data: clientsWithVisits } = await supabase
        .from('visits')
        .select('client_id')
        .not('client_id', 'is', null);
      const uniqueClientsWithVisits = new Set(clientsWithVisits?.map(v => v.client_id)).size;
      
      console.log('\n📊 Финальные результаты в БД:');
      console.log(`  • Всего визитов: ${totalVisits}`);
      console.log(`  • Клиентов с визитами: ${uniqueClientsWithVisits}`);
      console.log(`  • Процент синхронизации: ${Math.round(uniqueClientsWithVisits / allClients.length * 100)}%`);
      
      if (this.stats.clientsWithoutVisits > this.stats.clientsWithVisits) {
        console.log('\n⚠️ ВНИМАНИЕ:');
        console.log('  Большинство клиентов не имеют доступных визитов в API.');
        console.log('  Возможные причины:');
        console.log('  1. Старые данные (до 2023 года) недоступны через API');
        console.log('  2. Клиенты были импортированы без истории визитов');
        console.log('  3. Ограничения API по датам или правам доступа');
      }
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  async syncClientVisits(client) {
    this.stats.processedClients++;
    
    try {
      // Получаем записи для конкретного клиента
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2020-01-01',
          end_date: '2025-12-31',
          include_finance_transactions: 1,
          with_deleted: 0
        },
        headers: {
          'Authorization': `Bearer ${this.bearerToken}, User ${this.userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      const records = response.data?.data || [];
      
      // Фильтруем только записи этого клиента
      const clientRecords = records.filter(r => 
        r.client?.id === client.yclients_id || 
        r.client?.id === parseInt(client.yclients_id)
      );
      
      if (clientRecords.length === 0) {
        console.log(`  ⚪ ${client.name}: нет данных в API`);
        this.stats.clientsWithoutVisits++;
        return;
      }
      
      // Форматируем визиты
      const visitsToSave = clientRecords.map(record => this.formatVisit(record, client));
      
      // Сохраняем визиты
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
        this.stats.clientsWithVisits++;
        this.stats.totalVisitsSaved += savedCount;
        
        // Обновляем данные клиента
        await this.updateClientData(client.id, visitsToSave);
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`  ⚠️ ${client.name}: rate limit, ждем...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Пробуем еще раз
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
      payment_status: this.getPaymentStatus(record),
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
  
  getPaymentStatus(record) {
    if (!record.paid_full || record.paid_full === 0) {
      return 'not_paid';
    }
    if (record.paid_full < (record.cost || 0)) {
      return 'paid_not_full';
    }
    return 'paid_full';
  }
  
  normalizePhone(phone) {
    if (!phone) return null;
    return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
  }
  
  async updateClientData(clientId, visits) {
    try {
      // Сортируем визиты по дате
      visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
      
      // История визитов
      const visitHistory = visits.slice(0, 50).map(v => ({
        date: v.visit_date,
        time: v.visit_time,
        services: v.service_names
      }));
      
      // Последние услуги
      const lastServices = visits[0]?.service_names || [];
      
      // Любимые мастера
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
      
      // Предпочитаемое время
      const timeCounts = { morning: 0, afternoon: 0, evening: 0 };
      visits.forEach(v => {
        if (v.visit_time) {
          const hour = parseInt(v.visit_time.split(':')[0]);
          if (hour < 12) timeCounts.morning++;
          else if (hour < 17) timeCounts.afternoon++;
          else timeCounts.evening++;
        }
      });
      const preferredTime = Object.entries(timeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      
      // Общая сумма потраченных денег
      const totalSpent = visits.reduce((sum, v) => sum + (v.total_cost || 0), 0);
      
      const updateData = {
        visit_history: visitHistory,
        last_services: lastServices,
        favorite_staff_ids: favoriteStaff,
        preferred_time_slots: preferredTime ? [preferredTime] : [],
        total_spent: totalSpent
      };
      
      delete updateData.id;
      
      await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);
      
    } catch (error) {
      console.error(`    Ошибка обновления данных клиента:`, error.message);
    }
  }
}

// Запускаем
const sync = new FinalVisitsSync();
sync.syncAll().catch(console.error);