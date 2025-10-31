#!/usr/bin/env node
/**
 * Скрипт для синхронизации ВСЕХ историй визитов для ВСЕХ клиентов
 * Загружает полную историю визитов, последние услуги и предпочтения
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const { ClientRecordsSync } = require('../src/sync/client-records-sync');
const logger = require('../src/utils/logger');

async function syncAllVisits() {
  const startTime = Date.now();
  const recordsSync = new ClientRecordsSync();
  
  try {
    logger.info('🚀 Starting COMPLETE visit history synchronization for ALL clients...');
    
    // Получаем ВСЕХ клиентов с хотя бы одним визитом
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, yclients_id, phone, name, visit_count')
      .gte('visit_count', 1)
      .order('visit_count', { ascending: false });
    
    if (error) throw error;
    
    logger.info(`📊 Found ${clients.length} clients with visits to sync`);
    
    let processed = 0;
    let errors = 0;
    let skipped = 0;
    
    // Обрабатываем каждого клиента
    for (const client of clients) {
      try {
        // Пропускаем если нет YClients ID или телефона
        if (!client.yclients_id || !client.phone) {
          skipped++;
          continue;
        }
        
        logger.debug(`Processing ${client.name} (${client.phone}) - ${client.visit_count} visits`);
        
        // Загружаем записи клиента из YClients
        const records = await recordsSync.getClientRecords(client.yclients_id, client.phone);
        
        if (records && records.length > 0) {
          // Сохраняем визиты и обновляем все поля
          await recordsSync.saveClientVisits(client.id, client.yclients_id, records);
          processed++;
          
          if (processed % 10 === 0) {
            logger.info(`✅ Progress: ${processed}/${clients.length} clients synced`);
          }
        } else {
          logger.debug(`No records found for ${client.name}`);
        }
        
        // Задержка чтобы не перегрузить API (200ms между запросами)
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors++;
        logger.error(`Failed to sync ${client.name}: ${error.message}`);
        
        // Продолжаем даже если была ошибка
        continue;
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    logger.info('');
    logger.info('🎉 SYNCHRONIZATION COMPLETE!');
    logger.info('=============================');
    logger.info(`✅ Successfully synced: ${processed} clients`);
    logger.info(`⏭️  Skipped (no data): ${skipped} clients`);
    logger.info(`❌ Errors: ${errors} clients`);
    logger.info(`⏱️  Total time: ${duration} seconds (${Math.round(duration/60)} minutes)`);
    logger.info('');
    
    // Проверяем результат
    const { data: check } = await supabase
      .from('clients')
      .select('id')
      .gte('visit_count', 1)
      .not('visit_history', 'eq', '[]');
    
    logger.info(`📈 Final check: ${check?.length || 0} clients now have visit history`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Запуск
syncAllVisits();