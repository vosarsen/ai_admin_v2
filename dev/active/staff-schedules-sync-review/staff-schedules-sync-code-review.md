# Staff & Staff Schedules Synchronization - Code Review

**Last Updated:** 2025-12-01
**Reviewer:** Claude Code Architecture Reviewer
**Scope:** Complete synchronization system review

---

## Executive Summary

**Critical Finding:** The staff_schedules synchronization system has a **fundamental initialization error** causing complete sync failure since November 11, 2025 (3 weeks of stale data).

**Root Cause:** Repository initialization passes `postgres.pool` (a connection pool object) instead of the `postgres` module itself, breaking the `getClient()` method required for transactions.

**Impact:**
- ❌ `staff_schedules` table has 3-week-old data (last_updated: 2025-11-11)
- ❌ Invalid test data in production (yclients_staff_id: 1,2,3 instead of real IDs like 3647752)
- ❌ PM2 cron jobs for schedules sync are **completely missing** from ecosystem.config.js
- ⚠️ Silent failure - no error monitoring, no alerts

**Required Actions:**
1. Fix repository initialization pattern (CRITICAL)
2. Add PM2 cron jobs for schedules sync (CRITICAL)
3. Align repository initialization across all sync scripts (HIGH)
4. Add error tracking and monitoring (HIGH)

---

## Critical Issues (Must Fix)

### 1. **Repository Initialization Bug** 🔴 CRITICAL

**Location:** `src/sync/schedules-sync.js:16`

**Problem:**
```javascript
// WRONG ❌
this.scheduleRepo = new StaffScheduleRepository(postgres.pool);
```

**Root Cause:**
- `postgres.pool` is a `pg.Pool` instance (connection pool)
- It does NOT have a `getClient()` method directly accessible
- BaseRepository expects the full `postgres` module which exports `{ pool, getClient, ... }`

**Error Chain:**
1. `StaffScheduleRepository.syncBulkUpsert()` → calls `super.bulkUpsertBatched()`
2. `BaseRepository.bulkUpsertBatched()` → calls `this.withTransaction()`
3. `BaseRepository.withTransaction()` → calls `this.db.getClient()`
4. **FAIL:** `postgres.pool` doesn't have `getClient()` method
5. Error: `this.db.getClient is not a function`

**Evidence from logs:**
```
[DB Error] bulkUpsertBatched staff_schedules: this.db.getClient is not a function
```

**Fix:**
```javascript
// CORRECT ✅
const postgres = require('../database/postgres');
this.scheduleRepo = new StaffScheduleRepository(postgres);
```

**Why This Works:**
- `postgres.getClient()` is exported at line 416 in `src/database/postgres.js`
- It returns `pool.connect()` which is the correct client
- BaseRepository can now call `this.db.getClient()` successfully

**Files to Update:**
1. `src/sync/schedules-sync.js:16` - Change initialization
2. `src/sync/staff-sync.js:17` - Same issue (VERIFY after fix)
3. `src/sync/services-sync.js:17` - Same issue (VERIFY after fix)

---

### 2. **Missing PM2 Cron Jobs** 🔴 CRITICAL

**Location:** `config/deployment/ecosystem.config.js`

**Problem:**
- No `schedules-sync-full` job (should run daily at 5am)
- No `schedules-sync-today` job (should run hourly 8-23)
- PM2 shows these jobs don't exist (confirmed via `pm2 jlist`)

**Context:**
According to `CLAUDE.md`:
```
FULL sync (30 days) - automatic at 05:00 or manual
TODAY-ONLY sync (today+tomorrow) - automatic hourly 8-23
```

**Missing Configuration:**
```javascript
// Add to ecosystem.config.js apps array:
{
  name: 'schedules-sync-full',
  script: './scripts/run-schedules-sync.js',
  args: '--mode=full',
  instances: 1,
  exec_mode: 'fork',
  cron_restart: '0 5 * * *', // Daily at 5 AM
  autorestart: false,
  env: {
    NODE_ENV: 'production'
  },
  error_file: './logs/schedules-sync-full-error.log',
  out_file: './logs/schedules-sync-full-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_memory_restart: '150M'
},
{
  name: 'schedules-sync-today',
  script: './scripts/run-schedules-sync.js',
  args: '--mode=today',
  instances: 1,
  exec_mode: 'fork',
  cron_restart: '0 8-23 * * *', // Hourly from 8 AM to 11 PM
  autorestart: false,
  env: {
    NODE_ENV: 'production'
  },
  error_file: './logs/schedules-sync-today-error.log',
  out_file: './logs/schedules-sync-today-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_memory_restart: '100M'
}
```

