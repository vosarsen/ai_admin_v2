#!/usr/bin/env node

/**
 * Notion Phase Migration Script
 *
 * Migrates from 943 individual tasks to ~30-40 phase-level tasks.
 *
 * Steps:
 * 1. Archive/delete all existing tasks (old format)
 * 2. Run full sync to create new phase-level tasks
 *
 * IMPORTANT: Backup created in backups/ before running this!
 */

const axios = require('axios');
const fs = require('fs');
const { syncAllProjects } = require('./notion-daily-sync');

const TASKS_DB = '2ac0a520-3786-81ed-8d10-ef3bc2974e3a';
const NOTION_TOKEN = JSON.parse(fs.readFileSync('.mcp.json', 'utf8')).mcpServers.notion.env.NOTION_TOKEN;

/**
 * Archive all tasks without Phase Number (old format)
 */
async function archiveOldTasks() {
  console.log('\n🗑️  Step 1: Archiving old tasks...\n');

  let cursor = undefined;
  let totalArchived = 0;

  do {
    // Query tasks
    const queryResponse = await axios.post(
      `https://api.notion.com/v1/databases/${TASKS_DB}/query`,
      {
        start_cursor: cursor,
        page_size: 100,
        filter: {
          property: 'Phase Number',
          number: {
            is_empty: true
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const tasks = queryResponse.data.results;

    // Archive each task
    for (const task of tasks) {
      try {
        await axios.patch(
          `https://api.notion.com/v1/pages/${task.id}`,
          { archived: true },
          {
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            }
          }
        );

        totalArchived++;

        if (totalArchived % 50 === 0) {
          console.log(`  ✅ Archived ${totalArchived} tasks...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to archive task ${task.id}:`, error.message);
      }
    }

    cursor = queryResponse.data.next_cursor;
  } while (cursor);

  console.log(`\n✅ Archived ${totalArchived} old tasks\n`);
  return totalArchived;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Notion Phase Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    // Step 1: Archive old tasks
    const archived = await archiveOldTasks();

    // Step 2: Run full sync to create phase tasks
    console.log('\n🔄 Step 2: Syncing all projects with new phase format...\n');
    const syncResult = await syncAllProjects({ forceAll: true });

    // Step 3: Report results
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Migration Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🗑️  Archived: ${archived} old tasks`);
    console.log(`✅ Created: ${syncResult.projects.length} projects`);
    console.log(`📋 Total phases created: ${syncResult.projects.reduce((sum, p) => sum + (p.tasksCreated || 0), 0)}`);
    console.log('');

    if (syncResult.failed.length > 0) {
      console.log('⚠️  Some projects failed:');
      syncResult.failed.forEach(f => {
        console.log(`   - ${f.name}: ${f.error}`);
      });
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (syncResult.success) {
      console.log('✅ Migration completed successfully!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Migration completed with errors\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrate();
