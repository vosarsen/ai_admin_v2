const express = require('express');
const router = express.Router();
const prometheusMetrics = require('../../services/ai-admin-v2/modules/prometheus-metrics');
const logger = require('../../utils/logger').child({ module: 'metrics-api' });

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     description: Returns metrics in Prometheus format for monitoring and alerting
 *     tags:
 *       - Monitoring
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP ai_admin_http_requests_total Total number of HTTP requests
 *                 # TYPE ai_admin_http_requests_total counter
 *                 ai_admin_http_requests_total{method="GET",route="/health",status="200"} 42
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await prometheusMetrics.getMetrics();
    res.set('Content-Type', prometheusMetrics.getContentType());
    res.end(metrics);
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({ 
      error: 'Failed to get metrics',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /metrics/reset:
 *   post:
 *     summary: Reset all metrics
 *     description: Resets all Prometheus metrics (use with caution)
 *     tags:
 *       - Monitoring
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Metrics reset successfully"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/reset', async (req, res) => {
  try {
    // Проверка авторизации (простая проверка API key)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.METRICS_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    prometheusMetrics.reset();
    logger.info('Metrics reset by API request');
    
    res.json({ 
      success: true,
      message: 'Metrics reset successfully' 
    });
  } catch (error) {
    logger.error('Error resetting metrics:', error);
    res.status(500).json({ 
      error: 'Failed to reset metrics',
      message: error.message 
    });
  }
});

module.exports = router;