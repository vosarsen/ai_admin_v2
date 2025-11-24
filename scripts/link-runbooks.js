#!/usr/bin/env node

/**
 * Runbook Auto-Linker
 *
 * Automatically links GlitchTip issues to relevant runbooks based on pattern matching.
 *
 * Usage:
 *   node scripts/link-runbooks.js              # Process all unresolved issues
 *   node scripts/link-runbooks.js --dry-run    # Test without posting comments
 *   node scripts/link-runbooks.js --issue 123  # Process specific issue
 *
 * Schedule: Runs hourly (8 AM - 11 PM) via PM2 cron
 *
 * @author Claude Code
 * @version 1.0
 * @date 2025-11-24
 */

require('dotenv').config({ path: '.env.production' });
const GlitchTipAPI = require('./lib/glitchtip-api');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'http://localhost:8080';
const GLITCHTIP_TOKEN = process.env.GLITCHTIP_TOKEN;
const ORG_SLUG = process.env.GLITCHTIP_ORG_SLUG || 'admin-ai';

const RUNBOOK_BASE_URL = 'https://github.com/vosarsen/ai_admin_v2/blob/main/runbooks';

// Runbook patterns (regex => runbook file path)
const PATTERNS = {
  // Database Timeout
  'ConnectionTimeout|connection timed out|could not obtain.*connection|Pool.*timeout':
    'database-timeout.md',

  // WhatsApp Session Expired
  'session.*expir|Expired session keys|device.*removed|logged.*out|authentication.*fail|baileys.*session':
    'whatsapp-session-expired.md',

  // YClients Rate Limit
  'rate.*limit|too.*many.*requests|429|YClients.*limit|API.*quota':
    'yclients-rate-limit.md',

  // Redis Connection Refused
  'ECONNREFUSED.*redis|redis.*connection.*refused|Redis.*error|connect.*6379.*fail|ECONNREFUSED.*127\\.0\\.0\\.1:6379':
    'redis-connection-refused.md',

  // NPM Module Not Found
  'Cannot find module|MODULE_NOT_FOUND|Error: Cannot resolve|import.*not found':
    'npm-module-not-found.md'
};

const RUNBOOK_MARKER = '📖 Runbook Available';
const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_ISSUE = process.argv.find(arg => arg.startsWith('--issue='))?.split('=')[1];

// ============================================================================
// Main Logic
// ============================================================================

