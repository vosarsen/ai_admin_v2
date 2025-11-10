/**
 * DialogContextRepository - Dialog context data access layer
 *
 * Maps to SupabaseDataLayer dialog context methods:
 * - getDialogContext → findByUserId
 * - upsertDialogContext → upsert
 *
 * @class DialogContextRepository
 * @extends BaseRepository
 */
const BaseRepository = require('./BaseRepository');

class DialogContextRepository extends BaseRepository {
  /**
   * Find dialog context by user ID
   * Maps to: SupabaseDataLayer.getDialogContext()
   *
   * @param {string} userId - User ID (typically phone number)
   * @returns {Promise<Object|null>} Dialog context record or null
   *
   * @example
   * const context = await contextRepo.findByUserId('89686484488');
   */
  async findByUserId(userId) {
    return this.findOne('dialog_contexts', { user_id: userId });
  }

  /**
   * Insert or update dialog context
   * Maps to: SupabaseDataLayer.upsertDialogContext()
   *
   * @param {Object} contextData - Context data (must include user_id)
   * @returns {Promise<Object>} Inserted/updated context record
   *
   * @example
   * const context = await contextRepo.upsert({
   *   user_id: '89686484488',
   *   context: { stage: 'booking', service_id: 123 },
   *   updated_at: new Date().toISOString()
   * });
   */
  async upsert(contextData) {
    return super.upsert('dialog_contexts', contextData, ['user_id']);
  }
}

module.exports = DialogContextRepository;
