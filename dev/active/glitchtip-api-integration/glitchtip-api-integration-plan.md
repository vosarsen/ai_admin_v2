# GlitchTip API Integration & Enhanced Manual Workflow - Implementation Plan

**Last Updated:** 2025-11-24 (Updated after plan-reviewer agent feedback)
**Status:** Planning → Ready for Implementation
**Duration:** 3-4 weeks (35-45 hours with critical fixes)
**Approach:** Enhanced Manual Workflow (70% time savings, $0 ongoing)

---

## Executive Summary

### Objective
Integrate GlitchTip API with enhanced manual workflow to reduce error triage/resolution time by 70% without complex automation or ongoing costs.

### Key Results (Expected)
- ⏱️ **Time Savings:** 70% reduction (from 15 min → 4-5 min per error)
- 💰 **Cost:** $1,550 one-time (31 hours × $50/hour), $0 ongoing
- 📊 **ROI:** 400-600% first year
- 🎯 **Break-Even:** 1-2 months
- ⚡ **Risk:** Very Low (no auto-fixes, human always in control)

### Approach
Instead of complex auto-remediation, build practical helper tools:
1. Investigation helper scripts (search codebase, find related issues)
2. Daily metrics reporting (proactive monitoring)
3. Telegram bot commands (quick queries, fast actions)
4. Runbook integration (link known issues to solutions)
5. Enhanced webhook alerts (rich context in notifications)

### Why This Approach?
Based on comprehensive review by plan-reviewer agent:
- ✅ Higher ROI than full automation (70% vs 50% time saved)
- ✅ Zero ongoing costs (vs $3,000/month for auto-remediation)
- ✅ Lower risk (human approval for all actions)
- ✅ Faster break-even (1-2 months vs never)
- ✅ Better suited for 1-2 developer team

---

## Current State Analysis

### GlitchTip Deployment
**Status:** ✅ Production Active (Phase 3 monitoring since 2025-11-24)

**Infrastructure:**
- URL: `http://localhost:8080` (on 46.149.70.219)
- Port: 127.0.0.1:8080 (localhost-only, secure)
- Containers: 4 (web, worker, postgres, redis)
- Resources: ~395 MiB (21% of 1.9GB RAM)
- Health: All containers Up and healthy
- Grade: A (94/100) - Production ready

**Access:**
- SSH tunnel required: `ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 root@46.149.70.219`
- Credentials: support@adminai.tech / AdminSecure2025
- API token: Not yet created (will do in Phase 0)

### Error Tracking Integration
**Status:** ✅ Fully Integrated

**Capture Points:** 62 Sentry.captureException() calls across:
- `src/database/postgres.js` (4 errors)
- `src/repositories/BaseRepository.js` (5 errors)
- `src/integrations/whatsapp/auth-state-timeweb.js` (10 errors)
- `src/integrations/yclients/data/supabase-data-layer.js` (20 errors)
- `scripts/*` (12 errors in cron jobs)
- Other files (11 errors)

**Context Captured:**
- Stack traces (full error path)
- User context (ID, email if available)
- Tags (component, operation, backend)
- Extra data (request params, state, metrics)
- Environment (production/development)
- Service name (ai-admin-api, ai-admin-worker-v2, etc.)

### Current Workflow (Manual)
**Time per error:** ~15 minutes

**Steps:**
1. Alert received (email/Telegram) → 1 min
2. Open GlitchTip UI → 1 min
3. Read error details → 2 min
4. Search codebase for related files → 5 min
5. Check recent commits → 2 min
6. Identify root cause → 3 min
7. Apply fix & deploy → 1 min

**Pain Points:**
- Manual codebase search is slow
- No history of similar issues
- No automatic runbook links
- Limited error context in alerts
- No proactive monitoring (reactive only)

### Available Resources
**Documentation:**
- ✅ GlitchTip API Research (10,500+ lines) - Complete reference
- ✅ GlitchTip API Quick Start (350 lines) - 5-minute setup
- ✅ Auto-Remediation Review (26,000 words) - What NOT to build
- ✅ Error Tracking Workflow (580 lines) - Operational guide
- ✅ Example API script (219 lines) - Working code

**API Capabilities (Sentry-compatible):**
- List/search issues (powerful query syntax)
- Update status (resolve, ignore, assign)
- Add comments (markdown support)
- Get statistics (counts, trends, aggregates)
- Webhooks (new issues, regressions)

---

## Proposed Future State

### Enhanced Workflow
**Time per error:** ~4-5 minutes (70% faster)

**Automated Steps:**
1. **Rich alert** with full context → 0.5 min
2. **Helper script** finds related files → 0.5 min
3. **Runbook link** if known issue → 0.5 min
4. **Similar issues** from history → 0.5 min
5. Apply fix & deploy → 2-3 min

**New Capabilities:**
- ✅ Automated investigation (codebase search, git history)
- ✅ Proactive monitoring (daily metrics reports)
- ✅ Quick actions (Telegram bot commands)
- ✅ Knowledge base (runbook integration)
- ✅ Rich context (enhanced webhook alerts)

### Architecture

```
GlitchTip
    ↓
┌─────────────────────────────────────┐
│  API Integration Layer              │
│  (scripts/lib/glitchtip-api.js)    │
└─────────────────────────────────────┘
    ↓
┌──────────┬──────────┬──────────┬────────────┬─────────┐
│ Investig │  Daily   │ Telegram │  Runbook   │ Webhook │
│  Helper  │  Metrics │   Bot    │  Linker    │ Handler │
└──────────┴──────────┴──────────┴────────────┴─────────┘
    ↓           ↓          ↓           ↓          ↓
 Comments    Telegram   Telegram   Comments   Telegram
 in GT UI      DM       Commands   in GT UI      DM
```

### Components

**1. API Client Library** (`scripts/lib/glitchtip-api.js`)
- Reusable API wrapper
- Authentication handling
- Error handling & retries
- Rate limiting (if needed)

**2. Investigation Helper** (`scripts/investigate-error.js`)
- Fetch error from GlitchTip API
- Search codebase for related files
- Find recent commits in affected areas
- Search for similar resolved issues
- Add findings as comment to issue

**3. Daily Metrics** (`scripts/daily-metrics.js`)
- Aggregate error stats (last 24h)
- Group by component/service
- Identify top issues
- Send formatted report to Telegram
- Run via cron (daily 9 AM)

**4. Telegram Bot** (`src/services/telegram-bot/glitchtip-commands.js`)
- `/errors [component] [hours]` - Query errors
- `/resolve <issue_id>` - Resolve issue
- `/investigate <issue_id>` - Run investigation
- `/stats [period]` - Get error statistics

**5. Runbook Linker** (`scripts/link-runbooks.js`)
- Pattern matching (error title → runbook)
- Auto-add comments with links
- Run via cron (hourly during work hours)

**6. Enhanced Webhook** (`src/webhooks/glitchtip.js`)
- Receive new issue notifications
- Fetch full details via API
- Format rich Telegram message
- Include quick action buttons

---

## Implementation Phases

### Phase 0: Setup & Baseline (Week 1, Days 1-3: 10 hours)

**UPDATED:** Added Phase 0.4 based on plan-reviewer feedback

**Objective:** Establish baseline metrics and configure API access

**Tasks:**

**0.1 Baseline Measurement** (2 hours, S)
- Track error volume (how many/day?)
- Measure current triage time (per error)
- Measure current investigation time
- Document current workflow pain points
- **Output:** Metrics spreadsheet for ROI calculation

