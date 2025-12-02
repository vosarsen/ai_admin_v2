/**
 * Database-backed Auth State for Baileys (Timeweb PostgreSQL)
 * Replacement for useMultiFileAuthState for production use
 *
 * Stores WhatsApp session data in Timeweb PostgreSQL:
 * - Credentials (creds.json) → whatsapp_auth table
 * - Keys (Signal Protocol, lid-mappings) → whatsapp_keys table
 */

const { initAuthCreds } = require('@whiskeysockets/baileys');
const postgres = require('../../database/postgres');
const logger = require('../../utils/logger');
const Sentry = require('@sentry/node');

// ====================================================================================
// Query Latency Tracking
// ====================================================================================

/**
 * In-memory circular buffer for query latency metrics
 * Stores last 1000 queries with timestamp and duration
 */
const queryMetrics = {
  buffer: [],
  maxSize: 1000,
  slowQueryThreshold: parseInt(process.env.DB_QUERY_LATENCY_THRESHOLD_MS) || 500, // From env or default 500ms
  slowQueryWindow: 5 * 60 * 1000, // 5 minutes
  slowQueryCount: 0,
  lastSlowQueryAlert: 0
};

/**
 * Calculate percentile from sorted array
 * @param {number[]} sortedArray - Sorted array of numbers
 * @param {number} percentile - Percentile (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Retry query with exponential backoff
 * Handles transient PostgreSQL failures (network issues, temporary unavailability)
 *
 * @param {Function} queryFn - Async function that executes the query
 * @param {number} maxAttempts - Maximum retry attempts (default: 3)
 * @returns {Promise<any>} Query result
 */
