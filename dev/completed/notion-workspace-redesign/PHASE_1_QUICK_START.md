# Phase 1 Quick Start Guide

**Last Updated:** 2025-11-15
**Status:** Phase 0 ✅ Complete | Phase 1 Ready to Start
**Time Estimate:** 21.5 hours

---

## 🎯 Goal of Phase 1

**Automate markdown → Notion sync every 15 minutes**

Current state: Manual
After Phase 1: Automatic

```
Your Workflow After Phase 1:
1. Work in markdown as usual (/dev-docs, tasks.md)
2. Every 15 minutes → Auto-sync to Notion
3. Notion always up-to-date
4. Team sees latest status
5. ZERO manual work!
```

---

## 📋 Implementation Checklist

### Core Scripts (10h)

**1. Markdown Parser** (`scripts/notion-parse-markdown.js` - 2h)
- [ ] Parse `*-plan.md` → extract project metadata
- [ ] Parse `*-tasks.md` → extract checkboxes with status
- [ ] Parse `*-context.md` → extract key decisions
- [ ] Handle edge cases (empty files, no headings, malformed checkboxes)
- [ ] Return structured JSON for Notion API

**2. Project Sync** (`scripts/notion-sync-project.js` - 2h)
- [ ] Take parsed project data
- [ ] Query Notion for existing project page
- [ ] Update or create project in Notion
- [ ] Sync all tasks (create/update, no duplicates)
- [ ] Return success/failure with details

**3. Sync Orchestrator** (`scripts/notion-daily-sync.js` - 2h)
- [ ] Scan `dev/active/*` for project directories
- [ ] For each project: parse → queue → sync
- [ ] Track state (last sync time, errors)
- [ ] Log summary to console
- [ ] Send Telegram alerts on failures

**4. BullMQ Queue** (`src/queue/notion-queue.ts` - 2h)
- [ ] Create `notion-sync` queue
- [ ] Configure rate limiter (3 req/sec)
- [ ] Define job types (sync-project, sync-task)
- [ ] Implement worker with retry logic
- [ ] Monitor queue health

**5. Health Check** (`scripts/notion-health-check.js` - 1h)
- [ ] Check last sync time (<15 min old?)
- [ ] Check error count (<5/day?)
- [ ] Check database sizes (<1000 rows?)
- [ ] Check API rate (<2.5 req/sec average?)
- [ ] Output health status

**6. Manual Commands** (`package.json` - 30min)
```json
{
  "notion:sync": "Sync all projects now",
  "notion:sync:project": "Sync specific project",
  "notion:sync:force": "Force full re-sync",
  "notion:health": "Check sync health"
}
```

### Automation Setup (3h)

**7. Cron Configuration** (PM2 - 1h)
- [ ] Add to `ecosystem.config.js`:
  - 15-minute sync (8am-11pm)
  - Nightly full sync (2am)
- [ ] Test manual trigger
- [ ] Verify cron runs automatically
- [ ] Monitor first few syncs

**8. Documentation Import** (2h)
- [ ] Select 50 critical docs to import
- [ ] Write batch import script
- [ ] Import to Knowledge Base
- [ ] Verify searchable in Notion

### Documentation (2.5h)

**9. Architecture Docs** (`docs/NOTION_SYNC_ARCHITECTURE.md` - 1h)
- [ ] How sync works (flow diagram)
- [ ] Data mapping (markdown → Notion)
- [ ] State management
- [ ] Rate limiting strategy

**10. Emergency Guide** (`docs/NOTION_EMERGENCY_SYNC.md` - 30min)
- [ ] Manual sync commands
- [ ] Common troubleshooting
- [ ] Recovery procedures
- [ ] Rollback plan

**11. Update CLAUDE.md** (1h)
- [ ] Add Notion workflow section
- [ ] Document new npm commands
- [ ] Update quick reference

### Testing & Validation (1h)

