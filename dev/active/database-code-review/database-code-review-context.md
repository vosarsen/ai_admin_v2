# Database Code Review - Context

**Last Updated:** 2025-12-01 18:50 MSK
**Session Status:** Phase 0.5 COMPLETE, Phase 0.7 PENDING
**Next Action:** Execute Phase 0.7 Integration Tests

---

## Key Discovery

### The staff_id vs yclients_staff_id Bug

**Symptom:** User asked "Бари работает сегодня?" and got incorrect response saying Бари doesn't work.

**Root Cause:** SQL queries used `staff_id` but actual column is `yclients_staff_id`.

**Error in logs:**
```
[DB Error] column "staff_id" does not exist
query: SELECT * FROM staff_schedules WHERE date = $1 AND staff_id = $2
```

**Fixed in:**
- command-handler.js (6 places)
- data-loader.js (1 place)
- formatter.js (3 places)

---

## Database Schema Reference

### staff_schedules Table
```sql
id                | bigint (PK)
yclients_staff_id | integer (FK to staff.yclients_id)
staff_name        | varchar
date              | date
is_working        | boolean
work_start        | time
work_end          | time
working_hours     | varchar
last_updated      | timestamp
has_booking_slots | boolean
company_id        | integer
```

### staff Table
```sql
id               | integer (PK)
yclients_id      | integer (YClients external ID)
company_id       | integer
name             | varchar
specialization   | varchar
position         | varchar
is_active        | boolean
is_bookable      | boolean
rating           | numeric
declensions      | jsonb
...
```

### bookings Table
```sql
id                 | uuid (PK)
yclients_record_id | integer (YClients external ID)
company_id         | integer
client_phone       | varchar
client_yclients_id | integer
staff_id           | integer (NOTE: This one IS correct!)
staff_name         | varchar
services           | array
datetime           | timestamp
...
```

---

## Key Files

### Database Layer
- `src/database/postgres.js` - Connection pool, query(), getClient(), transaction()

### Repositories (17 total)
- `src/repositories/BaseRepository.js` - Foundation class
- `src/repositories/StaffScheduleRepository.js` - Staff schedules
- `src/repositories/StaffRepository.js` - Staff members
- `src/repositories/ClientRepository.js` - Clients
- `src/repositories/BookingRepository.js` - Bookings
- `src/repositories/ServiceRepository.js` - Services
- `src/repositories/CompanyRepository.js` - Companies

### Sync Scripts (9 total)
- `src/sync/schedules-sync.js` - Schedules from YClients
- `src/sync/staff-sync.js` - Staff from YClients
- `src/sync/services-sync.js` - Services from YClients
- `src/sync/clients-sync.js` - Clients from YClients
- `src/sync/bookings-sync.js` - Bookings from YClients

### Main Application Files
- `src/services/ai-admin-v2/modules/command-handler.js` - Command execution (~2800 lines)
- `src/services/ai-admin-v2/modules/data-loader.js` - Data loading
- `src/services/ai-admin-v2/modules/formatter.js` - Response formatting

### Feature Flags
- `config/database-flags.js` - USE_REPOSITORY_PATTERN, USE_LEGACY_SUPABASE

---

## Naming Convention Mapping

| YClients API | Database Column | Code Variable |
|--------------|-----------------|---------------|
| staff.id | yclients_id (staff) | staffId, staff.yclients_id |
| staff.id | yclients_staff_id (schedules) | staffId |
| record.id | yclients_record_id | recordId, bookingId |
| client.id | yclients_id | clientId |
| service.id | yclients_id | serviceId |
| company.id | yclients_id | companyId |

---

## Known Issues (To Fix)

### ~~1. postgres-data-layer.js Still Uses staff_id~~ - **FALSE POSITIVE**
~~Location: `src/integrations/yclients/data/postgres-data-layer.js`~~
~~Line ~427: `if (!schedule.staff_id || ...)`~~

**VERIFIED CORRECT (2025-12-01 plan review):**
This is INPUT validation for YClients API data, which uses `staff_id`.
The repository handles the mapping to `yclients_staff_id` when writing to DB.
**Do NOT change this code.**

