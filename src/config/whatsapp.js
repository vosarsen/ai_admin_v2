/**
 * WhatsApp Multi-Tenant Configuration
 * All settings configurable via environment variables
 * No hardcoded values for production readiness
 */

const path = require('path');

// Validate required environment variables
const validateConfig = () => {
  const errors = [];

  // These are optional but recommended to be set
  const warnings = [];

  if (!process.env.WHATSAPP_PROVIDER) {
    warnings.push('WHATSAPP_PROVIDER not set, defaulting to "baileys"');
  }

  if (!process.env.WHATSAPP_SESSIONS_PATH) {
    warnings.push('WHATSAPP_SESSIONS_PATH not set, using default "./sessions"');
  }

  // Log warnings
  warnings.forEach(warn => console.warn(`⚠️  Config Warning: ${warn}`));

  // Throw if critical errors
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
};

// Validate on load
validateConfig();

module.exports = {
  // Provider configuration
  provider: process.env.WHATSAPP_PROVIDER || 'baileys',

  // Paths
  paths: {
    sessions: process.env.WHATSAPP_SESSIONS_PATH || path.join(process.cwd(), 'sessions'),
    backups: process.env.WHATSAPP_BACKUPS_PATH || path.join(process.cwd(), 'whatsapp-backups'),
  },

  // Session management
  session: {
    // TTL settings (in milliseconds)
    ttl: parseInt(process.env.WHATSAPP_SESSION_TTL || '3600000'), // 1 hour
    authStateTTL: parseInt(process.env.WHATSAPP_AUTH_STATE_TTL || '7200000'), // 2 hours
    pairingCodeTTL: parseInt(process.env.WHATSAPP_PAIRING_CODE_TTL || '60000'), // 60 seconds
    reconnectTTL: parseInt(process.env.WHATSAPP_RECONNECT_TTL || '1800000'), // 30 minutes
    qrGenerationTTL: parseInt(process.env.WHATSAPP_QR_TTL || '3600000'), // 1 hour
    connectionStateTTL: parseInt(process.env.WHATSAPP_CONNECTION_STATE_TTL || '1800000'), // 30 minutes

    // Cleanup intervals (in milliseconds)
    cleanupInterval: parseInt(process.env.WHATSAPP_CLEANUP_INTERVAL || '60000'), // 1 minute
    authCleanupInterval: parseInt(process.env.WHATSAPP_AUTH_CLEANUP_INTERVAL || '120000'), // 2 minutes
    pairingCleanupInterval: parseInt(process.env.WHATSAPP_PAIRING_CLEANUP_INTERVAL || '10000'), // 10 seconds

    // Max listeners for EventEmitter
    maxListeners: parseInt(process.env.WHATSAPP_MAX_LISTENERS || '20'),
  },

  // Connection settings
  connection: {
    // Reconnection settings
    maxReconnectAttempts: parseInt(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || '10'),
    reconnectDelay: parseInt(process.env.WHATSAPP_RECONNECT_DELAY || '5000'), // 5 seconds
    maxReconnectDelay: parseInt(process.env.WHATSAPP_MAX_RECONNECT_DELAY || '60000'), // 1 minute
    reconnectBackoffMultiplier: parseFloat(process.env.WHATSAPP_RECONNECT_BACKOFF || '1.5'),

    // Keep-alive settings
    keepAliveIntervalMs: parseInt(process.env.WHATSAPP_KEEPALIVE_INTERVAL || '30000'), // 30 seconds
    connectionTimeoutMs: parseInt(process.env.WHATSAPP_CONNECTION_TIMEOUT || '60000'), // 1 minute

    // QR and Pairing Code settings
    maxQRAttempts: parseInt(process.env.WHATSAPP_MAX_QR_ATTEMPTS || '3'),
    usePairingCode: process.env.WHATSAPP_USE_PAIRING_CODE === 'true',
    qrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT || '60000'), // 60 seconds
  },

  // Multi-tenant settings
  multiTenant: {
    // Whether to enable multi-tenant mode
    enabled: process.env.WHATSAPP_MULTI_TENANT !== 'false', // Default true

    // Max sessions per server instance
    maxSessions: parseInt(process.env.WHATSAPP_MAX_SESSIONS || '1000'),

    // Session isolation
    isolateAuth: process.env.WHATSAPP_ISOLATE_AUTH !== 'false', // Default true

    // Company validation
    validateCompanyId: process.env.WHATSAPP_VALIDATE_COMPANY !== 'false', // Default true
    companyIdPattern: process.env.WHATSAPP_COMPANY_ID_PATTERN || '^[a-zA-Z0-9_-]+$',

    // Rate limiting per company
    rateLimitPerCompany: parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_COMPANY || '100'), // messages per minute
    rateLimitWindow: parseInt(process.env.WHATSAPP_RATE_LIMIT_WINDOW || '60000'), // 1 minute
  },

  // Security settings
  security: {
    // Webhook validation
    validateWebhooks: process.env.WHATSAPP_VALIDATE_WEBHOOKS !== 'false', // Default true
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET, // Should be set in production

    // Message encryption (for stored messages)
    encryptMessages: process.env.WHATSAPP_ENCRYPT_MESSAGES === 'true',
    encryptionKey: process.env.WHATSAPP_ENCRYPTION_KEY, // Required if encryption enabled

    // Allowed phone number patterns (regex)
    allowedPhonePattern: process.env.WHATSAPP_ALLOWED_PHONE_PATTERN || '^[0-9]{10,15}$',

    // Blocked numbers (comma-separated)
    blockedNumbers: process.env.WHATSAPP_BLOCKED_NUMBERS ?
      process.env.WHATSAPP_BLOCKED_NUMBERS.split(',').map(n => n.trim()) : [],
  },

  // Monitoring and metrics
  monitoring: {
    // Enable metrics collection
    metricsEnabled: process.env.WHATSAPP_METRICS_ENABLED !== 'false', // Default true
    metricsInterval: parseInt(process.env.WHATSAPP_METRICS_INTERVAL || '60000'), // 1 minute

    // Health check settings
    healthCheckEnabled: process.env.WHATSAPP_HEALTH_CHECK_ENABLED !== 'false', // Default true
    healthCheckInterval: parseInt(process.env.WHATSAPP_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
    healthCheckTimeout: parseInt(process.env.WHATSAPP_HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds

    // Alerting
    alertingEnabled: process.env.WHATSAPP_ALERTING_ENABLED === 'true',
    alertWebhook: process.env.WHATSAPP_ALERT_WEBHOOK,
    alertThresholds: {
      errorRate: parseFloat(process.env.WHATSAPP_ALERT_ERROR_RATE || '0.1'), // 10%
      disconnectionRate: parseFloat(process.env.WHATSAPP_ALERT_DISCONNECT_RATE || '0.2'), // 20%
      memoryUsageMB: parseInt(process.env.WHATSAPP_ALERT_MEMORY_MB || '500'), // 500MB
    },
  },

  // Logging settings
  logging: {
    level: process.env.WHATSAPP_LOG_LEVEL || 'info',
    logToFile: process.env.WHATSAPP_LOG_TO_FILE === 'true',
    logPath: process.env.WHATSAPP_LOG_PATH || path.join(process.cwd(), 'logs', 'whatsapp.log'),
    maxLogSize: process.env.WHATSAPP_MAX_LOG_SIZE || '10M',
    maxLogFiles: parseInt(process.env.WHATSAPP_MAX_LOG_FILES || '5'),

    // Debug settings
    debugBaileys: process.env.WHATSAPP_DEBUG_BAILEYS === 'true',
    debugSessions: process.env.WHATSAPP_DEBUG_SESSIONS === 'true',
    debugMessages: process.env.WHATSAPP_DEBUG_MESSAGES === 'true',
  },

  // Feature flags
  features: {
    // Enable pairing code feature
    pairingCode: process.env.WHATSAPP_FEATURE_PAIRING_CODE !== 'false', // Default true

    // Enable auto-recovery
    autoRecovery: process.env.WHATSAPP_FEATURE_AUTO_RECOVERY !== 'false', // Default true

    // Enable message batching
    messageBatching: process.env.WHATSAPP_FEATURE_BATCHING !== 'false', // Default true
    batchSize: parseInt(process.env.WHATSAPP_BATCH_SIZE || '10'),
    batchTimeout: parseInt(process.env.WHATSAPP_BATCH_TIMEOUT || '1000'), // 1 second

    // Enable message deduplication
    deduplication: process.env.WHATSAPP_FEATURE_DEDUP !== 'false', // Default true
    dedupWindow: parseInt(process.env.WHATSAPP_DEDUP_WINDOW || '5000'), // 5 seconds

    // Enable session pooling
    sessionPooling: process.env.WHATSAPP_FEATURE_POOLING !== 'false', // Default true
    poolSize: parseInt(process.env.WHATSAPP_POOL_SIZE || '5'),
  },

  // Default company settings (used only for backwards compatibility)
  defaults: {
    // This should NOT be a hardcoded company ID
    // Only used as fallback for single-tenant deployments
    singleTenantCompanyId: process.env.DEFAULT_COMPANY_ID || null,
  },

  // Helper functions
  isMultiTenant() {
    return this.multiTenant.enabled;
  },

  validateCompanyId(companyId) {
    if (!this.multiTenant.validateCompanyId) return true;
    if (!companyId || typeof companyId !== 'string') return false;
    const pattern = new RegExp(this.multiTenant.companyIdPattern);
    return pattern.test(companyId);
  },

  validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const pattern = new RegExp(this.security.allowedPhonePattern);
    return pattern.test(phone) && !this.security.blockedNumbers.includes(phone);
  },

  getSessionPath(companyId) {
    if (!this.validateCompanyId(companyId)) {
      throw new Error(`Invalid company ID: ${companyId}`);
    }
    return path.join(this.paths.sessions, `company_${companyId}`);
  },

  getBackupPath(companyId) {
    if (!this.validateCompanyId(companyId)) {
      throw new Error(`Invalid company ID: ${companyId}`);
    }
    return path.join(this.paths.backups, `company_${companyId}`);
  },
};