/**
 * RobokassaService - Business logic for Robokassa payment gateway
 *
 * Handles:
 * - Payment URL generation with MD5 signatures
 * - Webhook signature verification
 * - Payment processing with transaction support
 * - Fiscal receipt generation (54-FZ compliance)
 *
 * @module services/payment/robokassa-service
 */

const crypto = require('crypto');
const Sentry = require('@sentry/node');
const robokassaConfig = require('../../config/robokassa-config');

// Processing timeout (Robokassa requires response within 30 seconds)
const PROCESSING_TIMEOUT_MS = 25000;

class RobokassaService {
  /**
   * Create a RobokassaService instance
   * @param {Object} repository - RobokassaPaymentRepository instance
   */
  constructor(repository) {
    this.repository = repository;
    this.config = robokassaConfig;

    // Warn if test mode in production
    this._checkTestModeWarning();
  }

  /**
   * Check and warn if test mode is enabled in production
   * @private
   */
  _checkTestModeWarning() {
    if (process.env.NODE_ENV === 'production' && this.config.settings.isTestMode) {
      console.warn('[Robokassa] ⚠️ WARNING: Test mode is ENABLED in production!');
      Sentry.captureMessage('Robokassa test mode enabled in production', {
        level: 'warning',
        tags: { component: 'robokassa', alert_type: 'config_warning' }
      });
    }
  }

