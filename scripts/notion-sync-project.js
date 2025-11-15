#!/usr/bin/env node

/**
 * Notion Project Sync Script
 *
 * Syncs a single project from markdown to Notion (one-way sync).
 * Updates or creates project page and all associated tasks.
 *
 * Usage:
 *   node scripts/notion-sync-project.js dev/active/client-reactivation-service-v2
 *   node scripts/notion-sync-project.js --project=client-reactivation-service-v2
 */

const { Client } = require('@notionhq/client');
const path = require('path');
const fs = require('fs');
const { parseProject } = require('./notion-parse-markdown');

// Database IDs from Phase 0
const PROJECTS_DB = '2ac0a520-3786-819a-b0ab-c7758efab9fb';
const TASKS_DB = '2ac0a520-3786-81ed-8d10-ef3bc2974e3a';

// Get Notion token
function getNotionToken() {
  try {
    // Try .mcp.json first
    if (fs.existsSync('.mcp.json')) {
      const mcpConfig = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
      const token = mcpConfig.mcpServers?.notion?.env?.NOTION_TOKEN;
      if (token) return token;
    }
  } catch (error) {
    // Ignore, try environment variable
  }

  // Try environment variable
  if (process.env.NOTION_TOKEN) {
    return process.env.NOTION_TOKEN;
  }

  console.error('❌ NOTION_TOKEN not found in .mcp.json or environment');
  process.exit(1);
}

