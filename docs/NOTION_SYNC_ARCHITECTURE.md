# Notion Sync Architecture

**Technical documentation for the AI Admin v2 → Notion synchronization system.**

## 🎯 Overview

**Purpose:** Automatically sync project documentation from markdown files to Notion workspace.

**Design Principles:**
1. **One-way sync** - Markdown is source of truth, Notion is read-only
2. **Change detection** - Only sync when files actually changed
3. **Graceful degradation** - Continue sync even if individual projects fail
4. **Rate limit compliance** - Stay well under Notion's 3 req/sec limit
5. **Idempotent** - Running sync multiple times produces same result

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKDOWN FILES (Source of Truth)         │
│  dev/active/[project-name]/                                 │
│  ├── [project-name]-plan.md       ← Project metadata       │
│  ├── [project-name]-context.md    ← Current state          │
│  └── [project-name]-tasks.md      ← Task checklists        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ File system watch / cron trigger
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              SYNC ORCHESTRATOR (PM2 Cron Jobs)              │
│  scripts/notion-daily-sync.js                               │
│  - Scans dev/active/* for projects                          │
│  - Checks file modification times                           │
│  - Decides: skip or sync                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ For each changed project
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                MARKDOWN PARSER                               │
│  scripts/notion-parse-markdown.js                           │
│  - Parses plan.md → metadata (name, status, phase)          │
│  - Parses context.md → summary text                         │
│  - Parses tasks.md → task objects (status, priority)        │
│  Returns: Complete project data object                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Parsed data
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              PROJECT SYNC HANDLER                            │
│  scripts/notion-sync-project.js                             │
│  1. Search Notion for existing project (by name)            │
│  2. If exists → UPDATE properties                           │
│     If not → CREATE new page in Projects database           │
│  3. Sync tasks:                                             │
│     - Fetch existing tasks from Tasks database              │
│     - Match by content (exact text match)                   │
│     - CREATE new tasks                                      │
│     - UPDATE changed tasks                                  │
│  4. Update state tracking                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ API calls (with retry logic)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 NOTION API (via SDK)                         │
│  @notionhq/client v5.4.0                                    │
│  - Search API (find projects)                               │
│  - Pages API (create/update projects)                       │
│  - Databases API (query tasks)                              │
│  Rate limit: 3 req/sec (actual usage: ~0.030 req/sec)      │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Data persisted
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              NOTION WORKSPACE (Read-Only View)               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Projects Database (📊)                             │    │
│  │ - Name, Status, Phase, Components, Dates           │    │
│  │ - Relation to Tasks                                │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Tasks Database (✔️)                                 │    │
│  │ - Task content, Status, Priority, Project relation │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Knowledge Base (📚) [Future Phase 2]               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ State tracking feedback
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              STATE FILE (.notion-sync-state.json)            │
│  {                                                           │
│    "lastFullSync": "2025-11-15T10:30:00.000Z",              │
│    "lastSmartSync": "2025-11-15T11:45:00.000Z",             │
│    "projects": {                                            │
│      "project-name": {                                      │
│        "lastSync": "...",                                   │
│        "lastModified": "...",                               │
│        "errors": 0,                                         │
│        "notionPageId": "...",                               │
│        "taskCount": 35                                      │
│      }                                                      │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## 🏗️ Component Architecture

### 1. Markdown Parser (`scripts/notion-parse-markdown.js`)

**Responsibility:** Extract structured data from markdown files.

**Functions:**
```javascript
parseProjectPlan(filePath)
// Input: dev/active/[project]/[project]-plan.md
// Output: { name, status, phase, components: [], dates: {} }
// Parses: # headers, **Status:**, **Phase:**, **Components:**

parseProjectContext(filePath)
// Input: dev/active/[project]/[project]-context.md
// Output: { summary, keyDecisions: [], blockers: [] }
// Extracts: First paragraph, ## Key Decisions, ## Current Blockers

parseProjectTasks(filePath)
// Input: dev/active/[project]/[project]-tasks.md
// Output: [{ content, status, priority, estimatedHours }]
// Parses: - [ ] Todo, - [x] Done, - [~] In Progress
// Detects: Priority (P0-P3), Estimates (XXh)

parseProject(projectPath)
// Combines all 3 parsers
// Returns complete project object
```

**Edge Cases Handled:**
- Empty files → Return empty structure (don't fail)
- Missing files → Log warning, continue
- Malformed checkboxes → Skip line, log warning
- Large files (>10,000 lines) → Warning but process
- Nested tasks → Flatten hierarchy (Notion Tasks DB is flat)
- Special characters in task content → Escape properly

**Dependencies:**
- `fs` - File system access
- `path` - Path manipulation
- None external (pure Node.js)

### 2. Project Sync Handler (`scripts/notion-sync-project.js`)

**Responsibility:** Sync single project to Notion (create or update).

**Main Functions:**
```javascript
async function findProjectByName(projectName)
// Uses notion.search() API (v5 SDK doesn't have databases.query)
// Filters by database_id and exact name match
// Returns: pageId or null

async function syncProjectPage(projectData)
// Creates or updates project page
// Properties: Name, Status, Phase, Components
// Date properties commented out (don't exist in DB yet)
// Returns: pageId

async function syncTasks(pageId, tasksArray)
// Fetches existing tasks from Notion
// Matches by exact content
// Creates new, updates changed
// Returns: { created, updated, failed }

async function syncProject(projectPath, options)
// Main entry point
// Orchestrates: parse → sync page → sync tasks
// Error handling: try-catch with detailed logging
// Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
```

**Notion API v5 Adaptation:**
```javascript
// OLD (v4 SDK):
await notion.databases.query({
  database_id: PROJECTS_DB,
  filter: { property: 'Name', title: { equals: projectName } }
});

// NEW (v5 SDK - databases.query doesn't exist):
const response = await notion.search({
  query: projectName,
  filter: { property: 'object', value: 'page' },
  page_size: 100
});
const exactMatch = response.results.find(page =>
  page.parent?.database_id === PROJECTS_DB &&
  page.properties?.Name?.title?.[0]?.text?.content === projectName
);
```

**Properties Synced:**
```javascript
{
  Name: { title: [{ text: { content: 'Project Name' } }] },
  Status: { select: { name: 'Active' } },
  Phase: { select: { name: 'Phase 1' } },
  Component: { multi_select: [{ name: 'Backend' }, { name: 'Frontend' }] }
  // Date properties skipped (not in DB schema yet)
}
```

**Task Matching Logic:**
```javascript
// Match existing tasks by exact content
const existingTask = existingTasks.find(t =>
  t.properties?.Task?.title?.[0]?.text?.content === task.content
);

if (existingTask) {
  // Update if status changed
  if (existingTask.properties.Status.select.name !== task.status) {
    await notion.pages.update({ page_id: existingTask.id, properties });
  }
} else {
  // Create new task
  await notion.pages.create({ parent: { database_id: TASKS_DB }, properties });
}
```

### 3. Sync Orchestrator (`scripts/notion-daily-sync.js`)

**Responsibility:** Scan all projects, decide what to sync, track state.

**Main Functions:**
```javascript
async function scanProjects()
// Scans dev/active/*/ directories
// Filters: Only directories with all 3 files (plan, context, tasks)
// Returns: Array of project paths

