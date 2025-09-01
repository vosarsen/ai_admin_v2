#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки исправления синхронизации склонений
 */

require('dotenv').config();
const { ServicesSync } = require('./src/sync/services-sync');
const { StaffSync } = require('./src/sync/staff-sync');
const { supabase } = require('./src/database/supabase');
const logger = require('./src/utils/logger').child({ module: 'test-sync-fix' });

async function testServicesSync() {
  logger.info('🧪 Testing services sync fix...');
  
  // Проверяем текущее состояние склонений в БД
  const { data: beforeSync } = await supabase
    .from('services')
    .select('id, title, yclients_id, declensions')
    .eq('company_id', 962302)
    .limit(5);
  
  logger.info('📚 Services BEFORE sync:', {
    total: beforeSync?.length,
    withDeclensions: beforeSync?.filter(s => s.declensions !== null).length || 0
  });
  
  // Запускаем синхронизацию
  const servicesSync = new ServicesSync();
  const result = await servicesSync.sync();
  
  logger.info('✅ Sync result:', result);
  
  // Проверяем состояние после синхронизации
  const { data: afterSync } = await supabase
    .from('services')
    .select('id, title, yclients_id, declensions')
    .eq('company_id', 962302)
    .limit(5);
  
  logger.info('📚 Services AFTER sync:', {
    total: afterSync?.length,
    withDeclensions: afterSync?.filter(s => s.declensions !== null).length || 0
  });
  
  // Проверяем, что склонения сохранились
  let preserved = 0;
  let lost = 0;
  
  for (const service of afterSync || []) {
    const before = beforeSync?.find(s => s.id === service.id);
    if (before) {
      if (before.declensions && !service.declensions) {
        logger.error(`❌ Lost declensions for: ${service.title}`);
        lost++;
      } else if (before.declensions && service.declensions) {
        logger.info(`✅ Preserved declensions for: ${service.title}`);
        preserved++;
      }
    }
  }
  
  return { preserved, lost };
}

async function testStaffSync() {
  logger.info('🧪 Testing staff sync fix...');
  
  // Проверяем текущее состояние склонений в БД
  const { data: beforeSync } = await supabase
    .from('staff')
    .select('id, name, yclients_id, declensions')
    .eq('company_id', 962302)
    .limit(5);
  
  logger.info('👥 Staff BEFORE sync:', {
    total: beforeSync?.length,
    withDeclensions: beforeSync?.filter(s => s.declensions !== null).length || 0
  });
  
  // Запускаем синхронизацию
  const staffSync = new StaffSync();
  const result = await staffSync.sync();
  
  logger.info('✅ Sync result:', result);
  
  // Проверяем состояние после синхронизации
  const { data: afterSync } = await supabase
    .from('staff')
    .select('id, name, yclients_id, declensions')
    .eq('company_id', 962302)
    .limit(5);
  
  logger.info('👥 Staff AFTER sync:', {
    total: afterSync?.length,
    withDeclensions: afterSync?.filter(s => s.declensions !== null).length || 0
  });
  
  // Проверяем, что склонения сохранились
  let preserved = 0;
  let lost = 0;
  
  for (const staff of afterSync || []) {
    const before = beforeSync?.find(s => s.id === staff.id);
    if (before) {
      if (before.declensions && !staff.declensions) {
        logger.error(`❌ Lost declensions for: ${staff.name}`);
        lost++;
      } else if (before.declensions && staff.declensions) {
        logger.info(`✅ Preserved declensions for: ${staff.name}`);
        preserved++;
      }
    }
  }
  
  return { preserved, lost };
}

async function main() {
  try {
    logger.info('🚀 Starting sync fix test...');
    
    // Тестируем услуги
    const servicesResult = await testServicesSync();
    
    // Тестируем мастеров
    const staffResult = await testStaffSync();
    
    // Итоги
    logger.info('📊 TEST RESULTS:');
    logger.info('Services:', servicesResult);
    logger.info('Staff:', staffResult);
    
    if (servicesResult.lost > 0 || staffResult.lost > 0) {
      logger.error('❌ TEST FAILED: Some declensions were lost during sync!');
      process.exit(1);
    } else {
      logger.info('✅ TEST PASSED: All declensions preserved!');
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();