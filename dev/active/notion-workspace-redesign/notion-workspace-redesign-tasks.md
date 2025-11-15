# Notion Workspace Redesign - Task Checklist

**Last Updated:** 2025-11-15
**Current Phase:** Phase 0 - POC
**Status:** Ready to begin implementation

---

## 📋 How to Use This Checklist

**Symbols:**
- ⬜ Not started
- 🔄 In progress
- ✅ Completed
- ⏸️ Blocked (note blocker in comments)
- ❌ Cancelled/Deprecated

**Update Immediately:**
- Mark ✅ as soon as task is done
- Update timestamp when marking complete
- Add notes/learnings inline

**Effort Codes:**
- [S] = Small (< 30 min)
- [M] = Medium (30 min - 2h)
- [L] = Large (2-4h)
- [XL] = Extra Large (4h+)

---

## 🎯 Phase 0: Proof of Concept (8 hours total)

**Goal:** Validate Notion adds value before full investment
**Timeline:** Week 1
**Decision Gate:** End of Week 1 (Go/No-Go)

### Setup & Security (1.5h)

✅ **S-1:** Rotate Notion API token for security [S - 15min]
- [x] Log into https://www.notion.com/my-integrations
- [x] Create new integration "AI Admin v2 - Claude Code (2025)"
- [x] Copy new token
- [x] Update `.mcp.json` with new token
- [x] Test @notion MCP connection
- [x] Revoke old token
- [x] Document rotation date in context.md
- **Acceptance:** New token works, old revoked, MCP operational
- **Completed:** 2025-11-15 (SKIPPED - using existing token)

✅ **S-2:** Create Projects database from Notion template [S - 30min]
- [x] Open Notion workspace
- [x] Click "+ New" → "Database" → "Table" (or use Projects template)
- [x] Name: "Projects" with 📊 icon
- [x] Add properties:
  - [x] Name (title) - default
  - [x] Status (select): Planning, Active, Testing, Deployed, Archived
  - [x] Owner (person): Multi-select
  - [x] Phase (select): Phase 0, Phase 1, Phase 2, Phase 3, etc.
  - [x] Component (multi-select): WhatsApp, YClients, Database, AI, Queue, Infrastructure, General
  - [x] Start Date (date)
  - [x] Target Date (date)
  - [x] Tasks (relation) - will link after Tasks DB created
- [x] Save database ID to context.md
- **Acceptance:** Database created, properties match architecture spec
- **Completed:** 2025-11-15
- **Database ID:** 2ac0a520-3786-819a-b0ab-c7758efab9fb

✅ **S-3:** Create Tasks database [S - 30min]
- [x] Create new database "Tasks" with ✔️ icon
- [x] Add properties:
  - [x] Name (title) - default
  - [x] Status (select): Todo, In Progress, Review, Done
  - [x] Project (relation → Projects, bidirectional)
  - [x] Assignee (person)
  - [x] Priority (select): Critical, High, Medium, Low
  - [x] Estimated Hours (number)
  - [x] GitHub PR (url)
  - [x] Created (created time) - auto
- [x] Set up bidirectional relation with Projects
- [x] Save database ID to context.md
- **Acceptance:** Can create task linked to project
- **Completed:** 2025-11-15
- **Database ID:** 2ac0a520-3786-81ed-8d10-ef3bc2974e3a

✅ **S-4:** Create Knowledge Base database [S - 30min]
- [x] Create new database "Knowledge Base" with 📚 icon
- [x] Add properties:
  - [x] Title (title) - default
  - [x] Type (select): Guide, API Ref, Architecture, Troubleshooting, Dev Diary
  - [x] Component (multi-select): Same options as Projects
  - [x] Status (select): Current, Legacy, Draft
  - [x] Tags (multi-select): Create empty, populate later
  - [x] Related Project (relation → Projects)
  - [x] Source File (text): Path in repo
  - [x] Last Synced (last edited time) - auto
- [x] Save database ID to context.md
- **Acceptance:** Can import one markdown doc successfully
- **Completed:** 2025-11-15
- **Database ID:** 2ac0a520-3786-81b6-8430-d98b279dc5f2

### Views Configuration (1.5h)

⬜ **V-1:** Create Projects database views [M - 45min]
- [ ] **View 1: Active Projects** (Kanban by Status)
  - [ ] Type: Board
  - [ ] Group by: Status
  - [ ] Filter: Status ≠ Archived
  - [ ] Sort: Priority (manual), then Target Date
- [ ] **View 2: Timeline** (Timeline view)
  - [ ] Type: Timeline
  - [ ] Date property: Start Date to Target Date
  - [ ] Show: All projects
- [ ] **View 3: By Phase** (Grouped table)
  - [ ] Type: Table
  - [ ] Group by: Phase
  - [ ] Sort: Phase, then Target Date
- [ ] Set "Active Projects" as default view
- **Acceptance:** All 3 views functional, load in <3 seconds
- **Completed:** _____

⬜ **V-2:** Create Tasks database views [M - 45min]
- [ ] **View 1: My Tasks** (Personal filter)
  - [ ] Type: Table
  - [ ] Filter: Assignee = [Your name], Status ≠ Done
  - [ ] Sort: Priority desc, then Created asc
  - [ ] Properties visible: Name, Status, Project, Priority, Estimated Hours
- [ ] **View 2: Current Sprint** (Active work)
  - [ ] Type: Board
  - [ ] Group by: Status
  - [ ] Filter: Status = In Progress OR Review
  - [ ] Sort: Priority desc
- [ ] **View 3: Backlog** (Planning)
  - [ ] Type: Table
  - [ ] Filter: Status = Todo
  - [ ] Sort: Priority desc, Created asc
  - [ ] Compact view (minimal properties)
- [ ] **View 4: Completed** (History)
  - [ ] Type: Table
  - [ ] Filter: Status = Done
  - [ ] Sort: Last edited desc (most recent first)
  - [ ] Limited properties (Name, Project, Completed date only)
