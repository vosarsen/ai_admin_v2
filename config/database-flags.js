/**
 * Database Configuration
 *
 * AI Admin v2 uses Timeweb PostgreSQL via Repository Pattern.
 * Supabase migration completed November 2025.
 *
 * @see docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md
 */

module.exports = {
  /**
   * Log database operations for debugging
   *
   * When true: Logs SQL queries and timings
   * When false: Silent operation
   *
   * Default: false (performance)
   */
  LOG_DATABASE_CALLS: process.env.LOG_DATABASE_CALLS === 'true',

  /**
   * Get the current database backend description
   *
   * @returns {string} Human-readable description
   */
  getCurrentBackend() {
    return 'Timeweb PostgreSQL (via Repository Pattern)';
  },

  /**
   * Check if repositories are active (always true post-migration)
   *
   * @returns {boolean} Always true
   */
  isRepositoryActive() {
    return true;
  }
};
