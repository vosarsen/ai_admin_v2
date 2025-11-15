/**
 * ClientRepository - Client data access layer
 *
 * Maps to SupabaseDataLayer client methods:
 * - getClientByPhone → findByPhone
 * - getClientById → findById
 * - getClientAppointments → findAppointments
 * - getUpcomingAppointments → findUpcoming
 * - searchClientsByName → searchByName
 * - upsertClient → upsert
 * - upsertClients → bulkUpsert
 *
 * @class ClientRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class ClientRepository extends BaseRepository {
  /**
   * Find client by phone number
   * Maps to: SupabaseDataLayer.getClientByPhone()
   *
   * @param {string} phone - Client phone number
   * @returns {Promise<Object|null>} Client record or null
   *
   * @example
   * const client = await clientRepo.findByPhone('89686484488');
   */
  async findByPhone(phone) {
    return this.findOne('clients', { phone });
  }

  /**
   * Find client by YClients ID and company
   * Maps to: SupabaseDataLayer.getClientById()
   *
   * @param {number} yclientsId - YClients client ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Client record or null
   *
   * @example
   * const client = await clientRepo.findById(12345, 962302);
   */
  async findById(yclientsId, companyId) {
    return this.findOne('clients', {
      yclients_id: yclientsId,
      company_id: companyId
    });
  }

  /**
   * Find client appointments with optional filters
   * Maps to: SupabaseDataLayer.getClientAppointments()
   *
   * @param {string} clientPhone - Client phone number
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Filter appointments after this date
   * @param {string} options.endDate - Filter appointments before this date
   * @param {number} options.limit - Maximum results (default: 10)
   * @returns {Promise<Array>} Array of booking records
   *
   * @example
   * const appointments = await clientRepo.findAppointments('89001234567', {
   *   startDate: '2025-11-01',
   *   endDate: '2025-11-30',
   *   limit: 20
   * });
   */
  async findAppointments(clientPhone, options = {}) {
    const { startDate, endDate, limit = 10 } = options;

    const filters = { client_phone: clientPhone };

    if (startDate && endDate) {
      filters.datetime = { gte: startDate, lte: endDate };
    } else if (startDate) {
      filters.datetime = { gte: startDate };
    } else if (endDate) {
      filters.datetime = { lte: endDate };
    }

    return this.findMany('bookings', filters, {
      orderBy: 'datetime',
      order: 'desc',
      limit
    });
  }

  /**
   * Find upcoming appointments for client
   * Maps to: SupabaseDataLayer.getUpcomingAppointments()
   *
   * @param {string} clientPhone - Client phone number
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Array of future booking records
   *
   * @example
   * const upcoming = await clientRepo.findUpcoming('89001234567', 962302);
   */
  async findUpcoming(clientPhone, companyId) {
    const now = new Date().toISOString();

    return this.findMany('bookings', {
      client_phone: clientPhone,
      company_id: companyId,
      datetime: { gte: now },
      status: { neq: 'deleted' }
    }, {
      orderBy: 'datetime',
      order: 'asc'
    });
  }

  /**
   * Search clients by name (case-insensitive)
   * Maps to: SupabaseDataLayer.searchClientsByName()
   *
   * @param {number} companyId - Company ID
   * @param {string} name - Search query
   * @param {number} limit - Maximum results (default: 100)
   * @returns {Promise<Array>} Array of matching client records
   *
   * @example
   * const clients = await clientRepo.searchByName(962302, 'Иван', 10);
   */
  async searchByName(companyId, name, limit = 100) {
    // Use custom SQL for ILIKE with NULLS LAST (matches Supabase behavior)
    const sql = `
      SELECT * FROM clients
      WHERE company_id = $1 AND name ILIKE $2
      ORDER BY last_visit_date DESC NULLS LAST
      LIMIT $3
    `;

    const result = await this.db.query(sql, [companyId, `%${name}%`, limit]);
    return result.rows;
  }

  /**
   * Insert or update a single client
   * Maps to: SupabaseDataLayer.upsertClient()
   *
   * @param {Object} clientData - Client data
   * @returns {Promise<Object>} Inserted/updated client record
   *
   * @example
   * const client = await clientRepo.upsert({
   *   yclients_id: 123,
   *   company_id: 962302,
   *   name: 'Иван Иванов',
   *   phone: '89001234567'
   * });
   */
  async upsert(clientData) {
    return super.upsert('clients', clientData, ['yclients_id', 'company_id']);
  }

  /**
   * Bulk insert or update multiple clients
   * Maps to: SupabaseDataLayer.upsertClients()
   *
   * @param {Array<Object>} clientsArray - Array of client data
   * @returns {Promise<Array>} Inserted/updated client records
   *
   * @example
   * const clients = await clientRepo.bulkUpsert([
   *   { yclients_id: 1, company_id: 962302, name: 'Client 1', phone: '89001' },
   *   { yclients_id: 2, company_id: 962302, name: 'Client 2', phone: '89002' }
   * ]);
   */
  async bulkUpsert(clientsArray) {
    return super.bulkUpsert('clients', clientsArray, ['yclients_id', 'company_id']);
  }
}

module.exports = ClientRepository;
