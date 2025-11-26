// src/config/secure-config.js
const secretsManager = require('../utils/secrets-manager');
const logger = require('../utils/logger');

/**
 * Load configuration with secrets management
 */
class SecureConfig {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize secure configuration
   */
  async initialize() {
    if (this.initialized) return;

    logger.info('Loading secure configuration...');

    // Map of secret names to environment variables
    const secretMappings = {
      'venom-api-key': 'VENOM_API_KEY',
      'venom-secret-key': 'VENOM_SECRET_KEY',
      'redis-password': 'REDIS_PASSWORD',
      'yclients-bearer-token': 'YCLIENTS_BEARER_TOKEN',
      'yclients-user-token': 'YCLIENTS_USER_TOKEN',
      'deepseek-api-key': 'DEEPSEEK_API_KEY',
      'postgres-password': 'POSTGRES_PASSWORD',
      'master-key': 'MASTER_KEY'
    };

    // Load secrets
    for (const [secretName, envVar] of Object.entries(secretMappings)) {
      const value = await secretsManager.getSecretOrEnv(secretName, envVar);
      if (value) {
        this.cache.set(envVar, value);
      }
    }

    this.initialized = true;
    logger.info('Secure configuration loaded');
  }

  /**
   * Get a configuration value
   */
  get(key) {
    // First check secure cache
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Fall back to environment
    return process.env[key];
  }

  /**
   * Get all configuration (with secrets masked)
   */
  getAll() {
    const config = {};
    
    // Add environment variables
    for (const [key, value] of Object.entries(process.env)) {
      config[key] = this._maskSensitive(key, value);
    }
    
    // Override with secure values (masked)
    for (const [key, value] of this.cache.entries()) {
      config[key] = this._maskSensitive(key, value);
    }
    
    return config;
  }

  /**
   * Mask sensitive values for logging
   */
  _maskSensitive(key, value) {
    const sensitiveKeys = [
      'KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'API'
    ];
    
    const isSensitive = sensitiveKeys.some(s => key.toUpperCase().includes(s));
    
    if (isSensitive && value && value.length > 4) {
      return value.substring(0, 4) + '****';
    }
    
    return value;
  }
}

// Singleton instance
module.exports = new SecureConfig();