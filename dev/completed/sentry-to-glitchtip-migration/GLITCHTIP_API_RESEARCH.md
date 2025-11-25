# GlitchTip API Research: Capabilities & Practical Use Cases

**Research Date:** 2025-11-24
**Status:** ✅ COMPLETE
**Purpose:** Evaluate GlitchTip API for AI Admin v2 error tracking automation

---

## Executive Summary

**Key Findings:**

1. **Sentry API Compatibility**: GlitchTip is Sentry API compatible, meaning Sentry API documentation and clients work with GlitchTip
2. **Authentication**: Simple Bearer token auth via Profile > Auth Tokens
3. **Core Endpoints Available**: List issues, update status, get statistics, query by tags/dates
4. **Limitations**: Missing advanced features (charts, performance monitoring, advanced queries) compared to Sentry
5. **Best Use Case**: Enhanced manual workflow with helper scripts for investigation and metrics

**Recommendation:**
✅ **Proceed with Enhanced Manual Workflow approach** - Build investigation helper scripts using available API endpoints. Skip auto-triage (too complex for value gained).

---

## 1. API Overview

### 1.1 Compatibility

- **Sentry API Compatible**: GlitchTip aims to be Sentry API compatible, and anything that works with Sentry should work with GlitchTip
- **Source Repository**: [GitLab - glitchtip/glitchtip-backend](https://gitlab.com/glitchtip/glitchtip-backend)
- **Tech Stack**: Django backend with django-ninja for API, async views
- **API Version**: Compatible with Sentry API v0

### 1.2 Base URL Structure

```
http://localhost:8080/api/0/{resource}/{identifier}/
```

**Production Instance:**
- URL: `http://localhost:8080` (SSH tunnel to 46.149.70.219)
- Organization: `adminai-tech`
- Project: `ai-admin-v2`

---

## 2. Authentication Guide

### 2.1 Getting an API Token

1. Navigate to **Profile > Auth Tokens** in GlitchTip UI
2. Create new token (give it a descriptive name like "API Automation")
3. **Important**: Auth Tokens give access to ANY project your user has permission to

**Auth Token Format:**
```
Token: YOUR_TOKEN_HERE (typically 40-character alphanumeric string)
```

### 2.2 Using the Token

**Headers Required:**
```javascript
{
  'Authorization': 'Bearer YOUR_TOKEN_HERE',
  'Accept': 'application/json',
  'Content-Type': 'application/json' // For POST/PUT requests
}
```

**Example cURL:**
```bash
export GLITCHTIP_API_TOKEN=YOUR_TOKEN_HERE
curl -H 'Accept: application/json' \
  -H "Authorization: Bearer $GLITCHTIP_API_TOKEN" \
  'http://localhost:8080/api/0/organizations/adminai-tech/issues/'
```

**Node.js Example:**
```javascript
const GLITCHTIP_URL = 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Accept': 'application/json'
};

// Using fetch (Node.js 18+)
const response = await fetch(
  `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/`,
  { headers }
);
const issues = await response.json();
```

### 2.3 Token Permissions

- **Scope Required**: `event:read` for listing issues
- **Scope Required**: `event:write` for updating issues
- Tokens can be created with specific scopes (check Sentry docs for full list)

---

## 3. Key Endpoints

### 3.1 List Issues (Organization Level)

**Endpoint:**
`GET /api/0/organizations/{organization_slug}/issues/`

**Query Parameters:**
- `query` - Sentry search query (default: `is:unresolved`)
- `project` - Filter by project ID
- `statsPeriod` - Time range (e.g., `14d`, `24h`)
- `cursor` - Pagination cursor

**Example:**
```bash
# List unresolved errors for specific project
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/0/organizations/adminai-tech/issues/?query=is:unresolved&project=1"

# Filter by level and status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/0/organizations/adminai-tech/issues/?query=is:unresolved%20level:error"
```

**Node.js Example:**
```javascript
async function listIssues(orgSlug, filters = {}) {
  const params = new URLSearchParams({
    query: filters.query || 'is:unresolved',
    project: filters.projectId || '',
    statsPeriod: filters.period || '14d'
  });

  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/issues/?${params}`,
    { headers }
  );

  return response.json();
}

