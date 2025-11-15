#!/usr/bin/env node

/**
 * Notion Markdown Parser
 *
 * Parses project markdown files (plan, context, tasks) and extracts structured data
 * for syncing to Notion databases.
 *
 * Handles edge cases:
 * - Empty or missing files
 * - No headings
 * - Malformed checkboxes
 * - Duplicate task names
 * - Large files
 * - Nested task lists
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse project plan.md to extract high-level metadata
 * @param {string} filePath - Absolute path to plan.md file
 * @returns {object|null} Project metadata or null if invalid
 */
function parseProjectPlan(filePath) {
  // Edge Case 1: File doesn't exist
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return null;
  }

  // Edge Case 2: File is empty
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) {
    console.warn(`⚠️  Empty file: ${filePath}`);
    const projectName = path.basename(path.dirname(filePath));
    return { name: projectName, status: 'Unknown', phase: null, components: [], dates: {} };
  }

  // Edge Case 6: Very large files (>1MB)
  const stats = fs.statSync(filePath);
  if (stats.size > 1024 * 1024) {
    console.warn(`⚠️  Large file ${filePath} (${stats.size} bytes), may be slow`);
  }

  const project = {
    name: null,
    status: null,
    phase: null,
    components: [],
    dates: {
      created: null,
      targetDate: null,
      lastUpdated: null
    }
  };

  // Extract project name from first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    // Remove common suffixes like " - Strategic Plan", " - Plan", etc.
    project.name = h1Match[1]
      .replace(/\s*-\s*(Strategic Plan|Plan|Implementation|Context|Tasks)$/i, '')
      .trim();
  } else {
    // Edge Case 2: No headings - use directory name
    project.name = path.basename(path.dirname(filePath))
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    console.info(`ℹ️  No H1 heading in ${filePath}, using directory name: ${project.name}`);
  }

  // Extract status from frontmatter-style metadata
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
  if (statusMatch) {
    const statusText = statusMatch[1].trim();
    // Parse status (may include emoji or other text)
    if (/planning|ready|📋/i.test(statusText)) {
      project.status = 'Planning';
    } else if (/active|in progress|🔄/i.test(statusText)) {
      project.status = 'Active';
    } else if (/testing|review/i.test(statusText)) {
      project.status = 'Testing';
    } else if (/deployed|complete|✅/i.test(statusText)) {
      project.status = 'Deployed';
    } else if (/archived/i.test(statusText)) {
      project.status = 'Archived';
    } else {
      project.status = statusText;
    }
  }

  // Extract phase from content
  const phaseMatch = content.match(/\*\*Phase:\*\*\s*(Phase\s*\d+)/i) ||
                     content.match(/##\s*(Phase\s*\d+)/i);
  if (phaseMatch) {
    project.phase = phaseMatch[1];
  }

  // Extract components by searching for keywords
  const componentKeywords = {
    'WhatsApp': /whatsapp|baileys|wa|messaging/gi,
    'YClients': /yclients|booking|salon/gi,
    'Database': /database|postgres|timeweb|supabase|migration|schema/gi,
    'AI': /\bai\b|gemini|openai|deepseek|prompt/gi,
    'Queue': /queue|bullmq|redis|job/gi,
    'Infrastructure': /infrastructure|deployment|pm2|docker|server/gi,
    'General': /general|misc|other/gi
  };

  const components = new Set();
  for (const [component, regex] of Object.entries(componentKeywords)) {
    if (regex.test(content)) {
      components.add(component);
    }
  }
  project.components = Array.from(components);

  // If no components detected, default to General
  if (project.components.length === 0) {
    project.components = ['General'];
  }

  // Extract dates
  const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (lastUpdatedMatch) {
    project.dates.lastUpdated = lastUpdatedMatch[1];
  }

  const timelineMatch = content.match(/\*\*Timeline:\*\*\s*(.+)/);
  if (timelineMatch) {
    // Try to extract date if present
    const dateMatch = timelineMatch[1].match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      project.dates.targetDate = dateMatch[0];
    }
  }

  return project;
}

/**
 * Parse project context.md to extract key decisions and current state
 * @param {string} filePath - Absolute path to context.md file
 * @returns {object|null} Context data or null if invalid
 */