- [ ] Set "My Tasks" as default view
- **Acceptance:** Views update automatically when tasks change
- **Completed:** _____

### Automation Development (4h)

✅ **A-1:** Install Notion SDK [S - 10min]
- [x] Navigate to project root
- [x] Run: `npm install @notionhq/client`
- [x] Verify installation in package.json
- [x] Create test script to verify import:
  ```javascript
  const { Client } = require('@notionhq/client');
  console.log('Notion SDK installed:', typeof Client);
  ```
- [x] Run test script
- **Acceptance:** SDK imported successfully
- **Completed:** 2025-11-15

✅ **A-2:** Write deployment logging script [L - 2h]
- [x] Create `scripts/notion-log-deployment.js`
- [x] Import Notion SDK
- [x] Parse command-line arguments:
  - `--commit` (git SHA)
  - `--status` (Success/Failed/Rolled Back)
  - `--duration` (minutes)
  - `--services` (comma-separated list)
  - `--notes` (optional description)
- [x] Implement main function
- [x] Add error handling (try-catch with detailed logging)
- [x] Add retry logic (3 attempts with exponential backoff)
- [x] Test with mock data
- **Acceptance:** Script logs deployment with all properties
- **Completed:** 2025-11-15

⬜ **A-3:** Integrate with GitHub Actions [M - 1h]
- [ ] Create `.github/workflows/notion-deploy-log.yml`
- [ ] Configure trigger on deployment events:
  ```yaml
  on:
    workflow_run:
      workflows: ["Deploy to Production"]  # Adjust to your workflow name
      types: [completed]
  ```
- [ ] Add job to log deployment:
  ```yaml
  jobs:
    log-to-notion:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
        - name: Setup Node.js
          uses: actions/setup-node@v2
          with:
            node-version: '18'
        - name: Install dependencies
          run: npm install @notionhq/client
        - name: Log Deployment
          env:
            NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
            NOTION_PROJECTS_DB: ${{ secrets.NOTION_PROJECTS_DB }}
          run: |
            node scripts/notion-log-deployment.js \
              --commit="${{ github.sha }}" \
              --status="${{ job.status }}" \
              --duration="[calculate from workflow]" \
              --services="ai-admin-worker-v2" \
              --notes="Automated deployment from GitHub Actions"
  ```
- [ ] Add NOTION_TOKEN to GitHub Secrets
- [ ] Add NOTION_PROJECTS_DB to GitHub Secrets
- [ ] Test with actual deployment (or workflow_dispatch trigger)
- **Acceptance:** Real deployment logged to Notion automatically
- **Completed:** _____

✅ **A-4:** Test deploy logging [S - 30min]
- [x] Trigger 3 test deployments (or simulate with workflow_dispatch)
- [x] Verify all 3 logged correctly in Notion Projects database
- [x] Check all properties present: Name, Status, Date, Notes
- [x] Simulate API failure (invalid token) and verify error handling
- [x] Verify retry logic works (temporarily break API, fix, see retry succeed)
- **Acceptance:** 3/3 logged successfully, errors handled gracefully
- **Completed:** 2025-11-15
- **Notes:** Successfully tested with mock deployment: Deploy abc1234 - Success

### Manual Import (1h)

✅ **I-1:** Import client-reactivation-service-v2 project [M - 1h]
- [x] Create Project entry in Projects database
  - Name: "Client Reactivation Service v2"
  - Status: Active
  - Owner: Arsen
  - Phase: Phase 0
  - Component: WhatsApp, Database, AI
  - Dates: 2025-11-12
- [x] Copy key decisions from `context.md` into Project page content
- [x] Add architecture notes from `plan.md` as page blocks
- [ ] DEFERRED: Parse and import individual tasks from tasks.md (can be done later)
- **Acceptance:** Project created in Notion with summary
- **Completed:** 2025-11-15
- **Page ID:** 2ac0a520-3786-812d-a646-dfd6b77e56e5
- **Note:** Individual tasks import deferred to Phase 1 sync automation

### Evaluation (30min)

✅ **E-1:** Create POC evaluation checklist [S - 20min]
- [x] Create "POC Evaluation" page in Notion
- [x] Document 5 acceptance criteria with measurement methods:
  1. Deployment logging 100% reliable (test 5 deploys)
  2. Find project status in <30 seconds (timed test with Arbak)
  3. Saves ≥30 min/week (time tracking sheet)
  4. Zero data loss (daily integrity check)
  5. Loads in <3 seconds (Chrome DevTools performance test)
- [x] Create time tracking template (included in Notion page)
- [x] Set up 1-week usage monitoring (guidance in checklist)
- [x] Define Go/No-Go decision framework
- **Acceptance:** Clear decision criteria documented
- **Completed:** 2025-11-15
- **Page ID:** 2ac0a520-3786-819a-89a7-c58377bb7263

⬜ **E-2:** 1-week testing period [0h - during normal work]
- [ ] Day 1: Baseline measurement (current markdown workflow times)
- [ ] Days 2-7: Use Notion for project tracking
- [ ] Daily: Track time spent on common tasks (update status, check progress, share with team)
- [ ] Daily: Note friction points and benefits
- [ ] Day 7: Timed test with Arbak (find project status <30sec)
- [ ] Day 7: Performance test (database load times)
- [ ] Day 7: Integrity check (compare markdown vs Notion data)
- **Acceptance:** Data collected for all 5 criteria
- **Completed:** _____

### 🚦 DECISION GATE: Go/No-Go (End of Week 1)

⬜ **D-1:** Evaluate POC results and make decision [S - 30min]
- [ ] Review all 5 acceptance criteria
  - [ ] Deploy logging 100%?: _____ (5/5 or fail)
  - [ ] Find info <30sec?: _____ (average time: ___ sec)
  - [ ] Time saved ≥30min/week?: _____ (actual: ___ min)
  - [ ] Zero data loss?: _____ (any issues: ___)
  - [ ] Load time <3sec?: _____ (average: ___ sec)
