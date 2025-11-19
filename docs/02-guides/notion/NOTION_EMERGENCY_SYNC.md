# Notion Emergency Sync Guide

**Quick reference for when sync breaks or needs manual intervention.**

## 🚨 Common Issues & Quick Fixes

### Issue 1: Sync Not Running

**Symptoms:**
- Last sync >1 hour ago
- Projects not updating in Notion

**Check:**
```bash
# Check PM2 processes
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 list | grep notion"

# Expected output:
# notion-sync-15min     cron  stopped
# notion-sync-nightly   cron  stopped
# (status "stopped" is normal for cron jobs - they start on schedule)
```

**Fix:**
```bash
# Manual sync (immediate)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm run notion:sync"

# Force full re-sync (if data looks wrong)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm run notion:sync:force"
```

### Issue 2: Rate Limit Errors

**Symptoms:**
- Sync logs show 429 errors
- "rate_limited" in error messages

**Check Current Rate:**
```bash
node scripts/notion-health-check.js
# Look for "API Rate" line - should be <2.5 req/sec
```

**Fix:**
```bash
# Wait 60 seconds, then retry
sleep 60
npm run notion:sync

# If persistent, increase delays in scripts/notion-sync-project.js
# Current delay: 350ms between operations
# Can increase to 500ms if needed
```

### Issue 3: Duplicate Projects in Notion

**Symptoms:**
- Same project appears multiple times
- Task counts don't match markdown

**Cause:**
- Project name changed in markdown
- Manual project created in Notion

**Fix:**
```bash
# 1. Check state file
cat .notion-sync-state.json | jq '.projects'

# 2. Delete duplicates manually in Notion (web UI)

# 3. Reset state for specific project
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('.notion-sync-state.json', 'utf8'));
delete state.projects['old-project-name'];
fs.writeFileSync('.notion-sync-state.json', JSON.stringify(state, null, 2));
"

# 4. Re-sync
npm run notion:sync:force
```

### Issue 4: Missing Tasks in Notion

**Symptoms:**
- Task exists in markdown but not Notion
- Sync says "updated" but changes not visible

**Fix:**
```bash
# 1. Verify markdown format
cat dev/active/[project-name]/[project-name]-tasks.md
# Ensure checkboxes are: - [ ] or - [x] or - [~]

# 2. Force re-sync specific project
npm run notion:sync:project dev/active/[project-name]

# 3. If still missing, check Notion task database
# Open: https://www.notion.so/2ac0a520-3786-81ed-8d10-ef3bc2974e3a
# Filter by project name
```

### Issue 5: Sync Crashed Mid-Run

**Symptoms:**
- Sync process stopped unexpectedly
- Partial data in Notion
- Error in logs

**Recovery:**
```bash
# 1. Check logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "tail -100 /opt/ai-admin/logs/notion-sync-error.log"

# 2. Check state file for errors
cat .notion-sync-state.json | jq '.projects | to_entries[] | select(.value.errors > 0)'

# 3. Reset error count
node -e "
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('.notion-sync-state.json', 'utf8'));
Object.keys(state.projects).forEach(p => state.projects[p].errors = 0);
fs.writeFileSync('.notion-sync-state.json', JSON.stringify(state, null, 2));
"

# 4. Retry sync
npm run notion:sync:force
```

## 🔧 Manual Sync Commands

### Sync All Projects (Smart - Skip Unchanged)
```bash
# Local
npm run notion:sync

# Production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm run notion:sync"
```

### Force Full Re-Sync (All Projects)
```bash
# Local
npm run notion:sync:force

# Production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm run notion:sync:force"
```

### Sync Single Project Only
```bash
# Local
npm run notion:sync:project dev/active/client-reactivation-service-v2

# Production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm run notion:sync:project dev/active/client-reactivation-service-v2"
```

### Test Parser (No Sync to Notion)
```bash
# Parse all projects (dry run)
npm run notion:parse --all

# Parse specific project
npm run notion:parse dev/active/client-reactivation-service-v2
```

## 📊 Health Monitoring

### Run Health Check
```bash
# Full health report
node scripts/notion-health-check.js

# JSON output (for monitoring tools)
node scripts/notion-health-check.js --json
```

### Check Sync State
```bash
# View last sync times
cat .notion-sync-state.json | jq '.lastFullSync, .lastSmartSync'

# View project-specific state
cat .notion-sync-state.json | jq '.projects["client-reactivation-service-v2"]'

# View all error counts
cat .notion-sync-state.json | jq '.projects | to_entries[] | {name: .key, errors: .value.errors, lastSync: .value.lastSync}'
```

