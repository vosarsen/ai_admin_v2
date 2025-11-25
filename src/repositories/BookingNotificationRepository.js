/**
 * BookingNotificationRepository - Notification tracking data access layer
 *
 * Handles booking notification records to prevent duplicate reminders:
 * - findRecent - Find recent notifications for a record
 * - isDuplicate - Check if notification was already sent
 * - create - Insert new notification record
 * - findSentToday - Get today's notifications for a record
 *
 * @class BookingNotificationRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');
const Sentry = require('@sentry/node');

class BookingNotificationRepository extends BaseRepository {
  /**
   * Find recent notifications for a record
   *
   * @param {number} recordId - YClients record ID
   * @param {number} windowMs - Time window in milliseconds (default: 24 hours)
   * @param {Array<string>} types - Optional array of notification types to filter
   * @returns {Promise<Array>} Array of notification records
   *
   * @example
   * const recent = await notificationRepo.findRecent(1434631767, 24 * 60 * 60 * 1000);
   * const reminders = await notificationRepo.findRecent(
   *   1434631767,
   *   24 * 60 * 60 * 1000,
   *   ['reminder_day_before', 'reminder_2hours']
   * );
   */
  async findRecent(recordId, windowMs = 24 * 60 * 60 * 1000, types = null) {
    const startTime = Date.now();

    try {
      const cutoffTime = new Date(Date.now() - windowMs).toISOString();

      const filters = {
        yclients_record_id: recordId,
        sent_at: { gte: cutoffTime }
      };

      if (types && types.length > 0) {
        filters.notification_type = { in: types };
      }

      const result = await this.findMany('booking_notifications', filters, {
        orderBy: 'sent_at',
        order: 'desc'
      });

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] findRecent booking_notifications - ${result.length} rows - ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error(`[DB Error] findRecent booking_notifications:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: 'booking_notifications',
          operation: 'findRecent'
        },
        extra: {
          recordId,
          windowMs,
          types,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw error;
    }
  }

  /**
   * Check if notification was already sent (duplicate check)
   *
   * @param {number} recordId - YClients record ID
   * @param {string} type - Notification type
   * @param {number} windowMs - Time window in milliseconds (default: 24 hours)
   * @returns {Promise<boolean>} True if notification exists within window
   *
   * @example
   * const isDup = await notificationRepo.isDuplicate(1434631767, 'reminder_day_before');
   */
  async isDuplicate(recordId, type, windowMs = 24 * 60 * 60 * 1000) {
    const recent = await this.findRecent(recordId, windowMs, [type]);
    return recent.length > 0;
  }

  /**
   * Create new notification record
   *
   * Uses raw INSERT (not upsert) because:
   * - Duplicates should never happen (business logic error)
   * - UNIQUE constraint at DB level is the last line of defense
   * - Returning null on duplicate (error code 23505) is safe fallback
   *
   * @param {Object} data - Notification data
   * @param {number} data.yclients_record_id - YClients record ID (required)
   * @param {number} data.company_id - Company ID (required)
   * @param {string} data.phone - Client phone number (required)
   * @param {string} data.notification_type - Type of notification (required)
   * @param {string} data.message - Notification message text
   * @param {string} data.status - Status (default: 'sent')
   * @returns {Promise<Object|null>} Created record or null if duplicate
   *
   * @example
   * const notification = await notificationRepo.create({
   *   yclients_record_id: 1434631767,
   *   company_id: 962302,
   *   phone: '79161417382',
   *   notification_type: 'reminder_day_before',
   *   message: 'Напоминаем о записи завтра...'
   * });
   */
  async create(data) {
    const startTime = Date.now();

    // Validate required fields
    if (!data.yclients_record_id) {
      throw new Error('yclients_record_id is required');
    }
    if (!data.company_id) {
      throw new Error('company_id is required');
    }
    if (!data.phone) {
      throw new Error('phone is required');
    }
    if (!data.notification_type) {
      throw new Error('notification_type is required');
    }

    try {
      // notification_date is set by DB default to CURRENT_DATE
      const columns = [
        'yclients_record_id',
        'company_id',
        'phone',
        'notification_type',
        'message',
        'status',
        'notification_date'
      ];

      const values = [
        data.yclients_record_id,
        data.company_id,
        data.phone,
        data.notification_type,
        data.message || null,
        data.status || 'sent',
        'CURRENT_DATE' // Will be replaced with actual SQL
      ];

      // Build INSERT query with CURRENT_DATE for notification_date
      const sql = `
        INSERT INTO booking_notifications
          (yclients_record_id, company_id, phone, notification_type, message, status, notification_date)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
        RETURNING *
      `;

      const result = await this.db.query(sql, [
        data.yclients_record_id,
        data.company_id,
        data.phone,
        data.notification_type,
        data.message || null,
        data.status || 'sent'
      ]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] create booking_notifications - ${duration}ms`);
      }

      return result.rows[0];
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle duplicate key error gracefully (code 23505)
      if (error.code === '23505') {
        console.log(`[DB] Duplicate notification prevented: record=${data.yclients_record_id}, type=${data.notification_type}`);
        return null;
      }

      console.error(`[DB Error] create booking_notifications:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: 'booking_notifications',
          operation: 'create'
        },
        extra: {
          yclients_record_id: data.yclients_record_id,
          company_id: data.company_id,
          notification_type: data.notification_type,
          duration: `${duration}ms`
        }
      });
      throw error;
    }
  }

  /**
   * Find notifications sent today for a record
   *
   * Useful for checking if reminder was already sent today
   *
   * @param {number} recordId - YClients record ID
   * @param {Array<string>} types - Optional array of notification types to filter
   * @returns {Promise<Array>} Array of today's notification records
   *
   * @example
   * const todaysReminders = await notificationRepo.findSentToday(
   *   1434631767,
   *   ['reminder_day_before', 'reminder_2hours']
   * );
   */
  async findSentToday(recordId, types = null) {
    // Calculate start of today (midnight) for the window
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const windowMs = now.getTime() - startOfToday.getTime();

    return this.findRecent(recordId, windowMs + 1000, types); // +1s buffer
  }

  /**
   * Count notifications by type within a time window
   *
   * Useful for monitoring and debugging
   *
   * @param {number} companyId - Company ID
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Promise<Array>} Array of { notification_type, count }
   *
   * @example
   * const stats = await notificationRepo.countByType(962302, 24 * 60 * 60 * 1000);
   */
  async countByType(companyId, windowMs = 24 * 60 * 60 * 1000) {
    const startTime = Date.now();

    try {
      const cutoffTime = new Date(Date.now() - windowMs).toISOString();

      const sql = `
        SELECT notification_type, COUNT(*) as count
        FROM booking_notifications
        WHERE company_id = $1 AND sent_at >= $2
        GROUP BY notification_type
        ORDER BY count DESC
      `;

      const result = await this.db.query(sql, [companyId, cutoffTime]);

      const duration = Date.now() - startTime;
      if (process.env.LOG_DATABASE_CALLS === 'true') {
        console.log(`[DB] countByType booking_notifications - ${result.rows.length} types - ${duration}ms`);
      }

      return result.rows;
    } catch (error) {
      console.error(`[DB Error] countByType booking_notifications:`, error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'repository',
          table: 'booking_notifications',
          operation: 'countByType'
        },
        extra: {
          companyId,
          windowMs,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw error;
    }
  }
}

module.exports = BookingNotificationRepository;