// Usage
const issues = await listIssues('adminai-tech', {
  query: 'is:unresolved level:error',
  period: '7d'
});
```

**Response Format:**
```json
[
  {
    "id": "123456789",
    "title": "Error title",
    "culprit": "function_name",
    "permalink": "http://localhost:8080/...",
    "logger": "javascript",
    "level": "error",
    "status": "unresolved",
    "statusDetails": {},
    "isPublic": false,
    "project": {
      "id": "1",
      "name": "ai-admin-v2",
      "slug": "ai-admin-v2"
    },
    "count": "42",
    "userCount": 0,
    "firstSeen": "2025-11-24T10:00:00Z",
    "lastSeen": "2025-11-24T12:00:00Z",
    "metadata": {
      "title": "Error message",
      "type": "Error",
      "value": "Error message"
    }
  }
]
```

### 3.2 Retrieve Single Issue

**Endpoint:**
`GET /api/0/organizations/{organization_slug}/issues/{issue_id}/`

**Example:**
```javascript
async function getIssue(orgSlug, issueId) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
    { headers }
  );

  return response.json();
}
```

### 3.3 Update Issue Status

**Endpoint:**
`PUT /api/0/organizations/{organization_slug}/issues/{issue_id}/`

**Valid Status Values:**
- `resolved` - Mark as resolved
- `resolvedInNextRelease` - Will resolve in next release
- `unresolved` - Reopen issue
- `ignored` - Ignore/silence issue

**Example:**
```bash
# Resolve an issue
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}' \
  "http://localhost:8080/api/0/organizations/adminai-tech/issues/123456789/"

# Ignore an issue
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ignored"}' \
  "http://localhost:8080/api/0/organizations/adminai-tech/issues/123456789/"
```

**Node.js Example:**
```javascript
async function updateIssueStatus(orgSlug, issueId, status) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
    {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    }
  );

  return response.json();
}

// Usage
await updateIssueStatus('adminai-tech', '123456789', 'resolved');
await updateIssueStatus('adminai-tech', '987654321', 'ignored');
```

**Status Details (Advanced):**
```javascript
// Resolve in next release
{
  "status": "resolvedInNextRelease",
  "statusDetails": {
    "inNextRelease": true
  }
}

// Ignore for duration
{
  "status": "ignored",
  "statusDetails": {
    "ignoreDuration": 3600 // seconds
  }
}

// Ignore until X occurrences
{
  "status": "ignored",
  "statusDetails": {
    "ignoreCount": 100
  }
}
```

### 3.4 Issue Comments

**Endpoint:**
`POST /api/0/organizations/{organization_slug}/issues/{issue_id}/comments/`

**Feature:** Added in GlitchTip 3.1.0 with markdown support

**Example:**
```javascript
async function addComment(orgSlug, issueId, commentText) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/issues/${issueId}/comments/`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: commentText
      })
    }
  );

  return response.json();
}

// Usage with markdown
await addComment('adminai-tech', '123456789', `
## Investigation Results

**Root Cause:** Database connection timeout

**Related Code:**
\`\`\`javascript
// File: src/services/context/redis-context-service.js
// Line: 142
\`\`\`

**Fix:** Increased connection pool timeout
`);
```

### 3.5 List Issue Events

**Endpoint:**
`GET /api/0/organizations/{organization_slug}/issues/{issue_id}/events/`

**Use Case:** Get individual occurrences of an issue to see variations

**Example:**
```javascript
async function getIssueEvents(orgSlug, issueId, limit = 50) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/issues/${issueId}/events/?limit=${limit}`,
    { headers }
  );

  return response.json();
}
```

### 3.6 Statistics Endpoints

#### 3.6.1 Organization Stats Summary

**Endpoint:**
`GET /api/0/organizations/{organization_slug}/stats-summary/`

**Query Parameters:**
- `field` (REQUIRED) - `sum(quantity)` or `sum(times_seen)`
- `statsPeriod` - Time range (e.g., `14d`, `1h`)
- `project` - Filter by project ID

**Example:**
```javascript
async function getOrgStatsSummary(orgSlug, options = {}) {
  const params = new URLSearchParams({
    field: options.field || 'sum(times_seen)',
    statsPeriod: options.period || '14d',
    project: options.projectId || ''
  });

  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/stats-summary/?${params}`,
    { headers }
  );

  return response.json();
}

