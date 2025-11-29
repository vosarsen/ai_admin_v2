/**
 * Telegram Management API Routes
 *
 * Provides endpoints for managing Telegram Business Bot connections:
 * - Connection status
 * - Disconnect
 * - List all connections (admin)
 * - Health check
 * - Metrics
 */

const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-api' });
const telegramManager = require('../../integrations/telegram/telegram-manager');
const rateLimiter = require('../../middlewares/rate-limiter');
const { validateApiKey } = require('../../middlewares/webhook-auth');
const Sentry = require('@sentry/node');

/**
 * Middleware to check if Telegram is enabled
 */
const checkTelegramEnabled = (req, res, next) => {
  if (!config.telegram.enabled) {
    return res.status(503).json({
      success: false,
      error: 'Telegram integration is disabled'
    });
  }
  next();
};

/**
 * GET /api/telegram/status/:companyId
 * Get Telegram connection status for a company
 */
router.get('/status/:companyId', rateLimiter, checkTelegramEnabled, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);

    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company ID'
      });
    }

    const status = await telegramManager.getConnectionStatus(companyId);

    res.json({
      success: true,
      companyId,
      telegram: status
    });

  } catch (error) {
    logger.error('Error getting Telegram status:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-api', operation: 'getStatus' }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/telegram/disconnect/:companyId
 * Disconnect Telegram from a company
 */
router.delete('/disconnect/:companyId', rateLimiter, validateApiKey, checkTelegramEnabled, async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);

    if (!companyId || isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company ID'
      });
    }

    logger.info('Disconnecting Telegram for company:', companyId);

    const result = await telegramManager.disconnect(companyId);

    res.json({
      success: result.success,
      message: result.message || result.error
    });

  } catch (error) {
    logger.error('Error disconnecting Telegram:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-api', operation: 'disconnect' }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/telegram/connections
 * List all active Telegram connections (admin only)
 */
router.get('/connections', rateLimiter, validateApiKey, checkTelegramEnabled, async (req, res) => {
  try {
    const connections = await telegramManager.getAllConnections();

    res.json({
      success: true,
      count: connections.length,
      connections: connections.map(conn => ({
        id: conn.id,
        companyId: conn.company_id,
        telegramUsername: conn.telegram_username,
        telegramUserId: conn.telegram_user_id,
        canReply: conn.can_reply,
        connectedAt: conn.connected_at,
        updatedAt: conn.updated_at
      }))
    });

  } catch (error) {
    logger.error('Error listing Telegram connections:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-api', operation: 'listConnections' }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/telegram/health
 * Telegram integration health check
 */
router.get('/health', rateLimiter, async (req, res) => {
  try {
    if (!config.telegram.enabled) {
      return res.json({
        success: true,
        enabled: false,
        message: 'Telegram integration is disabled'
      });
    }

    const health = await telegramManager.healthCheck();

    res.json({
      success: true,
      enabled: true,
      ...health
    });

  } catch (error) {
    logger.error('Error checking Telegram health:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/telegram/metrics
 * Telegram integration metrics
 */
router.get('/metrics', rateLimiter, checkTelegramEnabled, async (req, res) => {
  try {
    const metrics = telegramManager.getMetrics();

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    logger.error('Error getting Telegram metrics:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/telegram/webhook/set
 * Set Telegram webhook URL (admin only)
 */
router.post('/webhook/set', rateLimiter, validateApiKey, checkTelegramEnabled, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL is required'
      });
    }

    logger.info('Setting Telegram webhook:', url);

    const result = await telegramManager.setWebhook(url);

    res.json({
      success: result,
      message: result ? 'Webhook set successfully' : 'Failed to set webhook'
    });

  } catch (error) {
    logger.error('Error setting Telegram webhook:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-api', operation: 'setWebhook' }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/telegram/send
 * Send Telegram message (for testing)
 */
router.post('/send', rateLimiter, validateApiKey, checkTelegramEnabled, async (req, res) => {
  try {
    const { companyId, chatId, message, withTyping } = req.body;

    if (!companyId || !chatId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: companyId, chatId, message'
      });
    }

    logger.info('Sending Telegram message:', { companyId, chatId });

    const result = withTyping
      ? await telegramManager.sendWithTyping(companyId, chatId, message)
      : await telegramManager.sendMessage(companyId, chatId, message);

    res.json(result);

  } catch (error) {
    logger.error('Error sending Telegram message:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-api', operation: 'sendMessage' }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
