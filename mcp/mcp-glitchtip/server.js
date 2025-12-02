#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '.env'), override: true });

// ============================================
// CONSTANTS
// ============================================
const API_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_EVENTS_LIMIT = 10;

// Configuration
const GLITCHTIP_URL = process.env.GLITCHTIP_URL || 'https://glitchtip.adminai.tech';
const GLITCHTIP_API_TOKEN = process.env.GLITCHTIP_API_TOKEN;
const GLITCHTIP_ORG_SLUG = process.env.GLITCHTIP_ORG_SLUG || 'admin-ai';

// Zod schemas for reuse
const issueIdSchema = z.string()
  .regex(/^\d+$/, 'Issue ID must be numeric')
  .describe('Issue ID from get_issues');

// Validate required environment variables
if (!GLITCHTIP_API_TOKEN) {
  console.error('ERROR: GLITCHTIP_API_TOKEN is required');
  console.error('Create a token at: ' + GLITCHTIP_URL + '/profile/auth-tokens');
  process.exit(1);
}

// Cache for organization data
let cachedOrgSlug = GLITCHTIP_ORG_SLUG;

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(status) {
  return status === 429 || status >= 500;
}

/**
 * Make authenticated request to GlitchTip API with retry logic
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries remaining
 */
async function makeGlitchTipRequest(endpoint, options = {}, retries = MAX_RETRIES) {
  const url = `${GLITCHTIP_URL}/api/0${endpoint}`;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${GLITCHTIP_API_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        if (attempt < retries) {
          console.error(`Rate limited. Retrying after ${retryAfter}s (attempt ${attempt}/${retries})`);
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new Error(`GlitchTip API rate limited (429). Retry after ${retryAfter}s`);
      }

      // Handle server errors (5xx) with exponential backoff
      if (response.status >= 500 && attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.error(`Server error (${response.status}). Retrying in ${delay}ms (attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`GlitchTip API error (${response.status}): ${error.detail || JSON.stringify(error)}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.error(`Request timeout. Retrying in ${delay}ms (attempt ${attempt}/${retries})`);
          await sleep(delay);
          continue;
        }
        throw new Error(`GlitchTip API request timed out after ${API_TIMEOUT_MS / 1000} seconds (${retries} attempts)`);
      }

      // Network errors - retry with backoff
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message.includes('fetch failed')) {
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.error(`Network error. Retrying in ${delay}ms (attempt ${attempt}/${retries})`);
          await sleep(delay);
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Format stack trace for readable terminal output
 */
function formatStackTrace(frames) {
  if (!frames || !Array.isArray(frames)) return 'No stack trace available';

  return frames.reverse().map(f =>
    `  at ${f.function || '<anonymous>'} (${f.filename || 'unknown'}:${f.lineno || '?'}:${f.colno || '?'})`
  ).join('\n');
}

/**
 * Format issue for display
 */
function formatIssue(issue) {
  const status = issue.status === 'unresolved' ? '!' :
                 issue.status === 'resolved' ? '\u2713' : '~';
  const level = issue.level === 'error' ? 'ERR' :
                issue.level === 'warning' ? 'WRN' : 'INF';

  return `[${status}] ${level} #${issue.id} - ${issue.title}
   Count: ${issue.count} | First: ${new Date(issue.firstSeen).toLocaleDateString()} | Last: ${new Date(issue.lastSeen).toLocaleDateString()}
   Project: ${issue.project?.name || 'Unknown'}`;
}

// Create MCP server
const server = new McpServer({
  name: 'glitchtip-mcp',
  version: '1.0.0',
  description: 'MCP Server for GlitchTip error tracking'
});

// ============================================
// HEALTH CHECK
// ============================================
server.registerTool("health_check",
  {
    title: "Health Check",
    description: "Test GlitchTip API connectivity and get basic info",
    inputSchema: {}
  },
  async () => {
    const start = Date.now();
    const orgs = await makeGlitchTipRequest('/organizations/');
    const elapsed = Date.now() - start;

    cachedOrgSlug = orgs[0]?.slug || cachedOrgSlug;

    return {
      content: [{
        type: "text",
        text: `GlitchTip API connected
Organizations: ${orgs.length}
Active org: ${cachedOrgSlug}
Response time: ${elapsed}ms
URL: ${GLITCHTIP_URL}`
      }]
    };
  }
);

// ============================================
// READ OPERATIONS
// ============================================

server.registerTool("get_organizations",
  {
    title: "Get Organizations",
    description: "List all organizations in GlitchTip",
    inputSchema: {}
  },
  async () => {
    const orgs = await makeGlitchTipRequest('/organizations/');

    const formatted = orgs.map(org =>
      `${org.name} (${org.slug})
   ID: ${org.id} | Status: ${org.status?.name || 'active'}
   Created: ${new Date(org.dateCreated).toLocaleDateString()}`
    ).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Organizations (${orgs.length}):\n\n${formatted}`
      }]
    };
  }
);

server.registerTool("get_projects",
  {
    title: "Get Projects",
    description: "List all projects in GlitchTip",
    inputSchema: {}
  },
  async () => {
    const projects = await makeGlitchTipRequest('/projects/');

    const formatted = projects.map(p =>
      `${p.name} (${p.slug})
   ID: ${p.id} | Platform: ${p.platform || 'unknown'}
   Organization: ${p.organization?.name || 'Unknown'}`
    ).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Projects (${projects.length}):\n\n${formatted}`
      }]
    };
  }
);