// Get total error count for last 7 days
const stats = await getOrgStatsSummary('adminai-tech', {
  field: 'sum(times_seen)',
  period: '7d'
});
```

#### 3.6.2 Project-Level Statistics

**Endpoint:**
`GET /api/0/projects/{organization_slug}/{project_slug}/stats/`

**Query Parameters:**
- `stat` - Choices: `received`, `rejected`, `blacklisted`, `generated`
- `since` - UNIX timestamp (start)
- `until` - UNIX timestamp (end)
- `resolution` - Choices: `10s`, `1h`, `1d`

**Example:**
```javascript
async function getProjectStats(orgSlug, projectSlug, options = {}) {
  const params = new URLSearchParams({
    stat: options.stat || 'received',
    resolution: options.resolution || '1h'
  });

  if (options.since) params.append('since', options.since);
  if (options.until) params.append('until', options.until);

  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/projects/${orgSlug}/${projectSlug}/stats/?${params}`,
    { headers }
  );

  return response.json();
}

// Get hourly error counts for last 24 hours
const stats = await getProjectStats('adminai-tech', 'ai-admin-v2', {
  stat: 'received',
  resolution: '1h',
  since: Math.floor(Date.now() / 1000) - 86400, // 24h ago
  until: Math.floor(Date.now() / 1000)
});
```

**Response Format:**
```json
[
  [1700000000, 42],  // [timestamp, count]
  [1700003600, 38],
  [1700007200, 51]
]
```

#### 3.6.3 Organization Stats V2

**Endpoint:**
`GET /api/0/organizations/{organization_slug}/stats_v2/`

**Query Parameters:**
- `groupBy` (REQUIRED) - Choices: `outcome`, `category`, `reason`, `project`
- Can pass multiple `groupBy` parameters

**Example:**
```javascript
async function getOrgStatsV2(orgSlug, groupBy = ['project']) {
  const params = new URLSearchParams();
  groupBy.forEach(g => params.append('groupBy', g));

  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/${orgSlug}/stats_v2/?${params}`,
    { headers }
  );

  return response.json();
}
```

---

## 4. Search Query Syntax

### 4.1 Basic Syntax

**Pattern:** `key:value`

**Examples:**
```
is:unresolved              # Default filter
is:resolved                # Resolved issues
level:error                # Error level
level:warning              # Warning level
env:production             # Environment tag
component:whatsapp         # Custom tag
```

### 4.2 Operators

**Negation:**
```
!is:resolved               # NOT resolved
!level:info                # NOT info level
```

**OR Operator:**
```
level:error OR level:fatal
x:[value1, value2]         # Alternative syntax
```

**Comparison (for dates/numbers):**
```
event.timestamp:>2025-11-20
event.timestamp:<2025-11-24T12:00:00
age:-24h                   # Last 24 hours
age:>7d                    # Older than 7 days
```

### 4.3 Date Filtering

**Relative (age):**
```
age:-24h                   # Last 24 hours
age:-7d                    # Last 7 days
age:>7d                    # Older than 7 days
```

**Absolute (event.timestamp):**
```
event.timestamp:2025-11-24                    # Specific date
event.timestamp:>2025-11-20                   # After date
event.timestamp:<2025-11-24T12:00:00          # Before datetime
event.timestamp:[2025-11-20 TO 2025-11-24]    # Range
```

### 4.4 Tag Filtering

**Custom Tags:**
```
component:baileys          # Component tag
service:whatsapp           # Service tag
method:queueMessage        # Method tag
```

**Combining Filters:**
```
is:unresolved level:error component:baileys age:-7d
```

### 4.5 Text Search

**Search in message/title:**
```
"connection timeout"       # Phrase search
connection OR timeout      # Any word
```

---

## 5. Practical Use Cases for AI Admin v2

### 5.1 Investigation Helper Script

**Goal:** Fetch error → Search codebase → Add findings as comment

**Implementation:**
```javascript
// scripts/glitchtip-investigate.js
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const GLITCHTIP_URL = 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;

