#!/usr/bin/env node

/**
 * Безопасная очистка старых ключей Redis после миграции на v2
 * Удаляет только старые context: ключи, сохраняя новую структуру
 */

require('dotenv').config();
const redis = require('redis');
const logger = require('../src/utils/logger').child({ module: 'redis-cleanup' });

async function cleanupOldRedisKeys() {
  const client = redis.createClient({
    url: 'redis://localhost:6380',  // Используем SSH туннель
    password: process.env.REDIS_PASSWORD || ''
  });
  
  await client.connect();
  logger.info('Connected to Redis via tunnel');
  
  try {
    // 1. Получаем все старые ключи контекста
    const oldContextKeys = await client.keys('context:*');
    logger.info(`Found ${oldContextKeys.length} old context:* keys`);
    
    // 2. Фильтруем только старые форматы (исключаем новые)
    const keysToDelete = oldContextKeys.filter(key => {
      // Новые ключи v2 НЕ удаляем:
      // - dialog:*
      // - messages:*
      // - client:*
      // - prefs:*
      // - full_ctx:*
      
      // Старые ключи для удаления:
      // - context:962302:+79001234567 (hash)
      // - context:962302:+79001234567:messages (list)
      // - context:clients:962302 (hash)
      
      return key.startsWith('context:');
    });
    
    logger.info(`Filtered ${keysToDelete.length} keys to delete`);
    
    // 3. Показываем что будет удалено
    if (keysToDelete.length > 0) {
      console.log('\n📋 Keys to be deleted:');
      console.log('─'.repeat(50));
      
      // Показываем первые 20 ключей
      const preview = keysToDelete.slice(0, 20);
      preview.forEach(key => console.log(`  - ${key}`));
      
      if (keysToDelete.length > 20) {
        console.log(`  ... and ${keysToDelete.length - 20} more`);
      }
      
      console.log('─'.repeat(50));
      
      // 4. Спрашиваем подтверждение
      if (process.argv[2] !== '--force') {
        console.log('\n⚠️  This will DELETE old context keys!');
        console.log('These keys are from the old system and are no longer needed.');
        console.log('\nRun with --force to proceed\n');
        process.exit(0);
      }
      
      // 5. Удаляем старые ключи пакетами
      console.log('\n🗑️  Deleting old keys...');
      let deleted = 0;
      const batchSize = 100;
      
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        
        // Удаляем пакет ключей
        for (const key of batch) {
          try {
            await client.del(key);
            deleted++;
          } catch (error) {
            logger.error(`Failed to delete key ${key}:`, error.message);
          }
        }
        
        // Прогресс
        const progress = Math.min(100, Math.round((deleted / keysToDelete.length) * 100));
        process.stdout.write(`\r  Progress: ${progress}% (${deleted}/${keysToDelete.length})`);
      }
      
      console.log('\n✅ Deleted ' + deleted + ' old context keys');
    } else {
      console.log('✅ No old keys found to delete');
    }
    
    // 6. Показываем статистику новой системы v2
    console.log('\n📊 V2 System Statistics:');
    console.log('─'.repeat(50));
    
    const v2Patterns = [
      'dialog:*',
      'messages:*', 
      'client:*',
      'prefs:*',
      'full_ctx:*',
      'processing:*',
      'intermediate:*'
    ];
    
    for (const pattern of v2Patterns) {
      const keys = await client.keys(pattern);
      const padded = pattern.padEnd(15);
      console.log(`  ${padded}: ${keys.length} keys`);
    }
    
    console.log('─'.repeat(50));
    console.log('\n✨ Redis cleanup completed successfully!');
    console.log('The system is now running purely on v2 architecture.\n');
    
  } catch (error) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await client.quit();
  }
}

// Запуск
cleanupOldRedisKeys().catch(console.error);