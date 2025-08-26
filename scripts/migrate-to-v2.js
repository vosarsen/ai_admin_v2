#!/usr/bin/env node

/**
 * Скрипт миграции на v2 систему контекста
 * Очищает старые ключи и мигрирует данные в новый формат
 */

require('dotenv').config();
const redis = require('redis');
const logger = require('../src/utils/logger').child({ module: 'migration' });

async function migrateToV2() {
  const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  await client.connect();
  logger.info('Connected to Redis');
  
  try {
    // 1. Получаем все старые ключи контекста
    const oldKeys = await client.keys('context:*');
    logger.info(`Found ${oldKeys.length} old context keys`);
    
    if (oldKeys.length === 0) {
      logger.info('No old keys to migrate');
      return;
    }
    
    // 2. Спрашиваем подтверждение
    if (process.argv[2] !== '--force') {
      console.log(`\n⚠️  This will DELETE ${oldKeys.length} old context keys!`);
      console.log('Keys to be deleted:', oldKeys.slice(0, 10), oldKeys.length > 10 ? '...' : '');
      console.log('\nRun with --force to proceed\n');
      process.exit(0);
    }
    
    // 3. Удаляем старые ключи
    logger.info('Deleting old keys...');
    let deleted = 0;
    
    for (const key of oldKeys) {
      try {
        await client.del(key);
        deleted++;
        if (deleted % 100 === 0) {
          logger.info(`Deleted ${deleted}/${oldKeys.length} keys`);
        }
      } catch (error) {
        logger.error(`Failed to delete key ${key}:`, error.message);
      }
    }
    
    logger.info(`✅ Deleted ${deleted} old context keys`);
    
    // 4. Показываем статистику новых ключей
    const v2Keys = {
      dialog: await client.keys('dialog:*'),
      messages: await client.keys('messages:*'),
      client: await client.keys('client:*'),
      preferences: await client.keys('prefs:*'),
      fullContext: await client.keys('full_ctx:*'),
      processing: await client.keys('processing:*'),
      intermediate: await client.keys('intermediate:*')
    };
    
    logger.info('\n📊 V2 System Statistics:');
    for (const [type, keys] of Object.entries(v2Keys)) {
      logger.info(`  ${type}: ${keys.length} keys`);
    }
    
    logger.info('\n✅ Migration to v2 completed successfully!');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

// Запуск
migrateToV2().catch(console.error);