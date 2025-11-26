/**
 * DemoChatAnalyticsRepository - Demo chat analytics data access layer
 *
 * Handles demo chat event logging and analytics queries.
 * Used by demo-chat.js and demo-chat-analytics.js routes.
 *
 * @class DemoChatAnalyticsRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class DemoChatAnalyticsRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'demo_chat_events';
  }

  /**
   * Log a demo chat event
   * @param {Object} eventData - Event data
   * @param {string} eventData.session_id - UUID session ID
   * @param {string} eventData.event_type - Event type (session_start, message_sent, message_received, limit_reached, error)
   * @param {string} [eventData.message] - User message
   * @param {string} [eventData.response] - Bot response
   * @param {string} [eventData.user_ip] - User IP address
   * @param {number} [eventData.processing_time_ms] - Processing time in milliseconds
   * @param {string} [eventData.ai_provider] - AI provider used (gemini-flash, deepseek, etc.)
   * @param {string} [eventData.error_type] - Error type if event_type is error
   * @param {string} [eventData.error_message] - Error message if event_type is error
   * @param {Object} [eventData.event_data] - Additional event data (JSON)
   * @returns {Promise<Object>} Inserted event
   * @throws {Error} Database connection or constraint error
   */
  async logEvent(eventData) {
    const startTime = Date.now();
    try {
      const sql = `
        INSERT INTO ${this.tableName} (
          session_id, event_type, message, response, user_ip,
          processing_time_ms, ai_provider, error_type, error_message, event_data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const result = await this.db.query(sql, [
        eventData.session_id,
        eventData.event_type,
        eventData.message || null,
        eventData.response || null,
        eventData.user_ip || null,
        eventData.processing_time_ms || null,
        eventData.ai_provider || null,
        eventData.error_type || null,
        eventData.error_message || null,
        eventData.event_data ? JSON.stringify(eventData.event_data) : null
      ]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.logEvent - ${Date.now() - startTime}ms`);
      }

      return result.rows[0];
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'logEvent',
          backend: 'demo-chat-analytics'
        },
        extra: {
          sessionId: eventData.session_id,
          eventType: eventData.event_type,
          duration: `${Date.now() - startTime}ms`
        }
      });
      // Don't throw - analytics failures shouldn't break the main flow
      console.error('[DemoChatAnalyticsRepository] Failed to log event:', error.message);
      return null;
    }
  }

  /**
   * Get total number of unique sessions
   * @param {Object} [options] - Query options
   * @param {Date} [options.startDate] - Start date filter
   * @param {Date} [options.endDate] - End date filter
   * @returns {Promise<number>} Number of unique sessions
   */
  async getSessionCount(options = {}) {
    const startTime = Date.now();
    try {
      let sql = `SELECT COUNT(DISTINCT session_id) as count FROM ${this.tableName}`;
      const params = [];

      if (options.startDate || options.endDate) {
        sql += ' WHERE';
        if (options.startDate) {
          params.push(options.startDate);
          sql += ` created_at >= $${params.length}`;
        }
        if (options.endDate) {
          if (options.startDate) sql += ' AND';
          params.push(options.endDate);
          sql += ` created_at <= $${params.length}`;
        }
      }

      const result = await this.db.query(sql, params);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.getSessionCount - ${Date.now() - startTime}ms`);
      }

      return parseInt(result.rows[0].count);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'getSessionCount',
          backend: 'demo-chat-analytics'
        },
        extra: { options, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get popular user queries
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=10] - Number of queries to return
   * @param {Date} [options.startDate] - Start date filter
   * @param {Date} [options.endDate] - End date filter
   * @returns {Promise<Array>} Array of {message, count}
   */
  async getPopularQueries(options = {}) {
    const startTime = Date.now();
    try {
      let sql = `
        SELECT message, COUNT(*) as count
        FROM ${this.tableName}
        WHERE event_type = 'message_sent' AND message IS NOT NULL
      `;
      const params = [];

      if (options.startDate) {
        params.push(options.startDate);
        sql += ` AND created_at >= $${params.length}`;
      }
      if (options.endDate) {
        params.push(options.endDate);
        sql += ` AND created_at <= $${params.length}`;
      }

      sql += ` GROUP BY message ORDER BY count DESC LIMIT $${params.length + 1}`;
      params.push(options.limit || 10);

      const result = await this.db.query(sql, params);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.getPopularQueries - ${Date.now() - startTime}ms`);
      }

      return result.rows;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'getPopularQueries',
          backend: 'demo-chat-analytics'
        },
        extra: { options, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get average response time
   * @param {Object} [options] - Query options
   * @param {Date} [options.startDate] - Start date filter
   * @param {Date} [options.endDate] - End date filter
   * @param {string} [options.ai_provider] - Filter by AI provider
   * @returns {Promise<number>} Average response time in milliseconds
   */
  async getAverageResponseTime(options = {}) {
    const startTime = Date.now();
    try {
      let sql = `
        SELECT AVG(processing_time_ms) as avg_time
        FROM ${this.tableName}
        WHERE event_type = 'message_received' AND processing_time_ms IS NOT NULL
      `;
      const params = [];

      if (options.startDate) {
        params.push(options.startDate);
        sql += ` AND created_at >= $${params.length}`;
      }
      if (options.endDate) {
        params.push(options.endDate);
        sql += ` AND created_at <= $${params.length}`;
      }
      if (options.ai_provider) {
        params.push(options.ai_provider);
        sql += ` AND ai_provider = $${params.length}`;
      }

      const result = await this.db.query(sql, params);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.getAverageResponseTime - ${Date.now() - startTime}ms`);
      }

      return parseFloat(result.rows[0].avg_time) || 0;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'getAverageResponseTime',
          backend: 'demo-chat-analytics'
        },
        extra: { options, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get comprehensive analytics summary
   * @param {Object} [options] - Query options
   * @param {Date} [options.startDate] - Start date filter
   * @param {Date} [options.endDate] - End date filter
   * @returns {Promise<Object>} Analytics summary
   */
  async getAnalyticsSummary(options = {}) {
    const startTime = Date.now();
    try {
      const [
        sessionCount,
        popularQueries,
        avgResponseTime,
        totalMessages
      ] = await Promise.all([
        this.getSessionCount(options),
        this.getPopularQueries({ ...options, limit: 5 }),
        this.getAverageResponseTime(options),
        this.getTotalMessageCount(options)
      ]);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.getAnalyticsSummary - ${Date.now() - startTime}ms`);
      }

      return {
        sessionCount,
        totalMessages,
        avgResponseTimeMs: Math.round(avgResponseTime),
        popularQueries,
        periodStart: options.startDate,
        periodEnd: options.endDate
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'getAnalyticsSummary',
          backend: 'demo-chat-analytics'
        },
        extra: { options, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }

  /**
   * Get total message count
   * @param {Object} [options] - Query options
   * @param {Date} [options.startDate] - Start date filter
   * @param {Date} [options.endDate] - End date filter
   * @returns {Promise<number>} Total message count
   */
  async getTotalMessageCount(options = {}) {
    const startTime = Date.now();
    try {
      let sql = `
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        WHERE event_type = 'message_sent'
      `;
      const params = [];

      if (options.startDate) {
        params.push(options.startDate);
        sql += ` AND created_at >= $${params.length}`;
      }
      if (options.endDate) {
        params.push(options.endDate);
        sql += ` AND created_at <= $${params.length}`;
      }

      const result = await this.db.query(sql, params);

      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] DemoChatAnalyticsRepository.getTotalMessageCount - ${Date.now() - startTime}ms`);
      }

      return parseInt(result.rows[0].count);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: this.tableName,
          operation: 'getTotalMessageCount',
          backend: 'demo-chat-analytics'
        },
        extra: { options, duration: `${Date.now() - startTime}ms` }
      });
      throw error;
    }
  }
}

module.exports = DemoChatAnalyticsRepository;
