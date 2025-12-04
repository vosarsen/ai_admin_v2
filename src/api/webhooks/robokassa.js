/**
 * Robokassa Webhook Handler
 *
 * Handles payment callbacks from Robokassa:
 * - Result URL (POST) - technical callback for payment confirmation
 * - Success URL redirect verification
 *
 * CRITICAL ORDER OF OPERATIONS:
 * 1. Parse form data (urlencoded)
 * 2. Verify signature FIRST
 * 3. Check amount matches DB
 * 4. Check idempotency
 * 5. Process payment
 * 6. ONLY THEN respond OK{InvId}
 *
 * @module api/webhooks/robokassa
 */

const express = require('express');
const Sentry = require('@sentry/node');
const router = express.Router();

const postgres = require('../../database/postgres');
const { RobokassaPaymentRepository } = require('../../repositories');
const RobokassaService = require('../../services/payment/robokassa-service');
const rateLimiter = require('../../middlewares/rate-limiter');

// Initialize dependencies
const repository = new RobokassaPaymentRepository(postgres);
const service = new RobokassaService(repository);

// IMPORTANT: Parse URL-encoded form data (Robokassa sends POST as form data)
router.use(express.urlencoded({ extended: true }));

/**
 * Result URL endpoint - Robokassa payment confirmation
 *
 * POST /api/payments/robokassa/result
 *
 * Robokassa sends: OutSum, InvId, SignatureValue (and optionally EMail, Fee, etc.)
 * Must respond with: OK{InvId} on success, or error message on failure
 */
router.post('/result', rateLimiter, async (req, res) => {
  const startTime = Date.now();
  const { OutSum, InvId, SignatureValue, EMail, Fee } = req.body;

  // Log incoming request (without sensitive data)
  console.log('[Robokassa] Result callback received:', {
    InvId,
    OutSum,
    hasSignature: !!SignatureValue,
    EMail,
    Fee
  });

  try {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Verify signature FIRST (before any DB operations!)
    // ═══════════════════════════════════════════════════════════════════
    if (!service.verifyResultSignature(OutSum, InvId, SignatureValue)) {
      console.error('[Robokassa] Invalid signature for InvId:', InvId);
      Sentry.captureMessage('Robokassa invalid signature', {
        level: 'warning',
        tags: { component: 'robokassa', alert_type: 'invalid_signature' },
        extra: { InvId, OutSum }
      });
      return res.status(400).send('bad sign');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Find payment record
    // ═══════════════════════════════════════════════════════════════════
    const payment = await service.getPayment(InvId);

    if (!payment) {
      console.error('[Robokassa] Payment not found:', InvId);
      Sentry.captureMessage('Robokassa payment not found', {
        level: 'error',
        tags: { component: 'robokassa', alert_type: 'payment_not_found' },
        extra: { InvId, OutSum }
      });
      return res.status(400).send('bad sign');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Verify amount matches (prevent fraud!)
    // ═══════════════════════════════════════════════════════════════════
    if (!service.verifyAmount(payment, OutSum)) {
      console.error('[Robokassa] Amount mismatch:', {
        InvId,
        dbAmount: payment.amount,
        callbackAmount: OutSum
      });
      Sentry.captureMessage('Robokassa amount mismatch', {
        level: 'error',
        tags: { component: 'robokassa', alert_type: 'amount_mismatch' },
        extra: {
          InvId,
          dbAmount: payment.amount,
          callbackAmount: OutSum
        }
      });
      return res.status(400).send('bad sign');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Check idempotency - already processed?
    // ═══════════════════════════════════════════════════════════════════
    if (payment.status === 'success') {
      console.log('[Robokassa] Payment already processed (idempotent):', InvId);
      // Return OK immediately - this is a duplicate callback
      res.setHeader('Content-Type', 'text/plain');
      return res.send(`OK${InvId}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Process payment (with timeout)
    // ═══════════════════════════════════════════════════════════════════
    await service.processPaymentWithTimeout(InvId, OutSum, SignatureValue);

    const duration = Date.now() - startTime;
    console.log(`[Robokassa] Payment processed successfully: ${InvId} - ${duration}ms`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Return OK{InvId} - ONLY after successful processing!
    // ═══════════════════════════════════════════════════════════════════
    res.setHeader('Content-Type', 'text/plain');
    res.send(`OK${InvId}`);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Robokassa] Result processing error:', {
      InvId,
      error: error.message,
      duration: `${duration}ms`
    });

    Sentry.captureException(error, {
      tags: {
        component: 'robokassa',
        operation: 'result_webhook'
      },
      extra: {
        InvId,
        OutSum,
        duration: `${duration}ms`
      }
    });

    // DO NOT return OK on error - Robokassa will retry
    res.status(500).send('internal error');
  }
});

/**
 * Result URL endpoint - GET fallback
 *
 * GET /api/payments/robokassa/result
 *
 * Some payment methods may send GET instead of POST
 */
router.get('/result', rateLimiter, async (req, res) => {
  const { OutSum, InvId, SignatureValue } = req.query;

  console.log('[Robokassa] Result GET callback:', { InvId, OutSum });

  try {
    // Same validation flow as POST
    if (!service.verifyResultSignature(OutSum, InvId, SignatureValue)) {
      return res.status(400).send('bad sign');
    }

    const payment = await service.getPayment(InvId);
    if (!payment) {
      return res.status(400).send('bad sign');
    }

    if (!service.verifyAmount(payment, OutSum)) {
      return res.status(400).send('bad sign');
    }

    if (payment.status === 'success') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(`OK${InvId}`);
    }

    await service.processPaymentWithTimeout(InvId, OutSum, SignatureValue);

    res.setHeader('Content-Type', 'text/plain');
    res.send(`OK${InvId}`);

  } catch (error) {
    console.error('[Robokassa] Result GET error:', error.message);
    Sentry.captureException(error, {
      tags: { component: 'robokassa', operation: 'result_get' },
      extra: { InvId, OutSum }
    });
    res.status(500).send('internal error');
  }
});

/**
 * Health check endpoint
 *
 * GET /api/payments/robokassa/health
 */
router.get('/health', (req, res) => {
  const status = service.checkConfiguration();

  res.json({
    status: status.configured ? 'ok' : 'misconfigured',
    testMode: status.testMode,
    issues: status.issues,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
