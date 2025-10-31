#!/usr/bin/env node

/**
 * УЛУЧШЕННАЯ синхронизация визитов с обработкой ошибок
 * Решает проблемы с rate limits, таймаутами и пропусками
 */

require('dotenv').config();
const axios = require('axios');
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'sync-visits-improved' });

class ImprovedVisitsSync {
  constructor() {
    this.COMPANY_ID = 962302;
    this.BATCH_SIZE = 10; // Меньше батч для стабильности
    this.RETRY_ATTEMPTS = 3; // Попытки при ошибках
    this.REQUEST_TIMEOUT = 15000; // 15 секунд таймаут
    this.PAUSE_BETWEEN_BATCHES = 5000; // 5 секунд между батчами
    this.stats = {
      processed: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      totalVisits: 0
    };
  }

  async syncAll() {
    const startTime = Date.now();
    
    console.log('\n🚀 УЛУЧШЕННАЯ СИНХРОНИЗАЦИЯ ВИЗИТОВ');
    console.log('═══════════════════════════════════════════════════\n');
    
    try {
      // Получаем всех клиентов с визитами
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
      
      // Разбиваем на батчи
      const totalBatches = Math.ceil(clientsToSync.length / this.BATCH_SIZE);
      
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * this.BATCH_SIZE;
        const batchEnd = Math.min(batchStart + this.BATCH_SIZE, clientsToSync.length);
        const batch = clientsToSync.slice(batchStart, batchEnd);
        
        console.log(`\n📦 Батч ${batchNum + 1}/${totalBatches} (клиенты ${batchStart + 1}-${batchEnd}):`);
        
        // Обрабатываем батч последовательно для избежания rate limits
        for (const client of batch) {
          await this.syncClientWithRetry(client);
        }
        
        // Статистика батча
        const progress = Math.round((this.stats.processed / clientsToSync.length) * 100);
        console.log(`\n📈 Прогресс: ${this.stats.processed}/${clientsToSync.length} (${progress}%)`);
        console.log(`   Синхронизировано: ${this.stats.synced}, Пропущено: ${this.stats.skipped}, Ошибок: ${this.stats.failed}`);
        
        // Длинная пауза между батчами
        if (batchNum < totalBatches - 1) {
          console.log(`⏳ Пауза ${this.PAUSE_BETWEEN_BATCHES/1000} секунд перед следующим батчем...`);
          await new Promise(resolve => setTimeout(resolve, this.PAUSE_BETWEEN_BATCHES));
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n═══════════════════════════════════════════════════');
      console.log('✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА!\n');
      console.log(`📊 Итоговая статистика:`);
      console.log(`  • Обработано клиентов: ${this.stats.processed}`);
      console.log(`  • Успешно синхронизировано: ${this.stats.synced}`);
      console.log(`  • Пропущено (нет данных): ${this.stats.skipped}`);
      console.log(`  • Ошибок: ${this.stats.failed}`);
      console.log(`  • Всего визитов: ${this.stats.totalVisits}`);
      console.log(`  • Время выполнения: ${duration} секунд`);
      
    } catch (error) {
      console.error('❌ Критическая ошибка:', error);
    }
  }
  
  async syncClientWithRetry(client, attempt = 1) {
    try {
      this.stats.processed++;
      
      const visits = await this.fetchClientRecords(client);
      
      if (!visits || visits.length === 0) {
        console.log(`    ⚪ ${client.name}: нет данных в API`);
        this.stats.skipped++;
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
        throw error;
      }
      
      console.log(`    ✅ ${client.name}: ${visits.length} визитов`);
      this.stats.synced++;
      this.stats.totalVisits += visits.length;
      
    } catch (error) {
      if (attempt < this.RETRY_ATTEMPTS) {
        console.log(`    ⚠️ ${client.name}: ошибка, попытка ${attempt + 1}/${this.RETRY_ATTEMPTS}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Экспоненциальная задержка
        return this.syncClientWithRetry(client, attempt + 1);
      } else {
        console.log(`    ❌ ${client.name}: не удалось после ${this.RETRY_ATTEMPTS} попыток`);
        this.stats.failed++;
      }
    }
  }
  
  async fetchClientRecords(client) {
    try {
      const userToken = process.env.YCLIENTS_USER_TOKEN;
      const bearerToken = process.env.YCLIENTS_BEARER_TOKEN;
      
      const url = `https://api.yclients.com/api/v1/records/${this.COMPANY_ID}`;
      
      const response = await axios.get(url, {
        params: {
          client_id: client.yclients_id,
          start_date: '2020-01-01',
          end_date: '2025-12-31',
          include_finance_transactions: 1,
          with_deleted: 1
        },
        headers: {
          'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
          'Accept': 'application/vnd.api.v2+json',
          'Content-Type': 'application/json'
        },
        timeout: this.REQUEST_TIMEOUT
      });
      
      if (!response.data?.success) {
        return [];
      }
      
      const records = response.data?.data || [];
      
      // Фильтруем записи по клиенту
      const clientRecords = records.filter(record => {
        return record.client?.id === client.yclients_id;
      });
      
      // Форматируем записи
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
    if (record.paid_full < (record.cost_to_pay || record.cost)) {
      return 'paid_not_full';
    }
    if (record.paid_full > (record.cost_to_pay || record.cost)) {
      return 'paid_over';
    }
    return 'paid_full';
  }
}

async function main() {
  const sync = new ImprovedVisitsSync();
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
  
  if (uniqueCount > 100) {
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
  } else {
    console.log('\n⚠️ Синхронизировано мало клиентов, проверьте логи');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});