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
const { body, validationResult } = require('express-validator');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-api' });
const telegramManager = require('../../integrations/telegram/telegram-manager');
const rateLimiter = require('../../middlewares/rate-limiter');
const { validateApiKey } = require('../../middlewares/webhook-auth');
const Sentry = require('@sentry/node');
const postgres = require('../../database/postgres');
const { TelegramLinkingRepository, TelegramConnectionRepository, CompanyRepository } = require('../../repositories');

/**
 * Validation middleware - extracts validation errors and returns 400
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: errors.array().map(e => e.msg)
    });
  }
  next();
};

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
router.post('/webhook/set',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  [
    body('url')
      .isURL({ protocols: ['https'], require_protocol: true })
      .withMessage('url must be a valid HTTPS URL')
      .custom((value) => {
        // Block localhost and private IPs for security
        const { URL } = require('url');
        const parsed = new URL(value);
        const hostname = parsed.hostname.toLowerCase();

        // Block localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          throw new Error('Cannot set webhook to localhost');
        }

        // Block private IP ranges
        const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
        if (privateIPRegex.test(hostname)) {
          throw new Error('Cannot set webhook to private IP address');
        }

        return true;
      })
  ],
  validate,
  async (req, res) => {
    try {
      const { url } = req.body;

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
  }
);

/**
 * POST /api/telegram/send
 * Send Telegram message (for testing)
 */
router.post('/send',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  [
    body('companyId')
      .isInt({ min: 1 })
      .withMessage('companyId must be a positive integer'),
    body('chatId')
      .isInt()
      .withMessage('chatId must be an integer'),
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1, max: 4096 })
      .withMessage('message must be a string between 1 and 4096 characters'),
    body('withTyping')
      .optional()
      .isBoolean()
      .withMessage('withTyping must be a boolean')
  ],
  validate,
  async (req, res) => {
    try {
      const { companyId, chatId, message, withTyping = true } = req.body;

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
  }
);

// ============================================
// COMPANY LINKING ENDPOINTS
// ============================================

/**
 * POST /api/telegram/linking-codes
 * Generate a new deep link code for company linking
 *
 * Body: { companyId: number }
 * Returns: { deepLink, code, expiresAt, companyName, instructions }
 */
router.post('/linking-codes',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  [
    body('companyId')
      .isInt({ min: 1 })
      .withMessage('companyId must be a positive integer')
  ],
  validate,
  async (req, res) => {
    try {
      const { companyId } = req.body;

      // Initialize repositories
      const linkingRepo = new TelegramLinkingRepository(postgres);
      const companyRepo = new CompanyRepository(postgres);

      // Verify company exists (findById searches by yclients_id)
      const company = await companyRepo.findById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      // Use internal company.id for database FK, not the yclients_id from request
      const internalCompanyId = company.id;

      // Check rate limit (max 10 codes per company per day)
      const todayCount = await linkingRepo.countTodayCodes(internalCompanyId);
      if (todayCount >= 10) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Maximum 10 codes per company per day.',
          retryAfter: 'tomorrow'
        });
      }

      // Generate code using internal company ID (for FK constraint)
      const companyName = company.title || `Company ${companyId}`;
      const result = await linkingRepo.generateCode(internalCompanyId, companyName, 'api');

      logger.info('Linking code generated:', {
        yclientsId: companyId,
        internalId: internalCompanyId,
        companyName,
        code: result.code.substring(0, 5) + '...'
      });

      res.json({
        success: true,
        deepLink: result.deepLink,
        code: result.code,
        expiresAt: result.expiresAt,
        companyName: result.companyName,
        instructions: 'Отправьте эту ссылку владельцу салона. Ссылка действительна 15 минут.'
      });

    } catch (error) {
      logger.error('Error generating linking code:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-api', operation: 'generateLinkingCode' }
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/telegram/linking-codes
 * List pending codes for a company
 *
 * Query: ?companyId=123 (yclients_id)
 */
router.get('/linking-codes',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  async (req, res) => {
    try {
      const yclientsId = parseInt(req.query.companyId);

      if (!yclientsId || isNaN(yclientsId)) {
        return res.status(400).json({
          success: false,
          error: 'companyId query parameter is required'
        });
      }

      const linkingRepo = new TelegramLinkingRepository(postgres);
      const companyRepo = new CompanyRepository(postgres);

      // Find company by yclients_id to get internal id
      const company = await companyRepo.findById(yclientsId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      const codes = await linkingRepo.getPendingCodes(company.id);

      res.json({
        success: true,
        companyId: yclientsId,
        codes: codes.map(c => ({
          code: c.code,
          expiresAt: c.expires_at,
          createdAt: c.created_at,
          createdBy: c.created_by
        }))
      });

    } catch (error) {
      logger.error('Error listing linking codes:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-api', operation: 'listLinkingCodes' }
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/telegram/linking-codes/:code
 * Revoke a linking code
 */
router.delete('/linking-codes/:code',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  async (req, res) => {
    try {
      const { code } = req.params;

      if (!code || code.length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Invalid code'
        });
      }

      const linkingRepo = new TelegramLinkingRepository(postgres);
      const revoked = await linkingRepo.revokeCode(code);

      logger.info('Linking code revoked:', {
        code: code.substring(0, 5) + '...',
        revoked
      });

      res.json({
        success: true,
        revoked,
        message: revoked ? 'Code revoked' : 'Code not found or already used'
      });

    } catch (error) {
      logger.error('Error revoking linking code:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-api', operation: 'revokeLinkingCode' }
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/telegram/linking-status/:companyId
 * Check if company has linked Telegram account
 *
 * Note: companyId param is yclients_id, we convert to internal id
 * Returns linking info + business connection status
 */
router.get('/linking-status/:companyId',
  rateLimiter,
  validateApiKey,
  checkTelegramEnabled,
  async (req, res) => {
    try {
      const yclientsId = parseInt(req.params.companyId);

      if (!yclientsId || isNaN(yclientsId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid company ID'
        });
      }

      const linkingRepo = new TelegramLinkingRepository(postgres);
      const connectionRepo = new TelegramConnectionRepository(postgres);
      const companyRepo = new CompanyRepository(postgres);

      // Find company by yclients_id to get internal id
      const company = await companyRepo.findById(yclientsId);
      if (!company) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      const internalCompanyId = company.id;

      // Get linking info using internal id
      const link = await linkingRepo.findLinkByCompany(internalCompanyId);

      if (!link) {
        return res.json({
          success: true,
          companyId: yclientsId,
          linked: false,
          telegramUser: null,
          businessConnection: null
        });
      }

      // Get business connection status using internal id
      const connection = await connectionRepo.findByCompanyId(internalCompanyId);

      res.json({
        success: true,
        companyId: yclientsId,
        linked: true,
        telegramUser: {
          id: link.telegram_user_id,
          username: link.telegram_username
        },
        linkedAt: link.linked_at,
        businessConnection: connection ? {
          connected: true,
          canReply: connection.can_reply,
          connectedAt: connection.connected_at
        } : {
          connected: false,
          message: 'User linked but Business Bot not connected yet'
        }
      });

    } catch (error) {
      logger.error('Error getting linking status:', error);
      Sentry.captureException(error, {
        tags: { component: 'telegram-api', operation: 'getLinkingStatus' }
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
