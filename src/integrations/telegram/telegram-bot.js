// src/integrations/telegram/telegram-bot.js
/**
 * Telegram Business Bot Client
 * Uses grammY framework for official Telegram Business Bot API
 *
 * Business Bot allows sending messages on behalf of salon's Telegram account
 * Messages appear as from the salon, not from a bot (no bot label visible to customers)
 */

const { Bot, webhookCallback, GrammyError, HttpError } = require('grammy');
const EventEmitter = require('events');
const Sentry = require('@sentry/node');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-bot' });
const messageQueue = require('../../queue/message-queue');
const {
  TelegramError,
  TelegramAPIError,
  TelegramConfigError,
  TelegramErrorHandler
} = require('../../utils/telegram-errors');
const postgres = require('../../database/postgres');
const { TelegramLinkingRepository, TelegramConnectionRepository } = require('../../repositories');

class TelegramBot extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Prevent memory leak warnings
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

    // Repositories (initialized lazily)
    this.linkingRepository = null;
    this.connectionRepository = null;
  }

  /**
   * Get or create TelegramLinkingRepository
   * @private
   */
  _getLinkingRepository() {
    if (!this.linkingRepository) {
      this.linkingRepository = new TelegramLinkingRepository(postgres);
    }
    return this.linkingRepository;
  }

  /**
   * Get or create TelegramConnectionRepository
   * @private
   */
  _getConnectionRepository() {
    if (!this.connectionRepository) {
      this.connectionRepository = new TelegramConnectionRepository(postgres);
    }
    return this.connectionRepository;
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
      this.setupCallbackHandlers();

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
   * Setup global error handler with Sentry integration
   */
  setupErrorHandler() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      const error = err.error;

      this.metrics.errors++;

      // Extract context for error handling
      const context = {
        chatId: ctx?.chat?.id,
        method: error instanceof GrammyError ? error.method : undefined
      };

      // Standardize error using our error classes
      const standardizedError = TelegramErrorHandler.fromGrammyError(error, context);

      // Log with appropriate level
      TelegramErrorHandler.log(standardizedError, logger);

      // Capture to Sentry with proper tags
      Sentry.withScope((scope) => {
        // Set Telegram-specific tags
        const tags = TelegramErrorHandler.getSentryTags(standardizedError, context);
        Object.entries(tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });

        // Set context
        scope.setContext('telegram', {
          chatId: context.chatId,
          method: context.method,
          errorCode: standardizedError.code,
          isRetryable: standardizedError.isRetryable,
          timestamp: standardizedError.timestamp
        });

        // Set level based on error type
        if (!standardizedError.isOperational) {
          scope.setLevel('fatal');
        } else if (standardizedError.isRetryable) {
          scope.setLevel('warning');
        } else {
          scope.setLevel('error');
        }

        Sentry.captureException(standardizedError);
      });
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
    // /start command - when someone starts the bot directly or via deep link
    this.bot.command('start', async (ctx) => {
      try {
        const args = ctx.message.text.split(' ')[1]; // "link_Ab3kL9mX2p4K"

        // Check if this is a deep link for company linking
        if (args?.startsWith('link_')) {
          const code = args.replace('link_', '');
          await this.handleLinkingRequest(ctx, code);
          return;
        }

        // Default /start message
        await ctx.reply(
          '🏠 Привет! Я AI Admin Bot для салонов красоты.\n\n' +
          'Если вы владелец салона, подключите меня через:\n' +
          'Настройки → Telegram Business → Чат-бот\n\n' +
          'После подключения я смогу отвечать вашим клиентам от вашего имени!\n\n' +
          'Если вы получили ссылку для привязки, просто кликните по ней.'
        );
      } catch (error) {
        logger.error('Error handling /start command:', error);
        Sentry.captureException(error, {
          tags: { component: 'telegram-bot', command: 'start' },
          extra: { userId: ctx.from?.id }
        });
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      }
    });

    // /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'Я помогаю салонам красоты отвечать клиентам автоматически.\n\n' +
        'Для владельцев салонов:\n' +
        '1. Убедитесь что у вас Telegram Premium\n' +
        '2. Получите ссылку для привязки от администратора\n' +
        '3. Кликните ссылку и подтвердите привязку\n' +
        '4. Перейдите в Настройки → Telegram Business\n' +
        '5. В разделе "Чат-бот" подключите этого бота\n' +
        '6. Готово! Я буду отвечать клиентам от вашего имени\n\n' +
        'Команды:\n' +
        '/status - проверить статус подключения\n' +
        '/help - справка'
      );
    });

    // /status command - check connection status for salon owner
    this.bot.command('status', async (ctx) => {
      try {
        await this.handleStatusCommand(ctx);
      } catch (error) {
        logger.error('Error handling /status command:', error);
        Sentry.captureException(error, {
          tags: { component: 'telegram-bot', command: 'status' },
          extra: { userId: ctx.from?.id }
        });
        await ctx.reply('❌ Не удалось получить статус. Попробуйте позже.');
      }
    });
  }

  /**
   * Handle deep link for company linking
   * @param {Context} ctx - grammY context
   * @param {string} code - Linking code from deep link
   */
  async handleLinkingRequest(ctx, code) {
    const linkingRepo = this._getLinkingRepository();

    try {
      const data = await linkingRepo.getCodeData(code);

      if (!data) {
        logger.info('Invalid or expired linking code attempted:', {
          code: code.substring(0, 5) + '...',
          userId: ctx.from.id
        });

        await ctx.reply(
          '❌ Ссылка недействительна или истекла.\n\n' +
          'Запросите новую ссылку у администратора.'
        );
        return;
      }

      logger.info('Linking request received:', {
        code: code.substring(0, 5) + '...',
        companyId: data.company_id,
        companyName: data.company_name,
        userId: ctx.from.id
      });

      // Show confirmation with inline buttons
      await ctx.reply(
        `🔗 Привязать аккаунт к салону:\n\n` +
        `🏢 ${data.company_name}\n\n` +
        `После привязки вы сможете:\n` +
        `✅ Получать сообщения от клиентов\n` +
        `✅ Автоматические ответы бота`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Подтвердить', callback_data: `link_confirm_${code}` },
              { text: '❌ Отмена', callback_data: 'link_cancel' }
            ]]
          }
        }
      );

    } catch (error) {
      logger.error('Error handling linking request:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-bot', operation: 'handleLinkingRequest' },
        extra: { code: code.substring(0, 5) + '...', userId: ctx.from?.id }
      });
      await ctx.reply('❌ Произошла ошибка при проверке ссылки. Попробуйте позже.');
    }
  }

  /**
   * Handle /status command - show linking and connection status
   * @param {Context} ctx - grammY context
   */
  async handleStatusCommand(ctx) {
    const linkingRepo = this._getLinkingRepository();
    const connectionRepo = this._getConnectionRepository();

    // Check if user has a link
    const link = await linkingRepo.findLinkByTelegramUser(ctx.from.id);

    if (!link) {
      await ctx.reply(
        '❓ Ваш аккаунт не привязан к салону.\n\n' +
        'Запросите ссылку для привязки у администратора.'
      );
      return;
    }

    // Check business connection status
    const connection = await connectionRepo.findByCompanyId(link.company_id);

    let businessStatus = '❌ Не подключен';
    let canReplyStatus = '❌ Нет';

    if (connection) {
      businessStatus = '✅ Подключен';
      canReplyStatus = connection.can_reply ? '✅ Да' : '❌ Нет';
    }

    await ctx.reply(
      `📊 Статус подключения:\n\n` +
      `🏢 Салон: ${link.company_name || 'ID ' + link.company_id}\n` +
      `📱 Telegram Business: ${businessStatus}\n` +
      `💬 Бот может отвечать: ${canReplyStatus}\n` +
      `📅 Привязан: ${new Date(link.linked_at).toLocaleDateString('ru-RU')}`
    );
  }

  /**
   * Setup inline button callback handlers
   */
  setupCallbackHandlers() {
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      try {
        // Handle link confirmation
        if (data.startsWith('link_confirm_')) {
          const code = data.replace('link_confirm_', '');
          await this.completeLinking(ctx, code);
          return;
        }

        // Handle link cancellation
        if (data === 'link_cancel') {
          await ctx.answerCallbackQuery('Отменено');
          await ctx.editMessageText('❌ Привязка отменена');
          return;
        }

        // Unknown callback
        await ctx.answerCallbackQuery('Неизвестная команда');

      } catch (error) {
        logger.error('Error handling callback query:', error);
        Sentry.captureException(error, {
          tags: { component: 'telegram-bot', operation: 'callback_query' },
          extra: { callbackData: data, userId: ctx.from?.id }
        });

        try {
          await ctx.answerCallbackQuery('Произошла ошибка');
        } catch {
          // Ignore if we can't answer callback
        }
      }
    });
  }

  /**
   * Complete the linking process after user confirms
   * @param {Context} ctx - grammY context
   * @param {string} code - Linking code
   */
  async completeLinking(ctx, code) {
    const linkingRepo = this._getLinkingRepository();

    // Re-validate code (it might have expired since confirmation screen)
    const codeData = await linkingRepo.getCodeData(code);

    if (!codeData) {
      await ctx.answerCallbackQuery('❌ Ссылка истекла');
      await ctx.editMessageText(
        '❌ Ссылка истекла.\n\n' +
        'Запросите новую ссылку у администратора.'
      );
      return;
    }

    try {
      // Create permanent link
      await linkingRepo.createLink(
        ctx.from.id,
        ctx.from.username,
        codeData.company_id,
        code
      );

      // Consume code (delete from Redis, update DB)
      await linkingRepo.consumeCode(code, ctx.from.id, ctx.from.username);

      logger.info('Company linking completed:', {
        telegramUserId: ctx.from.id,
        telegramUsername: ctx.from.username,
        companyId: codeData.company_id,
        companyName: codeData.company_name
      });

      // Emit event for TelegramManager to update cache
      this.emit('user_linked', {
        telegramUserId: ctx.from.id,
        companyId: codeData.company_id
      });

      await ctx.answerCallbackQuery('✅ Успешно!');
      await ctx.editMessageText(
        `✅ Аккаунт привязан!\n\n` +
        `Ваш Telegram подключен к:\n` +
        `🏢 ${codeData.company_name}\n\n` +
        `Теперь подключите бота через:\n` +
        `📱 Настройки → Telegram Business → Чат-бот\n\n` +
        `После этого бот сможет отвечать вашим клиентам!`
      );

    } catch (error) {
      logger.error('Error completing linking:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-bot', operation: 'completeLinking' },
        extra: {
          code: code.substring(0, 5) + '...',
          companyId: codeData.company_id,
          userId: ctx.from?.id
        }
      });

      await ctx.answerCallbackQuery('Ошибка');
      await ctx.editMessageText(
        '❌ Произошла ошибка при привязке.\n\n' +
        'Попробуйте ещё раз или обратитесь к администратору.'
      );
    }
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
      const error = new TelegramConfigError(
        'Telegram bot is not initialized',
        'bot.initialized'
      );
      Sentry.captureException(error, {
        tags: TelegramErrorHandler.getSentryTags(error, { chatId })
      });
      throw error;
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
      this.metrics.errors++;

      // Standardize error
      const context = { chatId, method: 'sendMessage' };
      const standardizedError = TelegramErrorHandler.fromGrammyError(error, context);

      // Log and capture to Sentry
      TelegramErrorHandler.log(standardizedError, logger);
      Sentry.captureException(standardizedError, {
        tags: TelegramErrorHandler.getSentryTags(standardizedError, context),
        extra: { businessConnectionId, textLength: text?.length }
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
      const error = new TelegramConfigError('Bot not initialized', 'bot.initialized');
      throw error;
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
      const { TelegramWebhookError } = require('../../utils/telegram-errors');
      const webhookError = new TelegramWebhookError(
        `Failed to set webhook: ${error.message}`,
        url,
        { originalError: error.message }
      );

      TelegramErrorHandler.log(webhookError, logger);
      Sentry.captureException(webhookError, {
        tags: TelegramErrorHandler.getSentryTags(webhookError)
      });

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

  // Note: Event emitter methods (on, emit, off, once, removeAllListeners)
  // are inherited from Node.js EventEmitter - no custom implementation needed
}

// Export singleton instance
module.exports = new TelegramBot();
