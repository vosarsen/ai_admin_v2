/**
 * Sentry Initialization for AI Admin v2
 *
 * CRITICAL: This file MUST be imported first in all entry points:
 * - src/index.js (main API server)
 * - src/workers/index-v2.js (worker process)
 * - All cron job scripts
 *
 * Following Sentry v8 patterns as per error-tracking skill
 */

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',

  // Integrations
  integrations: [
    nodeProfilingIntegration(),
  ],

  // Performance monitoring
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'), // 10% of transactions
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'), // 10% of transactions

  // Additional options
  enabled: process.env.SENTRY_ENABLED !== 'false', // Allow disabling in development

  // Service identification
  serverName: process.env.PM2_INSTANCE_NAME || 'ai-admin-v2',

  // Release tracking
  release: `ai-admin-v2@${require('../package.json').version}`,
});

// Export Sentry for use in other modules
module.exports = Sentry;
