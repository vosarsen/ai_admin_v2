/**
 * Telegram Manager - Unified Architecture for Telegram Business Bot
 *
 * Manages Telegram Business Bot connections and message routing.
 * Works in tandem with telegram-bot.js (grammY client).
 *
 * Architecture: API → Telegram Manager → Telegram Bot (grammY) → Telegram API
 *
 * Key responsibilities:
 * - Initialize and manage bot lifecycle
 * - Map business_connection_id to company_id
 * - Route incoming messages to AI processing queue
 * - Handle outgoing messages via business connections
 * - Track metrics and health
 */

const telegramBot = require('./telegram-bot');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-manager' });
const messageQueue = require('../../queue/message-queue');
const postgres = require('../../database/postgres');
const { TelegramConnectionRepository, TelegramLinkingRepository } = require('../../repositories');
const Sentry = require('@sentry/node');
const {
  TelegramConfigError,
  TelegramConnectionNotFoundError,
  TelegramActivityWindowError,
  TelegramErrorHandler
} = require('../../utils/telegram-errors');

class TelegramManager {
  constructor() {
    this.isInitialized = false;
    this.connectionRepository = null;
    this.linkingRepository = null;

    // Cache for business_connection_id → company_id mapping
    // Reduces database lookups for high-frequency operations
    this.connectionCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes

    // Cache for telegram_user_id → company_id mapping (for linking resolution)
    this.userLinkCache = new Map();
    this.userLinkCacheTTL = 5 * 60 * 1000; // 5 minutes

    // Metrics
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      messagesQueued: 0,
      connectionLookups: 0,
      cacheHits: 0,
      errors: 0,
      startTime: null
    };

