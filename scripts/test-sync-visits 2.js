#!/usr/bin/env node
/**
 * Тестовый скрипт - синхронизирует визиты для первых 10 клиентов
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const { ClientRecordsSync } = require('../src/sync/client-records-sync');
const logger = require('../src/utils/logger');

async function testSync() {
  const recordsSync = new ClientRecordsSync();
  
  try {
    logger.info('🧪 Testing visit sync for 10 clients...');
    
    // Берем 10 клиентов с визитами но без истории
    const { data: clients } = await supabase
      .from('clients')
      .select('id, yclients_id, phone, name, visit_count')
      .gte('visit_count', 1)
      .eq('visit_history', '[]')
      .limit(10);
    
    logger.info(`Testing with ${clients.length} clients`);
    
    for (const client of clients) {
      logger.info(`\nProcessing: ${client.name} (${client.phone})`);
      logger.info(`- YClients ID: ${client.yclients_id}`);
      logger.info(`- Visit count: ${client.visit_count}`);
      
      try {
        const records = await recordsSync.getClientRecords(client.yclients_id, client.phone);
        logger.info(`- Found ${records.length} records`);
        
        if (records.length > 0) {
          await recordsSync.saveClientVisits(client.id, client.yclients_id, records);
          logger.info(`✅ Saved successfully!`);
          
          // Проверяем что сохранилось
          const { data: updated } = await supabase
            .from('clients')
            .select('visit_history, last_services, preferences')
            .eq('id', client.id)
            .single();
          
          logger.info(`- Visit history: ${updated.visit_history?.length || 0} records`);
          logger.info(`- Last services: ${updated.last_services?.join(', ') || 'none'}`);
        }
        
      } catch (error) {
        logger.error(`❌ Error: ${error.message}`);
      }
      
      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info('\n✅ Test completed!');
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

testSync();