async function investigateIssue(issueId) {
  // 1. Fetch issue details
  const issue = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issueId}/`,
    {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    }
  ).then(r => r.json());

  console.log(`Investigating: ${issue.title}`);

  // 2. Extract relevant info
  const errorMessage = issue.metadata.value;
  const culprit = issue.culprit;
  const tags = issue.tags || [];

  // 3. Search codebase
  const searchResults = [];

  // Search for culprit function
  if (culprit) {
    try {
      const files = execSync(`rg -l "${culprit}" src/`, { encoding: 'utf8' });
      searchResults.push(`**Files containing \`${culprit}\`:**\n${files}`);
    } catch (e) {
      // No matches
    }
  }

  // Search for error message keywords
  const keywords = errorMessage.match(/\b[A-Z][a-z]+\b/g) || [];
  keywords.forEach(keyword => {
    try {
      const matches = execSync(`rg -C 2 "${keyword}" src/`, { encoding: 'utf8' });
      searchResults.push(`**Context for "${keyword}":**\n\`\`\`\n${matches}\n\`\`\``);
    } catch (e) {
      // No matches
    }
  });

  // 4. Check recent commits related to this code
  const component = tags.find(t => t.key === 'component')?.value;
  if (component) {
    try {
      const commits = execSync(
        `git log --oneline --grep="${component}" -n 5`,
        { encoding: 'utf8' }
      );
      searchResults.push(`**Recent commits for ${component}:**\n${commits}`);
    } catch (e) {
      // No matches
    }
  }

  // 5. Build investigation report
  const report = `
## Automated Investigation Report

**Issue:** ${issue.title}
**First Seen:** ${issue.firstSeen}
**Occurrences:** ${issue.count}

### Search Results

${searchResults.join('\n\n---\n\n')}

### Recommendations

- Review files containing \`${culprit}\`
- Check error handling in related functions
- Verify recent changes to ${component} component

---
*Generated by GlitchTip Investigation Helper*
  `.trim();

  // 6. Add comment to issue
  await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issueId}/comments/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: report })
    }
  );

  console.log('Investigation report added to issue');
  return report;
}

// Usage
const issueId = process.argv[2];
if (!issueId) {
  console.error('Usage: node glitchtip-investigate.js <issue_id>');
  process.exit(1);
}

investigateIssue(issueId).catch(console.error);
```

**Usage:**
```bash
export GLITCHTIP_API_TOKEN=your_token_here
node scripts/glitchtip-investigate.js 123456789
```

### 5.2 Daily Error Metrics Dashboard

**Goal:** Generate daily summary of errors by component

**Implementation:**
```javascript
// scripts/glitchtip-daily-metrics.js
const fetch = require('node-fetch');

const GLITCHTIP_URL = 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ALERTS_CHAT_ID;

async function generateDailyMetrics() {
  const headers = { 'Authorization': `Bearer ${API_TOKEN}` };

  // 1. Get total error count (last 24h)
  const statsResponse = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/stats-summary/?field=sum(times_seen)&statsPeriod=24h`,
    { headers }
  );
  const stats = await statsResponse.json();
  const totalErrors = stats[0]?.[1] || 0;

  // 2. Get issues by component (last 24h)
  const issuesResponse = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/?query=age:-24h&limit=100`,
    { headers }
  );
  const issues = await issuesResponse.json();

  // 3. Group by component
  const byComponent = {};
  issues.forEach(issue => {
    const component = issue.tags?.find(t => t.key === 'component')?.value || 'unknown';
    if (!byComponent[component]) {
      byComponent[component] = { count: 0, issues: [] };
    }
    byComponent[component].count += parseInt(issue.count);
    byComponent[component].issues.push({
      title: issue.title,
      count: issue.count,
      level: issue.level
    });
  });

  // 4. Build report
  let report = `📊 **Daily Error Metrics** (Last 24h)\n\n`;
  report += `**Total Errors:** ${totalErrors}\n`;
  report += `**Unique Issues:** ${issues.length}\n\n`;

  report += `**By Component:**\n`;
  Object.entries(byComponent)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([component, data]) => {
      report += `• **${component}**: ${data.count} errors (${data.issues.length} issues)\n`;
    });

  report += `\n**Top Issues:**\n`;
  issues
    .sort((a, b) => parseInt(b.count) - parseInt(a.count))
    .slice(0, 5)
    .forEach((issue, i) => {
      report += `${i + 1}. ${issue.title} (${issue.count}x, ${issue.level})\n`;
      report += `   ${issue.permalink}\n`;
    });

  // 5. Send to Telegram
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: report,
        parse_mode: 'Markdown'
      })
    }
  );

  console.log('Daily metrics report sent to Telegram');
  return report;
}

