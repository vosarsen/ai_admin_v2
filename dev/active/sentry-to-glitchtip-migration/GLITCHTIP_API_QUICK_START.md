# GlitchTip API Quick Start Guide

**Purpose:** Get started with GlitchTip API automation in 5 minutes

---

## 1. Authentication (30 seconds)

1. Open GlitchTip UI: `http://localhost:8080`
2. Navigate to **Profile > Auth Tokens**
3. Create token (name: "API Automation")
4. Copy token to `.env`:

```bash
# Add to .env
GLITCHTIP_URL=http://localhost:8080
GLITCHTIP_API_TOKEN=your_40_char_token_here
GLITCHTIP_ORG_SLUG=adminai-tech
GLITCHTIP_PROJECT_SLUG=ai-admin-v2
```

---

## 2. Test Connection (30 seconds)

```bash
export GLITCHTIP_API_TOKEN=your_token_here

# List recent errors
curl -H "Authorization: Bearer $GLITCHTIP_API_TOKEN" \
  "http://localhost:8080/api/0/organizations/adminai-tech/issues/?query=is:unresolved&limit=5"
```

**Expected:** JSON array with issues

---

## 3. Common Operations

### List Issues

```javascript
const fetch = require('node-fetch');

const GLITCHTIP_URL = 'http://localhost:8080';
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;

async function listIssues(query = 'is:unresolved') {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/?query=${query}`,
    {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    }
  );
  return response.json();
}

// Usage
const issues = await listIssues('is:unresolved level:error');
console.log(`Found ${issues.length} errors`);
```

### Resolve Issue

```javascript
async function resolveIssue(issueId) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issueId}/`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'resolved' })
    }
  );
  return response.json();
}
```

### Add Comment

```javascript
async function addComment(issueId, text) {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issueId}/comments/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    }
  );
  return response.json();
}
```

---

## 4. Query Syntax Cheat Sheet

```javascript
// Status
'is:unresolved'
'is:resolved'

// Level
'level:error'
'level:warning'

// Time
'age:-24h'           // Last 24 hours
'age:-7d'            // Last 7 days

// Tags
'component:baileys'
'service:whatsapp'

// Combine
'is:unresolved level:error component:baileys age:-24h'
```

---

## 5. Quick Scripts

### Daily Error Count

```javascript
// scripts/glitchtip-error-count.js
const fetch = require('node-fetch');

const GLITCHTIP_URL = process.env.GLITCHTIP_URL;
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;

async function getDailyErrorCount() {
  const response = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/stats-summary/?field=sum(times_seen)&statsPeriod=24h`,
    {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    }
  );

  const stats = await response.json();
  const count = stats[0]?.[1] || 0;

  console.log(`Total errors (last 24h): ${count}`);
  return count;
}

getDailyErrorCount().catch(console.error);
```

**Run:**
```bash
node scripts/glitchtip-error-count.js
```

### Investigation Helper

```javascript
// scripts/glitchtip-investigate.js
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const GLITCHTIP_URL = process.env.GLITCHTIP_URL;
const API_TOKEN = process.env.GLITCHTIP_API_TOKEN;

