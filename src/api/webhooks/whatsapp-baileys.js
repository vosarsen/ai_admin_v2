// src/api/webhooks/whatsapp-baileys.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
// MIGRATION: Disabled old session manager in favor of new Session Pool architecture
// const sessionPool = require('../../integrations/whatsapp/session-manager');
const WhatsAppSessionPool = require('../../integrations/whatsapp/session-pool-improved');
const healthMonitor = require('../../services/whatsapp/health-monitor');
const sessionStateManager = require('../../services/whatsapp/session-state-manager');
const messageQueue = require('../../queue/message-queue');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');
const rateLimiter = require('../../middlewares/rate-limiter');

// Get singleton instance of Session Pool
const sessionPool = WhatsAppSessionPool.getInstance();

// Initialize session pool message handler on startup
let sessionPoolInitialized = false;
(async () => {
  try {
    // Session pool is a singleton and auto-initializes
    sessionPoolInitialized = true;
    logger.info('✅ WhatsApp Session Pool ready in webhook');
    
    // Set up message handler for webhook processing
    sessionPool.on('message', async (companyId, messageData) => {
      await processIncomingMessage({ companyId, ...messageData });
    });
  } catch (error) {
    logger.error('Failed to initialize session pool:', error);
  }
})();

/**
 * Process incoming message from WhatsApp
 */
async function processIncomingMessage(messageData) {
  try {
    const { companyId, phone, message, messageId, pushName } = messageData;
    
    // Validate phone number
    if (!phone || phone.length < 5) {
      logger.error(`Invalid phone number in messageData:`, messageData);
      return;
    }
    
    logger.info(`📨 Processing WhatsApp message for company ${companyId} from ${phone}`);
    
    // Clean phone number - remove all non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Format message for queue
    const queueData = {
      companyId,
      from: cleanPhone, // Clean phone number (worker expects 'from' field)
      phone: cleanPhone, // Keep for backward compatibility
      message: message.text || message.caption || '[media]',
      messageType: message.type,
      messageId,
      clientName: pushName,
      timestamp: Date.now()
    };
    
    // Add to message queue for processing
    await messageQueue.addMessage(companyId, queueData);
    
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
    if (!sessionPoolInitialized) {
      logger.warn('Session pool not initialized');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
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
        const status = sessionPool.getSessionStatus(companyId);
        return res.json({ success: true, status });
        
      case 'qr':
        // Get QR code for authentication
        // Session Pool doesn't have getQRCode - need to create session first
        const session = await sessionPool.createSession(companyId);
        const qr = session?.qrCode || null;
        return res.json({ success: true, qr });
        
      default:
        // Default action - send message
        if (message && phone) {
          await sessionPool.sendMessage(companyId || 'default', phone, message);
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
    const status = sessionPool.getSessionStatus(companyId);
    
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
    const qr = await sessionPool.getQRCode(companyId);
    
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
    
    // Create new session in pool
    await sessionPool.createSession(companyId);
    
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
    // Get all active sessions from pool
    const sessions = sessionPool.getActiveSessions();
    
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
      // Session Pool doesn't have sendMedia yet - use sendMessage for now
      result = await sessionPool.sendMessage(companyId, phone, `[Media: ${mediaUrl}]\n${message || ''}`);
    } else {
      // Send text message
      result = await sessionPool.sendMessage(companyId, phone, message);
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
    await sessionPool.disconnect(companyId);
    
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
    await sessionPool.disconnect(companyId);
    
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

/**
 * 🏥 Health check endpoint for session diagnostics
 */
router.get('/webhook/whatsapp/baileys/health/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId || 'default';
    
    // Generate comprehensive health report
    const healthReport = await healthMonitor.generateHealthReport(companyId);
    
    res.json({
      success: true,
      ...healthReport
    });
    
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 📊 Get detailed diagnostics for a session
 */
router.get('/webhook/whatsapp/baileys/diagnostics/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId || 'default';
    
    // Get all diagnostic information
    const providerStatus = sessionPool.getSessionStatus(companyId);
    const redisState = await sessionStateManager.getSessionState(companyId);
    const connectionMetrics = await sessionStateManager.getConnectionMetrics(companyId);
    const healthMetrics = healthMonitor.getMetrics(companyId);
    const isMonitoring = healthMonitor.isMonitoring(companyId);
    
    // Generate recommendations
    const recommendations = [];
    
    if (!providerStatus?.connected && redisState?.status === 'connected') {
      recommendations.push({
        level: 'warning',
        message: 'Session state mismatch - provider disconnected but Redis shows connected',
        action: 'Consider restarting the session'
      });
    }
    
    if (connectionMetrics?.reconnectAttempts > 5) {
      recommendations.push({
        level: 'error',
        message: `Too many reconnection attempts (${connectionMetrics.reconnectAttempts})`,
        action: 'Check authentication or network stability'
      });
    }
    
    if (connectionMetrics?.lastActivityAge > 600000) { // 10 minutes
      recommendations.push({
        level: 'warning',
        message: 'No activity for 10+ minutes',
        action: 'Session may be stale, consider reconnecting'
      });
    }
    
    if (healthMetrics?.failedChecks > healthMetrics?.successfulChecks) {
      recommendations.push({
        level: 'error',
        message: 'More failed health checks than successful',
        action: 'Check connection stability and logs'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        level: 'success',
        message: 'Session appears healthy',
        action: 'No action required'
      });
    }
    
    res.json({
      success: true,
      companyId,
      timestamp: new Date().toISOString(),
      provider: providerStatus || { error: 'Provider not available' },
      redis: redisState || { error: 'No Redis state found' },
      metrics: connectionMetrics || { error: 'No connection metrics' },
      health: {
        monitoring: isMonitoring,
        metrics: healthMetrics || { error: 'No health metrics' }
      },
      recommendations
    });
    
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🔄 Force reconnection for a session
 */
router.post('/webhook/whatsapp/baileys/reconnect/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId || 'default';
    
    logger.info(`🔄 Force reconnection requested for company ${companyId}`);
    
    // First disconnect existing session
    await sessionPool.disconnect(companyId);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to reconnect
    await sessionPool.initializeCompanySession(companyId);
    
    res.json({
      success: true,
      message: `Reconnection initiated for company ${companyId}`,
      note: 'Check status endpoint in a few seconds to verify connection'
    });
    
  } catch (error) {
    logger.error('Reconnection failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 📈 Get all health metrics
 */
router.get('/webhook/whatsapp/baileys/metrics', async (req, res) => {
  try {
    const allMetrics = healthMonitor.getAllMetrics();
    const monitoredCompanies = healthMonitor.getMonitoredCompanies();
    const allSessionStates = await sessionStateManager.getAllSessionStates();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      monitoring: {
        activeCompanies: monitoredCompanies,
        count: monitoredCompanies.length
      },
      healthMetrics: allMetrics,
      sessionStates: allSessionStates
    });
    
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🧹 Clear session state from Redis
 */
router.delete('/webhook/whatsapp/baileys/redis/:companyId', async (req, res) => {
  try {
    const companyId = req.params.companyId;
    
    await sessionStateManager.clearSessionState(companyId);
    
    res.json({
      success: true,
      message: `Redis state cleared for company ${companyId}`
    });
    
  } catch (error) {
    logger.error('Failed to clear Redis state:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;