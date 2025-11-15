#!/usr/bin/env node

/**
 * Notion Sync Health Check
 *
 * Monitors the health of Notion sync system:
 * - Last sync time (should be recent)
 * - Error counts (should be low)
 * - Database sizes (performance check)
 * - API rate (should be under limit)
 *
 * Usage:
 *   node scripts/notion-health-check.js           # Full health check
 *   node scripts/notion-health-check.js --json    # JSON output (for monitoring)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');

// Configuration
const STATE_FILE = path.join(__dirname, '../.notion-sync-state.json');
const PROJECTS_DB = '2ac0a520-3786-819a-b0ab-c7758efab9fb';
const TASKS_DB = '2ac0a520-3786-81ed-8d10-ef3bc2974e3a';
const KNOWLEDGE_BASE_DB = '2ac0a520-3786-81b6-8430-d98b279dc5f2';

// Health thresholds
const THRESHOLDS = {
  lastSyncMaxAge: 60 * 60 * 1000, // 1 hour in milliseconds
  maxErrorsPerDay: 5,
  maxDatabaseSize: 1000, // rows
  maxApiRate: 2.5 // req/sec (under 3 req/sec limit)
};

// Get Notion token
function getNotionToken() {
  try {
    if (fs.existsSync('.mcp.json')) {
      const mcpConfig = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
      const token = mcpConfig.mcpServers?.notion?.env?.NOTION_TOKEN;
      if (token) return token;
    }
  } catch (error) {
    // Ignore
  }

  if (process.env.NOTION_TOKEN) {
    return process.env.NOTION_TOKEN;
  }

  return null;
}

/**
 * Load sync state
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    return null;
  }
  return null;
}

/**
 * Check last sync time
 */
function checkLastSync(state) {
  if (!state || !state.lastFullSync) {
    return {
      status: 'warning',
      message: 'No sync history found',
      lastSync: null,
      ageMinutes: null
    };
  }

  const lastSyncTime = new Date(state.lastFullSync);
  const now = new Date();
  const ageMs = now - lastSyncTime;
  const ageMinutes = Math.round(ageMs / 60000);

  const isRecent = ageMs < THRESHOLDS.lastSyncMaxAge;

  return {
    status: isRecent ? 'ok' : 'warning',
    message: isRecent
      ? `Last sync ${ageMinutes} minutes ago`
      : `Last sync ${ageMinutes} minutes ago (>60 min)`,
    lastSync: state.lastFullSync,
    ageMinutes
  };
}

/**
 * Check error counts
 */
function checkErrors(state) {
  if (!state || !state.projects) {
    return {
      status: 'ok',
      message: 'No project data available',
      errorCount: 0,
      projectsWithErrors: []
    };
  }

  const projectsWithErrors = Object.entries(state.projects)
    .filter(([, data]) => (data.errors || 0) > 0)
    .map(([name, data]) => ({ name, errors: data.errors }));

  const totalErrors = projectsWithErrors.reduce((sum, p) => sum + p.errors, 0);
  const hasHighErrors = totalErrors > THRESHOLDS.maxErrorsPerDay;

  return {
    status: hasHighErrors ? 'critical' : 'ok',
    message: hasHighErrors
      ? `${totalErrors} errors detected (>${THRESHOLDS.maxErrorsPerDay} threshold)`
      : `${totalErrors} errors (OK)`,
    errorCount: totalErrors,
    projectsWithErrors
  };
}

/**
 * Check database sizes (requires Notion API)
 */
