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

  // Validate company ID
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('Invalid company ID');
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

        // Execute upserts (batch)
        if (recordsToUpsert.length > 0) {
          // PostgreSQL batch size: process 100 at a time
          const BATCH_SIZE = 100;

          for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

            for (const record of batch) {
              await postgres.query(
                `INSERT INTO whatsapp_keys (company_id, key_type, key_id, value, updated_at, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (company_id, key_type, key_id) DO UPDATE SET
                   value = EXCLUDED.value,
                   updated_at = EXCLUDED.updated_at,
                   expires_at = EXCLUDED.expires_at`,
                [
                  record.company_id,
                  record.key_type,
                  record.key_id,
                  JSON.stringify(record.value),
                  record.updated_at,
                  record.expires_at
                ]
              );
            }
          }

          logger.debug(`💾 Upserted ${recordsToUpsert.length} keys`);
        }
      } catch (error) {
        logger.error('Error setting keys:', error);
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
    return null;
  }
}

module.exports = {
  useTimewebAuthState,
  removeTimewebAuthState,
  getAuthStateStats
};
