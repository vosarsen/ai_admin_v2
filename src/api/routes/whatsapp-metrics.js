/**
 * WhatsApp Metrics API Routes
 * Provides endpoints for monitoring WhatsApp system metrics
 */

const express = require('express');
const router = express.Router();
const whatsappManager = require('../../integrations/whatsapp/whatsapp-manager');
const WhatsAppValidator = require('../../utils/whatsapp-validator');
const { authMiddleware } = require('../../middlewares/auth');
const logger = require('../../utils/logger');

/**
 * Get global metrics
 * GET /api/whatsapp/metrics
 */
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const metrics = whatsappManager.metrics.getGlobalMetrics();
    res.json({
      success: true,
      metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get global metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * Get company-specific metrics
 * GET /api/whatsapp/metrics/:companyId
 */
router.get('/metrics/:companyId', authMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Validate company ID
    const validation = WhatsAppValidator.validateCompanyId(companyId);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const metrics = whatsappManager.metrics.getCompanyMetrics(companyId);
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No metrics found for this company',
      });
    }

    res.json({
      success: true,
      metrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get company metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * Get all companies metrics
 * GET /api/whatsapp/metrics/companies/all
 */
router.get('/metrics/companies/all', authMiddleware, async (req, res) => {
  try {
    const metrics = whatsappManager.metrics.getAllCompaniesMetrics();
    res.json({
      success: true,
      companies: metrics,
      count: Object.keys(metrics).length,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get all companies metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
    });
  }
});

/**
 * Get performance statistics
 * GET /api/whatsapp/metrics/performance
 */
router.get('/metrics/performance', authMiddleware, async (req, res) => {
  try {
    const performance = whatsappManager.metrics.getPerformanceStats();
    res.json({
      success: true,
      performance,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance statistics',
    });
  }
});

/**
 * Get time series data
 * GET /api/whatsapp/metrics/timeseries
 */
router.get('/metrics/timeseries', authMiddleware, async (req, res) => {
  try {
    const { metric = 'messagesPerMinute', duration = 3600000 } = req.query;

    const timeSeries = whatsappManager.metrics.getTimeSeries(
      metric,
      parseInt(duration)
    );

    res.json({
      success: true,
      metric,
      duration: parseInt(duration),
      data: timeSeries,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get time series:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve time series data',
    });
  }
});

/**
 * Get message rate
 * GET /api/whatsapp/metrics/rate
 */
router.get('/metrics/rate', authMiddleware, async (req, res) => {
  try {
    const { window = 60000 } = req.query;
    const rate = whatsappManager.metrics.getMessageRate(parseInt(window));

    res.json({
      success: true,
      rate: {
        messagesPerSecond: rate,
        messagesPerMinute: rate * 60,
        window: parseInt(window),
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get message rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve message rate',
    });
  }
});

/**
 * Check threshold alerts
 * GET /api/whatsapp/metrics/alerts
 */
router.get('/metrics/alerts', authMiddleware, async (req, res) => {
  try {
    const thresholds = {
      errorRate: parseFloat(req.query.errorRate || '10'),
      disconnectionRate: parseFloat(req.query.disconnectionRate || '20'),
      rateLimits: parseInt(req.query.rateLimits || '10'),
    };

    const alerts = whatsappManager.metrics.checkThresholds(thresholds);

    res.json({
      success: true,
      alerts,
      thresholds,
      hasAlerts: alerts.length > 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to check alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check threshold alerts',
    });
  }
});

/**
 * Export all metrics
 * GET /api/whatsapp/metrics/export
 */
router.get('/metrics/export', authMiddleware, async (req, res) => {
  try {
    const exportData = whatsappManager.metrics.export();

    res.json({
      success: true,
      export: exportData,
    });
  } catch (error) {
    logger.error('Failed to export metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics',
    });
  }
});

/**
 * Reset metrics (admin only)
 * POST /api/whatsapp/metrics/reset
 */
router.post('/metrics/reset', authMiddleware, async (req, res) => {
  try {
    const { companyId } = req.body;

    // This should have additional admin authorization
    // For now, just log the action
    logger.warn(`Metrics reset requested for ${companyId || 'all'}`);

    whatsappManager.metrics.reset(companyId);

    res.json({
      success: true,
      message: companyId ?
        `Metrics reset for company ${companyId}` :
        'All metrics reset',
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to reset metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
    });
  }
});

/**
 * Health check with metrics
 * GET /api/whatsapp/health/metrics
 */
router.get('/health/metrics', async (req, res) => {
  try {
    const health = await whatsappManager.checkHealth();
    const metrics = whatsappManager.metrics.getGlobalMetrics();
    const alerts = whatsappManager.metrics.checkThresholds({
      errorRate: 10,
      disconnectionRate: 20,
      rateLimits: 10,
    });

    const status = alerts.some(a => a.severity === 'high') ? 'critical' :
                   alerts.some(a => a.severity === 'medium') ? 'warning' :
                   'healthy';

    res.json({
      success: true,
      status,
      health,
      metrics: {
        uptime: metrics.uptime,
        messages: metrics.totals,
        sessions: metrics.sessions,
        errors: metrics.errors,
      },
      alerts: alerts.length > 0 ? alerts : undefined,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to get health metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health metrics',
    });
  }
});

module.exports = router;