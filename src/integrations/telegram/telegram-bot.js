// src/integrations/telegram/telegram-bot.js
/**
 * Telegram Business Bot Client
 * Uses grammY framework for official Telegram Business Bot API
 *
 * Business Bot allows sending messages on behalf of salon's Telegram account
 * Messages appear as from the salon, not from a bot (no bot label visible to customers)
 */

const { Bot, webhookCallback, GrammyError, HttpError } = require('grammy');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-bot' });
const messageQueue = require('../../queue/message-queue');

class TelegramBot {
  constructor() {
    this.bot = null;
    this.isInitialized = false;
    this.webhookHandler = null;

    // Metrics
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      connectionsActive: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Initialize the Telegram bot
   */
  async initialize() {
    if (!config.telegram.enabled) {
      logger.info('Telegram integration is disabled');
      return false;
    }

    if (!config.telegram.botToken) {
      logger.error('TELEGRAM_BOT_TOKEN is not configured');
      return false;
    }

    if (this.isInitialized) {
      logger.warn('Telegram bot already initialized');
      return true;
    }

    try {
      logger.info('Initializing Telegram Business Bot...');

      this.bot = new Bot(config.telegram.botToken);

      // Setup handlers
      this.setupErrorHandler();
      this.setupBusinessHandlers();
      this.setupCommandHandlers();

      // Create webhook handler for Express
      this.webhookHandler = webhookCallback(this.bot, 'express', {
        secretToken: config.telegram.webhookSecret
      });

      this.isInitialized = true;
      logger.info('Telegram Business Bot initialized successfully');

      return true;
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * Setup global error handler
   */
  setupErrorHandler() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      const error = err.error;

      this.metrics.errors++;

      if (error instanceof GrammyError) {
        logger.error('Telegram API error:', {
          description: error.description,
          error_code: error.error_code,
          method: error.method,
          payload: error.payload
        });
      } else if (error instanceof HttpError) {
        logger.error('HTTP error from Telegram:', {
          status: error.status,
          message: error.message
        });
      } else {
        logger.error('Unknown Telegram error:', error);
      }
    });
  }

  /**
   * Setup business-specific handlers
   * These handle messages when salon connects their account via Business Mode
   */
  setupBusinessHandlers() {
    // Handle when salon owner connects their Telegram account to our bot
    this.bot.on('business_connection', async (ctx) => {
      try {
        const connection = ctx.businessConnection;

        logger.info('Business connection event received:', {
          connection_id: connection.id,
          user_id: connection.user.id,
          username: connection.user.username,
          first_name: connection.user.first_name,
          can_reply: connection.can_reply,
          is_enabled: connection.is_enabled
        });

        // Emit event for external handling (will be processed by TelegramManager)
        this.emit('business_connection', {
          connectionId: connection.id,
          userId: connection.user.id,
          username: connection.user.username,
          firstName: connection.user.first_name,
          canReply: connection.can_reply,
          isEnabled: connection.is_enabled
        });

        if (connection.is_enabled) {
          this.metrics.connectionsActive++;
        } else {
          this.metrics.connectionsActive = Math.max(0, this.metrics.connectionsActive - 1);
        }

      } catch (error) {
        logger.error('Error handling business connection:', error);
        this.metrics.errors++;
      }
    });

    // Handle incoming messages from customers to salon's business account
    this.bot.on('business_message', async (ctx) => {
      try {
        const message = ctx.businessMessage;

        // Only process text messages for now
        if (!message.text) {
          logger.debug('Skipping non-text business message');
          return;
        }

        const businessConnectionId = ctx.businessConnectionId;
        const chatId = message.chat.id;
        const from = message.from;

        logger.info('Business message received:', {
          business_connection_id: businessConnectionId,
          chat_id: chatId,
          from_id: from.id,
          from_username: from.username,
          text: message.text.substring(0, 100) // Log first 100 chars
        });

        this.metrics.messagesReceived++;

        // Queue message for AI processing
        // The companyId will be resolved from business_connection_id by TelegramManager
        await this.queueMessageForProcessing({
          platform: 'telegram',
          businessConnectionId,
          chatId,
          fromId: from.id,
          fromUsername: from.username,
          fromFirstName: from.first_name,
          message: message.text,
          messageId: message.message_id.toString(),
          timestamp: message.date * 1000 // Convert to milliseconds
        });

      } catch (error) {
        logger.error('Error handling business message:', error);
        this.metrics.errors++;
      }
    });

    // Handle edited business messages (optional)
    this.bot.on('edited_business_message', async (ctx) => {
      logger.debug('Business message edited:', {
        message_id: ctx.editedBusinessMessage.message_id
      });
      // For now, we don't process edits
    });

    // Handle deleted business messages (optional)
    this.bot.on('deleted_business_messages', async (ctx) => {
      logger.debug('Business messages deleted');
      // For now, we don't process deletions
    });
  }