generateDailyMetrics().catch(console.error);
```

**Schedule with PM2:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'glitchtip-daily-metrics',
    script: 'scripts/glitchtip-daily-metrics.js',
    cron_restart: '0 9 * * *', // Daily at 9 AM
    autorestart: false
  }]
};
```

### 5.3 Runbook Integration

**Goal:** Link known errors to runbook documentation

**Implementation:**
```javascript
// scripts/glitchtip-runbook-linker.js

const RUNBOOK_MAP = {
  'connection timeout': 'docs/runbooks/database-connection-timeout.md',
  'session_not_found': 'docs/runbooks/baileys-session-recovery.md',
  'rate limit exceeded': 'docs/runbooks/rate-limit-handling.md',
  'ECONNREFUSED': 'docs/runbooks/redis-connection-issues.md'
};

async function linkRunbooksToIssues() {
  // Get all unresolved issues
  const issues = await listIssues('adminai-tech', {
    query: 'is:unresolved'
  });

  for (const issue of issues) {
    // Check if issue matches known runbook
    const matchedRunbook = Object.entries(RUNBOOK_MAP).find(([keyword]) =>
      issue.title.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchedRunbook) {
      const [, runbookPath] = matchedRunbook;

      // Check if comment already exists
      const comments = await fetch(
        `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issue.id}/comments/`,
        { headers }
      ).then(r => r.json());

      const alreadyLinked = comments.some(c => c.text.includes(runbookPath));

      if (!alreadyLinked) {
        await addComment('adminai-tech', issue.id, `
## 📖 Runbook Available

This issue has a documented resolution procedure:

**Runbook:** [\`${runbookPath}\`](https://github.com/your-repo/blob/main/${runbookPath})

Follow the runbook steps to resolve this issue.
        `.trim());

        console.log(`Linked runbook to issue ${issue.id}: ${runbookPath}`);
      }
    }
  }
}
```

### 5.4 Telegram Bot Integration

**Goal:** Query errors via Telegram chat commands

**Implementation:**
```javascript
// Add to existing Telegram bot (src/integrations/telegram/bot.js)

// Command: /errors [component] [hours]
bot.command('errors', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const component = args[0];
  const hours = args[1] || '24';

  let query = `age:-${hours}h`;
  if (component) {
    query += ` component:${component}`;
  }

  const issues = await listIssues('adminai-tech', { query });

  if (issues.length === 0) {
    return ctx.reply(`✅ No errors found for ${component || 'all components'} in last ${hours}h`);
  }

  let message = `🚨 **Errors (Last ${hours}h)**\n\n`;
  issues.slice(0, 10).forEach((issue, i) => {
    message += `${i + 1}. ${issue.title}\n`;
    message += `   Level: ${issue.level} | Count: ${issue.count}\n`;
    message += `   [View](${issue.permalink})\n\n`;
  });

  if (issues.length > 10) {
    message += `... and ${issues.length - 10} more`;
  }

  return ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /resolve <issue_id>
bot.command('resolve', async (ctx) => {
  const issueId = ctx.message.text.split(' ')[1];

  if (!issueId) {
    return ctx.reply('Usage: /resolve <issue_id>');
  }

  await updateIssueStatus('adminai-tech', issueId, 'resolved');
  return ctx.reply(`✅ Issue ${issueId} marked as resolved`);
});
```

**Usage:**
```
/errors                      # All errors, last 24h
/errors baileys              # Baileys errors, last 24h
/errors whatsapp 48          # WhatsApp errors, last 48h
/resolve 123456789           # Resolve issue
```

---

## 6. GlitchTip CLI Tool

### 6.1 Installation

```bash
python3 -m venv env
source env/bin/activate
pip install glitchtip-cli
```

### 6.2 Configuration

**First run prompts for:**
- GlitchTip instance URL
- API token

**Writes to `.env` file:**
```bash
GLITCHTIP_URL=http://localhost:8080
GLITCHTIP_TOKEN=your_token_here
```

### 6.3 Available Commands

```bash
# List organizations
gtc list

# Create organization
gtc create <org_name>

# Delete organization
gtc delete <org_id>

# List organization members
gtc members <org_id>
```

**Note:** The CLI is basic and mainly for org management. For issue management, use REST API directly.

---

## 7. Webhooks

### 7.1 Setup

1. Navigate to **Project Alerts** in GlitchTip
2. Click **Create New Alert**
3. Specify error frequency trigger (e.g., "more than 10 errors in 5 minutes")
4. Click **Add An Alert Recipient**
5. Select **Webhook**
6. Enter webhook URL

### 7.2 Webhook Payload

**Format:** Slack-compatible JSON

```json
{
  "alias": "GlitchTip",
  "text": "GlitchTip Alert",
  "attachments": [{
    "title": "ZeroDivisionError: division by zero",
    "title_link": "http://localhost:8080/adminai-tech/ai-admin-v2/issues/123/",
    "text": "Error details...",
    "image_url": "",
    "color": "#ff0000"
  }],
  "sections": [{
    "activityType": "create",
    "activityName": "new",
    "text": "Activity information"
  }]
}
```

### 7.3 Custom Webhook Handler

**Example:** Forward to Telegram with custom formatting

```javascript
// scripts/webhook-handlers/glitchtip-telegram.js
const express = require('express');
const app = express();

app.post('/glitchtip-webhook', express.json(), async (req, res) => {
  const { text, attachments } = req.body;

  if (!attachments || attachments.length === 0) {
    return res.sendStatus(200);
  }

  const alert = attachments[0];
  const message = `
🚨 **GlitchTip Alert**

**Error:** ${alert.title}
**Details:** ${alert.text}

[View Issue](${alert.title_link})
  `.trim();

  // Send to Telegram
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_ALERTS_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    }
  );

  res.sendStatus(200);
});

