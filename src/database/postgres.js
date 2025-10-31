// src/database/postgres.js
// Timeweb PostgreSQL connection pool

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

// Валидация конфигурации
if (!config.database.postgresPassword) {
  logger.error('❌ Критическая ошибка: не настроена переменная POSTGRES_PASSWORD');
  logger.error('Убедитесь что установлена переменная окружения');
  process.exit(1);
}

// Создание connection pool
const pool = new Pool({
  host: config.database.postgresHost,
  port: config.database.postgresPort,
  database: config.database.postgresDatabase,
  user: config.database.postgresUser,
  password: config.database.postgresPassword,

  // Connection pool settings
  max: 20, // Максимум connections
  idleTimeoutMillis: 30000, // 30 секунд
  connectionTimeoutMillis: 5000, // 5 секунд timeout

  // Statement timeout (для защиты от долгих запросов)
  statement_timeout: 10000, // 10 секунд

  // SSL (если нужно)
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Обработка ошибок pool
pool.on('error', (err, client) => {
  logger.error('❌ Unexpected error on idle PostgreSQL client:', err);
});

// Проверка подключения при старте
pool.query('SELECT NOW() as current_time, version() as pg_version', (err, res) => {
  if (err) {
    logger.error('❌ Failed to connect to Timeweb PostgreSQL:', err.message);
    logger.error('Connection details:', {
      host: config.database.postgresHost,
      port: config.database.postgresPort,
      database: config.database.postgresDatabase,
      user: config.database.postgresUser,
    });
  } else {
    logger.info('✅ Connected to Timeweb PostgreSQL');
    logger.info('   Current time:', res.rows[0].current_time);
    logger.info('   PostgreSQL version:', res.rows[0].pg_version.split(',')[0]);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing PostgreSQL connection pool...');
  await pool.end();
  logger.info('PostgreSQL connection pool closed');
});

process.on('SIGTERM', async () => {
  logger.info('Closing PostgreSQL connection pool...');
  await pool.end();
  logger.info('PostgreSQL connection pool closed');
});

/**
 * Выполнить SQL запрос
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} - Результат запроса
 */
async function query(text, params) {
  const start = Date.now();

  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Логируем медленные запросы (>1 секунда)
    if (duration > 1000) {
      logger.warn('Slow query detected:', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query error:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Получить client из pool для транзакций
 * @returns {Promise<Object>} - PostgreSQL client
 */
async function getClient() {
  return await pool.connect();
}

/**
 * Выполнить запрос в транзакции
 * @param {Function} callback - Функция с запросами
 * @returns {Promise<any>} - Результат транзакции
 */
async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получить статистику connection pool
 * @returns {Object} - Статистика pool
 */
function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  getPoolStats,
};
