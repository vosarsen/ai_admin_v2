# GlitchTip API Integration - Task Checklist

**Last Updated:** 2025-11-24
**Status:** Planning Complete → Ready for Implementation
**Progress:** 0/31 hours (0%)

---

## Quick Status

| Phase | Tasks | Effort | Status | Progress |
|-------|-------|--------|--------|----------|
| Phase 0: Setup | 3 | 6h | Not Started | 0% |
| Phase 1: Investigation | 3 | 6h | Not Started | 0% |
| Phase 2: Metrics | 3 | 4h | Not Started | 0% |
| Phase 3: Bot | 3 | 4h | Not Started | 0% |
| Phase 4: Runbooks | 3 | 5h | Not Started | 0% |
| Phase 5: Webhooks | 3 | 6h | Not Started | 0% |
| **TOTAL** | **18** | **31h** | **Not Started** | **0%** |

---

## Phase 0: Setup & Baseline (Week 1, Days 1-2: 6 hours)

**Objective:** Establish baseline metrics and configure API access

### Task 0.1: Baseline Measurement (2 hours, S)
- [ ] Create metrics tracking spreadsheet
- [ ] Measure: Current error volume (errors/day)
- [ ] Measure: Time per error (triage, investigation, fix)
- [ ] Measure: Breakdown by component
- [ ] Document current workflow steps
- [ ] Identify pain points (most time-consuming steps)
- [ ] **Output:** Baseline metrics doc for ROI calculation

**Acceptance Criteria:**
- [ ] Know current error volume (X errors/day)
- [ ] Know current time per error (Y minutes)
- [ ] Documented workflow with time per step
- [ ] Identified top 3 pain points

---

### Task 0.2: API Token Setup (1 hour, S)
- [ ] SSH to server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- [ ] Create SSH tunnel: `ssh -L 9090:localhost:8080 -N -f root@...`
- [ ] Open GlitchTip UI: http://localhost:9090
- [ ] Login: support@adminai.tech / AdminSecure2025
- [ ] Navigate: Settings → Auth Tokens
- [ ] Create new token: "glitchtip-api-integration"
- [ ] Copy token to secure location (password manager)
- [ ] Test with example script: `export GLITCHTIP_TOKEN=xxx && node scripts/glitchtip-api-example.js`
- [ ] Verify: Script returns organizations & issues
- [ ] **Output:** Working API token, test successful

**Acceptance Criteria:**
- [ ] API token created in GlitchTip UI
- [ ] Token saved securely
- [ ] Example script runs successfully
- [ ] Can fetch organizations & issues via API

---

### Task 0.3: API Client Library (3 hours, M)
- [ ] Create `scripts/lib/` directory
- [ ] Create `scripts/lib/glitchtip-api.js`
- [ ] Implement GlitchTipAPI class:
  - [ ] Constructor (baseURL, apiToken)
  - [ ] getOrganizations()
  - [ ] getIssues(orgSlug, params)
  - [ ] searchIssues(orgSlug, query, limit, sort)
  - [ ] getIssue(orgSlug, issueId)
  - [ ] addComment(orgSlug, issueId, text)
  - [ ] resolveIssue(orgSlug, issueId)
  - [ ] getStats(orgSlug, since)
- [ ] Add error handling (try/catch, retries)
- [ ] Add rate limiting (if needed)
- [ ] Write basic tests (scripts/lib/glitchtip-api.test.js)
- [ ] Test each method with production data
- [ ] Document usage examples in README
- [ ] **Output:** Reusable API client library

**Acceptance Criteria:**
- [ ] GlitchTipAPI class created
- [ ] All 8 methods implemented
- [ ] Error handling works (400, 404, 500)
- [ ] Tests pass (5+ smoke tests)
- [ ] Usage documented
- [ ] Ready to use in scripts

---

## Phase 1: Investigation Helper (Week 1, Days 3-5: 6 hours)

**Objective:** Automate error investigation (codebase search, git history, similar issues)

### Task 1.1: Core Investigation Logic (3 hours, M)
- [ ] Create `scripts/investigate-error.js`
- [ ] Parse command-line args (issue ID)
- [ ] Fetch error details via API:
  - [ ] Issue title, level, count
  - [ ] Stack trace (culprit file)
  - [ ] Tags (component, operation)
