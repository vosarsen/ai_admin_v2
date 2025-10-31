#!/usr/bin/env node

/**
 * ПОЛНАЯ синхронизация визитов и клиентов
 * 1. Создает недостающих клиентов из записей
 * 2. Синхронизирует ВСЕ визиты с пагинацией
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class CompleteVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.PAGE_SIZE = 300;
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      totalRecords: 0,
      newClients: 0,
      existingClients: 0,
      savedVisits: 0,
      errors: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 ПОЛНАЯ СИНХРОНИЗАЦИЯ ВИЗИТОВ И КЛИЕНТОВ');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // 1. Очищаем таблицу visits
      console.log('🗑️ Очищаем таблицу visits...');
      await supabase.from('visits').delete().neq('id', 0);
      console.log('✅ Таблица очищена\n');
      
      // 2. Загружаем существующих клиентов
      console.log('📋 Загружаем существующих клиентов...');
      const { data: dbClients } = await supabase
        .from('clients')
        .select('id, yclients_id, phone, name')
        .eq('company_id', this.COMPANY_ID);
      
      const clientsByYclientsId = new Map();
      const clientsByPhone = new Map();
      
      dbClients?.forEach(client => {
        if (client.yclients_id) {
          clientsByYclientsId.set(client.yclients_id, client);
        }
        if (client.phone) {
          const normalized = this.normalizePhone(client.phone);
          clientsByPhone.set(normalized, client);
        }
      });
      
      console.log(`✅ Загружено ${dbClients?.length || 0} существующих клиентов\n`);
      
      // 3. Получаем ВСЕ записи через пагинацию
      const allVisits = await this.fetchAllRecords();
      
      console.log(`\n📊 Получено всего ${allVisits.length} записей\n`);
      
      // 4. Обрабатываем записи и создаем недостающих клиентов
      console.log('👥 Обрабатываем клиентов...\n');
      
      const visitsToSave = [];
      const newClientsToCreate = new Map();
      
      for (const record of allVisits) {
        const clientData = record.client;
        if (!clientData?.id) continue;
        
        const clientYclientsId = clientData.id;
        const clientPhone = this.normalizePhone(clientData.phone);
        const clientName = clientData.name || '';
        
        // Ищем существующего клиента
        let dbClient = clientsByYclientsId.get(clientYclientsId);
        
        if (!dbClient && clientPhone) {
          dbClient = clientsByPhone.get(clientPhone);
        }
        
        // Если клиента нет - добавляем в список для создания
        if (!dbClient && !newClientsToCreate.has(clientYclientsId)) {
          newClientsToCreate.set(clientYclientsId, {
            yclients_id: clientYclientsId,
            phone: clientPhone || '',
            name: clientName,
            company_id: this.COMPANY_ID,
            visit_count: 0,
            total_spent: 0,
            created_at: new Date().toISOString()
          });
        }
        
        // Форматируем визит
        const visit = this.formatVisit(record, dbClient);
        if (visit) {
          visitsToSave.push(visit);
          
          // Увеличиваем счетчик визитов для новых клиентов
          if (!dbClient && newClientsToCreate.has(clientYclientsId)) {
            const newClient = newClientsToCreate.get(clientYclientsId);
            newClient.visit_count++;
            newClient.total_spent += (record.cost || 0);
          }
        }
      }
      
      // 5. Создаем новых клиентов
      if (newClientsToCreate.size > 0) {
        console.log(`📝 Создаем ${newClientsToCreate.size} новых клиентов...\n`);
        
        const newClientsArray = Array.from(newClientsToCreate.values());
        const BATCH_SIZE = 50;
        
        for (let i = 0; i < newClientsArray.length; i += BATCH_SIZE) {
          const batch = newClientsArray.slice(i, i + BATCH_SIZE);
          
          const { data: createdClients, error } = await supabase
            .from('clients')
            .upsert(batch, {
              onConflict: 'company_id,yclients_id',
              ignoreDuplicates: false
            })
            .select();
          
          if (error) {
            console.error(`  ❌ Ошибка создания клиентов:`, error.message);
          } else {
            this.stats.newClients += createdClients?.length || 0;
            
            // Добавляем созданных клиентов в индекс
            createdClients?.forEach(client => {
              clientsByYclientsId.set(client.yclients_id, client);
              if (client.phone) {
                const normalized = this.normalizePhone(client.phone);
                clientsByPhone.set(normalized, client);
              }
            });
          }
        }
        
        console.log(`  ✅ Создано ${this.stats.newClients} новых клиентов\n`);
      }
      
      // 6. Обновляем client_id в визитах
      console.log('🔗 Связываем визиты с клиентами...\n');
      
      for (const visit of visitsToSave) {
        if (!visit.client_id && visit.client_yclients_id) {
          const dbClient = clientsByYclientsId.get(visit.client_yclients_id);
          if (dbClient) {
            visit.client_id = dbClient.id;
          }
        }
      }
      
      // 7. Сохраняем визиты
      console.log('💾 Сохраняем визиты в базу данных...\n');
      
      const BATCH_SIZE = 100;
      for (let i = 0; i < visitsToSave.length; i += BATCH_SIZE) {
        const batch = visitsToSave.slice(i, i + BATCH_SIZE);
        const progress = Math.round((i / visitsToSave.length) * 100);
        
        console.log(`  Сохраняем записи ${i + 1}-${Math.min(i + BATCH_SIZE, visitsToSave.length)} (${progress}%)...`);
        
        try {
          const { error } = await supabase
            .from('visits')
            .upsert(batch, {
              onConflict: 'company_id,yclients_record_id',
              ignoreDuplicates: true
            });
          
          if (error) {
            console.error(`  ❌ Ошибка:`, error.message);
            this.stats.errors += batch.length;
          } else {
            this.stats.savedVisits += batch.length;
          }
        } catch (error) {
          console.error(`  ❌ Ошибка:`, error.message);
          this.stats.errors += batch.length;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 8. Обновляем статистику клиентов
      console.log('\n📊 Обновляем статистику клиентов...');
      await this.updateClientStats();
      
      // 9. Финальная статистика
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Всего записей обработано: ${this.stats.totalRecords}`);
      console.log(`  • Новых клиентов создано: ${this.stats.newClients}`);
      console.log(`  • Визитов сохранено: ${this.stats.savedVisits}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
      // Проверка результатов
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', this.COMPANY_ID);
      
      const { count: totalVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      const { data: clientsWithVisits } = await supabase
        .from('visits')
        .select('client_id')
        .not('client_id', 'is', null);
      const uniqueClientsWithVisits = new Set(clientsWithVisits?.map(v => v.client_id)).size;
      
      console.log('\n📊 Финальные результаты:');
      console.log(`  • Всего клиентов в БД: ${totalClients}`);
      console.log(`  • Всего визитов в БД: ${totalVisits}`);
      console.log(`  • Клиентов с визитами: ${uniqueClientsWithVisits}`);
      console.log(`  • Процент клиентов с визитами: ${Math.round(uniqueClientsWithVisits / totalClients * 100)}%`);
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  async fetchAllRecords() {
    const allRecords = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    // Получаем записи за последние 2 года
    const startDate = '2023-01-01';
    const endDate = '2025-12-31';
    
    console.log(`📅 Получаем записи с ${startDate} по ${endDate}\n`);
    
    while (hasMorePages) {
      console.log(`📄 Страница ${currentPage}...`);
      
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      try {
        const response = await axios.get(url, {
          params: {
            start_date: startDate,
            end_date: endDate,
            include_finance_transactions: 1,
            with_deleted: 0,
            page: currentPage,
            count: this.PAGE_SIZE
          },
          headers: {
            'Authorization': `Bearer ${this.bearerToken}, User ${this.userToken}`,
            'Accept': 'application/vnd.api.v2+json',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        
        const records = response.data?.data || [];
        console.log(`  • Получено записей: ${records.length}`);
        
        allRecords.push(...records);
        this.stats.totalRecords += records.length;
        
        if (records.length < this.PAGE_SIZE) {
          hasMorePages = false;
        } else {
          currentPage++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`  ❌ Ошибка на странице ${currentPage}:`, error.message);
        hasMorePages = false;
      }
    }
    
    return allRecords;
  }
  
  formatVisit(record, dbClient = null) {
    try {
      const services = record.services || [];
      const staff = record.staff || {};
      
      return {
        yclients_visit_id: record.visit_id || null,
        yclients_record_id: record.id,
        company_id: this.COMPANY_ID,
        
        client_id: dbClient?.id || null,
        client_yclients_id: record.client?.id || null,
        client_phone: this.normalizePhone(record.client?.phone) || '',
        client_name: record.client?.name || '',
        
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
        visit_time: record.datetime ? record.datetime.split('T')[1]?.substring(0, 5) : null,
        datetime: record.datetime || record.date + 'T12:00:00',
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
    } catch (error) {
      console.error('Ошибка форматирования визита:', error.message);
      return null;
    }
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
  
  async updateClientStats() {
    try {
      const { data: visitStats } = await supabase
        .from('visits')
        .select('client_id, service_names, staff_name, visit_date, visit_time, total_cost')
        .not('client_id', 'is', null);
      
      if (!visitStats || visitStats.length === 0) {
        console.log('  Нет данных для обновления');
        return;
      }
      
      const clientStats = {};
      
      visitStats.forEach(visit => {
        if (!visit.client_id) return;
        
        if (!clientStats[visit.client_id]) {
          clientStats[visit.client_id] = {
            visit_count: 0,
            total_spent: 0,
            visit_history: [],
            last_services: [],
            favorite_staff_ids: {},
            preferred_time_slots: {}
          };
        }
        
        const stats = clientStats[visit.client_id];
        
        stats.visit_count++;
        stats.total_spent += (visit.total_cost || 0);
        
        stats.visit_history.push({
          date: visit.visit_date,
          time: visit.visit_time,
          services: visit.service_names || []
        });
        
        if (visit.service_names && visit.service_names.length > 0) {
          stats.last_services = visit.service_names;
        }
        
        if (visit.staff_name) {
          stats.favorite_staff_ids[visit.staff_name] = 
            (stats.favorite_staff_ids[visit.staff_name] || 0) + 1;
        }
        
        if (visit.visit_time) {
          const hour = parseInt(visit.visit_time.split(':')[0]);
          let slot = 'morning';
          if (hour >= 12 && hour < 17) slot = 'afternoon';
          else if (hour >= 17) slot = 'evening';
          
          stats.preferred_time_slots[slot] = 
            (stats.preferred_time_slots[slot] || 0) + 1;
        }
      });
      
      console.log(`  Обновляем данные для ${Object.keys(clientStats).length} клиентов...`);
      
      let updated = 0;
      for (const [clientId, stats] of Object.entries(clientStats)) {
        stats.visit_history.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        
        const favoriteStaff = Object.entries(stats.favorite_staff_ids)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
        
        const preferredSlot = Object.entries(stats.preferred_time_slots)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        const updateData = {
          visit_count: stats.visit_count,
          total_spent: stats.total_spent,
          visit_history: stats.visit_history.slice(0, 50),
          last_services: stats.last_services,
          favorite_staff_ids: favoriteStaff,
          preferred_time_slots: preferredSlot ? [preferredSlot] : []
        };
        
        delete updateData.id;
        
        const { error } = await supabase
          .from('clients')
          .update(updateData)
          .eq('id', parseInt(clientId));
        
        if (!error) updated++;
      }
      
      console.log(`  ✅ Обновлено ${updated} клиентов`);
      
    } catch (error) {
      console.error(`  ❌ Ошибка обновления статистики:`, error.message);
    }
  }
}

// Запускаем
const sync = new CompleteVisitsSync();
sync.syncAll().catch(console.error);