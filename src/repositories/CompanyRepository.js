/**
 * CompanyRepository - Company data access layer
 *
 * Maps to SupabaseDataLayer company methods:
 * - getCompany → findById
 * - upsertCompany → upsert
 *
 * Extended for marketplace integration:
 * - findByYclientsId → find by yclients_id
 * - updateByYclientsId → update by yclients_id
 * - upsertByYclientsId → upsert by yclients_id
 * - countConnected → count connected companies
 * - countTotal → count all companies
 *
 * @class CompanyRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class CompanyRepository extends BaseRepository {
  /**
   * Find company by YClients ID
   * Maps to: SupabaseDataLayer.getCompany()
   *
   * @param {number} companyId - YClients company ID
   * @returns {Promise<Object|null>} Company record or null
   *
   * @example
   * const company = await companyRepo.findById(962302);
   */
  async findById(companyId) {
    return this.findOne('companies', { yclients_id: companyId });
  }

  /**
   * Insert or update company
   * Maps to: SupabaseDataLayer.upsertCompany()
   *
   * @param {Object} companyData - Company data (must include yclients_id)
   * @returns {Promise<Object>} Inserted/updated company record
   *
   * @example
   * const company = await companyRepo.upsert({
   *   yclients_id: 962302,
   *   title: 'Салон красоты',
   *   timezone: 'Europe/Moscow',
   *   updated_at: new Date().toISOString()
   * });
   */
  async upsert(companyData) {
    return super.upsert('companies', companyData, ['yclients_id']);
  }

  /**
   * Alias for findById - find by YClients ID
   * Used by marketplace-service.js
   *
   * @param {number} yclientsId - YClients company/salon ID
   * @returns {Promise<Object|null>} Company record or null
   */
  async findByYclientsId(yclientsId) {
    return this.findById(yclientsId);
  }

  /**
   * Update company by YClients ID
   * Used by yclients-marketplace.js for status updates
   *
   * @param {number} yclientsId - YClients company/salon ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated company or null
   */
  async updateByYclientsId(yclientsId, data) {
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

      // Always update updated_at
      setClauses.push('updated_at = NOW()');
      values.push(yclientsId);

      const sql = `
        UPDATE companies
        SET ${setClauses.join(', ')}
        WHERE yclients_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] CompanyRepository.updateByYclientsId - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'companies', operation: 'updateByYclientsId' },
        extra: { yclientsId, dataKeys: Object.keys(data), duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Upsert company by YClients ID (alias for upsert)
   * Used by yclients-marketplace.js
   *
   * @param {Object} data - Company data (must include yclients_id)
   * @returns {Promise<Object>} Upserted company
   */
  async upsertByYclientsId(data) {
    return this.upsert(data);
  }

  /**
   * Create new company
   * Used by marketplace-service.js
   *
   * @param {Object} companyData - Company data
   * @returns {Promise<Object>} Created company
   */
  async create(companyData) {
    const startTime = Date.now();
    try {
      const columns = Object.keys(companyData);
      const values = Object.values(companyData);
      const placeholders = columns.map((_, i) => `$${i + 1}`);

      const sql = `
        INSERT INTO companies (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] CompanyRepository.create - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'companies', operation: 'create' },
        extra: { dataKeys: Object.keys(companyData), duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Update company by internal ID
   * Used by marketplace-service.js
   *
   * @param {number} id - Internal company ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated company or null
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

      setClauses.push('updated_at = NOW()');
      values.push(id);

      const sql = `
        UPDATE companies
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] CompanyRepository.update - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'companies', operation: 'update' },
        extra: { id, dataKeys: Object.keys(data), duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Count companies with WhatsApp connected
   * Used by marketplace-service.js for stats
   *
   * @returns {Promise<number>} Count of connected companies
   */
  async countConnected() {
    const startTime = Date.now();
    try {
      const sql = `SELECT COUNT(*) FROM companies WHERE whatsapp_connected = true`;
      const result = await this.db.query(sql);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] CompanyRepository.countConnected - ${Date.now() - startTime}ms`);
      }

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'companies', operation: 'countConnected' },
        extra: { duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Count total companies
   * Used by marketplace-service.js for stats
   *
   * @returns {Promise<number>} Total count of companies
   */
  async countTotal() {
    const startTime = Date.now();
    try {
      const sql = `SELECT COUNT(*) FROM companies`;
      const result = await this.db.query(sql);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] CompanyRepository.countTotal - ${Date.now() - startTime}ms`);
      }

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: 'companies', operation: 'countTotal' },
        extra: { duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }
}

module.exports = CompanyRepository;
