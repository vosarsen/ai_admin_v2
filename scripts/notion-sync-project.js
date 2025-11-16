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

  // Phase 2.0: Add essential fields only (Summary moved to page content)
  if (projectData.summary) {
    // Timeline
    if (projectData.summary.timeline) {
      properties.Timeline = {
        rich_text: [{ text: { content: projectData.summary.timeline } }]
      };
    }

    // Risk Level (select)
    if (projectData.summary.risk) {
      properties['Risk Level'] = {
        select: { name: projectData.summary.risk }
      };
    }
  }

  // Progress (auto-calculated from tasks)
  if (projectData.metadata.totalTasks > 0) {
    const progressPercent = Math.round(
      (projectData.metadata.completedTasks / projectData.metadata.totalTasks) * 100
    );
    properties.Progress = {
      number: progressPercent
    };
  }

  // Priority (default to Medium if not set)
  // Note: Can be manually changed in Notion
  properties.Priority = {
    select: { name: 'Medium' }
  };

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

  // Build page content (children blocks) - DEVELOPMENT DIARY style (comprehensive & technical)
  const children = [];

  // Helper function to add heading
  const addHeading = (level, text, emoji = '') => {
    const type = `heading_${level}`;
    children.push({
      object: 'block',
      type,
      [type]: {
        rich_text: [{ text: { content: emoji ? `${emoji} ${text}` : text } }]
      }
    });
  };

  // Helper to add paragraph
  const addParagraph = (text, bold = false, code = false) => {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          text: { content: text },
          annotations: { bold, code }
        }]
      }
    });
  };

  // Helper to add bullet
  const addBullet = (text, bold = false, code = false) => {
    children.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{
          text: { content: text },
          annotations: { bold, code }
        }]
      }
    });
  };

  // Helper to add divider
  const addDivider = () => {
    children.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });
  };

  // Helper to add callout
  const addCallout = (emoji, text, color = 'default') => {
    children.push({
      object: 'block',
      type: 'callout',
      callout: {
        icon: { emoji },
        rich_text: [{ text: { content: text } }],
        color
      }
    });
  };

  const progressPercent = projectData.metadata.totalTasks > 0
    ? Math.round((projectData.metadata.completedTasks / projectData.metadata.totalTasks) * 100)
    : 0;

  const progressBar = '▓'.repeat(Math.floor(progressPercent / 10)) + '░'.repeat(10 - Math.floor(progressPercent / 10));

  // 📊 Project Overview Callout (compact)
  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      icon: { emoji: '📊' },
      rich_text: [{
        text: {
          content: `${projectData.status || 'Unknown'} • ${progressBar} ${progressPercent}% • ${projectData.summary?.timeline || 'TBD'} • Risk: ${projectData.summary?.risk || 'Medium'} • ${projectData.components.join(', ')}`
        }
      }]
    }
  });

  // === PLAN CONTENT (from plan.md before Implementation Phases) ===
  // This is the comprehensive content the user requested - like dev diary style
  if (projectData.planContent) {
    // Track blocks count (Notion API limit: 100 blocks per request)
    // Reserve ~30 blocks for Implementation Plan + footer
    const MAX_PLAN_BLOCKS = 60;
    const planContentBlocks = [];

    // Convert markdown to Notion blocks
    const lines = projectData.planContent.split('\n');
    let i = 0;

    while (i < lines.length && planContentBlocks.length < MAX_PLAN_BLOCKS) {
      const line = lines[i].trim();

      // Skip empty lines
      if (line.length === 0) {
        i++;
        continue;
      }

      // Headers (##, ###, ####)
      if (line.startsWith('####')) {
        const text = line.replace(/^####\s*/, '').trim();
        planContentBlocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: { rich_text: [{ text: { content: text }}]}
        });
        i++;
        continue;
      }

      if (line.startsWith('###')) {
        const text = line.replace(/^###\s*/, '').trim();
        planContentBlocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: text }}]}
        });
        i++;
        continue;
      }

      if (line.startsWith('##')) {
        const text = line.replace(/^##\s*/, '').trim();
        planContentBlocks.push({
          object: 'block',
          type: 'heading_1',
          heading_1: { rich_text: [{ text: { content: text }}]}
        });
        i++;
        continue;
      }

      // Dividers (---)
      if (line === '---') {
        planContentBlocks.push({
          object: 'block',
          type: 'divider',
          divider: {}
        });
        i++;
        continue;
      }

      // Bullets (-, *, +)
      if (/^[-*+]\s/.test(line)) {
        const text = line.replace(/^[-*+]\s*/, '').trim();
        planContentBlocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [{ text: { content: text }}]}
        });
        i++;
        continue;
      }

      // Code blocks (```)
      if (line.startsWith('```')) {
        const codeLines = [];
        i++; // Skip opening ```
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // Skip closing ```

        const codeText = codeLines.join('\n');
        // Notion has 2000 char limit for code blocks
        if (codeText.length > 1900) {
          // Split into multiple code blocks
          const chunks = codeText.match(/[\s\S]{1,1900}/g) || [];
          chunks.forEach(chunk => {
            if (planContentBlocks.length < MAX_PLAN_BLOCKS) {
              planContentBlocks.push({
                object: 'block',
                type: 'code',
                code: {
                  rich_text: [{ text: { content: chunk }}],
                  language: 'plain text'
                }
              });
            }
          });
        } else {
          planContentBlocks.push({
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ text: { content: codeText }}],
              language: 'plain text'
            }
          });
        }
        continue;
      }

      // Bold text (**text**)
      const hasBold = /\*\*(.+?)\*\*/.test(line);

      // Regular paragraphs
      const text = line.replace(/\*\*(.+?)\*\*/g, '$1'); // Strip markdown bold for now
      planContentBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: text }}]}
      });
      i++;
    }

    // Add plan content blocks to children
    children.push(...planContentBlocks);

    // Add note if content was truncated
    if (planContentBlocks.length >= MAX_PLAN_BLOCKS) {
      addParagraph('⚠️ Контент обрезан из-за ограничений Notion API. Полная информация в исходных файлах.', true);
    }
  } else {
    // Fallback if no plan content
    addParagraph('Детальная информация о проекте находится в исходных файлах.');
  }

  addDivider();

  // 📋 План Реализации
  if (projectData.tasks && projectData.tasks.length > 0) {
    addHeading(1, 'План Реализации', '📋');

    addParagraph(`Проект разбит на ${projectData.tasks.length} фаз с общим количеством ${projectData.metadata.totalTasks} задач.`);

    // Группировка фаз по статусу
    const donePhases = projectData.tasks.filter(p => p.status === 'Done');
    const activePhases = projectData.tasks.filter(p => p.status === 'In Progress');
    const upcomingPhases = projectData.tasks.filter(p => p.status === 'Todo' || p.status === 'Review');

    // Завершённые фазы
    if (donePhases.length > 0) {
      addHeading(2, `✅ Завершённые Фазы (${donePhases.length})`);
      donePhases.forEach(phase => {
        addBullet(`${phase.name} — 100% (${phase.totalTasks} задач)`);
      });
    }

    // Фазы в работе
    if (activePhases.length > 0) {
      addHeading(2, `🔄 В Процессе (${activePhases.length})`);
      activePhases.forEach(phase => {
        const phaseProgress = phase.totalTasks > 0
          ? Math.round((phase.completedTasks / phase.totalTasks) * 100)
          : 0;
        const phaseBar = '▓'.repeat(Math.floor(phaseProgress / 10)) + '░'.repeat(10 - Math.floor(phaseProgress / 10));
        addBullet(`${phase.name} — ${phaseBar} ${phaseProgress}% (${phase.completedTasks}/${phase.totalTasks} задач)`);
      });
    }

    // Предстоящие фазы
    if (upcomingPhases.length > 0) {
      addHeading(2, `⬜ Предстоящие Фазы (${upcomingPhases.length})`);
      upcomingPhases.forEach(phase => {
        addBullet(`${phase.name} — ${phase.totalTasks} задач`);
      });
    }
  }

  addDivider();

  // 📅 Текущий Статус и Таймлайн
  addHeading(1, 'Текущий Статус и Таймлайн', '📅');

  if (projectData.dates.lastUpdated) {
    addBullet(`Последнее обновление: ${projectData.dates.lastUpdated}`);
  }

  if (projectData.phase) {
    addBullet(`Текущая фаза: ${projectData.phase}`);
  }

  if (projectData.dates.targetDate) {
    addBullet(`Целевая дата: ${projectData.dates.targetDate}`);
  }

  addBullet(`Общий прогресс: ${progressBar} ${progressPercent}%`);
  addBullet(`Всего задач: ${projectData.metadata.totalTasks} (выполнено: ${projectData.metadata.completedTasks}, осталось: ${projectData.metadata.totalTasks - projectData.metadata.completedTasks})`);

  addDivider();

  // 📚 Исходные Файлы
  addHeading(1, 'Исходные Файлы', '📚');

  addParagraph('Расположение: ', false, false);
  addParagraph(projectData.metadata.projectPath, false, true);

  addBullet(`${projectData.metadata.projectName}-plan.md — Стратегический план и архитектура`, false, true);
  addBullet(`${projectData.metadata.projectName}-context.md — Текущее состояние и ключевые решения`, false, true);
  addBullet(`${projectData.metadata.projectName}-tasks.md — Детальная разбивка задач`, false, true);

  addDivider();

  // Footer callout
  addCallout('💡', `Эта страница автоматически синхронизируется из markdown. Редактируйте исходные файлы в ${projectData.metadata.projectPath} и запустите синхронизацию для обновления.`, 'gray_background');

  try {
    let page;

    if (existing) {
      // Update existing project properties
      page = await retryWithBackoff(async () => {
        return await notion.pages.update({
          page_id: existing.id,
          properties
        });
      }, 3, `Updating project "${projectData.name}"`);

      // Update page content: delete old blocks and add new ones
      try {
        // Get existing blocks
        const blocksResponse = await notion.blocks.children.list({
          block_id: existing.id
        });

        // Delete all existing blocks (skip archived ones)
        for (const block of blocksResponse.results) {
          if (!block.archived) {
            try {
              await notion.blocks.delete({ block_id: block.id });
            } catch (deleteError) {
              // Skip blocks that can't be deleted
              console.warn(`⚠️  Skipped block ${block.id}: ${deleteError.message}`);
            }
          }
        }

        // Add new blocks
        await notion.blocks.children.append({
          block_id: existing.id,
          children
        });

        console.log(`✅ Updated project: ${projectData.name} (properties + content)`);
      } catch (contentError) {
        console.warn(`⚠️  Updated properties but failed to update content: ${contentError.message}`);
      }
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
 * Create or update a PHASE-LEVEL task in Notion
 */
async function syncPhase(phase, projectPageId, existingPhases) {
  // Check if phase already exists (match by name)
  const existing = existingPhases.find(p => {
    const titleProp = p.properties.Name?.title?.[0]?.text?.content;
    return titleProp === phase.name;
  });

  // Build checklist text from array
  const checklistText = phase.checklist.join('\n');

  // Notion limit: rich_text max 2000 chars per block, max 100 blocks
  // Split long checklists into multiple rich_text blocks
  const MAX_CHARS = 1900; // Leave buffer
  const checklistBlocks = [];

  if (checklistText.length <= MAX_CHARS) {
    checklistBlocks.push({ text: { content: checklistText } });
  } else {
    // Split by lines to avoid breaking in middle of task
    const lines = phase.checklist;
    let currentBlock = '';

    for (const line of lines) {
      const testBlock = currentBlock ? `${currentBlock}\n${line}` : line;

      if (testBlock.length > MAX_CHARS) {
        // Save current block and start new one
        if (currentBlock) {
          checklistBlocks.push({ text: { content: currentBlock } });
        }
        currentBlock = line;
      } else {
        currentBlock = testBlock;
      }
    }

    // Save last block
    if (currentBlock) {
      checklistBlocks.push({ text: { content: currentBlock } });
    }
  }

  // Build phase properties
  const properties = {
    Name: {
      title: [{ text: { content: phase.name } }]
    },
    Status: {
      select: { name: phase.status }
    },
    Project: {
      relation: [{ id: projectPageId }]
    },
    Checklist: {
      rich_text: checklistBlocks
    },
    'Phase Number': {
      number: phase.phaseNumber
    },
    'Total Tasks': {
      number: phase.totalTasks
    },
    'Completed Tasks': {
      number: phase.completedTasks
    }
  };

  try {
    if (existing) {
      // Check if phase has changed (status, checklist, or completion)
      const existingStatus = existing.properties?.Status?.select?.name;

      // Reconstruct existing checklist from all rich_text blocks
      const existingChecklistBlocks = existing.properties?.Checklist?.rich_text || [];
      const existingChecklist = existingChecklistBlocks
        .map(block => block.text?.content || '')
        .join('');

      const existingCompleted = existing.properties?.['Completed Tasks']?.number || 0;

      const statusChanged = existingStatus !== phase.status;
      const checklistChanged = existingChecklist !== checklistText;
      const completedChanged = existingCompleted !== phase.completedTasks;

      if (!statusChanged && !checklistChanged && !completedChanged) {
        // Phase unchanged, skip update
        return { action: 'skipped', phase: phase.name };
      }

      // Update existing phase (only if changed)
      await retryWithBackoff(async () => {
        return await notion.pages.update({
          page_id: existing.id,
          properties
        });
      }, 3, `Updating phase "${phase.name}"`);

      return { action: 'updated', phase: phase.name };
    } else {
      // Create new phase
      await retryWithBackoff(async () => {
        return await notion.pages.create({
          parent: { database_id: TASKS_DB },
          properties
        });
      }, 3, `Creating phase "${phase.name}"`);

      return { action: 'created', phase: phase.name };
    }
  } catch (error) {
    console.error(`❌ Failed to sync phase "${phase.name}":`, error.message);
    return { action: 'failed', phase: phase.name, error: error.message };
  }
}

/**
 * Sync all PHASES for a project (not individual tasks!)
 */
async function syncProjectTasks(phases, projectPageId) {
  console.log(`\n📋 Syncing ${phases.length} phases...`);

  // Get existing phases first
  const existingPhases = await findProjectTasks(projectPageId);

  const results = {
    created: [],
    updated: [],
    skipped: [],
    failed: []
  };

  // Sync phases one by one
  for (const phase of phases) {
    const result = await syncPhase(phase, projectPageId, existingPhases);

    if (result.action === 'created') {
      results.created.push(result.phase);
      console.log(`  ✅ Created: ${result.phase} (${phase.completedTasks}/${phase.totalTasks} tasks)`);
    } else if (result.action === 'updated') {
      results.updated.push(result.phase);
      console.log(`  🔄 Updated: ${result.phase} (${phase.completedTasks}/${phase.totalTasks} tasks)`);
    } else if (result.action === 'skipped') {
      results.skipped.push(result.phase);
      // Don't log skipped phases to keep output clean
    } else if (result.action === 'failed') {
      results.failed.push({ phase: result.phase, error: result.error });
      console.log(`  ❌ Failed: ${result.phase}`);
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

    // Step 2: Sync phases (not individual tasks!)
    const phaseResults = await syncProjectTasks(projectData.tasks, projectPage.id);

    // Step 3: Report results
    console.log(`\n📊 Sync Summary:`);
    console.log(`  Project: ${projectData.name} ✅`);
    console.log(`  Phases created: ${phaseResults.created.length}`);
    console.log(`  Phases updated: ${phaseResults.updated.length}`);
    console.log(`  Phases skipped: ${phaseResults.skipped.length} (unchanged)`);
    console.log(`  Phases failed: ${phaseResults.failed.length}`);

    if (phaseResults.failed.length > 0) {
      console.log(`\n⚠️  Failed phases:`);
      phaseResults.failed.forEach(f => {
        console.log(`    - ${f.phase}: ${f.error}`);
      });
    }

    return {
      success: phaseResults.failed.length === 0,
      project: projectData.name,
      projectPageId: projectPage.id,
      phasesCreated: phaseResults.created.length,
      phasesUpdated: phaseResults.updated.length,
      phasesFailed: phaseResults.failed.length,
      // Keep old names for backward compatibility
      tasksCreated: phaseResults.created.length,
      tasksUpdated: phaseResults.updated.length,
      tasksFailed: phaseResults.failed.length,
      results: phaseResults
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
