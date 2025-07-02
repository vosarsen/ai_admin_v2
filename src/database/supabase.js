// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const NodeCache = require('node-cache');
const config = require("../config");
const logger = require("../utils/logger");

// Кэш для статичных данных (услуги, мастера, клиенты)
const cache = new NodeCache({
  stdTTL: 3600, // 1 час - для статичных данных этого достаточно
  checkperiod: 600 // Проверка каждые 10 минут
});

// Валидация конфигурации
if (!config.database.supabaseUrl || !config.database.supabaseKey) {
  logger.error('❌ Критическая ошибка: не настроены переменные окружения Supabase');
  logger.error('Убедитесь что установлены: SUPABASE_URL и SUPABASE_KEY');
  process.exit(1);
}

// Создание клиента
const supabase = createClient(
  config.database.supabaseUrl, 
  config.database.supabaseKey, 
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Получение данных из кэша или базы
 * Используется только для статичных данных (услуги, мастера, клиенты)
 */
async function getCached(key, queryFn) {
  try {
    // Проверяем кэш
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    // Запрашиваем данные
    const { data, error } = await queryFn();
    
    if (error) {
      throw error;
    }

    // Кэшируем результат
    cache.set(key, data);
    return data;

  } catch (error) {
    logger.error(`Ошибка получения данных из Supabase (${key}):`, error.message);
    throw error;
  }
}

/**
 * Очистка кэша для конкретного ключа или полностью
 */
function clearCache(key = null) {
  if (key) {
    cache.del(key);
    logger.debug(`Кэш очищен для ${key}`);
  } else {
    cache.flushAll();
    logger.debug('Весь кэш очищен');
  }
}

// Очистка при выходе
process.on('SIGINT', () => {
  cache.close();
});

module.exports = {
  supabase,
  getCached,
  clearCache
};