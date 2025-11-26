/**
 * StaffRepository - Staff data access layer
 *
 * Maps to SupabaseDataLayer staff methods:
 * - getStaff → findAll
 * - getStaffById → findById
 *
 * @class StaffRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class StaffRepository extends BaseRepository {
  /**
   * Find all staff for a company
   * Maps to: SupabaseDataLayer.getStaff()
   *
   * @param {number} companyId - Company ID
   * @param {boolean} includeInactive - Include fired staff (default: false)
   * @returns {Promise<Array>} Array of staff records
   *
   * @example
   * const staff = await staffRepo.findAll(962302, false);
   */
  async findAll(companyId, includeInactive = false) {
    const filters = { company_id: companyId };

    if (!includeInactive) {
      filters.is_active = true; // is_active=true means NOT fired
    }

    return this.findMany('staff', filters, {
      orderBy: 'name',
      order: 'asc'
    });
  }

  /**
   * Find staff by YClients ID and company
   * Maps to: SupabaseDataLayer.getStaffById()
   *
   * @param {number} staffId - YClients staff ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Staff record or null
   *
   * @example
   * const staff = await staffRepo.findById(123, 962302);
   */
  async findById(staffId, companyId) {
    return this.findOne('staff', {
      yclients_id: staffId,
      company_id: companyId
    });
  }

  /**
   * Bulk insert or update multiple staff members
   *
   * @param {Array<Object>} staffArray - Array of staff data
   * @returns {Promise<Array>} Inserted/updated staff records
   */
  async bulkUpsert(staffArray) {
    return super.bulkUpsert('staff', staffArray, ['yclients_id', 'company_id']);
  }

  /**
   * Bulk upsert staff with automatic batching for sync operations
   *
   * Designed for staff-sync.js to handle staff efficiently.
   *
   * @param {Array<Object>} staffArray - Array of staff data
   * @param {Object} options - { batchSize: 50 }
   * @returns {Promise<Object>} { success: boolean, count: number, duration: number }
   *
   * @example
   * const result = await staffRepo.syncBulkUpsert(staffFromYClients);
   */
  async syncBulkUpsert(staffArray, options = {}) {
    return super.bulkUpsertBatched(
      'staff',
      staffArray,
      ['yclients_id', 'company_id'],
      { batchSize: options.batchSize || 50 }
    );
  }
}

module.exports = StaffRepository;