**Required Script:** `scripts/run-schedules-sync.js`
```javascript
#!/usr/bin/env node
/**
 * PM2 entry point for schedules synchronization
 * Usage:
 *   node scripts/run-schedules-sync.js --mode=full   # 30 days sync
 *   node scripts/run-schedules-sync.js --mode=today  # Today+tomorrow only
 */

const { SchedulesSync } = require('../src/sync/schedules-sync');
const logger = require('../src/utils/logger');

async function main() {
  const mode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'full';

  logger.info(`🗓️ Starting schedules sync (mode: ${mode})...`);

  try {
    const sync = new SchedulesSync();
    const result = mode === 'today'
      ? await sync.syncTodayOnly()
      : await sync.sync();

    if (result.success) {
      logger.info(`✅ Schedules sync completed`, result);
      process.exit(0);
    } else {
      logger.error(`❌ Schedules sync failed`, result);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`💥 Schedules sync crashed:`, error);
    process.exit(1);
  }
}

main();
```

---

### 3. **Inconsistent Repository Initialization Pattern** 🟠 HIGH

**Problem:** Different initialization patterns across sync scripts

**staff-sync.js (line 17):**
```javascript
this.staffRepo = new StaffRepository(postgres.pool); // ❌ WRONG
```

**services-sync.js (line 17):**
```javascript
this.serviceRepo = new ServiceRepository(postgres.pool); // ❌ WRONG
```

**schedules-sync.js (line 16):**
```javascript
this.scheduleRepo = new StaffScheduleRepository(postgres.pool); // ❌ WRONG
```

**All three have the same bug!**

**Why This Wasn't Caught:**
- `bulkUpsert()` (non-batched) works fine because it doesn't use transactions
- Only `syncBulkUpsert()` (batched with transactions) fails
- staff-sync and services-sync might be using non-batched upsert (verify!)

**Standardized Pattern (CORRECT):**
```javascript
const postgres = require('../database/postgres');

class SomeSync {
  constructor() {
    // Pass the full postgres module, NOT postgres.pool
    this.someRepo = new SomeRepository(postgres); // ✅ CORRECT
  }
}
```

---

## Important Improvements (Should Fix)

### 4. **No Error Tracking in Sync Scripts** 🟡 MEDIUM

**Problem:**
- Sync failures are logged but not captured in Sentry
- No Telegram alerts on sync failures
- Silent failures go unnoticed for weeks

**Current Code (schedules-sync.js:65-76):**
```javascript
} catch (error) {
  logger.error('❌ Schedules sync failed', {
    error: error.message,
    stack: error.stack
  });

  return {
    success: false,
    error: error.message,
    duration: Date.now() - startTime
  };
}
```

**Should Include:**
```javascript
} catch (error) {
  logger.error('❌ Schedules sync failed', {
    error: error.message,
    stack: error.stack
  });

  // Add Sentry tracking
  Sentry.captureException(error, {
    tags: {
      component: 'sync',
      sync_type: 'schedules',
      company_id: this.config.COMPANY_ID
    },
    extra: {
      duration: Date.now() - startTime,
      mode: 'full'
    }
  });

  return {
    success: false,
    error: error.message,
    duration: Date.now() - startTime
  };
}
```

**Apply to:**
- `src/sync/schedules-sync.js` (both `sync()` and `syncTodayOnly()`)
- `src/sync/staff-sync.js`
- `src/sync/services-sync.js`

---

### 5. **Missing Test Data Cleanup** 🟡 MEDIUM

