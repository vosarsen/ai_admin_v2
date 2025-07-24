#!/usr/bin/env node

/**
 * Скрипт для планирования напоминаний для существующих записей
 */

require('dotenv').config();
const reminderService = require('../src/services/reminder');
const logger = require('../src/utils/logger');

async function scheduleExistingReminders() {
  try {
    logger.info('🚀 Starting to schedule reminders for existing bookings...');
    
    await reminderService.scheduleRemindersForExistingBookings();
    
    logger.info('✅ Finished scheduling reminders');
    process.exit(0);
    
  } catch (error) {
    logger.error('Failed to schedule reminders:', error);
    process.exit(1);
  }
}

// Запуск
scheduleExistingReminders();