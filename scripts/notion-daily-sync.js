#!/usr/bin/env node

/**
 * Notion Daily Sync Orchestrator
 *
 * Scans dev/active/* for all projects and syncs them to Notion.
 * Designed to run:
 * - Every 15 minutes (8am-11pm) via PM2 cron
 * - Nightly full sync at 2am
 * - Manual trigger anytime
 *
 * Usage:
 *   node scripts/notion-daily-sync.js                    # Normal sync
 *   node scripts/notion-daily-sync.js --force-all        # Force re-sync all
 *   node scripts/notion-daily-sync.js --now              # Run immediately (for testing)
 */

const fs = require('fs');
const path = require('path');
const { scanActiveProjects } = require('./notion-parse-markdown');
const { syncProject } = require('./notion-sync-project');

// State file to track last sync times
const STATE_FILE = path.join(__dirname, '../.notion-sync-state.json');

/**
 * Load sync state from file
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('⚠️  Failed to load state file, using empty state:', error.message);
  }

  return {
    lastFullSync: null,
    projects: {}
  };
}

/**
 * Save sync state to file
 */
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Failed to save state file:', error.message);
  }
}

/**
 * Check if project files have changed since last sync
 */
function hasProjectChanged(projectPath, lastSyncTime) {
  if (!lastSyncTime) return true; // Never synced before

  try {
    const projectName = path.basename(projectPath);
    const files = [
      path.join(projectPath, `${projectName}-plan.md`),
      path.join(projectPath, `${projectName}-context.md`),
      path.join(projectPath, `${projectName}-tasks.md`)
    ];

    // Check if any file was modified after last sync
    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const stats = fs.statSync(file);
      const modTime = new Date(stats.mtime).getTime();
      const syncTime = new Date(lastSyncTime).getTime();

      if (modTime > syncTime) {
        return true; // File modified after last sync
      }
    }

    return false; // No changes detected
  } catch (error) {
    console.warn(`⚠️  Error checking if project changed: ${error.message}`);
    return true; // Sync if we can't determine (safer)
  }
}

/**
 * Send Telegram alert (if configured)
 */
async function sendTelegramAlert(message) {
  // TODO: Implement Telegram integration if needed
  // For now, just log
  console.log(`📱 [Telegram Alert] ${message}`);
}

/**
 * Sync all projects
 */
