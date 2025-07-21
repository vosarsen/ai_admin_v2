#!/usr/bin/env node

/**
 * Скрипт для синхронизации расписания мастеров с YClients
 * Обновляет таблицу staff_schedules актуальными данными
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const { YclientsClient } = require('../src/integrations/yclients/client');
const logger = require('../src/utils/logger').child({ module: 'sync-staff-schedules' });

// Создаем экземпляр клиента
const yclientsClient = new YclientsClient();

const COMPANY_ID = process.env.YCLIENTS_COMPANY_ID || 962302;

async function syncStaffSchedules() {
  try {
    logger.info('Starting staff schedules sync...');
    
    // Получаем список мастеров
    const { data: staffList } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('is_active', true);
    
    if (!staffList || staffList.length === 0) {
      logger.error('No active staff found');
      return;
    }
    
    logger.info(`Found ${staffList.length} active staff members`);
    
    // Для каждого мастера проверяем доступность на сегодня
    const today = new Date().toISOString().split('T')[0];
    
    for (const staff of staffList) {
      try {
        logger.info(`Checking availability for ${staff.name} (${staff.yclients_id})...`);
        
        // Получаем слоты для конкретного мастера
        const result = await yclientsClient.getAvailableSlots(
          staff.yclients_id,
          today,
          {},
          COMPANY_ID
        );
        
        const slots = result?.data?.data || [];
        const hasSlots = slots && slots.length > 0;
        
        logger.info(`${staff.name}: ${hasSlots ? `${slots.length} slots available` : 'no slots'}`);
        
        // Обновляем запись в базе данных
        const { error } = await supabase
          .from('staff_schedules')
          .upsert({
            staff_id: staff.yclients_id,
            staff_name: staff.name,
            date: today,
            is_working: hasSlots,
            has_booking_slots: hasSlots,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'staff_id,date'
          });
        
        if (error) {
          logger.error(`Error updating schedule for ${staff.name}:`, error);
        } else {
          logger.info(`Updated schedule for ${staff.name}: is_working=${hasSlots}`);
        }
        
      } catch (error) {
        logger.error(`Error processing ${staff.name}:`, error);
      }
    }
    
    logger.info('Staff schedules sync completed');
    
  } catch (error) {
    logger.error('Sync error:', error);
  } finally {
    process.exit(0);
  }
}

// Запускаем синхронизацию
syncStaffSchedules();