async function investigate(issueId) {
  // 1. Get issue details
  const issue = await fetch(
    `${GLITCHTIP_URL}/api/0/organizations/adminai-tech/issues/${issueId}/`,
    { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
  ).then(r => r.json());

  console.log(`\nInvestigating: ${issue.title}`);
  console.log(`Occurrences: ${issue.count}`);
  console.log(`Level: ${issue.level}`);

  // 2. Search codebase
  const culprit = issue.culprit;
  if (culprit) {
    try {
      console.log(`\nSearching for "${culprit}"...`);
      const files = execSync(`rg -l "${culprit}" src/`, { encoding: 'utf8' });
      console.log(files);
    } catch (e) {
      console.log('No matches found');
    }
  }

  // 3. Add comment
  const report = `
## Investigation Results

**Culprit:** \`${culprit}\`
**Occurrences:** ${issue.count}
**Level:** ${issue.level}

Use \`rg "${culprit}" src/\` to find related code.
  `.trim();

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

  console.log('\nInvestigation report added to issue ✓');
}

const issueId = process.argv[2];
if (!issueId) {
  console.error('Usage: node glitchtip-investigate.js <issue_id>');
  process.exit(1);
}

investigate(issueId).catch(console.error);
```

**Run:**
```bash
node scripts/glitchtip-investigate.js 123456789
```

---

## 6. Complete API Client

Save this as `src/integrations/glitchtip/api-client.js`:

```javascript
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
      throw new Error(`GlitchTip API error: ${response.status}`);
    }

    return response.json();
  }

  async getIssue(orgSlug, issueId) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status}`);
    }

    return response.json();
  }

  async updateIssueStatus(orgSlug, issueId, status) {
    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/issues/${issueId}/`,
      {
        method: 'PUT',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status}`);
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
      throw new Error(`GlitchTip API error: ${response.status}`);
    }

    return response.json();
  }

  async getStats(orgSlug, options = {}) {
    const params = new URLSearchParams({
      field: options.field || 'sum(times_seen)',
      statsPeriod: options.period || '14d'
    });

    const response = await fetch(
      `${this.baseUrl}/api/0/organizations/${orgSlug}/stats-summary/?${params}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`GlitchTip API error: ${response.status}`);
    }

    return response.json();
  }
}

// Singleton
let client;

function getGlitchTipClient() {
  if (!client) {
    const baseUrl = process.env.GLITCHTIP_URL || 'http://localhost:8080';
    const apiToken = process.env.GLITCHTIP_API_TOKEN;

    if (!apiToken) {
      throw new Error('GLITCHTIP_API_TOKEN not set');
    }

    client = new GlitchTipClient(baseUrl, apiToken);
  }

  return client;
}

module.exports = { GlitchTipClient, getGlitchTipClient };
```

**Usage:**
```javascript
const { getGlitchTipClient } = require('./src/integrations/glitchtip/api-client');

const client = getGlitchTipClient();

// List errors
const issues = await client.listIssues('adminai-tech', {
  query: 'is:unresolved level:error',
  period: '7d'
});

// Resolve issue
await client.updateIssueStatus('adminai-tech', '123456789', 'resolved');

// Add comment
await client.addComment('adminai-tech', '123456789', 'Fixed in commit abc123');

// Get stats
const stats = await client.getStats('adminai-tech', { period: '24h' });
```

---

## 7. Telegram Bot Integration

Add to `src/integrations/telegram/bot.js`:

```javascript
const { getGlitchTipClient } = require('../glitchtip/api-client');

// Command: /errors [component] [hours]
bot.command('errors', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const component = args[0];
  const hours = args[1] || '24';

  let query = `age:-${hours}h`;
  if (component) {
    query += ` component:${component}`;
  }

  const client = getGlitchTipClient();
  const issues = await client.listIssues('adminai-tech', { query });

  if (issues.length === 0) {
    return ctx.reply(`✅ No errors for ${component || 'all'} (last ${hours}h)`);
  }

  let message = `🚨 Errors (Last ${hours}h)\n\n`;
  issues.slice(0, 10).forEach((issue, i) => {
    message += `${i + 1}. ${issue.title}\n`;
    message += `   ${issue.level} | ${issue.count}x\n`;
    message += `   ${issue.permalink}\n\n`;
  });

  return ctx.reply(message);
});
```

**Usage:**
```
/errors                    # All errors, last 24h
/errors baileys            # Baileys errors, last 24h
/errors whatsapp 48        # WhatsApp errors, last 48h
```

---

## 8. Next Steps

1. ✅ Test authentication
2. ✅ Run error count script
3. ✅ Try investigation helper
4. ✅ Add Telegram commands
5. ✅ Build daily metrics report

**Full Documentation:** See `GLITCHTIP_API_RESEARCH.md` for complete reference

---

**Last Updated:** 2025-11-24