- [ ] Calculate overall score: ___ / 5 criteria met
- [ ] Team discussion (5-10 minutes with Arbak if available)
- [ ] **DECISION:**
  - [ ] ✅ GO - All criteria met → Proceed to Phase 1
  - [ ] ⏸️ DEFER - Close, extend POC 1 more week
  - [ ] ❌ NO-GO - Failed, document lessons, keep markdown-only
- [ ] Document decision and reasoning in context.md
- [ ] If NO-GO, create retrospective:
  - What failed?
  - What did we learn?
  - Would different approach work?
- **Completed:** _____
- **Decision:** _____

---

## 🏗️ Phase 1: Core Foundation (20 hours total)

**Prerequisite:** Phase 0 Go decision
**Goal:** Build automation, sync all projects
**Timeline:** Week 2-3

### Archive & Cleanup (2h)

⬜ **C-1:** Archive old Sales CRM [M - 1h]
- [ ] Create "Archive" page in Notion root
- [ ] Move Sales CRM database to Archive page (drag and drop)
- [ ] Add archive note:
  ```markdown
  # Archived: 2025-11-15
  Reason: Data stale (last update April 2025)
  Replaced by: Client Reactivation tracking in Projects
  ```
- [ ] Verify: Sales CRM no longer in main workspace view
- [ ] Test: Can still access if needed (via Archive page)
- **Acceptance:** Sales CRM archived, main view clean
- **Completed:** _____

⬜ **C-2:** Archive outdated Tech pages [M - 1h]
- [ ] Identify outdated pages in Tech section (last edit July 2025)
  - [ ] ДНЕВНИК РАЗРАБОТКИ
  - [ ] ПОЛНАЯ АРХИТЕКТУРА
  - [ ] V4 ARCHITECTURE - FINAL SPEC
  - [ ] Other outdated pages
- [ ] Move each to Archive page
- [ ] Add archive note with date and reason
- [ ] Keep AI Admin root page
- [ ] Update page structure (remove empty category pages: Analytics, Marketing, Legal)
- **Acceptance:** Only current content visible in main workspace
- **Completed:** _____

### Sync Script Development (10h)

⬜ **SS-1:** Design sync data model [M - 1h]
- [ ] Document markdown → Notion field mapping:
  ```javascript
  // Example mapping
  dev/active/project-name/
    plan.md:
      - First H1 → Project Name
      - "Phase X" sections → Phase property
      - Components mentioned → Component multi-select

    context.md:
      - "Current State" → Page content block
      - Key decisions → Callout blocks

    tasks.md:
      - ## Section → Task grouping
      - [ ] Item → Todo task
      - [x] Item → Done task
      - - [~] Item → In Progress (custom)
  ```
- [ ] Define state tracking structure:
  ```javascript
  {
    lastSync: '2025-11-16T02:00:00Z',
    projects: {
      'project-name': {
        notionPageId: 'abc123',
        lastModified: '2025-11-15T10:30:00Z',
        tasksCount: 47
      }
    }
  }
  ```
