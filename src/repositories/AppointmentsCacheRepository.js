/**
 * AppointmentsCacheRepository - Appointments cache data access layer
 *
 * Handles caching of individual appointment records from webhooks.
 * Used by webhook-processor and booking-ownership.js
 *
 * @class AppointmentsCacheRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class AppointmentsCacheRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'appointments_cache';
  }

  /**
   * Insert or update appointment in cache
   * @param {Object} appointmentData - Appointment data
   * @param {number} appointmentData.yclients_record_id - YClients record ID
   * @param {number} appointmentData.company_id - Company ID
   * @param {number} [appointmentData.client_id] - Client ID
   * @param {string} [appointmentData.client_phone] - Client phone (extracted from raw_data if not provided)
   * @param {number} [appointmentData.service_id] - Service ID
   * @param {number} [appointmentData.staff_id] - Staff ID
   * @param {string} [appointmentData.appointment_datetime] - Appointment datetime
   * @param {number} [appointmentData.cost] - Cost
   * @param {string} [appointmentData.status] - Status (default: confirmed)
   * @param {Object} [appointmentData.raw_data] - Full webhook data
   * @returns {Promise<Object>} Inserted/updated appointment
   */
  async insert(appointmentData) {
    const startTime = Date.now();
    try {
      // Extract client_phone from raw_data if not provided directly
      const clientPhone = appointmentData.client_phone ||
        appointmentData.raw_data?.client?.phone ||
        null;

      const sql = `
        INSERT INTO ${this.tableName}
        (yclients_record_id, company_id, client_id, client_phone, service_id, staff_id,
         appointment_datetime, cost, status, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (yclients_record_id) DO UPDATE SET
          client_id = EXCLUDED.client_id,
          client_phone = EXCLUDED.client_phone,
          service_id = EXCLUDED.service_id,
          staff_id = EXCLUDED.staff_id,
          appointment_datetime = EXCLUDED.appointment_datetime,
          cost = EXCLUDED.cost,
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await this.db.query(sql, [
        appointmentData.yclients_record_id,
        appointmentData.company_id,
        appointmentData.client_id || null,
        clientPhone,
        appointmentData.service_id || null,
        appointmentData.staff_id || null,
        appointmentData.appointment_datetime || null,
        appointmentData.cost || 0,
        appointmentData.status || 'confirmed',
        appointmentData.raw_data ? JSON.stringify(appointmentData.raw_data) : null
      ]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] AppointmentsCacheRepository.insert - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'insert' },
        extra: { recordId: appointmentData.yclients_record_id, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Update appointment by YClients record ID
   * @param {number} recordId - YClients record ID
   * @param {Object} data - Fields to update
   * @returns {Promise<Object|null>} Updated appointment or null
   */
  async updateByRecordId(recordId, data) {
    const startTime = Date.now();
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(data)) {
        if (key === 'raw_data') {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
      setClauses.push('updated_at = NOW()');
      values.push(recordId);

      const sql = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE yclients_record_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(sql, values);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] AppointmentsCacheRepository.updateByRecordId - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'updateByRecordId' },
        extra: { recordId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Find appointment by YClients record ID
   * @param {number} recordId - YClients record ID
   * @returns {Promise<Object|null>} Appointment or null
   */
  async findByRecordId(recordId) {
    try {
      return this.findOne(this.tableName, { yclients_record_id: recordId });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'findByRecordId' },
        extra: { recordId }
      });
      throw error;
    }
  }

  /**
   * Mark appointment as cancelled
   * @param {number} recordId - YClients record ID
   * @param {string} [reason] - Cancellation reason
   * @returns {Promise<Object|null>} Updated appointment or null
   */
  async markCancelled(recordId, reason = null) {
    const startTime = Date.now();
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET is_cancelled = true, cancellation_reason = $1, status = 'cancelled', updated_at = NOW()
        WHERE yclients_record_id = $2
        RETURNING *
      `;
      const result = await this.db.query(sql, [reason, recordId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] AppointmentsCacheRepository.markCancelled - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'markCancelled' },
        extra: { recordId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Find active (non-deleted, non-cancelled) appointments for a company
   * Used by booking-ownership.js for sync
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Array of active appointments
   */
  async findActive(companyId) {
    try {
      return this.findMany(
        this.tableName,
        {
          company_id: companyId,
          deleted: false,
          is_cancelled: false
        },
        { orderBy: 'appointment_datetime', order: 'asc' }
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'findActive' },
        extra: { companyId }
      });
      throw error;
    }
  }

  /**
   * Soft delete appointment
   * @param {number} recordId - YClients record ID
   * @returns {Promise<Object|null>} Updated appointment or null
   */
  async softDelete(recordId) {
    const startTime = Date.now();
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET deleted = true, updated_at = NOW()
        WHERE yclients_record_id = $1
        RETURNING *
      `;
      const result = await this.db.query(sql, [recordId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] AppointmentsCacheRepository.softDelete - ${Date.now() - startTime}ms`);
      }

      return result.rows[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'softDelete' },
        extra: { recordId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }
}

module.exports = AppointmentsCacheRepository;
