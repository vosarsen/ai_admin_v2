/**
 * Input Validation Helpers
 *
 * Provides validation functions for GlitchTip API inputs.
 *
 * @module lib/validation
 * @author Claude Code
 * @version 1.0
 */

/**
 * Validate issue ID
 *
 * @param {string|number} issueId - Issue ID to validate
 * @returns {object} { valid: boolean, sanitized: string, error: string }
 */
function validateIssueId(issueId) {
  // Check if provided
  if (!issueId) {
    return {
      valid: false,
      sanitized: null,
      error: 'Issue ID is required'
    };
  }

  // Convert to string
  const idStr = String(issueId).trim();

  // Check if empty after trim
  if (!idStr) {
    return {
      valid: false,
      sanitized: null,
      error: 'Issue ID cannot be empty'
    };
  }

  // Check if numeric (GlitchTip uses numeric IDs)
  if (!/^\d+$/.test(idStr)) {
    return {
      valid: false,
      sanitized: null,
      error: `Invalid issue ID format: "${idStr}" (must be numeric)`
    };
  }

  // Check reasonable bounds (1 to 10 million)
  const idNum = parseInt(idStr, 10);
  if (idNum < 1 || idNum > 10000000) {
    return {
      valid: false,
      sanitized: null,
      error: `Issue ID out of range: ${idNum} (must be 1-10000000)`
    };
  }

  return {
    valid: true,
    sanitized: idStr,
    error: null
  };
}

/**
 * Validate organization slug
 *
 * @param {string} orgSlug - Organization slug to validate
 * @returns {object} { valid: boolean, sanitized: string, error: string }
 */
function validateOrgSlug(orgSlug) {
  if (!orgSlug) {
    return {
      valid: false,
      sanitized: null,
      error: 'Organization slug is required'
    };
  }

  const slugStr = String(orgSlug).trim();

  // Check format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z0-9-]+$/.test(slugStr)) {
    return {
      valid: false,
      sanitized: null,
      error: `Invalid org slug format: "${slugStr}" (must be lowercase alphanumeric with hyphens)`
    };
  }

  // Check length (3-50 chars)
  if (slugStr.length < 3 || slugStr.length > 50) {
    return {
      valid: false,
      sanitized: null,
      error: `Org slug length invalid: ${slugStr.length} chars (must be 3-50)`
    };
  }

  return {
    valid: true,
    sanitized: slugStr,
    error: null
  };
}

/**
 * Validate time period (hours)
 *
 * @param {string|number} hours - Hours to validate
 * @returns {object} { valid: boolean, sanitized: number, error: string }
 */
function validateHours(hours) {
  if (!hours) {
    return {
      valid: false,
      sanitized: null,
      error: 'Hours parameter is required'
    };
  }

  const hoursNum = Number(hours);

  if (isNaN(hoursNum)) {
    return {
      valid: false,
      sanitized: null,
      error: `Invalid hours format: "${hours}" (must be numeric)`
    };
  }

  // Check reasonable bounds (1 hour to 30 days)
  if (hoursNum < 1 || hoursNum > 720) {
    return {
      valid: false,
      sanitized: null,
      error: `Hours out of range: ${hoursNum} (must be 1-720)`
    };
  }

  return {
    valid: true,
    sanitized: hoursNum,
    error: null
  };
}

/**
 * Validate and sanitize component name
 *
 * @param {string} component - Component name to validate
 * @returns {object} { valid: boolean, sanitized: string, error: string }
 */
function validateComponent(component) {
  if (!component) {
    // Component is optional
    return {
      valid: true,
      sanitized: null,
      error: null
    };
  }

  const compStr = String(component).trim();

  // Allow alphanumeric, hyphens, underscores, dots
  if (!/^[a-zA-Z0-9-_.]+$/.test(compStr)) {
    return {
      valid: false,
      sanitized: null,
      error: `Invalid component format: "${compStr}" (alphanumeric, hyphens, underscores, dots only)`
    };
  }

  // Check length (1-50 chars)
  if (compStr.length > 50) {
    return {
      valid: false,
      sanitized: null,
      error: `Component name too long: ${compStr.length} chars (max 50)`
    };
  }

  return {
    valid: true,
    sanitized: compStr.toLowerCase(), // Normalize to lowercase
    error: null
  };
}

/**
 * Validate webhook payload
 *
 * @param {object} payload - Webhook payload to validate
 * @returns {object} { valid: boolean, error: string }
 */
function validateWebhookPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      valid: false,
      error: 'Payload must be an object'
    };
  }

  if (!payload.action) {
    return {
      valid: false,
      error: 'Missing required field: action'
    };
  }

  if (!payload.data || typeof payload.data !== 'object') {
    return {
      valid: false,
      error: 'Missing or invalid field: data'
    };
  }

  if (!payload.data.issue || typeof payload.data.issue !== 'object') {
    return {
      valid: false,
      error: 'Missing or invalid field: data.issue'
    };
  }

  const issue = payload.data.issue;

  if (!issue.id) {
    return {
      valid: false,
      error: 'Missing required field: data.issue.id'
    };
  }

  if (!issue.title) {
    return {
      valid: false,
      error: 'Missing required field: data.issue.title'
    };
  }

  return {
    valid: true,
    error: null
  };
}

module.exports = {
  validateIssueId,
  validateOrgSlug,
  validateHours,
  validateComponent,
  validateWebhookPayload
};