- [ ] Parse stack trace for file paths:
  - [ ] Extract file path from first frame
  - [ ] Extract function name
- [ ] Search codebase for related files:
  - [ ] Install ripgrep: `brew install ripgrep`
  - [ ] Search for file references: `rg -l "filename"`
  - [ ] Limit to top 10 results
- [ ] Get recent commits for files:
  - [ ] Run `git log -5 --pretty=format:"%h|%s|%an" -- file`
  - [ ] Parse commit hash, message, author
- [ ] **Output:** Investigation script (CLI)

**Acceptance Criteria:**
- [ ] Script runs: `./scripts/investigate-error.js 12345`
- [ ] Fetches error details from GlitchTip
- [ ] Parses stack trace correctly
- [ ] Finds related files (3-10 files)
- [ ] Gets recent commits (5 per file)
- [ ] Execution time: <30 seconds

---

### Task 1.2: Similar Issues Search (2 hours, S)
- [ ] Query GlitchTip for resolved issues:
  - [ ] Query: `is:resolved ${similarTitle}`
  - [ ] Limit: 5 results
  - [ ] Sort by lastSeen
- [ ] Score similarity:
  - [ ] Exact title match: score 1.0
  - [ ] Substring match: score 0.7
  - [ ] Word overlap: score 0.5
- [ ] Extract resolution info:
  - [ ] Resolved date
  - [ ] Resolution comment (if exists)
  - [ ] Assignee who fixed
- [ ] **Output:** Similar issues finder

**Acceptance Criteria:**
- [ ] Finds similar resolved issues
- [ ] Scores similarity (0.0-1.0)
- [ ] Returns top 5 matches
- [ ] Includes resolution date & comment
- [ ] Works for various error types

---

### Task 1.3: Comment Integration (1 hour, S)
- [ ] Format investigation findings as markdown:
  - [ ] Section: Related Files
  - [ ] Section: Recent Commits
  - [ ] Section: Similar Resolved Issues
  - [ ] Header: "🤖 Automated Investigation"
  - [ ] Footer: Timestamp, script version
- [ ] Post comment via API:
  - [ ] Use addComment(orgSlug, issueId, markdown)
  - [ ] Handle errors (404, permission denied)
- [ ] Print success message with URL
- [ ] Test with real production error
- [ ] **Output:** Auto-comments on issues

**Acceptance Criteria:**
- [ ] Markdown comment formatted correctly
- [ ] Posted to GlitchTip issue
- [ ] Includes related files (3-10)
- [ ] Includes recent commits (5-10)
- [ ] Includes similar issues (0-5)
- [ ] Works end-to-end with real error

---

## Phase 2: Daily Metrics & Proactive Monitoring (Week 2, Days 1-2: 4 hours)

**Objective:** Proactive error monitoring via daily reports

### Task 2.1: Stats Aggregation (2 hours, M)
- [ ] Create `scripts/daily-metrics.js`
- [ ] Query GlitchTip API for stats:
  - [ ] Get stats for last 24h
  - [ ] Get unresolved issues (age:-24h)
  - [ ] Group by component/service
- [ ] Calculate totals:
  - [ ] Total error count
  - [ ] Count by component
  - [ ] Top 5 issues by count
- [ ] Calculate trends:
  - [ ] Compare vs yesterday (if cached)
  - [ ] Flag increasing trends
- [ ] Cache results for trend comparison
- [ ] **Output:** Stats aggregation script

**Acceptance Criteria:**
- [ ] Fetches stats via API
- [ ] Groups errors by component
- [ ] Identifies top 5 issues
- [ ] Calculates trends (vs yesterday)
- [ ] Execution time: <10 seconds

---

### Task 2.2: Telegram Integration (1 hour, S)
- [ ] Get Telegram chat ID (for reports)
- [ ] Format report as rich markdown:
  - [ ] Emoji indicators (🔴🟡🟢)
  - [ ] Priority labels (P0-P3)
  - [ ] Issue permalinks
  - [ ] Quick action buttons
- [ ] Send via Telegram Bot API:
  - [ ] Use existing bot token
  - [ ] Parse mode: Markdown
  - [ ] Disable preview
