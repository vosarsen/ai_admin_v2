/**
 * Telegram Webhook Handler
 *
 * Receives updates from Telegram API and passes them to grammY for processing.
 * Uses secret token verification for security.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
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
 * Validate Telegram update payload structure
 * Returns true if valid, false if invalid (logs warning)
 */
const validateTelegramPayload = (update) => {
  // Must have update_id
  if (typeof update.update_id !== 'number') {
    logger.warn('Invalid Telegram payload: missing or invalid update_id', {
      hasUpdateId: 'update_id' in update,
      updateIdType: typeof update.update_id
    });
    return false;
  }

  // Must have at least one known update type
  const knownUpdateTypes = [
    'message', 'edited_message', 'channel_post', 'edited_channel_post',
    'business_connection', 'business_message', 'edited_business_message',
    'deleted_business_messages', 'callback_query', 'inline_query'
  ];

  const hasKnownType = knownUpdateTypes.some(type => type in update);
  if (!hasKnownType) {
    logger.warn('Invalid Telegram payload: no known update type', {
      update_id: update.update_id,
      keys: Object.keys(update).slice(0, 10) // Log first 10 keys for debugging
    });
    return false;
  }

  return true;
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

    // Validate payload structure
    const update = req.body;
    if (!update || typeof update !== 'object') {
      logger.warn('Telegram webhook: empty or non-object payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    if (!validateTelegramPayload(update)) {
      // Return 400 for malformed requests (not from Telegram)
      return res.status(400).json({ error: 'Invalid Telegram update structure' });
    }

    // Log update type for monitoring
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
