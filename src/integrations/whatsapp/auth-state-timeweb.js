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
 * @returns {Promise<{state: {creds, keys}, saveCreds: Function}>}
 */
async function useTimewebAuthState(companyId) {
  logger.info(`🔐 Initializing Timeweb PostgreSQL auth state for company ${companyId}`);

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

  try {
    const result = await postgres.query(
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
    }
  } catch (error) {
    logger.error(`Failed to load credentials for ${companyId}:`, error);
    Sentry.captureException(error, {
      tags: {
        component: 'baileys_auth',
        operation: 'load_credentials',
        company_id: companyId
      }
    });
    throw error;
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
        const result = await postgres.query(
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
            await postgres.query(
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
            await postgres.query(
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
    try {
      await postgres.query(
        `INSERT INTO whatsapp_auth (company_id, creds, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id) DO UPDATE SET
           creds = EXCLUDED.creds,
           updated_at = EXCLUDED.updated_at`,
        [companyId, JSON.stringify(creds), new Date().toISOString()]
      );

      logger.debug(`💾 Credentials saved for ${companyId}`);
    } catch (error) {
      logger.error(`Error saving credentials for ${companyId}:`, error);
      Sentry.captureException(error, {
        tags: {
          component: 'baileys_auth',
          operation: 'save_credentials',
          company_id: companyId
        }
      });
      throw error;
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
    await postgres.query(
      'DELETE FROM whatsapp_auth WHERE company_id = $1',
      [companyId]
    );

    // Delete all keys
    await postgres.query(
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
    const result = await postgres.query(`
      SELECT
        COUNT(DISTINCT company_id) as total_companies,
        (SELECT COUNT(*) FROM whatsapp_auth) as total_auth_records,
        (SELECT COUNT(*) FROM whatsapp_keys) as total_keys,
        (SELECT COUNT(*) FROM whatsapp_keys WHERE expires_at < NOW()) as expired_keys
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
 * Check session health and return status with thresholds
 *
 * Health levels:
 * - healthy: <100 expired keys
 * - warning: 100-500 expired keys
 * - critical: >500 expired keys
 *
 * @returns {Promise<{status: string, auth_records: number, total_keys: number, expired_keys: number, threshold: object}>}
 */
async function checkSessionHealth() {
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

    // Define health status based on expired keys
    let status = 'healthy';
    let message = 'Session health is good';

    if (expiredKeys >= 500) {
      status = 'critical';
      message = `${expiredKeys} expired keys - cleanup needed urgently`;
    } else if (expiredKeys >= 100) {
      status = 'warning';
      message = `${expiredKeys} expired keys - consider cleanup`;
    }

    return {
      status,
      message,
      auth_records: parseInt(stats.total_auth_records) || 0,
      total_keys: parseInt(stats.total_keys) || 0,
      expired_keys: expiredKeys,
      thresholds: {
        healthy: '< 100 expired keys',
        warning: '100-500 expired keys',
        critical: '> 500 expired keys'
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

module.exports = {
  useTimewebAuthState,
  removeTimewebAuthState,
  getAuthStateStats,
  checkSessionHealth
};
