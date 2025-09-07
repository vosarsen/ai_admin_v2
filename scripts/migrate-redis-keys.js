#!/usr/bin/env node

/**
 * Скрипт миграции Redis ключей
 * - Унифицирует preferences/prefs на единый паттерн
 * - Очищает мусорные ключи
 * - Устанавливает правильные TTL
 */

const Redis = require('ioredis');
const logger = require('../src/utils/logger');

const redis = new Redis({
  port: 6380,
  host: 'localhost',
  password: process.env.REDIS_PASSWORD || '70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg=',
  db: 0
});

// Конфигурация TTL (в секундах)
const TTL_CONFIG = {
  preferences: 90 * 24 * 3600,  // 90 дней
  dialog: 24 * 3600,             // 24 часа
  client: 7 * 24 * 3600,         // 7 дней
  messages: 30 * 24 * 3600,      // 30 дней
  booking: 365 * 24 * 3600,      // 365 дней
  reminder_context: 24 * 3600    // 24 часа
};

/**
 * Нормализует телефонный номер в формат E.164 без +
 * Примеры:
 * +79001234567 -> 79001234567
 * 89001234567 -> 79001234567
 * 9001234567 -> 79001234567
 */
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Убираем все нецифровые символы
  const cleaned = phone.replace(/\D/g, '');
  
  // Если начинается с 8, заменяем на 7
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    return '7' + cleaned.slice(1);
  }
  
  // Если 10 цифр, добавляем 7 в начало
  if (cleaned.length === 10) {
    return '7' + cleaned;
  }
  
  return cleaned;
}

