#!/usr/bin/env node
/**
 * Параллельная синхронизация историй визитов
 * Обрабатывает несколько клиентов одновременно для ускорения
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const { ClientRecordsSync } = require('../src/sync/client-records-sync');
const logger = require('../src/utils/logger');

const BATCH_SIZE = 5; // Обрабатываем по 5 клиентов параллельно
const DELAY_BETWEEN_BATCHES = 1000; // 1 секунда между батчами

async function processClient(client, recordsSync) {
  try {
    if (!client.yclients_id || !client.phone) {
      return { status: 'skipped', client: client.name };
    }
    
    const records = await recordsSync.getClientRecords(client.yclients_id, client.phone);
    
    if (records && records.length > 0) {
      await recordsSync.saveClientVisits(client.id, client.yclients_id, records);
      return { status: 'success', client: client.name, records: records.length };
    } else {
      return { status: 'no_records', client: client.name };
    }
  } catch (error) {
    return { status: 'error', client: client.name, error: error.message };
  }
}

async function syncInParallel() {
  const startTime = Date.now();
  const recordsSync = new ClientRecordsSync();
  
  try {
    logger.info('🚀 Starting PARALLEL visit history synchronization...');
    
    // Получаем только клиентов БЕЗ истории визитов
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, yclients_id, phone, name, visit_count')
      .gte('visit_count', 1)
      .eq('visit_history', '[]')
      .order('visit_count', { ascending: false });
    
    if (error) throw error;
    
    logger.info(`📊 Found ${clients.length} clients WITHOUT visit history to sync`);
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalErrors = 0;
    let totalSkipped = 0;
    
    // Обрабатываем батчами
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      
      logger.info(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(clients.length/BATCH_SIZE)}`);
      
      // Запускаем параллельную обработку батча
      const promises = batch.map(client => processClient(client, recordsSync));
      const results = await Promise.all(promises);
      
      // Подсчитываем результаты
      results.forEach(result => {
        totalProcessed++;
        if (result.status === 'success') {
          totalSuccess++;
          logger.info(`✅ ${result.client}: ${result.records} records`);
        } else if (result.status === 'error') {
          totalErrors++;
          logger.error(`❌ ${result.client}: ${result.error}`);
        } else if (result.status === 'skipped') {
          totalSkipped++;
        }
      });
      
      // Прогресс
      const progress = Math.round(totalProcessed * 100 / clients.length);
      logger.info(`Progress: ${totalProcessed}/${clients.length} (${progress}%)`);
      
      // Задержка между батчами
      if (i + BATCH_SIZE < clients.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    logger.info('');
    logger.info('🎉 PARALLEL SYNCHRONIZATION COMPLETE!');
    logger.info('======================================');
    logger.info(`✅ Successfully synced: ${totalSuccess} clients`);
    logger.info(`⏭️  Skipped: ${totalSkipped} clients`);
    logger.info(`❌ Errors: ${totalErrors} clients`);
    logger.info(`⏱️  Total time: ${duration} seconds (${Math.round(duration/60)} minutes)`);
    logger.info(`⚡ Speed: ${Math.round(totalProcessed / duration * 60)} clients/minute`);
    
    // Финальная проверка
    const { count: withHistory } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('visit_count', 1)
      .not('visit_history', 'eq', '[]');
    
    const { count: total } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('visit_count', 1);
    
    logger.info('');
    logger.info(`📈 Final result: ${withHistory}/${total} clients have visit history (${Math.round(withHistory * 100 / total)}%)`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Запуск
syncInParallel();