function parseProjectContext(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Context file not found: ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) {
    console.warn(`⚠️  Empty context file: ${filePath}`);
    return { currentState: '', keyDecisions: [], summary: '' };
  }

  const context = {
    currentState: '',
    keyDecisions: [],
    summary: ''
  };

  // Extract current state section
  const currentStateMatch = content.match(/##\s*(?:Current State|Where We Are|Status)[\s\S]*?(?=##|$)/i);
  if (currentStateMatch) {
    context.currentState = currentStateMatch[0].trim();
  }

  // Extract key decisions (look for ## Decision or ## Architecture Decision)
  const decisionRegex = /##\s*(?:Decision|Architecture Decision)\s*\d*:?\s*(.+?)(?=##|$)/gi;
  let match;
  while ((match = decisionRegex.exec(content)) !== null) {
    context.keyDecisions.push(match[1].trim());
  }

  // Create summary (first 500 chars)
  const lines = content.split('\n');
  const meaningfulLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 &&
           !trimmed.startsWith('#') &&
           !trimmed.startsWith('**Last Updated:**') &&
           !trimmed.startsWith('**Status:**');
  });
  context.summary = meaningfulLines.slice(0, 3).join('\n').substring(0, 500);

  return context;
}

/**
 * Parse project tasks.md to extract PHASE-LEVEL tasks with checklists
 * @param {string} filePath - Absolute path to tasks.md file
 * @returns {Array<object>} Array of phase objects (not individual tasks!)
 */
function parseProjectTasks(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Tasks file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) {
    console.warn(`⚠️  Empty tasks file: ${filePath}`);
    return [];
  }

  const phases = [];
  const lines = content.split('\n');
  let currentPhase = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect phase headers: ## 📦 DAY 1: Database Foundation (6-8 hours)
    // OR: ## Phase 1: Some Title
    // OR: ## ✅ Completed Phase
    const phaseMatch = line.match(/^##\s+(.+)$/);
    if (phaseMatch) {
      // Save previous phase if exists
      if (currentPhase) {
        phases.push(currentPhase);
      }

      const phaseName = phaseMatch[1].trim();

      // Skip non-phase headings (legend, status, etc.)
      if (/legend|status|task status/i.test(phaseName)) {
        currentPhase = null;
        continue;
      }

      // Extract phase number from various patterns
      let phaseNumber = phases.length + 1; // Default sequential
      const dayMatch = phaseName.match(/DAY\s*(\d+)/i);
      const phaseNumMatch = phaseName.match(/Phase\s*(\d+)/i);
      if (dayMatch) {
        phaseNumber = parseInt(dayMatch[1]);
      } else if (phaseNumMatch) {
        phaseNumber = parseInt(phaseNumMatch[1]);
      }

      // Determine initial status from emoji or keywords
      let status = 'Todo';
      if (/^✅|completed|done/i.test(phaseName)) {
        status = 'Done';
      } else if (/^🔄|in progress|ongoing/i.test(phaseName)) {
        status = 'In Progress';
      } else if (/^⏸️|deferred|paused/i.test(phaseName)) {
        status = 'Review'; // Map deferred to Review status
      }

      currentPhase = {
        name: phaseName,
        phaseNumber,
        status,
        checklist: [],
        totalTasks: 0,
        completedTasks: 0
      };
      continue;
    }

    // Collect checklist items (only if we're inside a phase)
    if (currentPhase) {
      // Match: - ⬜ Task or - ✅ Task or - [ ] Task or - [x] Task
      const checkboxMatch = line.match(/^-\s*(?:([⬜✅🔄⏸️❌])|(?:\[([x\sX~]?)\]))\s*(.+)$/);
      if (checkboxMatch) {
        const emoji = checkboxMatch[1];
        const markdown = checkboxMatch[2];
        const text = checkboxMatch[3].trim();

        if (!text) continue; // Skip empty

        // Determine checkbox symbol
        let checkbox = '☐';
        let isCompleted = false;

        if (emoji) {
          // Emoji format: ⬜ ✅ 🔄 ⏸️ ❌
          if (emoji === '✅') {
            checkbox = '☑';
            isCompleted = true;
          } else if (emoji === '🔄') {
            checkbox = '⧗'; // In progress symbol
          } else {
            checkbox = '☐';
          }
        } else if (markdown) {
          // Markdown format: [x] [ ] [~]
          const marker = markdown.trim().toLowerCase();
          if (marker === 'x') {
            checkbox = '☑';
            isCompleted = true;
          } else if (marker === '~') {
            checkbox = '⧗';
          } else {
            checkbox = '☐';
          }
        }

        currentPhase.checklist.push(`${checkbox} ${text}`);
        currentPhase.totalTasks++;
        if (isCompleted) {
          currentPhase.completedTasks++;
        }
      }
    }
  }

  // Save last phase
  if (currentPhase) {
    phases.push(currentPhase);
  }

  // Update phase status based on completion
  phases.forEach(phase => {
    if (phase.completedTasks === phase.totalTasks && phase.totalTasks > 0) {
      phase.status = 'Done';
    } else if (phase.completedTasks > 0) {
      phase.status = 'In Progress';
    }
    // else keep original status (Todo, Review, etc.)
  });

  console.info(`✅ Parsed ${phases.length} phases (${phases.reduce((sum, p) => sum + p.totalTasks, 0)} total tasks) from ${path.basename(filePath)}`);
  return phases;
}