server.registerTool("get_issues",
  {
    title: "Get Issues",
    description: "List issues/errors from GlitchTip with optional filtering",
    inputSchema: {
      status: z.enum(['unresolved', 'resolved', 'ignored'])
        .optional()
        .describe('Filter by status (default: all)'),
      level: z.enum(['error', 'warning', 'info', 'debug'])
        .optional()
        .describe('Filter by severity level'),
      query: z.string()
        .optional()
        .describe('Search query (e.g., "is:unresolved level:error")'),
      limit: z.number()
        .optional()
        .default(DEFAULT_PAGE_SIZE)
        .describe(`Maximum number of issues to return (default: ${DEFAULT_PAGE_SIZE})`)
    }
  },
  async ({ status, level, query, limit }) => {
    // Build query string with server-side pagination
    const params = new URLSearchParams();
    params.set('limit', String(limit));

    // Build combined query
    let q = query || '';
    if (status) {
      q += ` is:${status}`;
    }
    if (level) {
      q += ` level:${level}`;
    }
    if (q.trim()) {
      params.set('query', q.trim());
    }

    const endpoint = `/organizations/${cachedOrgSlug}/issues/?${params.toString()}`;
    const issues = await makeGlitchTipRequest(endpoint);

    // Count by status (from returned results)
    const unresolvedCount = issues.filter(i => i.status === 'unresolved').length;
    const resolvedCount = issues.filter(i => i.status === 'resolved').length;
    const errorCount = issues.filter(i => i.level === 'error').length;
    const warningCount = issues.filter(i => i.level === 'warning').length;

    const formatted = issues.map(formatIssue).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Issues Summary:
Returned: ${issues.length} (limit: ${limit})
Unresolved: ${unresolvedCount} | Resolved: ${resolvedCount}
Errors: ${errorCount} | Warnings: ${warningCount}

${formatted || 'No issues found'}`
      }]
    };
  }
);

server.registerTool("get_issue_details",
  {
    title: "Get Issue Details",
    description: "Get detailed information about a specific issue including stack trace",
    inputSchema: {
      issue_id: issueIdSchema
    }
  },
  async ({ issue_id }) => {
    const issue = await makeGlitchTipRequest(`/issues/${issue_id}/`);

    // Extract stack trace if available
    let stackTrace = 'No stack trace available';
    if (issue.entries) {
      const exception = issue.entries.find(e => e.type === 'exception');
      if (exception?.data?.values?.[0]?.stacktrace?.frames) {
        stackTrace = formatStackTrace(exception.data.values[0].stacktrace.frames);
      }
    }

    // Format metadata
    const metadata = issue.metadata || {};
    const metadataStr = Object.keys(metadata).length > 0
      ? Object.entries(metadata).map(([k, v]) => `  ${k}: ${v}`).join('\n')
      : '  None';

    return {
      content: [{
        type: "text",
        text: `Issue #${issue.id}: ${issue.title}

Status: ${issue.status} | Level: ${issue.level} | Type: ${issue.type}
Project: ${issue.project?.name || 'Unknown'}
Short ID: ${issue.shortId}

First seen: ${new Date(issue.firstSeen).toLocaleString()}
Last seen: ${new Date(issue.lastSeen).toLocaleString()}
Event count: ${issue.count}

Metadata:
${metadataStr}

Culprit: ${issue.culprit || 'Unknown'}

Stack Trace:
${stackTrace}`
      }]
    };
  }
);

server.registerTool("get_issue_events",
  {
    title: "Get Issue Events",
    description: "List recent events for a specific issue",
    inputSchema: {
      issue_id: issueIdSchema,
      limit: z.number()
        .optional()
        .default(DEFAULT_EVENTS_LIMIT)
        .describe(`Maximum events to return (default: ${DEFAULT_EVENTS_LIMIT})`)
    }
  },
  async ({ issue_id, limit }) => {
    const events = await makeGlitchTipRequest(`/issues/${issue_id}/events/`);

    const limitedEvents = events.slice(0, limit);

    const formatted = limitedEvents.map((e, i) =>
      `Event ${i + 1}:
   ID: ${e.eventID || e.id}
   Time: ${new Date(e.dateCreated || e.timestamp).toLocaleString()}
   Message: ${e.message || e.title || 'No message'}`
    ).join('\n\n');

    return {
      content: [{
        type: "text",
        text: `Events for Issue #${issue_id} (showing ${limitedEvents.length} of ${events.length}):

${formatted || 'No events found'}`
      }]
    };
  }
);

// ============================================
// WRITE OPERATIONS
// ============================================

server.registerTool("resolve_issue",
  {
    title: "Resolve Issue",
    description: "Mark an issue as resolved",
    inputSchema: {
      issue_id: issueIdSchema
    }
  },
  async ({ issue_id }) => {
    const result = await makeGlitchTipRequest(`/issues/${issue_id}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'resolved' })
    });

    return {
      content: [{
        type: "text",
        text: `Issue #${issue_id} marked as RESOLVED
Title: ${result.title}`
      }]
    };
  }
);

