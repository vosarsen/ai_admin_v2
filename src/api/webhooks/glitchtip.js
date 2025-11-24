/**
 * GlitchTip Webhook Handler
 *
 * Handles webhooks from GlitchTip for real-time error notifications.
 * Sends rich Telegram alerts with full context for new and regression errors.
 *
 * Supported events:
 * - issue.new: New error detected
 * - issue.regression: Previously resolved error has reappeared
 *
 * @module webhooks/glitchtip
 * @author Claude Code
 * @version 1.0
 * @date 2025-11-24
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const axios = require('axios');
const Sentry = require('@sentry/node');
const crypto = require('crypto');
const rateLimiter = require('../../middlewares/rate-limiter');
const { validateWebhookPayload } = require('../../../scripts/lib/validation');

// ============================================================================
// Configuration
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '601999';
const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'http://localhost:8080';
const WEBHOOK_SECRET = process.env.GLITCHTIP_WEBHOOK_SECRET; // Optional HMAC secret

// GlitchTip issue severity emojis
const SEVERITY_EMOJI = {
  fatal: '🔴',
  error: '🔴',
  warning: '🟡',
  info: '🟢',
  debug: '⚪'
};

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Verify webhook HMAC signature
 *
 * @param {object} req - Express request object
 * @returns {boolean} true if signature is valid or verification is disabled
 */
function verifySignature(req) {
  // If no secret configured, skip verification (development mode)
  if (!WEBHOOK_SECRET) {
    logger.debug('Webhook signature verification disabled (no secret configured)');
    return true;
  }

  const signature = req.headers['x-glitchtip-signature'] || req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Missing webhook signature header');
    return false;
  }

  try {
    // Create HMAC with sha256
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(JSON.stringify(req.body));
    const calculated = 'sha256=' + hmac.digest('hex');

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculated)
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

// ============================================================================
// Webhook Endpoint
// ============================================================================

/**
 * POST /api/webhooks/glitchtip
 *
 * Receives webhooks from GlitchTip and sends Telegram alerts.
 * Rate limited to 100 requests per 15 minutes.
 */
