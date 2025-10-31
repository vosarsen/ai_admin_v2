#!/usr/bin/env node

/**
 * ПРАВИЛЬНАЯ синхронизация ВСЕХ визитов для ВСЕХ клиентов
 * Исправляет проблему когда синхронизируется только 67 клиентов из 1000
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'sync-all-visits' });

class CompleteVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.BATCH_SIZE = 5; // Меньше батч для избежания rate limit
    this.processedCount = 0;
    this.errorCount = 0;
    this.totalVisits = 0;
  }

  async syncAll() {
    const startTime = Date.now();
    
    try {
      logger.info('🚀 Starting COMPLETE visits synchronization for ALL clients...');
      
      // Получаем ВСЕХ клиентов с визитами
      const { data: clients } = await supabase
        .from('clients')
        .select('id, yclients_id, phone, name, visit_count')
        .eq('company_id', this.COMPANY_ID)
        .gt('visit_count', 0)
        .order('visit_count', { ascending: false });
        
      if (!clients || clients.length === 0) {
        logger.warn('No clients found');
        return;
      }
      
      logger.info(`Found ${clients.length} clients with visits to sync`);
      
      // Проверяем кто уже синхронизирован
      const { data: existingVisits } = await supabase
        .from('visits')
        .select('client_id');
      const alreadySynced = new Set(existingVisits?.map(v => v.client_id).filter(id => id));
      
      logger.info(`Already synced: ${alreadySynced.size} clients`);
      
      // Фильтруем только несинхронизированных
      const clientsToSync = clients.filter(c => !alreadySynced.has(c.id));
      
      logger.info(`Need to sync: ${clientsToSync.length} clients`);
      
      // Обрабатываем батчами с задержкой
      for (let i = 0; i < clientsToSync.length; i += this.BATCH_SIZE) {
        const batch = clientsToSync.slice(i, i + this.BATCH_SIZE);
        
        // Параллельно обрабатываем батч
        const promises = batch.map(client => this.syncClientVisits(client));
        await Promise.allSettled(promises);
        
        this.processedCount += batch.length;
        
        // Прогресс
        if (this.processedCount % 20 === 0 || this.processedCount === clientsToSync.length) {
          const progress = Math.round((this.processedCount / clientsToSync.length) * 100);
          logger.info(`Progress: ${this.processedCount}/${clientsToSync.length} (${progress}%), Total visits: ${this.totalVisits}`);
        }
        
        // Задержка между батчами для избежания rate limit
        if (i + this.BATCH_SIZE < clientsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда между батчами
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      logger.info(`✅ Sync completed in ${duration} seconds`, {
        processed: this.processedCount,
        visits: this.totalVisits,
        errors: this.errorCount
      });
      
    } catch (error) {
      logger.error('Sync failed:', error);
    }
  }
  
  async syncClientVisits(client) {
    try {
      // Получаем записи через YClients API
      const visits = await this.fetchClientRecords(client);
      
      if (!visits || visits.length === 0) {
        return;
      }
      
      // Добавляем client_id ко всем визитам
      const visitsWithClientId = visits.map(v => ({
        ...v,
        client_id: client.id
      }));
      
      // Сохраняем в БД
      const { error } = await supabase
        .from('visits')
        .upsert(visitsWithClientId, {
          onConflict: 'company_id,yclients_record_id',
          ignoreDuplicates: true
        });
        
      if (error) {
        logger.error(`Error saving visits for ${client.name}:`, error);
        this.errorCount++;
      } else {
        this.totalVisits += visits.length;
      }
      
    } catch (error) {
      logger.error(`Error syncing ${client.name}:`, error.message);
      this.errorCount++;
    }
  }
  
  async fetchClientRecords(client) {
    try {
      const userToken = process.env.YCLIENTS_USER_TOKEN;
      const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
      
      // Получаем записи за последние 2 года
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const endDate = new Date();
      
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      const response = await axios.get(url, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          client_id: client.yclients_id,
          include_finance_transactions: 1
        },
        headers: {
          'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data?.success) {
        return [];
      }
      
      const records = response.data?.data || [];
      
      // Фильтруем записи по клиенту
      const clientRecords = records.filter(record => {
        const recordClientId = record.client?.id;
        return recordClientId === parseInt(client.yclients_id);
      });
      
      // Форматируем записи
      return clientRecords.map(record => this.formatRecordToVisit(record));
      
    } catch (error) {
      if (error.response?.status === 429) {
        // Rate limit - ждем и пробуем снова
        await new Promise(resolve => setTimeout(resolve, 2000));
        return [];
      }
      throw error;
    }
  }
  
  formatRecordToVisit(record) {
    const services = record.services || [];
    const staff = record.staff || {};
    
    return {
      yclients_visit_id: record.visit_id || null,
      yclients_record_id: record.id,
      company_id: this.COMPANY_ID,
      
      client_yclients_id: record.client?.id || null,
      client_phone: this.normalizePhone(record.client?.phone || ''),
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
  }
  
  normalizePhone(phone) {
    if (!phone) return null;
    return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
  }
  
  getPaymentStatus(record) {
    if (!record.paid_full || record.paid_full === 0) {
      return 'not_paid';
    }
    if (record.paid_full < record.cost_to_pay) {
      return 'paid_not_full';
    }
    if (record.paid_full > record.cost_to_pay) {
      return 'paid_over';
    }
    return 'paid_full';
  }
}

async function main() {
  console.log('\n🎯 ПОЛНАЯ СИНХРОНИЗАЦИЯ ВСЕХ ВИЗИТОВ');
  console.log('═══════════════════════════════════════════════════\n');
  
  const sync = new CompleteVisitsSync();
  await sync.syncAll();
  
  // Проверяем результат
  const { data: uniqueClients } = await supabase
    .from('visits')
    .select('client_id');
  const uniqueCount = new Set(uniqueClients?.map(v => v.client_id).filter(id => id)).size;
  
  console.log('\n📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
  console.log(`  • Уникальных клиентов в visits: ${uniqueCount}`);
  console.log(`  • Цель была: 1000 клиентов`);
  console.log(`  • Достигнуто: ${Math.round((uniqueCount / 1000) * 100)}%`);
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});