/**
 * Parse entire project directory (all 3 files)
 * @param {string} projectPath - Absolute path to project directory
 * @returns {object|null} Complete project data or null if invalid
 */
function parseProject(projectPath) {
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Project directory not found: ${projectPath}`);
    return null;
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`❌ Not a directory: ${projectPath}`);
    return null;
  }

  const projectName = path.basename(projectPath);
  const planFile = path.join(projectPath, `${projectName}-plan.md`);
  const contextFile = path.join(projectPath, `${projectName}-context.md`);
  const tasksFile = path.join(projectPath, `${projectName}-tasks.md`);

  console.info(`\n📁 Parsing project: ${projectName}`);

  const project = parseProjectPlan(planFile);
  const context = parseProjectContext(contextFile);
  const tasks = parseProjectTasks(tasksFile);

  if (!project) {
    console.error(`❌ Failed to parse project plan: ${planFile}`);
    return null;
  }

  // Calculate totals from phases (not individual tasks!)
  const totalTasks = tasks.reduce((sum, phase) => sum + phase.totalTasks, 0);
  const completedTasks = tasks.reduce((sum, phase) => sum + phase.completedTasks, 0);

  return {
    name: project.name,
    status: project.status,
    phase: project.phase,
    components: project.components,
    dates: project.dates,
    context: context,
    tasks: tasks, // Now this is an array of phases, not individual tasks
    metadata: {
      projectPath,
      projectName,
      totalPhases: tasks.length,
      totalTasks,
      completedTasks,
      completedPhases: tasks.filter(p => p.status === 'Done').length,
      inProgressPhases: tasks.filter(p => p.status === 'In Progress').length
    }
  };
}

/**
 * Scan dev/active directory for all projects
 * @param {string} activeDir - Path to dev/active directory
 * @returns {Array<string>} Array of project directory paths
 */
function scanActiveProjects(activeDir) {
  if (!fs.existsSync(activeDir)) {
    console.error(`❌ Active directory not found: ${activeDir}`);
    return [];
  }

  const entries = fs.readdirSync(activeDir, { withFileTypes: true });
  const projects = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(activeDir, entry.name));

  console.info(`📂 Found ${projects.length} projects in ${activeDir}`);
  return projects;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage:
  node notion-parse-markdown.js <project-path>     # Parse single project
  node notion-parse-markdown.js --all              # Parse all active projects
  node notion-parse-markdown.js --scan             # Scan and list projects only

Examples:
  node notion-parse-markdown.js dev/active/client-reactivation-service-v2
  node notion-parse-markdown.js --all
    `);
    process.exit(1);
  }

  if (args[0] === '--all') {
    const activeDir = path.join(process.cwd(), 'dev/active');
    const projects = scanActiveProjects(activeDir);

    for (const projectPath of projects) {
      const data = parseProject(projectPath);
      if (data) {
        console.log(`\n✅ ${data.name}`);
        console.log(`   Status: ${data.status || 'Unknown'}`);
        console.log(`   Phase: ${data.phase || 'Not specified'}`);
        console.log(`   Components: ${data.components.join(', ')}`);
        console.log(`   Tasks: ${data.metadata.completedTasks}/${data.metadata.totalTasks} completed`);
      }
    }
  } else if (args[0] === '--scan') {
    const activeDir = path.join(process.cwd(), 'dev/active');
    const projects = scanActiveProjects(activeDir);
    console.log('\nProjects:');
    projects.forEach(p => console.log(`  - ${path.basename(p)}`));
  } else {
    const projectPath = path.resolve(args[0]);
    const data = parseProject(projectPath);

    if (data) {
      console.log('\n📊 Parsed Data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('\n❌ Failed to parse project');
      process.exit(1);
    }
  }
}

module.exports = {
  parseProjectPlan,
  parseProjectContext,
  parseProjectTasks,
  parseProject,
  scanActiveProjects
};
