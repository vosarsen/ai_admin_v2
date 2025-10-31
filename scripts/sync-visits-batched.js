#!/usr/bin/env node

/**
 * Батчевая синхронизация визитов по 20 клиентов
 * Решает проблему с rate limits и неполной синхронизацией
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'sync-visits-batched' });

class BatchedVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.CLIENT_BATCH_SIZE = 20; // Обрабатываем по 20 клиентов за раз
    this.PARALLEL_REQUESTS = 3; // 3 параллельных запроса в батче
    this.processedClients = 0;
    this.totalVisitsSynced = 0;
    this.errors = 0;
  }

  async syncAll() {
    const startTime = Date.now();
    
    try {
      console.log('\n🎯 БАТЧЕВАЯ СИНХРОНИЗАЦИЯ ВИЗИТОВ');
      console.log('═══════════════════════════════════════════════════\n');
      
      // Получаем ВСЕХ клиентов с визитами
      const { data: allClients } = await supabase
        .from('clients')
        .select('id, yclients_id, phone, name, visit_count')
        .eq('company_id', this.COMPANY_ID)
        .gt('visit_count', 0)
        .order('visit_count', { ascending: false });
        
      if (!allClients || allClients.length === 0) {
        console.log('❌ Клиенты не найдены');
        return;
      }
      
      console.log(`📊 Найдено ${allClients.length} клиентов с визитами\n`);
      
      // Проверяем кто уже синхронизирован
      const { data: existingVisits } = await supabase
        .from('visits')
        .select('client_id');
      const alreadySynced = new Set(existingVisits?.map(v => v.client_id).filter(id => id));
      
      console.log(`✅ Уже синхронизировано: ${alreadySynced.size} клиентов`);
      
      // Фильтруем только несинхронизированных
      const clientsToSync = allClients.filter(c => !alreadySynced.has(c.id));
      
      if (clientsToSync.length === 0) {
        console.log('✨ Все клиенты уже синхронизированы!');
        return;
      }
      
      console.log(`📝 Нужно синхронизировать: ${clientsToSync.length} клиентов\n`);
      console.log('Начинаем обработку батчами по 20 клиентов...\n');
      
      // Разбиваем на батчи по 20 клиентов
      const totalBatches = Math.ceil(clientsToSync.length / this.CLIENT_BATCH_SIZE);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * this.CLIENT_BATCH_SIZE;
        const batchEnd = Math.min(batchStart + this.CLIENT_BATCH_SIZE, clientsToSync.length);
        const batch = clientsToSync.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Батч ${batchNum + 1}/${totalBatches} (клиенты ${batchStart + 1}-${batchEnd}):`);
        
        // Обрабатываем батч с ограниченным параллелизмом
        await this.processBatch(batch);
        
        // Статистика батча
        console.log(`  ✓ Обработано клиентов: ${batch.length}`);
        console.log(`  ✓ Синхронизировано визитов в этом батче: ${this.totalVisitsSynced}`);
        
        // Прогресс
        this.processedClients += batch.length;
        const progress = Math.round((this.processedClients / clientsToSync.length) * 100);
        console.log(`\n📈 Общий прогресс: ${this.processedClients}/${clientsToSync.length} (${progress}%)`);
        
        // Пауза между батчами (3 секунды)
        if (batchNum < totalBatches - 1) {
          console.log('⏳ Пауза 3 секунды перед следующим батчем...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log(`📊 Итоговая статистика:`);
      console.log(`  • Обработано клиентов: ${this.processedClients}`);
      console.log(`  • Синхронизировано визитов: ${this.totalVisitsSynced}`);
      console.log(`  • Ошибок: ${this.errors}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
    } catch (error) {
      console.error('❌ Критическая ошибка:', error);
    }
  }
  
  async processBatch(clients) {
    // Разбиваем батч на группы для параллельной обработки
    const groups = [];
    for (let i = 0; i < clients.length; i += this.PARALLEL_REQUESTS) {
      groups.push(clients.slice(i, i + this.PARALLEL_REQUESTS));
    }
    
    let batchVisits = 0;
    
    for (const group of groups) {
      // Обрабатываем группу параллельно
      const promises = group.map(client => this.syncClientVisits(client));
      const results = await Promise.allSettled(promises);
      
      // Подсчитываем результаты
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          batchVisits += result.value;
        } else if (result.status === 'rejected') {
          console.log(`    ⚠️ Ошибка для ${group[index].name}: ${result.reason?.message || 'Unknown error'}`);
          this.errors++;
        }
      });
      
      // Небольшая пауза между группами (500мс)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.totalVisitsSynced += batchVisits;
  }
  
  async syncClientVisits(client) {
    try {
      // Получаем записи через YClients API
      const visits = await this.fetchClientRecords(client);
      
      if (!visits || visits.length === 0) {
        return 0;
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
        console.log(`    ⚠️ Ошибка сохранения для ${client.name}:`, error.message);
        this.errors++;
        return 0;
      }
      
      console.log(`    ✓ ${client.name}: ${visits.length} визитов`);
      return visits.length;
      
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`    ⚠️ Rate limit для ${client.name}, пропускаем`);
      } else {
        console.log(`    ⚠️ Ошибка для ${client.name}:`, error.message);
      }
      this.errors++;
      return 0;
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
        },
        timeout: 10000 // 10 секунд таймаут
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
      
      // Форматируем записи (максимум 100 записей на клиента)
      return clientRecords.slice(0, 100).map(record => this.formatRecordToVisit(record));
      
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout');
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
  const sync = new BatchedVisitsSync();
  await sync.syncAll();
  
  // Проверяем финальный результат
  const { data: uniqueClients } = await supabase
    .from('visits')
    .select('client_id');
  const uniqueCount = new Set(uniqueClients?.map(v => v.client_id).filter(id => id)).size;
  
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n📊 ФИНАЛЬНАЯ ПРОВЕРКА БД:');
  console.log(`  • Уникальных клиентов с визитами: ${uniqueCount}`);
  console.log(`  • Всего визитов в БД: ${totalVisits}`);
  
  // Запускаем обновление клиентов
  console.log('\n🔄 Запускаем обновление данных клиентов...\n');
  const { spawn } = require('child_process');
  const updateProcess = spawn('node', ['scripts/update-clients-from-visits.js'], {
    stdio: 'inherit'
  });
  
  updateProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Все готово! Данные клиентов обновлены.');
    } else {
      console.log('\n⚠️ Обновление клиентов завершилось с ошибкой.');
    }
    process.exit(code);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});