  /**
   * Build MD5 signature for payment form
   * Formula: MD5(MerchantLogin:OutSum:InvId:Password1)
   *
   * @param {number|string} outSum - Payment amount
   * @param {string} invId - Invoice ID
   * @returns {string} MD5 signature in UPPERCASE
   */
  buildPaymentSignature(outSum, invId) {
    const signatureString = [
      this.config.merchant.login,
      outSum,
      invId,
      this.config.merchant.passwords.password1
    ].join(':');

    return crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Build MD5 signature for payment form with receipt
   * Formula: MD5(MerchantLogin:OutSum:InvId:Receipt:Password1)
   *
   * @param {number|string} outSum - Payment amount
   * @param {string} invId - Invoice ID
   * @param {string} receiptJson - URL-encoded receipt JSON
   * @returns {string} MD5 signature in UPPERCASE
   */
  buildPaymentSignatureWithReceipt(outSum, invId, receiptJson) {
    const signatureString = [
      this.config.merchant.login,
      outSum,
      invId,
      receiptJson,
      this.config.merchant.passwords.password1
    ].join(':');

    return crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Verify Result URL signature from Robokassa
   * Formula: MD5(OutSum:InvId:Password2)
   *
   * IMPORTANT: Uses Password2, not Password1!
   *
   * @param {number|string} outSum - Payment amount from callback
   * @param {string} invId - Invoice ID from callback
   * @param {string} signature - Signature from callback
   * @returns {boolean} True if signature is valid
   */
  verifyResultSignature(outSum, invId, signature) {
    if (!signature) {
      return false;
    }

    const expectedSignature = this._buildResultSignature(outSum, invId);
    return signature.toUpperCase() === expectedSignature;
  }

  /**
   * Build expected Result URL signature
   * @private
   * @param {number|string} outSum - Payment amount
   * @param {string} invId - Invoice ID
   * @returns {string} MD5 signature in UPPERCASE
   */
  _buildResultSignature(outSum, invId) {
    const signatureString = [
      outSum,
      invId,
      this.config.merchant.passwords.password2
    ].join(':');

    return crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Verify Success/Fail URL signature
   * Formula: MD5(OutSum:InvId:Password1)
   *
   * @param {number|string} outSum - Payment amount
   * @param {string} invId - Invoice ID
   * @param {string} signature - Signature from query params
   * @returns {boolean} True if signature is valid
   */
  verifySuccessSignature(outSum, invId, signature) {
    if (!signature) {
      return false;
    }

    const signatureString = [
      outSum,
      invId,
      this.config.merchant.passwords.password1
    ].join(':');

    const expectedSignature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex')
      .toUpperCase();

    return signature.toUpperCase() === expectedSignature;
  }

  /**
   * Verify payment amount matches database
   *
   * @param {Object} payment - Payment record from DB
   * @param {number|string} outSum - Amount from Robokassa callback
   * @returns {boolean} True if amounts match (within 0.01 tolerance)
   */
  verifyAmount(payment, outSum) {
    if (!payment || !outSum) {
      return false;
    }

    const dbAmount = parseFloat(payment.amount);
    const callbackAmount = parseFloat(outSum);

    // Allow small floating point differences
    return Math.abs(dbAmount - callbackAmount) < 0.01;
  }

  /**
   * Generate full payment URL for Robokassa
   *
   * @param {number} salonId - YClients salon ID
   * @param {number} amount - Payment amount in rubles
   * @param {Object} options - Additional options
   * @param {string} options.description - Payment description
   * @param {string} options.email - Customer email for receipt
   * @returns {Promise<Object>} { url, invoiceId, payment }
   */
  async generatePaymentUrl(salonId, amount, options = {}) {
    const startTime = Date.now();

    try {
      // Validate amount
      if (amount < this.config.validation.minAmount) {
        throw new Error(`Amount ${amount} is below minimum ${this.config.validation.minAmount}`);
      }
      if (amount > this.config.validation.maxAmount) {
        throw new Error(`Amount ${amount} exceeds maximum ${this.config.validation.maxAmount}`);
      }

      // Build receipt for 54-FZ
      const receipt = this.buildReceipt(amount, options.description || 'Подписка Admin AI', options.email);
      const receiptJson = encodeURIComponent(JSON.stringify(receipt));

      // Create payment record in DB
      const payment = await this.repository.insert({
        salon_id: salonId,
        amount: amount,
        currency: 'RUB',
        description: options.description || 'Подписка Admin AI',
        receipt_data: receipt,
        metadata: {
          email: options.email,
          created_by: 'api'
        }
      });

      // Build signature
      const signature = this.buildPaymentSignatureWithReceipt(amount, payment.invoice_id, receiptJson);

      // Build URL
      const baseUrl = this.config.settings.isTestMode
        ? this.config.apiUrls.test.payment
        : this.config.apiUrls.production.payment;

      const params = new URLSearchParams({
        MerchantLogin: this.config.merchant.login,
        OutSum: amount.toString(),
        InvId: payment.invoice_id,
        Description: options.description || 'Подписка Admin AI',
        SignatureValue: signature,
        Receipt: receiptJson,
        Culture: this.config.settings.defaultLanguage,
        Encoding: this.config.settings.encoding
      });

      // Add test mode flag
      if (this.config.settings.isTestMode) {
        params.append('IsTest', '1');
      }

      const url = `${baseUrl}?${params.toString()}`;

      const duration = Date.now() - startTime;
      if (this.config.settings.enableLogging) {
        console.log(`[Robokassa] Payment URL generated for salon ${salonId}, invoice ${payment.invoice_id} - ${duration}ms`);
      }

      return {
        url,
        invoiceId: payment.invoice_id,
        payment
      };
    } catch (error) {
      console.error('[Robokassa] generatePaymentUrl error:', error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'robokassa',
          operation: 'generatePaymentUrl'
        },
        extra: {
          salonId,
          amount,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw error;
    }
  }

  /**
   * Process successful payment with transaction support
   *
   * CRITICAL: Uses SELECT FOR UPDATE to prevent race conditions
   *
   * @param {string} invId - Invoice ID
   * @param {string} outSum - Payment amount from callback
   * @param {Object} extra - Additional data
   * @returns {Promise<Object>} Updated payment record
   */
  async processPayment(invId, outSum, extra = {}) {
    const startTime = Date.now();

    try {
      const result = await this.repository.withTransaction(async (client) => {
        // Lock the row to prevent concurrent updates
        const payment = await this.repository.findByInvoiceIdForUpdate(invId, client);

        if (!payment) {
          throw new Error(`Payment not found: ${invId}`);
        }

        // Double-check amount
        if (!this.verifyAmount(payment, outSum)) {
          throw new Error(`Amount mismatch: DB=${payment.amount}, callback=${outSum}`);
        }

        // Already processed? Return success (idempotency)
        if (payment.status === 'success') {
          return payment;
        }

        // Update status
        const updated = await this.repository.updateStatusInTransaction(
          client,
          invId,
          'success',
          {
            robokassa_operation_id: extra.operationId
          }
        );

        return updated;
      });

      const duration = Date.now() - startTime;
      if (this.config.settings.enableLogging) {
        console.log(`[Robokassa] Payment ${invId} processed successfully - ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error('[Robokassa] processPayment error:', error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'robokassa',
          operation: 'processPayment'
        },
        extra: {
          invId,
          outSum,
          duration: `${Date.now() - startTime}ms`
        }
      });
      throw error;
    }
  }

  /**
   * Process payment with timeout wrapper
   *
   * Robokassa expects response within 30 seconds.
   * We use 25s timeout to have buffer for response.
   *
   * @param {string} invId - Invoice ID
   * @param {string} outSum - Payment amount
   * @param {string} signatureValue - Signature (already verified)
   * @returns {Promise<Object>} Updated payment or throws on timeout
   */
  async processPaymentWithTimeout(invId, outSum, signatureValue) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Payment processing timeout after ${PROCESSING_TIMEOUT_MS}ms`));
      }, PROCESSING_TIMEOUT_MS);
    });

    const processPromise = this.processPayment(invId, outSum, {
      signature: signatureValue
    });

    try {
      return await Promise.race([processPromise, timeoutPromise]);
    } catch (error) {
      if (error.message.includes('timeout')) {
        Sentry.captureException(error, {
          tags: {
            component: 'robokassa',
            operation: 'processPaymentWithTimeout',
            alert_type: 'timeout'
          },
          extra: { invId, outSum }
        });
      }
      throw error;
    }
  }

  /**
   * Build 54-FZ compliant receipt
   *
   * @param {number} amount - Payment amount
   * @param {string} description - Item description
   * @param {string} email - Customer email (optional)
   * @returns {Object} Receipt object for Robokassa
   */
  buildReceipt(amount, description, email) {
    const receipt = {
      sno: this.config.fiscal.taxSystem, // usn_income
      items: [
        {
          name: description || 'Подписка Admin AI',
          quantity: 1,
          sum: amount,
          payment_method: this.config.fiscal.paymentMethod, // full_prepayment
          payment_object: this.config.fiscal.paymentObject, // service
          tax: this.config.fiscal.vat // none
        }
      ]
    };

    // Add email if provided
    if (email) {
      receipt.contact = email;
    } else if (this.config.fiscal.receipt.email) {
      receipt.contact = this.config.fiscal.receipt.email;
    }

    return receipt;
  }

  /**
   * Mark payment as failed
   *
   * @param {string} invId - Invoice ID
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} Updated payment record
   */
  async markPaymentFailed(invId, reason) {
    try {
      return await this.repository.updateStatus(invId, 'failed', {
        error_message: reason
      });
    } catch (error) {
      console.error('[Robokassa] markPaymentFailed error:', error.message);
      Sentry.captureException(error, {
        tags: {
          component: 'robokassa',
          operation: 'markPaymentFailed'
        },
        extra: { invId, reason }
      });
      throw error;
    }
  }

  /**
   * Get payment by invoice ID
   *
   * @param {string} invoiceId - Robokassa invoice ID
   * @returns {Promise<Object|null>} Payment record
   */
  async getPayment(invoiceId) {
    return this.repository.findByInvoiceId(invoiceId);
  }

  /**
   * Get payments for salon
   *
   * @param {number} salonId - YClients salon ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Payment records
   */
  async getPaymentsBySalon(salonId, options = {}) {
    return this.repository.findBySalonId(salonId, options);
  }

  /**
   * Get payment statistics for salon
   *
   * @param {number} salonId - YClients salon ID
   * @returns {Promise<Object>} Statistics
   */
  async getPaymentStats(salonId) {
    return this.repository.getStatsBySalonId(salonId);
  }

  /**
   * Check if service is properly configured
   *
   * @returns {Object} Configuration status
   */
  checkConfiguration() {
    const issues = [];

    if (!this.config.merchant.login) {
      issues.push('ROBOKASSA_MERCHANT_LOGIN is not set');
    }
    if (!this.config.merchant.passwords.password1) {
      issues.push('ROBOKASSA_PASSWORD_1 is not set');
    }
    if (!this.config.merchant.passwords.password2) {
      issues.push('ROBOKASSA_PASSWORD_2 is not set');
    }

    return {
      configured: issues.length === 0,
      testMode: this.config.settings.isTestMode,
      issues
    };
  }
}

module.exports = RobokassaService;