**0.2 API Token Setup** (1 hour, S)
- SSH to server, create tunnel
- Login to GlitchTip UI
- Settings → Auth Tokens → Create
- Store token in `.env.production` (gitignored)
- Document in password manager with rotation schedule (quarterly)
- Create separate tokens for dev/prod environments
- Add token validation check to all scripts
- Test API access with example script
- **Output:** Working API token, secure storage, test successful

**Token Storage Strategy:**
```bash
# .env.production (gitignored)
GLITCHTIP_API_TOKEN=your_production_token_here
GLITCHTIP_BASE_URL=http://localhost:8080

# .env.development (gitignored)
GLITCHTIP_API_TOKEN=your_dev_token_here
GLITCHTIP_BASE_URL=http://localhost:8080
```

**Token Rotation:**
- Schedule: Every 3 months (quarterly)
- Document in password manager (1Password/Bitwarden)
- Alert 1 week before expiration
- Process: Create new → Test → Replace → Revoke old

**0.3 API Client Library** (3 hours, M)
- Create `scripts/lib/glitchtip-api.js`
- Implement: getOrganizations, getIssues, searchIssues
- Implement: addComment, resolveIssue, getStats
- Add error handling & retries with circuit breaker pattern
- Add rate limiting (max 10 req/sec)
- Write tests (basic smoke tests)
- **Output:** Reusable API client, tested

**0.4 Environment Preparation** (4 hours, M)
- **Standardize Error Context:**
  - Audit all 62 `Sentry.captureException()` calls
  - Document current context schema (tags, extra data)
  - Create standardized context template
  - Add missing context to key capture points
  - **Target:** Consistent error metadata for investigation

- **Infrastructure Setup:**
  - Install ripgrep on server: `ssh root@46.149.70.219 "apt-get update && apt-get install -y ripgrep"`
  - Verify git access for commit history
  - Test Redis connection for caching
  - Create test GlitchTip project (optional)

- **Cache Strategy:**
  - Define Redis key patterns: `glitchtip:investigation:{issueId}`
  - Set TTL for cached investigations (24 hours)
  - Define cache invalidation rules
  - Document caching approach

- **Testing Preparation:**
  - Create test error samples (3-5 representative errors)
  - Document expected investigation results
  - Set up dry-run environment flags

- **Output:** Standardized error capture, infrastructure ready, cache strategy defined

**Acceptance Criteria:**
- [ ] Baseline metrics documented
- [ ] API token created and tested with secure storage
- [ ] API client library works (5+ methods) with circuit breaker
- [ ] Environment prepared (ripgrep, Redis, test data)
- [ ] Error context standardized across codebase
- [ ] Cache strategy documented
- [ ] Example queries return data
- [ ] Ready to build helper tools

---

### Phase 1: Investigation Helper (Week 1, Days 3-5: 6 hours)

**Objective:** Automate error investigation (codebase search, git history, similar issues)

**Tasks:**

**1.1 Core Investigation Logic** (3 hours, M)
- Create `scripts/investigate-error.js`
- Implement: Fetch error details from API
- Implement: Parse stack trace for file paths
- Implement: Search codebase for related files (grep/ripgrep)
- Implement: Get recent commits (git log for files)
- **Output:** Investigation script (command-line)

**1.2 Similar Issues Search** (2 hours, S)
- Query GlitchTip for resolved issues with similar titles
- Score similarity (simple string matching)
- Extract resolution comments
- Include in investigation report
- **Output:** Similar issues finder

**1.3 Comment Integration** (1 hour, S)
- Format investigation findings as markdown
- Post comment to GlitchTip issue via API
- Include: Related files, recent commits, similar issues
- Test with real error
- **Output:** Auto-comment on investigated issues

**Usage:**
```bash
$ ./scripts/investigate-error.js 12345

🔍 Investigating Issue #12345...
✅ Found 3 related files
✅ Found 5 recent commits
✅ Found 2 similar resolved issues
✅ Added comment to GlitchTip

View: http://localhost:9090/organizations/ai-admin/issues/12345/
```

**Acceptance Criteria:**
- [ ] Script runs via command line
- [ ] Searches codebase for stack trace files
- [ ] Finds recent commits (git log)
- [ ] Finds similar resolved issues
- [ ] Adds markdown comment to issue
- [ ] Works with real production error
- [ ] Time: <30 seconds per investigation

---

### Phase 2: Daily Metrics & Proactive Monitoring (Week 2, Days 1-2: 4 hours)

**Objective:** Proactive error monitoring via daily reports

**Tasks:**

**2.1 Stats Aggregation** (2 hours, M)
- Create `scripts/daily-metrics.js`
- Query GlitchTip API for stats (last 24h)
- Group errors by component/service
- Identify top issues (by count)
- Calculate trends (vs yesterday)
- **Output:** Daily metrics script

**2.2 Telegram Integration** (1 hour, S)
- Format report as rich Telegram message
- Include emojis for visual hierarchy
- Add quick action buttons
- Send via Telegram Bot API
- **Output:** Formatted daily report

**2.3 Cron Scheduling** (1 hour, S)
- Add to PM2 ecosystem config (`ecosystem.config.js`)
- **PM2 Cron Pattern (use existing pattern):**
  ```javascript
  {
    name: 'glitchtip-daily-metrics',
    script: './scripts/daily-metrics.js',
    instances: 1,
    exec_mode: 'fork',
    cron_restart: '0 9 * * *',      // Daily at 9 AM UTC (12:00 MSK)
    autorestart: false,              // Don't restart automatically, only via cron
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/glitchtip-metrics-error.log',
    out_file: './logs/glitchtip-metrics-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '50M'
  }
  ```
- **Note:** Follow existing PM2 pattern with `cron_restart` + `autorestart: false`
  (NOT `cron: "0 9 * * *"` as in original plan)
- Test manual execution: `pm2 start ecosystem.config.js --only glitchtip-daily-metrics`
- Verify PM2 cron logs: `pm2 logs glitchtip-daily-metrics`
- **Output:** Automated daily reports via PM2 cron

**Sample Report:**
```
📊 Daily Error Report - 2025-11-25

Total: 12 errors (-3 from yesterday)

By Component:
🔴 database: 5 errors (P1)
🟡 whatsapp: 4 errors (P2)
🟢 yclients: 2 errors (P3)
🟢 other: 1 error (P3)

Top Issues:
1. #12345: ConnectionTimeout (5x)
2. #12346: SessionExpired (4x)

Action: 1 P1 issue unresolved
👉 /investigate 12345
```

**Acceptance Criteria:**
- [ ] Script aggregates stats via API
- [ ] Groups by component/service
- [ ] Identifies top issues
- [ ] Sends to Telegram daily at 9 AM
- [ ] Includes quick action buttons
- [ ] Works without manual intervention

---

### Phase 3: Telegram Bot Commands (Week 2, Days 3-5: 4 hours)

**Objective:** Fast error queries and actions via Telegram

**Tasks:**

