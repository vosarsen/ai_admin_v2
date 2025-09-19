/**
 * WhatsApp Multi-Tenant Validator
 * Validates inputs for WhatsApp operations with multi-tenant support
 */

const whatsappConfig = require('../config/whatsapp');
const { ValidationError } = require('./whatsapp-errors');

class WhatsAppValidator {
  /**
   * Validate company ID for multi-tenant system
   */
  static validateCompanyId(companyId, required = true) {
    // If not required and not provided, it's valid
    if (!required && !companyId) {
      return { valid: true };
    }

    // If required but not provided
    if (required && !companyId) {
      return {
        valid: false,
        error: 'Company ID is required for multi-tenant operation',
      };
    }

    // Check type
    if (typeof companyId !== 'string' && typeof companyId !== 'number') {
      return {
        valid: false,
        error: `Company ID must be a string or number, got ${typeof companyId}`,
      };
    }

    // Convert to string for validation
    const companyIdStr = String(companyId);

    // Check pattern if validation enabled
    if (whatsappConfig.multiTenant.validateCompanyId) {
      const pattern = new RegExp(whatsappConfig.multiTenant.companyIdPattern);
      if (!pattern.test(companyIdStr)) {
        return {
          valid: false,
          error: `Company ID "${companyIdStr}" does not match required pattern ${whatsappConfig.multiTenant.companyIdPattern}`,
        };
      }
    }

    // Check length
    if (companyIdStr.length < 1 || companyIdStr.length > 100) {
      return {
        valid: false,
        error: `Company ID length must be between 1 and 100 characters`,
      };
    }

    return { valid: true, companyId: companyIdStr };
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phone, required = true) {
    // If not required and not provided, it's valid
    if (!required && !phone) {
      return { valid: true };
    }

    // If required but not provided
    if (required && !phone) {
      return {
        valid: false,
        error: 'Phone number is required',
      };
    }

    // Check type
    if (typeof phone !== 'string' && typeof phone !== 'number') {
      return {
        valid: false,
        error: `Phone number must be a string or number, got ${typeof phone}`,
      };
    }

    // Clean and format phone
    let cleanPhone = String(phone).replace(/\D/g, '');

    // Check if empty after cleaning
    if (cleanPhone.length === 0) {
      return {
        valid: false,
        error: 'Phone number contains no digits',
      };
    }

    // Add country code if missing (assuming Russia)
    if (!cleanPhone.startsWith('7') && cleanPhone.length === 10) {
      cleanPhone = '7' + cleanPhone;
    }

    // Validate pattern
    const pattern = new RegExp(whatsappConfig.security.allowedPhonePattern);
    if (!pattern.test(cleanPhone)) {
      return {
        valid: false,
        error: `Phone number "${phone}" does not match allowed pattern`,
      };
    }

    // Check blocked numbers
    if (whatsappConfig.security.blockedNumbers.includes(cleanPhone)) {
      return {
        valid: false,
        error: `Phone number "${phone}" is blocked`,
      };
    }

    // Check length
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return {
        valid: false,
        error: 'Phone number must be between 10 and 15 digits',
      };
    }

