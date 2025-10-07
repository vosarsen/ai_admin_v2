/**
 * Database-backed Auth State for Baileys
 * Replacement for useMultiFileAuthState for production use
 *
 * Stores WhatsApp session data in PostgreSQL (Supabase):
 * - Credentials (creds.json) → whatsapp_auth table
 * - Keys (Signal Protocol, lid-mappings) → whatsapp_keys table
 */

const { initAuthCreds } = require('@whiskeysockets/baileys');
const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');

/**
 * Create database-backed auth state for Baileys
 *
 * @param {string} companyId - Company ID (e.g., '962302')
 * @returns {Promise<{state: {creds, keys}, saveCreds: Function}>}
 */
async function useSupabaseAuthState(companyId) {
  logger.info(`🔐 Initializing Supabase auth state for company ${companyId}`);

  // Validate company ID
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('Invalid company ID');
  }

  // =========================================================================
  // 1. Load or create credentials
  // =========================================================================

  let creds;

  try {
    const { data: authData, error: authError } = await supabase
      .from('whatsapp_auth')
      .select('creds')
      .eq('company_id', companyId)
      .maybeSingle();

    if (authError) {
      throw authError;
    }

    if (!authData || !authData.creds) {
      // No credentials found - create new
      logger.info(`📝 No existing credentials for ${companyId}, creating new`);
      creds = initAuthCreds();

      // Save initial credentials
      await saveCreds();
      logger.info(`✅ New credentials created for ${companyId}`);
    } else {
      // Load existing credentials
      creds = authData.creds;
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
        const { data, error } = await supabase
          .from('whatsapp_keys')
          .select('key_id, value')
          .eq('company_id', companyId)
          .eq('key_type', type)
          .in('key_id', ids);

        if (error) {
          logger.error(`Failed to get keys (${type}):`, error);
          throw error;
        }

        // Convert array to object: { key_id: value }
        const result = {};
        if (data) {
          data.forEach(row => {
            result[row.key_id] = row.value;
          });
        }

        logger.debug(`📖 Loaded ${Object.keys(result).length}/${ids.length} keys of type ${type}`);
        return result;
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

              // Set TTL for lid-mapping keys (7 days)
              if (type.includes('lid-mapping')) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 7); // 7 days TTL
                record.expires_at = expiryDate.toISOString();
              }

              recordsToUpsert.push(record);
            }
          }
        }

        // Execute deletions
        if (recordsToDelete.length > 0) {
          for (const { type, id } of recordsToDelete) {
            const { error } = await supabase
              .from('whatsapp_keys')
              .delete()
              .eq('company_id', companyId)
              .eq('key_type', type)
              .eq('key_id', id);

            if (error) {
              logger.error(`Failed to delete key ${type}/${id}:`, error);
            }
          }
          logger.debug(`🗑️  Deleted ${recordsToDelete.length} keys`);
        }

        // Execute upserts (batch)
        if (recordsToUpsert.length > 0) {
          // Supabase batch size limit: 1000 records
          const BATCH_SIZE = 100;

          for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
            const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

            const { error } = await supabase
              .from('whatsapp_keys')
              .upsert(batch, {
                onConflict: 'company_id,key_type,key_id',
                ignoreDuplicates: false
              });

            if (error) {
              logger.error(`Failed to upsert batch ${i}-${i + batch.length}:`, error);
              throw error;
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
      const { error } = await supabase
        .from('whatsapp_auth')
        .upsert({
          company_id: companyId,
          creds: creds,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id',
          ignoreDuplicates: false
        });

      if (error) {
        logger.error(`Failed to save credentials for ${companyId}:`, error);
        throw error;
      }

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
async function removeSupabaseAuthState(companyId) {
  logger.info(`🗑️  Removing auth state for company ${companyId}`);

  try {
    // Delete credentials
    const { error: authError } = await supabase
      .from('whatsapp_auth')
      .delete()
      .eq('company_id', companyId);

    if (authError) {
      logger.error(`Failed to delete auth for ${companyId}:`, authError);
    }

    // Delete all keys
    const { error: keysError } = await supabase
      .from('whatsapp_keys')
      .delete()
      .eq('company_id', companyId);

    if (keysError) {
      logger.error(`Failed to delete keys for ${companyId}:`, keysError);
    }

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
    const { data, error } = await supabase
      .rpc('get_whatsapp_auth_stats');

    if (error) {
      logger.error('Failed to get auth state stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Error getting auth state stats:', error);
    return null;
  }
}

module.exports = {
  useSupabaseAuthState,
  removeSupabaseAuthState,
  getAuthStateStats
};
