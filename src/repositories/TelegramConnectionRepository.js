/**
 * TelegramConnectionRepository - Telegram Business Bot connections data access layer
 *
 * Manages Telegram Business Bot connections for salon accounts:
 * - findByCompanyId → get connection for a company
 * - findByBusinessConnectionId → get connection by Telegram ID
 * - create → create new connection
 * - update → update connection details
 * - deactivate → mark connection as inactive
 * - getAllActive → get all active connections
 *
 * @class TelegramConnectionRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class TelegramConnectionRepository extends BaseRepository {
  /**
   * Find active connection by company ID
   *
   * @param {number} companyId - Internal company ID (companies.id)
   * @returns {Promise<Object|null>} Connection record or null
   *
   * @example
   * const connection = await telegramRepo.findByCompanyId(1);
   */
  async findByCompanyId(companyId) {
    return this.findOne('telegram_business_connections', {
      company_id: companyId,
      is_active: true
    });
  }

  /**
   * Find connection by Telegram business_connection_id
   *
   * @param {string} businessConnectionId - Telegram's connection ID
   * @returns {Promise<Object|null>} Connection record or null
   *
   * @example
   * const connection = await telegramRepo.findByBusinessConnectionId('conn_abc123');
   */
  async findByBusinessConnectionId(businessConnectionId) {
    return this.findOne('telegram_business_connections', {
      business_connection_id: businessConnectionId
    });
  }

  /**
   * Find connection by Telegram user ID
   *
   * @param {number|string} telegramUserId - Telegram user ID
   * @returns {Promise<Object|null>} Connection record or null
   */
  async findByTelegramUserId(telegramUserId) {
    return this.findOne('telegram_business_connections', {
      telegram_user_id: telegramUserId,
      is_active: true
    });
  }

  /**
   * Create a new Telegram connection
   *
   * @param {Object} data - Connection data
   * @param {number} data.company_id - Internal company ID
   * @param {string} data.business_connection_id - Telegram connection ID
   * @param {number} data.telegram_user_id - Telegram user ID
   * @param {string} [data.telegram_username] - Telegram username
   * @param {string} [data.telegram_first_name] - Telegram first name
   * @param {boolean} [data.can_reply=false] - Whether bot can reply
   * @returns {Promise<Object>} Created connection record
   *
   * @example
   * const connection = await telegramRepo.create({
   *   company_id: 1,
   *   business_connection_id: 'conn_abc123',
   *   telegram_user_id: 123456789,
   *   telegram_username: 'salon_telegram',
   *   can_reply: true
   * });
   */
  async create(data) {
    const startTime = Date.now();
    try {
      const connectionData = {
        company_id: data.company_id,
        business_connection_id: data.business_connection_id,
        telegram_user_id: data.telegram_user_id,
        telegram_username: data.telegram_username || null,
        telegram_first_name: data.telegram_first_name || null,
        can_reply: data.can_reply || false,
        is_active: true,
        connected_at: new Date().toISOString()
      };

      const columns = Object.keys(connectionData);
      const values = Object.values(connectionData);
      const placeholders = columns.map((_, i) => `$${i + 1}`);

      const sql = `
        INSERT INTO telegram_business_connections (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.create - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'create' },
        extra: { company_id: data.company_id, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Update connection by ID
   *
   * @param {number} id - Connection ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated connection or null
   */
  async update(id, data) {
    const startTime = Date.now();
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(data)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      // updated_at is handled by trigger, but we'll set it explicitly for consistency
      setClauses.push('updated_at = NOW()');
      values.push(id);

      const sql = `
        UPDATE telegram_business_connections
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.update - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'update' },
        extra: { id, dataKeys: Object.keys(data), duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Update can_reply status for a connection
   * Called when Telegram sends business_connection update
   *
   * @param {string} businessConnectionId - Telegram connection ID
   * @param {boolean} canReply - New can_reply status
   * @returns {Promise<Object|null>} Updated connection or null
   */
  async updateCanReply(businessConnectionId, canReply) {
    const startTime = Date.now();
    try {
      const sql = `
        UPDATE telegram_business_connections
        SET can_reply = $1, updated_at = NOW()
        WHERE business_connection_id = $2
        RETURNING *
      `;

      const result = await this.db.query(sql, [canReply, businessConnectionId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.updateCanReply - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'updateCanReply' },
        extra: { businessConnectionId, canReply, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Deactivate connection (when salon disconnects Telegram)
   *
   * @param {number} companyId - Internal company ID
   * @returns {Promise<Object|null>} Deactivated connection or null
   */
  async deactivate(companyId) {
    const startTime = Date.now();
    try {
      const sql = `
        UPDATE telegram_business_connections
        SET is_active = false, disconnected_at = NOW(), updated_at = NOW()
        WHERE company_id = $1 AND is_active = true
        RETURNING *
      `;

      const result = await this.db.query(sql, [companyId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.deactivate - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'deactivate' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Deactivate connection by business_connection_id
   * Called when Telegram sends disconnection event
   *
   * @param {string} businessConnectionId - Telegram connection ID
   * @returns {Promise<Object|null>} Deactivated connection or null
   */
  async deactivateByBusinessConnectionId(businessConnectionId) {
    const startTime = Date.now();
    try {
      const sql = `
        UPDATE telegram_business_connections
        SET is_active = false, disconnected_at = NOW(), updated_at = NOW()
        WHERE business_connection_id = $1 AND is_active = true
        RETURNING *
      `;

      const result = await this.db.query(sql, [businessConnectionId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.deactivateByBusinessConnectionId - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'deactivateByBusinessConnectionId' },
        extra: { businessConnectionId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get all active Telegram connections
   *
   * @returns {Promise<Array>} Array of active connections
   */
  async getAllActive() {
    return this.findMany('telegram_business_connections', { is_active: true }, {
      orderBy: 'connected_at',
      order: 'desc'
    });
  }

  /**
   * Count active connections
   *
   * @returns {Promise<number>} Count of active connections
   */
  async countActive() {
    const startTime = Date.now();
    try {
      const sql = `SELECT COUNT(*) FROM telegram_business_connections WHERE is_active = true`;
      const result = await this.db.query(sql);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramConnectionRepository.countActive - ${Date.now() - startTime}ms`);
      }

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_business_connections', operation: 'countActive' },
        extra: { duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Upsert connection (create or update by business_connection_id)
   * Useful when receiving repeated business_connection events
   *
   * @param {Object} data - Connection data
   * @returns {Promise<Object>} Upserted connection record
   */
  async upsertByBusinessConnectionId(data) {
    return this.upsert('telegram_business_connections', {
      company_id: data.company_id,
      business_connection_id: data.business_connection_id,
      telegram_user_id: data.telegram_user_id,
      telegram_username: data.telegram_username || null,
      telegram_first_name: data.telegram_first_name || null,
      can_reply: data.can_reply || false,
      is_active: true,
      connected_at: data.connected_at || new Date().toISOString()
    }, ['business_connection_id']);
  }
}

module.exports = TelegramConnectionRepository;
