/**
 * RobokassaPaymentRepository - Data access layer for Robokassa payments
 *
 * Handles all database operations for the robokassa_payments table:
 * - Create payment records
 * - Find by invoice ID (with row locking for transactions)
 * - Update payment status
 * - Query payment history
 *
 * @class RobokassaPaymentRepository
 * @extends BaseRepository
 */

const Sentry = require('@sentry/node');
const BaseRepository = require('./BaseRepository');

const TABLE_NAME = 'robokassa_payments';

class RobokassaPaymentRepository extends BaseRepository {
  /**
   * Create a RobokassaPaymentRepository instance
   * @param {Object} db - PostgreSQL connection pool
   */
  constructor(db) {
    super(db);
  }

  /**
   * Generate unique invoice ID for Robokassa
   * Format: timestamp (13 digits) + random (3 digits) = 16 digits max
   *
   * IMPORTANT: Robokassa requires InvId to be <= 2147483647 (32-bit signed int)
   * But we use BigInt in DB to avoid JS precision issues
   *
   * @returns {string} 16-digit invoice ID as string
   */
  getNextInvoiceId() {
    const timestamp = Date.now(); // 13 digits
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp}${random}`;
  }

  /**
   * Insert a new payment record
   * @param {Object} data - Payment data
   * @param {number} data.salon_id - YClients salon ID
   * @param {number} data.amount - Payment amount in rubles
   * @param {string} data.currency - Currency code (default: RUB)
   * @param {string} data.description - Payment description
   * @param {Object} data.receipt_data - Fiscal receipt data (54-FZ)
   * @param {Object} data.metadata - Additional metadata
   * @returns {Promise<Object>} Created payment record
   */
  async insert(data) {
    const startTime = Date.now();
    const invoiceId = this.getNextInvoiceId();

    try {
      const sql = `
        INSERT INTO ${TABLE_NAME} (
          invoice_id,
          salon_id,
          amount,
          currency,
          status,
          description,
          receipt_data,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;

      const params = [
        invoiceId,
        data.salon_id,
        data.amount,
        data.currency || 'RUB',
        'pending',
        data.description || '',
        JSON.stringify(data.receipt_data || {})
      ];

      const result = await this.db.query(sql, params);

      const duration = Date.now() - startTime;
      this._logQuery('insert', TABLE_NAME, duration);

      return result.rows[0];
    } catch (error) {
      console.error(`[DB Error] insert ${TABLE_NAME}:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: TABLE_NAME,
          operation: 'insert'
        },
        extra: {
          salon_id: data.salon_id,
          amount: data.amount,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw this._handleError(error);
    }
  }

  /**
   * Find payment by invoice ID
   * @param {string} invoiceId - Robokassa invoice ID
   * @returns {Promise<Object|null>} Payment record or null
   */
  async findByInvoiceId(invoiceId) {
    return this.findOne(TABLE_NAME, { invoice_id: invoiceId });
  }

  /**
   * Find payment by invoice ID with row lock (FOR UPDATE)
   * MUST be called within a transaction!
   *
   * @param {string} invoiceId - Robokassa invoice ID
   * @param {Object} client - PostgreSQL transaction client
   * @returns {Promise<Object|null>} Payment record or null
   */
  async findByInvoiceIdForUpdate(invoiceId, client) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT * FROM ${TABLE_NAME}
        WHERE invoice_id = $1
        FOR UPDATE
      `;

      const result = await client.query(sql, [invoiceId]);

      const duration = Date.now() - startTime;
      this._logQuery('findByInvoiceIdForUpdate', TABLE_NAME, duration);

      return result.rows[0] || null;
    } catch (error) {
      console.error(`[DB Error] findByInvoiceIdForUpdate ${TABLE_NAME}:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: TABLE_NAME,
          operation: 'findByInvoiceIdForUpdate'
        },
        extra: {
          invoiceId,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw this._handleError(error);
    }
  }

  /**
   * Update payment status
   * @param {string} invoiceId - Robokassa invoice ID
   * @param {string} status - New status (pending, success, failed, cancelled)
   * @param {Object} extra - Additional fields to update
   * @param {string} extra.robokassa_operation_id - Robokassa operation ID
   * @param {string} extra.error_message - Error message (for failed payments)
   * @returns {Promise<Object|null>} Updated payment record or null
   */
  async updateStatus(invoiceId, status, extra = {}) {
    const startTime = Date.now();

    try {
      const setClauses = ['status = $1', 'updated_at = NOW()'];
      const params = [status];
      let paramIndex = 2;

      // Add processed_at for success status
      if (status === 'success') {
        setClauses.push('processed_at = NOW()');
      }

      // Add optional fields
      if (extra.signature_value) {
        setClauses.push(`signature_value = $${paramIndex}`);
        params.push(extra.signature_value);
        paramIndex++;
      }

      if (extra.raw_response) {
        setClauses.push(`raw_response = $${paramIndex}`);
        params.push(JSON.stringify(extra.raw_response));
        paramIndex++;
      }

      // Invoice ID is the last parameter
      params.push(invoiceId);

      const sql = `
        UPDATE ${TABLE_NAME}
        SET ${setClauses.join(', ')}
        WHERE invoice_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(sql, params);

      const duration = Date.now() - startTime;
      this._logQuery('updateStatus', TABLE_NAME, duration, { status });

      return result.rows[0] || null;
    } catch (error) {
      console.error(`[DB Error] updateStatus ${TABLE_NAME}:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: TABLE_NAME,
          operation: 'updateStatus'
        },
        extra: {
          invoiceId,
          status,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw this._handleError(error);
    }
  }

  /**
   * Update payment status within a transaction
   * @param {Object} client - PostgreSQL transaction client
   * @param {string} invoiceId - Robokassa invoice ID
   * @param {string} status - New status
   * @param {Object} extra - Additional fields
   * @returns {Promise<Object|null>} Updated payment record
   */
  async updateStatusInTransaction(client, invoiceId, status, extra = {}) {
    const startTime = Date.now();

    try {
      const setClauses = ['status = $1', 'updated_at = NOW()'];
      const params = [status];
      let paramIndex = 2;

      if (status === 'success') {
        setClauses.push('processed_at = NOW()');
      }

      if (extra.signature_value) {
        setClauses.push(`signature_value = $${paramIndex}`);
        params.push(extra.signature_value);
        paramIndex++;
      }

      if (extra.raw_response) {
        setClauses.push(`raw_response = $${paramIndex}`);
        params.push(JSON.stringify(extra.raw_response));
        paramIndex++;
      }

      params.push(invoiceId);

      const sql = `
        UPDATE ${TABLE_NAME}
        SET ${setClauses.join(', ')}
        WHERE invoice_id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(sql, params);

      const duration = Date.now() - startTime;
      this._logQuery('updateStatusInTransaction', TABLE_NAME, duration, { status });

      return result.rows[0] || null;
    } catch (error) {
      console.error(`[DB Error] updateStatusInTransaction ${TABLE_NAME}:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: TABLE_NAME,
          operation: 'updateStatusInTransaction'
        },
        extra: {
          invoiceId,
          status,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw this._handleError(error);
    }
  }

  /**
   * Find payments by salon ID
   * @param {number} salonId - YClients salon ID
   * @param {Object} options - Query options
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Max records (default: 50)
   * @param {number} options.offset - Offset for pagination
   * @returns {Promise<Array>} Array of payment records
   */
  async findBySalonId(salonId, options = {}) {
    const filters = { salon_id: salonId };

    if (options.status) {
      filters.status = options.status;
    }

    return this.findMany(TABLE_NAME, filters, {
      orderBy: 'created_at',
      order: 'desc',
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  }

  /**
   * Get payment statistics for a salon
   * @param {number} salonId - YClients salon ID
   * @returns {Promise<Object>} Statistics object
   */
  async getStatsBySalonId(salonId) {
    const startTime = Date.now();

    try {
      const sql = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'success') as successful_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) as total_amount
        FROM ${TABLE_NAME}
        WHERE salon_id = $1
      `;

      const result = await this.db.query(sql, [salonId]);

      const duration = Date.now() - startTime;
      this._logQuery('getStatsBySalonId', TABLE_NAME, duration);

      const row = result.rows[0];
      return {
        successful_count: parseInt(row.successful_count) || 0,
        pending_count: parseInt(row.pending_count) || 0,
        failed_count: parseInt(row.failed_count) || 0,
        total_amount: parseFloat(row.total_amount) || 0
      };
    } catch (error) {
      console.error(`[DB Error] getStatsBySalonId ${TABLE_NAME}:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: TABLE_NAME,
          operation: 'getStatsBySalonId'
        },
        extra: {
          salonId,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw this._handleError(error);
    }
  }
}

module.exports = RobokassaPaymentRepository;