- [ ] Test message formatting
- [ ] **Output:** Formatted Telegram report

**Acceptance Criteria:**
- [ ] Report sent to Telegram
- [ ] Markdown formatted correctly
- [ ] Includes emojis & priorities
- [ ] Links work (clickable)
- [ ] Quick action buttons shown
- [ ] Looks good on mobile & desktop

---

### Task 2.3: Cron Scheduling (1 hour, S)
- [ ] Add to PM2 ecosystem config:
  - [ ] Name: daily-metrics
  - [ ] Script: scripts/daily-metrics.js
  - [ ] Cron: "0 9 * * *" (9 AM daily)
- [ ] Deploy to PM2: `pm2 start ecosystem.config.js`
- [ ] Test manual execution: `pm2 trigger daily-metrics`
- [ ] Check logs: `pm2 logs daily-metrics --lines 50`
- [ ] Wait for cron execution (next 9 AM)
- [ ] Verify received report in Telegram
- [ ] **Output:** Automated daily reports

**Acceptance Criteria:**
- [ ] PM2 cron job configured
- [ ] Manual trigger works
- [ ] Logs show execution
- [ ] Report received at 9 AM daily
- [ ] No errors in logs
- [ ] Reliable 95%+ delivery

---

## Phase 3: Telegram Bot Commands (Week 2, Days 3-5: 4 hours)

**Objective:** Fast error queries and actions via Telegram

### Task 3.1: Bot Command Router (2 hours, M)
- [ ] Extend existing Telegram bot (src/services/telegram-bot/)
- [ ] Create `glitchtip-commands.js` module
- [ ] Register commands:
  - [ ] `/errors [component] [hours]` - Query errors
  - [ ] `/resolve <issue_id>` - Resolve issue
  - [ ] `/investigate <issue_id>` - Run investigation
  - [ ] `/stats [period]` - Get statistics
- [ ] Add command descriptions (for /help)
- [ ] Import in bot index file
- [ ] Test command registration
- [ ] **Output:** Bot command handlers

**Acceptance Criteria:**
- [ ] 4 commands registered
- [ ] Command parser works
- [ ] /help shows new commands
- [ ] Commands routed correctly
- [ ] Error handling for invalid syntax

---

### Task 3.2: Query Implementation (1 hour, S)
- [ ] Implement `/errors [component] [hours]`:
  - [ ] Parse args (component, hours)
  - [ ] Build query: `component:X age:-Yh is:unresolved`
  - [ ] Fetch via API (limit 10)
  - [ ] Format as list (emoji, title, count, link)
  - [ ] Send to Telegram
- [ ] Implement `/stats [period]`:
  - [ ] Parse period (24h, 7d, 30d)
  - [ ] Fetch stats via API
  - [ ] Format summary (total, by component)
  - [ ] Send to Telegram
- [ ] Test with various queries
- [ ] **Output:** Working query commands

**Acceptance Criteria:**
- [ ] `/errors database 24h` works
- [ ] Returns top 10 results
- [ ] Formatted correctly
- [ ] Links work
- [ ] `/stats 7d` works
- [ ] Shows aggregates

---

### Task 3.3: Action Commands (1 hour, S)
- [ ] Implement `/resolve <issue_id>`:
  - [ ] Parse issue ID
  - [ ] Call API to resolve issue
  - [ ] Return confirmation message
  - [ ] Handle errors (not found, no permission)
- [ ] Implement `/investigate <issue_id>`:
  - [ ] Parse issue ID
  - [ ] Trigger investigation script
  - [ ] Return "Investigation running..." message
  - [ ] Send results when complete (or error)
- [ ] Test with real issues
- [ ] **Output:** Working action commands

**Acceptance Criteria:**
- [ ] `/resolve 12345` works
- [ ] Issue marked as resolved in GlitchTip
- [ ] Confirmation sent to Telegram
- [ ] `/investigate 12345` works
- [ ] Investigation runs async
- [ ] Results sent when complete
- [ ] Errors handled gracefully

---

## Phase 4: Runbook Integration (Week 3, Days 1-2: 5 hours)

**Objective:** Link known errors to runbook documentation