app.listen(3001, () => {
  console.log('GlitchTip webhook handler listening on port 3001');
});
```

**Configure in GlitchTip:**
```
Webhook URL: http://your-server:3001/glitchtip-webhook
```

---

## 8. Limitations vs Sentry

### 8.1 Missing Features

**Not Available in GlitchTip:**
- ❌ Advanced charts and visualizations
- ❌ Performance monitoring (transactions, spans)
- ❌ User feedback capture (built-in UI)
- ❌ Release management
- ❌ Advanced queries (complex aggregations)
- ❌ Integrations with tools (Jira, Slack native, PagerDuty, etc.)
- ❌ Distributed tracing
- ❌ Session replay
- ❌ Cron monitoring
- ❌ Advanced alerting (anomaly detection, etc.)

### 8.2 Limited Features

**Basic Implementation Only:**
- ⚠️ Notifications (email + webhook only, no Slack native)
- ⚠️ Customization options (limited UI customization)
- ⚠️ Search capabilities (basic filters, no advanced queries)
- ⚠️ Metrics (basic stats only)

### 8.3 What Works Well

**Reliable Features:**
- ✅ Error tracking and grouping
- ✅ Issue comments (with markdown)
- ✅ Basic statistics
- ✅ Tag-based filtering
- ✅ Status management (resolve/ignore)
- ✅ Webhooks
- ✅ API access (Sentry-compatible endpoints)
- ✅ Organization/project management

---

## 9. Rate Limits & Quotas

### 9.1 API Rate Limits

**Status:** No explicit rate limits found in documentation

**Observations:**
- GlitchTip is self-hosted, so no hard limits enforced
- Performance depends on server resources (PostgreSQL, Redis, Celery workers)
- Best practice: Implement client-side rate limiting (e.g., max 100 req/min)

**Recommended Client-Side Throttling:**
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute
});

// Apply to all GlitchTip API calls
app.use('/api/glitchtip/', apiLimiter);
```

### 9.2 Event Ingestion Quotas

**Configurable in GlitchTip:**
- Organization-level event quotas
- Can set monthly limits
- SDK-level sampling: `tracesSampleRate`, `sampleRate`

**Best Practice:**
```javascript
// In Sentry SDK init
Sentry.init({
  dsn: 'YOUR_GLITCHTIP_DSN',
  sampleRate: 0.8, // Sample 80% of errors
  tracesSampleRate: 0.1, // Sample 10% of transactions
});
```

---

## 10. Monitoring & Observability

### 10.1 GlitchTip Internal Metrics

**Endpoint:** `/api/0/observability`

**Format:** Prometheus-compatible metrics

**Example:**
```bash
curl http://localhost:8080/api/0/observability
```

**Available Metrics:**
- HTTP request counts
- Response times
- Database query counts
- Celery task metrics

