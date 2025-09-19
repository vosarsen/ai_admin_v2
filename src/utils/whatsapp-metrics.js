/**
 * WhatsApp Metrics System
 * Collects and manages metrics for monitoring WhatsApp operations
 * Supports multi-tenant tracking
 */

const EventEmitter = require('events');

class WhatsAppMetrics extends EventEmitter {
  constructor() {
    super();

    // Global metrics
    this.global = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesFailed: 0,
      mediaSent: 0,
      mediaFailed: 0,
      sessionConnections: 0,
      sessionDisconnections: 0,
      sessionReconnections: 0,
      qrScans: 0,
      pairingCodes: 0,
      authFailures: 0,
      rateLimits: 0,
      errors: new Map(),
      startTime: Date.now(),
    };

    // Per-company metrics (multi-tenant)
    this.companies = new Map();

    // Time-based metrics
    this.timeSeries = {
      messagesPerMinute: [],
      errorsPerMinute: [],
      connectionsPerHour: [],
    };

    // Performance metrics
    this.performance = {
      messageLatency: [],
      sessionInitTime: [],
      reconnectTime: [],
    };

    // Start metrics collection interval
    this.metricsInterval = setInterval(() => this.collectTimeSeries(), 60000); // Every minute
  }

  /**
   * Get or create company metrics
   */
  getCompanyMetrics(companyId) {
    if (!this.companies.has(companyId)) {
      this.companies.set(companyId, {
        messagesSent: 0,
        messagesReceived: 0,
        messagesFailed: 0,
        mediaSent: 0,
        mediaFailed: 0,
        sessionConnections: 0,
        sessionDisconnections: 0,
        lastActivity: Date.now(),
        errors: new Map(),
        createdAt: Date.now(),
      });
    }
    return this.companies.get(companyId);
  }

  /**
   * Increment a metric
   */
  increment(metric, companyId = null, amount = 1) {
    // Update global metrics
    if (this.global[metric] !== undefined) {
      this.global[metric] += amount;
    }

    // Update company metrics if provided
    if (companyId) {
      const companyMetrics = this.getCompanyMetrics(companyId);
      if (companyMetrics[metric] !== undefined) {
        companyMetrics[metric] += amount;
      }
      companyMetrics.lastActivity = Date.now();
    }

    // Emit metric event for real-time monitoring
    this.emit('metric', {
      type: 'increment',
      metric,
      companyId,
      amount,
      timestamp: Date.now(),
    });
  }

  /**
   * Record an error
   */
  recordError(error, companyId = null) {
    const errorKey = error.code || error.name || 'UNKNOWN';

    // Global error tracking
    const globalCount = this.global.errors.get(errorKey) || 0;
    this.global.errors.set(errorKey, globalCount + 1);

    // Company error tracking
    if (companyId) {
      const companyMetrics = this.getCompanyMetrics(companyId);
      const companyCount = companyMetrics.errors.get(errorKey) || 0;
      companyMetrics.errors.set(errorKey, companyCount + 1);
      companyMetrics.lastActivity = Date.now();
    }

    // Emit error event
    this.emit('error', {
      error: errorKey,
      companyId,
      timestamp: Date.now(),
    });
  }

  /**
   * Record performance metric
   */
  recordPerformance(metric, value, companyId = null) {
    if (this.performance[metric]) {
      // Keep last 100 samples
      this.performance[metric].push({
        value,
        companyId,
        timestamp: Date.now(),
      });

      if (this.performance[metric].length > 100) {
        this.performance[metric].shift();
      }
    }

    // Emit performance event
    this.emit('performance', {
      metric,
      value,
      companyId,
      timestamp: Date.now(),
    });
  }

  /**
   * Collect time series data
   */
  collectTimeSeries() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Calculate messages per minute
    const recentMessages = this.timeSeries.messagesPerMinute.filter(
      t => t.timestamp > oneMinuteAgo
    ).length;

    this.timeSeries.messagesPerMinute.push({
      count: this.global.messagesSent,
      timestamp: now,
    });

    // Keep only last hour of data
    const oneHourAgo = now - 3600000;
    this.timeSeries.messagesPerMinute = this.timeSeries.messagesPerMinute.filter(
      t => t.timestamp > oneHourAgo
    );

    // Similar for errors
    this.timeSeries.errorsPerMinute.push({
      count: Array.from(this.global.errors.values()).reduce((a, b) => a + b, 0),
      timestamp: now,
    });

    this.timeSeries.errorsPerMinute = this.timeSeries.errorsPerMinute.filter(
      t => t.timestamp > oneHourAgo
    );
  }

  /**
   * Get global metrics summary
   */
  getGlobalMetrics() {
    const uptime = Date.now() - this.global.startTime;
    const totalMessages = this.global.messagesSent + this.global.messagesReceived;
    const errorRate = totalMessages > 0 ?
      (this.global.messagesFailed / totalMessages) * 100 : 0;

    return {
      uptime,
      totals: {
        messagesSent: this.global.messagesSent,
        messagesReceived: this.global.messagesReceived,
        messagesFailed: this.global.messagesFailed,
        mediaSent: this.global.mediaSent,
        mediaFailed: this.global.mediaFailed,
      },
      sessions: {
        connections: this.global.sessionConnections,
        disconnections: this.global.sessionDisconnections,
        reconnections: this.global.sessionReconnections,
        active: this.global.sessionConnections - this.global.sessionDisconnections,
      },
      auth: {
        qrScans: this.global.qrScans,
        pairingCodes: this.global.pairingCodes,
        failures: this.global.authFailures,
      },
      errors: {
        total: Array.from(this.global.errors.values()).reduce((a, b) => a + b, 0),
        breakdown: Object.fromEntries(this.global.errors),
        rate: errorRate.toFixed(2) + '%',
      },
      rateLimits: this.global.rateLimits,
    };
  }

  /**
   * Get company-specific metrics
   */
  getCompanyMetrics(companyId) {
    const metrics = this.companies.get(companyId);
    if (!metrics) {
      return null;
    }

    const totalMessages = metrics.messagesSent + metrics.messagesReceived;
    const errorRate = totalMessages > 0 ?
      (metrics.messagesFailed / totalMessages) * 100 : 0;

    return {
      companyId,
      uptime: Date.now() - metrics.createdAt,
      lastActivity: metrics.lastActivity,
      messages: {
        sent: metrics.messagesSent,
        received: metrics.messagesReceived,
        failed: metrics.messagesFailed,
      },
      media: {
        sent: metrics.mediaSent,
        failed: metrics.mediaFailed,
      },
      sessions: {
        connections: metrics.sessionConnections,
        disconnections: metrics.sessionDisconnections,
      },
      errors: {
        total: Array.from(metrics.errors.values()).reduce((a, b) => a + b, 0),
        breakdown: Object.fromEntries(metrics.errors),
        rate: errorRate.toFixed(2) + '%',
      },
    };
  }

  /**
   * Get all companies metrics
   */
  getAllCompaniesMetrics() {
    const result = {};
    for (const [companyId, _] of this.companies) {
      result[companyId] = this.getCompanyMetrics(companyId);
    }
    return result;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {};

    for (const [metric, samples] of Object.entries(this.performance)) {
      if (samples.length === 0) {
        stats[metric] = { avg: 0, min: 0, max: 0, samples: 0 };
        continue;
      }

      const values = samples.map(s => s.value);
      stats[metric] = {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        samples: values.length,
      };
    }

    return stats;
  }

  /**
   * Get time series data
   */
  getTimeSeries(metric = 'messagesPerMinute', duration = 3600000) {
    const now = Date.now();
    const cutoff = now - duration;

    if (!this.timeSeries[metric]) {
      return [];
    }

    return this.timeSeries[metric]
      .filter(t => t.timestamp > cutoff)
      .map(t => ({
        ...t,
        age: now - t.timestamp,
      }));
  }

  /**
   * Calculate message rate
   */
  getMessageRate(windowMs = 60000) {
    const now = Date.now();
    const cutoff = now - windowMs;

    const recentMessages = this.timeSeries.messagesPerMinute
      .filter(t => t.timestamp > cutoff);

    if (recentMessages.length < 2) {
      return 0;
    }

    const firstCount = recentMessages[0].count;
    const lastCount = recentMessages[recentMessages.length - 1].count;
    const timeSpan = (recentMessages[recentMessages.length - 1].timestamp -
                     recentMessages[0].timestamp) / 1000; // in seconds

    return timeSpan > 0 ? (lastCount - firstCount) / timeSpan : 0;
  }

  /**
   * Check if metrics exceed thresholds
   */
  checkThresholds(thresholds = {}) {
    const alerts = [];
    const globalMetrics = this.getGlobalMetrics();

    // Check error rate
    if (thresholds.errorRate &&
        parseFloat(globalMetrics.errors.rate) > thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Error rate ${globalMetrics.errors.rate} exceeds threshold ${thresholds.errorRate}%`,
        value: parseFloat(globalMetrics.errors.rate),
      });
    }

    // Check disconnection rate
    const disconnectionRate = globalMetrics.sessions.connections > 0 ?
      (globalMetrics.sessions.disconnections / globalMetrics.sessions.connections) * 100 : 0;

    if (thresholds.disconnectionRate && disconnectionRate > thresholds.disconnectionRate) {
      alerts.push({
        type: 'disconnection_rate',
        severity: 'medium',
        message: `Disconnection rate ${disconnectionRate.toFixed(2)}% exceeds threshold ${thresholds.disconnectionRate}%`,
        value: disconnectionRate,
      });
    }

    // Check rate limits
    if (thresholds.rateLimits && globalMetrics.rateLimits > thresholds.rateLimits) {
      alerts.push({
        type: 'rate_limits',
        severity: 'high',
        message: `Rate limit hits ${globalMetrics.rateLimits} exceeds threshold ${thresholds.rateLimits}`,
        value: globalMetrics.rateLimits,
      });
    }

    return alerts;
  }

  /**
   * Reset metrics (for testing)
   */
  reset(companyId = null) {
    if (companyId) {
      this.companies.delete(companyId);
    } else {
      // Reset all global metrics
      this.global = {
        messagesSent: 0,
        messagesReceived: 0,
        messagesFailed: 0,
        mediaSent: 0,
        mediaFailed: 0,
        sessionConnections: 0,
        sessionDisconnections: 0,
        sessionReconnections: 0,
        qrScans: 0,
        pairingCodes: 0,
        authFailures: 0,
        rateLimits: 0,
        errors: new Map(),
        startTime: Date.now(),
      };
      this.companies.clear();
      this.timeSeries = {
        messagesPerMinute: [],
        errorsPerMinute: [],
        connectionsPerHour: [],
      };
      this.performance = {
        messageLatency: [],
        sessionInitTime: [],
        reconnectTime: [],
      };
    }
  }

  /**
   * Export metrics for external monitoring
   */
  export() {
    return {
      global: this.getGlobalMetrics(),
      companies: this.getAllCompaniesMetrics(),
      performance: this.getPerformanceStats(),
      timeSeries: {
        messagesPerMinute: this.getTimeSeries('messagesPerMinute', 3600000),
        errorsPerMinute: this.getTimeSeries('errorsPerMinute', 3600000),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Destroy metrics collector
   */
  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.removeAllListeners();
  }
}

module.exports = WhatsAppMetrics;