### 2. Some Sync Scripts May Have Issues
Need to verify:
- clients-sync.js
- bookings-sync.js
- visits-sync.js

**UPDATE (2025-12-01):** `schedules-sync.js` verified correct - uses `staff_id` for API input, `yclients_staff_id` for DB output.

### 3. Tests May Have Outdated Column Names
Location: `src/services/ai-admin-v2/__tests__/`

---

## Decisions Made

1. **Column naming follows database** - Code adapts to DB schema, not vice versa
2. **All access through repositories** - Direct postgres.query() to be phased out
3. **Keep yclients_ prefix** - Distinguishes external IDs from internal PKs
4. **Sentry for all errors** - No silent failures

---

## Session Notes

### Session 1 (2025-12-01)
- Discovered staff_id vs yclients_staff_id bug
- Fixed command-handler.js, data-loader.js, formatter.js
- Created this code review project
- Need to continue with full audit

### Session 2 (2025-12-01) - Plan Review
- Ran plan-reviewer agent for comprehensive analysis
- **Grade: B+ (Conditional Go)**

**Key findings:**
1. ✅ `StaffScheduleRepository.js` - Already uses correct column names
2. ✅ `schedules-sync.js` - Already correct (API→`staff_id`, DB→`yclients_staff_id`)
3. ✅ `postgres-data-layer.js` - False positive! Input validation is correct
4. ⚠️ Added Phase 0.5 (Schema Verification) as BLOCKER
5. ⚠️ Added Phase 0.7 (Integration Tests) as BLOCKER
6. ⚠️ Updated effort estimate: 16-24h → 22-32h
7. ⚠️ Phase 4 scope increased: 38 files with Supabase refs (not 10)

**New sections added to plan:**
- Rollback Strategy (3 levels)
- Monitoring Plan (Sentry alerts, baseline metrics)
- Schema Naming Inconsistency documentation
- Field Name Mapping Reference (API vs DB)

**Decision:** Do NOT proceed with Phase 1 until Phase 0.5 and 0.7 complete

### Session 3 (2025-12-01) - Phase 0.5 Execution

**Completed Phase 0.5: Schema Verification**

1. Created `scripts/verify-db-schema.js` - comprehensive schema verification tool
2. Ran against production Timeweb PostgreSQL
3. All 20 tables documented with column names
4. All critical columns verified:
   - `staff_schedules.yclients_staff_id` ✅
   - `staff.yclients_id` ✅
   - `bookings.yclients_record_id` ✅
   - `bookings.staff_id` ✅ (correct - not yclients_staff_id)
   - `clients.yclients_id` ✅
   - `services.yclients_id` ✅
   - `companies.yclients_id` ✅

**Output files:**
- `docs/database/schema-snapshot-2025-12-01.sql` - human-readable schema
- `docs/database/schema-snapshot-2025-12-01.json` - machine-readable schema
- `docs/database/schema-verification-report-2025-12-01.json` - verification report

**Result:** ✅ PASS - Ready for Phase 0.7 (Integration Tests)

**Key Discovery:** The schema naming is consistent:
- `staff_schedules` uses `yclients_staff_id` (FK to staff)
- `bookings` uses `staff_id` (different naming, same meaning)
- This is documented technical debt, not a bug

### Session 3 continued - Bug Fix

**Fixed Bug:** `this.db.getClient is not a function` in schedules-sync.js

**Root Cause:** BaseRepository.withTransaction() called `this.db.getClient()` but postgres.js exports `getClient` as a standalone function, not a method on the pool object.

**Fix:** Updated BaseRepository.js to support multiple connection patterns:
```javascript
// Support both: db.getClient() (if db is postgres module) and db.pool.connect() (if db is pool)
if (typeof this.db.getClient === 'function') {
  client = await this.db.getClient();
} else if (this.db.pool && typeof this.db.pool.connect === 'function') {
  client = await this.db.pool.connect();
} else if (typeof this.db.connect === 'function') {
  client = await this.db.connect();
}
```