  /**
   * Setup bot command handlers (for direct bot interactions, not business)
   */
  setupCommandHandlers() {
    // /start command - when someone starts the bot directly
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        'Привет! Я AI Admin Bot для салонов красоты.\n\n' +
        'Если вы владелец салона, подключите меня через:\n' +
        'Настройки -> Telegram Business -> Чат-бот\n\n' +
        'После подключения я смогу отвечать вашим клиентам от вашего имени!'
      );
    });

    // /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'Я помогаю салонам красоты отвечать клиентам автоматически.\n\n' +
        'Для владельцев салонов:\n' +
        '1. Убедитесь что у вас Telegram Premium\n' +
        '2. Перейдите в Настройки -> Telegram Business\n' +
        '3. В разделе "Чат-бот" подключите этого бота\n' +
        '4. Готово! Я буду отвечать клиентам от вашего имени'
      );
    });

    // /status command - check connection status
    this.bot.command('status', async (ctx) => {
      const stats = this.getMetrics();
      await ctx.reply(
        `Статус бота:\n` +
        `Активных подключений: ${stats.connectionsActive}\n` +
        `Обработано сообщений: ${stats.messagesReceived}\n` +
        `Отправлено ответов: ${stats.messagesSent}\n` +
        `Время работы: ${Math.floor(stats.uptimeHours)}ч`
      );
    });
  }

  /**
   * Queue message for AI processing
   */
  async queueMessageForProcessing(data) {
    try {
      // For now, we'll use a special queue format
      // TelegramManager will resolve companyId from businessConnectionId
      const queueData = {
        platform: 'telegram',
        from: data.fromId.toString(),
        chatId: data.chatId,
        message: data.message,
        messageId: data.messageId,
        timestamp: data.timestamp,
        metadata: {
          businessConnectionId: data.businessConnectionId,
          fromUsername: data.fromUsername,
          fromFirstName: data.fromFirstName,
          platform: 'telegram'
        }
      };

      // Emit event for TelegramManager to handle
      // It will resolve companyId and add to appropriate queue
      this.emit('incoming_message', queueData);

      logger.debug('Message queued for processing');
    } catch (error) {
      logger.error('Failed to queue message:', error);
      throw error;
    }
  }

  /**
   * Send message via business connection
   * @param {number} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {string} businessConnectionId - Business connection ID
   */
  async sendMessage(chatId, text, businessConnectionId) {
    if (!this.isInitialized || !this.bot) {
      throw new Error('Telegram bot is not initialized');
    }

    try {
      const result = await this.bot.api.sendMessage(chatId, text, {
        business_connection_id: businessConnectionId
      });

      this.metrics.messagesSent++;

      logger.debug('Message sent via business connection:', {
        chat_id: chatId,
        message_id: result.message_id
      });

      return {
        success: true,
        messageId: result.message_id.toString()
      };
    } catch (error) {
      logger.error('Failed to send message:', error);
      this.metrics.errors++;

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send typing action (shows "typing..." indicator)
   */
  async sendTypingAction(chatId, businessConnectionId) {
    if (!this.isInitialized || !this.bot) {
      return;
    }

    try {
      await this.bot.api.sendChatAction(chatId, 'typing', {
        business_connection_id: businessConnectionId
      });
    } catch (error) {
      // Typing action failure is not critical
      logger.debug('Failed to send typing action:', error.message);
    }
  }

  /**
   * Send message with typing indicator (more natural UX)
   */
  async sendWithTyping(chatId, text, businessConnectionId, delayMs = 1500) {
    await this.sendTypingAction(chatId, businessConnectionId);

    // Wait a bit to simulate typing
    await new Promise(resolve => setTimeout(resolve, delayMs));

    return this.sendMessage(chatId, text, businessConnectionId);
  }

  /**
   * Get webhook handler for Express middleware
   */
  getWebhookHandler() {
    if (!this.webhookHandler) {
      throw new Error('Webhook handler not initialized. Call initialize() first.');
    }
    return this.webhookHandler;
  }

  /**
   * Set webhook URL (call after bot is running)
   */
  async setWebhook(url) {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.api.setWebhook(url, {
        secret_token: config.telegram.webhookSecret,
        allowed_updates: [
          'message',
          'edited_message',
          'business_connection',
          'business_message',
          'edited_business_message',
          'deleted_business_messages'
        ]
      });

      logger.info('Webhook set successfully:', url);
      return true;
    } catch (error) {
      logger.error('Failed to set webhook:', error);
      return false;
    }
  }

  /**
   * Delete webhook (for switching to polling or shutdown)
   */
  async deleteWebhook() {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.api.deleteWebhook();
      logger.info('Webhook deleted');
    } catch (error) {
      logger.error('Failed to delete webhook:', error);
    }
  }

  /**
   * Get bot metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptimeMs: Date.now() - this.metrics.startTime,
      uptimeHours: (Date.now() - this.metrics.startTime) / (1000 * 60 * 60)
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isInitialized || !this.bot) {
      return {
        healthy: false,
        error: 'Bot not initialized'
      };
    }

    try {
      const me = await this.bot.api.getMe();

      return {
        healthy: true,
        botId: me.id,
        botUsername: me.username,
        canJoinGroups: me.can_join_groups,
        canReadAllGroupMessages: me.can_read_all_group_messages,
        supportsInlineQueries: me.supports_inline_queries,
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
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Telegram bot...');

    if (this.bot) {
      await this.deleteWebhook();
    }

    this.isInitialized = false;
    logger.info('Telegram bot shutdown complete');
  }

  // Simple event emitter implementation
  _eventHandlers = {};

  on(event, handler) {
    if (!this._eventHandlers[event]) {
      this._eventHandlers[event] = [];
    }
    this._eventHandlers[event].push(handler);
  }

  emit(event, data) {
    const handlers = this._eventHandlers[event] || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        logger.error(`Error in event handler for ${event}:`, error);
      }
    }
  }

  off(event, handler) {
    if (!this._eventHandlers[event]) return;
    this._eventHandlers[event] = this._eventHandlers[event].filter(h => h !== handler);
  }
}

// Export singleton instance
module.exports = new TelegramBot();
