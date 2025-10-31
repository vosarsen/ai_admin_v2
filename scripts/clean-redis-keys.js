#!/usr/bin/env node

/**
 * Скрипт регулярной очистки Redis
 * Запускать раз в неделю через cron
 */

const Redis = require('ioredis');
const logger = require('../src/utils/logger');
const { getRedisConfig } = require('../src/config/redis-config');

// Используем централизованную конфигурацию
const redis = new Redis(getRedisConfig());

async function cleanRedis() {
  console.log('🧹 Начинаем очистку Redis...\n');
  
  const stats = {
    deleted: 0,
    expired: 0,
    errors: 0
  };
  
  const allKeys = await redis.keys('*');
  console.log(`📊 Найдено ${allKeys.length} ключей\n`);
  
  // 1. Удаляем старые completed задачи BullMQ (старше 7 дней)
  console.log('📦 Очищаем старые задачи BullMQ...');
  const bullCompletedKeys = allKeys.filter(k => k.includes(':completed'));
  
  for (const key of bullCompletedKeys) {
    try {
      const type = await redis.type(key);
      if (type === 'zset') {
        // Получаем задачи старше 7 дней
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const oldJobs = await redis.zrangebyscore(key, '-inf', sevenDaysAgo);
        
        if (oldJobs.length > 0) {
          // Удаляем старые записи
          await redis.zremrangebyscore(key, '-inf', sevenDaysAgo);
          
          // Удаляем связанные hash ключи
          for (const jobId of oldJobs) {
            const hashKey = key.replace(':completed', `:${jobId}`);
            await redis.del(hashKey);
            stats.deleted++;
          }
          
          console.log(`  ✅ Удалено ${oldJobs.length} старых задач из ${key}`);
        }
      }
    } catch (error) {
      console.error(`  ⚠️  Ошибка очистки ${key}:`, error.message);
      stats.errors++;
    }
  }
  
  // 2. Удаляем старые failed задачи BullMQ (старше 30 дней)
  console.log('\n❌ Очищаем неудачные задачи BullMQ...');
  const bullFailedKeys = allKeys.filter(k => k.includes(':failed'));
  
  for (const key of bullFailedKeys) {
    try {
      const type = await redis.type(key);
      if (type === 'zset') {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const oldJobs = await redis.zrangebyscore(key, '-inf', thirtyDaysAgo);
        
        if (oldJobs.length > 0) {
          await redis.zremrangebyscore(key, '-inf', thirtyDaysAgo);
          
          for (const jobId of oldJobs) {
            const hashKey = key.replace(':failed', `:${jobId}`);
            await redis.del(hashKey);
            stats.deleted++;
          }
          
          console.log(`  ✅ Удалено ${oldJobs.length} старых неудачных задач из ${key}`);
        }
      }
    } catch (error) {
      console.error(`  ⚠️  Ошибка очистки ${key}:`, error.message);
      stats.errors++;
    }
  }
  
  // 3. Удаляем ключи с истёкшим TTL (проверка)
  console.log('\n⏰ Проверяем ключи с истёкшим TTL...');
  let expiredCount = 0;
  
  for (const key of allKeys) {
    try {
      const ttl = await redis.ttl(key);
      // Если TTL = -2, ключ уже удалён
      if (ttl === -2) {
        expiredCount++;
      }
    } catch (error) {
      // Игнорируем ошибки проверки TTL
    }
  }
  
  if (expiredCount > 0) {
    console.log(`  ✅ Redis автоматически удалил ${expiredCount} ключей с истёкшим TTL`);
    stats.expired = expiredCount;
  }
  
  // 4. Удаляем тестовые и временные ключи
  console.log('\n🧪 Удаляем тестовые ключи...');
  const testPatterns = ['test:', 'temp:', 'tmp:', 'debug:'];
  
  for (const pattern of testPatterns) {
    const testKeys = allKeys.filter(k => k.startsWith(pattern));
    for (const key of testKeys) {
      try {
        await redis.del(key);
        console.log(`  ❌ Удалён: ${key}`);
        stats.deleted++;
      } catch (error) {
        console.error(`  ⚠️  Ошибка удаления ${key}:`, error.message);
        stats.errors++;
      }
    }
  }
  
  // 5. Удаляем ключи с [object Object] если они появились снова
  console.log('\n🗑️  Проверяем мусорные ключи...');
  const junkKeys = allKeys.filter(k => k.includes('[object Object]'));
  
  if (junkKeys.length > 0) {
    console.log(`  ⚠️  Найдено ${junkKeys.length} ключей с [object Object] - удаляем...`);
    for (const key of junkKeys) {
      try {
        await redis.del(key);
        console.log(`  ❌ Удалён: ${key}`);
        stats.deleted++;
      } catch (error) {
        console.error(`  ⚠️  Ошибка удаления ${key}:`, error.message);
        stats.errors++;
      }
    }
  } else {
    console.log('  ✅ Мусорные ключи не найдены');
  }
  
  // 6. Анализ памяти
  console.log('\n💾 Анализ использования памяти...');
  try {
    const info = await redis.info('memory');
    const lines = info.split('\r\n');
    const usedMemory = lines.find(l => l.startsWith('used_memory_human:'));
    const peakMemory = lines.find(l => l.startsWith('used_memory_peak_human:'));
    
    if (usedMemory) {
      console.log(`  📊 Используется памяти: ${usedMemory.split(':')[1]}`);
    }
    if (peakMemory) {
      console.log(`  📈 Пиковое использование: ${peakMemory.split(':')[1]}`);
    }
  } catch (error) {
    console.error('  ⚠️  Не удалось получить информацию о памяти');
  }
  
  // 7. Финальная статистика
  console.log('\n' + '='.repeat(60));
  console.log('📊 Результаты очистки:');
  console.log('='.repeat(60));
  console.log(`🗑️  Удалено ключей: ${stats.deleted}`);
  console.log(`⏰ Автоматически истекло: ${stats.expired}`);
  if (stats.errors > 0) {
    console.log(`⚠️  Ошибок: ${stats.errors}`);
  }
  
  // 8. Проверяем финальное состояние
  const finalKeys = await redis.keys('*');
  console.log(`\n📦 Осталось ключей: ${finalKeys.length}`);
  
  // Группируем по типам
  const patterns = {};
  for (const key of finalKeys) {
    const pattern = key.split(':')[0];
    patterns[pattern] = (patterns[pattern] || 0) + 1;
  }
  
  console.log('\n📁 Распределение по типам:');
  Object.entries(patterns)
    .sort(([,a], [,b]) => b - a)
    .forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count}`);
    });
  
  await redis.quit();
}

// Запуск очистки
cleanRedis().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});