// src/index.js
// CRITICAL: Sentry must be imported FIRST
require('./instrument');

const config = require('./config');
const logger = require('./utils/logger');
const app = require('./api');
const messageQueue = require('./queue/message-queue');
const { validateRedisConfig } = require('./utils/redis-factory');
const secureConfig = require('./config/secure-config');
const { getSyncManager } = require('./sync/sync-manager');
const MarketplaceWebSocket = require('./api/websocket/marketplace-ws');

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global server instance
let server;
let marketplaceWS;

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  logger.info('🛑 Shutting down API server...');
  
  // Stop accepting new requests
  if (server) {
    server.close(() => {
      logger.info('✅ HTTP server closed');
    });
  }
  
  // Stop sync manager
  const syncManager = getSyncManager();
  await syncManager.shutdown();
  
  // Close queue connections
  await messageQueue.shutdown();
  
  // Give pending requests 10s to complete
  setTimeout(() => {
    logger.info('⏱️ Forcing shutdown after timeout');
    process.exit(0);
  }, 10000);
}

// Initialize and start server
async function startServer() {
  try {
    // Initialize secure configuration
    logger.info('🔑 Initializing secure configuration...');
    await secureConfig.initialize();
    
    // Validate Redis configuration
    logger.info('🔐 Validating Redis configuration...');
    await validateRedisConfig();
    
    // Start HTTP server
    server = app.listen(config.app.port, () => {
      logger.info(`🚀 AI Admin API started on port ${config.app.port}`);
      logger.info(`📊 Environment: ${config.app.env}`);
      logger.info(`🏢 Company ID: ${config.yclients.companyId}`);
      logger.info('🔒 Redis authentication: enabled');
    });

    // Initialize WebSocket server for marketplace
    marketplaceWS = new MarketplaceWebSocket(server);
    global.marketplaceWebSocket = marketplaceWS;
    logger.info('🔌 Marketplace WebSocket server initialized');
    
    // Initialize sync manager
    logger.info('🔄 Initializing sync manager...');
    const syncManager = getSyncManager();
    await syncManager.initialize();
    logger.info('✅ Sync manager started successfully');
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();