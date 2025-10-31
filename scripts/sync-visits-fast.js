#!/usr/bin/env node

/**
 * БЫСТРАЯ синхронизация истории визитов
 * Параллельная обработка для ускорения в 5-10 раз
 */

require('dotenv').config();
const VisitsSync = require('../src/sync/visits-sync');
const logger = require('../src/utils/logger').child({ module: 'sync-visits-fast' });
const { supabase } = require('../src/database/supabase');

// Переопределяем класс для быстрой синхронизации
class FastVisitsSync extends VisitsSync {
  constructor() {
    super();
    this.PARALLEL_WORKERS = 10; // Параллельных потоков
    this.BATCH_SIZE = 100; // Увеличиваем размер пакета
    this.activeWorkers = 0;
  }

  /**
   * Быстрая синхронизация с параллельной обработкой
   */
  async syncAllFast(options = {}) {
    const startTime = Date.now();
    const { 
      limit = null,
      skipProcessed = true // Пропускать уже обработанных
    } = options;
    
    try {
      logger.info('🚀 Starting FAST visits synchronization...');
      
      // Получаем уже обработанных клиентов
      let processedClientIds = new Set();
      if (skipProcessed) {
        const { data: processed } = await supabase
          .from('visits')
          .select('client_id')
          .not('client_id', 'is', null);
        
        processedClientIds = new Set(processed?.map(v => v.client_id));
        logger.info(`Skipping ${processedClientIds.size} already processed clients`);
      }
      
      // Получаем клиентов для синхронизации
      let query = supabase
        .from('clients')
        .select('id, yclients_id, phone, name, visit_count')
        .eq('company_id', this.config.COMPANY_ID)
        .gt('visit_count', 0)
        .order('visit_count', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data: allClients } = await query;
      
      // Фильтруем уже обработанных
      const clients = allClients?.filter(c => !processedClientIds.has(c.id)) || [];
      
      if (clients.length === 0) {
        logger.warn('No clients to process');
        return { 
          success: true, 
          clientsProcessed: 0, 
          visitsProcessed: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${clients.length} clients to sync (${allClients?.length} total, ${processedClientIds.size} already done)`);
      
      let totalVisitsProcessed = 0;
      let totalErrors = 0;
      let clientsProcessed = 0;
      
      // Разбиваем клиентов на батчи для параллельной обработки
      const chunks = [];
      for (let i = 0; i < clients.length; i += this.PARALLEL_WORKERS) {
        chunks.push(clients.slice(i, i + this.PARALLEL_WORKERS));
      }
      
      // Обрабатываем батчи
      for (const chunk of chunks) {
        const promises = chunk.map(client => this.syncClientVisitsFast(client));
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            totalVisitsProcessed += result.value.visitsProcessed;
            totalErrors += result.value.errors;
            clientsProcessed++;
          } else {
            logger.error(`Failed to sync client ${chunk[index].name}:`, result.reason);
            totalErrors++;
          }
        });
        
        // Прогресс
        logger.info(`Progress: ${clientsProcessed}/${clients.length} clients, ${totalVisitsProcessed} visits (${Math.round(clientsProcessed/clients.length*100)}%)`);
      }
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ FAST sync completed in ${Math.round(duration/1000)} seconds`, {
        clientsProcessed,
        visitsProcessed: totalVisitsProcessed,
        errors: totalErrors,
        speed: Math.round(totalVisitsProcessed / (duration/1000)) + ' visits/sec'
      });

      return {
        success: true,
        clientsProcessed,
        visitsProcessed: totalVisitsProcessed,
        errors: totalErrors,
        duration
      };

    } catch (error) {
      logger.error('❌ Fast sync failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Быстрая синхронизация клиента (без задержек)
   */
  async syncClientVisitsFast(client) {
    try {
      // Получаем записи через /records (быстрее чем visits/search)
      const visits = await this.fetchClientRecords(client.yclients_id, client.phone);
      
      if (!visits || visits.length === 0) {
        return { visitsProcessed: 0, errors: 0 };
      }
      
      // Сохраняем визиты одним большим батчем
      const visitsWithClientId = visits.map(v => ({
        ...v,
        client_id: client.id
      }));
      
      // Используем upsert для предотвращения дублей
      const { error } = await supabase
        .from('visits')
        .upsert(visitsWithClientId, {
          onConflict: 'company_id,yclients_record_id',
          ignoreDuplicates: true
        });
      
      if (error) {
        logger.error(`Error saving visits for ${client.name}:`, error);
        return { visitsProcessed: 0, errors: visits.length };
      }
      
      return { visitsProcessed: visits.length, errors: 0 };
      
    } catch (error) {
      logger.error(`Error syncing visits for client ${client.name}:`, error.message);
      return { visitsProcessed: 0, errors: 1 };
    }
  }
}

async function main() {
  try {
    logger.info('🚀 Starting FAST visits synchronization script...');
    
    // Парсим аргументы
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--limit':
        case '-l':
          options.limit = parseInt(args[++i]) || null;
          break;
        case '--no-skip':
          options.skipProcessed = false;
          break;
        case '--help':
        case '-h':
          console.log(`
БЫСТРАЯ синхронизация истории визитов (параллельная обработка)

Использование:
  node scripts/sync-visits-fast.js [опции]

Опции:
  --limit, -l <число>  Ограничить количество клиентов
  --no-skip            Не пропускать уже обработанных клиентов
  --help, -h           Показать эту справку

Особенности:
  • Параллельная обработка (10 потоков)
  • Автоматически пропускает обработанных клиентов
  • Скорость в 5-10 раз выше обычной синхронизации
  • Без задержек между запросами
          `);
          process.exit(0);
      }
    }
    
    // Показываем текущую статистику
    const { count: currentVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true });
    
    const { data: processedClients } = await supabase
      .from('visits')
      .select('client_id')
      .not('client_id', 'is', null);
    
    const uniqueProcessed = new Set(processedClients?.map(v => v.client_id)).size;
    
    console.log('\n📊 Текущая статистика:');
    console.log(`  • Визитов в БД: ${currentVisits}`);
    console.log(`  • Обработано клиентов: ${uniqueProcessed}`);
    console.log(`  • Осталось: ~${1000 - uniqueProcessed} клиентов\n`);
    
    // Создаем экземпляр быстрого синхронизатора
    const fastSync = new FastVisitsSync();
    
    // Запускаем синхронизацию
    const result = await fastSync.syncAllFast(options);
    
    if (result.success) {
      // Финальная статистика
      const { count: finalVisits } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      console.log('\n✅ Синхронизация завершена!');
      console.log('═══════════════════════════════════════');
      console.log(`  • Обработано клиентов: ${result.clientsProcessed}`);
      console.log(`  • Синхронизировано визитов: ${result.visitsProcessed}`);
      console.log(`  • Всего визитов в БД: ${finalVisits}`);
      console.log(`  • Время: ${Math.round(result.duration / 1000)} секунд`);
      console.log(`  • Скорость: ~${Math.round(result.visitsProcessed / (result.duration/1000))} визитов/сек`);
      
      if (result.errors > 0) {
        console.log(`  • Ошибок: ${result.errors}`);
      }
    } else {
      logger.error('❌ Synchronization failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Запускаем
main().then(() => {
  process.exit(0);
}).catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});