### Check PM2 Cron Jobs
```bash
# List all PM2 processes
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 list"

# Check notion-sync logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs notion-sync-15min --lines 50"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs notion-sync-nightly --lines 50"
```

## 🗂️ State Management

### State File Location
```
.notion-sync-state.json
```

### State File Structure
```json
{
  "lastFullSync": "2025-11-15T10:30:00.000Z",
  "lastSmartSync": "2025-11-15T11:45:00.000Z",
  "projects": {
    "project-name": {
      "lastSync": "2025-11-15T11:45:00.000Z",
      "lastModified": "2025-11-15T09:30:00.000Z",
      "errors": 0,
      "notionPageId": "2ac0a520-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "taskCount": 35
    }
  }
}
```

### Reset State (Nuclear Option)
```bash
# Backup current state
cp .notion-sync-state.json .notion-sync-state.backup.json

# Reset completely
echo '{"lastFullSync": null, "lastSmartSync": null, "projects": {}}' > .notion-sync-state.json

# Force full re-sync (will recreate all state)
npm run notion:sync:force
```

## 🔍 Debugging Tools

### Enable Verbose Logging
```bash
# Edit scripts/notion-daily-sync.js
# Find: const DEBUG = false;
# Change to: const DEBUG = true;

# Run sync with verbose output
npm run notion:sync
```

### Test Notion API Connection
```bash
# Create test script: test-notion-api.js
node -e "
const { Client } = require('@notionhq/client');
const fs = require('fs');
const mcpConfig = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const token = mcpConfig.mcpServers.notion.env.NOTION_TOKEN;
const notion = new Client({ auth: token });

notion.search({ page_size: 1 })
  .then(() => console.log('✅ Notion API connection working'))
  .catch(err => console.error('❌ Notion API error:', err.message));
"
```

### Verify Markdown Files Exist
```bash
# Check all active projects
ls -1 dev/active/*/

# Verify specific project has all 3 files
ls -1 dev/active/client-reactivation-service-v2/*-{plan,context,tasks}.md
```

## 📋 Emergency Contacts

**Notion API Issues:**
- Notion Status Page: https://status.notion.so/
- Rate limits: 3 requests/second (logged in), 1/sec (anonymous)

**Integration Issues:**
- Token location: `.mcp.json` → `mcpServers.notion.env.NOTION_TOKEN`
- Database IDs:
  - Projects: `2ac0a520-3786-819a-b0ab-c7758efab9fb`
  - Tasks: `2ac0a520-3786-81ed-8d10-ef3bc2974e3a`
  - Knowledge Base: `2ac0a520-3786-81b6-8430-d98b279dc5f2`

**Code Locations:**
- Parser: `scripts/notion-parse-markdown.js`
- Project sync: `scripts/notion-sync-project.js`
- Orchestrator: `scripts/notion-daily-sync.js`
- Health check: `scripts/notion-health-check.js`
- PM2 config: `ecosystem.config.js` (lines 133-163)

## 🚀 Recovery Checklist

If sync completely broken, follow this order:

1. ✅ **Test API connection** (see "Test Notion API Connection" above)
2. ✅ **Check state file** (`cat .notion-sync-state.json`)
3. ✅ **Verify markdown files** (`ls dev/active/*/`)
4. ✅ **Check PM2 status** (`pm2 list | grep notion`)
5. ✅ **Review recent logs** (`pm2 logs notion-sync-15min --lines 100`)
6. ✅ **Run health check** (`node scripts/notion-health-check.js`)
7. ✅ **Test parser** (`npm run notion:parse --all`)
8. ✅ **Try manual sync** (`npm run notion:sync`)
9. ✅ **If manual works, check PM2 cron** (`pm2 describe notion-sync-15min`)
10. ✅ **If still broken, reset state** (see "Reset State" above)

## 📖 Related Documentation

- **Architecture:** `docs/NOTION_SYNC_ARCHITECTURE.md` - How sync system works
- **Main Guide:** `CLAUDE.md` → "Notion Workspace Integration" - Quick reference
- **Phase 1 Plan:** `dev/active/notion-workspace-redesign/PHASE_1_QUICK_START.md` - Implementation details

---
**Last updated:** 2025-11-15
**Contact:** Arsen (system maintainer)