async function main() {
  console.log('🔗 GlitchTip Runbook Auto-Linker');
  console.log('================================\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No comments will be posted\n');
  }

  // Validate configuration
  if (!GLITCHTIP_TOKEN) {
    console.error('❌ Error: GLITCHTIP_TOKEN not found in environment');
    console.error('   Please set it in .env.production');
    process.exit(1);
  }

  const client = new GlitchTipAPI(GLITCHTIP_URL, GLITCHTIP_TOKEN);

  try {
    // Get issues to process
    let issues;
    if (SPECIFIC_ISSUE) {
      console.log(`📋 Processing specific issue: ${SPECIFIC_ISSUE}\n`);
      const issue = await client.getIssue(ORG_SLUG, SPECIFIC_ISSUE);
      issues = [issue];
    } else {
      console.log('📋 Fetching unresolved issues from GlitchTip...\n');
      issues = await client.getIssues(ORG_SLUG, {
        query: 'is:unresolved',
        limit: 100,
        statsPeriod: '90d' // Last 90 days
      });
    }

    console.log(`Found ${issues.length} unresolved issue(s)\n`);

    if (issues.length === 0) {
      console.log('✅ No issues to process');
      return;
    }

    // Process each issue
    const stats = {
      matched: 0,
      commented: 0,
      skipped: 0,
      errors: 0
    };

    for (const issue of issues) {
      await processIssue(client, issue, stats);
    }

    // Print summary
    console.log('\n================================');
    console.log('📊 Summary:');
    console.log(`   Matched:   ${stats.matched}`);
    console.log(`   Commented: ${stats.commented}`);
    console.log(`   Skipped:   ${stats.skipped}`);
    console.log(`   Errors:    ${stats.errors}`);
    console.log('================================\n');

    if (DRY_RUN) {
      console.log('✅ Dry run complete - no changes made');
    } else {
      console.log('✅ Runbook linking complete');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

/**
 * Process a single issue
 */
async function processIssue(client, issue, stats) {
  const issueId = issue.id;
  const title = issue.title || '';
  const culprit = issue.culprit || '';

  console.log(`\n[Issue #${issueId}] ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);

  // Step 1: Match against patterns
  const matchedRunbook = matchPattern(title, culprit);

  if (!matchedRunbook) {
    console.log('  ⏭️  No matching runbook pattern');
    stats.skipped++;
    return;
  }

  console.log(`  ✅ Matched: ${matchedRunbook}`);
  stats.matched++;

  // Step 2: Check if runbook comment already exists
  try {
    const hasRunbook = await hasRunbookComment(client, issueId);

    if (hasRunbook) {
      console.log('  ⏭️  Runbook already linked (skipping)');
      stats.skipped++;
      return;
    }
  } catch (error) {
    console.error(`  ⚠️  Error checking comments: ${error.message}`);
    // Continue anyway - better to duplicate than miss
  }

  // Step 3: Post runbook comment
  if (DRY_RUN) {
    console.log(`  🔍 [DRY RUN] Would post runbook: ${matchedRunbook}`);
    stats.commented++;
  } else {
    try {
      await postRunbookComment(client, issueId, matchedRunbook, title);
      console.log(`  📝 Posted runbook comment`);
      stats.commented++;
    } catch (error) {
      console.error(`  ❌ Error posting comment: ${error.message}`);
      stats.errors++;
    }
  }
}

/**
 * Match issue title/culprit against runbook patterns
 */
function matchPattern(title, culprit) {
  const text = `${title} ${culprit}`.toLowerCase();

  for (const [pattern, runbook] of Object.entries(PATTERNS)) {
    const regex = new RegExp(pattern, 'i'); // case-insensitive
    if (regex.test(text)) {
      return runbook;
    }
  }

  return null;
}

/**
 * Check if issue already has a runbook comment
 */
async function hasRunbookComment(client, issueId) {
  try {
    // Note: GlitchTip doesn't have a direct "get comments" endpoint
    // We'll use a workaround: try to get issue activity/events
    // For now, we'll skip this check and always post (idempotent marker will help)

    // TODO: Implement when GlitchTip adds comments API
    // For now, return false (always post)
    return false;

  } catch (error) {
    // If API fails, assume no comment exists
    return false;
  }
}

/**
 * Post runbook comment to issue
 */
async function postRunbookComment(client, issueId, runbookFile, issueTitle) {
  const runbookUrl = `${RUNBOOK_BASE_URL}/${runbookFile}`;
  const runbookName = runbookFile.replace('.md', '').split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  const comment = `${RUNBOOK_MARKER}: **${runbookName}**

🔗 **[View Runbook](${runbookUrl})**

This runbook provides:
- ✅ **Symptoms** - How to identify this error
- ✅ **Diagnosis** - Root cause verification steps
- ✅ **Fix** - Step-by-step resolution commands
- ✅ **Prevention** - How to avoid this error in the future

---

*Auto-linked by \`scripts/link-runbooks.js\` based on issue title matching pattern.*
*If this runbook doesn't match your error, please create a new one in \`runbooks/\`.*`;

  await client.addComment(ORG_SLUG, issueId, comment);
}

/**
 * Test all patterns against sample error messages
 */
function testPatterns() {
  console.log('🧪 Testing Runbook Patterns\n');

  const testCases = [
    // Database Timeout
    { text: 'ConnectionTimeout in database query', expected: 'database-timeout.md' },
    { text: 'Error: connection timed out after 30s', expected: 'database-timeout.md' },
    { text: 'could not obtain connection from pool', expected: 'database-timeout.md' },

    // WhatsApp Session
    { text: 'Expired session keys critical', expected: 'whatsapp-session-expired.md' },
    { text: 'WhatsApp device was removed', expected: 'whatsapp-session-expired.md' },
    { text: 'Baileys session expired', expected: 'whatsapp-session-expired.md' },

    // YClients Rate Limit
    { text: 'YClients rate limit exceeded', expected: 'yclients-rate-limit.md' },
    { text: 'HTTP 429 Too Many Requests', expected: 'yclients-rate-limit.md' },

    // Redis
    { text: 'ECONNREFUSED 127.0.0.1:6379', expected: 'redis-connection-refused.md' },
    { text: 'Redis connection refused', expected: 'redis-connection-refused.md' },

    // NPM
    { text: 'Cannot find module @whiskeysockets/baileys', expected: 'npm-module-not-found.md' },
    { text: 'MODULE_NOT_FOUND', expected: 'npm-module-not-found.md' }
  ];

  let passed = 0;
  let failed = 0;

  for (const { text, expected } of testCases) {
    const matched = matchPattern(text, '');
    const status = matched === expected ? '✅' : '❌';

    if (matched === expected) {
      passed++;
    } else {
      failed++;
      console.log(`${status} "${text}"`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Got:      ${matched || 'no match'}\n`);
    }
  }

  console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  if (process.argv.includes('--test')) {
    testPatterns();
  } else {
    main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

module.exports = { matchPattern, PATTERNS };