server.registerTool("ignore_issue",
  {
    title: "Ignore Issue",
    description: "Mark an issue as ignored (won't fix)",
    inputSchema: {
      issue_id: issueIdSchema
    }
  },
  async ({ issue_id }) => {
    const result = await makeGlitchTipRequest(`/issues/${issue_id}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ignored' })
    });

    return {
      content: [{
        type: "text",
        text: `Issue #${issue_id} marked as IGNORED
Title: ${result.title}`
      }]
    };
  }
);

server.registerTool("unresolve_issue",
  {
    title: "Unresolve Issue",
    description: "Reopen a resolved or ignored issue",
    inputSchema: {
      issue_id: issueIdSchema
    }
  },
  async ({ issue_id }) => {
    const result = await makeGlitchTipRequest(`/issues/${issue_id}/`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'unresolved' })
    });

    return {
      content: [{
        type: "text",
        text: `Issue #${issue_id} marked as UNRESOLVED
Title: ${result.title}`
      }]
    };
  }
);

// ============================================
// STATISTICS
// ============================================

server.registerTool("get_project_summary",
  {
    title: "Get Project Summary",
    description: "Get a quick health overview of all projects",
    inputSchema: {}
  },
  async () => {
    const projects = await makeGlitchTipRequest('/projects/');
    const issues = await makeGlitchTipRequest(`/organizations/${cachedOrgSlug}/issues/`);

    // Group issues by project
    const issuesByProject = {};
    for (const issue of issues) {
      const projectId = issue.project?.id || 'unknown';
      if (!issuesByProject[projectId]) {
        issuesByProject[projectId] = { total: 0, unresolved: 0, errors: 0, warnings: 0 };
      }
      issuesByProject[projectId].total++;
      if (issue.status === 'unresolved') issuesByProject[projectId].unresolved++;
      if (issue.level === 'error') issuesByProject[projectId].errors++;
      if (issue.level === 'warning') issuesByProject[projectId].warnings++;
    }

    const formatted = projects.map(p => {
      const stats = issuesByProject[p.id] || { total: 0, unresolved: 0, errors: 0, warnings: 0 };
      const health = stats.unresolved === 0 ? 'Healthy' :
                     stats.unresolved < 5 ? 'Attention' : 'Critical';

      return `${p.name}
   Health: ${health}
   Issues: ${stats.total} total, ${stats.unresolved} unresolved
   Breakdown: ${stats.errors} errors, ${stats.warnings} warnings`;
    }).join('\n\n');

    // Overall summary
    const totalUnresolved = Object.values(issuesByProject).reduce((sum, p) => sum + p.unresolved, 0);
    const totalErrors = Object.values(issuesByProject).reduce((sum, p) => sum + p.errors, 0);

    return {
      content: [{
        type: "text",
        text: `Project Health Summary
Overall: ${totalUnresolved} unresolved issues, ${totalErrors} errors

${formatted}`
      }]
    };
  }
);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down GlitchTip MCP server...');
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GlitchTip MCP Server started successfully');
  console.error(`Connected to: ${GLITCHTIP_URL}`);
  console.error(`Organization: ${cachedOrgSlug}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
