#!/usr/bin/env node
/**
 * GlitchTip Error Investigation Helper
 *
 * Automates error investigation by:
 * 1. Fetching error details from GlitchTip API
 * 2. Parsing stack trace for affected files
 * 3. Finding related files in codebase (ripgrep)
 * 4. Getting recent git commits for those files
 * 5. Posting investigation results as comment
 *
 * Usage:
 *   export GLITCHTIP_TOKEN=your-token
 *   node scripts/investigate-error.js <issue-id>
 *
 * Example:
 *   node scripts/investigate-error.js 123
 */

const GlitchTipAPI = require('./lib/glitchtip-api');
const { execSync } = require('child_process');
const path = require('path');

// Configuration
const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_TOKEN;
const ORG_SLUG = process.env.GLITCHTIP_ORG_SLUG || 'admin-ai';
const MAX_FILES = 10;
const MAX_COMMITS_PER_FILE = 5;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Parse stack trace to extract file paths and function names
 */
function parseStackTrace(stackTrace) {
  if (!stackTrace) return [];

  const lines = stackTrace.split('\n');
  const frames = [];

  for (const line of lines) {
    // Match patterns like:
    // at functionName (/path/to/file.js:123:45)
    // at /path/to/file.js:123:45
    const match = line.match(/at\s+(?:(\w+)\s+)?\(?([^:)]+):(\d+):(\d+)\)?/);

    if (match) {
      const [, functionName, filePath, lineNumber, columnNumber] = match;

      // Skip node_modules and node internals
      if (filePath.includes('node_modules') || filePath.includes('node:')) {
        continue;
      }

      frames.push({
        functionName: functionName || '<anonymous>',
        filePath: filePath.trim(),
        lineNumber: parseInt(lineNumber),
        columnNumber: parseInt(columnNumber)
      });
    }
  }

  return frames;
}

/**
 * Search codebase for files related to the error
 */
function findRelatedFiles(keyword, maxResults = MAX_FILES) {
  try {
    // Find ripgrep binary (different paths on macOS and Linux)
    let rgPath = 'rg'; // Default: use from PATH
    try {
      rgPath = execSync('which rg', { encoding: 'utf-8' }).trim();
    } catch (e) {
      // Try common paths
      const paths = ['/usr/bin/rg', '/usr/local/bin/rg', '/opt/homebrew/bin/rg'];
      for (const p of paths) {
        try {
          execSync(`test -x ${p}`, { encoding: 'utf-8' });
          rgPath = p;
          break;
        } catch (e) {
          continue;
        }
      }
    }

    // Use ripgrep to find files containing the keyword
    const result = execSync(
      `${rgPath} -l "${keyword}" --max-count 1`,
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB
      }
    );

    const files = result
      .split('\n')
      .filter(f => f && !f.includes('node_modules'))
      .slice(0, maxResults);

    return files;
  } catch (error) {
    // ripgrep returns exit code 1 if no matches found
    if (error.status === 1) {
      return [];
    }
    console.error(`${colors.red}Error searching files:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Get recent git commits for a file
 */
function getRecentCommits(filePath, maxCommits = MAX_COMMITS_PER_FILE) {
  try {
    const result = execSync(
      `git log -${maxCommits} --pretty=format:"%h|%s|%an|%ar" -- "${filePath}"`,
      {
        encoding: 'utf-8',
        cwd: process.cwd()
      }
    );

    if (!result) return [];

    return result.split('\n').map(line => {
      const [hash, message, author, time] = line.split('|');
      return { hash, message, author, time };
    });
  } catch (error) {
    console.error(`${colors.red}Error getting commits:${colors.reset}`, error.message);
    return [];
  }
}

/**
 * Format investigation results as markdown
 */
function formatMarkdown(issue, investigation) {
  const { stackFrames, relatedFiles, commitsMap, searchKeyword } = investigation;

  let markdown = '## 🤖 Automated Investigation\n\n';
  markdown += `**Issue:** ${issue.title}\n`;
  markdown += `**Level:** ${issue.level} | **Count:** ${issue.count}\n\n`;

  // Stack Trace Summary
  if (stackFrames.length > 0) {
    markdown += '### 📍 Stack Trace\n\n';
    markdown += '**Primary Error Location:**\n';
    const primary = stackFrames[0];
    markdown += `- File: \`${primary.filePath}\`\n`;
    markdown += `- Function: \`${primary.functionName}\`\n`;
    markdown += `- Line: ${primary.lineNumber}:${primary.columnNumber}\n\n`;

    if (stackFrames.length > 1) {
      markdown += '**Call Stack:**\n';
      stackFrames.slice(1, 4).forEach((frame, i) => {
        markdown += `${i + 2}. \`${frame.functionName}\` in \`${path.basename(frame.filePath)}:${frame.lineNumber}\`\n`;
      });
      markdown += '\n';
    }
  }

  // Related Files
  if (relatedFiles.length > 0) {
    markdown += '### 📂 Related Files\n\n';
    markdown += `Found ${relatedFiles.length} file(s) containing "${searchKeyword}":\n\n`;
    relatedFiles.forEach(file => {
      markdown += `- \`${file}\`\n`;
    });
    markdown += '\n';
  } else {
    markdown += '### 📂 Related Files\n\n';
    markdown += `No files found containing "${searchKeyword}"\n\n`;
  }

  // Recent Commits
  if (Object.keys(commitsMap).length > 0) {
    markdown += '### 📝 Recent Changes\n\n';
    Object.entries(commitsMap).forEach(([file, commits]) => {
      if (commits.length > 0) {
        markdown += `**${path.basename(file)}:**\n`;
        commits.forEach(commit => {
          markdown += `- \`${commit.hash}\` ${commit.message} (${commit.author}, ${commit.time})\n`;
        });
        markdown += '\n';
      }
    });
  }

  // Footer
  markdown += '---\n';
  markdown += `*Investigation completed at ${new Date().toISOString()}*\n`;
  markdown += '*Generated by GlitchTip Investigation Helper*\n';

  return markdown;
}