**Result:** ✅ Schedules sync now works: 29 processed, 0 errors, 972ms

---

## HANDOFF NOTES FOR NEXT SESSION

### What Was Completed This Session

1. **Plan Review by plan-reviewer agent** - Grade B+ (Conditional Go)
   - Identified 3 files that DON'T need changes (StaffScheduleRepository, schedules-sync, postgres-data-layer)
   - Added Phase 0.5 and 0.7 as blockers
   - Updated effort estimate from 16-24h to 22-32h

2. **Phase 0.5: Schema Verification** - ✅ COMPLETE
   - Created `scripts/verify-db-schema.js`
   - All 20 tables documented with column names
   - All critical columns verified (yclients_staff_id, yclients_id, etc.)
   - Output: `docs/database/schema-snapshot-2025-12-01.*`

3. **Bug Fix: schedules-sync.js**
   - Fixed `this.db.getClient is not a function` in BaseRepository.js
   - Sync now works: 29 records, 0 errors

### What Needs To Be Done Next

**Phase 0.7: Integration Tests** (the remaining BLOCKER)
- Create `tests/repositories/integration/StaffScheduleRepository.integration.test.js`
- Create `tests/repositories/integration/BookingRepository.integration.test.js`
- Create `tests/repositories/integration/StaffRepository.integration.test.js`
- Run baseline tests before Phase 1

### Files Modified This Session (NOT YET COMMITTED)

| File | Change |
|------|--------|
| `scripts/verify-db-schema.js` | NEW - schema verification tool |
| `src/repositories/BaseRepository.js` | FIX - withTransaction() connection handling |
| `docs/database/schema-snapshot-2025-12-01.sql` | NEW - schema dump |
| `docs/database/schema-snapshot-2025-12-01.json` | NEW - schema JSON |
| `docs/database/schema-verification-report-2025-12-01.json` | NEW - verification report |
| `dev/active/database-code-review/*` | UPDATED - plan, context, tasks |

### Commands To Run On Restart

```bash
# Verify schema verification script works
node scripts/verify-db-schema.js --compare

# Test schedules sync still works after bug fix
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const { SchedulesSync } = require('./src/sync/schedules-sync');
new SchedulesSync().sync().then(r => console.log(JSON.stringify(r, null, 2)));
\""

# Check for uncommitted changes
git status
```

### Key Discoveries (Hard to Rediscover)

1. **postgres-data-layer.js is CORRECT** - Line 427-428 validates INPUT from YClients API (uses `staff_id`), not DB columns. The repository handles mapping to `yclients_staff_id`.

2. **schedules-sync.js is CORRECT** - Uses `staff_id` for API calls, `yclients_staff_id` for DB writes. This is correct!

3. **Schema naming inconsistency is TECHNICAL DEBT, not bug**:
   - `staff_schedules.yclients_staff_id` (FK to staff)
   - `bookings.staff_id` (same meaning, different name)
   - Decision: Fix CODE, not SCHEMA

4. **BaseRepository connection pattern** - Must support multiple ways to get client:
   ```javascript
   if (typeof this.db.getClient === 'function') {
     client = await this.db.getClient();
   } else if (this.db.pool && typeof this.db.pool.connect === 'function') {
     client = await this.db.pool.connect();
   } else if (typeof this.db.connect === 'function') {
     client = await this.db.connect();
   }
   ```

---

## Quick Reference Commands

```bash
# Find all staff_id references (potential issues)
grep -rn "staff_id" src/ --include="*.js" | grep -v "yclients_staff_id"

# Find all direct postgres queries
grep -rn "postgres\.query" src/ --include="*.js"

# Check database schema
psql $DB_URL -c "\d+ staff_schedules"

# Run schedules sync manually
node -e "require('./src/sync/schedules-sync').SchedulesSync().sync()"
```

---

## Related Documentation

- `dev/completed/database-migration-supabase-timeweb/` - Migration history
- `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md` - DB overview
- `src/repositories/README.md` - Repository pattern guide
