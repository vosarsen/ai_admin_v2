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

  // Extract components by searching for keywords (PRIORITY ORDER - max 2)
  const componentKeywords = {
    'WhatsApp': /whatsapp|baileys|wa|messaging/gi,
    'AI': /\bai\b|gemini|openai|deepseek|prompt/gi,
    'Database': /database|postgres|timeweb|supabase|migration|schema/gi,
    'YClients': /yclients|booking|salon/gi,
    'Queue': /queue|bullmq|redis|job/gi,
    'Infrastructure': /infrastructure|deployment|pm2|docker|server/gi,
    'General': /general|misc|other/gi
  };

  const components = [];
  for (const [component, regex] of Object.entries(componentKeywords)) {
    if (regex.test(content)) {
      components.push(component);
      if (components.length === 2) break; // Max 2 components
    }
  }

  project.components = components;

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
 * Extract full plan content BEFORE Implementation Phases section
 * This includes Executive Summary, Architecture, Flows, etc.
 * Used for comprehensive page content (development diary style)
 *
 * @param {string} planPath - Absolute path to plan.md file
 * @returns {string|null} - Raw markdown content before Implementation Phases, or null if not found
 */
function extractPlanContent(planPath) {
  if (!fs.existsSync(planPath)) {
    console.warn(`⚠️  Plan file not found: ${planPath}`);
    return null;
  }

  const content = fs.readFileSync(planPath, 'utf8');
  if (content.trim().length === 0) {
    console.warn(`⚠️  Empty plan file: ${planPath}`);
    return null;
  }

  // Find the line with "## 📐 Implementation Phases" or "## Implementation Phases"
  const lines = content.split('\n');
  const phaseLineIndex = lines.findIndex(line =>
    /^##\s*📐?\s*Implementation Phases/i.test(line)
  );

  if (phaseLineIndex === -1) {
    // If no Implementation Phases section found, return everything except first line (title)
    console.warn(`⚠️  No Implementation Phases section found in plan.md, using all content`);
    return lines.slice(1).join('\n').trim();
  }

  // Return everything BEFORE Implementation Phases (excluding title line)
  return lines.slice(1, phaseLineIndex).join('\n').trim();
}

/**
 * Extract project summary for team management view (Phase 2.0)
 * Extracts: What is this? Why needed? Timeline. Risk Level.
 *
 * @param {string} planPath - Absolute path to plan.md file
 * @param {string} contextPath - Absolute path to context.md file
 * @returns {object} { summary, businessValue, timeline, risk }
 */
