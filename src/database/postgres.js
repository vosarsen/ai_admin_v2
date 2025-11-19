// src/database/postgres.js
// Timeweb PostgreSQL connection pool

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');
const Sentry = require('@sentry/node');

// ====================================================================================
// Connection Pool Health Monitoring
// ====================================================================================

/**
 * In-memory connection pool metrics tracking
 * Stores snapshots every 10 seconds for trend analysis
 */
const poolMetrics = {
  snapshots: [], // Circular buffer of pool state snapshots
  maxSnapshots: 360, // 360 snapshots × 10s = 1 hour of history
  alertThresholds: {
    highUsage: parseFloat(process.env.DB_POOL_USAGE_THRESHOLD) || 0.8, // From env or default 80% connections in use
    highWaitQueue: 5, // 5+ queries waiting
  },
  alerts: {
    lastHighUsageAlert: 0,
    lastHighWaitQueueAlert: 0,
    alertCooldown: 5 * 60 * 1000, // 5 minutes between alerts
  }
};

/**
 * Record pool state snapshot for metrics
 */
function recordPoolSnapshot() {
  if (!pool) return;

  const snapshot = {
    timestamp: Date.now(),
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    active: pool.totalCount - pool.idleCount,
    maxConnections: MAX_CONNECTIONS_PER_SERVICE,
    usage: pool.totalCount / MAX_CONNECTIONS_PER_SERVICE
  };

  poolMetrics.snapshots.push(snapshot);

  // Trim to max size (circular buffer)
  if (poolMetrics.snapshots.length > poolMetrics.maxSnapshots) {
    poolMetrics.snapshots.shift();
  }

  return snapshot;
}

/**
 * Check pool health and send alerts if thresholds exceeded
 * @param {object} snapshot - Pool state snapshot
 */
function checkPoolHealthAlerts(snapshot) {
  if (!snapshot) return;

  const now = Date.now();

  // Alert: High connection usage (>80%)
  if (snapshot.usage > poolMetrics.alertThresholds.highUsage) {
    const timeSinceLastAlert = now - poolMetrics.alerts.lastHighUsageAlert;

    if (timeSinceLastAlert > poolMetrics.alerts.alertCooldown) {
      logger.warn(`🚨 Connection pool high usage: ${Math.round(snapshot.usage * 100)}%`, {
        total: snapshot.total,
        max: snapshot.maxConnections,
        idle: snapshot.idle,
        active: snapshot.active,
        waiting: snapshot.waiting
      });

      Sentry.captureMessage('Connection pool high usage detected', {
        level: 'warning',
        tags: {
          component: 'database',
          category: 'performance',
          pool_status: 'high_usage'
        },
        extra: {
          usage: `${Math.round(snapshot.usage * 100)}%`,
          threshold: `${poolMetrics.alertThresholds.highUsage * 100}%`,
          total: snapshot.total,
          max: snapshot.maxConnections,
          idle: snapshot.idle,
          active: snapshot.active,
          waiting: snapshot.waiting
        }
      });

      poolMetrics.alerts.lastHighUsageAlert = now;
    }
  }

  // Alert: High wait queue (>5 queries waiting)
  if (snapshot.waiting > poolMetrics.alertThresholds.highWaitQueue) {
    const timeSinceLastAlert = now - poolMetrics.alerts.lastHighWaitQueueAlert;

    if (timeSinceLastAlert > poolMetrics.alerts.alertCooldown) {
      logger.error(`🚨 Connection pool wait queue critical: ${snapshot.waiting} queries waiting`, {
        waiting: snapshot.waiting,
        threshold: poolMetrics.alertThresholds.highWaitQueue,
        total: snapshot.total,
        max: snapshot.maxConnections,
        idle: snapshot.idle
      });

      Sentry.captureMessage('Connection pool wait queue critical', {
        level: 'error',
        tags: {
          component: 'database',
          category: 'performance',
          pool_status: 'wait_queue_critical',
          alert_type: 'telegram'
        },
        extra: {
          waiting: snapshot.waiting,
          threshold: poolMetrics.alertThresholds.highWaitQueue,
          total: snapshot.total,
          max: snapshot.maxConnections,
          idle: snapshot.idle,
          message: 'Database connections exhausted - queries are queued'
        }
      });

      poolMetrics.alerts.lastHighWaitQueueAlert = now;
    }
  }
}

/**
 * Get comprehensive pool metrics for dashboard
 *
 * @returns {object} Pool metrics with current state and historical trends
 */