function hasProjectChanged(projectPath, lastSyncTime)
// Compares file modification times (mtime) against last sync
// Returns: true if ANY file newer than lastSyncTime

async function syncAllProjects(options = {})
// Main orchestrator
// For each project:
//   1. Check if changed (unless --force-all)
//   2. If changed → syncProject()
//   3. Track result (synced/skipped/failed)
// Update state file after each project
// Send Telegram alert if failure rate >50%

function loadState() / saveState(state)
// Manage .notion-sync-state.json
// Atomic writes (temp file + rename)
```

**Change Detection Logic:**
```javascript
const files = [
  `${projectPath}/${projectName}-plan.md`,
  `${projectPath}/${projectName}-context.md`,
  `${projectPath}/${projectName}-tasks.md`
];

for (const file of files) {
  const stats = fs.statSync(file);
  const modTime = new Date(stats.mtime).getTime();
  const syncTime = new Date(lastSyncTime).getTime();

  if (modTime > syncTime) {
    return true; // Changed!
  }
}
return false; // No changes
```

**State Management:**
```javascript
// State file structure
{
  lastFullSync: "2025-11-15T10:30:00.000Z",  // Last --force-all sync
  lastSmartSync: "2025-11-15T11:45:00.000Z", // Last smart sync
  projects: {
    "project-name": {
      lastSync: "2025-11-15T11:45:00.000Z",
      lastModified: "2025-11-15T09:30:00.000Z",
      errors: 0,                  // Error counter (reset on success)
      notionPageId: "2ac0a520-...",
      taskCount: 35
    }
  }
}
```

**Sync Modes:**
```bash
# Smart sync (default) - Skip unchanged projects
npm run notion:sync
# Checks file modification times, only syncs if changed

