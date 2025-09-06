// src/api/webhooks/whatsapp-baileys.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const sessionManager = require('../../integrations/whatsapp/session-manager');
const messageQueue = require('../../queue/message-queue');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');
const rateLimiter = require('../../middlewares/rate-limiter');

// Initialize session manager on startup
let sessionManagerInitialized = false;
(async () => {
  try {
    await sessionManager.initialize();
    sessionManagerInitialized = true;
    logger.info('✅ Baileys session manager initialized in webhook');
    
    // Set up message handler for webhook processing
    sessionManager.on('webhook-message', async (messageData) => {
      await processIncomingMessage(messageData);
    });
  } catch (error) {
    logger.error('Failed to initialize session manager:', error);
  }
})();

/**
 * Process incoming message from WhatsApp
 */
async function processIncomingMessage(messageData) {
  try {
    const { companyId, phone, message, messageId, pushName } = messageData;
    
    logger.info(`📨 Processing WhatsApp message for company ${companyId} from ${phone}`);
    
    // Format message for queue
    const queueData = {
      companyId,
      phone: phone.replace(/\D/g, ''), // Clean phone number
      message: message.text || message.caption || '[media]',
      messageType: message.type,
      messageId,
      clientName: pushName,
      timestamp: Date.now()
    };
    
    // Add to message queue for processing
    await messageQueue.addMessage(queueData);
    
    logger.info(`✅ Message queued for processing: ${messageId}`);
    
  } catch (error) {
    logger.error('Failed to process incoming message:', error);
  }
}

/**
 * Webhook endpoint for external WhatsApp services (if needed)
 * This can receive messages from external sources and route them through Baileys
 */
router.post('/webhook/whatsapp/baileys', rateLimiter, validateWebhookSignature, async (req, res) => {
  try {
    if (!sessionManagerInitialized) {
      logger.warn('Session manager not initialized, initializing now...');
      await sessionManager.initialize();
      sessionManagerInitialized = true;
    }
    
    const { companyId, phone, message, action } = req.body;
    
    logger.info('📨 Baileys webhook received:', {
      companyId,
      phone,
      action,
      messageLength: message?.length
    });
    
    // Handle different webhook actions
    switch (action) {
      case 'message':
        // Process incoming message
        await processIncomingMessage({
          companyId: companyId || 'default',
          phone,
          message: { type: 'text', text: message },
          messageId: `webhook_${Date.now()}`,
          pushName: req.body.clientName || 'Client'
        });
        break;
        
      case 'status':
        // Get session status
        const status = sessionManager.getSessionStatus(companyId);
        return res.json({ success: true, status });
        
      case 'qr':
        // Get QR code for authentication
        const qr = await sessionManager.getQRCode(companyId);
        return res.json({ success: true, qr });
        
      default:
        // Default action - send message
        if (message && phone) {
          await sessionManager.sendMessage(companyId || 'default', phone, message);
        }
    }
    
    res.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

/**
 * Get session status for a company
 */
router.get(['/webhook/whatsapp/baileys/status/:companyId', '/webhook/whatsapp/baileys/status'], async (req, res) => {
  try {
    const companyId = req.params.companyId || 'default';
    const status = sessionManager.getSessionStatus(companyId);
    
    res.json({
      success: true,
      companyId,
      status
    });
    
  } catch (error) {
    logger.error('Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get QR code for company authentication
 */
router.get(['/webhook/whatsapp/baileys/qr/:companyId', '/webhook/whatsapp/baileys/qr'], async (req, res) => {
  try {
    const companyId = req.params.companyId || 'default';
    const qr = await sessionManager.getQRCode(companyId);
    
    res.json({
      success: true,
      companyId,
      qr
    });
    
  } catch (error) {
    logger.error('Failed to get QR code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Initialize session for a company
 */
router.post('/webhook/whatsapp/baileys/init/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const config = req.body.config || {};
    
    await sessionManager.initializeCompanySession(companyId, config);
    
    res.json({
      success: true,
      message: `Session initialized for company ${companyId}`
    });
    
  } catch (error) {
    logger.error('Failed to initialize session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all active sessions
 */
router.get('/webhook/whatsapp/baileys/sessions', async (req, res) => {
  try {
    const sessions = sessionManager.getAllSessionsStatus();
    
    res.json({
      success: true,
      count: sessions.length,
      sessions
    });
    
  } catch (error) {
    logger.error('Failed to get sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send message through Baileys
 */
router.post('/webhook/whatsapp/baileys/send', async (req, res) => {
  try {
    const { companyId = 'default', phone, message, mediaUrl, mediaType } = req.body;
    
    if (!phone || (!message && !mediaUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message/media required'
      });
    }
    
    let result;
    if (mediaUrl) {
      // Send media
      result = await sessionManager.sendMedia(companyId, phone, mediaUrl, mediaType || 'image', message);
    } else {
      // Send text message
      result = await sessionManager.sendMessage(companyId, phone, message);
    }
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('Failed to send message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Disconnect session for a company
 */
router.post('/webhook/whatsapp/baileys/disconnect/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    await sessionManager.disconnectSession(companyId);
    
    res.json({
      success: true,
      message: `Session disconnected for company ${companyId}`
    });
    
  } catch (error) {
    logger.error('Failed to disconnect session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete session (logout) for a company
 */
router.delete('/webhook/whatsapp/baileys/session/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    await sessionManager.deleteSession(companyId);
    
    res.json({
      success: true,
      message: `Session deleted for company ${companyId}`
    });
    
  } catch (error) {
    logger.error('Failed to delete session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;