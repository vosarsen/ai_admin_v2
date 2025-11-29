/**
 * Telegram Webhook Handler
 *
 * Receives updates from Telegram API and passes them to grammY for processing.
 * Uses secret token verification for security.
 */

const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-webhook' });
const telegramManager = require('../../integrations/telegram/telegram-manager');
const Sentry = require('@sentry/node');

/**
 * Verify Telegram webhook secret token
 */
const verifyTelegramSecret = (req, res, next) => {
  // Skip verification if no secret configured (development)
  if (!config.telegram.webhookSecret) {
    logger.warn('Telegram webhook secret not configured - skipping verification');
    return next();
  }

  const secretToken = req.headers['x-telegram-bot-api-secret-token'];

  if (!secretToken) {
    logger.warn('Telegram webhook request without secret token');
    return res.status(401).json({ error: 'Missing secret token' });
  }

  if (secretToken !== config.telegram.webhookSecret) {
    logger.warn('Invalid Telegram webhook secret token');
    return res.status(401).json({ error: 'Invalid secret token' });
  }

  next();
};

/**
 * POST /webhook/telegram
 * Receive Telegram updates
 */
router.post('/webhook/telegram', verifyTelegramSecret, async (req, res) => {
  try {
    // Check if Telegram is enabled
    if (!config.telegram.enabled) {
      logger.warn('Received Telegram webhook but integration is disabled');
      return res.status(503).json({ error: 'Telegram integration disabled' });
    }

    // Log update type for monitoring
    const update = req.body;
    const updateType = Object.keys(update).find(key =>
      ['message', 'business_connection', 'business_message',
       'edited_business_message', 'deleted_business_messages'].includes(key)
    );

    logger.debug('Telegram webhook received:', {
      update_id: update.update_id,
      type: updateType
    });

    // Get webhook handler from manager and process
    const webhookHandler = telegramManager.getWebhookHandler();

    // grammY webhook handler will send the response
    await webhookHandler(req, res);

  } catch (error) {
    logger.error('Telegram webhook error:', error);
    Sentry.captureException(error, {
      tags: { component: 'telegram-webhook' },
      extra: { update_id: req.body?.update_id }
    });

    // Return 200 to prevent Telegram from retrying
    // (we've logged the error, retrying won't help)
    if (!res.headersSent) {
      res.status(200).json({ ok: true, error_logged: true });
    }
  }
});

/**
 * GET /webhook/telegram/info
 * Get webhook configuration info (admin only)
 */
router.get('/webhook/telegram/info', async (req, res) => {
  try {
    const health = await telegramManager.healthCheck();

    res.json({
      enabled: config.telegram.enabled,
      webhookUrl: config.telegram.webhookUrl,
      hasSecret: !!config.telegram.webhookSecret,
      health
    });
  } catch (error) {
    logger.error('Webhook info error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