# Force sync - Re-sync ALL projects regardless of changes
npm run notion:sync:force
# Useful for testing or after schema changes
```

### 4. PM2 Cron Automation (`ecosystem.config.js`)

**Configuration:**
```javascript
{
  name: 'notion-sync-15min',
  script: './scripts/notion-daily-sync.js',
  cron_restart: '*/15 8-23 * * *',  // Every 15 minutes, 8am-11pm
  autorestart: false,                // Don't restart on exit (normal for cron)
  error_file: './logs/notion-sync-error.log',
  out_file: './logs/notion-sync-out.log'
},
{
  name: 'notion-sync-nightly',
  script: './scripts/notion-daily-sync.js',
  args: '--force-all',               // Force full re-sync
  cron_restart: '0 2 * * *',         // Daily at 2am
  autorestart: false
}
```

**Cron Patterns:**
- `*/15 8-23 * * *` → Every 15 minutes from 8am to 11pm (64 times/day during work hours)
- `0 2 * * *` → Every day at 2am (full re-sync to catch any drift)

**Why PM2 Cron vs node-cron:**
- ✅ Process isolation (separate log files)
- ✅ Built-in restart policy
- ✅ PM2 dashboard monitoring
- ✅ Easier to disable/enable (`pm2 stop notion-sync-15min`)

### 5. Health Check (`scripts/notion-health-check.js`)

**Checks Performed:**
```javascript
const THRESHOLDS = {
  lastSyncMaxAge: 60 * 60 * 1000,  // 1 hour (warning if sync older)
  maxErrorsPerDay: 5,               // Critical if >5 errors
  maxDatabaseSize: 1000,            // Warning if >1000 rows
  maxApiRate: 2.5                   // Warning if >2.5 req/sec
};

async function runHealthCheck() {
  const checks = {
    lastSync: checkLastSync(state),
    errors: checkErrors(state),
    apiRate: checkApiRate(state),
    databases: await checkDatabaseSizes()
  };

  // Overall status: healthy, warning, error, critical
}
```

**Output Example:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Notion Sync Health Check
⏰ 2025-11-15T12:00:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Overall Status: HEALTHY

✅ Last Sync: Last sync 15 minutes ago
   Time: 2025-11-15T11:45:00.000Z

✅ Errors: 0 errors (OK)

✅ API Rate: Estimated 0.030 req/sec (OK)
   Calls/day: 2,560

✅ Databases: Database sizes OK (max: 253 rows)
   Projects: 3 rows
   Tasks: 253 rows
   Knowledge Base: 0 rows
```

## 🔐 Security & Authentication

### Notion Token

**Location:** `.mcp.json` → `mcpServers.notion.env.NOTION_TOKEN`

**Scopes Required:**
- `read_content` - Read existing pages/databases
- `update_content` - Update existing pages
- `insert_content` - Create new pages/tasks

**Token Type:** Internal integration token (not OAuth)

**Rotation:** Manual (documented in context.md)

### Database IDs

**Hard-coded in scripts (safe - public within workspace):**
```javascript
const PROJECTS_DB = '2ac0a520-3786-819a-b0ab-c7758efab9fb';
const TASKS_DB = '2ac0a520-3786-81ed-8d10-ef3bc2974e3a';
const KNOWLEDGE_BASE_DB = '2ac0a520-3786-81b6-8430-d98b279dc5f2';
```

**Access Control:**
- Integration has access to these databases only
- No broader workspace access

## ⚡ Performance & Rate Limiting

### API Rate Analysis

**Notion Limits:**
- Logged in: 3 requests/second
- Anonymous: 1 request/second

**Our Usage:**
```
Sync frequency: 64 times/day (every 15 min for 16 hours)
Projects: 3 active
API calls per sync: ~10 calls/project
Total calls/day: 64 × 3 × 10 = 1,920 calls
Calls per second: 1,920 / 86,400 = 0.022 req/sec

Safety margin: 3 / 0.022 = 136x under limit ✅
```

**Smart Sync Optimization:**
```
With change detection: Skip 50-80% of projects
Effective calls/day: ~500-1,000 (vs 1,920 max)
Actual usage: 0.030 req/sec (observed during testing)
```

**Rate Limiter (Not Implemented Yet - Not Needed):**
```javascript
// FUTURE: If we add BullMQ (Phase 2)
const limiter = {
  max: 3,      // 3 requests
  duration: 1000  // per 1 second
};
// Current sync is so far under limit, manual delays (350ms) are sufficient
```

### Performance Benchmarks