async function checkDatabaseSizes() {
  const token = getNotionToken();

  if (!token) {
    return {
      status: 'warning',
      message: 'Cannot check database sizes (no token)',
      databases: {}
    };
  }

  const notion = new Client({ auth: token });

  try {
    // Search for all pages in each database
    const [projectsCount, tasksCount, kbCount] = await Promise.all([
      countDatabasePages(notion, PROJECTS_DB),
      countDatabasePages(notion, TASKS_DB),
      countDatabasePages(notion, KNOWLEDGE_BASE_DB)
    ]);

    const sizes = {
      projects: projectsCount,
      tasks: tasksCount,
      knowledgeBase: kbCount
    };

    const maxSize = Math.max(projectsCount, tasksCount, kbCount);
    const isOk = maxSize < THRESHOLDS.maxDatabaseSize;

    return {
      status: isOk ? 'ok' : 'warning',
      message: isOk
        ? `Database sizes OK (max: ${maxSize} rows)`
        : `Large database detected (${maxSize} rows, >${THRESHOLDS.maxDatabaseSize})`,
      databases: sizes
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check databases: ${error.message}`,
      databases: {}
    };
  }
}

/**
 * Count pages in a database using search API
 */
async function countDatabasePages(notion, databaseId) {
  try {
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 100
    });

    // Filter to only pages in this database
    const pages = response.results.filter(
      page => page.parent?.database_id === databaseId
    );

    return pages.length;
  } catch (error) {
    console.error(`Error counting pages in ${databaseId}:`, error.message);
    return 0;
  }
}

/**
 * Estimate API rate (rough calculation from state)
 */
function checkApiRate(state) {
  if (!state || !state.projects) {
    return {
      status: 'ok',
      message: 'No data to estimate rate',
      estimatedRate: 0
    };
  }

  // Rough estimate: assume 10 calls per project per sync
  const projectCount = Object.keys(state.projects).length;
  const callsPerSync = projectCount * 10;

  // 64 syncs per day (15 min intervals for 16 hours)
  const callsPerDay = callsPerSync * 64;
  const callsPerSecond = callsPerDay / 86400;

  const isOk = callsPerSecond < THRESHOLDS.maxApiRate;

  return {
    status: isOk ? 'ok' : 'warning',
    message: isOk
      ? `Estimated ${callsPerSecond.toFixed(3)} req/sec (OK)`
      : `Estimated ${callsPerSecond.toFixed(3)} req/sec (>${THRESHOLDS.maxApiRate})`,
    estimatedRate: callsPerSecond,
    callsPerDay
  };
}

/**
 * Run full health check
 */
async function runHealthCheck(outputJson = false) {
  const state = loadState();

  const checks = {
    lastSync: checkLastSync(state),
    errors: checkErrors(state),
    apiRate: checkApiRate(state),
    databases: await checkDatabaseSizes()
  };

  // Overall status
  const statuses = Object.values(checks).map(c => c.status);
  const overallStatus = statuses.includes('critical') ? 'critical'
    : statuses.includes('error') ? 'error'
    : statuses.includes('warning') ? 'warning'
    : 'healthy';

  const result = {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    checks
  };

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHealthReport(result);
  }

  return result;
}

/**
 * Print human-readable health report
 */
function printHealthReport(result) {
  const statusEmoji = {
    healthy: '✅',
    ok: '✅',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  };

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Notion Sync Health Check');
  console.log(`⏰ ${result.timestamp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`${statusEmoji[result.status]} Overall Status: ${result.status.toUpperCase()}\n`);

  // Last Sync
  console.log(`${statusEmoji[result.checks.lastSync.status]} Last Sync: ${result.checks.lastSync.message}`);
  if (result.checks.lastSync.lastSync) {
    console.log(`   Time: ${result.checks.lastSync.lastSync}`);
  }

  // Errors
  console.log(`\n${statusEmoji[result.checks.errors.status]} Errors: ${result.checks.errors.message}`);
  if (result.checks.errors.projectsWithErrors.length > 0) {
    result.checks.errors.projectsWithErrors.forEach(p => {
      console.log(`   - ${p.name}: ${p.errors} errors`);
    });
  }

  // API Rate
  console.log(`\n${statusEmoji[result.checks.apiRate.status]} API Rate: ${result.checks.apiRate.message}`);
  if (result.checks.apiRate.callsPerDay) {
    console.log(`   Calls/day: ${result.checks.apiRate.callsPerDay}`);
  }

  // Databases
  console.log(`\n${statusEmoji[result.checks.databases.status]} Databases: ${result.checks.databases.message}`);
  if (result.checks.databases.databases.projects !== undefined) {
    console.log(`   Projects: ${result.checks.databases.databases.projects} rows`);
    console.log(`   Tasks: ${result.checks.databases.databases.tasks} rows`);
    console.log(`   Knowledge Base: ${result.checks.databases.databases.knowledgeBase} rows`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Recommendations
  if (result.status !== 'healthy') {
    console.log('💡 Recommendations:\n');

    if (result.checks.lastSync.status !== 'ok') {
      console.log('   • Check PM2 cron jobs: pm2 list | grep notion');
      console.log('   • Check logs: pm2 logs notion-sync-15min --lines 50');
      console.log('   • Run manual sync: npm run notion:sync\n');
    }

    if (result.checks.errors.status !== 'ok') {
      console.log('   • Review error logs: tail -100 logs/notion-sync-error.log');
      console.log('   • Check project files: ls dev/active/*/\n');
    }

    if (result.checks.databases.status === 'warning') {
      console.log('   • Consider archiving old projects');
      console.log('   • Review database performance in Notion\n');
    }

    if (result.checks.apiRate.status === 'warning') {
      console.log('   • Consider reducing sync frequency');
      console.log('   • Check if change detection is working\n');
    }
  }

  // Exit code based on status
  const exitCode = result.status === 'healthy' || result.status === 'ok' ? 0 : 1;
  return exitCode;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const outputJson = args.includes('--json');

  runHealthCheck(outputJson)
    .then(result => {
      const exitCode = result.status === 'healthy' || result.status === 'ok' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runHealthCheck };
