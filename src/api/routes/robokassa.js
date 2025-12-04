/**
 * Robokassa Payment API Routes
 *
 * Provides endpoints for:
 * - Creating payment links
 * - Checking payment status
 * - Payment history
 *
 * @module api/routes/robokassa
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const Sentry = require('@sentry/node');

const postgres = require('../../database/postgres');
const { RobokassaPaymentRepository } = require('../../repositories');
const RobokassaService = require('../../services/payment/robokassa-service');
const robokassaConfig = require('../../config/robokassa-config');
const rateLimiter = require('../../middlewares/rate-limiter');
const {
  validateCreatePayment,
  validateInvoiceId,
  validateSalonId,
  validateHistoryQuery
} = require('../../middlewares/validators/robokassa-validator');

// Initialize dependencies
const repository = new RobokassaPaymentRepository(postgres);
const service = new RobokassaService(repository);

/**
 * POST /api/payments/robokassa/create
 *
 * Create a new payment and return payment URL
 *
 * Body:
 * - salon_id: number (required) - YClients salon ID
 * - amount: number (required) - Payment amount in rubles
 * - description: string (optional) - Payment description
 * - email: string (optional) - Customer email for receipt
 */
router.post('/create', rateLimiter, validateCreatePayment, async (req, res) => {
  const startTime = Date.now();
  const { salon_id, amount, description, email } = req.body;

  try {
    // Generate payment URL (validation already done by middleware)
    const result = await service.generatePaymentUrl(salon_id, amount, {
      description,
      email
    });

    const duration = Date.now() - startTime;
    console.log(`[Robokassa] Payment created for salon ${salon_id}: ${result.invoiceId} - ${duration}ms`);

    res.json({
      success: true,
      data: {
        paymentUrl: result.url,
        invoiceId: result.invoiceId,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
        expiresIn: '24 hours'
      }
    });

  } catch (error) {
    console.error('[Robokassa] Create payment error:', error.message);
    Sentry.captureException(error, {
      tags: { component: 'robokassa', operation: 'createPayment' },
      extra: { salon_id, amount, duration: `${Date.now() - startTime}ms` }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create payment',
      message: error.message
    });
  }
});

/**
 * GET /api/payments/robokassa/status/:invoiceId
 *
 * Get payment status by invoice ID
 */
router.get('/status/:invoiceId', rateLimiter, validateInvoiceId, async (req, res) => {
  const { invoiceId } = req.params;

  try {
    const payment = await service.getPayment(invoiceId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: {
        invoiceId: payment.invoice_id,
        salonId: payment.salon_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        createdAt: payment.created_at,
        completedAt: payment.completed_at,
        errorMessage: payment.error_message
      }
    });

  } catch (error) {
    console.error('[Robokassa] Get status error:', error.message);
    Sentry.captureException(error, {
      tags: { component: 'robokassa', operation: 'getStatus' },
      extra: { invoiceId }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
});

/**
 * GET /api/payments/robokassa/history/:salonId
 *
 * Get payment history for a salon
 *
 * Query params:
 * - status: string (optional) - Filter by status (pending, success, failed)
 * - limit: number (optional) - Max records (default: 50)
 * - offset: number (optional) - Offset for pagination
 */
router.get('/history/:salonId', rateLimiter, validateSalonId, validateHistoryQuery, async (req, res) => {
  const { salonId } = req.params;
  const { status, limit, offset } = req.query;

  try {
    const payments = await service.getPaymentsBySalon(parseInt(salonId), {
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    const stats = await service.getPaymentStats(parseInt(salonId));

    res.json({
      success: true,
      data: {
        payments: payments.map(p => ({
          invoiceId: p.invoice_id,
          amount: parseFloat(p.amount),
          currency: p.currency,
          status: p.status,
          description: p.description,
          createdAt: p.created_at,
          completedAt: p.completed_at
        })),
        stats: {
          totalSuccessful: stats.successful_count,
          totalPending: stats.pending_count,
          totalFailed: stats.failed_count,
          totalAmount: stats.total_amount
        },
        pagination: {
          limit: parseInt(limit) || 50,
          offset: parseInt(offset) || 0
        }
      }
    });

  } catch (error) {
    console.error('[Robokassa] Get history error:', error.message);
    Sentry.captureException(error, {
      tags: { component: 'robokassa', operation: 'getHistory' },
      extra: { salonId }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get payment history'
    });
  }
});

/**
 * GET /api/payments/robokassa/config
 *
 * Get Robokassa configuration (non-sensitive)
 */
router.get('/config', (req, res) => {
  const status = service.checkConfiguration();

  res.json({
    success: true,
    data: {
      configured: status.configured,
      testMode: status.testMode,
      merchant: robokassaConfig.merchant.login ? 'configured' : 'not configured',
      minAmount: robokassaConfig.validation.minAmount,
      maxAmount: robokassaConfig.validation.maxAmount,
      currency: robokassaConfig.settings.defaultCurrency,
      fiscalEnabled: robokassaConfig.fiscal.enabled
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Static pages for Success/Fail redirects
// Note: These are mounted at /payment/* via separate router
// ═══════════════════════════════════════════════════════════════════

/**
 * Success/Fail page router - to be mounted at /payment
 */
const pageRouter = express.Router();

pageRouter.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/payment/success.html'));
});

pageRouter.get('/fail', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/payment/fail.html'));
});

module.exports = { apiRouter: router, pageRouter };
