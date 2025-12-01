/**
 * BookingRepository - Booking data access layer
 *
 * Handles booking/appointment data operations:
 * - findByRecordId - Find booking by YClients record ID
 * - findByPhone - Find bookings by client phone
 * - findUpcoming - Find upcoming bookings for a phone
 * - upsert - Create or update booking
 * - updateStatus - Update booking status
 *
 * @class BookingRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class BookingRepository extends BaseRepository {
  /**
   * Find booking by YClients record ID
   *
   * @param {number} recordId - YClients record ID
   * @returns {Promise<Object|null>} Booking record or null
   *
   * @example
   * const booking = await bookingRepo.findByRecordId(1434631767);
   */
  async findByRecordId(recordId) {
    return this.findOne('bookings', { yclients_record_id: recordId });
  }

  /**
   * Find bookings by client phone
   *
   * @param {string} phone - Client phone number
   * @param {Object} options - Query options { orderBy, limit }
   * @returns {Promise<Array>} Array of booking records
   *
   * @example
   * const bookings = await bookingRepo.findByPhone('79161417382', { limit: 10 });
   */
  async findByPhone(phone, options = {}) {
    return this.findMany('bookings', { client_phone: phone }, {
      orderBy: options.orderBy || 'datetime',
      order: options.order || 'desc',
      limit: options.limit || 10
    });
  }

  /**
   * Find upcoming bookings for a phone
   *
   * @param {string} phone - Client phone number
   * @param {Object} options - Query options { limit }
   * @returns {Promise<Array>} Array of upcoming booking records
   *
   * @example
   * const upcoming = await bookingRepo.findUpcoming('79161417382');
   */
  async findUpcoming(phone, options = {}) {
    const now = new Date().toISOString();

    return this.findMany('bookings', {
      client_phone: phone,
      datetime: { gte: now },
      status: 'active'
    }, {
      orderBy: 'datetime',
      order: 'asc',
      limit: options.limit || 10
    });
  }

  /**
   * Create or update booking (upsert)
   *
   * @param {Object} bookingData - Booking data
   * @param {number} bookingData.yclients_record_id - YClients record ID (required)
   * @param {number} bookingData.company_id - Company ID
   * @param {string} bookingData.client_phone - Client phone
   * @param {string} bookingData.client_name - Client name
   * @param {Array} bookingData.services - Service names
   * @param {string} bookingData.datetime - Appointment datetime
   * @param {string} bookingData.status - Booking status
   * @returns {Promise<Object>} Upserted booking record
   *
   * @example
   * const booking = await bookingRepo.upsert({
   *   yclients_record_id: 1434631767,
   *   company_id: 962302,
   *   client_phone: '79161417382',
   *   client_name: 'Ирина',
   *   services: ['СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ'],
   *   datetime: '2025-11-24T15:15:00+03:00',
   *   status: 'active'
   * });
   */
  async upsert(bookingData) {
    if (!bookingData.yclients_record_id) {
      throw new Error('yclients_record_id is required for upsert');
    }
    if (!bookingData.company_id) {
      throw new Error('company_id is required for upsert');
    }

    return super.upsert('bookings', bookingData, ['yclients_record_id', 'company_id']);
  }

  /**
   * Update booking status
   *
   * @param {number} recordId - YClients record ID
   * @param {string} status - New status (active, completed, cancelled)
   * @returns {Promise<Object>} Updated booking record
   *
   * @example
   * await bookingRepo.updateStatus(1434631767, 'completed');
   */
  async updateStatus(recordId, status) {
    const validStatuses = ['active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    return this.update('bookings',
      { yclients_record_id: recordId },
      { status, updated_at: new Date().toISOString() }
    );
  }

  /**
   * Find bookings by date range
   *
   * @param {Object} filters - Filter options
   * @param {number} filters.company_id - Company ID
   * @param {string} filters.startDate - Start date (inclusive)
   * @param {string} filters.endDate - End date (inclusive)
   * @param {string} filters.status - Optional status filter
   * @returns {Promise<Array>} Array of booking records
   *
   * @example
   * const bookings = await bookingRepo.findByDateRange({
   *   company_id: 962302,
   *   startDate: '2025-11-24',
   *   endDate: '2025-12-01'
   * });
   */
  async findByDateRange({ company_id, startDate, endDate, status }) {
    const filters = {
      company_id,
      datetime: {
        gte: startDate,
        lte: endDate
      }
    };

    if (status) {
      filters.status = status;
    }

    return this.findMany('bookings', filters, {
      orderBy: 'datetime',
      order: 'asc'
    });
  }

  /**
   * Bulk insert or update multiple bookings
   *
   * @param {Array<Object>} bookingsArray - Array of booking data
   * @returns {Promise<Array>} Inserted/updated booking records
   */
  async bulkUpsert(bookingsArray) {
    return super.bulkUpsert('bookings', bookingsArray, ['yclients_record_id', 'company_id']);
  }

  /**
   * Bulk upsert bookings with automatic batching for sync operations
   *
   * Designed for bookings-sync.js to handle bookings efficiently.
   * This is the most complex sync as bookings have foreign key dependencies
   * on clients, staff, and services.
   *
   * @param {Array<Object>} bookingsArray - Array of booking data
   * @param {Object} options - { batchSize: 100 }
   * @returns {Promise<Object>} { success: boolean, count: number, duration: number }
   *
   * @example
   * const result = await bookingRepo.syncBulkUpsert(bookingsFromYClients);
   */
  async syncBulkUpsert(bookingsArray, options = {}) {
    return super.bulkUpsertBatched(
      'bookings',
      bookingsArray,
      ['yclients_record_id', 'company_id'],
      { batchSize: options.batchSize || 100 }
    );
  }

  /**
   * Find upcoming bookings by client YClients ID
   * Used by data-loader.js for loadBookings
   *
   * @param {number} clientYclientsId - Client YClients ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Array of upcoming booking records
   *
   * @example
   * const bookings = await bookingRepo.findByClientYclientsId(123456, 962302);
   */
  async findByClientYclientsId(clientYclientsId, companyId) {
    const now = new Date().toISOString();

    const sql = `
      SELECT * FROM bookings
      WHERE client_yclients_id = $1 AND company_id = $2
      AND datetime >= $3
      ORDER BY datetime ASC
      LIMIT 10
    `;
    const result = await this.db.query(sql, [clientYclientsId, companyId, now]);
    return result.rows;
  }

  /**
   * Delete bookings older than specified date
   * Used by bookings-sync.js for cleanup
   *
   * @param {string} beforeDate - Delete bookings before this date (YYYY-MM-DD)
   * @returns {Promise<number>} Number of deleted rows
   *
   * @example
   * const deleted = await bookingRepo.deleteOlderThan('2025-11-24');
   */
  async deleteOlderThan(beforeDate) {
    const sql = `DELETE FROM bookings WHERE date < $1`;
    const result = await this.db.query(sql, [beforeDate]);
    return result.rowCount;
  }
}

module.exports = BookingRepository;