**Test Data:**
- 3 projects
- 253 tasks total
- Duration: 316 seconds (~5 minutes)

**Breakdown:**
```
Per project:
  - Parse markdown: ~1 second
  - Find/create project page: ~2 seconds
  - Sync tasks (avg 84 tasks): ~100 seconds
  - Total per project: ~103 seconds

3 projects: 309 seconds (+ 7s overhead) = 316 seconds
```

**Optimization Opportunities (Future):**
- Parallel project sync (currently sequential)
- Batch task updates (Notion allows 100 pages in one call)
- Skip unchanged tasks (currently updates all)

**Decision:** Current performance acceptable for MVP. Defer optimizations to Phase 2.

## 📂 State Tracking

### State File: `.notion-sync-state.json`

**Purpose:**
1. Track last sync time per project (for change detection)
2. Track Notion page IDs (avoid duplicate project search)
3. Track error counts (alert if persistent failures)
4. Track overall sync health (last successful sync)

**Schema:**
```typescript
interface SyncState {
  lastFullSync: string | null;      // ISO timestamp
  lastSmartSync: string | null;     // ISO timestamp
  projects: {
    [projectName: string]: {
      lastSync: string;              // ISO timestamp
      lastModified: string;          // ISO timestamp (from file mtime)
      errors: number;                // Error counter (reset on success)
      notionPageId: string;          // Cache to avoid search API
      taskCount: number;             // For health monitoring
    }
  }
}
```

**Update Triggers:**
1. After successful project sync → Update lastSync, reset errors
2. After failed project sync → Increment errors, keep lastSync
3. After full sync cycle → Update lastFullSync or lastSmartSync
4. On file modification → Update lastModified (pre-sync check)

**Atomic Writes:**
```javascript
// Write to temp file, then rename (atomic on POSIX)
const tempFile = '.notion-sync-state.tmp.json';
fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
fs.renameSync(tempFile, '.notion-sync-state.json');
```

## 🔄 Error Handling

### Error Categories

**1. Transient Errors (Retry):**
- Network timeouts
- Notion API rate limits (429)
- Temporary service unavailability

**Retry Strategy:**
```javascript
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    return await notionApiCall();
  } catch (error) {
    if (attempt === 3) throw error;
    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

**2. Parse Errors (Skip & Log):**
- Malformed markdown
- Missing required fields
- Invalid checkbox syntax

**Strategy:** Log warning, continue with other projects

**3. Validation Errors (Fail & Alert):**
- Invalid Notion token
- Missing database IDs
- Database permissions

**Strategy:** Fail entire sync, send Telegram alert

**4. Logic Errors (Should Never Happen):**
- Duplicate project detection
- Task matching failures

**Strategy:** Defensive coding with assertions, log + continue

### Error Logging

**Log Locations:**
```
./logs/notion-sync-error.log    # 15-min sync errors
./logs/notion-sync-out.log      # 15-min sync output
./logs/notion-sync-nightly-error.log  # Nightly sync errors
./logs/notion-sync-nightly-out.log    # Nightly sync output
```

**Log Format:**
```
[2025-11-15 12:00:00] [ERROR] Failed to sync project: client-reactivation-service-v2
  Error: validation_error
  Message: Last Updated is not a property that exists
  Stack: ...
```

### Alerting

**Telegram Integration:**
```javascript
// Send alert if >50% of projects fail
if (failed.length > synced.length) {
  await sendTelegramAlert(`
⚠️ Notion Sync: High failure rate
Synced: ${synced.length}
Failed: ${failed.length}
Check logs: pm2 logs notion-sync-15min
  `);
}
```

**Alert Thresholds:**
- 1-2 failures → Log only (transient)
- 3-5 failures → Warning alert
- >50% failure rate → Critical alert
- All projects fail → Emergency alert

## 🧪 Testing Strategy

### Unit Tests (Future Phase 2)

**Parser Tests:**
```javascript
describe('parseProjectTasks', () => {
  it('should parse simple checkbox', () => {
    const input = '- [ ] Task 1';
    expect(parse(input)).toEqual([{ content: 'Task 1', status: 'Todo' }]);
  });

  it('should parse completed task', () => {
    const input = '- [x] Task 2';
    expect(parse(input)).toEqual([{ content: 'Task 2', status: 'Done' }]);
  });

  // ... 20+ more test cases
});
```

**Sync Handler Tests:**
```javascript
describe('syncProjectPage', () => {
  it('should create new project if not exists', async () => {
    // Mock Notion API
    // Assert: notion.pages.create called with correct properties
  });

  it('should update existing project', async () => {
    // Mock: findProjectByName returns existing page
    // Assert: notion.pages.update called
  });
});
```

### Integration Tests (Manual - Current)

**End-to-End Test:**
```bash
# 1. Create test project
mkdir -p dev/active/test-project
echo "# Test Project" > dev/active/test-project/test-project-plan.md
echo "**Status:** Active" >> dev/active/test-project/test-project-plan.md
echo "## Summary" > dev/active/test-project/test-project-context.md
echo "- [ ] Task 1" > dev/active/test-project/test-project-tasks.md