async function syncAllProjects(options = {}) {
  const { forceAll = false } = options;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Notion Sync Orchestrator');
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`🔧 Mode: ${forceAll ? 'FULL SYNC (force all)' : 'SMART SYNC (skip unchanged)'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();
  const state = loadState();

  // Scan for all active projects
  const activeDir = path.join(process.cwd(), 'dev/active');
  const projectPaths = scanActiveProjects(activeDir);

  if (projectPaths.length === 0) {
    console.log('⚠️  No projects found in dev/active/');
    return { success: true, projects: [], skipped: [], failed: [], duration: 0 };
  }

  console.log(`📂 Found ${projectPaths.length} projects\n`);

  const results = {
    synced: [],
    skipped: [],
    failed: []
  };

  // Sync each project
  for (const projectPath of projectPaths) {
    const projectName = path.basename(projectPath);
    const lastSync = state.projects[projectName]?.lastSync;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📁 Project: ${projectName}`);

    // Check if we should skip this project
    if (!forceAll && !hasProjectChanged(projectPath, lastSync)) {
      console.log(`⏭️  Skipping (no changes since ${lastSync})`);
      results.skipped.push({
        name: projectName,
        reason: 'No changes detected'
      });
      continue;
    }

    // Sync the project
    try {
      const syncResult = await syncProject(projectPath);

      if (syncResult.success) {
        results.synced.push({
          name: projectName,
          projectPageId: syncResult.projectPageId,
          tasksCreated: syncResult.tasksCreated,
          tasksUpdated: syncResult.tasksUpdated
        });

        // Update state
        state.projects[projectName] = {
          lastSync: new Date().toISOString(),
          notionPageId: syncResult.projectPageId,
          taskCount: syncResult.tasksCreated + syncResult.tasksUpdated,
          errors: 0
        };

        console.log(`✅ Success: ${syncResult.tasksCreated} created, ${syncResult.tasksUpdated} updated`);
      } else {
        results.failed.push({
          name: projectName,
          error: syncResult.error || 'Unknown error'
        });

        // Update error count in state
        if (!state.projects[projectName]) {
          state.projects[projectName] = {};
        }
        state.projects[projectName].errors = (state.projects[projectName].errors || 0) + 1;

        console.log(`❌ Failed: ${syncResult.error}`);
      }
    } catch (error) {
      results.failed.push({
        name: projectName,
        error: error.message
      });

      // Update error count in state
      if (!state.projects[projectName]) {
        state.projects[projectName] = {};
      }
      state.projects[projectName].errors = (state.projects[projectName].errors || 0) + 1;

      console.log(`❌ Exception: ${error.message}`);
    }
  }

  // Update last full sync time if this was a full sync
  if (forceAll || results.synced.length > 0) {
    state.lastFullSync = new Date().toISOString();
  }

  // Save state
  saveState(state);

  // Calculate duration
  const duration = Math.round((Date.now() - startTime) / 1000);

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Sync Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`✅ Synced: ${results.synced.length} projects`);
  console.log(`⏭️  Skipped: ${results.skipped.length} projects (no changes)`);
  console.log(`❌ Failed: ${results.failed.length} projects`);
  console.log('');

  if (results.synced.length > 0) {
    console.log('✅ Synced Projects:');
    results.synced.forEach(p => {
      console.log(`   - ${p.name}: ${p.tasksCreated} created, ${p.tasksUpdated} updated`);
    });
    console.log('');
  }

  if (results.skipped.length > 0) {
    console.log('⏭️  Skipped Projects:');
    results.skipped.forEach(p => {
      console.log(`   - ${p.name}: ${p.reason}`);
    });
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed Projects:');
    results.failed.forEach(p => {
      console.log(`   - ${p.name}: ${p.error}`);
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Send alerts based on failure rate
  const totalProjects = projectPaths.length;
  const failureRate = results.failed.length / totalProjects;

  if (failureRate === 0) {
    // Perfect sync - no alerts
    if (results.synced.length > 0) {
      await sendTelegramAlert(`✅ Notion sync complete: ${results.synced.length} projects synced in ${duration}s`);
    }
  } else if (failureRate < 0.5) {
    // Partial failure (<50%) - Alert if consecutive failures
    const consecutiveFailures = Object.values(state.projects)
      .filter(p => (p.errors || 0) >= 2).length;

    if (consecutiveFailures > 0) {
      await sendTelegramAlert(
        `⚠️ Notion sync partial failures:\n` +
        `${results.failed.length}/${totalProjects} projects failed\n` +
        `${consecutiveFailures} with consecutive failures\n` +
        results.failed.map(f => `- ${f.name}: ${f.error}`).join('\n')
      );
    }
  } else {
    // Major failure (≥50%) - Immediate alert
    await sendTelegramAlert(
      `🚨 Notion sync major failure!\n` +
      `${results.failed.length}/${totalProjects} projects failed (${Math.round(failureRate * 100)}%)\n` +
      `Duration: ${duration}s\n` +
      `Check logs: pm2 logs notion-sync`
    );
  }

  const allSuccessful = results.failed.length === 0;
  return {
    success: allSuccessful,
    duration,
    projects: results.synced,
    skipped: results.skipped,
    failed: results.failed,
    summary: {
      total: totalProjects,
      synced: results.synced.length,
      skipped: results.skipped.length,
      failed: results.failed.length
    }
  };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse options
  const options = {
    forceAll: args.includes('--force-all'),
    now: args.includes('--now')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Notion Daily Sync Orchestrator

Usage:
  node scripts/notion-daily-sync.js [options]

Options:
  --force-all    Force sync all projects (ignore change detection)
  --now          Run immediately (for testing, same as no args)
  --help, -h     Show this help message

Examples:
  node scripts/notion-daily-sync.js                # Smart sync (skip unchanged)
  node scripts/notion-daily-sync.js --force-all    # Full sync (sync everything)
  node scripts/notion-daily-sync.js --now          # Run now (testing)

Automated Runs:
  This script is designed to run via PM2 cron:
  - Every 15 minutes (8am-11pm): Smart sync
  - Daily at 2am: Full sync (--force-all)
    `);
    process.exit(0);
  }

  console.log('🚀 Starting Notion sync...\n');

  syncAllProjects(options)
    .then(result => {
      if (result.success) {
        console.log('✅ All syncs completed successfully\n');
        process.exit(0);
      } else {
        console.log('⚠️  Some syncs failed (see summary above)\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { syncAllProjects };