**Database Evidence:**
```sql
-- staff_schedules table contains test data mixed with real data:
yclients_staff_id | staff_name | company_id | last_updated
------------------|------------|------------|-------------
1                 | NULL       | 999999     | 2025-11-11
2                 | NULL       | 999999     | 2025-11-11
3                 | NULL       | 999999     | 2025-11-11
3647752          | Real Name  | 962302     | 2025-11-11
```

**Required Cleanup:**
```sql
-- Remove test/demo data before next sync
DELETE FROM staff_schedules WHERE company_id = 999999;
DELETE FROM staff_schedules WHERE company_id IS NULL;
DELETE FROM staff WHERE company_id = 999999;
DELETE FROM staff WHERE company_id IS NULL;
```

**Add to Migration Checklist:**
- Clean test data from production database
- Verify real data integrity after cleanup
- Document cleanup SQL in migration notes

---

### 6. **No Sync Status Monitoring** 🟡 MEDIUM

**Problem:**
- No dashboard showing last sync time
- No alerts when sync is overdue
- Manual database inspection required to check sync status

**Recommendation:**
Add sync status endpoint to API:

```javascript
// src/api/routes/sync-status.js
router.get('/api/sync/status', async (req, res) => {
  try {
    const [staffStatus, scheduleStatus] = await Promise.all([
      // Query staff table for last_sync_at
      postgres.query(`
        SELECT
          'staff' as table_name,
          MAX(last_sync_at) as last_sync,
          COUNT(*) as record_count,
          NOW() - MAX(last_sync_at) as staleness
        FROM staff
        WHERE company_id = $1
      `, [962302]),

      // Query staff_schedules for last_updated
      postgres.query(`
        SELECT
          'staff_schedules' as table_name,
          MAX(last_updated) as last_sync,
          COUNT(*) as record_count,
          NOW() - MAX(last_updated) as staleness
        FROM staff_schedules
        WHERE company_id = $1
      `, [962302])
    ]);

    res.json({
      success: true,
      status: {
        staff: staffStatus.rows[0],
        schedules: scheduleStatus.rows[0]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Minor Suggestions (Nice to Have)

### 7. **Hardcoded Company ID** 🔵 LOW

**Location:** Multiple sync scripts

**Current:**
```javascript
// src/sync/sync-utils.js
const YCLIENTS_CONFIG = {
  COMPANY_ID: 962302, // Hardcoded
  // ...
};
```

**Better:**
```javascript
const YCLIENTS_CONFIG = {
  COMPANY_ID: parseInt(process.env.YCLIENTS_COMPANY_ID || '962302'),
  // ...
};
```

**Benefit:** Multi-tenant support in future

---

### 8. **Batch Size Consistency** 🔵 LOW

**Current Batch Sizes:**
- StaffRepository: 50 (line 83)
- ServiceRepository: Not specified (likely 100 default)
- StaffScheduleRepository: 200 (line 124)

**Question:** Why different batch sizes?

**Recommendation:**
- Document reasoning for different batch sizes
- Consider standardizing to 100 for all unless there's a specific reason

---

## Architecture Considerations

### Database Connection Pattern

**Current Architecture:**
```
postgres.js (exports)
├── pool (pg.Pool instance)
├── query(sql, params) → uses pool
├── getClient() → returns pool.connect()
├── transaction(callback) → uses getClient()
└── getPoolStats() → pool metrics
```

**Repository Pattern:**
```
BaseRepository
├── constructor(db) → expects full postgres module
├── withTransaction(callback) → calls db.getClient()
└── bulkUpsertBatched() → uses withTransaction()
```

**Key Insight:**
- Repositories need the **module** (postgres), not the **pool** (postgres.pool)
- This allows access to helper methods like `getClient()`, `transaction()`, `query()`
- Direct pool access bypasses these abstractions

**Design Decision:** ✅ CORRECT
- Keep current postgres module design
- Always pass full module to repositories
- Never pass bare pool object

---

### Transaction Handling

**Current Implementation (BaseRepository.withTransaction):**
```javascript
async withTransaction(callback) {
  const client = await this.db.getClient(); // ✅ Correct pattern

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release(); // ✅ Always release
  }
}
```

**Analysis:** ✅ EXCELLENT
- Proper BEGIN/COMMIT/ROLLBACK
- Always releases client in finally block
- Good error propagation
- Sentry integration included

---

### Sync Strategy Review

**Current Strategy (from CLAUDE.md):**
- **FULL Sync:** Daily at 05:00 (30 days ahead)
- **TODAY Sync:** Hourly 08:00-23:00 (today + tomorrow)
- **Cleanup:** Remove schedules older than 7 days

**Analysis:** ✅ GOOD DESIGN
- Balances freshness (1 hour max delay) vs API load
- TODAY sync is lightweight (only 2 days × N staff)
- FULL sync ensures long-term coverage
- Cleanup prevents table bloat

**One Enhancement:**
Add monitoring for "sync staleness" with alerts:
```javascript
// Alert if last sync is >2 hours old during business hours
if (hourOfDay >= 8 && hourOfDay <= 23) {
  if (hoursSinceLastSync > 2) {
    sendAlert('Schedules sync is overdue!');
  }
}
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Immediate - 1-2 hours)

