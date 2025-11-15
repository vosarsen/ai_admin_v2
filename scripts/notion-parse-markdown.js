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
 * Parse project tasks.md to extract task list with statuses
 * @param {string} filePath - Absolute path to tasks.md file
 * @returns {Array<object>} Array of task objects
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

  const tasks = [];
  const lines = content.split('\n');
  let currentPhase = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current phase/section from ## headings
    const phaseMatch = line.match(/^##\s+(.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // Edge Case 3: Malformed checkboxes - accept variations
    // Patterns: - [ ], - [], -[ ], - [x], - [X], - [~]
    const taskMatch = line.match(/^-\s*\[([x\sX~]?)\]\s*(.+)$/);
    if (taskMatch) {
      // Edge Case 7: Nested task lists - skip indented tasks
      if (/^\s{2,}/.test(line)) {
        continue;
      }

      const statusMarker = taskMatch[1].trim().toLowerCase();
      const taskName = taskMatch[2].trim();

      // Skip empty task names
      if (!taskName) continue;

      // Normalize status
      let status;
      if (statusMarker === 'x') {
        status = 'Done';
      } else if (statusMarker === '~') {
        status = 'In Progress';
      } else {
        status = 'Todo';
      }

      // Detect priority from keywords in task name
      let priority = 'Medium';
      if (/CRITICAL|URGENT|⚠️|🚨/i.test(taskName)) {
        priority = 'Critical';
      } else if (/HIGH|IMPORTANT|⭐/i.test(taskName)) {
        priority = 'High';
      } else if (/LOW|NICE TO HAVE/i.test(taskName)) {
        priority = 'Low';
      }

      // Extract estimated hours if present (e.g., [2h], [30min])
      let estimatedHours = null;
      const hoursMatch = taskName.match(/\[(\d+(?:\.\d+)?)\s*h(?:ours?)?\]/i);
      const minsMatch = taskName.match(/\[(\d+)\s*min(?:utes?)?\]/i);
      if (hoursMatch) {
        estimatedHours = parseFloat(hoursMatch[1]);
      } else if (minsMatch) {
        estimatedHours = parseFloat(minsMatch[1]) / 60;
      }

      tasks.push({
        name: taskName,
        status,
        priority,
        phase: currentPhase,
        estimatedHours,
        lineNumber: i + 1
      });
    }
  }

  // Edge Case 4: Duplicate task names - keep all (with line numbers to distinguish)
  // We DON'T deduplicate - each checkbox is a separate task even if names match

  console.info(`✅ Parsed ${tasks.length} tasks from ${path.basename(filePath)}`);
  return tasks;
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

  return {
    name: project.name,
    status: project.status,
    phase: project.phase,
    components: project.components,
    dates: project.dates,
    context: context,
    tasks: tasks,
    metadata: {
      projectPath,
      projectName,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'Done').length,
      inProgressTasks: tasks.filter(t => t.status === 'In Progress').length
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
