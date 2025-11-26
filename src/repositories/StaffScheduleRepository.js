/**
 * StaffScheduleRepository - Staff schedule data access layer
 *
 * Maps to SupabaseDataLayer staff schedule methods:
 * - getStaffSchedules → findSchedules
 * - getStaffSchedule → findSchedule
 * - upsertStaffSchedules → bulkUpsert
 *
 * @class StaffScheduleRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class StaffScheduleRepository extends BaseRepository {
  /**
   * Find staff schedules with complex filters
   * Maps to: SupabaseDataLayer.getStaffSchedules()
   *
   * @param {Object} query - Query filters
   * @param {number} query.companyId - Company ID (required)
   * @param {number} query.staffId - Staff YClients ID (optional)
   * @param {string} query.dateFrom - Start date (optional)
   * @param {string} query.dateTo - End date (optional)
   * @param {boolean} query.isWorking - Filter by working status (optional)
   * @returns {Promise<Array>} Array of schedule records
   *
   * @example
   * const schedules = await scheduleRepo.findSchedules({
   *   companyId: 962302,
   *   staffId: 123,
   *   dateFrom: '2025-11-01',
   *   dateTo: '2025-11-30',
   *   isWorking: true
   * });
   */
  async findSchedules(query) {
    const { companyId, staffId, dateFrom, dateTo, isWorking } = query;

    const filters = { company_id: companyId };

    if (staffId !== undefined) {
      filters.yclients_staff_id = staffId;
    }

    if (dateFrom && dateTo) {
      filters.date = { gte: dateFrom, lte: dateTo };
    } else if (dateFrom) {
      filters.date = { gte: dateFrom };
    } else if (dateTo) {
      filters.date = { lte: dateTo };
    }

    if (isWorking !== undefined) {
      filters.is_working = isWorking;
    }

    return this.findMany('staff_schedules', filters, {
      orderBy: 'date',
      order: 'asc'
    });
  }

  /**
   * Find single staff schedule for specific date
   * Maps to: SupabaseDataLayer.getStaffSchedule()
   *
   * @param {number} staffId - Staff YClients ID
   * @param {string} date - Schedule date (YYYY-MM-DD)
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Schedule record or null
   *
   * @example
   * const schedule = await scheduleRepo.findSchedule(123, '2025-11-10', 962302);
   */
  async findSchedule(staffId, date, companyId) {
    return this.findOne('staff_schedules', {
      yclients_staff_id: staffId,
      date,
      company_id: companyId
    });
  }

  /**
   * Bulk insert or update staff schedules
   * Maps to: SupabaseDataLayer.upsertStaffSchedules()
   *
   * Note: Uses 3-column conflict key (staff_id, date, company_id)
   *
   * @param {Array<Object>} schedulesArray - Array of schedule data
   * @returns {Promise<Array>} Inserted/updated schedule records
   *
   * @example
   * const schedules = await scheduleRepo.bulkUpsert([
   *   { yclients_staff_id: 1, date: '2025-11-10', company_id: 962302, is_working: true },
   *   { yclients_staff_id: 1, date: '2025-11-11', company_id: 962302, is_working: false }
   * ]);
   */
  async bulkUpsert(schedulesArray) {
    return super.bulkUpsert(
      'staff_schedules',
      schedulesArray,
      ['yclients_staff_id', 'date', 'company_id']
    );
  }

  /**
   * Bulk upsert schedules with automatic batching for sync operations
   *
   * Designed for schedules-sync.js to handle ~500 schedules efficiently.
   * Uses larger batch size (200) since schedules are simpler records.
   *
   * @param {Array<Object>} schedulesArray - Array of schedule data
   * @param {Object} options - { batchSize: 200 }
   * @returns {Promise<Object>} { success: boolean, count: number, duration: number }
   *
   * @example
   * const result = await scheduleRepo.syncBulkUpsert(schedulesFromYClients);
   */
  async syncBulkUpsert(schedulesArray, options = {}) {
    return super.bulkUpsertBatched(
      'staff_schedules',
      schedulesArray,
      ['yclients_staff_id', 'date', 'company_id'],
      { batchSize: options.batchSize || 200 }
    );
  }
}

module.exports = StaffScheduleRepository;
