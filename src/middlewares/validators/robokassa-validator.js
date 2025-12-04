/**
 * Robokassa Payment Validation Middleware
 *
 * Validates input for Robokassa payment endpoints.
 * Uses simple validation without external dependencies.
 *
 * @module middlewares/validators/robokassa-validator
 */

const robokassaConfig = require('../../config/robokassa-config');

/**
 * Validation error response helper
 */
function validationError(res, field, message) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: { field, message }
  });
}

/**
 * Validate create payment request
 *
 * Required fields:
 * - salon_id: positive integer
 * - amount: positive number within config limits
 *
 * Optional fields:
 * - description: string, max 500 chars
 * - email: valid email format
 */
function validateCreatePayment(req, res, next) {
  const { salon_id, amount, description, email } = req.body;

  // salon_id: required, positive integer
  if (salon_id === undefined || salon_id === null) {
    return validationError(res, 'salon_id', 'salon_id is required');
  }
  const salonIdNum = parseInt(salon_id, 10);
  if (isNaN(salonIdNum) || salonIdNum <= 0) {
    return validationError(res, 'salon_id', 'salon_id must be a positive integer');
  }

  // amount: required, positive number within limits
  if (amount === undefined || amount === null) {
    return validationError(res, 'amount', 'amount is required');
  }
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return validationError(res, 'amount', 'amount must be a positive number');
  }
  if (amountNum < robokassaConfig.validation.minAmount) {
    return validationError(res, 'amount', `amount must be at least ${robokassaConfig.validation.minAmount} RUB`);
  }
  if (amountNum > robokassaConfig.validation.maxAmount) {
    return validationError(res, 'amount', `amount cannot exceed ${robokassaConfig.validation.maxAmount} RUB`);
  }

  // description: optional, max 500 chars, sanitize
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return validationError(res, 'description', 'description must be a string');
    }
    if (description.length > 500) {
      return validationError(res, 'description', 'description cannot exceed 500 characters');
    }
    // Sanitize: remove potential XSS characters
    req.body.description = description
      .replace(/[<>]/g, '')
      .trim();
  }

  // email: optional, valid format
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string') {
      return validationError(res, 'email', 'email must be a string');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return validationError(res, 'email', 'invalid email format');
    }
    if (email.length > 255) {
      return validationError(res, 'email', 'email cannot exceed 255 characters');
    }
  }

  // Normalize values for downstream use
  req.body.salon_id = salonIdNum;
  req.body.amount = amountNum;

  next();
}

/**
 * Validate invoice ID parameter
 *
 * Invoice ID must be:
 * - Non-empty string
 * - Numeric only (digits)
 * - 16-19 characters long
 */
function validateInvoiceId(req, res, next) {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    return validationError(res, 'invoiceId', 'invoiceId is required');
  }

  if (typeof invoiceId !== 'string') {
    return validationError(res, 'invoiceId', 'invoiceId must be a string');
  }

  // Must be numeric only
  if (!/^\d+$/.test(invoiceId)) {
    return validationError(res, 'invoiceId', 'invoiceId must contain only digits');
  }

  // Length check (timestamp 13 + random 3-6 = 16-19)
  if (invoiceId.length < 16 || invoiceId.length > 19) {
    return validationError(res, 'invoiceId', 'invalid invoiceId format');
  }

  next();
}

/**
 * Validate salon ID parameter
 */
function validateSalonId(req, res, next) {
  const { salonId } = req.params;

  if (!salonId) {
    return validationError(res, 'salonId', 'salonId is required');
  }

  const salonIdNum = parseInt(salonId, 10);
  if (isNaN(salonIdNum) || salonIdNum <= 0) {
    return validationError(res, 'salonId', 'salonId must be a positive integer');
  }

  // Normalize
  req.params.salonId = salonIdNum;

  next();
}

/**
 * Validate history query parameters
 */
function validateHistoryQuery(req, res, next) {
  const { status, limit, offset } = req.query;

  // status: optional, must be valid
  const validStatuses = ['pending', 'success', 'failed', 'cancelled'];
  if (status !== undefined && status !== '') {
    if (!validStatuses.includes(status)) {
      return validationError(res, 'status', `status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  // limit: optional, positive integer, max 100
  if (limit !== undefined && limit !== '') {
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      return validationError(res, 'limit', 'limit must be a positive integer');
    }
    if (limitNum > 100) {
      return validationError(res, 'limit', 'limit cannot exceed 100');
    }
    req.query.limit = limitNum;
  }

  // offset: optional, non-negative integer
  if (offset !== undefined && offset !== '') {
    const offsetNum = parseInt(offset, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return validationError(res, 'offset', 'offset must be a non-negative integer');
    }
    req.query.offset = offsetNum;
  }

  next();
}

/**
 * Validate webhook result callback
 *
 * Required fields from Robokassa:
 * - OutSum: payment amount
 * - InvId: invoice ID
 * - SignatureValue: MD5 signature
 */
function validateWebhookResult(req, res, next) {
  const data = req.method === 'POST' ? req.body : req.query;
  const { OutSum, InvId, SignatureValue } = data;

  // OutSum: required
  if (!OutSum) {
    console.warn('[Robokassa Validator] Missing OutSum in webhook');
    return res.status(400).send('bad sign');
  }

  // InvId: required
  if (!InvId) {
    console.warn('[Robokassa Validator] Missing InvId in webhook');
    return res.status(400).send('bad sign');
  }

  // SignatureValue: required
  if (!SignatureValue) {
    console.warn('[Robokassa Validator] Missing SignatureValue in webhook');
    return res.status(400).send('bad sign');
  }

  next();
}

module.exports = {
  validateCreatePayment,
  validateInvoiceId,
  validateSalonId,
  validateHistoryQuery,
  validateWebhookResult
};
