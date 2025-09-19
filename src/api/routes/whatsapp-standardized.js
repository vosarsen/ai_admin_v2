/**
 * WhatsApp API Routes with Standardized Error Handling
 * Example of properly structured API with consistent error handling
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const whatsappManager = require('../../integrations/whatsapp/whatsapp-manager');
const { asyncHandler, validateRequest } = require('../../middlewares/whatsapp-error-handler');
const {
  SessionError,
  ValidationError,
  ErrorHandler
} = require('../../utils/whatsapp-errors');
const logger = require('../../utils/logger');

// ============= Validation Schemas =============

const sendMessageSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  message: Joi.string().min(1).max(4096).required(),
  companyId: Joi.string().optional()
});

const sendMediaSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  mediaUrl: Joi.string().uri().required(),
  type: Joi.string().valid('image', 'video', 'audio', 'document').required(),
  caption: Joi.string().max(1024).optional(),
  companyId: Joi.string().optional()
});

const pairingCodeSchema = Joi.object({
  phoneNumber: Joi.string().pattern(/^\d{10,15}$/).required()
});

// ============= Routes =============

/**
 * Send text message
 * POST /api/whatsapp/send
 */
router.post('/send',
  validateRequest(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { phone, message, companyId } = req.body;

    const result = await whatsappManager.sendMessage(phone, message, { companyId });

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });
  })
);

/**
 * Send media message
 * POST /api/whatsapp/send-media
 */
router.post('/send-media',
  validateRequest(sendMediaSchema),
  asyncHandler(async (req, res) => {
    const { phone, mediaUrl, type, caption, companyId } = req.body;

    const result = await whatsappManager.sendMedia(
      phone,
      mediaUrl,
      type,
      caption,
      { companyId }
    );

    res.json({
      success: true,
      message: 'Media sent successfully',
      data: result
    });
  })
);

/**
 * Get session status
 * GET /api/whatsapp/sessions/:companyId/status
 */
router.get('/sessions/:companyId/status',
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;

    const status = whatsappManager.getSessionStatus(companyId);

    if (!status) {
      throw new SessionError('Session not found', companyId);
    }

    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * Initialize company session
 * POST /api/whatsapp/sessions/:companyId/initialize
 */
router.post('/sessions/:companyId/initialize',
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    const config = req.body;

    await whatsappManager.initializeCompany(companyId, config);

    res.json({
      success: true,
      message: `Session initialized for company ${companyId}`
    });
  })
);

/**
 * Get QR code
 * GET /api/whatsapp/sessions/:companyId/qr
 */
router.get('/sessions/:companyId/qr',
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;

    const qrData = await whatsappManager.getQRCode(companyId);

    res.json({
      success: true,
      data: qrData
    });
  })
);

/**
 * Request pairing code
 * POST /api/whatsapp/sessions/:companyId/pairing-code
 */
router.post('/sessions/:companyId/pairing-code',
  validateRequest(pairingCodeSchema),
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;
    const { phoneNumber } = req.body;

    const result = await whatsappManager.requestPairingCode(companyId, phoneNumber);

    res.json({
      success: true,
      message: 'Pairing code requested',
      data: result
    });
  })
);

/**
 * Disconnect session
 * POST /api/whatsapp/sessions/:companyId/disconnect
 */
router.post('/sessions/:companyId/disconnect',
  asyncHandler(async (req, res) => {
    const { companyId } = req.params;

    await whatsappManager.disconnectSession(companyId);

    res.json({
      success: true,
      message: `Session disconnected for company ${companyId}`
    });
  })
);

/**
 * Get all sessions status
 * GET /api/whatsapp/sessions
 */
router.get('/sessions',
  asyncHandler(async (req, res) => {
    const sessions = whatsappManager.getAllSessionsStatus();

    res.json({
      success: true,
      data: sessions,
      summary: {
        total: Object.keys(sessions).length,
        connected: Object.values(sessions).filter(s => s.connected).length
      }
    });
  })
);

/**
 * Health check
 * GET /api/whatsapp/health
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = await whatsappManager.checkHealth();

    res.json({
      success: true,
      data: health
    });
  })
);

/**
 * Diagnose connection issues
 * POST /api/whatsapp/diagnose
 */
router.post('/diagnose',
  asyncHandler(async (req, res) => {
    const { phone, companyId } = req.body;

    if (!phone) {
      throw new ValidationError('Phone number is required for diagnosis', 'phone');
    }

    const diagnosis = await whatsappManager.diagnoseProblem(phone, companyId);

    res.json({
      success: true,
      data: diagnosis
    });
  })
);

/**
 * Retry failed operation with exponential backoff
 * POST /api/whatsapp/retry
 */
router.post('/retry',
  validateRequest(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { phone, message, companyId } = req.body;

    // Use ErrorHandler retry utility
    const result = await ErrorHandler.retry(
      async () => {
        return await whatsappManager.sendMessage(phone, message, { companyId });
      },
      {
        maxAttempts: 3,
        onError: (error, attempt) => {
          logger.warn(`Retry attempt ${attempt} failed:`, error.message);
        }
      }
    );

    res.json({
      success: true,
      message: 'Message sent after retry',
      data: result
    });
  })
);

module.exports = router;