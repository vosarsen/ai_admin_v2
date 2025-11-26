/**
 * MessageRepository - Messages data access layer
 *
 * Handles message queries for activity checking.
 * Used by webhook-processor for notification deduplication.
 *
 * @class MessageRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class MessageRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'messages';
  }

  /**
   * Find recent incoming messages from a phone number
   * Used to check if client recently sent a message (for notification skipping)
   *
   * @param {string} phone - Phone number
   * @param {string|Date} since - Timestamp to check from (ISO string or Date)
   * @returns {Promise<Array>} Array of recent messages (usually 0 or 1)
   * @throws {Error} Database connection or query error
   */
  async findRecent(phone, since) {
    try {
      const sinceStr = since instanceof Date ? since.toISOString() : since;

      return this.findMany(
        this.tableName,
        {
          phone: phone,
          direction: 'incoming',
          created_at: { gte: sinceStr }
        },
        { orderBy: 'created_at', order: 'desc', limit: 1 }
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'findRecent' },
        extra: { phone, since }
      });
      throw error;
    }
  }

  /**
   * Check if there's recent activity from a phone number
   * Convenience method that returns boolean
   *
   * @param {string} phone - Phone number
   * @param {number} minutesAgo - How many minutes back to check
   * @returns {Promise<boolean>} True if recent activity exists
   * @throws {Error} Database connection or query error
   */
  async hasRecentActivity(phone, minutesAgo = 5) {
    try {
      const since = new Date(Date.now() - minutesAgo * 60 * 1000);
      const messages = await this.findRecent(phone, since);
      return messages.length > 0;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'repository', table: this.tableName, operation: 'hasRecentActivity' },
        extra: { phone, minutesAgo }
      });
      throw error;
    }
  }
}

module.exports = MessageRepository;