**12. End-to-End Test**
- [ ] Modify task in markdown (change [ ] to [x])
- [ ] Wait for sync or trigger manually
- [ ] Verify update in Notion
- [ ] Test all 3 active projects
- [ ] Verify 100% accuracy

---

## 🔧 Technical Configuration

### Database IDs (Already Created)
```javascript
const PROJECTS_DB = '2ac0a520-3786-819a-b0ab-c7758efab9fb';
const TASKS_DB = '2ac0a520-3786-81ed-8d10-ef3bc2974e3a';
const KNOWLEDGE_BASE_DB = '2ac0a520-3786-81b6-8430-d98b279dc5f2';
```

### Sync Frequency
```javascript
// Primary: Every 15 minutes (8am-11pm)
cron.schedule('*/15 8-23 * * *', syncAllProjects);

// Safety: Full sync nightly
cron.schedule('0 2 * * *', () => syncAllProjects({ force: true }));
```

### API Load (Verified Safe)
```
64 syncs/day × 3 projects × 10 calls = 1,920 calls/day
= 0.022 req/sec (136x under 3 req/sec limit)
✅ COMPLETELY SAFE
```

### BullMQ Rate Limit
```javascript
{
  connection: { host: 'localhost', port: 6380 },
  limiter: { max: 3, duration: 1000 }
}
```

---

## 📊 Acceptance Criteria (Phase 1)

**Must Pass ALL:**
- [ ] Daily sync completes in <2 minutes (95th percentile)
- [ ] Sync accuracy: 100% (no missed task updates)
- [ ] API rate limit respected: <3 req/sec average
- [ ] Team using Notion daily (vs weekly)
- [ ] Time savings: ≥2 hours/week
- [ ] Database performance: Load times still <3 seconds

---

## 🚀 Quick Start Commands

```bash
# Start Phase 1 Implementation
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2.nosync

# Create first script
touch scripts/notion-parse-markdown.js

# Install dependencies (if needed)
npm install bullmq  # Might already be installed

# Test Redis connection
redis-cli -p 6380 ping  # Should return "PONG"

# After implementation, test sync
npm run notion:sync

# Monitor sync
npm run notion:health

# Check PM2 cron
pm2 list
```

---

## 💡 Implementation Tips

**Start Small:**
1. Build parser first, test with one project
2. Build single-project sync, test manually
3. Add orchestration
4. Add BullMQ queue
5. Set up cron last

**Test Incrementally:**
- Test parser output before Notion integration
- Test single project before all projects
- Test manual trigger before cron

**Use Existing Patterns:**
- Copy structure from `notion-log-deployment.js`
- Reuse retry logic pattern
- Follow existing error handling

**Debug Helpers:**
```javascript
// Add verbose logging
console.log('Parsed project:', JSON.stringify(project, null, 2));

// Test parser without Notion API
npm run test:parser dev/active/client-reactivation-service-v2

// Dry run (parse but don't sync)
npm run notion:sync -- --dry-run
```

---

## 🎯 Phase 1 Success = User Workflow

**Before Phase 1 (Current):**
```
1. Work in markdown
2. Manually run sync script
3. Check Notion to see updates
4. Repeat...
```

**After Phase 1 (Goal):**
```
1. Work in markdown as usual
2. [Auto-sync every 15 min]
3. Notion always current
4. No manual work! ✨
```

---

## 📞 Next Session Prompt

```
Continue Notion Workspace Redesign Phase 1 implementation:
- Read: dev/active/notion-workspace-redesign/notion-workspace-redesign-context.md
- Read: dev/active/notion-workspace-redesign/PHASE_1_QUICK_START.md
- Start with: scripts/notion-parse-markdown.js
- Goal: Automated markdown → Notion sync every 15 minutes
```

---

**Estimated Time:** 21.5 hours
**Actual Time:** TBD
**Started:** TBD
**Completed:** TBD
