// src/database/postgres.js
// Timeweb PostgreSQL connection pool

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');

// Проверка: нужен ли PostgreSQL
const usePostgres = !config.database.useLegacySupabase;

// Валидация конфигурации (только если используем PostgreSQL)
if (usePostgres && !config.database.postgresPassword) {
  logger.error('❌ Критическая ошибка: POSTGRES_PASSWORD не установлен');
  logger.error('Убедитесь что установлена переменная окружения POSTGRES_PASSWORD');
  logger.error('Или используйте USE_LEGACY_SUPABASE=true для работы с Supabase');
  process.exit(1);
}

let pool = null;

// Connection pool configuration
// With 7 PM2 services running simultaneously:
// - Max connections per service: 3
// - Total connections: 7 × 3 = 21 (safe for most PostgreSQL limits)
const MAX_CONNECTIONS_PER_SERVICE = parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '3', 10);

// Создание connection pool (только если используем PostgreSQL)
if (usePostgres) {
  pool = new Pool({
    host: config.database.postgresHost,
    port: config.database.postgresPort,
    database: config.database.postgresDatabase,
    user: config.database.postgresUser,
    password: config.database.postgresPassword,

    // Connection pool settings (optimized for 7 services)
    max: MAX_CONNECTIONS_PER_SERVICE, // 3 per service = 21 total (safe)
    min: 1, // Keep 1 idle connection ready

    // Timeouts
    idleTimeoutMillis: 30000, // 30s - Close idle connections
    connectionTimeoutMillis: 10000, // 10s - Increased from 5s for reliability

    // Query timeouts
    statement_timeout: 30000, // 30s for normal queries
    query_timeout: 60000, // 60s for heavy queries (migrations, reports)

    // Connection lifetime
    max_lifetime: 3600000, // 1 hour - Recycle connections periodically

    // SSL (если нужно)
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  // Connection pool monitoring events
  pool.on('connect', (client) => {
    logger.debug('PostgreSQL client connected', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  });

  pool.on('acquire', (client) => {
    // Warn if pool is nearing capacity (>80%)
    const usage = pool.totalCount / MAX_CONNECTIONS_PER_SERVICE;
    if (usage > 0.8) {
      logger.warn('Connection pool nearing capacity', {
        total: pool.totalCount,
        max: MAX_CONNECTIONS_PER_SERVICE,
        usage: `${Math.round(usage * 100)}%`,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      });
    }
  });

  pool.on('remove', (client) => {
    logger.debug('PostgreSQL client removed', {
      remaining: pool.totalCount
    });
  });

  // Обработка ошибок pool
  pool.on('error', (err, client) => {
    logger.error('❌ Unexpected error on idle PostgreSQL client:', err);
    Sentry.captureException(err, {
      tags: {
        component: 'database',
        operation: 'pool_error',
        database: 'timeweb_postgresql'
      },
      extra: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount
      }
    });
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
      Sentry.captureException(err, {
        tags: {
          component: 'database',
          operation: 'connection_check',
          database: 'timeweb_postgresql',
          severity: 'fatal'
        },
        extra: {
          host: config.database.postgresHost,
          port: config.database.postgresPort,
          database: config.database.postgresDatabase
        }
      });
    } else {
      logger.info('✅ Connected to Timeweb PostgreSQL');
      logger.info('   Current time:', res.rows[0].current_time);
      logger.info('   PostgreSQL version:', res.rows[0].pg_version.split(',')[0]);
    }
  });

  // Graceful shutdown (только если pool создан)
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
} else {
  logger.info('ℹ️  PostgreSQL module loaded but not initialized (USE_LEGACY_SUPABASE=true)');
  logger.info('   Using Supabase instead. Set USE_LEGACY_SUPABASE=false to enable PostgreSQL.');
}

/**
 * Выполнить SQL запрос
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} - Результат запроса
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Set USE_LEGACY_SUPABASE=false to enable.');
  }

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
    Sentry.captureException(error, {
      tags: {
        component: 'database',
        operation: 'query',
        database: 'timeweb_postgresql'
      },
      extra: {
        query: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        duration: `${duration}ms`,
        params: params ? params.length : 0
      }
    });
    throw error;
  }
}

/**
 * Получить client из pool для транзакций
 * @returns {Promise<Object>} - PostgreSQL client
 */
async function getClient() {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Set USE_LEGACY_SUPABASE=false to enable.');
  }
  return await pool.connect();
}

/**
 * Выполнить запрос в транзакции
 * @param {Function} callback - Функция с запросами
 * @returns {Promise<any>} - Результат транзакции
 */
async function transaction(callback) {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Set USE_LEGACY_SUPABASE=false to enable.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    Sentry.captureException(error, {
      tags: {
        component: 'database',
        operation: 'transaction',
        database: 'timeweb_postgresql',
        transaction_status: 'rolled_back'
      },
      extra: {
        message: 'Transaction rolled back due to error'
      }
    });
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
  if (!pool) {
    return {
      enabled: false,
      message: 'PostgreSQL pool not initialized (USE_LEGACY_SUPABASE=true)',
    };
  }

  return {
    enabled: true,
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
  isEnabled: usePostgres,
};
