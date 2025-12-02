/**
 * Admin Audit Logger
 *
 * Logs all admin actions to admin_audit_log table for security and compliance.
 * Non-blocking: audit logging failures don't affect the main operation.
 *
 * @module utils/admin-audit
 */

const logger = require('./logger');
const Sentry = require('@sentry/node');

// Sensitive field patterns to remove from request body before logging
// Uses case-insensitive regex to catch variations like PASSWORD, Api_Key, etc.
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /secret/i,
  /authorization/i,
  /bearer/i,
  /credentials?/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
  /cookie/i,
  /jwt/i,
  /auth/i
];

// Maximum recursion depth to prevent stack overflow on deeply nested objects
const MAX_SANITIZE_DEPTH = 5;

/**
 * Check if a field name matches any sensitive pattern
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is sensitive
 */
function isSensitiveField(fieldName) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Sanitize request body by removing sensitive fields
 * Handles nested objects up to MAX_SANITIZE_DEPTH levels deep
 * Handles arrays of objects
 *
 * @param {Object} body - Request body
 * @param {number} depth - Current recursion depth
 * @returns {Object} Sanitized body
 */
function sanitizeBody(body, depth = 0) {
  // Prevent infinite recursion and handle non-objects
  if (depth > MAX_SANITIZE_DEPTH || !body || typeof body !== 'object') {
    return body;
  }

  // Handle arrays
  if (Array.isArray(body)) {
    return body.map(item => sanitizeBody(item, depth + 1));
  }

  const sanitized = { ...body };

  for (const key of Object.keys(sanitized)) {
    // Check if key matches any sensitive pattern (case-insensitive)
    if (isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (sanitized[key] && typeof sanitized[key] === 'object') {
      // Recursively sanitize nested objects and arrays
      sanitized[key] = sanitizeBody(sanitized[key], depth + 1);
    }
  }

  return sanitized;
}

/**
 * Log an admin action to the audit log
 *
 * @param {Object} db - PostgreSQL connection pool
 * @param {Object} req - Express request object
 * @param {Object} options - Audit log options
 * @param {string} options.action - Action name (e.g., 'disconnect_salon', 'generate_payment_link')
 * @param {string} [options.resourceType] - Resource type (e.g., 'salon', 'company')
 * @param {string} [options.resourceId] - Resource ID (e.g., salon_id)
 * @param {number} [options.responseStatus] - HTTP response status code
 * @param {string} [options.errorMessage] - Error message if action failed
 * @returns {Promise<void>}
 *
 * @example
 * await logAdminAction(postgres, req, {
 *   action: 'disconnect_salon',
 *   resourceType: 'salon',
 *   resourceId: '997441',
 *   responseStatus: 200
 * });
 */
async function logAdminAction(db, req, options) {
  const {
    action,
    resourceType = null,
    resourceId = null,
    responseStatus = null,
    errorMessage = null
  } = options;

  try {
    // Extract admin info from request (set by auth middleware)
    const adminUser = req.adminUser || {};
    const adminId = adminUser.id || adminUser.sub || 'api_key';
    const adminRole = adminUser.role || 'unknown';
    const adminEmail = adminUser.email || null;
    const authMethod = adminUser.type || 'unknown';

    // Sanitize request body
    const sanitizedBody = sanitizeBody(req.body);

    // Truncate user agent if too long
    const userAgent = req.headers['user-agent']
      ? req.headers['user-agent'].substring(0, 500)
      : null;

    await db.query(
      `INSERT INTO admin_audit_log (
        admin_id, admin_role, admin_email, auth_method,
        action, resource_type, resource_id,
        ip_address, user_agent, request_path, request_method,
        request_body, response_status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        adminId,
        adminRole,
        adminEmail,
        authMethod,
        action,
        resourceType,
        resourceId ? String(resourceId) : null,
        req.ip || req.connection?.remoteAddress || null,
        userAgent,
        req.path,
        req.method,
        JSON.stringify(sanitizedBody),
        responseStatus,
        errorMessage
      ]
    );

    logger.debug('Admin action logged', {
      action,
      resourceType,
      resourceId,
      adminId
    });

  } catch (error) {
    // Non-blocking: don't fail the main operation if audit logging fails
    logger.error('Failed to log admin action:', {
      error: error.message,
      action,
      resourceType,
      resourceId
    });

    Sentry.captureException(error, {
      level: 'warning',
      tags: {
        component: 'admin-audit',
        action
      },
      extra: {
        resourceType,
        resourceId
      }
    });
  }
}

/**
 * Express middleware to automatically log admin actions
 *
 * @param {Object} db - PostgreSQL connection pool
 * @param {string} action - Action name
 * @param {Function} [getResourceInfo] - Function to extract resource info from req
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/admin/salon/:salonId/disconnect',
 *   adminAuth,
 *   auditMiddleware(postgres, 'disconnect_salon', (req) => ({
 *     resourceType: 'salon',
 *     resourceId: req.params.salonId
 *   })),
 *   disconnectHandler
 * );
 */
function auditMiddleware(db, action, getResourceInfo = () => ({})) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = async function(data) {
      // Log the action after response is determined
      const resourceInfo = getResourceInfo(req);
      const isError = res.statusCode >= 400;

      await logAdminAction(db, req, {
        action,
        ...resourceInfo,
        responseStatus: res.statusCode,
        errorMessage: isError ? (data?.error || data?.message || null) : null
      });

      return originalJson(data);
    };

    next();
  };
}

/**
 * Get audit logs with filtering and pagination
 *
 * @param {Object} db - PostgreSQL connection pool
 * @param {Object} filters - Query filters
 * @param {string} [filters.adminId] - Filter by admin ID
 * @param {string} [filters.action] - Filter by action
 * @param {string} [filters.resourceType] - Filter by resource type
 * @param {string} [filters.resourceId] - Filter by resource ID
 * @param {string} [filters.dateFrom] - Filter by date (ISO string)
 * @param {string} [filters.dateTo] - Filter by date (ISO string)
 * @param {number} [filters.limit=50] - Max records to return
 * @param {number} [filters.offset=0] - Offset for pagination
 * @returns {Promise<Object>} { logs: Array, total: number }
 */
async function getAuditLogs(db, filters = {}) {
  const {
    adminId,
    action,
    resourceType,
    resourceId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0
  } = filters;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (adminId) {
    conditions.push(`admin_id = $${paramIndex++}`);
    params.push(adminId);
  }

  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(action);
  }

  if (resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    params.push(resourceType);
  }

  if (resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`);
    params.push(String(resourceId));
  }

  if (dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM admin_audit_log ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // Get paginated logs
  const logsResult = await db.query(
    `SELECT * FROM admin_audit_log ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, Math.min(limit, 100), offset]
  );

  return {
    logs: logsResult.rows,
    total,
    limit: Math.min(limit, 100),
    offset
  };
}

/**
 * Delete old audit logs (retention policy)
 *
 * @param {Object} db - PostgreSQL connection pool
 * @param {number} [retentionDays=90] - Days to keep logs
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanupAuditLogs(db, retentionDays = 90) {
  // Validate input to prevent SQL injection
  const days = parseInt(retentionDays, 10);
  if (isNaN(days) || days < 1 || days > 365) {
    throw new Error('retentionDays must be a number between 1 and 365');
  }

  // Use parameterized query with interval casting
  const result = await db.query(
    `DELETE FROM admin_audit_log
     WHERE created_at < NOW() - $1::interval`,
    [`${days} days`]
  );

  const deletedCount = result.rowCount;

  logger.info(`Cleaned up ${deletedCount} old audit log records`, {
    retentionDays: days,
    deletedCount
  });

  return deletedCount;
}

module.exports = {
  logAdminAction,
  auditMiddleware,
  getAuditLogs,
  cleanupAuditLogs,
  sanitizeBody
};
