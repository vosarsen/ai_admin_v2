// src/api/index.js
const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');
// Using unified WhatsApp Manager (2-layer architecture)
const whatsappManager = require('../integrations/whatsapp/whatsapp-manager-unified');
const whatsappClient = whatsappManager; // Backward compatibility alias

// Initialize WhatsApp Session Pool
const { getSessionPool } = require('../integrations/whatsapp/session-pool');
const sessionPool = getSessionPool(); // Initialize singleton at startup
const { validateWebhookSignature, validateApiKey } = require('../middlewares/webhook-auth');
const rateLimiter = require('../middlewares/rate-limiter');
const criticalErrorMiddleware = require('../middlewares/critical-error');
const circuitBreakerFactory = require('../utils/circuit-breaker');
const { getSyncManager } = require('../sync/sync-manager');

// Import webhook routes
const whatsappBatchedWebhook = require('./webhooks/whatsapp-batched');
const whatsappBaileysWebhook = require('./webhooks/whatsapp-baileys');
const whatsappManagement = require('./routes/whatsapp-management');

// Import Swagger documentation
const { setupSwagger } = require('./swagger');

const app = express();

// View engine setup
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Setup Swagger documentation
setupSwagger(app);

// Mount webhook routes
app.use(whatsappBatchedWebhook);
app.use(whatsappBaileysWebhook);

// Mount API routes
app.use('/api/whatsapp', whatsappManagement);

// Other API routes
const calendarRoutes = require('./routes/calendar');
app.use('/api/calendar', calendarRoutes);

// YClients integration routes
const yclientsRoutes = require('./routes/yclients-integration');
app.use(yclientsRoutes);

// Cache monitoring routes
const cacheRoutes = require('./routes/cache-stats');
app.use('/api/cache', cacheRoutes);

// AI management routes
const aiManagementRoutes = require('./routes/ai-management');
app.use('/api/ai', aiManagementRoutes);

// WhatsApp session management routes (NEW ARCHITECTURE)
const whatsappSessionsRoutes = require('./routes/whatsapp-sessions-improved');
app.use('/api/whatsapp', whatsappSessionsRoutes);

// Marketplace integration routes
const marketplaceRoutes = require('./routes/marketplace');
app.use('/marketplace', marketplaceRoutes);

// Health check routes with detailed monitoring
const healthRoutes = require('./routes/health');
app.use('', healthRoutes);

// WhatsApp webhook - DEPRECATED (redirecting to batched version)
// All messages should now go through /webhook/whatsapp/batched for proper rapid-fire handling
app.post('/webhook/whatsapp', rateLimiter, validateWebhookSignature, async (req, res) => {
  logger.warn('⚠️ Old webhook endpoint used, redirecting to batched version');
  
  // Forward to batched endpoint
  req.url = '/webhook/whatsapp/batched';
  whatsAppBatchedWebhook(req, res);
});

// Manual message send (for testing, with API key auth and strict rate limit)
app.post('/api/send-message', rateLimiter, validateApiKey, async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message'
      });
    }

    const result = await whatsappClient.sendMessage(to, message);
    
    res.json(result);
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Queue metrics (with API rate limit)
app.get('/api/metrics', rateLimiter, async (req, res) => {
  try {
    const companyId = req.query.companyId || config.yclients.companyId;
    const queueName = `company-${companyId}-messages`;
    
    const metrics = await messageQueue.getMetrics(queueName);
    
    res.json({
      success: true,
      queue: queueName,
      metrics
    });
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Circuit breaker status
app.get('/api/circuit-breakers', rateLimiter, (req, res) => {
  try {
    const status = circuitBreakerFactory.getAllStatus();
    res.json({
      success: true,
      circuitBreakers: status
    });
  } catch (error) {
    logger.error('Circuit breaker status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Sync endpoints
app.get('/api/sync/status', rateLimiter, async (req, res) => {
  try {
    const syncManager = getSyncManager();
    const status = await syncManager.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual schedule sync
app.post('/api/sync/schedules', rateLimiter, validateApiKey, async (req, res) => {
  try {
    logger.info('Manual schedule sync requested');
    const syncManager = getSyncManager();
    const result = await syncManager.syncSchedules();
    res.json({
      success: true,
      message: 'Schedule sync initiated',
      result
    });
  } catch (error) {
    logger.error('Manual sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WhatsApp reaction endpoint
app.post('/api/whatsapp/reaction', rateLimiter, async (req, res) => {
  const { to, emoji, messageId, companyId } = req.body;
  
  if (!to || !emoji || !messageId || !companyId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: to, emoji, messageId, companyId'
    });
  }
  
  try {
    logger.info(`🔵 Reaction API called:`, { to, emoji, messageId, companyId });
    
    const { getSessionPool } = require('../integrations/whatsapp/session-pool');
    const sessionPool = getSessionPool();
    
    // Use the new sendReaction method that handles session creation automatically
    const result = await sessionPool.sendReaction(companyId, to, emoji, messageId);
    
    logger.info(`✅ Reaction ${emoji} sent to ${to} via API`);
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Failed to send reaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Full sync (use with caution)
app.post('/api/sync/full', rateLimiter, validateApiKey, async (req, res) => {
  try {
    logger.info('Manual full sync requested');
    const syncManager = getSyncManager();
    const result = await syncManager.runFullSync();
    res.json({
      success: true,
      message: 'Full sync initiated',
      result
    });
  } catch (error) {
    logger.error('Full sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler - use critical error middleware
app.use(criticalErrorMiddleware);

module.exports = app;