### 10.2 Grafana Integration

**Setup:**
1. In Grafana: Configuration > Data sources
2. Click "Add data source"
3. Search for "Sentry"
4. Enter GlitchTip URL: `http://localhost:8080`
5. Add Bearer token

**Use Cases:**
- Visualize error trends
- Create custom dashboards
- Set up alerts based on error thresholds

---

## 11. Recommendations for AI Admin v2

### 11.1 What to Build

**✅ Priority 1 (High Value, Low Complexity):**

1. **Investigation Helper Script**
   - Fetch error details
   - Search codebase for related code
   - Add findings as comment
   - **Estimated Effort:** 4-6 hours
   - **Value:** Saves 10-15 min per error investigation

2. **Daily Metrics Report**
   - Aggregate errors by component
   - Send to Telegram daily
   - Track trends over time
   - **Estimated Effort:** 3-4 hours
   - **Value:** Proactive monitoring, catch spikes early

3. **Telegram Bot Commands**
   - `/errors [component] [hours]` - Query recent errors
   - `/resolve <issue_id>` - Quick resolve from chat
   - **Estimated Effort:** 2-3 hours
   - **Value:** Quick access without opening UI

**✅ Priority 2 (Medium Value, Medium Complexity):**

4. **Runbook Linker**
   - Auto-link known errors to runbook docs
   - Add comment with resolution steps
   - **Estimated Effort:** 4-5 hours
   - **Value:** Faster resolution for known issues

5. **Custom Webhook Handler**
   - Better Telegram formatting
   - Filter out noise
   - **Estimated Effort:** 3-4 hours
   - **Value:** More actionable alerts

**✅ Priority 3 (Nice to Have):**

6. **Metrics Dashboard Script**
   - Generate weekly summary
   - Error trends by component
   - Top issues list
   - **Estimated Effort:** 5-6 hours
   - **Value:** Better visibility into error patterns

### 11.2 What to Skip

**❌ Don't Build:**

1. **Auto-Triage System**
   - Too complex for value gained
   - Risk of false positives
   - Manual review still needed
   - **Reasoning:** GlitchTip's basic filtering is sufficient, auto-resolution is risky

2. **Custom UI Dashboard**
   - GlitchTip UI is good enough
   - Not worth the maintenance
   - **Reasoning:** Focus on automation, not UI