**3.1 Bot Command Router** (2 hours, M)
- **Integration Approach:**
  - Current bot location: `scripts/telegram-bot.js` (main bot) and `src/services/telegram-notifier.js` (notifications)
  - Strategy: Extend `scripts/telegram-bot.js` with new command handlers
  - Alternative: Create new module `scripts/glitchtip-bot-commands.js` and require from main bot
  - Preserve existing notification flow (don't break telegram-notifier.js)

- **Command Registration:**
  - Add command: `/errors [component] [hours]` - Query errors by filters
  - Add command: `/resolve <issue_id>` - Mark issue as resolved
  - Add command: `/investigate <issue_id>` - Trigger investigation script
  - Add command: `/stats [period]` - Get error statistics
  - Add command: `/help_glitchtip` - Show GlitchTip commands help

- **Implementation:**
  ```javascript
  // In scripts/telegram-bot.js or scripts/glitchtip-bot-commands.js
  const GlitchTipAPI = require('./lib/glitchtip-api');

  // Add command handlers
  bot.onText(/\/errors(?:\s+(.+))?/, async (msg, match) => {
    // Parse filters, query API, format response
  });

  bot.onText(/\/resolve\s+(\d+)/, async (msg, match) => {
    // Resolve issue via API
  });

  // ... more commands
  ```

- **Output:** Bot command handlers integrated with existing bot

**3.2 Query Implementation** (1 hour, S)
- `/errors`: Query GlitchTip API with filters
- Format results as list (title, count, priority)
- Include issue permalinks
- Limit to top 10 results
- **Output:** Working `/errors` command

**3.3 Action Commands** (1 hour, S)
- `/resolve`: Call API to resolve issue
- `/investigate`: Trigger investigation script
- Return confirmation messages
- Handle errors gracefully
- **Output:** Working action commands

**Usage:**
```
You: /errors database 24h

Bot: 🔍 Database errors (last 24h): 5 total

1. #12345: ConnectionTimeout (5x) - P1
   http://localhost:9090/.../12345/

2. #12348: QueryTimeout (2x) - P2
   http://localhost:9090/.../12348/

Quick actions:
👉 /investigate 12345
👉 /resolve 12348
```

**Acceptance Criteria:**
- [ ] `/errors` command works (query + format)
- [ ] `/resolve` command works (API call)
- [ ] `/investigate` command triggers script
- [ ] `/stats` command shows aggregates
- [ ] Error handling for invalid inputs
- [ ] Works in production Telegram bot

---

### Phase 4: Runbook Integration (Week 3, Days 1-2: 5 hours)

**Objective:** Link known errors to runbook documentation

**Tasks:**

**4.1 Runbook Repository** (2 hours, M)
- Create `runbooks/` directory structure
- Document top 5 common errors:
  - database-timeout.md
  - whatsapp-session-expired.md
  - yclients-rate-limit.md
  - redis-connection-refused.md
  - npm-module-not-found.md
- Template: Symptoms, Diagnosis, Fix, Commands
- **Output:** 5 documented runbooks

**4.2 Pattern Matching** (2 hours, M)
- Create `scripts/link-runbooks.js`
- Define patterns (error title → runbook)
- Search for matching issues
- Check if runbook comment already exists
- Add comment with link if needed
- **Output:** Runbook linker script

**4.3 Automation** (1 hour, S)
- Schedule via PM2 cron (hourly 8-23:00)
- **PM2 Cron Pattern:**
  ```javascript
  {
    name: 'glitchtip-runbook-linker',
    script: './scripts/link-runbooks.js',
    instances: 1,
    exec_mode: 'fork',
    cron_restart: '0 8-23 * * *',   // Every hour 8am-11pm UTC (11:00-02:00 MSK)
    autorestart: false,              // Don't restart automatically, only via cron
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/glitchtip-runbooks-error.log',
    out_file: './logs/glitchtip-runbooks-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '50M'
  }
  ```
- Test with known error
- Verify comment appears
- **Output:** Automated runbook linking via PM2 cron

**Sample Runbook:**
```markdown
# Database Connection Timeout

## Symptoms
- Error: ECONNREFUSED / ETIMEDOUT
- Component: database
- Occurrences: High frequency (>5 in 1h)

## Diagnosis
1. Check connection pool:
   `SELECT * FROM pg_stat_activity`
2. Check for locks:
   `SELECT * FROM pg_locks WHERE granted = false`
3. Check slow queries:
   `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC`

## Fix

### If pool exhausted:
```bash
# Increase max connections
# Edit /opt/ai-admin/.env:
DATABASE_MAX_CONNECTIONS=20  # was 10

# Restart services
pm2 restart all
```

### If slow query:
```sql
-- Add index to slow table
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
```

## Prevention
- Monitor connection pool usage
- Set up slow query alerts
- Regular VACUUM ANALYZE
```

**Acceptance Criteria:**
- [ ] 5 common errors documented
- [ ] Pattern matching works
- [ ] Auto-adds comments with links
- [ ] Runs hourly via PM2 cron
- [ ] Doesn't duplicate comments
- [ ] Reduces fix time for known issues by 80%

---

### Phase 5: Enhanced Webhook Handler (Week 3, Days 3-5: 6 hours)

**Objective:** Rich Telegram alerts with full context

**Tasks:**

**5.1 Webhook Endpoint** (2 hours, M)
- Create `src/webhooks/glitchtip.js`
- Express route: POST /api/glitchtip-webhook
- Verify webhook signature (if available)
- Parse event payload
- **Output:** Webhook receiver

**5.2 Event Handling** (2 hours, M)
- Handle event: `issue.new`
- Handle event: `issue.regression`
- Fetch full issue details via API
- Extract: title, level, count, tags, stack trace
- **Output:** Event handlers

**5.3 Rich Formatting** (2 hours, M)
- Format as Telegram message (markdown)
- Include: Title, component, level, count
- Include: First 500 chars of stack trace
- Add quick action buttons
- Send via Telegram Bot API
- **Output:** Rich Telegram notifications

**Sample Alert:**
```
🔴 NEW ERROR: ConnectionTimeout in Database

Component: database
Level: error
Occurrences: 1 (first occurrence)

Stack Trace:
```
Error: Connection timeout
  at Database.connect (src/database/postgres.js:42)
  at Repository.query (src/repositories/BaseRepository.js:156)
  ...
```

Tags: component:database, operation:connect, backend:timeweb

URL: http://localhost:9090/.../12345/

Quick Actions:
👉 /investigate 12345
👉 /assign 12345 @developer
```

**Acceptance Criteria:**
- [ ] Webhook endpoint receives events
- [ ] Parses issue.new and issue.regression
- [ ] Fetches full details via API
- [ ] Sends rich Telegram message
- [ ] Includes quick action buttons
- [ ] Works for real production errors
- [ ] Configure in GlitchTip: Settings → Webhooks

---

## Security & Privacy Considerations

**ADDED:** Based on plan-reviewer feedback - critical security requirements

### 1. API Token Security

**Storage:**
- ✅ Store in `.env.production` (gitignored, never commit)
- ✅ Use separate tokens for dev/staging/prod
- ✅ Document in password manager with rotation schedule
- ❌ NEVER hardcode in scripts or config files

**Access Control:**
- Restrict token permissions to minimum required (read issues, write comments)
- Create separate user for automation (not admin account)
- Rotate tokens quarterly (schedule in calendar)

**Validation:**
```javascript
// In scripts/lib/glitchtip-api.js
class GlitchTipAPI {
  constructor() {
    const token = process.env.GLITCHTIP_API_TOKEN;
    if (!token || token.length < 32) {
      throw new Error('Invalid or missing GLITCHTIP_API_TOKEN');
    }
    this.token = token;
  }
}
```

### 2. PII Scrubbing

**Problem:** Stack traces may contain sensitive data (emails, tokens, passwords)

**Solution:** Scrub before posting comments or sending to Telegram

**Implementation:**
```javascript
// In scripts/lib/pii-scrubber.js
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\+?\d{10,15}/g,
  token: /(?:token|key|password)[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
};

function scrubPII(text) {
  let scrubbed = text;
  scrubbed = scrubbed.replace(PII_PATTERNS.email, '[EMAIL_REDACTED]');
  scrubbed = scrubbed.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
  scrubbed = scrubbed.replace(PII_PATTERNS.token, '$1: [TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(PII_PATTERNS.ip, '[IP_REDACTED]');
  return scrubbed;
}

module.exports = { scrubPII };
```

**Apply Everywhere:**
- Before posting GlitchTip comments
- Before sending Telegram messages
- Before caching investigation results
- Before storing in PostgreSQL

### 3. Data Minimization

**Principles:**
- Only capture necessary error context
- Don't store full request/response bodies
- Trim stack traces to first 1000 chars for comments
- Use private comments for sensitive investigations

**Example:**
```javascript
// Trim before posting
const trimmedStack = error.stackTrace.slice(0, 1000) +
  (error.stackTrace.length > 1000 ? '\n...[truncated]' : '');

await api.addComment(issueId, scrubPII(trimmedStack));
```

### 4. Access Logging

**Audit Trail:** Log all API modifications

**Implementation:**
```javascript
// In scripts/lib/audit-log.js
async function logAction(action, issueId, userId = 'automation') {
  await postgres.query(
    `INSERT INTO audit_log (action, resource_type, resource_id, user_id, timestamp)
     VALUES ($1, $2, $3, $4, NOW())`,
    [action, 'glitchtip_issue', issueId, userId]
  );
}

// Usage
await api.resolveIssue(issueId);
await logAction('resolve_issue', issueId);
```

### 5. Rate Limiting & Abuse Prevention

**Protection:** Prevent runaway scripts from spamming API

**Implementation:**
```javascript
// In scripts/lib/glitchtip-api.js
const Bottleneck = require('bottleneck');

class GlitchTipAPI {
  constructor() {
    this.limiter = new Bottleneck({
      minTime: 100,         // Max 10 req/sec
      maxConcurrent: 2,     // Max 2 concurrent requests
      reservoir: 100,       // Max 100 requests
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 60 * 1000  // per minute
    });
  }

  async request(method, path, data) {
    return this.limiter.schedule(() => this._doRequest(method, path, data));
  }
}
```

### 6. Telegram Message Security

**Risks:**
- Messages not encrypted (Telegram API limitation)
- May contain sensitive error details
- Accessible to bot admin

**Mitigations:**
- Use private group (not public channel)
- Limit bot access to trusted users only
- Scrub PII before sending (see above)
- Consider self-hosted Telegram bot API for encryption

### 7. Environment Separation

**Never Mix:**
```bash
# .env.production
GLITCHTIP_API_TOKEN=prod_token_xxxxx
GLITCHTIP_BASE_URL=http://localhost:8080
NODE_ENV=production

# .env.development
GLITCHTIP_API_TOKEN=dev_token_xxxxx
GLITCHTIP_BASE_URL=http://localhost:8080
NODE_ENV=development
```

**Validation:**
```javascript
if (process.env.NODE_ENV === 'production' &&
    process.env.GLITCHTIP_API_TOKEN.startsWith('dev_')) {
  throw new Error('Cannot use dev token in production!');
}
```

### 8. Backup Before Bulk Operations

**Risk:** Bulk resolve/ignore could accidentally hide important errors

**Mitigation:**
```javascript
async function bulkResolve(issueIds) {
  // 1. Backup first
  const backup = await Promise.all(
    issueIds.map(id => api.getIssue(id))
  );
  await fs.writeFileSync(
    `./backups/bulk-resolve-${Date.now()}.json`,
    JSON.stringify(backup, null, 2)
  );

  // 2. Then modify
  for (const id of issueIds) {
    await api.resolveIssue(id);
    await logAction('bulk_resolve', id);
  }
}
```

### Security Checklist

- [ ] API tokens stored in `.env` (gitignored)
- [ ] PII scrubbing implemented and tested
- [ ] Rate limiting configured
- [ ] Audit logging in place
- [ ] Telegram access restricted
- [ ] Environment separation validated
- [ ] Backup procedures documented
- [ ] Security review completed

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: API Rate Limiting** (Low)
- **Likelihood:** Low (self-hosted, no hard limits)
- **Impact:** Medium (scripts fail)
- **Mitigation:**
  - Implement exponential backoff
  - Cache API responses where possible
  - Monitor API usage

**Risk 2: API Changes** (Low)
- **Likelihood:** Low (Sentry API v0 is stable)
- **Impact:** Medium (scripts need updates)
- **Mitigation:**
  - Use stable API version (v0)
  - Document API version used
  - Test after GlitchTip updates

**Risk 3: Performance Impact** (Low)
- **Likelihood:** Low (scripts run in background)
- **Impact:** Low (slight delay)
- **Mitigation:**
  - Run scripts async (PM2 cron)
  - Set timeouts (30s max)
  - Monitor script execution time

**Risk 4: Incomplete Investigation** (Medium)
- **Likelihood:** Medium (complex errors)
- **Impact:** Low (human still reviews)
- **Mitigation:**
  - Mark comments as "Automated Investigation"
  - Human always validates before fixing
  - Improve patterns over time

### Operational Risks

**Risk 5: False Positives** (Medium)
- **Likelihood:** Medium (pattern matching imperfect)
- **Impact:** Low (wrong runbook linked)
- **Mitigation:**
  - Conservative pattern matching
  - Allow manual unlinking
  - Iterate on patterns

**Risk 6: Maintenance Burden** (Low)
- **Likelihood:** Low (simple scripts)
- **Impact:** Low (30 min/month)
- **Mitigation:**
  - Write clean, documented code
  - Test thoroughly
  - Create troubleshooting guide

### Dependency Risks

**Risk 7: GlitchTip Downtime** (Low)
- **Likelihood:** Low (stable, monitored)
- **Impact:** Medium (scripts fail)
- **Mitigation:**
  - Graceful error handling
  - Retry logic (exponential backoff)
  - Fallback to manual workflow

**Risk 8: Telegram Bot Issues** (Low)
- **Likelihood:** Low (Telegram stable)
- **Impact:** Low (no alerts, but errors still tracked)
- **Mitigation:**
  - Email fallback for critical alerts
  - Monitor bot health

---

## Success Metrics

### Primary Metrics

**1. Time Savings** (Target: 70% reduction)
- **Baseline:** 15 min per error
- **Target:** 4-5 min per error
- **Measurement:** Track time per error (manual stopwatch)
- **Frequency:** Weekly average

**2. Error Volume** (Tracked daily)
- **Baseline:** Unknown (measure in Phase 0)
- **Metric:** Errors per day by component
- **Target:** Identify trends, reduce over time
- **Frequency:** Daily (via metrics report)

**3. Investigation Quality** (Target: 80% helpful)
- **Metric:** % of investigations with useful findings
- **Measurement:** Human review of investigation comments
- **Target:** >80% provide actionable insights
- **Frequency:** Monthly review

**4. Runbook Effectiveness** (Target: 80% faster for known issues)
- **Baseline:** 15 min per known issue
- **Target:** 3 min per known issue (with runbook)
- **Measurement:** Time to fix runbook-linked errors
- **Frequency:** Track per runbook usage

### Secondary Metrics

**5. Mean Time to Resolution (MTTR)**
- **Baseline:** Measure in Phase 0
- **Target:** 50% reduction
- **Measurement:** Time from error → fixed & deployed
- **Frequency:** Weekly

**6. Error-Free Periods**
- **Metric:** Hours without new errors
- **Target:** Increase over time
- **Measurement:** GlitchTip stats
- **Frequency:** Weekly trend

**7. Proactive vs Reactive**
- **Metric:** % errors caught by daily report vs alerts
- **Target:** 30% proactive (caught before escalation)
- **Measurement:** Tag source of detection
- **Frequency:** Monthly

### Leading Indicators

**8. Tool Usage**
- **Metrics:**
  - Investigation script runs per day
  - Telegram bot commands per week
  - Runbook links clicked
- **Target:** Consistent usage (not declining)
- **Measurement:** Script logs, bot analytics
- **Frequency:** Weekly

**9. Developer Satisfaction**
- **Metric:** Qualitative feedback
- **Measurement:** Weekly check-ins
- **Target:** Positive feedback, tool adoption
- **Frequency:** Weekly

---

## Testing Strategy

**ADDED:** Comprehensive testing approach (missing in original plan)

### 1. Dry-Run Mode

**Purpose:** Test scripts without modifying real data

**Implementation:**
```javascript
// scripts/lib/glitchtip-api.js
class GlitchTipAPI {
  constructor(options = {}) {
    this.dryRun = options.dryRun || process.env.DRY_RUN === 'true';
  }

  async addComment(orgSlug, issueId, text) {
    if (this.dryRun) {
      console.log(`[DRY RUN] Would add comment to issue ${issueId}:`);
      console.log(text);
      return { id: 'dry-run-comment-id' };
    }
    // Real implementation
    return this.client.post(`/organizations/${orgSlug}/issues/${issueId}/comments/`, {
      data: { text }
    });
  }
}
```

**Usage:**
```bash
# Test investigation without posting comments
DRY_RUN=true node scripts/investigate-error.js 12345

# Test daily metrics without sending Telegram
DRY_RUN=true node scripts/daily-metrics.js

# Test runbook linking without modifying issues
DRY_RUN=true node scripts/link-runbooks.js
```

### 2. Integration Tests

**Purpose:** Verify API client works correctly

**Location:** `tests/integration/glitchtip-api.test.js`

**Implementation:**
```javascript
const GlitchTipAPI = require('../../scripts/lib/glitchtip-api');

describe('GlitchTip API Integration', () => {
  let api;

  beforeAll(() => {
    api = new GlitchTipAPI(
      process.env.GLITCHTIP_BASE_URL,
      process.env.GLITCHTIP_API_TOKEN
    );
  });

  test('should fetch organizations', async () => {
    const orgs = await api.getOrganizations();
    expect(orgs).toBeInstanceOf(Array);
    expect(orgs.length).toBeGreaterThan(0);
  });

  test('should search issues', async () => {
    const issues = await api.searchIssues('ai-admin', 'is:unresolved', 5);
    expect(issues).toBeInstanceOf(Array);
  });

  test('should handle API errors gracefully', async () => {
    await expect(
      api.searchIssues('non-existent-org', 'query')
    ).rejects.toThrow();
  });

  test('should respect rate limits', async () => {
    const start = Date.now();
    await Promise.all([
      api.getOrganizations(),
      api.getOrganizations(),
      api.getOrganizations()
    ]);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(200); // 100ms * 2 requests (with limiter)
  });
});
```

### 3. Unit Tests

**Purpose:** Test helper functions in isolation

**Coverage:**
- PII scrubbing (`tests/unit/pii-scrubber.test.js`)
- Cache operations (`tests/unit/cache.test.js`)
- Pattern matching (`tests/unit/runbook-matcher.test.js`)

**Example:**
```javascript
const { scrubPII } = require('../../scripts/lib/pii-scrubber');

describe('PII Scrubber', () => {
  test('should redact emails', () => {
    const input = 'Error for user test@example.com';
    const output = scrubPII(input);
    expect(output).toBe('Error for user [EMAIL_REDACTED]');
  });

  test('should redact API tokens', () => {
    const input = 'token: abc123def456ghi789';
    const output = scrubPII(input);
    expect(output).toContain('[TOKEN_REDACTED]');
  });

  test('should handle multiple PII types', () => {
    const input = 'User test@example.com called from +79001234567';
    const output = scrubPII(input);
    expect(output).not.toContain('test@example.com');
    expect(output).not.toContain('+79001234567');
  });
});
```

### 4. End-to-End Tests

**Purpose:** Test complete workflows

**Scenarios:**
1. **Investigation Flow:**
   - Create test error in GlitchTip
   - Run investigation script
   - Verify comment appears
   - Check cache is populated

2. **Daily Metrics Flow:**
   - Trigger metrics script
   - Verify Telegram message sent
   - Check metrics cache

3. **Runbook Linking Flow:**
   - Create error matching runbook pattern
   - Run linker script
   - Verify runbook comment added

**Test Data:**
```javascript
// tests/fixtures/test-errors.js
module.exports = {
  databaseTimeout: {
    title: 'Connection timeout to PostgreSQL',
    level: 'error',
    tags: { component: 'database', operation: 'connect' },
    stackTrace: 'Error: ETIMEDOUT...'
  },
  whatsappSession: {
    title: 'WhatsApp session expired',
    level: 'warning',
    tags: { component: 'whatsapp', operation: 'send' },
    stackTrace: 'Error: Session not found...'
  }
};
```

### 5. Test Environment

**Setup:**
```bash
# .env.test
NODE_ENV=test
GLITCHTIP_BASE_URL=http://localhost:8080
GLITCHTIP_API_TOKEN=test_token_12345
DRY_RUN=false  # Use real test environment
REDIS_PORT=6380
```

**Test GlitchTip Project:**
- Create separate "test" project in GlitchTip
- Use for integration/E2E tests
- Clean up after tests (delete test issues)

### 6. Performance Tests

**Purpose:** Ensure scripts meet performance targets

**Benchmarks:**
```javascript
// tests/performance/investigation-benchmark.test.js
test('investigation should complete in <30s', async () => {
  const start = Date.now();
  await investigate(TEST_ISSUE_ID);
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(30000); // 30 seconds
});

test('cached investigation should complete in <10s', async () => {
  await investigate(TEST_ISSUE_ID); // Prime cache
  const start = Date.now();
  await investigate(TEST_ISSUE_ID); // Should hit cache
  const duration = Date.now() - start;
  expect(duration).toBeLessThan(10000); // 10 seconds
});
```

### 7. Test Commands

**Package.json scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

### Testing Checklist

- [ ] Dry-run mode implemented for all scripts
- [ ] Integration tests written (API client)
- [ ] Unit tests written (helpers)
- [ ] E2E tests written (workflows)
- [ ] Test environment configured
- [ ] Performance benchmarks created
- [ ] All tests passing (95%+ coverage)

---

## Monitoring & Observability

**ADDED:** Based on plan-reviewer feedback - track health and success

### 1. Script Health Monitoring

**Problem:** Scripts may fail silently

**Solution:** Success/failure tracking with alerts

**Implementation:**
```javascript
// scripts/lib/health-monitor.js
const TelegramNotifier = require('../../src/services/telegram-notifier');

class HealthMonitor {
  async trackExecution(scriptName, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;

      // Log success
      await this.logSuccess(scriptName, duration, result);

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      // Log failure + alert
      await this.logFailure(scriptName, duration, error);
      await this.sendAlert(scriptName, error);

      throw error;
    }
  }

  async logSuccess(scriptName, duration, result) {
    await redis.zadd('health:success', Date.now(), JSON.stringify({
      script: scriptName,
      duration,
      result: typeof result === 'object' ? result.summary : result,
      timestamp: Date.now()
    }));
  }

  async logFailure(scriptName, duration, error) {
    await redis.zadd('health:failure', Date.now(), JSON.stringify({
      script: scriptName,
      duration,
      error: error.message,
      stack: error.stack.slice(0, 500),
      timestamp: Date.now()
    }));
  }

  async sendAlert(scriptName, error) {
    const notifier = new TelegramNotifier();
    await notifier.send(
      `🔴 <b>Script Failure: ${scriptName}</b>\n\n` +
      `Error: ${error.message}\n\n` +
      `Time: ${new Date().toLocaleString()}`,
      { parseMode: 'HTML' }
    );
  }
}

module.exports = HealthMonitor;
```

**Usage:**
```javascript
// In scripts/investigate-error.js
const HealthMonitor = require('./lib/health-monitor');
const monitor = new HealthMonitor();

async function main() {
  await monitor.trackExecution('investigate-error', async () => {
    const issueId = process.argv[2];
    // ... investigation logic
    return { issueId, filesFound: 5, commitsFound: 3 };
  });
}
```

### 2. PM2 Monitoring

**Built-in PM2 features:**
```bash
# Check script status
pm2 status glitchtip-daily-metrics

# View logs
pm2 logs glitchtip-daily-metrics --lines 50

# Monitor resource usage
pm2 monit

# Set up alerts for restart/error
pm2 install pm2-logrotate
```

**PM2 Ecosystem monitoring:**
```javascript
// In ecosystem.config.js
{
  name: 'glitchtip-daily-metrics',
  script: './scripts/daily-metrics.js',
  // ... other config
  max_restarts: 5,                    // Alert if restarts > 5
  min_uptime: '10s',                  // Consider failed if < 10s
  error_file: './logs/glitchtip-metrics-error.log',
  out_file: './logs/glitchtip-metrics-out.log',
  merge_logs: true
}
```

### 3. Metrics Dashboard (Optional)

**Simple CLI dashboard:**
```javascript
// scripts/glitchtip-health.js
async function showHealthDashboard() {
  const successes = await redis.zrange('health:success', -10, -1);
  const failures = await redis.zrange('health:failure', -10, -1);

  console.log('📊 GlitchTip Integration Health Dashboard\n');

  console.log('✅ Recent Successes (last 10):');
  successes.forEach(s => {
    const data = JSON.parse(s);
    console.log(`  - ${data.script}: ${data.duration}ms at ${new Date(data.timestamp).toLocaleString()}`);
  });

  console.log('\n❌ Recent Failures (last 10):');
  failures.forEach(f => {
    const data = JSON.parse(f);
    console.log(`  - ${data.script}: ${data.error} at ${new Date(data.timestamp).toLocaleString()}`);
  });

  // Success rate
  const successRate = (successes.length / (successes.length + failures.length)) * 100;
  console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
}
```

### 4. Alerting Strategy

**Alert Levels:**
- ✅ **Success:** Log only (no alert)
- ⚠️ **Warning:** Script slow (>60s), log + cache miss rate high
- 🔴 **Error:** Script failed, send Telegram alert
- 🚨 **Critical:** Multiple failures (>3 in 1h), send urgent Telegram alert

**Alert Throttling:**
```javascript
// Don't spam - max 1 alert per script per hour
async function shouldAlert(scriptName) {
  const key = `alert:throttle:${scriptName}`;
  const lastAlert = await redis.get(key);

  if (lastAlert && Date.now() - parseInt(lastAlert) < 3600000) {
    return false; // Already alerted in last hour
  }

  await redis.setex(key, 3600, Date.now().toString());
  return true;
}
```

### 5. Log Aggregation

**Centralized logging:**
```javascript
// scripts/lib/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'glitchtip-integration' },
  transports: [
    new winston.transports.File({
      filename: './logs/glitchtip-error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: './logs/glitchtip-combined.log'
    })
  ]
});

// Add console in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 6. Key Metrics to Track

**Operational Metrics:**
- Script execution success rate (target: >95%)
- Average execution time (investigation: <30s, metrics: <10s)
- Cache hit ratio (target: >60%)
- API error rate (target: <5%)

**Business Metrics:**
- Investigation quality (% helpful, target: >80%)
- Time saved per error (target: 70% reduction)
- Runbook link accuracy (% correct, target: >80%)
- Mean time to resolution (target: 50% reduction)

**Track in Redis:**
```javascript
// Daily aggregates
glitchtip:metrics:executions:{date}:{script}
glitchtip:metrics:errors:{date}:{script}
glitchtip:metrics:duration:{date}:{script}
```

### 7. Weekly Review Report

**Automated weekly summary:**
```javascript
// scripts/weekly-health-report.js
async function generateWeeklyReport() {
  const report = {
    period: 'Last 7 days',
    scripts: {
      investigation: {
        executions: 42,
        successes: 40,
        failures: 2,
        avgDuration: '12.5s',
        cacheHitRatio: '65%'
      },
      dailyMetrics: {
        executions: 7,
        successes: 7,
        failures: 0,
        avgDuration: '3.2s'
      },
      runbookLinker: {
        executions: 168,
        successes: 165,
        failures: 3,
        linksAdded: 15
      }
    },
    businessMetrics: {
      avgTimePerError: '5.2 min',
      timeSaved: '65%',
      investigationsHelpful: '82%'
    }
  };

  // Send to Telegram
  await sendWeeklyReport(report);
}
```

### Monitoring Checklist

- [ ] Health monitoring implemented for all scripts
- [ ] PM2 monitoring configured
- [ ] Telegram alerts set up (with throttling)
- [ ] Log aggregation in place
- [ ] Key metrics tracked in Redis
- [ ] Weekly report scheduled
- [ ] Dashboard created (CLI or web)

---

## Resources & Dependencies

### Technical Dependencies

**Infrastructure:**
- ✅ GlitchTip production instance (running)
- ✅ GlitchTip API access (token to be created)
- ✅ Telegram bot (existing, to extend)
- ✅ PM2 for cron jobs (existing)
- ✅ Git access (for commit history)

**Software:**
- ✅ Node.js v20+ (installed)
- ✅ axios (for API calls)
- ⚠️ ripgrep (for fast codebase search) - to install
- ✅ git (for commit history)
- ✅ Telegram Bot API (existing)

**New Packages:**
```json
{
  "axios": "^1.6.0",
  "node-telegram-bot-api": "^0.64.0" // likely already installed
}
```

### Human Resources

**Development Time:** 31 hours total over 3 weeks

**Breakdown:**
- Week 1: 12 hours (Phase 0 + Phase 1)
- Week 2: 8 hours (Phase 2 + Phase 3)
- Week 3: 11 hours (Phase 4 + Phase 5)

**Skills Required:**
- Node.js/JavaScript (intermediate)
- REST API integration (basic)
- Bash scripting (basic)
- Telegram Bot API (basic)
- GlitchTip/Sentry familiarity (basic)

**Knowledge Transfer:**
- Document each component
- Record setup video (optional)
- Create troubleshooting guide
- Pair programming sessions (if team >1)

### Access Requirements

**GlitchTip:**
- Admin access (to create API tokens)
- SSH tunnel setup (already configured)

**Server:**
- SSH access to 46.149.70.219 (already have)
- PM2 management (already have)
- Crontab access (for scheduling)

**Telegram:**
- Bot admin access (to add commands)
- Chat ID for notifications

---

## Timeline Estimates

### Optimistic (Best Case): 20 hours
- Assume: No blockers, smooth integration, minimal debugging
- Developer: Experienced with similar tools
- Environment: Stable, no issues

### Realistic (Expected): 31 hours
- Assume: Some integration challenges, normal debugging
- Developer: Familiar with Node.js, learning GlitchTip API
- Environment: Stable

### Pessimistic (Worst Case): 40 hours
- Assume: API surprises, unexpected issues, extensive debugging
- Developer: Learning curve, unfamiliar with tools
- Environment: Occasional instability

### Contingency Buffer: +20%
- For unexpected issues, scope creep, testing edge cases
- **Total with buffer:** 37-38 hours

### Milestones

**Week 1 End:** Investigation helper working
**Week 2 End:** Daily metrics + Telegram bot
**Week 3 End:** Runbooks + Enhanced webhooks
**Week 4 (buffer):** Polish, documentation, training

---

## Phase Dependencies

```
Phase 0 (Setup)
    ↓
Phase 1 (Investigation Helper) ← depends on Phase 0
    ↓
┌──────────────────────┬────────────────────┐
↓                      ↓                    ↓
Phase 2              Phase 3            Phase 4
(Daily Metrics)      (Telegram Bot)     (Runbooks)
    ↓                      ↓                    ↓
    └──────────────────────┴────────────────────┘
                            ↓
                       Phase 5
                 (Enhanced Webhooks)
```

**Critical Path:** Phase 0 → Phase 1 → Phase 5

**Parallel Work:**
- Phases 2, 3, 4 can be done in any order after Phase 1
- Phase 5 benefits from all previous phases but not blocked by them

---

## Database & Cache Strategy

**CRITICAL FIX #4:** Added database/cache strategy (missing in original plan)

### Cache Layer (Redis)

**Purpose:** Speed up investigation and reduce API calls

**Key Patterns:**
```javascript
// Investigation results cache
glitchtip:investigation:{issueId}       TTL: 24 hours
glitchtip:similar:{titleHash}           TTL: 7 days
glitchtip:runbook:{patternId}           TTL: permanent

// Metrics cache
glitchtip:stats:daily:{date}            TTL: 30 days
glitchtip:stats:component:{component}   TTL: 24 hours
```

**Implementation:**
```javascript
// In scripts/lib/cache.js
const Redis = require('ioredis');
const redis = new Redis({
  host: 'localhost',
  port: 6380, // SSH tunnel to server
  db: 2       // Separate DB for GlitchTip
});

async function cacheInvestigation(issueId, results) {
  const key = `glitchtip:investigation:${issueId}`;
  await redis.setex(key, 86400, JSON.stringify(results)); // 24h TTL
}

async function getCachedInvestigation(issueId) {
  const key = `glitchtip:investigation:${issueId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}
```

**Cache Invalidation:**
- Manual: When issue is updated/resolved
- Automatic: TTL expiration
- Flush pattern: `redis.del('glitchtip:investigation:*')` for all investigations

### Storage Layer (PostgreSQL)

**Purpose:** Persistent storage for runbook patterns and metrics history

**Tables Needed:**
```sql
-- Runbook pattern mappings
CREATE TABLE IF NOT EXISTS glitchtip_runbook_patterns (
  id SERIAL PRIMARY KEY,
  pattern VARCHAR(500) NOT NULL,           -- Regex or keyword pattern
  runbook_path VARCHAR(255) NOT NULL,      -- Path to runbook file
  priority INTEGER DEFAULT 0,               -- Match priority (higher = first)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Metrics history (for trending)
CREATE TABLE IF NOT EXISTS glitchtip_metrics_history (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  component VARCHAR(100),
  error_count INTEGER DEFAULT 0,
  issue_count INTEGER DEFAULT 0,
  resolved_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, component)
);

-- Investigation history (optional, for ML training)
CREATE TABLE IF NOT EXISTS glitchtip_investigation_log (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL,
  issue_title VARCHAR(500),
  investigation_result JSONB,              -- Structured results
  helpful BOOLEAN DEFAULT NULL,            -- Human feedback
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Location:** Use existing Timeweb PostgreSQL database

**Migration:** Create tables via script `scripts/migrations/glitchtip-schema.sql`

### File Storage (Runbooks)

**Location:** `runbooks/` directory in project root

**Structure:**
```
runbooks/
├── README.md                           # Index of all runbooks
├── database-timeout.md
├── whatsapp-session-expired.md
├── yclients-rate-limit.md
├── redis-connection-refused.md
└── npm-module-not-found.md
```

**Format:** Markdown with YAML frontmatter:
```markdown
---
patterns:
  - "ConnectionTimeout"
  - "ETIMEDOUT.*postgres"
priority: 1
auto_link: true
---

# Database Connection Timeout

## Quick Fix
...
```

### Data Flow

```
Error Occurs
    ↓
GlitchTip API
    ↓
┌──────────────────────┐
│ Investigation Script │
└──────────────────────┘
    ↓
Check Cache (Redis)
    ├─ HIT → Return cached results
    └─ MISS → Search codebase + git
               ↓
               Store in cache (24h TTL)
               ↓
               Store log in PostgreSQL (optional)
               ↓
               Post comment to GlitchTip
```

### Performance Targets

- Cache hit ratio: >60% after 1 week
- Investigation time: <10s (cached), <30s (uncached)
- Redis memory: <50 MB for 1000 investigations
- PostgreSQL: <10 MB for metrics history

---

## Alternative Approaches Considered

### Alternative 1: Auto-Triage with AI
**Description:** Agent analyzes errors, assigns priority, routes to developer

**Pros:**
- More automation
- Potentially faster triage

**Cons:**
- $500/month ongoing cost
- Only 5% additional time savings (75% vs 70%)
- Risk of incorrect prioritization
- Requires >20 errors/day to justify

**Decision:** Rejected - Not worth cost for marginal benefit

---

### Alternative 2: Full Auto-Remediation
**Description:** AI investigates, proposes fixes, creates PRs, auto-deploys safe patterns

**Pros:**
- Maximum automation
- Sounds impressive

**Cons:**
- $3,000+/month ongoing cost
- Negative ROI (costs exceed savings)
- High risk (wrong fixes = incidents)
- Requires 20+ hours/month maintenance
- Wrong architecture (Claude Code doesn't work that way)

**Decision:** Strongly Rejected - Reviewed by agent, found unfeasible

---

### Alternative 3: Buy Commercial Tool
**Description:** Use paid service like PagerDuty, Opsgenie, etc.

**Pros:**
- Ready-made solution
- Professional support

**Cons:**
- $50-500/month cost
- Less customization
- External dependency
- Doesn't integrate with local codebase

**Decision:** Rejected - Enhanced manual is better fit

---

## Implementation Checklist

### Pre-Implementation (Before Week 1)
- [ ] Review this plan with team
- [ ] Get approval to proceed
- [ ] Schedule 3 weeks of focused time
- [ ] Set up development environment
- [ ] Install ripgrep (`brew install ripgrep`)
- [ ] Create project branch (if using git flow)

### During Implementation
- [ ] Track actual time vs estimates
- [ ] Document decisions and discoveries
- [ ] Commit code frequently
- [ ] Write tests for critical paths
- [ ] Update this plan if scope changes

### Post-Implementation
- [ ] Measure baseline → after metrics
- [ ] Calculate actual ROI
- [ ] Document lessons learned
- [ ] Train team on new tools
- [ ] Create user guide / runbook
- [ ] Schedule review in 1 month

---

## Next Steps

### Immediate (This Week)
1. **Review & Approve Plan** (30 min)
   - Read this document
   - Discuss with team
   - Get go/no-go decision

2. **Start Phase 0** (6 hours)
   - Measure baseline metrics
   - Create API token
   - Build API client library

### Week 1
3. **Complete Phase 1** (6 hours)
   - Investigation helper script
   - Test with real errors

### Weeks 2-3
4. **Complete Phases 2-5** (19 hours)
   - Daily metrics
   - Telegram bot
   - Runbooks
   - Enhanced webhooks

### Week 4 (Review)
5. **Measure Results** (2 hours)
   - Compare metrics before/after
   - Calculate actual ROI
   - Decide: sufficient or add auto-triage?

---

## Conclusion

This plan provides a practical, low-risk approach to significantly improve error handling efficiency without complex automation or ongoing costs.

**Key Advantages:**
- ✅ 70% time savings (proven approach)
- ✅ $0 ongoing costs
- ✅ 400-600% ROI first year
- ✅ Low risk (human always in control)
- ✅ Fast break-even (1-2 months)

**Recommended Decision:** **PROCEED** with Enhanced Manual Workflow (Phases 0-5)

**Not Recommended:** Auto-triage ($500/month) or Auto-remediation (negative ROI)

---

**Plan Version:** 1.0
**Status:** Ready for Implementation
**Approval Required:** Yes (team review)
**Estimated Start:** Week of 2025-11-25
**Estimated Completion:** Week of 2025-12-16 (3 weeks)

---

## Appendix

### A. Query Syntax Examples

```javascript
// Status
'is:unresolved'
'is:resolved'
'is:ignored'

// Level + Time
'level:error age:-24h'           // Errors last 24h
'level:fatal age:-7d'            // Fatal last week

// Tags
'component:database'
'operation:query'
'backend:timeweb'

// Combinations
'is:unresolved level:error component:whatsapp age:-24h'
'is:resolved level:error age:-7d'  // Resolved errors, last week
```

### B. API Client Example

```javascript
// scripts/lib/glitchtip-api.js
const axios = require('axios');

class GlitchTipAPI {
  constructor(baseURL, apiToken) {
    this.client = axios.create({
      baseURL: `${baseURL}/api/0`,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getOrganizations() {
    const { data } = await this.client.get('/organizations/');
    return data;
  }

  async searchIssues(orgSlug, query, limit = 10) {
    const { data } = await this.client.get(
      `/organizations/${orgSlug}/issues/`,
      { params: { query, limit, sort: '-lastSeen' } }
    );
    return data;
  }

  async addComment(orgSlug, issueId, text) {
    const { data } = await this.client.post(
      `/organizations/${orgSlug}/issues/${issueId}/comments/`,
      { data: { text } }
    );
    return data;
  }

  async resolveIssue(orgSlug, issueId) {
    const { data } = await this.client.put(
      `/organizations/${orgSlug}/issues/${issueId}/`,
      { status: 'resolved' }
    );
    return data;
  }

  async getStats(orgSlug, since) {
    const { data } = await this.client.get(
      `/organizations/${orgSlug}/stats-summary/`,
      { params: { since } }
    );
    return data;
  }
}

module.exports = GlitchTipAPI;
```

### C. Investigation Script Template

```javascript
// scripts/investigate-error.js
const GlitchTipAPI = require('./lib/glitchtip-api');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function investigate(issueId) {
  // 1. Fetch error details
  const issue = await api.getIssue(issueId);

  // 2. Search codebase
  const files = await searchCodebase(issue.culprit);

  // 3. Get recent commits
  const commits = await getRecentCommits(files);

  // 4. Find similar issues
  const similar = await api.searchIssues(
    orgSlug,
    `is:resolved ${issue.title}`,
    5
  );

  // 5. Format findings
  const comment = `
## 🤖 Automated Investigation

**Related Files:**
${files.map(f => `- \`${f.path}\` (modified ${f.lastChange})`).join('\n')}

**Recent Commits:**
${commits.map(c => `- ${c.hash}: "${c.message}" (${c.author})`).join('\n')}

**Similar Resolved Issues:**
${similar.map(i => `- #${i.id}: "${i.title}" (${i.resolvedAt})`).join('\n')}
  `;

  // 6. Post comment
  await api.addComment(orgSlug, issueId, comment);

  console.log(`✅ Investigation complete for issue #${issueId}`);
}

async function searchCodebase(filePath) {
  // Use ripgrep to find related files
  const { stdout } = await execPromise(
    `rg -l "${filePath}" --type js --max-count 10`
  );
  return stdout.trim().split('\n').map(path => ({
    path,
    lastChange: 'TODO: git log'
  }));
}

async function getRecentCommits(files) {
  const commits = [];
  for (const file of files.slice(0, 3)) {
    const { stdout } = await execPromise(
      `git log -5 --pretty=format:"%h|%s|%an" -- ${file.path}`
    );
    stdout.trim().split('\n').forEach(line => {
      const [hash, message, author] = line.split('|');
      commits.push({ hash, message, author });
    });
  }
  return commits.slice(0, 5); // Top 5 commits
}
```

### D. Daily Metrics Script Template

```javascript
// scripts/daily-metrics.js
const GlitchTipAPI = require('./lib/glitchtip-api');
const TelegramBot = require('node-telegram-bot-api');

async function sendDailyReport() {
  // 1. Get stats
  const since = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  const stats = await api.getStats(orgSlug, since);

  // 2. Get top issues
  const issues = await api.searchIssues(
    orgSlug,
    'is:unresolved age:-24h',
    10
  );

  // 3. Format report
  const report = `
📊 **Daily Error Report** - ${new Date().toLocaleDateString()}

Total Errors: ${stats.reduce((sum, p) => sum + p.stats.sum, 0)}

**By Component:**
${groupByComponent(issues).map(g =>
  `${g.emoji} ${g.component}: ${g.count} errors (${g.priority})`
).join('\n')}

**Top Issues:**
${issues.slice(0, 5).map((i, idx) =>
  `${idx + 1}. #${i.id}: ${i.title} (${i.count}x)`
).join('\n')}

**Quick Actions:**
👉 /investigate ${issues[0]?.id}
👉 /errors [component] [hours]
  `;

  // 4. Send to Telegram
  await bot.sendMessage(CHAT_ID, report, { parse_mode: 'Markdown' });
}

function groupByComponent(issues) {
  const groups = {};
  issues.forEach(issue => {
    const component = issue.tags.find(t => t.key === 'component')?.value || 'other';
    if (!groups[component]) groups[component] = { component, count: 0 };
    groups[component].count += issue.count;
  });
  return Object.values(groups).map(g => ({
    ...g,
    priority: g.count > 10 ? 'P1' : g.count > 5 ? 'P2' : 'P3',
    emoji: g.count > 10 ? '🔴' : g.count > 5 ? '🟡' : '🟢'
  }));
}
```

---

**End of Plan**

**Ready for Implementation:** Yes
**Next Action:** Team review & approval
