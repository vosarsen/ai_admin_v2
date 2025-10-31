#!/usr/bin/env node

/**
 * ПОЛНАЯ синхронизация визитов с пагинацией
 * Получает ВСЕ записи из YClients через пагинацию
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');

class PaginatedVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.PAGE_SIZE = 300; // Максимум записей на страницу
    this.bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
    this.userToken = process.env.YCLIENTS_USER_TOKEN;
    this.stats = {
      totalRecords: 0,
      uniqueClients: new Set(),
      savedVisits: 0,
      errors: 0,
      duplicates: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 ПОЛНАЯ СИНХРОНИЗАЦИЯ ВИЗИТОВ С ПАГИНАЦИЕЙ');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // Очищаем таблицу visits для чистой синхронизации
      console.log('🗑️ Очищаем таблицу visits...');
      await supabase.from('visits').delete().neq('id', 0);
      console.log('✅ Таблица очищена\n');
      
      // Получаем клиентов из БД для сопоставления
      console.log('📋 Загружаем клиентов из БД...');
      const { data: dbClients } = await supabase
        .from('clients')
        .select('id, yclients_id, phone, name')
        .eq('company_id', this.COMPANY_ID);
      
      // Создаем индексы для быстрого поиска
      const clientsByYclientsId = new Map();
      const clientsByPhone = new Map();
      
      dbClients?.forEach(client => {
        if (client.yclients_id) {
          clientsByYclientsId.set(client.yclients_id, client);
        }
        if (client.phone) {
          const normalizedPhone = this.normalizePhone(client.phone);
          clientsByPhone.set(normalizedPhone, client);
        }
      });
      
      console.log(`✅ Загружено ${dbClients?.length || 0} клиентов\n`);
      
      // Получаем записи за 2 года
      const startDate = '2023-01-01';
      const endDate = '2025-12-31';
      
      console.log(`📅 Получаем записи с ${startDate} по ${endDate}\n`);
      
      let currentPage = 1;
      let hasMorePages = true;
      const allVisits = [];
      
      while (hasMorePages) {
        console.log(`📄 Страница ${currentPage}...`);
        
        const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
        
        try {
          const response = await axios.get(url, {
            params: {
              start_date: startDate,
              end_date: endDate,
              include_finance_transactions: 1,
              with_deleted: 0, // Только активные записи
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
          const meta = response.data?.meta;
          
          console.log(`  • Получено записей: ${records.length}`);
          
          if (meta?.total_count) {
            console.log(`  • Всего записей: ${meta.total_count}`);
          }
          
          // Обрабатываем записи
          for (const record of records) {
            const visit = this.processRecord(record, clientsByYclientsId, clientsByPhone);
            if (visit) {
              allVisits.push(visit);
              this.stats.totalRecords++;
              if (visit.client_id) {
                this.stats.uniqueClients.add(visit.client_id);
              }
            }
          }
          
          // Проверяем есть ли еще страницы
          if (records.length < this.PAGE_SIZE) {
            hasMorePages = false;
            console.log('  • Это последняя страница\n');
          } else {
            currentPage++;
            // Пауза между страницами
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.error(`❌ Ошибка на странице ${currentPage}:`, error.message);
          hasMorePages = false;
        }
      }
      
      console.log(`\n📊 Получено всего ${allVisits.length} записей`);
      console.log(`   Уникальных клиентов: ${this.stats.uniqueClients.size}\n`);
      
      // Сохраняем визиты в БД пакетами
      console.log('💾 Сохраняем визиты в базу данных...\n');
      
      const BATCH_SIZE = 100;
      for (let i = 0; i < allVisits.length; i += BATCH_SIZE) {
        const batch = allVisits.slice(i, i + BATCH_SIZE);
        const progress = Math.round((i / allVisits.length) * 100);
        
        console.log(`  Сохраняем записи ${i + 1}-${Math.min(i + BATCH_SIZE, allVisits.length)} (${progress}%)...`);
        
        try {
          const { error } = await supabase
            .from('visits')
            .upsert(batch, {
              onConflict: 'company_id,yclients_record_id',
              ignoreDuplicates: true
            });
          
          if (error) {
            console.error('  ❌ Ошибка сохранения:', error.message);
            this.stats.errors += batch.length;
          } else {
            this.stats.savedVisits += batch.length;
          }
        } catch (error) {
          console.error('  ❌ Ошибка:', error.message);
          this.stats.errors += batch.length;
        }
        
        // Пауза между батчами
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Обновляем данные в таблице clients
      console.log('\n📊 Обновляем статистику клиентов...');
      await this.updateClientStats();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log('📊 Итоговая статистика:');
      console.log(`  • Всего записей обработано: ${this.stats.totalRecords}`);
      console.log(`  • Уникальных клиентов: ${this.stats.uniqueClients.size}`);
      console.log(`  • Сохранено визитов: ${this.stats.savedVisits}`);
      console.log(`  • Дубликатов пропущено: ${this.stats.duplicates}`);
      console.log(`  • Ошибок: ${this.stats.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
      // Проверяем финальные результаты
      const { count: totalVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      const { data: clientsWithVisits } = await supabase
        .from('visits')
        .select('client_id');
      const uniqueClientsInDb = new Set(clientsWithVisits?.map(v => v.client_id).filter(id => id)).size;
      
      console.log('\n📊 Проверка результатов:');
      console.log(`  • Визитов в БД: ${totalVisits}`);
      console.log(`  • Клиентов с визитами: ${uniqueClientsInDb}`);
      
    } catch (error) {
      console.error('\n❌ Критическая ошибка:', error);
    }
  }
  
  processRecord(record, clientsByYclientsId, clientsByPhone) {
    try {
      // Получаем данные клиента из записи
      const clientYclientsId = record.client?.id;
      const clientPhone = this.normalizePhone(record.client?.phone);
      const clientName = record.client?.name;
      
      // Ищем клиента в нашей БД
      let dbClient = null;
      
      if (clientYclientsId) {
        dbClient = clientsByYclientsId.get(clientYclientsId);
      }
      
      if (!dbClient && clientPhone) {
        dbClient = clientsByPhone.get(clientPhone);
      }
      
      if (!dbClient) {
        // Клиент не найден в БД - пропускаем
        return null;
      }
      
      // Форматируем визит
      const services = record.services || [];
      const staff = record.staff || {};
      
      return {
        yclients_visit_id: record.visit_id || null,
        yclients_record_id: record.id,
        company_id: this.COMPANY_ID,
        
        // Связываем с нашим клиентом
        client_id: dbClient.id,
        client_yclients_id: clientYclientsId,
        client_phone: clientPhone,
        client_name: clientName || dbClient.name,
        
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
      console.error('Ошибка обработки записи:', error.message);
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
      // Получаем статистику по визитам для каждого клиента
      const { data: visitStats } = await supabase
        .from('visits')
        .select('client_id, service_names, staff_name, visit_date, visit_time');
      
      if (!visitStats || visitStats.length === 0) {
        console.log('  Нет данных для обновления');
        return;
      }
      
      // Группируем по клиентам
      const clientStats = {};
      
      visitStats.forEach(visit => {
        if (!visit.client_id) return;
        
        if (!clientStats[visit.client_id]) {
          clientStats[visit.client_id] = {
            visit_history: [],
            last_services: [],
            favorite_staff_ids: {},
            preferred_time_slots: {}
          };
        }
        
        const stats = clientStats[visit.client_id];
        
        // История визитов
        stats.visit_history.push({
          date: visit.visit_date,
          time: visit.visit_time,
          services: visit.service_names || []
        });
        
        // Последние услуги
        if (visit.service_names && visit.service_names.length > 0) {
          stats.last_services = visit.service_names;
        }
        
        // Любимые мастера
        if (visit.staff_name) {
          stats.favorite_staff_ids[visit.staff_name] = 
            (stats.favorite_staff_ids[visit.staff_name] || 0) + 1;
        }
        
        // Предпочитаемое время
        if (visit.visit_time) {
          const hour = parseInt(visit.visit_time.split(':')[0]);
          let slot = 'morning';
          if (hour >= 12 && hour < 17) slot = 'afternoon';
          else if (hour >= 17) slot = 'evening';
          
          stats.preferred_time_slots[slot] = 
            (stats.preferred_time_slots[slot] || 0) + 1;
        }
      });
      
      // Обновляем клиентов
      console.log(`  Обновляем данные для ${Object.keys(clientStats).length} клиентов...`);
      
      for (const [clientId, stats] of Object.entries(clientStats)) {
        // Сортируем историю по дате
        stats.visit_history.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        );
        
        // Определяем любимых мастеров (топ-3)
        const favoriteStaff = Object.entries(stats.favorite_staff_ids)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name);
        
        // Определяем предпочитаемое время
        const preferredSlot = Object.entries(stats.preferred_time_slots)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        const updateData = {
          visit_history: stats.visit_history.slice(0, 50), // Последние 50 визитов
          last_services: stats.last_services,
          favorite_staff_ids: favoriteStaff,
          preferred_time_slots: preferredSlot ? [preferredSlot] : []
        };
        
        // Удаляем id перед обновлением
        delete updateData.id;
        
        await supabase
          .from('clients')
          .update(updateData)
          .eq('id', parseInt(clientId));
      }
      
      console.log('  ✅ Статистика клиентов обновлена');
      
    } catch (error) {
      console.error('  ❌ Ошибка обновления статистики:', error.message);
    }
  }
}

// Запускаем синхронизацию
const sync = new PaginatedVisitsSync();
sync.syncAll().catch(console.error);