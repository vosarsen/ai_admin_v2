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
}

module.exports = BookingRepository;