    return { valid: true, phone: cleanPhone };
  }

  /**
   * Validate message content
   */
  static validateMessage(message, options = {}) {
    const {
      maxLength = 4096,
      allowEmpty = false,
      allowMedia = true,
    } = options;

    // Check if provided
    if (!message && !allowEmpty) {
      return {
        valid: false,
        error: 'Message is required',
      };
    }

    // Check type
    if (message && typeof message !== 'string') {
      return {
        valid: false,
        error: `Message must be a string, got ${typeof message}`,
      };
    }

    // Check length
    if (message && message.length > maxLength) {
      return {
        valid: false,
        error: `Message exceeds maximum length of ${maxLength} characters`,
      };
    }

    // Check for suspicious content (basic check)
    if (message) {
      const suspiciousPatterns = [
        /\x00/, // null bytes
        /<script/i, // script tags
        /javascript:/i, // javascript protocol
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(message)) {
          return {
            valid: false,
            error: 'Message contains suspicious content',
          };
        }
      }
    }

    return { valid: true, message: message || '' };
  }

  /**
   * Validate media URL
   */
  static validateMediaUrl(url, options = {}) {
    const {
      allowLocal = true,
      allowRemote = true,
      allowedExtensions = null,
      maxSizeMB = 16,
    } = options;

    // Check if provided
    if (!url) {
      return {
        valid: false,
        error: 'Media URL is required',
      };
    }

    // Check type
    if (typeof url !== 'string') {
      return {
        valid: false,
        error: `Media URL must be a string, got ${typeof url}`,
      };
    }

    // Check if it's a local path or URL
    const isLocal = !url.startsWith('http://') && !url.startsWith('https://');

    if (isLocal && !allowLocal) {
      return {
        valid: false,
        error: 'Local file paths are not allowed',
      };
    }

    if (!isLocal && !allowRemote) {
      return {
        valid: false,
        error: 'Remote URLs are not allowed',
      };
    }

    // Validate URL format for remote
    if (!isLocal) {
      try {
        const urlObj = new URL(url);

        // Check protocol
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return {
            valid: false,
            error: 'Only HTTP and HTTPS protocols are allowed',
          };
        }

        // Check for localhost/internal IPs (security)
        const hostname = urlObj.hostname.toLowerCase();
        const internalPatterns = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '::1',
          /^10\./,
          /^192\.168\./,
          /^172\.(1[6-9]|2[0-9]|3[01])\./,
        ];

        for (const pattern of internalPatterns) {
          if (typeof pattern === 'string' && hostname === pattern) {
            return {
              valid: false,
              error: 'Internal URLs are not allowed',
            };
          }
          if (pattern instanceof RegExp && pattern.test(hostname)) {
            return {
              valid: false,
              error: 'Internal URLs are not allowed',
            };
          }
        }
      } catch (error) {
        return {
          valid: false,
          error: 'Invalid URL format',
        };
      }
    }

    // Check file extension if specified
    if (allowedExtensions && allowedExtensions.length > 0) {
      const extension = url.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `File extension .${extension} is not allowed. Allowed: ${allowedExtensions.join(', ')}`,
        };
      }
    }

    return { valid: true, url };
  }

  /**
   * Validate media type
   */
  static validateMediaType(type) {
    const allowedTypes = ['image', 'video', 'audio', 'document', 'sticker'];

    if (!type) {
      return {
        valid: false,
        error: 'Media type is required',
      };
    }

    if (!allowedTypes.includes(type)) {
      return {
        valid: false,
        error: `Invalid media type "${type}". Allowed: ${allowedTypes.join(', ')}`,
      };
    }

    return { valid: true, type };
  }

  /**
   * Validate session configuration
   */
  static validateSessionConfig(config) {
    const errors = [];

    // Check use pairing code
    if (config.usePairingCode !== undefined &&
        typeof config.usePairingCode !== 'boolean') {
      errors.push('usePairingCode must be a boolean');
    }

    // If pairing code is enabled, phone number is required
    if (config.usePairingCode === true) {
      if (!config.phoneNumber) {
        errors.push('phoneNumber is required when usePairingCode is true');
      } else {
        const phoneValidation = this.validatePhoneNumber(config.phoneNumber);
        if (!phoneValidation.valid) {
          errors.push(`phoneNumber: ${phoneValidation.error}`);
        }
      }
    }

    // Check reconnect settings
    if (config.maxReconnectAttempts !== undefined) {
      const attempts = parseInt(config.maxReconnectAttempts);
      if (isNaN(attempts) || attempts < 0 || attempts > 100) {
        errors.push('maxReconnectAttempts must be between 0 and 100');
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
      };
    }

    return { valid: true, config };
  }

  /**
   * Validate rate limit
   */
  static checkRateLimit(companyId, rateLimiter) {
    // This would integrate with an actual rate limiting system
    // For now, return a simple check based on config
    const limit = whatsappConfig.multiTenant.rateLimitPerCompany;
    const window = whatsappConfig.multiTenant.rateLimitWindow;

    // Placeholder - would use Redis or similar for actual implementation
    return {
      allowed: true,
      remaining: limit,
      resetIn: window,
    };
  }

  /**
   * Validate multi-tenant request
   */
  static validateMultiTenantRequest(request) {
    const errors = [];

    // Check if multi-tenant is enabled
    if (!whatsappConfig.multiTenant.enabled) {
      // Single tenant mode - company ID is optional
      if (!request.companyId && !whatsappConfig.defaults.singleTenantCompanyId) {
        errors.push('Company ID is required or DEFAULT_COMPANY_ID must be set');
      }
    } else {
      // Multi-tenant mode - company ID is required
      const companyValidation = this.validateCompanyId(request.companyId, true);
      if (!companyValidation.valid) {
        errors.push(companyValidation.error);
      }
    }

    // Validate phone if provided
    if (request.phone) {
      const phoneValidation = this.validatePhoneNumber(request.phone, false);
      if (!phoneValidation.valid) {
        errors.push(phoneValidation.error);
      }
    }

    // Validate message if provided
    if (request.message) {
      const messageValidation = this.validateMessage(request.message);
      if (!messageValidation.valid) {
        errors.push(messageValidation.error);
      }
    }

    // Check max sessions limit
    if (request.action === 'initialize' && request.sessionCount !== undefined) {
      if (request.sessionCount >= whatsappConfig.multiTenant.maxSessions) {
        errors.push(`Maximum session limit (${whatsappConfig.multiTenant.maxSessions}) reached`);
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize input for security
   */
  static sanitize(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove null bytes
    let sanitized = input.replace(/\x00/g, '');

    // Remove control characters except newline and tab
    sanitized = sanitized.replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Create validation middleware
   */
  static middleware(options = {}) {
    return (req, res, next) => {
      try {
        // Extract company ID from various sources
        const companyId = req.body.companyId ||
                         req.params.companyId ||
                         req.query.companyId ||
                         req.headers['x-company-id'];

        // Validate multi-tenant request
        const validation = this.validateMultiTenantRequest({
          companyId,
          phone: req.body.phone,
          message: req.body.message,
          action: req.method === 'POST' && req.path.includes('initialize') ? 'initialize' : 'message',
        });

        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            errors: validation.errors,
          });
        }

        // Attach validated values to request
        req.validated = {
          companyId,
          phone: req.body.phone ? this.sanitize(req.body.phone) : undefined,
          message: req.body.message ? this.sanitize(req.body.message) : undefined,
        };

        next();
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Validation error occurred',
        });
      }
    };
  }
}

module.exports = WhatsAppValidator;