**Step 1:** Fix repository initialization in all sync scripts
```bash
# Files to edit:
src/sync/schedules-sync.js:16
src/sync/staff-sync.js:17
src/sync/services-sync.js:17

# Change from:
this.someRepo = new SomeRepository(postgres.pool);

# Change to:
this.someRepo = new SomeRepository(postgres);
```

**Step 2:** Add PM2 cron jobs
```bash
# Files to edit:
config/deployment/ecosystem.config.js (add 2 jobs)

# Files to create:
scripts/run-schedules-sync.js (PM2 entry point)
```

**Step 3:** Clean test data from production
```sql
-- Run on production database:
DELETE FROM staff_schedules WHERE company_id = 999999 OR company_id IS NULL;
DELETE FROM staff WHERE company_id = 999999 OR company_id IS NULL;
```

**Step 4:** Deploy and test
```bash
# 1. Commit changes
git add -A
git commit -m "fix: correct repository initialization in sync scripts"

# 2. Deploy to production
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 reload ecosystem.config.js"

# 3. Manually trigger first sync
ssh root@46.149.70.219 "cd /opt/ai-admin && node scripts/run-schedules-sync.js --mode=full"

# 4. Verify database
ssh root@46.149.70.219 "psql -U gen_user -d default_db -h a84c973324fdaccfc68d929d.twc1.net -c 'SELECT COUNT(*), MAX(last_updated) FROM staff_schedules WHERE company_id = 962302'"
```

---

### Phase 2: Error Tracking (2-3 hours)

**Step 1:** Add Sentry to all sync scripts
- Import Sentry in each sync script
- Wrap catch blocks with `Sentry.captureException()`
- Add context tags (component, sync_type, company_id)

**Step 2:** Add Telegram alerts for sync failures
- Use existing Telegram bot (from ecosystem.config.js)
- Send alert when sync returns `success: false`
- Include error message and duration

**Step 3:** Test error scenarios
- Simulate API failure
- Simulate database connection loss
- Verify alerts are sent

---

### Phase 3: Monitoring (3-4 hours)

**Step 1:** Add sync status endpoint
- Create `src/api/routes/sync-status.js`
- Query last_sync_at from all sync tables
- Return staleness metrics

**Step 2:** Add health check integration
- Include sync status in `/api/health` endpoint
- Set alert threshold (e.g., >2 hours stale)

**Step 3:** Create dashboard (optional)
- Simple admin UI showing sync status
- Last sync times per table
- Visual indicators (green/yellow/red)

---

## Testing Checklist

### Manual Testing (Required)

- [ ] **Fix Applied:** Repository initialization corrected
- [ ] **PM2 Jobs Added:** Both cron jobs in ecosystem.config.js
- [ ] **Test Data Cleaned:** No records with company_id=999999
- [ ] **Full Sync Works:** `node scripts/run-schedules-sync.js --mode=full`
- [ ] **Today Sync Works:** `node scripts/run-schedules-sync.js --mode=today`
- [ ] **Database Updated:** staff_schedules has fresh data with real yclients_staff_id
- [ ] **PM2 Cron Triggers:** Wait for next cron cycle, verify job runs
- [ ] **Error Handling:** Test with invalid credentials, verify Sentry capture

