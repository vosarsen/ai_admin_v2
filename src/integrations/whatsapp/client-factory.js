// src/integrations/whatsapp/client-factory.js
const config = require('../../config');
const logger = require('../../utils/logger');

class WhatsAppClientFactory {
  constructor() {
    this.client = null;
    this.provider = config.whatsapp.provider;
  }

  /**
   * Get WhatsApp client instance based on configuration
   */
  getClient() {
    if (this.client) {
      return this.client;
    }

    logger.info(`🏭 Creating WhatsApp client with provider: ${this.provider}`);

    switch (this.provider) {
      case 'baileys':
        this.client = require('./baileys-client');
        break;
        
      case 'venom':
        this.client = require('./client');
        break;
        
      default:
        logger.warn(`Unknown WhatsApp provider: ${this.provider}, defaulting to Baileys`);
        this.client = require('./baileys-client');
    }

    logger.info(`✅ WhatsApp client created with ${this.provider} provider`);
    return this.client;
  }

  /**
   * Switch provider at runtime (for testing/migration)
   */
  switchProvider(provider) {
    logger.info(`Switching WhatsApp provider from ${this.provider} to ${provider}`);
    this.provider = provider;
    this.client = null; // Force recreation
    return this.getClient();
  }

  /**
   * Get current provider name
   */
  getCurrentProvider() {
    return this.provider;
  }
}

// Export singleton instance
module.exports = new WhatsAppClientFactory();