async function migrateKeys() {
  console.log('🚀 Начинаем миграцию Redis ключей...\n');
  
  const stats = {
    migrated: 0,
    deleted: 0,
    ttlUpdated: 0,
    errors: 0
  };
  
  const allKeys = await redis.keys('*');
  console.log(`📊 Найдено ${allKeys.length} ключей\n`);
  
  // 1. Удаляем мусорные ключи с [object Object]
  console.log('🗑️  Удаляем мусорные ключи...');
  const junkKeys = allKeys.filter(k => k.includes('[object Object]'));
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
  
  // 2. Удаляем тестовые ключи
  const testKeys = allKeys.filter(k => k.startsWith('test:') || k.includes('test-queue'));
  for (const key of testKeys) {
    try {
      await redis.del(key);
      console.log(`  ❌ Удалён тестовый: ${key}`);
      stats.deleted++;
    } catch (error) {
      console.error(`  ⚠️  Ошибка удаления ${key}:`, error.message);
      stats.errors++;
    }
  }
  
  // 3. Мигрируем prefs на preferences
  console.log('\n📦 Мигрируем prefs -> preferences...');
  const prefsKeys = allKeys.filter(k => k.startsWith('prefs:'));
  
  for (const oldKey of prefsKeys) {
    try {
      // Парсим старый ключ: prefs:962302:79001234567
      const parts = oldKey.split(':');
      if (parts.length !== 3) continue;
      
      const [, companyId, phone] = parts;
      const normalizedPhone = normalizePhone(phone);
      
      if (!normalizedPhone) {
        console.log(`  ⚠️  Не могу нормализовать телефон: ${phone}`);
        continue;
      }
      
      // Новый ключ в формате E.164 без +
      const newKey = `preferences:${companyId}:${normalizedPhone}`;
      
      // Получаем данные
      const value = await redis.get(oldKey);
      const ttl = await redis.ttl(oldKey);
      
      // Если новый ключ уже существует, сравниваем данные
      const existingValue = await redis.get(newKey);
      if (existingValue) {
        console.log(`  ⚠️  Ключ уже существует: ${newKey}`);
        // Удаляем старый ключ
        await redis.del(oldKey);
        stats.deleted++;
      } else {
        // Создаём новый ключ с правильным TTL
        const finalTtl = ttl > 0 ? Math.min(ttl, TTL_CONFIG.preferences) : TTL_CONFIG.preferences;
        await redis.setex(newKey, finalTtl, value);
        await redis.del(oldKey);
        console.log(`  ✅ ${oldKey} -> ${newKey}`);
        stats.migrated++;
      }
    } catch (error) {
      console.error(`  ⚠️  Ошибка миграции ${oldKey}:`, error.message);
      stats.errors++;
    }
  }
  
  // 4. Мигрируем старые preferences с + в номере
  console.log('\n📱 Нормализуем номера в preferences...');
  const oldPrefsKeys = allKeys.filter(k => k.startsWith('preferences:') && k.includes('+'));
  
  for (const oldKey of oldPrefsKeys) {
    try {
      const parts = oldKey.split(':');
      if (parts.length !== 3) continue;
      
      const [, companyId, phone] = parts;
      const normalizedPhone = normalizePhone(phone);
      
      if (!normalizedPhone) {
        console.log(`  ⚠️  Не могу нормализовать телефон: ${phone}`);
        continue;
      }
      
      const newKey = `preferences:${companyId}:${normalizedPhone}`;
      
      if (oldKey === newKey) continue; // Уже нормализован
      
      const value = await redis.get(oldKey);
      const ttl = await redis.ttl(oldKey);
      
      const existingValue = await redis.get(newKey);
      if (existingValue) {
        console.log(`  ⚠️  Ключ уже существует: ${newKey}`);
        await redis.del(oldKey);
        stats.deleted++;
      } else {
        const finalTtl = ttl > 0 ? Math.min(ttl, TTL_CONFIG.preferences) : TTL_CONFIG.preferences;
        await redis.setex(newKey, finalTtl, value);
        await redis.del(oldKey);
        console.log(`  ✅ ${oldKey} -> ${newKey}`);
        stats.migrated++;
      }
    } catch (error) {
      console.error(`  ⚠️  Ошибка нормализации ${oldKey}:`, error.message);
      stats.errors++;
    }
  }
  
  // 5. Обновляем TTL для всех типов ключей
  console.log('\n⏰ Обновляем TTL...');
  
  // Обновленный список ключей после миграции
  const currentKeys = await redis.keys('*');
  
  for (const key of currentKeys) {
    try {
      const ttl = await redis.ttl(key);
      let newTtl = null;
      
      if (key.startsWith('preferences:')) {
        if (ttl === -1 || ttl > TTL_CONFIG.preferences) {
          newTtl = TTL_CONFIG.preferences;
        }
      } else if (key.startsWith('dialog:')) {
        if (ttl === -1 || ttl < 3600) { // Если меньше часа, увеличиваем
          newTtl = TTL_CONFIG.dialog;
        }
      } else if (key.startsWith('client:')) {
        if (ttl === -1 || ttl < TTL_CONFIG.client) {
          newTtl = TTL_CONFIG.client;
        }
      } else if (key.startsWith('messages:')) {
        if (ttl === -1 || ttl < TTL_CONFIG.messages) {
          newTtl = TTL_CONFIG.messages;
        }
      } else if (key.startsWith('booking:owner:')) {
        if (ttl === -1) {
          newTtl = TTL_CONFIG.booking;
        }
      } else if (key.startsWith('reminder_context:')) {
        if (ttl === -1) {
          newTtl = TTL_CONFIG.reminder_context;
        }
      }
      
      if (newTtl) {
        await redis.expire(key, newTtl);
        console.log(`  ⏰ TTL обновлён для ${key}: ${Math.floor(newTtl / 86400)} дней`);
        stats.ttlUpdated++;
      }
    } catch (error) {
      console.error(`  ⚠️  Ошибка обновления TTL для ${key}:`, error.message);
      stats.errors++;
    }
  }
  
  // 6. Финальная статистика
  console.log('\n' + '='.repeat(60));
  console.log('📊 Результаты миграции:');
  console.log('='.repeat(60));
  console.log(`✅ Мигрировано ключей: ${stats.migrated}`);
  console.log(`🗑️  Удалено мусорных ключей: ${stats.deleted}`);
  console.log(`⏰ Обновлено TTL: ${stats.ttlUpdated}`);
  if (stats.errors > 0) {
    console.log(`⚠️  Ошибок: ${stats.errors}`);
  }
  
  // 7. Проверяем результат
  const finalKeys = await redis.keys('*');
  const problemKeys = finalKeys.filter(k => 
    k.includes('[object Object]') || 
    k.startsWith('prefs:') ||
    k.includes('+7')
  );
  
  if (problemKeys.length > 0) {
    console.log('\n⚠️  Остались проблемные ключи:');
    problemKeys.forEach(k => console.log(`  - ${k}`));
  } else {
    console.log('\n✅ Все проблемы исправлены!');
  }
  
  await redis.quit();
}

// Запуск миграции
migrateKeys().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});