    // Singleton pattern
    if (TelegramManager.instance) {
      return TelegramManager.instance;
    }
    TelegramManager.instance = this;
  }

  /**
   * Initialize Telegram Manager and Bot
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Telegram Manager already initialized');
      return true;
    }

    if (!config.telegram.enabled) {
      logger.info('Telegram integration is disabled');
      return false;
    }

    try {
      logger.info('🚀 Initializing Telegram Manager...');

      // Initialize repositories
      this.connectionRepository = new TelegramConnectionRepository(postgres);
      this.linkingRepository = new TelegramLinkingRepository(postgres);

      // Initialize bot
      const botInitialized = await telegramBot.initialize();
      if (!botInitialized) {
        logger.error('Failed to initialize Telegram bot');
        return false;
      }

      // Setup event handlers from bot
      this.setupBotEventHandlers();

      // Load active connections into cache
      await this.warmupCache();

      this.isInitialized = true;
      this.metrics.startTime = Date.now();

      logger.info('✅ Telegram Manager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Telegram Manager:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-manager', operation: 'initialize' }
      });
      return false;
    }
  }

  /**
   * Setup event handlers for bot events
   */
  setupBotEventHandlers() {
    // Handle new business connections (salon connects their account)
    telegramBot.on('business_connection', async (data) => {
      await this.handleBusinessConnection(data);
    });

    // Handle incoming messages from customers
    telegramBot.on('incoming_message', async (data) => {
      await this.handleIncomingMessage(data);
    });

    // Handle user linking complete (from deep link flow)
    telegramBot.on('user_linked', async (data) => {
      this.invalidateUserCache(data.telegramUserId);
      logger.info('User link cache invalidated:', {
        telegramUserId: data.telegramUserId,
        companyId: data.companyId
      });
    });
  }

  /**
   * Handle business connection event (salon connects/disconnects)
   */
  async handleBusinessConnection(data) {
    try {
      logger.info('Processing business connection:', {
        connectionId: data.connectionId,
        userId: data.userId,
        isEnabled: data.isEnabled
      });

      if (data.isEnabled) {
        // New connection - resolve company ID from user link
        const companyId = await this.resolveCompanyId(data.userId);

        if (!companyId) {
          logger.warn('No company linked for Telegram user, cannot save connection:', {
            telegramUserId: data.userId,
            username: data.username
          });
          // Optionally send message to user to link first
          return;
        }

        const connection = await this.connectionRepository.upsertByBusinessConnectionId({
          company_id: companyId,
          business_connection_id: data.connectionId,
          telegram_user_id: data.userId,
          telegram_username: data.username,
          telegram_first_name: data.firstName,
          can_reply: data.canReply,
          connected_at: new Date().toISOString()
        });

        // Update cache
        this.connectionCache.set(data.connectionId, {
          companyId,
          canReply: data.canReply,
          cachedAt: Date.now()
        });

        logger.info('Business connection saved:', {
          connectionId: data.connectionId,
          companyId,
          username: data.username
        });

      } else {
        // Disconnection - deactivate in database
        await this.connectionRepository.deactivateByBusinessConnectionId(data.connectionId);

        // Invalidate cache immediately to prevent stale data
        this.invalidateConnectionCache(data.connectionId);

        logger.info('Business connection deactivated:', {
          connectionId: data.connectionId
        });
      }
    } catch (error) {
      logger.error('Error handling business connection:', error);
      this.metrics.errors++;
      Sentry.captureException(error, {
        tags: { component: 'telegram-manager', operation: 'handleBusinessConnection' },
        extra: { connectionId: data.connectionId }
      });
    }
  }

  /**
   * Resolve company ID for a Telegram user
   *
   * Lookup order:
   * 1. User link cache
   * 2. telegram_user_company_links table
   * 3. Fallback to TELEGRAM_DEFAULT_COMPANY_ID (backward compatibility)
   *
   * @param {number} telegramUserId - Telegram user ID
   * @returns {Promise<number|null>} Company ID or null if not found
   */
  async resolveCompanyId(telegramUserId) {
    // 1. Check user link cache
    const cached = this.userLinkCache.get(telegramUserId);
    if (cached && (Date.now() - cached.cachedAt) < this.userLinkCacheTTL) {
      return cached.companyId;
    }

    // 2. Lookup in telegram_user_company_links
    const link = await this.linkingRepository.findLinkByTelegramUser(telegramUserId);
    if (link?.company_id) {
      // Update cache
      this.userLinkCache.set(telegramUserId, {
        companyId: link.company_id,
        cachedAt: Date.now()
      });
      return link.company_id;
    }

    // 3. Fallback to default (backward compatibility for existing setup)
    if (config.telegram.defaultCompanyId) {
      logger.debug('Using default company ID (fallback):', {
        telegramUserId,
        defaultCompanyId: config.telegram.defaultCompanyId
      });
      return config.telegram.defaultCompanyId;
    }

    return null;
  }

  /**
   * Invalidate user link cache for a specific Telegram user
   * @param {number} telegramUserId - Telegram user ID
   */
  invalidateUserCache(telegramUserId) {
    this.userLinkCache.delete(telegramUserId);
    logger.debug('User link cache invalidated:', { telegramUserId });
  }

  /**
   * Handle incoming message from customer
   */
  async handleIncomingMessage(data) {
    try {
      this.metrics.messagesReceived++;

      const { businessConnectionId, chatId, from, message, messageId } = data;

      // Resolve company ID from business connection
      const connectionInfo = await this.resolveConnection(businessConnectionId);

      if (!connectionInfo) {
        logger.warn('Unknown business connection, cannot route message:', {
          businessConnectionId
        });
        return;
      }

      const { companyId } = connectionInfo;

      // Queue message for AI processing
      const queueResult = await messageQueue.addMessage(companyId, {
        platform: 'telegram',
        from: from,
        chatId: chatId,
        message: message,
        messageId: messageId,
        businessConnectionId: businessConnectionId,
        metadata: data.metadata || {}
      });

      if (queueResult.success) {
        this.metrics.messagesQueued++;
        logger.info('Message queued for processing:', {
          companyId,
          chatId,
          jobId: queueResult.jobId
        });
      } else {
        logger.error('Failed to queue message:', queueResult.error);
        this.metrics.errors++;
      }

    } catch (error) {
      logger.error('Error handling incoming message:', error);
      this.metrics.errors++;
      Sentry.captureException(error, {
        tags: { component: 'telegram-manager', operation: 'handleIncomingMessage' }
      });
    }
  }

  /**
   * Resolve business_connection_id to company info
   * Uses cache to minimize database lookups
   */
  async resolveConnection(businessConnectionId) {
    this.metrics.connectionLookups++;

    // Check cache first
    const cached = this.connectionCache.get(businessConnectionId);
    if (cached && (Date.now() - cached.cachedAt) < this.cacheTTL) {
      this.metrics.cacheHits++;
      return cached;
    }

    // Lookup in database
    const connection = await this.connectionRepository.findByBusinessConnectionId(businessConnectionId);

    if (!connection) {
      return null;
    }

    // Update cache
    const connectionInfo = {
      companyId: connection.company_id,
      canReply: connection.can_reply,
      cachedAt: Date.now()
    };
    this.connectionCache.set(businessConnectionId, connectionInfo);

    return connectionInfo;
  }

  /**
   * Invalidate cache for a specific business connection
   * @param {string} businessConnectionId - Business connection ID to invalidate
   */
  invalidateConnectionCache(businessConnectionId) {
    this.connectionCache.delete(businessConnectionId);
    logger.debug('Cache invalidated for connection:', { businessConnectionId });
  }

  /**
   * Invalidate all cache entries for a specific company
   * @param {number} companyId - Company ID to invalidate cache for
   */
  invalidateCompanyCache(companyId) {
    let invalidatedCount = 0;
    for (const [connId, info] of this.connectionCache.entries()) {
      if (info.companyId === companyId) {
        this.connectionCache.delete(connId);
        invalidatedCount++;
      }
    }
    if (invalidatedCount > 0) {
      logger.debug('Cache invalidated for company:', { companyId, entriesRemoved: invalidatedCount });
    }
  }

  /**
   * Warmup cache with active connections
   */
  async warmupCache() {
    try {
      const activeConnections = await this.connectionRepository.getAllActive();

      for (const conn of activeConnections) {
        this.connectionCache.set(conn.business_connection_id, {
          companyId: conn.company_id,
          canReply: conn.can_reply,
          cachedAt: Date.now()
        });
      }

      logger.info(`Cache warmed up with ${activeConnections.length} connections`);
    } catch (error) {
      logger.warn('Failed to warmup cache:', error.message);
      // Non-critical - cache will be populated on demand
    }
  }

  /**
   * Send message to customer via business connection
   *
   * @param {number} companyId - Company ID
   * @param {number} chatId - Telegram chat ID
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   */
  async sendMessage(companyId, chatId, message, options = {}) {
    if (!this.isInitialized) {
      const error = new TelegramConfigError(
        'Telegram Manager not initialized',
        'manager.initialized'
      );
      throw error;
    }

    try {
      // Get business connection for this company
      const connection = await this.connectionRepository.findByCompanyId(companyId);

      if (!connection) {
        const error = new TelegramConnectionNotFoundError(
          'No Telegram connection for this company',
          companyId
        );
        TelegramErrorHandler.log(error, logger);
        return {
          success: false,
          error: error.message,
          code: error.code
        };
      }

      if (!connection.can_reply) {
        const error = new TelegramActivityWindowError(
          'Cannot reply - 24h activity window expired',
          chatId,
          { companyId }
        );
        TelegramErrorHandler.log(error, logger);
        return {
          success: false,
          error: error.message,
          code: error.code,
          reason: 'chat_inactive'
        };
      }

      // Send via bot
      const result = options.withTyping
        ? await telegramBot.sendWithTyping(chatId, message, connection.business_connection_id, options.typingDelay)
        : await telegramBot.sendMessage(chatId, message, connection.business_connection_id);

      if (result.success) {
        this.metrics.messagesSent++;
      } else {
        this.metrics.errors++;
      }

      return result;

    } catch (error) {
      this.metrics.errors++;

      // Standardize error
      const context = { companyId, chatId };
      const standardizedError = TelegramErrorHandler.standardize(error, context);

      // Log and capture to Sentry
      TelegramErrorHandler.log(standardizedError, logger);
      Sentry.captureException(standardizedError, {
        tags: {
          ...TelegramErrorHandler.getSentryTags(standardizedError, context),
          component: 'telegram-manager',
          operation: 'sendMessage'
        }
      });

      return {
        success: false,
        error: standardizedError.message,
        code: standardizedError.code,
        isRetryable: standardizedError.isRetryable
      };
    }
  }

  /**
   * Send message with typing indicator (natural UX)
   */
  async sendWithTyping(companyId, chatId, message, delayMs = 1500) {
    return this.sendMessage(companyId, chatId, message, {
      withTyping: true,
      typingDelay: delayMs
    });
  }

  /**
   * Get connection status for a company
   */
  async getConnectionStatus(companyId) {
    try {
      const connection = await this.connectionRepository.findByCompanyId(companyId);

      if (!connection) {
        return {
          connected: false,
          error: 'No connection found'
        };
      }

      return {
        connected: true,
        canReply: connection.can_reply,
        telegramUsername: connection.telegram_username,
        connectedAt: connection.connected_at,
        lastUpdated: connection.updated_at
      };

    } catch (error) {
      logger.error('Error getting connection status:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect Telegram from a company
   */
  async disconnect(companyId) {
    try {
      const result = await this.connectionRepository.deactivate(companyId);

      // Invalidate cache immediately to prevent stale data
      this.invalidateCompanyCache(companyId);

      return {
        success: !!result,
        message: result ? 'Disconnected successfully' : 'No active connection found'
      };

    } catch (error) {
      logger.error('Error disconnecting:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all active connections (admin)
   */
  async getAllConnections() {
    try {
      return await this.connectionRepository.getAllActive();
    } catch (error) {
      logger.error('Error getting all connections:', error);
      return [];
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const botMetrics = telegramBot.getMetrics();

    return {
      ...this.metrics,
      bot: botMetrics,
      cacheSize: this.connectionCache.size,
      cacheHitRate: this.metrics.connectionLookups > 0
        ? (this.metrics.cacheHits / this.metrics.connectionLookups * 100).toFixed(2) + '%'
        : '0%',
      uptimeMs: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0,
      uptimeHours: this.metrics.startTime
        ? ((Date.now() - this.metrics.startTime) / (1000 * 60 * 60)).toFixed(2)
        : 0
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isInitialized) {
      return {
        healthy: false,
        error: 'Manager not initialized'
      };
    }

    try {
      // Check bot health
      const botHealth = await telegramBot.healthCheck();

      // Check database connectivity
      const connectionCount = await this.connectionRepository.countActive();

      return {
        healthy: botHealth.healthy,
        bot: botHealth,
        database: {
          connected: true,
          activeConnections: connectionCount
        },
        cache: {
          size: this.connectionCache.size,
          hitRate: this.metrics.connectionLookups > 0
            ? (this.metrics.cacheHits / this.metrics.connectionLookups * 100).toFixed(2) + '%'
            : 'N/A'
        },
        metrics: this.getMetrics()
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Set webhook URL
   */
  async setWebhook(url) {
    return telegramBot.setWebhook(url);
  }

  /**
   * Get webhook handler for Express
   */
  getWebhookHandler() {
    return telegramBot.getWebhookHandler();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Telegram Manager...');

    await telegramBot.shutdown();

    this.isInitialized = false;
    this.connectionCache.clear();

    logger.info('Telegram Manager shutdown complete');
  }
}

// Export singleton instance
const telegramManager = new TelegramManager();
module.exports = telegramManager;
