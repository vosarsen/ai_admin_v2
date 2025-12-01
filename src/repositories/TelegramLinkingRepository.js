/**
 * TelegramLinkingRepository - Telegram company linking data access layer
 *
 * Manages deep link codes and user-to-company mappings for multi-tenant support:
 * - generateCode → Create new deep link code (Redis + DB audit)
 * - getCodeData → Lookup code from Redis
 * - consumeCode → Mark code as used (single-use)
 * - createLink → Create permanent user-company association
 * - findLinkByTelegramUser → Resolve company_id for a Telegram user
 * - deactivateLinkForCompany → Soft-delete for re-linking
 *
 * Storage Strategy:
 * - Redis: Primary storage for active codes (15 min TTL)
 * - PostgreSQL: Audit trail for all codes + permanent user links
 *
 * @class TelegramLinkingRepository
 * @extends BaseRepository
 */
const crypto = require('crypto');
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');
const { createRedisClient } = require('../utils/redis-factory');

// Redis key prefix for linking codes
const REDIS_KEY_PREFIX = 'telegram_linking:';
const CODE_TTL_SECONDS = 900; // 15 minutes

class TelegramLinkingRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.redis = null;
    this._initRedis();
  }

  /**
   * Initialize Redis client
   * @private
   */
  _initRedis() {
    try {
      this.redis = createRedisClient('telegram-linking');
    } catch (error) {
      console.error('[TelegramLinkingRepository] Failed to create Redis client:', error.message);
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking', operation: 'init_redis' }
      });
    }
  }

  /**
   * Generate a new linking code for a company
   *
   * Creates a cryptographically random code, stores in Redis (15 min TTL)
   * and records in PostgreSQL for audit.
   *
   * @param {number} companyId - Internal company ID
   * @param {string} companyName - Company display name (for bot message)
   * @param {string} [createdBy='system'] - Who generated the code
   * @returns {Promise<Object>} { code, deepLink, expiresAt }
   *
   * @example
   * const result = await repo.generateCode(962302, 'Студия Красоты Анна', 'admin');
   * // { code: 'Ab3kL9mX2p4K', deepLink: 'https://t.me/AdmiAI_bot?start=link_Ab3kL9mX2p4K', expiresAt: '...' }
   */
  async generateCode(companyId, companyName, createdBy = 'system') {
    const startTime = Date.now();

    try {
      // Generate cryptographically random code
      const code = crypto.randomBytes(10).toString('base64url');
      const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

      // Store in Redis (primary)
      const redisKey = `${REDIS_KEY_PREFIX}${code}`;
      const redisValue = JSON.stringify({
        company_id: companyId,
        company_name: companyName,
        created_by: createdBy,
        created_at: Date.now()
      });

      if (this.redis) {
        await this.redis.setex(redisKey, CODE_TTL_SECONDS, redisValue);
      }

      // Store in PostgreSQL (audit)
      const sql = `
        INSERT INTO telegram_linking_codes (code, company_id, status, expires_at, created_by)
        VALUES ($1, $2, 'pending', $3, $4)
        RETURNING *
      `;
      await this.db.query(sql, [code, companyId, expiresAt.toISOString(), createdBy]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.generateCode - ${duration}ms`);
      }

      // Construct deep link
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'AdmiAI_bot';
      const deepLink = `https://t.me/${botUsername}?start=link_${code}`;

      return {
        code,
        deepLink,
        expiresAt: expiresAt.toISOString(),
        companyName
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'generateCode' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get code data from Redis
   *
   * @param {string} code - The linking code
   * @returns {Promise<Object|null>} Code data or null if not found/expired
   *
   * @example
   * const data = await repo.getCodeData('Ab3kL9mX2p4K');
   * // { company_id: 962302, company_name: 'Студия Красоты Анна', ... }
   */
  async getCodeData(code) {
    const startTime = Date.now();

    try {
      if (!this.redis) {
        console.warn('[TelegramLinkingRepository] Redis not available, checking DB only');
        return this._getCodeDataFromDB(code);
      }

      const redisKey = `${REDIS_KEY_PREFIX}${code}`;
      const data = await this.redis.get(redisKey);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[Redis] TelegramLinkingRepository.getCodeData - ${Date.now() - startTime}ms`);
      }

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'getCodeData' },
        extra: { code, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Fallback to DB lookup if Redis unavailable
   * @private
   */
  async _getCodeDataFromDB(code) {
    const sql = `
      SELECT company_id, created_by, created_at
      FROM telegram_linking_codes
      WHERE code = $1 AND status = 'pending' AND expires_at > NOW()
    `;
    const result = await this.db.query(sql, [code]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Get company name
    const companySql = `SELECT title FROM companies WHERE id = $1`;
    const companyResult = await this.db.query(companySql, [row.company_id]);

    return {
      company_id: row.company_id,
      company_name: companyResult.rows[0]?.title || 'Unknown',
      created_by: row.created_by,
      created_at: new Date(row.created_at).getTime()
    };
  }

  /**
   * Consume a code (single-use)
   *
   * Deletes from Redis and marks as 'used' in PostgreSQL.
   * Called after user confirms linking.
   *
   * @param {string} code - The linking code
   * @param {number} telegramUserId - Telegram user ID who used the code
   * @param {string} [username] - Telegram username
   * @returns {Promise<boolean>} True if consumed, false if already used/expired
   */
  async consumeCode(code, telegramUserId, username) {
    const startTime = Date.now();

    try {
      // Delete from Redis
      if (this.redis) {
        const redisKey = `${REDIS_KEY_PREFIX}${code}`;
        await this.redis.del(redisKey);
      }

      // Update PostgreSQL
      const sql = `
        UPDATE telegram_linking_codes
        SET status = 'used', used_at = NOW(), used_by_telegram_id = $2, used_by_username = $3
        WHERE code = $1 AND status = 'pending'
        RETURNING *
      `;
      const result = await this.db.query(sql, [code, telegramUserId, username || null]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.consumeCode - ${duration}ms`);
      }

      return result.rowCount > 0;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'consumeCode' },
        extra: { code, telegramUserId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Create permanent user-company link
   *
   * Creates a new link or updates existing one if user re-links.
   * Deactivates any existing links for this user first.
   *
   * @param {number} telegramUserId - Telegram user ID
   * @param {string} [username] - Telegram username
   * @param {number} companyId - Company ID to link to
   * @param {string} [code] - Code used for linking (for audit)
   * @returns {Promise<Object>} Created link record
   */
  async createLink(telegramUserId, username, companyId, code) {
    const startTime = Date.now();

    try {
      // Use transaction for atomic deactivate + create
      return await this.withTransaction(async (client) => {
        // Deactivate existing links for this user (if any)
        await client.query(
          `UPDATE telegram_user_company_links SET is_active = false, updated_at = NOW() WHERE telegram_user_id = $1`,
          [telegramUserId]
        );

        // Create new link
        const sql = `
          INSERT INTO telegram_user_company_links
            (telegram_user_id, telegram_username, company_id, linked_via_code, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (telegram_user_id)
          DO UPDATE SET
            telegram_username = EXCLUDED.telegram_username,
            company_id = EXCLUDED.company_id,
            linked_via_code = EXCLUDED.linked_via_code,
            is_active = true,
            linked_at = NOW(),
            updated_at = NOW()
          RETURNING *
        `;
        const result = await client.query(sql, [telegramUserId, username || null, companyId, code || null]);

        const duration = Date.now() - startTime;
        if (process.env.LOG_DATABASE_CALLS === 'true') {
          console.log(`[DB] TelegramLinkingRepository.createLink - ${duration}ms`);
        }

        return result.rows[0];
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_user_company_links', operation: 'createLink' },
        extra: { telegramUserId, companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Find active link for a Telegram user
   *
   * Primary method for resolving company_id when handling business_connection events.
   *
   * @param {number|string} telegramUserId - Telegram user ID
   * @returns {Promise<Object|null>} Link record with company_id or null
   *
   * @example
   * const link = await repo.findLinkByTelegramUser(123456789);
   * if (link) {
   *   console.log(link.company_id);  // 962302
   * }
   */
  async findLinkByTelegramUser(telegramUserId) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT l.*, c.title as company_name
        FROM telegram_user_company_links l
        LEFT JOIN companies c ON l.company_id = c.id
        WHERE l.telegram_user_id = $1 AND l.is_active = true
        LIMIT 1
      `;
      const result = await this.db.query(sql, [telegramUserId]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.findLinkByTelegramUser - ${duration}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_user_company_links', operation: 'findLinkByTelegramUser' },
        extra: { telegramUserId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Find link by company ID
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Link record or null
   */
  async findLinkByCompany(companyId) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT * FROM telegram_user_company_links
        WHERE company_id = $1 AND is_active = true
        LIMIT 1
      `;
      const result = await this.db.query(sql, [companyId]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.findLinkByCompany - ${duration}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_user_company_links', operation: 'findLinkByCompany' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Deactivate all links for a company
   *
   * Used when re-linking a company to a new Telegram user.
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<number>} Number of deactivated links
   */
  async deactivateLinkForCompany(companyId) {
    const startTime = Date.now();

    try {
      const sql = `
        UPDATE telegram_user_company_links
        SET is_active = false, updated_at = NOW()
        WHERE company_id = $1 AND is_active = true
        RETURNING *
      `;
      const result = await this.db.query(sql, [companyId]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.deactivateLinkForCompany - ${duration}ms`);
      }

      return result.rowCount;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_user_company_links', operation: 'deactivateLinkForCompany' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Revoke an unused code
   *
   * @param {string} code - The code to revoke
   * @returns {Promise<boolean>} True if revoked, false if already used/expired
   */
  async revokeCode(code) {
    const startTime = Date.now();

    try {
      // Delete from Redis
      if (this.redis) {
        const redisKey = `${REDIS_KEY_PREFIX}${code}`;
        await this.redis.del(redisKey);
      }

      // Update PostgreSQL
      const sql = `
        UPDATE telegram_linking_codes
        SET status = 'revoked'
        WHERE code = $1 AND status = 'pending'
        RETURNING *
      `;
      const result = await this.db.query(sql, [code]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.revokeCode - ${duration}ms`);
      }

      return result.rowCount > 0;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'revokeCode' },
        extra: { code, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get pending codes for a company
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Array of pending codes
   */
  async getPendingCodes(companyId) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT code, expires_at, created_at, created_by
        FROM telegram_linking_codes
        WHERE company_id = $1 AND status = 'pending' AND expires_at > NOW()
        ORDER BY created_at DESC
      `;
      const result = await this.db.query(sql, [companyId]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.getPendingCodes - ${duration}ms`);
      }

      return result.rows;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'getPendingCodes' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Count codes generated for company today
   *
   * Used for rate limiting (max 3 codes/company/day).
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<number>} Number of codes generated today
   */
  async countTodayCodes(companyId) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT COUNT(*) as count
        FROM telegram_linking_codes
        WHERE company_id = $1 AND created_at >= CURRENT_DATE
      `;
      const result = await this.db.query(sql, [companyId]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] TelegramLinkingRepository.countTodayCodes - ${duration}ms`);
      }

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'telegram_linking_codes', operation: 'countTodayCodes' },
        extra: { companyId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }
}

module.exports = TelegramLinkingRepository;