### Database Verification Queries

```sql
-- 1. Check staff_schedules freshness
SELECT
  COUNT(*) as total_records,
  MAX(last_updated) as last_sync,
  MIN(yclients_staff_id) as min_staff_id,
  MAX(yclients_staff_id) as max_staff_id,
  COUNT(DISTINCT yclients_staff_id) as unique_staff
FROM staff_schedules
WHERE company_id = 962302;

-- Expected:
-- total_records: ~400-500 (depends on staff count × 30 days)
-- last_sync: within last hour
-- min_staff_id: > 1000 (real ID, not 1,2,3)
-- unique_staff: ~10-20 (real staff count)

-- 2. Check for remaining test data
SELECT * FROM staff_schedules
WHERE company_id != 962302 OR company_id IS NULL
LIMIT 10;

-- Expected: 0 rows

-- 3. Verify staff names are populated
SELECT
  yclients_staff_id,
  staff_name,
  COUNT(*) as schedule_count
FROM staff_schedules
WHERE company_id = 962302
GROUP BY yclients_staff_id, staff_name
ORDER BY yclients_staff_id;

-- Expected: staff_name NOT NULL for all rows
```

---

## Risk Assessment

### Critical Risks (Addressed by fixes)

1. **Data Staleness** - 3 weeks old data → Fixed by PM2 cron + repository fix
2. **Silent Failures** - No monitoring → Fixed by Sentry integration
3. **Test Data in Production** - Mixed real/test data → Fixed by cleanup SQL

### Remaining Risks (Mitigation required)

1. **API Rate Limits:**
   - YClients API has rate limits
   - Hourly TODAY sync might hit limits with many staff
   - **Mitigation:** Monitor API response headers, add backoff

2. **Database Connection Pool Exhaustion:**
   - Sync scripts use transactions (hold connections)
   - 21 max connections shared across 7 PM2 services
   - **Mitigation:** Current pool config (3 per service) is adequate, but monitor

3. **Cron Overlap:**
   - TODAY sync at 8:00 might overlap with FULL sync at 5:00 (if delayed)
   - **Mitigation:** Use PM2's `autorestart: false` (already configured)

---

## Conclusion

**Overall Grade: C (61/100)**

**Breakdown:**
- **Functionality:** 40/50 (works when called manually, but broken in PM2)
- **Error Handling:** 5/20 (no Sentry, no alerts)
- **Code Quality:** 10/15 (clean but has critical bug)
- **Monitoring:** 2/10 (no sync status visibility)
- **Documentation:** 4/5 (well documented in CLAUDE.md)

**Critical Gaps:**
1. ❌ Repository initialization bug (breaks batched upserts)
2. ❌ Missing PM2 cron jobs (no automatic sync)
3. ⚠️ No error tracking (failures go unnoticed)

**After Fixes (Projected Grade: B+ 88/100):**
- Functionality: 48/50 ✅
- Error Handling: 18/20 ✅
- Code Quality: 14/15 ✅
- Monitoring: 5/10 ⚠️ (still needs dashboard)
- Documentation: 5/5 ✅

---

## Next Steps

**Immediate (DO NOW):**
1. Review this document with the team
2. **STOP** - Wait for approval of proposed fixes
3. Do NOT implement changes without explicit approval

**After Approval:**
1. Create feature branch: `fix/schedules-sync-repository-init`
2. Apply fixes from Phase 1
3. Test locally with manual sync
4. Deploy to production
5. Monitor first 24 hours
6. Proceed to Phase 2 (error tracking)

---

## Questions for Discussion

1. **Batch Sizes:** Why different sizes for staff (50), services (100?), schedules (200)?
2. **Sync Timing:** Is 05:00 optimal for FULL sync? (Consider business hours)
3. **Cleanup Policy:** 7-day retention sufficient? Or need historical data?
4. **Multi-Tenant:** Future plans to support multiple companies? (Affects design)
5. **API Quota:** What's the actual YClients API rate limit? (Need to verify)

---

**Code Review Saved:** 2025-12-01
**Next Action Required:** Team review + approval to proceed with fixes