3. **Advanced Analytics**
   - GlitchTip's stats are sufficient
   - Grafana integration if needed
   - **Reasoning:** YAGNI (You Ain't Gonna Need It)

### 11.3 Implementation Roadmap

**Phase 1: Enhanced Manual Workflow (Week 1)**
- Day 1-2: Investigation helper script
- Day 3-4: Daily metrics report
- Day 5: Telegram bot commands
- **Total:** 5 days, 10-12 hours effort

**Phase 2: Automation (Week 2)**
- Day 1-2: Runbook linker
- Day 3-4: Custom webhook handler
- Day 5: Testing and refinement
- **Total:** 5 days, 7-9 hours effort

**Phase 3: Polish (Week 3)**
- Day 1-2: Metrics dashboard script
- Day 3-4: Documentation
- Day 5: Team onboarding
- **Total:** 5 days, 8-10 hours effort

**Grand Total:** 3 weeks, 25-31 hours

---

## 12. Code Examples Library

### 12.1 Complete API Client Module

```javascript
// src/integrations/glitchtip/api-client.js

const fetch = require('node-fetch');

class GlitchTipClient {
  constructor(baseUrl, apiToken) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Accept': 'application/json'
    };
  }

  // Issues
  async listIssues(orgSlug, options = {}) {
    const params = new URLSearchParams({
      query: options.query || 'is:unresolved',
      project: options.projectId || '',
      statsPeriod: options.period || '14d',
      limit: options.limit || 100
    });

    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getIssue(orgSlug, issueId) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async updateIssueStatus(orgSlug, issueId, status, statusDetails = {}) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
      {
        method: 'PUT',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          statusDetails
        })
      }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async addComment(orgSlug, issueId, text) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/comments/`,
      {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getIssueEvents(orgSlug, issueId, limit = 50) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/events/?limit=${limit}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Statistics
  async getOrgStatsSummary(orgSlug, options = {}) {
    const params = new URLSearchParams({
      field: options.field || 'sum(times_seen)',
      statsPeriod: options.period || '14d',
      project: options.projectId || ''
    });

    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/stats-summary/?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getProjectStats(orgSlug, projectSlug, options = {}) {
    const params = new URLSearchParams({
      stat: options.stat || 'received',
      resolution: options.resolution || '1h'
    });

    if (options.since) params.append('since', options.since);
    if (options.until) params.append('until', options.until);

    const response = await fetch(
      `${this.baseUrl}/api/0/projects/${orgSlug}/${projectSlug}/stats/?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
let client;

function getGlitchTipClient() {
  if (!client) {
    const baseUrl = process.env.GLITCHTIP_URL || 'http://localhost:8080';
    const apiToken = process.env.GLITCHTIP_API_TOKEN;

    if (!apiToken) {
      throw new Error('GLITCHTIP_API_TOKEN environment variable not set');
    }

    client = new GlitchTipClient(baseUrl, apiToken);
  }

  return client;
}

module.exports = { GlitchTipClient, getGlitchTipClient };
```

### 12.2 Environment Variables

```bash
# .env
GLITCHTIP_URL=http://localhost:8080
GLITCHTIP_API_TOKEN=your_token_here
GLITCHTIP_ORG_SLUG=adminai-tech
GLITCHTIP_PROJECT_SLUG=ai-admin-v2
```

---

## 13. Sources & References

### 13.1 Official Documentation

- [GlitchTip Documentation](https://glitchtip.com/documentation/)
- [GlitchTip SDK Documentation](https://glitchtip.com/sdkdocs/)
- [GlitchTip Backend Repository](https://gitlab.com/glitchtip/glitchtip-backend)
- [Sentry API Documentation](https://docs.sentry.io/api/) (compatible with GlitchTip)

### 13.2 API Endpoints

- [List a Project's Issues](https://docs.sentry.io/api/events/list-a-projects-issues/)
- [Update an Issue](https://docs.sentry.io/api/events/update-an-issue/)
- [List an Issue's Events](https://docs.sentry.io/api/events/list-an-issues-events/)
- [Retrieve Event Counts for a Project](https://docs.sentry.io/api/projects/retrieve-event-counts-for-a-project/)

### 13.3 Community Resources

- [GlitchTip API Client](https://chris.bur.gs/glitchtip-client/) - Python client example
- [GlitchTip CLI Tool](https://pypi.org/project/glitchtip-cli/)
- [Sentry Search Syntax](https://docs.sentry.io/product/reference/search/)
- [Stack Overflow: Sentry API Examples](https://stackoverflow.com/questions/68410358/sentry-io-api-get-issues-filtering-on-environment-tag)

### 13.4 Integration Examples

- [GlitchTip Jira Bridge](https://github.com/app-sre/glitchtip-jira-bridge) - Webhook integration example
- [GlitchTip Filtering by Log Levels](https://chris.bur.gs/glitchtip-levels/)
- [Meaningful Sentry Issues with React Query + Axios](https://aronschueler.de/blog/2022/12/16/generating-meaningful-issues-in-sentry-with-react-query-+-axios/)

---

## Appendix A: Quick Reference

### Authentication
```bash
export GLITCHTIP_API_TOKEN=your_token_here
curl -H "Authorization: Bearer $GLITCHTIP_API_TOKEN" \
  http://localhost:8080/api/0/organizations/adminai-tech/issues/
```

### Common Queries
```javascript
// Unresolved errors, last 24h
query: 'is:unresolved level:error age:-24h'

// Specific component
query: 'component:baileys is:unresolved'

// Date range
query: 'event.timestamp:[2025-11-20 TO 2025-11-24]'

// Multiple filters
query: 'is:unresolved level:error component:whatsapp age:-7d'
```

### Update Status
```javascript
// Resolve
{ status: 'resolved' }

// Ignore
{ status: 'ignored' }

// Reopen
{ status: 'unresolved' }
```

### Add Comment
```javascript
{
  text: '## Comment Title\n\nMarkdown **supported**!'
}
```

---

**Last Updated:** 2025-11-24
**Maintained By:** AI Admin v2 Team
**Related Docs:**
- `dev/active/sentry-to-glitchtip-migration/sentry-to-glitchtip-code-review.md`
- `dev/active/sentry-to-glitchtip-migration/sentry-to-glitchtip-migration-plan.md`
