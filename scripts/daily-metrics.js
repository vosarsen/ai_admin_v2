#!/usr/bin/env node
/**
 * GlitchTip Daily Metrics Report
 *
 * Aggregates error metrics from GlitchTip and sends daily report via Telegram
 * - Queries issues from last 24 hours
 * - Groups by component/service
 * - Identifies top issues
 * - Compares trends with yesterday
 * - Sends formatted report to Telegram
 *
 * Usage:
 *   export GLITCHTIP_TOKEN=your-token
 *   export TELEGRAM_BOT_TOKEN=your-bot-token
 *   export TELEGRAM_CHAT_ID=your-chat-id
 *   node scripts/daily-metrics.js
 *
 * Scheduling:
 *   PM2 cron: "0 9 * * *" (9 AM daily)
 */

const GlitchTipAPI = require('./lib/glitchtip-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_TOKEN;
const ORG_SLUG = process.env.GLITCHTIP_ORG_SLUG || 'admin-ai';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CACHE_FILE = path.join(__dirname, '.daily-metrics-cache.json');

// Emoji indicators by severity
const EMOJI = {
  error: '🔴',
  warning: '🟡',
  info: '🟢',
  fatal: '💀',
  debug: '🔵'
};

/**
 * Load previous day's metrics for trend comparison
 */
function loadPreviousMetrics() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load previous metrics:', error.message);
  }
  return null;
}

/**
 * Save today's metrics for tomorrow's comparison
 */
function saveMetrics(metrics) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('Failed to save metrics:', error.message);
  }
}

/**
 * Query GlitchTip for issues in last 24 hours
 */
async function fetchDailyMetrics(client) {
  console.log('Fetching issues from last 24 hours...');

  // Get all unresolved issues (GlitchTip doesn't support age filter)
  const issues = await client.getIssues(ORG_SLUG, {
    query: 'is:unresolved',
    limit: 100
  });

  // Filter to last 24 hours manually
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentIssues = issues.filter(issue => {
    const lastSeen = new Date(issue.lastSeen);
    return lastSeen >= oneDayAgo;
  });

  console.log(`Found ${recentIssues.length} issues in last 24h (out of ${issues.length} total unresolved)`);

  return recentIssues;
}

/**
 * Group issues by component tag
 */
function groupByComponent(issues) {
  const groups = {};

  for (const issue of issues) {
    // Extract component from tags (e.g., {component: 'whatsapp'})
    const component = issue.tags?.find(t => t.key === 'component')?.value || 'unknown';

    if (!groups[component]) {
      groups[component] = [];
    }
    groups[component].push(issue);
  }

  return groups;
}

/**
 * Get top N issues by event count
 */
function getTopIssues(issues, n = 5) {
  return issues
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, n);
}

/**
 * Calculate trends vs yesterday
 */
function calculateTrends(currentMetrics, previousMetrics) {
  if (!previousMetrics) {
    return { newErrors: currentMetrics.total, trend: 'N/A' };
  }

  const diff = currentMetrics.total - previousMetrics.total;
  const percentChange = previousMetrics.total > 0
    ? ((diff / previousMetrics.total) * 100).toFixed(1)
    : 'N/A';

  const trend = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';

  return {
    newErrors: diff,
    percentChange,
    trend
  };
}

/**
 * Format report as rich Telegram markdown
 */
function formatTelegramReport(metrics, trends) {
  const { total, byComponent, topIssues } = metrics;

  let report = `*🔍 GlitchTip Daily Report*\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Summary
  report += `*📊 Summary (Last 24h)*\n`;
  report += `• Total errors: *${total}* ${trends.trend}\n`;

  if (trends.percentChange !== 'N/A') {
    const changeText = trends.newErrors > 0 ? `+${trends.newErrors}` : trends.newErrors;
    report += `• Change: ${changeText} (${trends.percentChange > 0 ? '+' : ''}${trends.percentChange}%)\n`;
  }
  report += `\n`;

  // By component
  if (Object.keys(byComponent).length > 0) {
    report += `*🏷️ By Component:*\n`;

    const sortedComponents = Object.entries(byComponent)
      .sort(([, a], [, b]) => b.length - a.length);

    for (const [component, issues] of sortedComponents) {
      const errorCount = issues.reduce((sum, i) => sum + (parseInt(i.count) || 0), 0);
      report += `• ${component}: ${issues.length} issues (${errorCount} events)\n`;
    }
    report += `\n`;
  }

  // Top issues
  if (topIssues.length > 0) {
    report += `*🔥 Top Issues:*\n`;

    for (let i = 0; i < topIssues.length && i < 5; i++) {
      const issue = topIssues[i];
      const emoji = EMOJI[issue.level] || '⚠️';
      const title = issue.title.length > 50
        ? issue.title.substring(0, 47) + '...'
        : issue.title;

      report += `${i + 1}. ${emoji} ${title}\n`;
      report += `   Count: ${issue.count} | Level: ${issue.level}\n`;

      // Add GlitchTip link (replace localhost with tunnel port for remote access)
      const issueUrl = `${GLITCHTIP_URL}/issues/${issue.id}`;
      report += `   [View in GlitchTip](${issueUrl})\n`;
      report += `\n`;
    }
  }

  // Footer
  report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `_Generated: ${new Date().toISOString().split('T')[0]}_\n`;
  report += `_Organization: ${ORG_SLUG}_`;

  return report;
}

/**
 * Send message to Telegram
 */
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Telegram not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
    console.log('\nReport preview:\n' + message);
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    }, {
      timeout: 10000
    });

    if (response.data.ok) {
      console.log('✅ Report sent to Telegram');
      return true;
    } else {
      console.error('❌ Telegram API error:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send Telegram message:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 GlitchTip Daily Metrics Report\n');

  // Validate environment
  if (!API_TOKEN) {
    console.error('❌ GLITCHTIP_TOKEN not set');
    console.error('Export token: export GLITCHTIP_TOKEN=your-token');
    process.exit(1);
  }

  try {
    // Initialize API client
    const client = new GlitchTipAPI(GLITCHTIP_URL, API_TOKEN);

    // Fetch today's metrics
    const issues = await fetchDailyMetrics(client);
    const byComponent = groupByComponent(issues);
    const topIssues = getTopIssues(issues);

    const currentMetrics = {
      date: new Date().toISOString().split('T')[0],
      total: issues.length,
      byComponent: Object.fromEntries(
        Object.entries(byComponent).map(([k, v]) => [k, v.length])
      ),
      topIssues: topIssues.map(i => ({ id: i.id, title: i.title, count: i.count }))
    };

    // Load previous metrics for comparison
    const previousMetrics = loadPreviousMetrics();

    // Calculate trends
    const trends = calculateTrends(currentMetrics, previousMetrics);

    // Format report
    const report = formatTelegramReport(
      { total: issues.length, byComponent, topIssues },
      trends
    );

    // Send to Telegram
    await sendTelegram(report);

    // Save current metrics for tomorrow
    saveMetrics(currentMetrics);

    console.log('\n✅ Daily metrics report complete');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed to generate report:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// CLI Entry Point
if (require.main === module) {
  main();
}

module.exports = { main, formatTelegramReport, groupByComponent };