// Initialize Notion client
const notion = new Client({ auth: getNotionToken() });

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, context = '') {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastRetry = i === maxRetries - 1;

      if (isLastRetry) {
        console.error(`❌ ${context} failed after ${maxRetries} attempts:`, error.message);
        throw error;
      }

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`⚠️  Attempt ${i + 1} failed (${context}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Find existing project in Notion by name
 * NOTE: Using search API since databases.query doesn't exist in SDK v5
 */
async function findProjectByName(projectName) {
  try {
    const response = await retryWithBackoff(async () => {
      return await notion.search({
        query: projectName,
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 100
      });
    }, 3, `Searching for project "${projectName}"`);

    // Filter results to find exact match in Projects database
    const exactMatch = response.results.find(page => {
      // Check if page is in Projects database
      if (page.parent?.database_id !== PROJECTS_DB) return false;

      // Check if title matches exactly
      const titleProp = page.properties?.Name?.title?.[0]?.text?.content;
      return titleProp === projectName;
    });

    if (exactMatch) {
      console.log(`✅ Found existing project: ${projectName} (${exactMatch.id})`);
      return exactMatch;
    }

    console.log(`ℹ️  Project not found in Notion: ${projectName} (will create new)`);
    return null;
  } catch (error) {
    console.error(`❌ Error searching for project:`, error.message);
    // Return null instead of throwing - we can create new if search fails
    return null;
  }
}

/**
 * Create or update project in Notion
 */
async function syncProjectPage(projectData) {
  const existing = await findProjectByName(projectData.name);

  // Build project properties
  const properties = {
    Name: {
      title: [{ text: { content: projectData.name } }]
    }
  };

  // Add status if available
  if (projectData.status) {
    properties.Status = {
      select: { name: projectData.status }
    };
  }

  // Add phase if available
  if (projectData.phase) {
    properties.Phase = {
      select: { name: projectData.phase }
    };
  }

  // Add components (multi-select)
  if (projectData.components && projectData.components.length > 0) {
    properties.Component = {
      multi_select: projectData.components.map(c => ({ name: c }))
    };
  }

  // Add dates (only if properties exist - skip for now, can add later)
  // Note: These properties may need to be created in Notion database first
  // if (projectData.dates.lastUpdated) {
  //   properties['Last Updated'] = {
  //     date: { start: projectData.dates.lastUpdated }
  //   };
  // }

  // if (projectData.dates.targetDate) {
  //   properties['Target Date'] = {
  //     date: { start: projectData.dates.targetDate }
  //   };
  // }

  // Build page content (children blocks)
  const children = [];

  // Add summary if available
  if (projectData.context && projectData.context.summary) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: projectData.context.summary } }]
      }
    });
  }

  // Add divider
  if (children.length > 0) {
    children.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });
  }

  // Add metadata callout
  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { emoji: '📊' },
      rich_text: [{
        text: {
          content: `Tasks: ${projectData.metadata.completedTasks}/${projectData.metadata.totalTasks} completed | Source: ${projectData.metadata.projectPath}`
        }
      }]
    }
  });

  // Add source file path
  children.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        text: { content: `Source: ` }
      }, {
        text: { content: projectData.metadata.projectPath },
        annotations: { code: true }
      }]
    }
  });

  try {
    let page;

    if (existing) {
      // Update existing project
      page = await retryWithBackoff(async () => {
        return await notion.pages.update({
          page_id: existing.id,
          properties
        });
      }, 3, `Updating project "${projectData.name}"`);

      console.log(`✅ Updated project: ${projectData.name}`);
    } else {
      // Create new project
      page = await retryWithBackoff(async () => {
        return await notion.pages.create({
          parent: { database_id: PROJECTS_DB },
          properties,
          children
        });
      }, 3, `Creating project "${projectData.name}"`);

      console.log(`✅ Created project: ${projectData.name}`);
    }

    return page;
  } catch (error) {
    console.error(`❌ Failed to sync project page:`, error.message);
    throw error;
  }
}

/**
 * Find existing tasks for a project in Notion using search
 */
async function findProjectTasks(projectPageId) {
  try {
    const response = await retryWithBackoff(async () => {
      return await notion.search({
        filter: {
          property: 'object',
          value: 'page'
        },
        page_size: 100
      });
    }, 3, 'Finding project tasks');

    // Filter to only tasks in Tasks database related to this project
    const projectTasks = response.results.filter(page => {
      // Check if page is in Tasks database
      if (page.parent?.database_id !== TASKS_DB) return false;

      // Check if task is related to this project
      const projectRelation = page.properties?.Project?.relation || [];
      return projectRelation.some(rel => rel.id === projectPageId);
    });

    console.log(`ℹ️  Found ${projectTasks.length} existing tasks in Notion`);
    return projectTasks;
  } catch (error) {
    console.error(`❌ Error finding tasks:`, error.message);
    return []; // Return empty array on error, don't fail entire sync
  }
}

/**
 * Create or update a single task in Notion
 */
async function syncTask(task, projectPageId, existingTasks) {
  // Check if task already exists (match by name)
  const existing = existingTasks.find(t => {
    const titleProp = t.properties.Name?.title?.[0]?.text?.content;
    return titleProp === task.name;
  });

  // Build task properties
  const properties = {
    Name: {
      title: [{ text: { content: task.name } }]
    },
    Status: {
      select: { name: task.status }
    },
    Project: {
      relation: [{ id: projectPageId }]
    }
  };

  // Add priority if available
  if (task.priority) {
    properties.Priority = {
      select: { name: task.priority }
    };
  }

  // Add estimated hours if available
  if (task.estimatedHours !== null) {
    properties['Estimated Hours'] = {
      number: task.estimatedHours
    };
  }

  try {
    if (existing) {
      // Check if task has changed (status or priority)
      const existingStatus = existing.properties?.Status?.select?.name;
      const existingPriority = existing.properties?.Priority?.select?.name;

      const statusChanged = existingStatus !== task.status;
      const priorityChanged = task.priority && existingPriority !== task.priority;

      if (!statusChanged && !priorityChanged) {
        // Task unchanged, skip update
        return { action: 'skipped', task: task.name };
      }

      // Update existing task (only if changed)
      await retryWithBackoff(async () => {
        return await notion.pages.update({
          page_id: existing.id,
          properties
        });
      }, 3, `Updating task "${task.name}"`);

      return { action: 'updated', task: task.name };
    } else {
      // Create new task
      await retryWithBackoff(async () => {
        return await notion.pages.create({
          parent: { database_id: TASKS_DB },
          properties
        });
      }, 3, `Creating task "${task.name}"`);

      return { action: 'created', task: task.name };
    }
  } catch (error) {
    console.error(`❌ Failed to sync task "${task.name}":`, error.message);
    return { action: 'failed', task: task.name, error: error.message };
  }
}

/**
 * Sync all tasks for a project
 */
async function syncProjectTasks(tasks, projectPageId) {
  console.log(`\n📋 Syncing ${tasks.length} tasks...`);

  // Get existing tasks first
  const existingTasks = await findProjectTasks(projectPageId);

  const results = {
    created: [],
    updated: [],
    skipped: [],
    failed: []
  };

  // Sync tasks one by one (BullMQ will handle this in production)
  for (const task of tasks) {
    const result = await syncTask(task, projectPageId, existingTasks);

    if (result.action === 'created') {
      results.created.push(result.task);
      console.log(`  ✅ Created: ${result.task}`);
    } else if (result.action === 'updated') {
      results.updated.push(result.task);
      console.log(`  🔄 Updated: ${result.task}`);
    } else if (result.action === 'skipped') {
      results.skipped.push(result.task);
      // Don't log skipped tasks to keep output clean
    } else if (result.action === 'failed') {
      results.failed.push({ task: result.task, error: result.error });
      console.log(`  ❌ Failed: ${result.task}`);
    }
  }

  return results;
}

/**
 * Main sync function
 */
async function syncProject(projectPath) {
  // Input validation
  if (!projectPath || typeof projectPath !== 'string') {
    console.error(`❌ Invalid project path: ${projectPath}`);
    return { success: false, error: 'Invalid project path' };
  }

  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Project path does not exist: ${projectPath}`);
    return { success: false, error: 'Path not found' };
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`❌ Project path is not a directory: ${projectPath}`);
    return { success: false, error: 'Not a directory' };
  }

  console.log(`\n🔄 Syncing project: ${projectPath}\n`);

  // Parse markdown files
  const projectData = parseProject(projectPath);
  if (!projectData) {
    console.error(`❌ Failed to parse project at ${projectPath}`);
    return { success: false, error: 'Parse failed' };
  }

  // Validate parsed data
  if (!projectData.name || projectData.name.trim().length === 0) {
    console.error(`❌ Project has no name: ${projectPath}`);
    return { success: false, error: 'Missing project name' };
  }

  try {
    // Step 1: Sync project page
    const projectPage = await syncProjectPage(projectData);

    // Step 2: Sync tasks
    const taskResults = await syncProjectTasks(projectData.tasks, projectPage.id);

    // Step 3: Report results
    console.log(`\n📊 Sync Summary:`);
    console.log(`  Project: ${projectData.name} ✅`);
    console.log(`  Tasks created: ${taskResults.created.length}`);
    console.log(`  Tasks updated: ${taskResults.updated.length}`);
    console.log(`  Tasks skipped: ${taskResults.skipped.length} (unchanged)`);
    console.log(`  Tasks failed: ${taskResults.failed.length}`);

    if (taskResults.failed.length > 0) {
      console.log(`\n⚠️  Failed tasks:`);
      taskResults.failed.forEach(f => {
        console.log(`    - ${f.task}: ${f.error}`);
      });
    }

    return {
      success: taskResults.failed.length === 0,
      project: projectData.name,
      projectPageId: projectPage.id,
      tasksCreated: taskResults.created.length,
      tasksUpdated: taskResults.updated.length,
      tasksFailed: taskResults.failed.length,
      results: taskResults
    };
  } catch (error) {
    console.error(`\n❌ Sync failed:`, error.message);
    return {
      success: false,
      project: projectData?.name,
      error: error.message
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node notion-sync-project.js <project-path>
  node notion-sync-project.js --project=<project-name>

Examples:
  node notion-sync-project.js dev/active/client-reactivation-service-v2
  node notion-sync-project.js --project=client-reactivation-service-v2
    `);
    process.exit(1);
  }

  let projectPath;

  if (args[0].startsWith('--project=')) {
    const projectName = args[0].replace('--project=', '');
    projectPath = path.join(process.cwd(), 'dev/active', projectName);
  } else {
    projectPath = path.resolve(args[0]);
  }

  syncProject(projectPath)
    .then(result => {
      if (result.success) {
        console.log(`\n✅ Sync completed successfully`);
        process.exit(0);
      } else {
        console.log(`\n⚠️  Sync completed with errors`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`\n❌ Fatal error:`, error.message);
      process.exit(1);
    });
}

module.exports = { syncProject, syncProjectPage, syncProjectTasks };
