/**
 * Database Feature Flags Configuration
 *
 * Controls the database backend selection for AI Admin v2.
 *
 * USE_REPOSITORY_PATTERN=true: Uses Timeweb PostgreSQL (via Repository Pattern)
 * USE_LEGACY_SUPABASE=true: Uses Supabase PostgreSQL (legacy SDK)
 *
 * Migration from Supabase to Timeweb PostgreSQL is complete.
 * Repository Pattern is production-ready and tested.
 */

module.exports = {
  /**
   * Enable Repository Pattern abstraction layer
   *
   * When false: Uses Supabase SDK directly (legacy behavior)
   * When true: Uses Repository Pattern with Timeweb PostgreSQL
   *
   * Default: false (safe - uses existing Supabase)
   *
   * Rollback: Set to false to instantly revert to Supabase
   */
  USE_REPOSITORY_PATTERN: process.env.USE_REPOSITORY_PATTERN === 'true',

  /**
   * Continue using legacy Supabase SDK
   *
   * When true: SupabaseDataLayer uses Supabase SDK
   * When false: SupabaseDataLayer uses repositories only
   *
   * Default: true (backward compatible)
   *
   * Note: This flag exists for clarity and future deprecation.
   * In production, USE_REPOSITORY_PATTERN takes precedence.
   */
  USE_LEGACY_SUPABASE: process.env.USE_LEGACY_SUPABASE !== 'false',

  /**
   * Log database operations for debugging
   *
   * When true: Logs all SQL queries and Supabase calls
   * When false: Silent operation
   *
   * Default: false (performance)
   *
   * Use for: Debugging performance issues, query analysis
   */
  LOG_DATABASE_CALLS: process.env.LOG_DATABASE_CALLS === 'true',

  /**
   * Get the current database backend description
   *
   * @returns {string} Human-readable description
   */
  getCurrentBackend() {
    if (this.USE_REPOSITORY_PATTERN) {
      return 'Timeweb PostgreSQL (via Repository Pattern)';
    }
    return 'Supabase PostgreSQL (legacy SDK)';
  },

  /**
   * Check if Supabase is still active
   *
   * @returns {boolean} True if Supabase is being used
   */
  isSupabaseActive() {
    return !this.USE_REPOSITORY_PATTERN;
  },

  /**
   * Check if repositories are active
   *
   * @returns {boolean} True if repositories are being used
   */
  isRepositoryActive() {
    return this.USE_REPOSITORY_PATTERN;
  },

  /**
   * Validate configuration sanity
   *
   * @throws {Error} If configuration is invalid
   */
  validate() {
    // Warn if both are disabled (should never happen)
    if (!this.USE_REPOSITORY_PATTERN && !this.USE_LEGACY_SUPABASE) {
      throw new Error(
        'Invalid config: Both USE_REPOSITORY_PATTERN and USE_LEGACY_SUPABASE are false. At least one must be true.'
      );
    }
  }
};

// Validate configuration on load
module.exports.validate();
