/**
 * WebhookEventsRepository - Webhook events data access layer
 *
 * Handles webhook event deduplication and tracking.
 * Used by webhook-processor and webhooks/yclients.js
 *
 * @class WebhookEventsRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class WebhookEventsRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'webhook_events';
  }

  /**
   * Check if event already exists (for deduplication)
   * @param {string} eventId - Unique event identifier
   * @returns {Promise<boolean>} True if event exists
   * @throws {Error} Database connection or query error
   */
  async exists(eventId) {
    try {
      const result = await this.findOne(this.tableName, { event_id: eventId });
      return !!result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'exists' },
        extra: { eventId }
      });
      throw error;
    }
  }

  /**
   * Insert new webhook event
   * @param {Object} eventData - Event data
   * @param {string} eventData.event_id - Unique event ID
   * @param {string} eventData.event_type - Event type (record_created, etc.)
   * @param {number} eventData.company_id - Company ID
   * @param {number} [eventData.record_id] - Record ID (for booking events)
   * @param {Object} eventData.payload - Full webhook payload
   * @returns {Promise<Object>} Inserted event
   * @throws {Error} Database connection or constraint violation error
   */
  async insert(eventData) {
    const startTime = Date.now();
    try {
      const sql = `
        INSERT INTO ${this.tableName} (event_id, event_type, company_id, record_id, payload)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await this.db.query(sql, [
        eventData.event_id,
        eventData.event_type,
        eventData.company_id,
        eventData.record_id || null,
        JSON.stringify(eventData.payload)
      ]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] WebhookEventsRepository.insert - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'insert' },
        extra: { eventId: eventData.event_id, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Mark event as processed
   * @param {string} eventId - Event ID to mark
   * @returns {Promise<void>}
   * @throws {Error} Database connection or query error
   */
  async markProcessed(eventId) {
    const startTime = Date.now();
    try {
      const sql = `UPDATE ${this.tableName} SET processed_at = NOW() WHERE event_id = $1`;
      await this.db.query(sql, [eventId]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] WebhookEventsRepository.markProcessed - ${Date.now() - startTime}ms`);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'markProcessed' },
        extra: { eventId, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }
}

module.exports = WebhookEventsRepository;
