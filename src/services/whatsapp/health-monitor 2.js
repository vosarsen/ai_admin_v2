// src/services/whatsapp/health-monitor.js
const logger = require('../../utils/logger');
const sessionStateManager = require('./session-state-manager');

class WhatsAppHealthMonitor {
  constructor() {
    this.healthChecks = new Map(); // companyId -> interval ID
    this.checkInterval = 30000; // Check every 30 seconds
    this.maxInactivityTime = 300000; // 5 minutes of inactivity
    this.healthMetrics = new Map(); // companyId -> metrics
    this.provider = null;
  }

  /**
   * Initialize the health monitor with a provider
   */
  initialize(provider) {
    this.provider = provider;
    logger.info('🏥 WhatsApp health monitor initialized');
  }

  /**
   * Start monitoring a session
   */
  startMonitoring(companyId) {
    // Stop any existing monitoring for this company
    this.stopMonitoring(companyId);
    
    // Initialize metrics for this company
    this.healthMetrics.set(companyId, {
      lastCheck: Date.now(),
      checksPerformed: 0,
      reconnectsTriggered: 0,
      failedChecks: 0,
      successfulChecks: 0
    });
    
    const interval = setInterval(async () => {
      await this.performHealthCheck(companyId);
    }, this.checkInterval);
    
    this.healthChecks.set(companyId, interval);
    logger.info(`🏥 Health monitoring started for company ${companyId}`);
    
    // Perform initial check
    this.performHealthCheck(companyId);
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(companyId) {
    const metrics = this.healthMetrics.get(companyId) || {};
    metrics.checksPerformed++;
    metrics.lastCheck = Date.now();
    
    try {
      // Get provider status
      const status = this.provider?.getSessionStatus(companyId);
      
      if (!status || !status.connected) {
        logger.warn(`⚠️ Health check failed for company ${companyId}: Not connected`);
        metrics.failedChecks++;
        
        // Get Redis state to check last activity
        const redisState = await sessionStateManager.getSessionState(companyId);
        
        if (redisState) {
          const timeSinceActivity = Date.now() - new Date(redisState.lastActivity || 0).getTime();
          
          // Check if we should attempt reconnection
          if (timeSinceActivity > this.maxInactivityTime) {
            logger.info(`🔄 Initiating reconnection for inactive session ${companyId} (inactive for ${Math.round(timeSinceActivity / 1000)}s)`);
            metrics.reconnectsTriggered++;
            
            // Only try to reconnect if provider is available and session exists
            if (this.provider && this.provider.hasSession(companyId)) {
              await this.provider.handleReconnection(companyId);
            } else if (this.provider) {
              // Try to connect fresh session if no existing session
              await this.provider.connectSession(companyId);
            }
          } else {
            logger.debug(`Session ${companyId} is temporarily disconnected but recently active (${Math.round(timeSinceActivity / 1000)}s ago)`);
          }
        } else {
          logger.debug(`No Redis state found for company ${companyId}, might be a new session`);
        }
      } else {
        logger.debug(`✅ Health check passed for company ${companyId}`);
        metrics.successfulChecks++;
        
        // Update last activity in Redis
        await sessionStateManager.updateLastActivity(companyId);
        
        // Check connection quality
        const connectionMetrics = await sessionStateManager.getConnectionMetrics(companyId);
        if (connectionMetrics) {
          // Log if there are many reconnect attempts
          if (connectionMetrics.reconnectAttempts > 3) {
            logger.warn(`⚠️ Company ${companyId} has ${connectionMetrics.reconnectAttempts} reconnect attempts`);
          }
          
          // Log if uptime is very low
          if (connectionMetrics.uptime && connectionMetrics.uptime < 60000) { // Less than 1 minute
            logger.warn(`⚠️ Company ${companyId} has low uptime: ${Math.round(connectionMetrics.uptime / 1000)}s`);
          }
        }
      }
      
      this.healthMetrics.set(companyId, metrics);
      
    } catch (error) {
      logger.error(`❌ Health check error for company ${companyId}:`, error);
      metrics.failedChecks++;
      this.healthMetrics.set(companyId, metrics);
    }
  }

  /**
   * Stop monitoring a session
   */
  stopMonitoring(companyId) {
    if (this.healthChecks.has(companyId)) {
      clearInterval(this.healthChecks.get(companyId));
      this.healthChecks.delete(companyId);
      this.healthMetrics.delete(companyId);
      logger.info(`🛑 Health monitoring stopped for company ${companyId}`);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll() {
    for (const companyId of this.healthChecks.keys()) {
      this.stopMonitoring(companyId);
    }
    logger.info('🛑 All health monitoring stopped');
  }

  /**
   * Get health metrics for a company
   */
  getMetrics(companyId) {
    return this.healthMetrics.get(companyId) || null;
  }

  /**
   * Get all health metrics
   */
  getAllMetrics() {
    const allMetrics = {};
    for (const [companyId, metrics] of this.healthMetrics.entries()) {
      allMetrics[companyId] = metrics;
    }
    return allMetrics;
  }

  /**
   * Generate health report
   */
  async generateHealthReport(companyId) {
    const metrics = this.getMetrics(companyId);
    const providerStatus = this.provider?.getSessionStatus(companyId);
    const redisState = await sessionStateManager.getSessionState(companyId);
    const connectionMetrics = await sessionStateManager.getConnectionMetrics(companyId);
    
    const report = {
      companyId,
      timestamp: new Date().toISOString(),
      monitoring: {
        active: this.healthChecks.has(companyId),
        metrics: metrics || 'No metrics available'
      },
      provider: providerStatus || 'Provider not available',
      redis: redisState || 'No Redis state',
      connection: connectionMetrics || 'No connection metrics',
      recommendations: []
    };
    
    // Generate recommendations
    if (!providerStatus?.connected && redisState?.status === 'connected') {
      report.recommendations.push('⚠️ Session state mismatch - consider restarting');
    }
    
    if (metrics?.failedChecks > metrics?.successfulChecks) {
      report.recommendations.push('⚠️ More failed checks than successful - check connection stability');
    }
    
    if (connectionMetrics?.reconnectAttempts > 5) {
      report.recommendations.push('⚠️ Too many reconnection attempts - check authentication or network');
    }
    
    if (connectionMetrics?.lastActivityAge > 600000) { // 10 minutes
      report.recommendations.push('⚠️ No activity for 10+ minutes - session may be stale');
    }
    
    if (connectionMetrics?.downtime > 300000) { // 5 minutes
      report.recommendations.push('⚠️ Session has been down for more than 5 minutes');
    }
    
    if (report.recommendations.length === 0) {
      report.recommendations.push('✅ Session appears healthy');
    }
    
    return report;
  }

  /**
   * Check if monitoring is active for a company
   */
  isMonitoring(companyId) {
    return this.healthChecks.has(companyId);
  }

  /**
   * Get list of all monitored companies
   */
  getMonitoredCompanies() {
    return Array.from(this.healthChecks.keys());
  }
}

// Export singleton instance
module.exports = new WhatsAppHealthMonitor();