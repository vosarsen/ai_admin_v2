// src/api/routes/demo-chat-analytics.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger').child({ module: 'demo-chat-analytics' });
const postgres = require('../../database/postgres');
const { DemoChatAnalyticsRepository } = require('../../repositories');

/**
 * @swagger
 * /api/demo-chat/analytics:
 *   get:
 *     summary: Get demo chat analytics
 *     description: Get analytics summary for demo chat (admin only)
 *     tags:
 *       - Demo Analytics
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, all]
 *         description: Time period for analytics
 *       - in: query
 *         name: apiKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin API key
 *     responses:
 *       200:
 *         description: Analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionCount:
 *                       type: number
 *                     totalMessages:
 *                       type: number
 *                     avgResponseTimeMs:
 *                       type: number
 *                     popularQueries:
 *                       type: array
 *                     periodStart:
 *                       type: string
 *                     periodEnd:
 *                       type: string
 *       401:
 *         description: Unauthorized - invalid API key
 *       500:
 *         description: Server error
 */
router.get('/demo-chat/analytics', async (req, res) => {
  const startTime = Date.now();

  try {
    // Simple API key authentication
    const { apiKey, period = 'all' } = req.query;

    // Check API key (you should set DEMO_ANALYTICS_API_KEY in .env)
    const validApiKey = process.env.DEMO_ANALYTICS_API_KEY || 'demo-analytics-secret-key';
    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid API key'
      });
    }

    // Calculate date range based on period
    let startDate, endDate;
    const now = new Date();

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.setDate(now.getDate() - 30));
        endDate = new Date();
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
    }

    // Get analytics
    const analyticsRepo = new DemoChatAnalyticsRepository(postgres);
    const summary = await analyticsRepo.getAnalyticsSummary({
      startDate,
      endDate
    });

    const duration = Date.now() - startTime;

    logger.info('Demo chat analytics retrieved', {
      period,
      duration,
      sessionCount: summary.sessionCount
    });

    res.json({
      success: true,
      data: summary,
      meta: {
        period,
        retrievalTimeMs: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Demo chat analytics error:', {
      error: error.message,
      stack: error.stack,
      duration
    });

    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to retrieve analytics'
    });
  }
});

/**
 * @swagger
 * /api/demo-chat/analytics/provider-comparison:
 *   get:
 *     summary: Compare AI provider performance
 *     description: Get performance comparison between different AI providers (admin only)
 *     tags:
 *       - Demo Analytics
 *     parameters:
 *       - in: query
 *         name: apiKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin API key
 *     responses:
 *       200:
 *         description: Provider comparison data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/demo-chat/analytics/provider-comparison', async (req, res) => {
  const startTime = Date.now();

  try {
    const { apiKey } = req.query;

    // Check API key
    const validApiKey = process.env.DEMO_ANALYTICS_API_KEY || 'demo-analytics-secret-key';
    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid API key'
      });
    }

    const analyticsRepo = new DemoChatAnalyticsRepository(postgres);

    // Get avg response time for each provider
    const [geminiAvg, deepseekAvg] = await Promise.all([
      analyticsRepo.getAverageResponseTime({ ai_provider: 'gemini-flash' }),
      analyticsRepo.getAverageResponseTime({ ai_provider: 'deepseek' })
    ]);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        providers: [
          {
            name: 'gemini-flash',
            avgResponseTimeMs: Math.round(geminiAvg),
            costPerMonthUSD: 29
          },
          {
            name: 'deepseek',
            avgResponseTimeMs: Math.round(deepseekAvg),
            costPerMonthUSD: 106
          }
        ],
        comparison: {
          speedImprovement: deepseekAvg > 0 ? ((deepseekAvg - geminiAvg) / deepseekAvg * 100).toFixed(1) + '%' : 'N/A',
          costSavings: '$77/month (3.6x cheaper)'
        }
      },
      meta: {
        retrievalTimeMs: duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Provider comparison error:', {
      error: error.message,
      stack: error.stack,
      duration
    });

    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to retrieve provider comparison'
    });
  }
});

module.exports = router;
