/**
 * MarketplaceEventsRepository - Marketplace events data access layer
 *
 * Handles marketplace event logging for YClients integrations.
 * Used by yclients-marketplace.js
 *
 * @class MarketplaceEventsRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class MarketplaceEventsRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'marketplace_events';
  }

  /**
   * Insert new marketplace event
   * @param {Object} eventData - Event data
   * @param {number} [eventData.company_id] - Internal company ID (can be null for new salons)
   * @param {number} eventData.salon_id - YClients salon ID
   * @param {string} eventData.event_type - Event type (install, uninstall, payment, etc.)
   * @param {Object} [eventData.event_data] - Additional event data
   * @returns {Promise<Object>} Inserted event
   */
  async insert(eventData) {
    const startTime = Date.now();
    try {
      const sql = `
        INSERT INTO ${this.tableName} (company_id, salon_id, event_type, event_data)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await this.db.query(sql, [
        eventData.company_id || null,
        eventData.salon_id,
        eventData.event_type,
        eventData.event_data ? JSON.stringify(eventData.event_data) : null
      ]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] MarketplaceEventsRepository.insert - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'insert' },
        extra: { salonId: eventData.salon_id, eventType: eventData.event_type, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Find latest event by type for a salon
   * @param {number} salonId - YClients salon ID
   * @param {string} eventType - Event type to find
   * @returns {Promise<Object|null>} Latest event or null
   */
  async findLatestByType(salonId, eventType) {
    try {
      const result = await this.findMany(
        this.tableName,
        { salon_id: salonId, event_type: eventType },
        { orderBy: 'created_at', order: 'desc', limit: 1 }
      );
      return result[0] || null;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'findLatestByType' },
        extra: { salonId, eventType }
      });
      throw error;
    }
  }

  /**
   * Find all events for a salon
   * @param {number} salonId - YClients salon ID
   * @param {Object} [options] - Query options
   * @returns {Promise<Array>} Array of events
   */
  async findBySalonId(salonId, options = {}) {
    try {
      return this.findMany(
        this.tableName,
        { salon_id: salonId },
        { orderBy: 'created_at', order: 'desc', ...options }
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'findBySalonId' },
        extra: { salonId }
      });
      throw error;
    }
  }
}

module.exports = MarketplaceEventsRepository;