# 2. Run sync
npm run notion:sync:project dev/active/test-project

# 3. Verify in Notion
# - Project created in Projects DB
# - Task created in Tasks DB
# - Relation set correctly

# 4. Update task
sed -i '' 's/\[ \]/[x]/' dev/active/test-project/test-project-tasks.md

# 5. Re-sync
npm run notion:sync:project dev/active/test-project

# 6. Verify in Notion
# - Task status updated to Done

# 7. Cleanup
rm -rf dev/active/test-project
# Delete from Notion manually
```

### Load Testing

**Stress Test Sync:**
```bash
# Create 10 projects with 100 tasks each
for i in {1..10}; do
  mkdir -p dev/active/load-test-$i
  # ... create files with 100 tasks
done

# Time full sync
time npm run notion:sync:force

# Expected: ~500-600 seconds (10 projects × ~50s each)
# Monitor API rate during sync
```

## 🚀 Deployment

### Local Development

```bash
# 1. Clone repo
git clone <repo>
cd ai_admin_v2

# 2. Install dependencies
npm install

# 3. Configure Notion token
# Edit .mcp.json and add NOTION_TOKEN

# 4. Test sync
npm run notion:sync

# 5. Run health check
node scripts/notion-health-check.js
```

### Production Deployment

```bash
# 1. SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Pull latest code
cd /opt/ai-admin
git pull origin main

# 3. Install dependencies (if new)
npm install

# 4. Test sync manually
npm run notion:sync

# 5. Start PM2 cron jobs
pm2 start ecosystem.config.js --only notion-sync-15min
pm2 start ecosystem.config.js --only notion-sync-nightly

# 6. Verify cron schedule
pm2 describe notion-sync-15min
# Should show: cron_restart: */15 8-23 * * *

# 7. Monitor first sync
pm2 logs notion-sync-15min --lines 100
```

### Rollback Plan

**If sync breaks production:**
```bash
# 1. Stop PM2 cron jobs immediately
pm2 stop notion-sync-15min
pm2 stop notion-sync-nightly

# 2. Check what broke
pm2 logs notion-sync-15min --err --lines 100

# 3. Option A: Quick fix
git log --oneline -5  # Find last good commit
git checkout <commit-hash> -- scripts/notion-*.js
npm run notion:sync  # Test
pm2 restart notion-sync-15min

# 4. Option B: Full rollback
git log --oneline -10
git revert <bad-commit>
pm2 restart notion-sync-15min

# 5. Verify recovery
node scripts/notion-health-check.js
```

## 📚 Related Documentation

- **Emergency Guide:** `docs/NOTION_EMERGENCY_SYNC.md` - Troubleshooting
- **Main Guide:** `CLAUDE.md` → "Notion Workspace Integration" - Quick reference
- **Phase 1 Plan:** `dev/active/notion-workspace-redesign/PHASE_1_QUICK_START.md` - Implementation
- **Tasks Tracking:** `dev/active/notion-workspace-redesign/notion-workspace-redesign-tasks.md` - Detailed checklist

## 🔮 Future Enhancements (Phase 2+)

**BullMQ Queue Integration:**
- Move from direct sync to queue-based processing
- Benefits: Better concurrency, retries, monitoring
- Cost: Added complexity (Redis dependency)

**Bi-directional Sync:**
- Allow editing in Notion → Push back to markdown
- Challenges: Conflict resolution, race conditions
- Requires: Notion webhooks or polling

**Incremental Task Sync:**
- Only sync changed tasks (not all tasks every time)
- Requires: Task-level change tracking (hash or timestamp)

**Batch API Calls:**
- Notion allows 100 pages in one create/update call
- Could reduce API calls by 90%+

**Performance Monitoring:**
- Track sync duration per project over time
- Alert if sync time suddenly increases
- Integrate with existing Prometheus/Grafana

---
**Last updated:** 2025-11-15
**Version:** 1.0 (Phase 1 Complete)
**Author:** Claude Code (AI Admin v2 team)
