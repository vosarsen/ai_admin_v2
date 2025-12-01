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

  /**
   * Find active staff YClients IDs for a company
   * Used by data-loader.js for schedule loading
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<Array<number>>} Array of YClients staff IDs
   *
   * @example
   * const ids = await staffRepo.findActiveIds(962302);
   * // [2895125, 2895126, ...]
   */
  async findActiveIds(companyId) {
    const sql = `
      SELECT yclients_id FROM staff
      WHERE company_id = $1 AND is_active = true
    `;
    const result = await this.db.query(sql, [companyId]);
    return result.rows.map(row => row.yclients_id);
  }

  /**
   * Find staff names by YClients IDs
   * Used by data-loader.js for favorite staff display
   *
   * @param {Array<number>} yclientsIds - Array of YClients staff IDs
   * @param {number} companyId - Company ID
   * @returns {Promise<Array<string>>} Array of staff names
   *
   * @example
   * const names = await staffRepo.findNamesByYclientsIds([2895125, 2895126], 962302);
   * // ['Бари', 'Дмитрий']
   */
  async findNamesByYclientsIds(yclientsIds, companyId) {
    if (!yclientsIds || yclientsIds.length === 0) {
      return [];
    }

    const sql = `
      SELECT yclients_id, name FROM staff
      WHERE company_id = $1 AND yclients_id = ANY($2)
    `;
    const result = await this.db.query(sql, [companyId, yclientsIds]);
    return result.rows.map(row => row.name);
  }

  /**
   * Deactivate all staff for a company (before sync)
   * Used by staff-sync.js before bulk upsert
   *
   * @param {number} companyId - Company ID
   * @returns {Promise<void>}
   *
   * @example
   * await staffRepo.deactivateAll(962302);
   */
  async deactivateAll(companyId) {
    const sql = `
      UPDATE staff
      SET is_active = false, last_sync_at = NOW()
      WHERE company_id = $1
    `;
    await this.db.query(sql, [companyId]);
  }
}

module.exports = StaffRepository;