function getPoolMetrics() {
  if (!pool) {
    return {
      enabled: false,
      message: 'PostgreSQL pool not initialized (USE_LEGACY_SUPABASE=true)'
    };
  }

  const currentSnapshot = {
    timestamp: Date.now(),
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    active: pool.totalCount - pool.idleCount,
    maxConnections: MAX_CONNECTIONS_PER_SERVICE,
    usage: pool.totalCount / MAX_CONNECTIONS_PER_SERVICE
  };

  // Calculate averages from snapshots
  const avgStats = poolMetrics.snapshots.length > 0 ? {
    avgTotal: (poolMetrics.snapshots.reduce((sum, s) => sum + s.total, 0) / poolMetrics.snapshots.length).toFixed(2),
    avgIdle: (poolMetrics.snapshots.reduce((sum, s) => sum + s.idle, 0) / poolMetrics.snapshots.length).toFixed(2),
    avgActive: (poolMetrics.snapshots.reduce((sum, s) => sum + s.active, 0) / poolMetrics.snapshots.length).toFixed(2),
    avgWaiting: (poolMetrics.snapshots.reduce((sum, s) => sum + s.waiting, 0) / poolMetrics.snapshots.length).toFixed(2),
    avgUsage: (poolMetrics.snapshots.reduce((sum, s) => sum + s.usage, 0) / poolMetrics.snapshots.length * 100).toFixed(2) + '%'
  } : null;

  // Peak values
  const peakStats = poolMetrics.snapshots.length > 0 ? {
    peakTotal: Math.max(...poolMetrics.snapshots.map(s => s.total)),
    peakWaiting: Math.max(...poolMetrics.snapshots.map(s => s.waiting)),
    peakUsage: (Math.max(...poolMetrics.snapshots.map(s => s.usage)) * 100).toFixed(2) + '%'
  } : null;

  // Health status
  let healthStatus = 'healthy';
  let healthMessage = 'Connection pool operating normally';

  if (currentSnapshot.waiting > poolMetrics.alertThresholds.highWaitQueue) {
    healthStatus = 'critical';
    healthMessage = `${currentSnapshot.waiting} queries waiting - pool exhausted`;
  } else if (currentSnapshot.usage > poolMetrics.alertThresholds.highUsage) {
    healthStatus = 'warning';
    healthMessage = `${Math.round(currentSnapshot.usage * 100)}% connections in use`;
  }

  return {
    enabled: true,
    healthStatus,
    healthMessage,
    current: {
      total: currentSnapshot.total,
      idle: currentSnapshot.idle,
      active: currentSnapshot.active,
      waiting: currentSnapshot.waiting,
      maxConnections: currentSnapshot.maxConnections,
      usage: `${Math.round(currentSnapshot.usage * 100)}%`
    },
    averages: avgStats,
    peaks: peakStats,
    thresholds: {
      highUsage: `${poolMetrics.alertThresholds.highUsage * 100}%`,
      highWaitQueue: poolMetrics.alertThresholds.highWaitQueue
    },
    history: {
      snapshotCount: poolMetrics.snapshots.length,
      maxSnapshots: poolMetrics.maxSnapshots,
      coveragePeriod: `${poolMetrics.maxSnapshots * 10 / 60} minutes`,
      recentSnapshots: poolMetrics.snapshots.slice(-10).map(s => ({
        timestamp: new Date(s.timestamp).toISOString(),
        total: s.total,
        idle: s.idle,
        active: s.active,
        waiting: s.waiting,
        usage: `${Math.round(s.usage * 100)}%`
      }))
    },
    timestamp: new Date().toISOString()
  };
}

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
    // Record snapshot and check for alerts on each connection acquisition
    const snapshot = recordPoolSnapshot();
    checkPoolHealthAlerts(snapshot);
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

      // Start periodic pool health monitoring (every 10 seconds)
      const monitoringInterval = setInterval(() => {
        const snapshot = recordPoolSnapshot();
        checkPoolHealthAlerts(snapshot);
      }, 10000); // 10 seconds

      // Clean up monitoring on shutdown
      process.on('SIGINT', () => {
        clearInterval(monitoringInterval);
      });
      process.on('SIGTERM', () => {
        clearInterval(monitoringInterval);
      });

      logger.info('🔍 Connection pool monitoring started (10s intervals)');
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
  getPoolStats, // Legacy function (basic stats)
  getPoolMetrics, // New comprehensive metrics for dashboard
  isEnabled: usePostgres,
};