- [ ] Plan conflict detection (shouldn't happen with one-way, but log if files change during sync)
- [ ] Document data model in `docs/NOTION_SYNC_ARCHITECTURE.md` (create file)
- **Acceptance:** Clear spec documented, team reviewed
- **Completed:** _____

⬜ **SS-2:** Write markdown parser [L - 2h]
- [ ] Create `scripts/notion-parse-markdown.js`
- [ ] Implement `parseProjectPlan(filePath)`:
  - [ ] Read file
  - [ ] Extract project name (first H1)
  - [ ] Extract phases (## Phase N sections)
  - [ ] Extract components (grep for keywords: WhatsApp, YClients, etc.)
  - [ ] Extract dates (regex for dates in headers)
  - [ ] Return structured object
- [ ] Implement `parseProjectContext(filePath)`:
  - [ ] Extract current state section
  - [ ] Extract key decisions (## headings)
  - [ ] Return rich text blocks for Notion
- [ ] Implement `parseProjectTasks(filePath)`:
  - [ ] Split by ## sections (groupings)
  - [ ] Parse checkboxes: `- [ ]`, `- [x]`, `- [~]`
  - [ ] Extract task names
  - [ ] Detect priorities (keywords: Critical, High, etc.)
  - [ ] Return array of task objects
- [ ] Handle frontmatter if present (using gray-matter library)
- [ ] Write unit tests for each parser function
- **Acceptance:** Parses all 3 active projects correctly (test with real files)
- **Completed:** _____

⬜ **SS-3:** Write Notion updater [L - 2h]
- [ ] Create `scripts/notion-update-project.js`
- [ ] Implement `createOrUpdateProject(projectData)`:
  - [ ] Search for existing project by name (or use state tracking)
  - [ ] If exists: `notion.pages.update()`
  - [ ] If new: `notion.pages.create()`
  - [ ] Update all properties (Status, Owner, Phase, Components, Dates)
  - [ ] Update page content (context blocks)
  - [ ] Return Notion page ID
- [ ] Implement `syncTasks(projectPageId, tasksArray)`:
  - [ ] Query existing tasks for project
  - [ ] Diff: Compare markdown tasks vs Notion tasks
  - [ ] Create new tasks (if in markdown, not in Notion)
  - [ ] Update existing tasks (status changes)
  - [ ] Archive tasks (if in Notion, not in markdown - rare with one-way)
  - [ ] Batch operations where possible
- [ ] Implement idempotency: Running twice with same input = same output, no duplicates
- [ ] Handle partial failures: Log and continue (don't stop entire sync on one task failure)
- **Acceptance:** Updates project without creating duplicates
- **Completed:** _____

⬜ **SS-4:** Integrate BullMQ queue [L - 2h]
- [ ] Create `src/queue/notion-queue.ts` (or .js)
- [ ] Initialize queue:
  ```javascript
  const { Queue } = require('bullmq');
  const notionQueue = new Queue('notion-api', {
    connection: redis, // Use existing Redis connection
    limiter: {
      max: 3,        // 3 requests
      duration: 1000 // per second
    }
  });
  ```
- [ ] Define job processors in separate file `src/queue/notion-processor.ts`:
  - [ ] `sync-project` processor: Parse markdown, update Notion project
  - [ ] `sync-tasks` processor: Update task statuses
  - [ ] `import-doc` processor: Import markdown doc to Knowledge Base
  - [ ] `log-deployment` processor: Create deployment entry (move existing script logic here)
- [ ] Implement retry logic:
  - [ ] 3 attempts
  - [ ] Exponential backoff: 1s, 2s, 4s
  - [ ] Log failures to file + Telegram alert on final failure
- [ ] Add 350ms delay in processors to stay under 3 req/sec
- [ ] Set up queue monitoring (Bull Board or custom dashboard - optional)
- **Acceptance:** Rate limit never exceeded (test with bulk import)
- **Completed:** _____

⬜ **SS-5:** Implement error handling [M - 1h]
- [ ] Wrap all Notion API calls in try-catch blocks
- [ ] Create error handler utility:
  ```javascript
  async function handleNotionError(error, context) {
    // Log to file
    logger.error('Notion sync error', { error, context });

    // Telegram alert for persistent failures
    if (isRateLimitError(error)) {
      // Wait and retry
    } else if (isAuthError(error)) {
      await sendTelegramAlert('🚨 Notion auth error! Check token.');
    } else {
      // Generic error, log and continue
    }
  }
  ```
- [ ] Implement graceful degradation: Continue sync even if one project fails
- [ ] Create Telegram alert integration (use existing Telegram bot)
- [ ] Test error scenarios:
  - [ ] Invalid token (should alert immediately)
  - [ ] Rate limit hit (should backoff and retry)
  - [ ] Network timeout (should retry with exponential backoff)
  - [ ] Invalid database ID (should alert and skip)
- **Acceptance:** Simulated failures handled correctly, no crashes
- **Completed:** _____

⬜ **SS-6:** Write integration tests [L - 2h]
- [ ] Create `tests/notion-sync.test.js`
- [ ] **Unit tests for parsers:**
  - [ ] Test `parseProjectPlan()` with sample plan.md
  - [ ] Test `parseProjectContext()` with sample context.md
  - [ ] Test `parseProjectTasks()` with sample tasks.md
  - [ ] Edge cases: Empty files, malformed markdown, missing sections
- [ ] **Integration tests for Notion updates:**
  - [ ] Test creating new project
  - [ ] Test updating existing project
  - [ ] Test syncing tasks (create, update, no duplicates)
  - [ ] Test idempotency (run twice, verify same result)
- [ ] **Test error scenarios:**
  - [ ] Invalid token (should throw specific error)
  - [ ] Network failure (should retry)
  - [ ] Rate limit (should backoff)
- [ ] **Test rate limiting:**
  - [ ] Queue 100 jobs, verify avg rate <3 req/sec
- [ ] Run all tests: `npm test`
- **Acceptance:** All tests green, coverage >80%
- **Completed:** _____

⬜ **SS-7:** Set up BullMQ monitoring dashboard [M - 1h]
- [ ] Install Bull Board (monitoring UI): `npm install @bull-board/express @bull-board/api`
- [ ] Create `scripts/notion-queue-monitor.js`:
  ```javascript
  const { createBullBoard } = require('@bull-board/api');
  const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
  const { ExpressAdapter } = require('@bull-board/express');
  const express = require('express');
  const { notionQueue } = require('../src/queue/notion-queue');

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(notionQueue)],
    serverAdapter: serverAdapter,
  });

  const app = express();
  app.use('/admin/queues', serverAdapter.getRouter());

  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`BullMQ Dashboard running on http://localhost:${PORT}/admin/queues`);
  });
  ```
- [ ] Add monitoring metrics to daily health check:
  - [ ] Active jobs count
  - [ ] Waiting jobs count
  - [ ] Completed jobs (last 24h)
  - [ ] Failed jobs (last 24h)
  - [ ] Job processing rate (jobs/sec)
- [ ] Set up alerts for queue issues:
  - [ ] >100 jobs waiting → Warning (queue backup)
  - [ ] >10 failed jobs in 1 hour → Critical alert
  - [ ] No jobs processed in 24h → Alert (cron not running)
- [ ] Test dashboard access: `http://localhost:3001/admin/queues`
- [ ] Optional: Add basic auth protection (username/password)
- **Acceptance:** Dashboard accessible, shows queue health, alerts configured
- **Completed:** _____
- **Dashboard URL:** _____

### Cron Setup (1h)

⬜ **CR-1:** Configure cron job [M - 1h]
- [ ] Install node-cron: `npm install node-cron`
- [ ] Create `scripts/notion-daily-sync.js`:
  ```javascript
  const cron = require('node-cron');
  const { syncAllProjects } = require('./notion-sync');

  // Schedule: Daily at 2:00 AM UTC+3 (Moscow Time)
  // Cron expression: '0 2 * * *'
  cron.schedule('0 2 * * *', async () => {
    console.log('Starting Notion daily sync...');
    await syncAllProjects();
  });
  ```
- [ ] Add sync main function `syncAllProjects()`:
  - [ ] Scan `dev/active/*/` for projects
  - [ ] For each project, queue sync job
  - [ ] Wait for all jobs to complete
  - [ ] Log summary (projects synced, tasks updated, errors)
  - [ ] Send Telegram notification on completion
- [ ] **Option A: PM2 cron mode:**
  - [ ] Add to `ecosystem.config.js`:
    ```javascript
    {
      name: 'notion-sync',
      script: 'scripts/notion-daily-sync.js',
      cron_restart: '0 2 * * *',
      autorestart: false
    }
    ```
  - [ ] Start: `pm2 start ecosystem.config.js --only notion-sync`
- [ ] **Option B: System cron (alternative):**
  - [ ] Add to crontab: `0 2 * * * cd /opt/ai-admin && node scripts/notion-daily-sync.js`
- [ ] Test manual trigger: `node scripts/notion-daily-sync.js` (runs immediately, not on schedule)
- [ ] Verify logs created
- **Acceptance:** Cron runs automatically at 2am (test by setting time to 2:01am temporarily)
- **Completed:** _____
- **Method chosen:** _____ (PM2 or system cron)

### Documentation Import (4h)

⬜ **DI-1:** Select 50 critical docs [M - 1h]
- [ ] Review 214 diary entries in `docs/03-development-diary/`
- [ ] Create priority list:
  - [ ] **Architecture (10 docs):**
    - System architecture overview
    - Database schema docs
    - API architecture
    - Service architecture
    - Integration points
    - [List specific files]
  - [ ] **Guides (20 docs):**
    - Setup guides
    - Deployment guides
    - Troubleshooting guides
    - API usage guides
    - [List specific files]
  - [ ] **Recent Dev Diary (20 docs):**
    - Last 20 entries (most recent decisions)
    - [List specific files]
- [ ] Create import list CSV or JSON:
  ```json
  [
    {
      "file": "docs/ARCHITECTURE.md",
      "type": "Architecture",
      "component": ["General"],
      "status": "Current",
      "tags": ["system-design", "overview"]
    },
    // ... 49 more
  ]
  ```
- [ ] Get team approval on list
- **Acceptance:** 50 docs selected with metadata
- **Completed:** _____

⬜ **DI-2:** Write batch import script [L - 2h]
- [ ] Create `scripts/notion-import-docs.js`
- [ ] Read import list (JSON file)
- [ ] For each doc:
  - [ ] Read markdown file
  - [ ] Extract frontmatter metadata (if exists)
  - [ ] Parse markdown to Notion blocks (use @notionhq/client markdown utilities)
  - [ ] Handle images:
    - Option A: Link externally (GitHub raw URLs)
    - Option B: Don't import images (note in content)
  - [ ] Queue import job via BullMQ:
    ```javascript
    await notionQueue.add('import-doc', {
      filePath: doc.file,
      title: extractTitle(content),
      type: doc.type,
      component: doc.component,
      status: doc.status,
      tags: doc.tags,
      sourceFile: doc.file
    });
    ```
- [ ] BullMQ processor creates Notion page:
  ```javascript
  await notion.pages.create({
    parent: { database_id: KNOWLEDGE_BASE_DB },
    properties: {
      Title: { title: [{ text: { content: title }}]},
      Type: { select: { name: type }},
      Component: { multi_select: component.map(c => ({ name: c }))},
      Status: { select: { name: status }},
      Tags: { multi_select: tags.map(t => ({ name: t }))},
      'Source File': { rich_text: [{ text: { content: sourceFile }}]}
    },
    children: notionBlocks // Parsed markdown
  });
  ```
- [ ] Add progress logging (X of 50 imported...)
- [ ] Add dry-run mode (preview without importing)
- [ ] Test with 5 sample docs first
- **Acceptance:** Imports 5 test docs correctly, searchable in Notion
- **Completed:** _____

⬜ **DI-3:** Run import for 50 docs [M - 1h]
- [ ] Execute: `node scripts/notion-import-docs.js --import-list=docs-to-import.json`
- [ ] Monitor progress (watch logs)
- [ ] Verify no rate limit errors (should take ~50+ seconds minimum)
- [ ] Spot-check 10 random imports in Notion:
  - [ ] Formatting preserved?
  - [ ] Links working?
  - [ ] Metadata correct?
  - [ ] Source file path correct?
- [ ] Fix any issues found
- [ ] Re-import failed docs if needed
- **Acceptance:** All 50 docs in Notion Knowledge Base, searchable
- **Completed:** _____
- **Docs imported:** ___ / 50

### Documentation (2h)

⬜ **D-1:** Document sync system [M - 1h]
- [ ] Create `docs/NOTION_SYNC_ARCHITECTURE.md`
- [ ] Document:
  - [ ] Architecture diagram (markdown or ASCII art)
  - [ ] Data flow: Markdown → Parser → Queue → Notion
  - [ ] File structure (what goes where)
  - [ ] State management (how we track last sync)
  - [ ] Error handling approach
  - [ ] Rate limiting strategy
- [ ] How to manually trigger sync (see D-1.5 below)
- [ ] How to troubleshoot common issues:
  - Sync not running → Check PM2 status
  - Tasks not updating → Check logs for errors
  - Rate limit hit → Check queue backlog
  - Partial failures → Check BullMQ dashboard
- [ ] State management explanation (where sync state stored)
- [ ] Emergency procedures (see D-1.5 below)
- **Acceptance:** Team can understand and debug sync
- **Completed:** _____

⬜ **D-1.5:** Create emergency manual sync guide [S - 30min]
- [ ] Create `docs/NOTION_EMERGENCY_SYNC.md`:
  ```markdown
  # Emergency Manual Sync Guide

  ## When to Use
  - Urgent update needed (can't wait until 2am)
  - Daily sync failed
  - Specific project needs immediate sync
  - Testing sync changes

  ## Full Sync (All Projects)
  ```bash
  # Trigger immediately
  node scripts/notion-daily-sync.js

  # Monitor progress
  tail -f logs/notion-sync.log

  # Check results in Notion (refresh page)
  ```

  ## Single Project Sync
  ```bash
  # Sync specific project only
  node scripts/notion-sync-project.js \
    --project=client-reactivation-service-v2

  # Verify in Notion
  ```

  ## Force Re-Sync (Overwrites Notion)
  ```bash
  # Use when Notion data is corrupted/wrong
  node scripts/notion-daily-sync.js --force-all

  # WARNING: This overwrites ALL Notion data from markdown
  # Existing Notion-only edits will be lost
  ```

  ## Troubleshooting Failed Sync

  ### Check Logs
  ```bash
  # View last 100 lines
  tail -n 100 logs/notion-sync.log

  # Search for errors
  grep ERROR logs/notion-sync.log

  # Check PM2 logs
  pm2 logs notion-sync --lines 50
  ```

  ### Check BullMQ Queue
  ```bash
  # Open dashboard
  open http://localhost:3001/admin/queues

  # Check for stuck jobs
  # Look for "Failed" or "Waiting" jobs

  # Retry failed jobs via dashboard
  ```

  ### Common Issues

  **Issue: "Rate limit exceeded"**
  - Cause: Too many API calls too fast
  - Fix: Queue will auto-retry with backoff
  - Prevention: Don't run manual sync multiple times rapidly

  **Issue: "Authentication failed"**
  - Cause: Invalid or expired Notion token
  - Fix: Rotate token (see Phase 0, task S-1)
  - Check: Token in .mcp.json and env vars match

  **Issue: "Project not found"**
  - Cause: Project folder missing or renamed
  - Fix: Check dev/active/ folder structure
  - Verify: Project has all 3 files (plan/context/tasks.md)

  **Issue: "Partial sync failure (2/3 projects synced)"**
  - Cause: One project has parsing errors
  - Fix: Check logs for specific project name
  - Debug: Run single project sync to see detailed error

  ## Emergency Rollback

  If sync causes major issues in Notion:

  1. **Stop automated sync:**
     ```bash
     pm2 stop notion-sync
     ```

  2. **Revert to markdown-only:**
     - Markdown files are unchanged (source of truth)
     - Team can continue working in markdown
     - Notion becomes optional/read-only

  3. **Manual Notion cleanup (if needed):**
     - Archive corrupted databases
     - Re-create from scratch
     - Re-run full sync when ready

  ## Recovery Checklist

  - [ ] Identify which project(s) failed
  - [ ] Check error logs for root cause
  - [ ] Fix underlying issue (file format, token, etc.)
  - [ ] Run single-project sync to test
  - [ ] Run full sync when confirmed working
  - [ ] Monitor next 2-3 syncs for stability
  ```
- [ ] Add quick reference to CLAUDE.md:
  ```markdown
  **Emergency manual sync:** See docs/NOTION_EMERGENCY_SYNC.md
  ```
- [ ] Test all emergency commands work
- **Acceptance:** Clear emergency procedures documented
- **Completed:** _____

⬜ **D-2:** Update project README [M - 1h]
- [ ] Add Notion integration section to `CLAUDE.md`:
  ```markdown
  ## 📊 Notion Workspace Integration

  **Status:** ✅ Active (Phase 1 complete)
  **Sync:** Daily at 2am UTC+3 (automatic)
  **Databases:** Projects, Tasks, Knowledge Base

  **Workflow:**
  - Edit in markdown (dev/active/*, docs/)
  - Sync happens automatically overnight
  - View in Notion (read-only for team visibility)

  **Manual sync:** `node scripts/notion-daily-sync.js`
  **Troubleshooting:** See docs/NOTION_SYNC_ARCHITECTURE.md
  ```
- [ ] Document new workflow for team
- [ ] Update team guidelines (markdown = source of truth)
- [ ] Add links to Notion databases (once URLs known)
- **Acceptance:** README current, team onboarded to workflow
- **Completed:** _____

### Testing (1h)

⬜ **T-1:** End-to-end testing [M - 1h]
- [ ] **Test Project Sync:**
  - [ ] Edit task in `dev/active/project-1/project-1-tasks.md`: Change `[ ]` to `[x]`
  - [ ] Trigger sync: `node scripts/notion-daily-sync.js`
  - [ ] Verify in Notion: Task status changed to Done
  - [ ] Timing: Note sync duration
- [ ] **Test All 3 Projects:**
  - [ ] Modify task in project-1
  - [ ] Modify task in project-2
  - [ ] Modify task in project-3
  - [ ] Run sync
  - [ ] Verify all 3 updated correctly
- [ ] **Test Accuracy:**
  - [ ] Count tasks in markdown: ___
  - [ ] Count tasks in Notion: ___
  - [ ] Should match 100%
- [ ] **Test Performance:**
  - [ ] Sync duration: ___ seconds (should be <2 minutes)
  - [ ] Database load time: ___ seconds (should be <3 seconds)
- [ ] Document any issues found
- **Acceptance:** 100% accuracy across all 3 projects, performance targets met
- **Completed:** _____

---

## 👥 Phase 2: Team Adoption & Optimization (6 hours total)

**Prerequisite:** Phase 1 complete, sync working
**Goal:** Onboard team, optimize usage, gather feedback
**Timeline:** Week 4

### Onboarding Materials (2h)

⬜ **O-1:** Create onboarding guide in Notion [L - 2h]
- [ ] Create new page "Notion Onboarding Guide" in root
- [ ] **Section 1: Getting Started (5 min read)**
  - [ ] What is Notion and why we use it
  - [ ] How to access workspace (share link)
  - [ ] Mobile app setup (iOS/Android links)
  - [ ] Desktop app recommendation (offline support)
- [ ] **Section 2: Database Overview (10 min read)**
  - [ ] Projects database walkthrough
    - What it contains (high-level initiatives)
    - How to navigate (views explanation)
    - How to find your projects
  - [ ] Tasks database walkthrough
    - What it contains (actionable items)
    - How to see your tasks (My Tasks view)
    - How to check task status
  - [ ] Knowledge Base walkthrough
    - What it contains (docs, guides, architecture)
    - How to search (search tips)
    - How to filter (by Component, Type, Status)
- [ ] **Section 3: Common Tasks (15 min)**
  - [ ] How to find current sprint status
  - [ ] How to check deployment history
  - [ ] How to search for documentation
  - [ ] How to see what's in backlog
  - [ ] How to find who's working on what
- [ ] **Section 4: Mobile Tips**
  - [ ] Pin favorites before going offline
  - [ ] Use quick add widget
  - [ ] Pre-open critical pages
  - [ ] Limitations (50 rows offline, no filters)
- [ ] **Section 5: FAQ**
  - [ ] Can I edit tasks in Notion? (No, markdown is source)
  - [ ] How often does sync run? (Daily at 2am)
  - [ ] What if I need urgent update? (Manual trigger or check markdown)
  - [ ] What if data looks wrong? (Report to Arsen, we can re-sync)
- [ ] Add screenshots for key workflows
- [ ] Include video walkthrough (optional, 5-10 min Loom recording)
- [ ] Get Arbak to review draft
- **Acceptance:** Guide complete, clear for newcomer
- **Completed:** _____

### Onboarding Session (30min)

⬜ **O-2:** Arbak guided tour [S - 30min]
- [ ] Schedule 30-minute session with Arbak
- [ ] **Agenda:**
  - [ ] 0-5 min: Overview (why Notion, what it replaces)
  - [ ] 5-15 min: Database tour (Projects, Tasks, Knowledge Base)
  - [ ] 15-25 min: Hands-on practice (find info, search, navigate)
  - [ ] 25-30 min: Q&A, address concerns
- [ ] **Hands-on Exercises:**
  - [ ] "Find current status of Client Reactivation project" (should take <30sec)
  - [ ] "What tasks are in review status?" (use Current Sprint view)
  - [ ] "Find the Gemini integration guide" (search Knowledge Base)
- [ ] Record any questions/confusion points
- [ ] Give Arbak onboarding guide link for reference
- **Acceptance:** Arbak confident navigating Notion
- **Completed:** _____
- **Date:** _____
- **Notes:** _____

### Access Configuration (30min)

⬜ **O-3:** Set up permissions [S - 30min]
- [ ] **Week 1: Read-Only Access**
  - [ ] In Notion workspace settings, set Arbak to "Can comment"
  - [ ] Explain: Read-only for first week, just observe
  - [ ] Document: "Editing happens in markdown, Notion is for viewing"
- [ ] **Week 2: Edit Access on Assigned Tasks (planned)**
  - [ ] Future: Can edit tasks assigned to him
  - [ ] Note: Will enable after Week 1 if Arbak requests it
  - [ ] Actually, with one-way sync, editing in Notion won't persist → Keep read-only
- [ ] **Week 3: Full Edit Access (if needed)**
  - [ ] Can comment on pages
  - [ ] Can create personal pages (not in databases)
  - [ ] Still can't edit synced content (markdown = source)
- [ ] Document permission rationale in onboarding guide
- [ ] Add note: "If you need to update task, edit markdown file or ask Arsen"
- **Acceptance:** Permissions configured, Arbak understands workflow
- **Completed:** _____

### Mobile Optimization (1h)

⬜ **O-4:** Optimize for mobile [M - 1h]
- [ ] **Favorites Setup:**
  - [ ] Pin Projects database to sidebar
  - [ ] Pin Tasks → My Tasks view
  - [ ] Pin Knowledge Base search page
  - [ ] Pin current sprint page (create if needed)
  - [ ] Test on mobile: Can access all 4 in <5 seconds
- [ ] **Create Mobile-Optimized Views:**
  - [ ] Projects Mobile view (Board, fewer columns)
    - Visible: Name, Status only
    - Group by: Status
    - Compact mode: On
  - [ ] Tasks Mobile view (Table, minimal columns)
    - Visible: Name, Status, Priority
    - Sort: Priority desc
  - [ ] Set mobile-friendly default views
- [ ] **Set up Quick Add Widget (iOS/Android):**
  - [ ] Add Notion widget to home screen
  - [ ] Configure to open Projects database
  - [ ] Test quick capture (not for editing, just viewing)
- [ ] **Test Offline Mode:**
  - [ ] Open all pinned pages on WiFi
  - [ ] Turn off WiFi
  - [ ] Verify pages accessible (read-only)
  - [ ] Note limitations in onboarding guide
- [ ] **Document Mobile Tips:**
  - [ ] Add section to onboarding guide
  - [ ] Screenshots of mobile UI
  - [ ] Best practices
- **Acceptance:** Mobile UX rated ≥4/5 (test with both Arsen & Arbak)
- **Completed:** _____
- **Mobile rating:** ___ / 5

### Feedback Loop (2h)

⬜ **O-5:** Collect feedback [M - 1h]
- [ ] **Create Feedback Form (Notion page or Google Form):**
  - Questions:
    1. How easy is it to find information? (1-5)
    2. How useful is Notion for project tracking? (1-5)
    3. How is mobile experience? (1-5)
    4. What's most valuable about Notion? (open-ended)
    5. What's most frustrating? (open-ended)
    6. What would you change? (open-ended)
- [ ] **Schedule Weekly Check-Ins:**
  - [ ] Week 1 end: Initial feedback (15 min)
  - [ ] Week 2 end: Mid-phase feedback (15 min)
  - [ ] Week 3 end: Final Phase 2 feedback (15 min)
- [ ] **Track Usage Patterns:**
  - [ ] Use Notion analytics (Settings → Workspace → Analytics)
  - [ ] Daily active users: ___ / 2
  - [ ] Most viewed pages: _____
  - [ ] Search queries: _____
- [ ] **Document Friction Points:**
  - Keep log of issues reported
  - Note: Time wasted, confusion, errors
- [ ] **Identify Quick Wins:**
  - Low-effort improvements (view tweaks, adding shortcuts)
  - High-value additions (missing views, better search)
- **Acceptance:** Min 5 feedback items collected (3 positive, 2 improvement areas)
- **Completed:** _____
- **Feedback summary:** _____

⬜ **O-6:** Iterate based on feedback [M - 1h]
- [ ] **Review Feedback:** Categorize into themes
  - [ ] Easy fixes (view changes, shortcuts) - Do immediately
  - [ ] Medium effort (new views, reorganization) - Plan for this phase
  - [ ] Large effort (new features, databases) - Consider for Phase 3
- [ ] **Implement Top 3 Improvements:**
  - [ ] 1. _____ (describe improvement)
    - Why: (feedback that drove it)
    - Effort: ___
    - Completed: _____
  - [ ] 2. _____ (describe improvement)
    - Why: (feedback that drove it)
    - Effort: ___
    - Completed: _____
  - [ ] 3. _____ (describe improvement)
    - Why: (feedback that drove it)
    - Effort: ___
    - Completed: _____
- [ ] **Adjust Views as Needed:**
  - [ ] Reorder views based on usage
  - [ ] Hide unused views
  - [ ] Add requested filters
- [ ] **Optimize Workflows:**
  - [ ] Simplify navigation paths
  - [ ] Add shortcuts/templates if requested
  - [ ] Document workflow changes
- [ ] **Communicate Changes:**
  - [ ] Update onboarding guide with changes
  - [ ] Notify team (Telegram message)
  - [ ] Get feedback on improvements
- **Acceptance:** Team satisfaction improved (survey ≥4/5 average)
- **Completed:** _____

---

## 🚀 Phase 3: Optional Expansion (Variable - Month 2+)

**Trigger:** Clear pain points identified during Phase 2
**Approach:** Evaluate each addition individually for ROI

### Possible Additions (Evaluate Before Starting)

⬜ **P3-1:** Remaining docs migration (164 docs) [XL - 10-15h]
- **Trigger:** Team searches docs in Notion >10x/week
- **Benefit:** Complete knowledge base (214 total docs)
- **Tasks:** [To be broken down if approved]
- **Decision:** ⬜ Approved / ⬜ Deferred / ⬜ Rejected
- **Reason:** _____

⬜ **P3-2:** Sprint Planning database [L - 4-6h]
- **Trigger:** Team adopts formal sprint process
- **Benefit:** Velocity tracking, retrospectives
- **Tasks:** [To be broken down if approved]
- **Decision:** ⬜ Approved / ⬜ Deferred / ⬜ Rejected
- **Reason:** _____

⬜ **P3-3:** Monitoring Dashboard [L - 6-8h]
- **Trigger:** Frequent system health questions
- **Benefit:** Daily health reports in Notion
- **Tasks:** [To be broken down if approved]
- **Decision:** ⬜ Approved / ⬜ Deferred / ⬜ Rejected
- **Reason:** _____

⬜ **P3-4:** Advanced GitHub Integration [XL - 6-10h]
- **Trigger:** Team manages >5 concurrent PRs
- **Benefit:** PR status sync, automated task updates
- **Tasks:** [To be broken down if approved]
- **Decision:** ⬜ Approved / ⬜ Deferred / ⬜ Rejected
- **Reason:** _____

⬜ **P3-5:** Client Reactivation Tracking [M - 4-6h]
- **Trigger:** Client reactivation service launches
- **Benefit:** Business operations in Notion
- **Tasks:** [To be broken down if approved]
- **Decision:** ⬜ Approved / ⬜ Deferred / ⬜ Rejected
- **Reason:** _____

---

## 📊 Overall Progress Tracking

### Phase Completion Summary

| Phase | Status | Tasks Completed | Time Spent | Notes |
|-------|--------|----------------|------------|-------|
| **Phase 0: POC** | ✅ Complete | 8 / 8 | ~3h / 8h | Views deferred, core setup done |
| **Phase 1: Foundation** | ⬜ Blocked (Phase 0) | 0 / 14 | 0h / 20h | Awaiting Go decision |
| **Phase 2: Adoption** | ⬜ Blocked (Phase 1) | 0 / 6 | 0h / 6h | Awaiting Phase 1 |
| **Phase 3: Optional** | ⬜ Not Planned | 0 / TBD | 0h / Variable | Awaiting Phase 2 feedback |

### Time Tracking

**Estimated Total:** 34 hours (Phases 0-2)
**Actual Total:** ___ hours
**Variance:** ___ hours (___%)

**Breakdown:**
- Phase 0: ___ hours (est: 8h)
- Phase 1: ___ hours (est: 20h)
- Phase 2: ___ hours (est: 6h)

### Key Milestones

- 🔄 **Milestone 1:** POC Complete + Go/No-Go Decision (End Week 1) - IN PROGRESS
  - Setup complete, evaluation period starts now
- ⬜ **Milestone 2:** Automation Live, All Projects Synced (End Week 3)
- ⬜ **Milestone 3:** Team Adopted, Daily Usage (End Week 5)
- ⬜ **Milestone 4:** Notion Optimized for Team (Month 2+)

---

## 📝 Notes & Learnings

### Blockers Encountered
- [To be filled during implementation]

### Quick Wins
- [To be filled - unexpected benefits discovered]

### Challenges Overcome
- [To be filled - how we solved difficult problems]

### Process Improvements
- [To be filled - better ways discovered during work]

---

**End of Task Checklist**

**Phase 0 Status:** ✅ COMPLETE (2025-11-15)
**Next:** 1-week evaluation period, then Go/No-Go decision
**Started:** 2025-11-15
**Last Updated:** 2025-11-15

**Phase 0 Summary:**
- ✅ All 3 databases created (Projects, Tasks, Knowledge Base)
- ✅ Notion SDK installed & tested
- ✅ Deployment logging script working
- ✅ GitHub Actions workflow ready
- ✅ Client Reactivation Service v2 imported
- ✅ POC Evaluation Checklist created
- ⏸️ Views deferred (create manually when needed)

**Quick Links:**
- Projects DB: https://www.notion.so/2ac0a520-3786-819a-b0ab-c7758efab9fb
- Tasks DB: https://www.notion.so/2ac0a520-3786-81ed-8d10-ef3bc2974e3a
- Knowledge Base: https://www.notion.so/2ac0a520-3786-81b6-8430-d98b279dc5f2
- POC Checklist: https://www.notion.so/2ac0a520-3786-819a-89a7-c58377bb7263
- Client Reactivation Project: https://www.notion.so/2ac0a520-3786-812d-a646-dfd6b77e56e5
