/**
 * ServiceRepository - Service data access layer
 *
 * Maps to SupabaseDataLayer service methods:
 * - getServices → findAll
 * - getServiceById → findById
 * - getServicesByCategory → findByCategory
 * - upsertServices → bulkUpsert
 *
 * @class ServiceRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class ServiceRepository extends BaseRepository {
  /**
   * Find all services for a company
   * Maps to: SupabaseDataLayer.getServices()
   *
   * @param {number} companyId - Company ID
   * @param {boolean} includeInactive - Include inactive services (default: false)
   * @returns {Promise<Array>} Array of service records
   *
   * @example
   * const services = await serviceRepo.findAll(962302, false);
   */
  async findAll(companyId, includeInactive = false) {
    const filters = { company_id: companyId };

    if (!includeInactive) {
      filters.is_active = true;
    }

    return this.findMany('services', filters, {
      orderBy: 'weight',
      order: 'desc'
    });
  }

  /**
   * Find service by YClients ID and company
   * Maps to: SupabaseDataLayer.getServiceById()
   *
   * @param {number} serviceId - YClients service ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Service record or null
   *
   * @example
   * const service = await serviceRepo.findById(123, 962302);
   */
  async findById(serviceId, companyId) {
    return this.findOne('services', {
      yclients_id: serviceId,
      company_id: companyId
    });
  }

  /**
   * Find services by category
   * Maps to: SupabaseDataLayer.getServicesByCategory()
   *
   * @param {number} companyId - Company ID
   * @param {number} categoryId - Category ID
   * @returns {Promise<Array>} Array of service records
   *
   * @example
   * const services = await serviceRepo.findByCategory(962302, 5);
   */
  async findByCategory(companyId, categoryId) {
    return this.findMany('services', {
      company_id: companyId,
      category_id: categoryId
    }, {
      orderBy: 'weight',
      order: 'desc'
    });
  }

  /**
   * Bulk insert or update multiple services
   * Maps to: SupabaseDataLayer.upsertServices()
   *
   * @param {Array<Object>} servicesArray - Array of service data
   * @returns {Promise<Array>} Inserted/updated service records
   *
   * @example
   * const services = await serviceRepo.bulkUpsert([
   *   { yclients_id: 1, company_id: 962302, name: 'Стрижка', price: 1000 },
   *   { yclients_id: 2, company_id: 962302, name: 'Окрашивание', price: 3000 }
   * ]);
   */
  async bulkUpsert(servicesArray) {
    return super.bulkUpsert('services', servicesArray, ['yclients_id', 'company_id']);
  }

  /**
   * Bulk upsert services with automatic batching for sync operations
   *
   * Designed for services-sync.js to handle ~63 services efficiently.
   *
   * @param {Array<Object>} servicesArray - Array of service data
   * @param {Object} options - { batchSize: 100 }
   * @returns {Promise<Object>} { success: boolean, count: number, duration: number }
   *
   * @example
   * const result = await serviceRepo.syncBulkUpsert(servicesFromYClients);
   */
  async syncBulkUpsert(servicesArray, options = {}) {
    return super.bulkUpsertBatched(
      'services',
      servicesArray,
      ['yclients_id', 'company_id'],
      { batchSize: options.batchSize || 100 }
    );
  }

  /**
   * Find service titles by YClients IDs
   * Used by data-loader.js for favorite services display
   *
   * @param {Array<number>} yclientsIds - Array of YClients service IDs
   * @param {number} companyId - Company ID
   * @returns {Promise<Array<string>>} Array of service titles
   *
   * @example
   * const titles = await serviceRepo.findTitlesByYclientsIds([18356010, 18356011], 962302);
   * // ['Стрижка модельная', 'Окрашивание']
   */
  async findTitlesByYclientsIds(yclientsIds, companyId) {
    if (!yclientsIds || yclientsIds.length === 0) {
      return [];
    }

    const sql = `
      SELECT yclients_id, title FROM services
      WHERE company_id = $1 AND yclients_id = ANY($2)
    `;
    const result = await this.db.query(sql, [companyId, yclientsIds]);
    return result.rows.map(row => row.title);
  }
}

module.exports = ServiceRepository;