### Task 4.1: Runbook Repository (2 hours, M)
- [ ] Create `runbooks/` directory
- [ ] Create runbook template (runbooks/TEMPLATE.md)
- [ ] Document 5 common errors:
  - [ ] database-timeout.md (connection pool, slow queries)
  - [ ] whatsapp-session-expired.md (session refresh, authentication)
  - [ ] yclients-rate-limit.md (backoff, caching)
  - [ ] redis-connection-refused.md (service restart, connection check)
  - [ ] npm-module-not-found.md (npm install, package.json check)
- [ ] Each runbook includes:
  - [ ] Symptoms (how to identify)
  - [ ] Diagnosis (how to investigate)
  - [ ] Fix (step-by-step commands)
  - [ ] Prevention (how to avoid)
- [ ] **Output:** 5 documented runbooks

**Acceptance Criteria:**
- [ ] 5 runbooks created (markdown)
- [ ] Each has all 4 sections
- [ ] Commands are copy-pasteable
- [ ] Includes real examples
- [ ] Reviewed by team
- [ ] Stored in Git

---

### Task 4.2: Pattern Matching (2 hours, M)
- [ ] Create `scripts/link-runbooks.js`
- [ ] Define pattern mappings:
  ```javascript
  const PATTERNS = {
    'ConnectionTimeout': 'runbooks/database-timeout.md',
    'SessionExpired': 'runbooks/whatsapp-session-expired.md',
    'RateLimitExceeded': 'runbooks/yclients-rate-limit.md',
    'ECONNREFUSED.*redis': 'runbooks/redis-connection-refused.md',
    'Cannot find module': 'runbooks/npm-module-not-found.md'
  };
  ```
- [ ] Fetch unresolved issues via API
- [ ] Match issue title against patterns (regex)
- [ ] Check if runbook comment already exists:
  - [ ] Fetch issue comments
  - [ ] Search for "📖 Runbook Available" marker
- [ ] Add comment if match & not exists:
  - [ ] Format: "📖 Runbook Available: [link]"
  - [ ] Include: Brief description
- [ ] Log results (matched, commented, skipped)
- [ ] **Output:** Runbook linker script

**Acceptance Criteria:**
- [ ] Pattern matching works (regex)
- [ ] Fetches unresolved issues
- [ ] Detects existing runbook comments
- [ ] Doesn't duplicate comments
- [ ] Adds comment for matches
- [ ] Logs actions taken

---

### Task 4.3: Automation (1 hour, S)
- [ ] Add to PM2 ecosystem config:
  - [ ] Name: link-runbooks
  - [ ] Script: scripts/link-runbooks.js
  - [ ] Cron: "0 8-23 * * *" (hourly, 8 AM - 11 PM)
- [ ] Deploy to PM2
- [ ] Test manual execution: `pm2 trigger link-runbooks`
- [ ] Check logs: `pm2 logs link-runbooks`
- [ ] Verify runbook comment added to test issue
- [ ] Wait for hourly execution
- [ ] **Output:** Automated runbook linking

**Acceptance Criteria:**
- [ ] PM2 cron job configured
- [ ] Runs hourly (8 AM - 11 PM)
- [ ] Manual trigger works
- [ ] Logs show execution
- [ ] Runbook comments appear on issues
- [ ] No duplicate comments created

---

## Phase 5: Enhanced Webhook Handler (Week 3, Days 3-5: 6 hours)

**Objective:** Rich Telegram alerts with full context

### Task 5.1: Webhook Endpoint (2 hours, M)
- [ ] Create `src/webhooks/glitchtip.js`
- [ ] Add Express route:
  - [ ] POST /api/glitchtip-webhook
  - [ ] Parse JSON body
  - [ ] Verify webhook signature (if GlitchTip provides)
- [ ] Handle events:
  - [ ] issue.new
  - [ ] issue.regression
  - [ ] (ignore other events)
- [ ] Log incoming webhooks
- [ ] Return 200 OK response
- [ ] Import in Express app (src/index.js)
- [ ] Test with curl
- [ ] **Output:** Webhook receiver endpoint

