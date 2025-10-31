#!/usr/bin/env node

/**
 * Скрипт для регенерации склонений для всех услуг и мастеров
 * Используется для восстановления склонений после их потери
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const serviceDeclension = require('../src/services/declension/service-declension');
const staffDeclension = require('../src/services/declension/staff-declension');
const logger = require('../src/utils/logger');

const COMPANY_ID = process.env.YCLIENTS_COMPANY_ID || 962302;

async function regenerateServiceDeclensions() {
  try {
    logger.info('🛍️ Starting regeneration of service declensions...');
    
    // Получаем все услуги без склонений
    const { data: services, error } = await supabase
      .from('services')
      .select('id, yclients_id, title')
      .eq('company_id', COMPANY_ID)
      .or('declensions.is.null,declensions.eq.{}');
    
    if (error) {
      throw error;
    }
    
    if (!services || services.length === 0) {
      logger.info('✅ All services already have declensions');
      return { updated: 0, errors: 0 };
    }
    
    logger.info(`📋 Found ${services.length} services without declensions`);
    
    // Генерируем склонения пакетами
    const declensionsMap = await serviceDeclension.generateBatchDeclensions(services);
    
    let updated = 0;
    let errors = 0;
    
    // Обновляем каждую услугу
    for (const service of services) {
      const declensions = declensionsMap.get(service.yclients_id);
      
      if (!declensions) {
        logger.warn(`⚠️ No declensions generated for service: ${service.title}`);
        errors++;
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('services')
        .update({ declensions })
        .eq('id', service.id);
      
      if (updateError) {
        logger.error(`❌ Failed to update service ${service.title}:`, updateError);
        errors++;
      } else {
        updated++;
        if (updated % 10 === 0) {
          logger.info(`Progress: ${updated}/${services.length} services updated`);
        }
      }
    }
    
    logger.info(`✅ Service declensions regeneration completed: ${updated} updated, ${errors} errors`);
    return { updated, errors };
    
  } catch (error) {
    logger.error('❌ Failed to regenerate service declensions:', error);
    throw error;
  }
}

async function regenerateStaffDeclensions() {
  try {
    logger.info('👥 Starting regeneration of staff declensions...');
    
    // Получаем всех мастеров без склонений
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, yclients_id, name')
      .eq('company_id', COMPANY_ID)
      .or('declensions.is.null,declensions.eq.{}');
    
    if (error) {
      throw error;
    }
    
    if (!staff || staff.length === 0) {
      logger.info('✅ All staff members already have declensions');
      return { updated: 0, errors: 0 };
    }
    
    logger.info(`📋 Found ${staff.length} staff members without declensions`);
    
    // Генерируем склонения пакетами
    const declensionsMap = await staffDeclension.generateBatchDeclensions(staff);
    
    let updated = 0;
    let errors = 0;
    
    // Обновляем каждого мастера
    for (const member of staff) {
      const declensions = declensionsMap.get(member.yclients_id);
      
      if (!declensions) {
        logger.warn(`⚠️ No declensions generated for staff: ${member.name}`);
        errors++;
        continue;
      }
      
      const { error: updateError } = await supabase
        .from('staff')
        .update({ declensions })
        .eq('id', member.id);
      
      if (updateError) {
        logger.error(`❌ Failed to update staff ${member.name}:`, updateError);
        errors++;
      } else {
        updated++;
        logger.info(`✅ Updated declensions for ${member.name}`);
      }
    }
    
    logger.info(`✅ Staff declensions regeneration completed: ${updated} updated, ${errors} errors`);
    return { updated, errors };
    
  } catch (error) {
    logger.error('❌ Failed to regenerate staff declensions:', error);
    throw error;
  }
}

async function main() {
  logger.info('🚀 Starting declensions regeneration...');
  
  try {
    // Регенерируем склонения для услуг
    const servicesResult = await regenerateServiceDeclensions();
    
    // Регенерируем склонения для мастеров
    const staffResult = await regenerateStaffDeclensions();
    
    logger.info('🎉 Declensions regeneration completed!', {
      services: servicesResult,
      staff: staffResult
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Regeneration failed:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
main();