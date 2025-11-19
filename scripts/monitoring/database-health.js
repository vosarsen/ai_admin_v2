#!/usr/bin/env node

/**
 * Database Health Check Dashboard
 *
 * Displays comprehensive health metrics for PostgreSQL and WhatsApp sessions:
 * - Connection pool status (current/averages/peaks)
 * - Query latency metrics (P50/P95/P99)
 * - Expired session keys count and age distribution
 * - Recent slow queries and errors
 *
 * USAGE:
 *   node scripts/monitoring/database-health.js [options]
 *
 * OPTIONS:
 *   --watch         Auto-refresh every 10 seconds
 *   --json          Output in JSON format (for automation)
 *   --verbose       Show detailed information (recent queries, snapshots)
 *
 * EXAMPLES:
 *   npm run health-check
 *   npm run health-check -- --watch
 *   npm run health-check -- --json
 *
 * Created: 2025-11-19
 * Reference: dev/active/baileys-resilience-improvements/
 */

const postgres = require('../../src/database/postgres');
const baileys = require('../../src/integrations/whatsapp/auth-state-timeweb');

// ANSI colors for console output
const COLORS = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m'
};

// Status emojis
const STATUS = {
  healthy: '✅',
  warning: '⚠️ ',
  critical: '🔴',
  error: '❌'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  watch: args.includes('--watch'),
  json: args.includes('--json'),
  verbose: args.includes('--verbose')
};

/**
 * Format number with proper units
 */
function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

/**
 * Get color for status
 */
function getStatusColor(status) {
  switch (status) {
    case 'healthy': return COLORS.GREEN;
    case 'warning': return COLORS.YELLOW;
    case 'critical': return COLORS.RED;
    case 'error': return COLORS.RED;
    default: return COLORS.WHITE;
  }
}

/**
 * Print separator line
 */
function printSeparator(char = '─', length = 80) {
  if (!options.json) {
    console.log(COLORS.GRAY + char.repeat(length) + COLORS.RESET);
  }
}

/**
 * Print header
 */
function printHeader(text) {
  if (!options.json) {
    console.log(`\n${COLORS.CYAN}${text}${COLORS.RESET}`);
    printSeparator();
  }
}

/**
 * Print status line
 */
function printStatus(label, value, status = 'healthy') {
  if (!options.json) {
    const statusEmoji = STATUS[status] || '•';
    const color = getStatusColor(status);
    console.log(`${statusEmoji} ${label.padEnd(30)} ${color}${value}${COLORS.RESET}`);
  }
}

/**
 * Collect all health metrics
 */
async function collectHealthMetrics() {
  try {
    // Connection pool metrics
    const poolMetrics = postgres.getPoolMetrics();

    // Query latency metrics
    const queryMetrics = baileys.getQueryMetrics();

    // Session health
    const sessionHealth = await baileys.checkSessionHealth();

    // Key age distribution
    const ageDistribution = await baileys.getKeyAgeDistribution();

    return {
      pool: poolMetrics,
      queries: queryMetrics,
      sessions: sessionHealth,
      keyAges: ageDistribution,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`${COLORS.RED}Error collecting health metrics:${COLORS.RESET}`, error.message);
    return null;
  }
}

/**
 * Display health dashboard (CLI format)
 */
