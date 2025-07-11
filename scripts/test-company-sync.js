#!/usr/bin/env node
// scripts/test-company-sync.js
// Тестовый скрипт для проверки синхронизации данных компании

require('dotenv').config();
const { syncCompany, companySync } = require('../src/sync/company-sync');
const logger = require('../src/utils/logger');

async function testCompanySync() {
  logger.info('🚀 Starting company sync test');

  try {
    // Получаем ID компании из конфига или аргументов командной строки
    const companyId = process.argv[2] || process.env.YCLIENTS_COMPANY_ID;

    if (!companyId) {
      logger.error('❌ Company ID not provided. Use: node test-company-sync.js <company_id>');
      process.exit(1);
    }

    logger.info(`📋 Testing sync for company ID: ${companyId}`);

    // 1. Проверяем информацию о последней синхронизации
    const lastSyncInfo = await companySync.getLastSyncInfo(companyId);
    logger.info('📊 Last sync info:', lastSyncInfo);

    // 2. Выполняем синхронизацию
    const result = await syncCompany(companyId);

    if (result.success) {
      logger.info('✅ Sync completed successfully!', {
        companyName: result.companyName,
        duration: `${result.duration}ms`
      });

      // 3. Показываем синхронизированные данные
      if (result.data) {
        logger.info('📦 Synced company data:', {
          id: result.data.id,
          yclients_id: result.data.yclients_id,
          title: result.data.title,
          phone: result.data.phone,
          email: result.data.email,
          address: result.data.address,
          timezone: result.data.timezone,
          hasCoordinates: !!(result.data.coordinate_lat && result.data.coordinate_lon),
          hasWorkingHours: Object.keys(result.data.working_hours || {}).length > 0
        });
      }
    } else {
      logger.error('❌ Sync failed:', result.error);
    }

  } catch (error) {
    logger.error('💥 Test failed with error:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Запускаем тест
testCompanySync()
  .then(() => {
    logger.info('🏁 Test completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('💥 Unexpected error:', error);
    process.exit(1);
  });