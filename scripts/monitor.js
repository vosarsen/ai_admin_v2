// scripts/monitor.js
/**
 * Production monitoring script
 * Checks system health and sends alerts
 */

const axios = require('axios');
const config = require('../src/config');
const logger = require('../src/utils/logger');

const CHECKS_INTERVAL = 60000; // 1 minute
const ALERT_THRESHOLD = 3; // Alert after 3 consecutive failures

class Monitor {
  constructor() {
    this.failures = {
      api: 0,
      whatsapp: 0,
      redis: 0,
      yclients: 0
    };
    
    this.apiUrl = `http://localhost:${config.app.port}`;
  }

  async start() {
    logger.info('🔍 Starting production monitoring...');
    
    // Initial check
    await this.runChecks();
    
    // Schedule periodic checks
    setInterval(() => this.runChecks(), CHECKS_INTERVAL);
  }

  async runChecks() {
    const timestamp = new Date().toISOString();
    logger.info(`📊 Running health checks at ${timestamp}`);
    
    // 1. Check API health
    const apiHealth = await this.checkAPI();
    
    // 2. Check queue metrics
    const queueHealth = await this.checkQueues();
    
    // 3. Check YClients connection
    const yclientsHealth = await this.checkYClients();
    
    // 4. Log summary
    this.logSummary({
      api: apiHealth,
      queue: queueHealth,
      yclients: yclientsHealth
    });
    
    // 5. Send alerts if needed
    this.checkAlerts();
  }

  async checkAPI() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: 5000
      });
      
      const healthy = response.data.status === 'healthy';
      
      if (healthy) {
        this.failures.api = 0;
        this.failures.whatsapp = response.data.services.whatsapp === 'connected' ? 0 : this.failures.whatsapp + 1;
        this.failures.redis = response.data.services.redis === 'connected' ? 0 : this.failures.redis + 1;
      } else {
        this.failures.api++;
      }
      
      return {
        healthy,
        whatsapp: response.data.services.whatsapp,
        redis: response.data.services.redis,
        responseTime: response.headers['x-response-time'] || 'N/A'
      };
      
    } catch (error) {
      this.failures.api++;
      logger.error('❌ API health check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  async checkQueues() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/api/metrics?companyId=${config.yclients.companyId}`,
        { timeout: 5000 }
      );
      
      const metrics = response.data.metrics;
      const healthy = metrics && metrics.failed < 10; // Alert if too many failures
      
      return {
        healthy,
        waiting: metrics.waiting,
        active: metrics.active,
        completed: metrics.completed,
        failed: metrics.failed
      };
      
    } catch (error) {
      logger.error('❌ Queue metrics check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  async checkYClients() {
    try {
      // Use cache-initial-data script logic
      const yclientsClient = require('../src/integrations/yclients/client');
      const result = await yclientsClient.healthCheck();
      
      if (result.healthy) {
        this.failures.yclients = 0;
      } else {
        this.failures.yclients++;
      }
      
      return result;
      
    } catch (error) {
      this.failures.yclients++;
      logger.error('❌ YClients health check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  logSummary(health) {
    const status = {
      '✅': health.api.healthy && health.queue.healthy && health.yclients.healthy,
      '⚠️': !health.api.healthy || !health.queue.healthy || !health.yclients.healthy
    };
    
    const emoji = status['✅'] ? '✅' : '⚠️';
    
    logger.info(`${emoji} Health Check Summary:`);
    logger.info(`  API: ${health.api.healthy ? '✅' : '❌'} ${health.api.responseTime || ''}`);
    logger.info(`  WhatsApp: ${health.api.whatsapp === 'connected' ? '✅' : '❌'}`);
    logger.info(`  Redis: ${health.api.redis === 'connected' ? '✅' : '❌'}`);
    logger.info(`  YClients: ${health.yclients.healthy ? '✅' : '❌'}`);
    
    if (health.queue.healthy) {
      logger.info(`  Queue: ✅ (Active: ${health.queue.active}, Failed: ${health.queue.failed})`);
    } else {
      logger.info(`  Queue: ❌ ${health.queue.error || 'Too many failures'}`);
    }
  }

  checkAlerts() {
    const alerts = [];
    
    if (this.failures.api >= ALERT_THRESHOLD) {
      alerts.push(`🚨 API is down! (${this.failures.api} consecutive failures)`);
    }
    
    if (this.failures.whatsapp >= ALERT_THRESHOLD) {
      alerts.push(`🚨 WhatsApp disconnected! (${this.failures.whatsapp} consecutive failures)`);
    }
    
    if (this.failures.redis >= ALERT_THRESHOLD) {
      alerts.push(`🚨 Redis is down! (${this.failures.redis} consecutive failures)`);
    }
    
    if (this.failures.yclients >= ALERT_THRESHOLD) {
      alerts.push(`🚨 YClients API failing! (${this.failures.yclients} consecutive failures)`);
    }
    
    if (alerts.length > 0) {
      logger.error('🚨 CRITICAL ALERTS:');
      alerts.forEach(alert => logger.error(alert));
      
      // TODO: Send alerts via email/SMS/Telegram
      this.sendAlerts(alerts);
    }
  }

  async sendAlerts(alerts) {
    // Implement your alert mechanism here
    // Examples:
    // - Send email via SendGrid
    // - Send SMS via Twilio
    // - Send Telegram message
    // - Post to Slack webhook
    
    logger.warn('Alert sending not implemented yet');
  }
}

// Start monitoring
const monitor = new Monitor();
monitor.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Stopping monitor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 Stopping monitor...');
  process.exit(0);
});