function displayDashboard(metrics) {
  if (!metrics) {
    console.error(`${COLORS.RED}❌ Failed to collect metrics${COLORS.RESET}`);
    return;
  }

  // Clear screen (optional)
  if (options.watch) {
    console.clear();
  }

  // Header
  console.log(`
${COLORS.MAGENTA}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   DATABASE HEALTH CHECK DASHBOARD                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${COLORS.RESET}
`);

  console.log(`${COLORS.GRAY}Last updated: ${metrics.timestamp}${COLORS.RESET}`);

  // ====================================================================================
  // 1. Connection Pool Health
  // ====================================================================================
  printHeader('1. CONNECTION POOL HEALTH');

  if (metrics.pool.enabled) {
    const pool = metrics.pool;
    const poolStatus = pool.healthStatus;

    printStatus('Overall Status', `${pool.healthMessage}`, poolStatus);
    printStatus('Total Connections', pool.current.total, poolStatus);
    printStatus('Idle Connections', pool.current.idle);
    printStatus('Active Connections', pool.current.active);
    printStatus('Wait Queue', pool.current.waiting, pool.current.waiting > 0 ? 'warning' : 'healthy');
    printStatus('Usage', pool.current.usage);
    printStatus('Max Connections', pool.current.maxConnections);

    if (pool.averages) {
      console.log();
      printStatus('Avg Total (1h)', pool.averages.avgTotal);
      printStatus('Avg Usage (1h)', pool.averages.avgUsage);
      printStatus('Peak Usage (1h)', pool.peaks.peakUsage);
      printStatus('Peak Wait Queue (1h)', pool.peaks.peakWaiting, pool.peaks.peakWaiting > 0 ? 'warning' : 'healthy');
    }

    if (options.verbose && pool.history.recentSnapshots.length > 0) {
      console.log(`\n${COLORS.GRAY}Recent snapshots (last 10):${COLORS.RESET}`);
      pool.history.recentSnapshots.forEach(s => {
        console.log(`  ${COLORS.GRAY}${s.timestamp}: total=${s.total}, idle=${s.idle}, active=${s.active}, waiting=${s.waiting}, usage=${s.usage}${COLORS.RESET}`);
      });
    }
  } else {
    printStatus('Status', 'PostgreSQL not enabled', 'error');
  }

  // ====================================================================================
  // 2. Query Performance
  // ====================================================================================
  printHeader('2. QUERY PERFORMANCE');

  if (metrics.queries.total > 0) {
    const queries = metrics.queries;
    const avgLatency = parseFloat(queries.latency.avg);

    printStatus('Total Queries', formatNumber(queries.total));
    printStatus('Success Rate', `${queries.successRate}%`, queries.successRate >= 95 ? 'healthy' : 'warning');
    printStatus('P50 Latency', `${queries.latency.p50}ms`, queries.latency.p50 < 100 ? 'healthy' : 'warning');
    printStatus('P95 Latency', `${queries.latency.p95}ms`, queries.latency.p95 < 200 ? 'healthy' : 'warning');
    printStatus('P99 Latency', `${queries.latency.p99}ms`, queries.latency.p99 < 500 ? 'healthy' : 'warning');
    printStatus('Avg Latency', `${avgLatency}ms`, avgLatency < 100 ? 'healthy' : 'warning');

    if (queries.slowQueries.count > 0) {
      console.log();
      printStatus('Slow Queries (>500ms)', queries.slowQueries.count, 'warning');

      if (options.verbose && queries.slowQueries.recent.length > 0) {
        console.log(`\n${COLORS.GRAY}Recent slow queries:${COLORS.RESET}`);
        queries.slowQueries.recent.slice(0, 5).forEach(q => {
          console.log(`  ${COLORS.YELLOW}${q.duration}ms${COLORS.RESET} - ${COLORS.GRAY}${q.sql}${COLORS.RESET}`);
        });
      }
    }

    if (queries.errors > 0) {
      console.log();
      printStatus('Query Errors', queries.errors, 'error');

      if (options.verbose && queries.recentErrors.length > 0) {
        console.log(`\n${COLORS.GRAY}Recent errors:${COLORS.RESET}`);
        queries.recentErrors.slice(0, 3).forEach(q => {
          console.log(`  ${COLORS.RED}${q.error}${COLORS.RESET} - ${COLORS.GRAY}${q.sql}${COLORS.RESET}`);
        });
      }
    }
  } else {
    printStatus('Status', 'No query data available', 'warning');
  }

  // ====================================================================================
  // 3. Session Health
  // ====================================================================================
  printHeader('3. SESSION HEALTH');

  const sessions = metrics.sessions;
  const sessionStatus = sessions.status;

  printStatus('Overall Status', sessions.message, sessionStatus);
  printStatus('Auth Records', sessions.auth_records);
  printStatus('Total Keys', formatNumber(sessions.total_keys));
  printStatus('Expired Keys', formatNumber(sessions.expired_keys), sessionStatus);

  if (metrics.keyAges) {
    console.log();
    printStatus('Keys (0-1 day)', formatNumber(parseInt(metrics.keyAges.last_1_day)));
    printStatus('Keys (1-7 days)', formatNumber(parseInt(metrics.keyAges.last_7_days)));
    printStatus('Keys (7-14 days)', formatNumber(parseInt(metrics.keyAges.last_14_days)));
    printStatus('Keys (14-30 days)', formatNumber(parseInt(metrics.keyAges.last_30_days)));
    printStatus('Keys (>30 days old)', formatNumber(parseInt(metrics.keyAges.older_than_30_days)),
      parseInt(metrics.keyAges.older_than_30_days) > 500 ? 'critical' :
      parseInt(metrics.keyAges.older_than_30_days) > 100 ? 'warning' : 'healthy');
  }

  // ====================================================================================
  // Summary
  // ====================================================================================
  console.log();
  printSeparator('═');

  // Overall system health
  let overallStatus = 'healthy';
  if (sessionStatus === 'critical' || metrics.pool.healthStatus === 'critical') {
    overallStatus = 'critical';
  } else if (sessionStatus === 'warning' || metrics.pool.healthStatus === 'warning') {
    overallStatus = 'warning';
  }

  const statusEmoji = STATUS[overallStatus];
  const statusColor = getStatusColor(overallStatus);
  console.log(`\n${statusEmoji} ${statusColor}OVERALL STATUS: ${overallStatus.toUpperCase()}${COLORS.RESET}\n`);

  // Recommendations
  if (overallStatus !== 'healthy') {
    console.log(`${COLORS.YELLOW}⚠️  RECOMMENDATIONS:${COLORS.RESET}`);

    if (metrics.pool.healthStatus === 'critical') {
      console.log(`   • Connection pool exhausted - consider increasing POSTGRES_MAX_CONNECTIONS`);
    } else if (metrics.pool.healthStatus === 'warning') {
      console.log(`   • Connection pool usage high - monitor for capacity issues`);
    }

    if (sessionStatus === 'critical') {
      console.log(`   • Run cleanup immediately: node scripts/cleanup/cleanup-expired-session-keys.js`);
    } else if (sessionStatus === 'warning') {
      console.log(`   • Schedule cleanup soon to prevent key accumulation`);
    }

    if (metrics.queries.slowQueries.count > 10) {
      console.log(`   • ${metrics.queries.slowQueries.count} slow queries detected - review query performance`);
    }

    console.log();
  }

  // Footer
  if (options.watch) {
    console.log(`${COLORS.GRAY}Auto-refreshing every 10 seconds... Press Ctrl+C to exit${COLORS.RESET}`);
  }
}

/**
 * Display health metrics in JSON format
 */
function displayJSON(metrics) {
  if (!metrics) {
    console.error(JSON.stringify({ error: 'Failed to collect metrics' }, null, 2));
    return;
  }

  console.log(JSON.stringify(metrics, null, 2));
}

/**
 * Main execution
 */
async function main() {
  try {
    const metrics = await collectHealthMetrics();

    if (options.json) {
      displayJSON(metrics);
    } else {
      displayDashboard(metrics);
    }

    // Watch mode
    if (options.watch && !options.json) {
      setInterval(async () => {
        const updatedMetrics = await collectHealthMetrics();
        displayDashboard(updatedMetrics);
      }, 10000); // 10 seconds
    } else {
      // Exit after single check
      process.exit(0);
    }
  } catch (error) {
    console.error(`${COLORS.RED}Fatal error:${COLORS.RESET}`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  collectHealthMetrics,
  displayDashboard,
  displayJSON
};