**Acceptance Criteria:**
- [ ] Endpoint created: POST /api/glitchtip-webhook
- [ ] Parses webhook payload
- [ ] Logs event type & issue ID
- [ ] Returns 200 OK
- [ ] Accessible from GlitchTip (localhost)

---

### Task 5.2: Event Handling (2 hours, M)
- [ ] Handle `issue.new` event:
  - [ ] Extract issue ID from payload
  - [ ] Fetch full issue details via API
  - [ ] Parse: title, level, count, tags, stack trace
- [ ] Handle `issue.regression` event:
  - [ ] Extract issue ID
  - [ ] Fetch details
  - [ ] Flag as regression in alert
- [ ] Extract useful context:
  - [ ] Component tag
  - [ ] Operation tag
  - [ ] First 500 chars of stack trace
  - [ ] Issue permalink
- [ ] **Output:** Event handlers with full context

**Acceptance Criteria:**
- [ ] issue.new handler works
- [ ] issue.regression handler works
- [ ] Fetches full details via API
- [ ] Extracts all context fields
- [ ] Ready to format for Telegram

---

### Task 5.3: Rich Formatting (2 hours, M)
- [ ] Format Telegram message:
  - [ ] Emoji indicator (🔴🟡🟢 by level)
  - [ ] Title: ERROR or REGRESSION
  - [ ] Issue title (bold)
  - [ ] Component, level, count
  - [ ] Stack trace (code block, first 500 chars)
  - [ ] Tags (key:value pairs)
  - [ ] Permalink (clickable link)
  - [ ] Quick action buttons
- [ ] Add Telegram buttons:
  - [ ] "Investigate" → `/investigate {id}`
  - [ ] "Resolve" → `/resolve {id}`
  - [ ] "Assign" → `/assign {id}`
- [ ] Send via Telegram Bot API
- [ ] Handle Telegram errors (rate limit, network)
- [ ] Test with sample webhook payloads
- [ ] **Output:** Rich Telegram notifications

**Acceptance Criteria:**
- [ ] Message formatted with markdown
- [ ] Includes all context fields
- [ ] Stack trace readable (code block)
- [ ] Quick action buttons work
- [ ] Sent to correct Telegram chat
- [ ] Looks good on mobile & desktop
- [ ] No rate limit issues

---

### Task 5.4: GlitchTip Configuration (15 min, S)
- [ ] SSH tunnel to GlitchTip
- [ ] Login to UI: http://localhost:9090
- [ ] Navigate: Settings → Webhooks
- [ ] Add webhook:
  - [ ] Name: "Telegram Alerts"
  - [ ] URL: http://localhost:3000/api/glitchtip-webhook
  - [ ] Events: issue.new, issue.regression
  - [ ] Active: Yes
- [ ] Test webhook (Send Test Payload button)
- [ ] Check Telegram for test alert
- [ ] Verify in PM2 logs: `pm2 logs ai-admin-api --lines 50 | grep glitchtip`
- [ ] **Output:** Webhook configured in GlitchTip

**Acceptance Criteria:**
- [ ] Webhook configured in GlitchTip UI
- [ ] URL points to Express endpoint
- [ ] Events: issue.new, issue.regression
- [ ] Test payload sends alert to Telegram
- [ ] Logs show webhook received
- [ ] Works for real production errors

---

## Final Verification (Week 4: 2 hours)

**Objective:** Measure results and calculate ROI

### Task 6.1: Results Measurement (1 hour)
- [ ] Collect metrics (after 2 weeks of use):
  - [ ] Time per error (new average)
  - [ ] Investigation quality (% helpful)
  - [ ] Runbook usage (% known issues)
  - [ ] Tool usage (scripts run, commands used)
  - [ ] Developer feedback (survey)
- [ ] Calculate time savings:
  - [ ] Baseline: 15 min per error
  - [ ] Current: X min per error
  - [ ] Savings: (15 - X) / 15 * 100%
- [ ] Calculate ROI:
  - [ ] Cost: 31 hours × $50/hour = $1,550
  - [ ] Savings: Y hours/week × $50/hour × 52 weeks
  - [ ] ROI: (Savings - Cost) / Cost * 100%
- [ ] **Output:** Results report with metrics