/**
 * Main investigation function
 */
async function investigateError(issueId) {
  console.log(`\n${colors.bright}🔍 GlitchTip Error Investigation${colors.reset}\n`);
  console.log(`Issue ID: ${colors.cyan}${issueId}${colors.reset}`);
  console.log(`Organization: ${colors.cyan}${ORG_SLUG}${colors.reset}\n`);

  // Initialize API client
  const client = new GlitchTipAPI(GLITCHTIP_URL, API_TOKEN);

  try {
    // Step 1: Fetch issue details
    console.log(`${colors.yellow}[1/5]${colors.reset} Fetching issue details...`);
    const issue = await client.getIssue(ORG_SLUG, issueId);
    console.log(`${colors.green}✓${colors.reset} Issue: "${issue.title}"`);
    console.log(`      Level: ${issue.level}, Count: ${issue.count}, Status: ${issue.status}\n`);

    // Step 2: Parse stack trace
    console.log(`${colors.yellow}[2/5]${colors.reset} Parsing stack trace...`);
    const stackFrames = parseStackTrace(issue.metadata?.stack_trace || issue.culprit);

    if (stackFrames.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Found ${stackFrames.length} stack frame(s)`);
      console.log(`      Primary: ${stackFrames[0].filePath}:${stackFrames[0].lineNumber}\n`);
    } else {
      console.log(`${colors.dim}○${colors.reset} No parseable stack trace found\n`);
    }

    // Step 3: Find related files
    console.log(`${colors.yellow}[3/5]${colors.reset} Searching codebase...`);

    // Determine search keyword
    let searchKeyword = '';
    if (stackFrames.length > 0) {
      searchKeyword = path.basename(stackFrames[0].filePath, path.extname(stackFrames[0].filePath));
    } else {
      // Extract from title (e.g., "WhatsApp session error" -> "WhatsApp")
      const words = issue.title.split(/\s+/);
      searchKeyword = words.find(w => w.length > 3 && !/^(error|failed|cannot)$/i.test(w)) || words[0];
    }

    const relatedFiles = findRelatedFiles(searchKeyword);

    if (relatedFiles.length > 0) {
      console.log(`${colors.green}✓${colors.reset} Found ${relatedFiles.length} related file(s)`);
      relatedFiles.slice(0, 3).forEach(f => console.log(`      - ${f}`));
      if (relatedFiles.length > 3) console.log(`      ... and ${relatedFiles.length - 3} more`);
      console.log('');
    } else {
      console.log(`${colors.dim}○${colors.reset} No related files found for "${searchKeyword}"\n`);
    }

    // Step 4: Get recent commits
    console.log(`${colors.yellow}[4/5]${colors.reset} Getting recent commits...`);
    const commitsMap = {};
    const filesToCheck = stackFrames.length > 0
      ? [stackFrames[0].filePath, ...relatedFiles.slice(0, 3)]
      : relatedFiles.slice(0, 5);

    for (const file of filesToCheck) {
      const commits = getRecentCommits(file);
      if (commits.length > 0) {
        commitsMap[file] = commits;
      }
    }

    const totalCommits = Object.values(commitsMap).reduce((sum, commits) => sum + commits.length, 0);
    console.log(`${colors.green}✓${colors.reset} Found ${totalCommits} commit(s) across ${Object.keys(commitsMap).length} file(s)\n`);

    // Step 5: Format and post comment
    console.log(`${colors.yellow}[5/5]${colors.reset} Posting investigation comment...`);
    const investigation = { stackFrames, relatedFiles, commitsMap, searchKeyword };
    const markdown = formatMarkdown(issue, investigation);

    await client.addComment(ORG_SLUG, issueId, markdown);
    console.log(`${colors.green}✓${colors.reset} Comment posted successfully!\n`);

    // Summary
    console.log(`${colors.bright}📊 Investigation Summary${colors.reset}`);
    console.log(`   Stack frames: ${stackFrames.length}`);
    console.log(`   Related files: ${relatedFiles.length}`);
    console.log(`   Recent commits: ${totalCommits}`);
    console.log(`   Comment: Posted\n`);

    console.log(`${colors.green}✓ Investigation complete!${colors.reset}`);
    console.log(`${colors.dim}View on GlitchTip: ${GLITCHTIP_URL.replace('8080', '9090')}/issues/${issueId}${colors.reset}\n`);

    return { success: true, investigation };
  } catch (error) {
    console.error(`\n${colors.red}✗ Investigation failed:${colors.reset}`, error.message);
    throw error;
  }
}

// CLI Entry Point
if (require.main === module) {
  const issueId = process.argv[2];

  if (!API_TOKEN) {
    console.error(`${colors.red}✗ GLITCHTIP_TOKEN not set${colors.reset}`);
    console.error('Export token: export GLITCHTIP_TOKEN=your-token');
    process.exit(1);
  }

  if (!issueId) {
    console.error(`${colors.red}✗ Issue ID required${colors.reset}`);
    console.error('Usage: node scripts/investigate-error.js <issue-id>');
    process.exit(1);
  }

  investigateError(issueId)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(`${colors.red}Fatal error:${colors.reset}`, error);
      process.exit(1);
    });
}

module.exports = { investigateError, parseStackTrace, findRelatedFiles, getRecentCommits };
