#!/usr/bin/env node
/**
 * Полная синхронизация ВСЕХ визитов для ВСЕХ клиентов
 * Эффективная версия с параллельной обработкой
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const { ClientRecordsSync } = require('../src/sync/client-records-sync');
const logger = require('../src/utils/logger');

const PARALLEL_WORKERS = 3; // Количество параллельных воркеров
const BATCH_SIZE = 10; // Размер батча для каждого воркера

async function processClientBatch(clients, workerId, recordsSync) {
  const results = {
    processed: 0,
    errors: 0,
    skipped: 0
  };
  
  for (const client of clients) {
    try {
      if (!client.yclients_id || !client.phone) {
        results.skipped++;
        continue;
      }
      
      // Загружаем записи из YClients
      const records = await recordsSync.getClientRecords(client.yclients_id, client.phone);
      
      if (records && records.length > 0) {
        // Сохраняем в базу
        await recordsSync.saveClientVisits(client.id, client.yclients_id, records);
        results.processed++;
        
        logger.debug(`Worker ${workerId}: ${client.name} - ${records.length} visits saved`);
      } else {
        logger.debug(`Worker ${workerId}: ${client.name} - no records found`);
      }
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.errors++;
      logger.error(`Worker ${workerId} error for ${client.name}: ${error.message}`);
    }
  }
  
  return results;
}

async function syncAllVisitsParallel() {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 Starting COMPLETE parallel visit history synchronization...');
    logger.info(`⚙️  Configuration: ${PARALLEL_WORKERS} workers, batch size ${BATCH_SIZE}`);
    
    // Получаем ВСЕХ клиентов с визитами
    const { data: allClients, error } = await supabase
      .from('clients')
      .select('id, yclients_id, phone, name, visit_count')
      .gte('visit_count', 1)
      .order('visit_count', { ascending: false });
    
    if (error) throw error;
    
    logger.info(`📊 Found ${allClients.length} clients with visits`);
    
    // Фильтруем клиентов без истории для приоритетной обработки
    const { data: clientsWithHistory } = await supabase
      .from('clients')
      .select('id')
      .not('visit_history', 'eq', '[]');
    
    const withHistoryIds = new Set(clientsWithHistory.map(c => c.id));
    
    // Сортируем: сначала клиенты БЕЗ истории, потом остальные
    const prioritizedClients = [
      ...allClients.filter(c => !withHistoryIds.has(c.id)),
      ...allClients.filter(c => withHistoryIds.has(c.id))
    ];
    
    logger.info(`📝 Prioritized: ${allClients.length - withHistoryIds.size} without history, ${withHistoryIds.size} with history`);
    
    // Разбиваем на батчи для параллельной обработки
    const totalBatches = Math.ceil(prioritizedClients.length / BATCH_SIZE);
    let currentBatch = 0;
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    
    // Обрабатываем батчами с параллельными воркерами
    for (let i = 0; i < prioritizedClients.length; i += BATCH_SIZE * PARALLEL_WORKERS) {
      const workerPromises = [];
      
      for (let w = 0; w < PARALLEL_WORKERS; w++) {
        const startIdx = i + (w * BATCH_SIZE);
        const endIdx = Math.min(startIdx + BATCH_SIZE, prioritizedClients.length);
        
        if (startIdx < prioritizedClients.length) {
          const batch = prioritizedClients.slice(startIdx, endIdx);
          const recordsSync = new ClientRecordsSync();
          workerPromises.push(processClientBatch(batch, w + 1, recordsSync));
          currentBatch++;
        }
      }
      
      // Ждем завершения всех воркеров
      const results = await Promise.all(workerPromises);
      
      // Суммируем результаты
      results.forEach(result => {
        totalProcessed += result.processed;
        totalErrors += result.errors;
        totalSkipped += result.skipped;
      });
      
      // Прогресс
      const progress = Math.round((i + BATCH_SIZE * PARALLEL_WORKERS) * 100 / prioritizedClients.length);
      logger.info(`📈 Progress: ${Math.min(progress, 100)}% | Processed: ${totalProcessed} | Errors: ${totalErrors} | Skipped: ${totalSkipped}`);
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    // Финальная проверка
    const { count: finalWithHistory } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .not('visit_history', 'eq', '[]');
    
    const { count: finalWithServices } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .not('last_services', 'eq', '[]');
    
    logger.info('');
    logger.info('🎉 SYNCHRONIZATION COMPLETE!');
    logger.info('=============================');
    logger.info(`✅ Successfully processed: ${totalProcessed} clients`);
    logger.info(`❌ Errors: ${totalErrors}`);
    logger.info(`⏭️  Skipped: ${totalSkipped}`);
    logger.info(`⏱️  Total time: ${duration} seconds (${Math.round(duration/60)} minutes)`);
    logger.info(`⚡ Speed: ${Math.round(totalProcessed / duration * 60)} clients/minute`);
    logger.info('');
    logger.info('📊 FINAL DATABASE STATE:');
    logger.info(`- Clients with visit history: ${finalWithHistory}/${allClients.length} (${Math.round(finalWithHistory * 100 / allClients.length)}%)`);
    logger.info(`- Clients with last services: ${finalWithServices}/${allClients.length} (${Math.round(finalWithServices * 100 / allClients.length)}%)`);
    
    if (finalWithHistory === allClients.length) {
      logger.info('');
      logger.info('🏆 SUCCESS! All clients now have complete visit history!');
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Запуск
syncAllVisitsParallel();