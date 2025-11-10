/**
 * CompanyRepository - Company data access layer
 *
 * Maps to SupabaseDataLayer company methods:
 * - getCompany → findById
 * - upsertCompany → upsert
 *
 * @class CompanyRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class CompanyRepository extends BaseRepository {
  /**
   * Find company by YClients ID
   * Maps to: SupabaseDataLayer.getCompany()
   *
   * @param {number} companyId - YClients company ID
   * @returns {Promise<Object|null>} Company record or null
   *
   * @example
   * const company = await companyRepo.findById(962302);
   */
  async findById(companyId) {
    return this.findOne('companies', { yclients_id: companyId });
  }

  /**
   * Insert or update company
   * Maps to: SupabaseDataLayer.upsertCompany()
   *
   * @param {Object} companyData - Company data (must include yclients_id)
   * @returns {Promise<Object>} Inserted/updated company record
   *
   * @example
   * const company = await companyRepo.upsert({
   *   yclients_id: 962302,
   *   title: 'Салон красоты',
   *   timezone: 'Europe/Moscow',
   *   updated_at: new Date().toISOString()
   * });
   */
  async upsert(companyData) {
    return super.upsert('companies', companyData, ['yclients_id']);
  }
}

module.exports = CompanyRepository;