**Acceptance Criteria:**
- [ ] All metrics collected
- [ ] Time savings calculated (target: 70%)
- [ ] ROI calculated (target: 400-600%)
- [ ] Developer feedback gathered
- [ ] Results documented

---

### Task 6.2: Decision Point (1 hour)
- [ ] Review results vs targets:
  - [ ] Time savings: 70%? (achieved/not achieved)
  - [ ] Investigation quality: 80%+?
  - [ ] Runbook effectiveness: 80%+?
  - [ ] Tool adoption: consistent?
- [ ] Team discussion:
  - [ ] Is Enhanced Manual sufficient?
  - [ ] Any pain points remaining?
  - [ ] Should we add auto-triage? ($500/month)
  - [ ] Should we build more runbooks?
- [ ] Decision:
  - [ ] STOP HERE (sufficient) ✅
  - [ ] ADD AUTO-TRIAGE (if >20 errors/day)
  - [ ] ITERATE (improve existing tools)
- [ ] Document decision & rationale
- [ ] **Output:** Go-forward decision

**Acceptance Criteria:**
- [ ] Results reviewed
- [ ] Team discussion completed
- [ ] Decision made (stop/add/iterate)
- [ ] Rationale documented
- [ ] Next steps clear (if continuing)

---

## Progress Tracking

### Week 1
- [ ] **Day 1-2:** Phase 0 (Setup) - 6 hours
- [ ] **Day 3-5:** Phase 1 (Investigation) - 6 hours
- [ ] **Week 1 Total:** 12 hours

### Week 2
- [ ] **Day 1-2:** Phase 2 (Metrics) - 4 hours
- [ ] **Day 3-5:** Phase 3 (Bot) - 4 hours
- [ ] **Week 2 Total:** 8 hours

### Week 3
- [ ] **Day 1-2:** Phase 4 (Runbooks) - 5 hours
- [ ] **Day 3-5:** Phase 5 (Webhooks) - 6 hours
- [ ] **Week 3 Total:** 11 hours

### Week 4 (Review)
- [ ] **Measure & Decide:** 2 hours

### Summary
- [ ] **Total Planned:** 31 hours
- [ ] **Total Actual:** ___ hours
- [ ] **Variance:** ___ hours (___%)

---

## Risk Mitigation Checklist

### Before Starting
- [ ] Team review & approval
- [ ] Schedule 3 weeks of focused time
- [ ] Backup current .env & scripts
- [ ] Create project branch (git)

### During Implementation
- [ ] Track actual time vs estimates
- [ ] Commit code frequently
- [ ] Test each phase before moving to next
- [ ] Document decisions in context.md
- [ ] Update this checklist regularly

### If Blocked
- [ ] Document blocker in context.md
- [ ] Seek help from team/documentation
- [ ] Consider alternative approach
- [ ] Adjust timeline if needed

---

## Success Metrics Checklist

### Primary Metrics (Must Achieve)
- [ ] Time per error: 15 min → 4-5 min (70% reduction)
- [ ] Investigation quality: 80%+ helpful
- [ ] Runbook effectiveness: 80%+ faster for known issues

### Secondary Metrics (Nice to Have)
- [ ] MTTR: 50% reduction
- [ ] Error-free periods: increasing trend
- [ ] Proactive detection: 30%+ (via daily report)

### Leading Indicators (Track Weekly)
- [ ] Investigation script: used consistently
- [ ] Telegram bot: commands used daily
- [ ] Runbook links: clicked regularly
- [ ] Developer satisfaction: positive feedback

---

## Completion Certificate

**When all tasks complete:**

```
┌─────────────────────────────────────────┐
│  GLITCHTIP API INTEGRATION COMPLETE ✅  │
├─────────────────────────────────────────┤
│  Approach: Enhanced Manual Workflow     │
│  Duration: ___ hours (___ weeks)        │
│  Time Savings: ___%                     │
│  ROI: ___%                              │
│  Status: SUCCESS                        │
└─────────────────────────────────────────┘
```

**Completed by:** _________________
**Date:** _________________
**Approved by:** _________________

---

**Checklist Version:** 1.0
**Last Updated:** 2025-11-24
**Next Update:** After each phase completion
**Status:** Ready for Phase 0