function extractProjectSummary(planPath, contextPath) {
  const summary = {
    summary: null,          // What is this? (1-2 sentences)
    businessValue: null,    // Why needed? (1-2 sentences)
    timeline: null,         // Time estimate (e.g., "4 days", "2-3 weeks")
    risk: 'Medium'          // Risk level: Low/Medium/High
  };

  // Read plan.md
  let planContent = '';
  if (fs.existsSync(planPath)) {
    planContent = fs.readFileSync(planPath, 'utf8');
  }

  // Read context.md
  let contextContent = '';
  if (fs.existsSync(contextPath)) {
    contextContent = fs.readFileSync(contextPath, 'utf8');
  }

  // Extract "What is this?" - from Executive Summary > Mission or first paragraph after ## Executive Summary
  const executiveSummaryMatch = planContent.match(/##\s*📋?\s*Executive Summary[\s\S]*?###\s*Mission\s*([\s\S]*?)(?=###|##|$)/i);
  if (executiveSummaryMatch) {
    const missionText = executiveSummaryMatch[1].trim();
    // Extract first 1-2 sentences (up to 200 chars)
    const sentences = missionText.split(/\.\s+/);
    summary.summary = sentences.slice(0, 2).join('. ').substring(0, 200).trim();
    if (!summary.summary.endsWith('.')) {
      summary.summary += '.';
    }
  } else {
    // Fallback: Try "What We're Building" from context.md
    const whatBuildingMatch = contextContent.match(/###\s*What We're Building\s*([\s\S]*?)(?=###|##|$)/i);
    if (whatBuildingMatch) {
      const text = whatBuildingMatch[1].trim();
      const sentences = text.split(/\.\s+/);
      summary.summary = sentences.slice(0, 2).join('. ').substring(0, 200).trim();
      if (!summary.summary.endsWith('.')) {
        summary.summary += '.';
      }
    }
  }

  // Extract "Why needed?" - Priority order: Success Metrics > Key Requirements > Business Value
  let successMetricsMatch = planContent.match(/###\s*Success Metrics\s*([\s\S]*?)(?=###|##|$)/i);

  if (!successMetricsMatch) {
    // Try Key Requirements
    successMetricsMatch = planContent.match(/###\s*Key Requirements\s*\(MVP\)\s*([\s\S]*?)(?=###|##|$)/i);
  }

  if (successMetricsMatch) {
    const metricsText = successMetricsMatch[1].trim();
    // Extract first bullet point or first sentence
    const bulletMatch = metricsText.match(/^-\s*\*\*([^*]+)\*\*:?\s*(.+?)$/m);
    if (bulletMatch) {
      // Found bullet: "- **Conversion Rate:** 15-20%..."
      summary.businessValue = `${bulletMatch[1]}: ${bulletMatch[2]}`.substring(0, 200).trim();
    } else {
      // Extract first 1-2 sentences
      const sentences = metricsText.split(/\.\s+/);
      summary.businessValue = sentences.slice(0, 2).join('. ').substring(0, 200).trim();
      if (!summary.businessValue.endsWith('.')) {
        summary.businessValue += '.';
      }
    }
  } else {
    // Fallback: Try MVP Priorities from context.md
    const mvpPrioritiesMatch = contextContent.match(/###\s*MVP Priorities\s*([\s\S]*?)(?=###|##|$)/i);
    if (mvpPrioritiesMatch) {
      const text = mvpPrioritiesMatch[1].trim();
      // Extract first list item
      const listItemMatch = text.match(/^\d+\.\s*[🥇🥈🥉]*\s*\*\*(.+?)\*\*/m);
      if (listItemMatch) {
        summary.businessValue = listItemMatch[1].trim();
      }
    }
  }

  // Extract Timeline - from **Timeline:** metadata
  const timelineMatch = planContent.match(/\*\*Timeline:\*\*\s*(.+)/);
  if (timelineMatch) {
    let timeline = timelineMatch[1].trim();

    // Clean up (remove dates)
    timeline = timeline.replace(/\(\d{4}-\d{2}-\d{2}.*?\)/g, '').trim();

    // Format: "4 days" or "2-3 weeks" => keep short
    // If contains hours, format as "X days (Yh)"
    const daysMatch = timeline.match(/(\d+(?:-\d+)?)\s*days?/i);
    const hoursMatch = timeline.match(/(\d+(?:\.\d+)?)\s*hours?/i);

    if (daysMatch && hoursMatch) {
      // Both days and hours: "4 days (32h)"
      summary.timeline = `${daysMatch[1]} days (${Math.round(parseFloat(hoursMatch[1]))}h)`;
    } else if (daysMatch) {
      // Only days: "4 days"
      summary.timeline = `${daysMatch[1]} days`;
    } else if (hoursMatch) {
      // Only hours: "8h"
      summary.timeline = `${Math.round(parseFloat(hoursMatch[1]))}h`;
    } else {
      // Keep original if can't parse
      summary.timeline = timeline.substring(0, 30); // Max 30 chars
    }
  }

  // Extract Risk Level - from **Risk Level:** metadata
  const riskMatch = planContent.match(/\*\*Risk Level:\*\*\s*[🟢🟡🔴]*\s*(Low|Medium|High)/i);
  if (riskMatch) {
    summary.risk = riskMatch[1];
  } else if (planContent.match(/\*\*Complexity:\*\*\s*(Low|Medium|High)/i)) {
    // Fallback: Use Complexity as Risk proxy
    const complexityMatch = planContent.match(/\*\*Complexity:\*\*\s*(Low|Medium|High)/i);
    summary.risk = complexityMatch[1];
  }

  return summary;
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

  // Extract project summary for team management view (Phase 2.0)
  const projectSummary = extractProjectSummary(planFile, contextFile);

  // Extract full plan content for comprehensive page (development diary style)
  const planContent = extractPlanContent(planFile);

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
    summary: projectSummary, // NEW: Project summary for team management
    planContent: planContent, // NEW: Full plan content (before Implementation Phases)
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
  scanActiveProjects,
  extractProjectSummary, // NEW: For Phase 2.0
  extractPlanContent     // NEW: For development diary style page content
};
