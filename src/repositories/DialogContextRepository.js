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

  /**
   * Find dialog context by user ID and company
   * Used by data-loader.js for conversation loading
   *
   * @param {string} userId - User ID (phone number)
   * @param {number} companyId - Company ID
   * @returns {Promise<Object|null>} Dialog context record or null
   *
   * @example
   * const context = await contextRepo.findByUserIdAndCompany('79686484488', 962302);
   */
  async findByUserIdAndCompany(userId, companyId) {
    const sql = `
      SELECT * FROM dialog_contexts
      WHERE user_id = $1 AND company_id = $2
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(sql, [userId, companyId]);
    return result.rows[0] || null;
  }

  /**
   * Upsert dialog context with messages
   * Used by data-loader.js for saving conversation
   *
   * @param {string} userId - User ID (phone number)
   * @param {number} companyId - Company ID
   * @param {Array} messages - Conversation messages
   * @param {string|null} lastCommand - Last executed command
   * @returns {Promise<Object>} Upserted context record
   *
   * @example
   * await contextRepo.upsertWithMessages('79686484488', 962302, messages, 'CHECK_STAFF_SCHEDULE');
   */
  async upsertWithMessages(userId, companyId, messages, lastCommand = null) {
    const sql = `
      INSERT INTO dialog_contexts (user_id, company_id, messages, last_command, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, company_id)
      DO UPDATE SET messages = $3, last_command = $4, updated_at = NOW()
      RETURNING *
    `;
    const result = await this.db.query(sql, [
      userId,
      companyId,
      JSON.stringify(messages),
      lastCommand
    ]);
    return result.rows[0];
  }
}

module.exports = DialogContextRepository;