async function retryWithBackoff(queryFn, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;

      // Don't retry on non-transient errors
      const isTransientError =
        error.code === 'ENOTFOUND' ||    // DNS failure
        error.code === 'ECONNREFUSED' ||  // Connection refused
        error.code === 'ETIMEDOUT' ||     // Timeout
        error.code === 'ECONNRESET' ||    // Connection reset
        error.code === '08006' ||         // PostgreSQL connection failure
        error.code === '08003' ||         // Connection does not exist
        error.code === '57P03';           // Cannot connect now

      if (!isTransientError || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt - 1);
      logger.warn(`⚠️ Query failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wrapper for postgres.query() with latency tracking and retry logic
 *
 * Features:
 * - Retry with exponential backoff (3 attempts: 100ms, 200ms, 400ms)
 * - Logs execution time for all queries
 * - Sentry alerts for slow queries (>500ms)
 * - Telegram alerts for repeated slow queries (3+ in 5 min)
 * - In-memory metrics for P50/P95/P99 calculation
 * - No performance impact on fast queries (<1ms overhead)
 *
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<any>} Query result
 */
async function queryWithMetrics(sql, params = []) {
  const startTime = Date.now();
  const queryPreview = sql.trim().substring(0, 100).replace(/\s+/g, ' ');

  try {
    // Execute query with retry logic for transient failures
    const result = await retryWithBackoff(async () => {
      return await postgres.query(sql, params);
    });
    const duration = Date.now() - startTime;

    // Store metrics (circular buffer)
    queryMetrics.buffer.push({
      sql: queryPreview,
      duration,
      timestamp: startTime,
      success: true,
      rowCount: result.rowCount || result.rows?.length || 0
    });

    // Trim buffer to max size (keep only recent queries)
    if (queryMetrics.buffer.length > queryMetrics.maxSize) {
      queryMetrics.buffer.shift();
    }

    // Log all queries (debug level for fast, info for slow)
    if (duration > queryMetrics.slowQueryThreshold) {
      logger.warn(`🐌 Slow query (${duration}ms): ${queryPreview}`, {
        duration,
        rowCount: result.rowCount || result.rows?.length || 0,
        threshold: queryMetrics.slowQueryThreshold
      });
    } else {
      logger.debug(`⚡ Query completed (${duration}ms): ${queryPreview}`, {
        duration,
        rowCount: result.rowCount || result.rows?.length || 0
      });
    }

    // Alert on slow queries
    if (duration > queryMetrics.slowQueryThreshold) {
      // Sentry warning for single slow query
      Sentry.captureMessage('Slow database query detected', {
        level: 'warning',
        tags: {
          component: 'baileys_auth',
          category: 'performance'
        },
        extra: {
          sql: queryPreview,
          duration,
          threshold: queryMetrics.slowQueryThreshold,
          rowCount: result.rowCount || result.rows?.length || 0
        }
      });

      // Track slow query count for Telegram alerting
      queryMetrics.slowQueryCount++;

      // Telegram alert for repeated slow queries (3+ in 5 minutes)
      const now = Date.now();
      const timeSinceLastAlert = now - queryMetrics.lastSlowQueryAlert;

      if (
        queryMetrics.slowQueryCount >= 3 &&
        timeSinceLastAlert > queryMetrics.slowQueryWindow
      ) {
        Sentry.captureMessage('Repeated slow queries detected', {
          level: 'error',
          tags: {
            component: 'baileys_auth',
            category: 'performance',
            alert_type: 'telegram'
          },
          extra: {
            slowQueryCount: queryMetrics.slowQueryCount,
            windowMinutes: queryMetrics.slowQueryWindow / 60000,
            threshold: queryMetrics.slowQueryThreshold,
            recentQuery: queryPreview,
            recentDuration: duration
          }
        });

        // Reset counter and alert timestamp
        queryMetrics.slowQueryCount = 0;
        queryMetrics.lastSlowQueryAlert = now;

        logger.error(
          `🚨 ALERT: ${queryMetrics.slowQueryCount} slow queries in ${queryMetrics.slowQueryWindow / 60000} minutes`
        );
      }
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Store error metrics
    queryMetrics.buffer.push({
      sql: queryPreview,
      duration,
      timestamp: startTime,
      success: false,
      error: error.message
    });

    // Trim buffer
    if (queryMetrics.buffer.length > queryMetrics.maxSize) {
      queryMetrics.buffer.shift();
    }

    // Log error with duration
    logger.error(`❌ Query failed after ${duration}ms: ${queryPreview}`, {
      duration,
      error: error.message,
      stack: error.stack
    });

    // Sentry error tracking
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        category: 'database'
      },
      extra: {
        sql: queryPreview,
        duration,
        params: params?.length || 0
      }
    });

    throw error;
  }
}

/**
 * Get query latency metrics for dashboard
 *
 * Returns:
 * - P50, P95, P99 latency percentiles
 * - Total queries count
 * - Success/error ratio
 * - Slow query count
 * - Recent queries (last 10)
 *
 * @returns {object} Metrics object
 */
function getQueryMetrics() {
  const successQueries = queryMetrics.buffer.filter(q => q.success);
  const errorQueries = queryMetrics.buffer.filter(q => !q.success);

  // Calculate percentiles from successful queries
  const durations = successQueries.map(q => q.duration).sort((a, b) => a - b);

  const p50 = calculatePercentile(durations, 50);
  const p95 = calculatePercentile(durations, 95);
  const p99 = calculatePercentile(durations, 99);

  // Recent slow queries
  const slowQueries = queryMetrics.buffer
    .filter(q => q.duration > queryMetrics.slowQueryThreshold)
    .slice(-10);

  // Recent errors
  const recentErrors = errorQueries.slice(-10);

  return {
    total: queryMetrics.buffer.length,
    success: successQueries.length,
    errors: errorQueries.length,
    successRate: queryMetrics.buffer.length > 0
      ? (successQueries.length / queryMetrics.buffer.length * 100).toFixed(2)
      : 100,
    latency: {
      p50,
      p95,
      p99,
      avg: durations.length > 0
        ? (durations.reduce((sum, d) => sum + d, 0) / durations.length).toFixed(2)
        : 0
    },
    slowQueries: {
      count: slowQueries.length,
      threshold: queryMetrics.slowQueryThreshold,
      recent: slowQueries.map(q => ({
        sql: q.sql,
        duration: q.duration,
        timestamp: new Date(q.timestamp).toISOString(),
        rowCount: q.rowCount
      }))
    },
    recentErrors: recentErrors.map(q => ({
      sql: q.sql,
      duration: q.duration,
      timestamp: new Date(q.timestamp).toISOString(),
      error: q.error
    })),
    config: {
      bufferSize: queryMetrics.maxSize,
      slowQueryThreshold: queryMetrics.slowQueryThreshold,
      alertWindow: queryMetrics.slowQueryWindow / 60000 + ' minutes'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Recursively revive Buffer objects from JSON/JSONB serialization
 * Buffer can be serialized in two formats:
 * 1. PostgreSQL JSONB: {type: 'Buffer', data: [1,2,3,...]}  (array of bytes)
 * 2. JSON.stringify:   {type: 'Buffer', data: "base64=="}   (base64 string)
 * This function converts them back to actual Buffer objects
 *
 * @param {any} obj - Object to process
 * @returns {any} Object with revived Buffers
 */
function reviveBuffers(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Check if this is a serialized Buffer object
  if (obj.type === 'Buffer' && obj.data !== undefined) {
    // Handle array format: {type: 'Buffer', data: [1,2,3]}
    if (Array.isArray(obj.data)) {
      return Buffer.from(obj.data);
    }
    // Handle base64 string format: {type: 'Buffer', data: "base64=="}
    if (typeof obj.data === 'string') {
      return Buffer.from(obj.data, 'base64');
    }
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map(reviveBuffers);
  }

  // Recursively process plain objects
  const revived = {};
  for (const [key, value] of Object.entries(obj)) {
    revived[key] = reviveBuffers(value);
  }
  return revived;
}

/**
 * Create database-backed auth state for Baileys (Timeweb PostgreSQL)
 *
 * @param {string} companyId - Company ID (e.g., '962302')
 * @param {Object} options - Options { sessionPool: WhatsAppSessionPool }
 * @returns {Promise<{state: {creds, keys}, saveCreds: Function}>}
 */
async function useTimewebAuthState(companyId, options = {}) {
  logger.info(`🔐 Initializing Timeweb PostgreSQL auth state for company ${companyId}`);

  // Extract sessionPool for cache support (Phase 2 - Task 3.1)
  const { sessionPool } = options;

  // Validate company ID (defense-in-depth)
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('Invalid company ID: must be a non-empty string');
  }

  // Sanitize company ID to prevent SQL injection (though parameterized queries already protect us)
  const sanitizedId = String(companyId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId.length === 0 || sanitizedId.length > 50 || sanitizedId !== companyId) {
    throw new Error(`Invalid company ID format: ${companyId}. Only alphanumeric, underscore, and hyphen allowed (max 50 chars).`);
  }

  // =========================================================================
  // 1. Load or create credentials
  // =========================================================================

  let creds;
  let usingCache = false; // Track if we're using cached credentials (Phase 2 - Task 3.1)

  try {
    const result = await queryWithMetrics(
      'SELECT creds FROM whatsapp_auth WHERE company_id = $1',
      [companyId]
    );

    const authData = result.rows[0] || null;

    if (!authData || !authData.creds) {
      // No credentials found - create new
      logger.info(`📝 No existing credentials for ${companyId}, creating new`);
      creds = initAuthCreds();

      // Save initial credentials
      await saveCreds();
      logger.info(`✅ New credentials created for ${companyId}`);
    } else {
      // Load existing credentials and revive Buffer objects
      creds = reviveBuffers(authData.creds);
      logger.info(`✅ Loaded existing credentials for ${companyId}`);

      // Update cache after successful load (Phase 2 - Task 3.1)
      // Note: We'll update with full keys after creating the keys interface
      if (sessionPool) {
        sessionPool.setCachedCredentials(companyId, creds, {});
        logger.debug(`💾 Updated credentials cache for ${companyId}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to load credentials for ${companyId}:`, error);

    // Phase 2 - Task 3.1: Fallback to cache during PostgreSQL outages
    if (sessionPool) {
      const cached = sessionPool.getCachedCredentials(companyId);

      if (cached && cached.creds) {
        const cacheAge = Math.round((Date.now() - (cached._timestamp || 0)) / 1000);
        logger.warn(`⚠️ PostgreSQL unavailable, using cached credentials for ${companyId} (age: ${cacheAge}s)`);

        creds = cached.creds;
        usingCache = true; // Mark that we're using cache

        // Alert via Sentry (warning level - not critical)
        Sentry.captureMessage('Using cached credentials due to PostgreSQL failure', {
          level: 'warning',
          tags: {
            component: 'baileys_auth',
            operation: 'load_credentials_from_cache',
            company_id: companyId,
            fallback: 'cache'
          },
          extra: {
            cacheAge,
            originalError: error.message,
            postgresError: error.code || 'unknown'
          }
        });

        // Continue with cached credentials (don't throw)
      } else {
        // No cache available - this is critical
        logger.error(`❌ No cached credentials available for ${companyId} - cannot continue`);
        Sentry.captureException(error, {
          tags: {
            component: 'baileys_auth',
            operation: 'load_credentials',
            company_id: companyId,
            cache_available: 'false'
          },
          extra: {
            message: 'PostgreSQL failed and no cache available'
          }
        });
        throw error;
      }
    } else {
      // No sessionPool provided - cannot use cache
      Sentry.captureException(error, {
        tags: {
          component: 'baileys_auth',
          operation: 'load_credentials',
          company_id: companyId
        }
      });
      throw error;
    }
  }

  // =========================================================================
  // 2. Implement keys interface
  // =========================================================================

  const keys = {
    /**
     * Get keys by type and IDs
     * @param {string} type - Key type (e.g., 'app-state-sync-key', 'session')
     * @param {string[]} ids - Array of key IDs
     * @returns {Promise<Object>} Object mapping key_id -> value
     */
    async get(type, ids) {
      if (!type || !Array.isArray(ids) || ids.length === 0) {
        return {};
      }

      try {
        const result = await queryWithMetrics(
          'SELECT key_id, value FROM whatsapp_keys WHERE company_id = $1 AND key_type = $2 AND key_id = ANY($3)',
          [companyId, type, ids]
        );

        const data = result.rows;

        // Convert array to object: { key_id: value }
        // Also revive Buffer objects from JSONB serialization
        const keyResult = {};
        if (data) {
          data.forEach(row => {
            keyResult[row.key_id] = reviveBuffers(row.value);
          });
        }

        logger.debug(`📖 Loaded ${Object.keys(keyResult).length}/${ids.length} keys of type ${type}`);
        return keyResult;
      } catch (error) {
        logger.error(`Error getting keys (${type}):`, error);
        Sentry.captureException(error, {
          tags: {
            component: 'baileys_auth',
            operation: 'get_keys',
            key_type: type,
            company_id: companyId
          },
          extra: {
            keyCount: ids.length
          }
        });
        return {};
      }
    },

    /**
     * Set (upsert) or delete keys
     * @param {Object} data - Object mapping type -> { key_id: value }
     *                        Set value to null to delete
     */
    async set(data) {
      if (!data || typeof data !== 'object') {
        return;
      }

      try {
        const recordsToUpsert = [];
        const recordsToDelete = [];

        // Process each key type
        for (const [type, keys] of Object.entries(data)) {
          if (!keys || typeof keys !== 'object') continue;

          // Process each key
          for (const [id, value] of Object.entries(keys)) {
            if (value === null || value === undefined) {
              // Delete this key
              recordsToDelete.push({ type, id });
            } else {
              // Upsert this key
              const record = {
                company_id: companyId,
                key_type: type,
                key_id: id,
                value: value,
                updated_at: new Date().toISOString()
              };

              // Set TTL based on key type
              const expiryDate = new Date();

              if (type.includes('lid-mapping')) {
                // LID mappings: 7 days (user identity mappings)
                expiryDate.setDate(expiryDate.getDate() + 7);
                record.expires_at = expiryDate.toISOString();
              } else if (type === 'pre-key') {
                // Pre-keys: 7 days (refreshed frequently by WhatsApp)
                expiryDate.setDate(expiryDate.getDate() + 7);
                record.expires_at = expiryDate.toISOString();
              } else if (type === 'session') {
                // Session keys: 7 days (active conversations)
                expiryDate.setDate(expiryDate.getDate() + 7);
                record.expires_at = expiryDate.toISOString();
              } else if (type === 'sender-key') {
                // Sender keys: 7 days (group message encryption)
                expiryDate.setDate(expiryDate.getDate() + 7);
                record.expires_at = expiryDate.toISOString();
              } else {
                // All other keys (app, lid, pre): 14 days default
                expiryDate.setDate(expiryDate.getDate() + 14);
                record.expires_at = expiryDate.toISOString();
              }

              recordsToUpsert.push(record);
            }
          }
        }

        // Execute deletions
        if (recordsToDelete.length > 0) {
          for (const { type, id } of recordsToDelete) {
            await queryWithMetrics(
              'DELETE FROM whatsapp_keys WHERE company_id = $1 AND key_type = $2 AND key_id = $3',
              [companyId, type, id]
            );
          }
          logger.debug(`🗑️  Deleted ${recordsToDelete.length} keys`);
        }

        // Execute upserts (optimized batch INSERT)
        if (recordsToUpsert.length > 0) {
          // PostgreSQL batch size: process 100 at a time to avoid query size limits
          const BATCH_SIZE = 100;

          for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

            // Build multi-row INSERT for better performance
            // Instead of 100 queries, we do 1 query with 100 rows
            const values = [];
            const params = [];
            let paramIndex = 1;

            for (const record of batch) {
              // Create placeholders for this row: ($1, $2, $3, $4, $5, $6)
              const placeholders = [];
              for (let j = 0; j < 6; j++) {
                placeholders.push(`$${paramIndex++}`);
              }
              values.push(`(${placeholders.join(', ')})`);

              // Add parameters for this row
              params.push(
                record.company_id,
                record.key_type,
                record.key_id,
                JSON.stringify(record.value),
                record.updated_at,
                record.expires_at
              );
            }

            // Execute single multi-row INSERT instead of N individual INSERTs
            await queryWithMetrics(
              `INSERT INTO whatsapp_keys (company_id, key_type, key_id, value, updated_at, expires_at)
               VALUES ${values.join(', ')}
               ON CONFLICT (company_id, key_type, key_id) DO UPDATE SET
                 value = EXCLUDED.value,
                 updated_at = EXCLUDED.updated_at,
                 expires_at = EXCLUDED.expires_at`,
              params
            );
          }

          logger.debug(`💾 Upserted ${recordsToUpsert.length} keys (optimized batch)`);
        }
      } catch (error) {
        logger.error('Error setting keys:', error);
        Sentry.captureException(error, {
          tags: {
            component: 'baileys_auth',
            operation: 'set_keys',
            company_id: companyId
          },
          extra: {
            upsertCount: recordsToUpsert.length,
            deleteCount: recordsToDelete.length
          }
        });
        throw error;
      }
    }
  };

  // =========================================================================
  // 3. Save credentials function
  // =========================================================================

  async function saveCreds() {
    // Phase 2 - Task 3.1: Don't save to PostgreSQL while using cache
    // This prevents data inconsistency during outages
    if (usingCache) {
      logger.warn(`⚠️ Skipping credentials save to PostgreSQL for ${companyId} (using cache mode)`);
      return;
    }

    try {
      await queryWithMetrics(
        `INSERT INTO whatsapp_auth (company_id, creds, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id) DO UPDATE SET
           creds = EXCLUDED.creds,
           updated_at = EXCLUDED.updated_at`,
        [companyId, JSON.stringify(creds), new Date().toISOString()]
      );

      logger.debug(`💾 Credentials saved for ${companyId}`);

      // Update cache after successful save (Phase 2 - Task 3.1)
      if (sessionPool) {
        sessionPool.setCachedCredentials(companyId, creds, {});
        logger.debug(`💾 Updated credentials cache after save for ${companyId}`);
      }
    } catch (error) {
      logger.error(`Error saving credentials for ${companyId}:`, error);
      Sentry.captureException(error, {
        tags: {
          component: 'baileys_auth',
          operation: 'save_credentials',
          company_id: companyId
        }
      });
      // Don't throw - allow WhatsApp to continue with in-memory credentials
      // Next save will retry
    }
  }

  // =========================================================================
  // 4. Return state object (compatible with Baileys)
  // =========================================================================

  return {
    state: { creds, keys },
    saveCreds
  };
}

/**
 * Remove auth state for a company (cleanup)
 * @param {string} companyId
 */
async function removeTimewebAuthState(companyId) {
  logger.info(`🗑️  Removing auth state for company ${companyId}`);

  try {
    // Delete credentials
    await queryWithMetrics(
      'DELETE FROM whatsapp_auth WHERE company_id = $1',
      [companyId]
    );

    // Delete all keys
    await queryWithMetrics(
      'DELETE FROM whatsapp_keys WHERE company_id = $1',
      [companyId]
    );

    logger.info(`✅ Auth state removed for ${companyId}`);
  } catch (error) {
    logger.error(`Error removing auth state for ${companyId}:`, error);
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        operation: 'remove_auth_state',
        company_id: companyId
      }
    });
    throw error;
  }
}

/**
 * Get statistics about auth state storage
 */
async function getAuthStateStats() {
  try {
    // Optimized: Single query with JOINs instead of 4 subqueries
    // This reduces network roundtrips to remote Timeweb PostgreSQL
    const result = await queryWithMetrics(`
      SELECT
        a.total_companies,
        a.total_auth_records,
        k.total_keys,
        k.expired_keys
      FROM
        (SELECT COUNT(DISTINCT company_id) as total_companies, COUNT(*) as total_auth_records FROM whatsapp_auth) a,
        (SELECT COUNT(*) as total_keys, COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_keys FROM whatsapp_keys) k
    `);

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting auth state stats:', error);
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        operation: 'get_stats'
      }
    });
    return null;
  }
}

/**
 * Get key age distribution for dashboard
 * Shows how many keys are in each age bucket
 *
 * @returns {Promise<object>} Age distribution stats
 */
async function getKeyAgeDistribution() {
  try {
    const result = await queryWithMetrics(`
      SELECT
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '1 day') as last_1_day,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days' AND updated_at < NOW() - INTERVAL '1 day') as last_7_days,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days' AND updated_at < NOW() - INTERVAL '7 days') as last_14_days,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 days' AND updated_at < NOW() - INTERVAL '14 days') as last_30_days,
        COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '30 days') as older_than_30_days,
        COUNT(*) as total_keys
      FROM whatsapp_keys
    `);

    return result.rows[0];
  } catch (error) {
    logger.error('Error getting key age distribution:', error);
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        operation: 'get_key_age_distribution'
      }
    });
    return null;
  }
}

/**
 * Expired keys monitoring state
 */
const expiredKeysMonitoring = {
  lastCheckTime: 0,
  lastExpiredCount: 0,
  lastAlertTime: 0,
  alertCooldown: 30 * 60 * 1000, // 30 minutes between alerts
  thresholds: {
    healthy: 100,
    warning: 100,
    critical: 500
  }
};

/**
 * Check session health and return status with thresholds
 *
 * Health levels:
 * - healthy: <100 expired keys
 * - warning: 100-500 expired keys
 * - critical: >500 expired keys
 *
 * @param {boolean} sendAlerts - Whether to send Sentry alerts (default: false)
 * @returns {Promise<{status: string, auth_records: number, total_keys: number, expired_keys: number, threshold: object}>}
 */
async function checkSessionHealth(sendAlerts = false) {
  try {
    const stats = await getAuthStateStats();

    if (!stats) {
      return {
        status: 'error',
        message: 'Failed to retrieve stats',
        auth_records: 0,
        total_keys: 0,
        expired_keys: 0
      };
    }

    const expiredKeys = parseInt(stats.expired_keys) || 0;

    // Update monitoring state
    expiredKeysMonitoring.lastCheckTime = Date.now();
    expiredKeysMonitoring.lastExpiredCount = expiredKeys;

    // Define health status based on expired keys
    let status = 'healthy';
    let message = 'Session health is good';
    let alertLevel = null;

    if (expiredKeys >= expiredKeysMonitoring.thresholds.critical) {
      status = 'critical';
      message = `${expiredKeys} expired keys - cleanup needed urgently`;
      alertLevel = 'error';
    } else if (expiredKeys >= expiredKeysMonitoring.thresholds.warning) {
      status = 'warning';
      message = `${expiredKeys} expired keys - consider cleanup`;
      alertLevel = 'warning';
    }

    // Send alerts if enabled and threshold exceeded
    if (sendAlerts && alertLevel) {
      const now = Date.now();
      const timeSinceLastAlert = now - expiredKeysMonitoring.lastAlertTime;

      if (timeSinceLastAlert > expiredKeysMonitoring.alertCooldown) {
        logger.warn(`🚨 Expired session keys ${status}:`, {
          expired_keys: expiredKeys,
          total_keys: stats.total_keys,
          threshold: status === 'critical'
            ? expiredKeysMonitoring.thresholds.critical
            : expiredKeysMonitoring.thresholds.warning
        });

        // Get age distribution for alert context
        const ageDistribution = await getKeyAgeDistribution();

        Sentry.captureMessage(`Expired session keys ${status}`, {
          level: alertLevel,
          tags: {
            component: 'baileys_auth',
            category: 'maintenance',
            session_health: status,
            alert_type: status === 'critical' ? 'telegram' : undefined
          },
          extra: {
            expired_keys: expiredKeys,
            total_keys: stats.total_keys,
            threshold: status === 'critical'
              ? expiredKeysMonitoring.thresholds.critical
              : expiredKeysMonitoring.thresholds.warning,
            percentage: ((expiredKeys / stats.total_keys) * 100).toFixed(2) + '%',
            age_distribution: ageDistribution,
            recommendation: status === 'critical'
              ? 'Run cleanup immediately: node scripts/cleanup/cleanup-expired-session-keys.js'
              : 'Schedule cleanup soon'
          }
        });

        expiredKeysMonitoring.lastAlertTime = now;
      }
    }

    return {
      status,
      message,
      auth_records: parseInt(stats.total_auth_records) || 0,
      total_keys: parseInt(stats.total_keys) || 0,
      expired_keys: expiredKeys,
      thresholds: {
        healthy: `< ${expiredKeysMonitoring.thresholds.healthy} expired keys`,
        warning: `${expiredKeysMonitoring.thresholds.warning}-${expiredKeysMonitoring.thresholds.critical - 1} expired keys`,
        critical: `≥ ${expiredKeysMonitoring.thresholds.critical} expired keys`
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error checking session health:', error);
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        operation: 'check_session_health'
      }
    });

    return {
      status: 'error',
      message: error.message,
      auth_records: 0,
      total_keys: 0,
      expired_keys: 0
    };
  }
}

/**
 * Start periodic expired keys monitoring
 * Checks every 5 minutes and sends alerts if thresholds exceeded
 */
function startExpiredKeysMonitoring() {
  // Initial check
  checkSessionHealth(true).catch(err => {
    logger.error('Initial expired keys check failed:', err);
  });

  // Periodic checks every 5 minutes
  const monitoringInterval = setInterval(async () => {
    try {
      await checkSessionHealth(true);
    } catch (error) {
      logger.error('Periodic expired keys check failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  logger.info('🔍 Expired session keys monitoring started (5min intervals)');

  // Clean up on shutdown
  process.on('SIGINT', () => {
    clearInterval(monitoringInterval);
  });
  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
  });

  return monitoringInterval;
}

module.exports = {
  useTimewebAuthState,
  removeTimewebAuthState,
  getAuthStateStats,
  checkSessionHealth,
  getQueryMetrics,
  getKeyAgeDistribution,
  startExpiredKeysMonitoring
};

// Auto-start expired keys monitoring on module load (if in production)
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_MONITORING === 'true') {
  // Delay startup by 5 seconds to ensure database is ready
  setTimeout(() => {
    startExpiredKeysMonitoring();
  }, 5000);
}