router.post('/',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }),
  async (req, res) => {
  const startTime = Date.now();

  try {
    const payload = req.body;

    logger.info('📥 GlitchTip webhook received', {
      event: payload.action || 'unknown',
      issueId: payload.data?.issue?.id,
      title: payload.data?.issue?.title?.substring(0, 50)
    });

    // Verify HMAC signature
    if (!verifySignature(req)) {
      logger.warn('⚠️ Invalid webhook signature - possible unauthorized request');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Validate payload structure
    const validation = validateWebhookPayload(payload);
    if (!validation.valid) {
      logger.warn('⚠️ Invalid GlitchTip webhook payload', { error: validation.error });
      return res.status(400).json({ error: validation.error });
    }

    const event = payload.action || 'unknown';
    const issue = payload.data.issue;

    // Handle supported events
    if (event === 'created' || event === 'issue.new') {
      await handleNewIssue(issue);
    } else if (event === 'reopened' || event === 'issue.regression') {
      await handleRegressionIssue(issue);
    } else {
      logger.debug(`Ignoring event: ${event}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ GlitchTip webhook processed in ${duration}ms`);

    return res.status(200).json({ status: 'ok', duration });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('❌ Error processing GlitchTip webhook:', error);

    Sentry.captureException(error, {
      tags: {
        component: 'glitchtip-webhook',
        operation: 'webhook_processing'
      },
      extra: {
        payload: req.body,
        duration
      }
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle new issue event
 */
async function handleNewIssue(issue) {
  logger.info('🆕 New issue detected', {
    id: issue.id,
    title: issue.title,
    level: issue.level
  });

  const message = formatNewIssueMessage(issue);
  await sendTelegramAlert(message);
}

/**
 * Handle regression issue event
 */
async function handleRegressionIssue(issue) {
  logger.warn('🔄 Issue regression detected', {
    id: issue.id,
    title: issue.title,
    level: issue.level
  });

  const message = formatRegressionMessage(issue);
  await sendTelegramAlert(message);
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Format new issue message for Telegram
 */
function formatNewIssueMessage(issue) {
  const emoji = SEVERITY_EMOJI[issue.level] || '⚪';
  const issueUrl = `${GLITCHTIP_URL}/organizations/admin-ai/issues/${issue.id}/`;

  // Extract stack trace (first 500 chars)
  const culprit = issue.culprit || 'Unknown';
  const stackTrace = extractStackTrace(issue);

  // Extract tags
  const tags = formatTags(issue.tags);

  return `${emoji} **НОВАЯ ОШИБКА**

**${escapeMarkdown(issue.title)}**

• **ID:** \`${issue.id}\`
• **Уровень:** ${issue.level}
• **Компонент:** ${tags.component || 'unknown'}
• **Счётчик:** ${issue.count || 1}
• **Первое:** ${formatDate(issue.firstSeen)}
• **Последнее:** ${formatDate(issue.lastSeen)}

**Стек трейс:**
\`\`\`
${stackTrace}
\`\`\`

**Теги:** ${tags.formatted}

🔗 [Открыть в GlitchTip](${issueUrl})

**Команды:**
• \`/investigate ${issue.id}\` - запустить расследование
• \`/resolve ${issue.id}\` - закрыть ошибку`;
}

/**
 * Format regression message for Telegram
 */
function formatRegressionMessage(issue) {
  const emoji = '🔄';
  const issueUrl = `${GLITCHTIP_URL}/organizations/admin-ai/issues/${issue.id}/`;

  const culprit = issue.culprit || 'Unknown';
  const stackTrace = extractStackTrace(issue);
  const tags = formatTags(issue.tags);

  return `${emoji} **РЕГРЕССИЯ: ОШИБКА ВЕРНУЛАСЬ**

**${escapeMarkdown(issue.title)}**

⚠️ *Эта ошибка была ранее исправлена, но появилась снова!*

• **ID:** \`${issue.id}\`
• **Уровень:** ${issue.level}
• **Компонент:** ${tags.component || 'unknown'}
• **Счётчик:** ${issue.count || 1}
• **Первое:** ${formatDate(issue.firstSeen)}
• **Последнее:** ${formatDate(issue.lastSeen)}

**Стек трейс:**
\`\`\`
${stackTrace}
\`\`\`

**Теги:** ${tags.formatted}

🔗 [Открыть в GlitchTip](${issueUrl})

**Команды:**
• \`/investigate ${issue.id}\` - запустить расследование
• \`/resolve ${issue.id}\` - закрыть ошибку

💡 **Совет:** Проверьте, что исправление было применено корректно.`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract stack trace from issue
 */
function extractStackTrace(issue) {
  // Try multiple sources for stack trace
  let stackTrace = '';

  if (issue.metadata && issue.metadata.value) {
    stackTrace = issue.metadata.value;
  } else if (issue.culprit) {
    stackTrace = issue.culprit;
  } else if (issue.message) {
    stackTrace = issue.message;
  }

  // Limit to 500 chars
  if (stackTrace.length > 500) {
    stackTrace = stackTrace.substring(0, 500) + '...';
  }

  return stackTrace || 'No stack trace available';
}

/**
 * Format tags for display
 */
function formatTags(tags) {
  if (!tags || typeof tags !== 'object') {
    return { formatted: 'none', component: 'unknown' };
  }

  const component = tags.component || tags.service || 'unknown';
  const tagPairs = Object.entries(tags)
    .filter(([key]) => !['issue.id', 'event.id'].includes(key))
    .map(([key, value]) => `${key}:${value}`)
    .slice(0, 5) // Max 5 tags
    .join(', ');

  return {
    formatted: tagPairs || 'none',
    component
  };
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
  if (!dateString) return 'unknown';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Escape Markdown special characters
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Send alert to Telegram
 */
async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping alert');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }, {
      timeout: 10000
    });

    logger.info('✅ Telegram alert sent');

  } catch (error) {
    logger.error('❌ Failed to send Telegram alert:', error.message);

    Sentry.captureException(error, {
      tags: {
        component: 'glitchtip-webhook',
        operation: 'send_telegram'
      },
      extra: {
        message: message.substring(0, 200)
      }
    });
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/webhooks/glitchtip/health
 *
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const healthy = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    config: {
      telegramConfigured: !!TELEGRAM_BOT_TOKEN,
      chatIdConfigured: !!TELEGRAM_CHAT_ID,
      glitchtipUrl: GLITCHTIP_URL
    }
  });
});

module.exports = router;
