# Database Code Review - Context

**Last Updated:** 2025-12-01 19:30 MSK
**Session Status:** Phase 0.5 + 0.7 COMPLETE, READY FOR Phase 1
**Next Action:** Continue with Phase 1.2 (staff table queries audit)

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

### What Was Completed This Session (Session 4)

1. **Phase 0.7: Integration Tests** - ✅ COMPLETE
   - All 4 integration test files exist and pass:
     - `StaffScheduleRepository.integration.test.js` - 17/17 tests
     - `BookingRepository.integration.test.js` - 24/24 tests
     - `StaffRepository.integration.test.js` - 19/19 tests
     - `ClientRepository.integration.test.js` - 13/13 tests
   - **TOTAL: 73/73 tests passing (100%)**

2. **Test Fixes Applied**
   - Fixed date comparison issues (Date object timezone handling)
   - Used `getFullYear()/getMonth()/getDate()` instead of `toISOString()` to avoid UTC offset

3. **Key Verifications Confirmed**
   - ✅ All repositories use correct column names
   - ✅ `staff_schedules.yclients_staff_id` NOT `staff_id`
   - ✅ `bookings.yclients_record_id` + `bookings.staff_id` (correct)
   - ✅ bulkUpsert, syncBulkUpsert work correctly
   - ✅ Russian characters and NULL handling work

### Both BLOCKERS Now Complete!
- ✅ **Phase 0.5 (Schema Verification)** - Session 3
- ✅ **Phase 0.7 (Integration Tests)** - Session 4

### What Needs To Be Done Next

**Phase 1.2: staff Table Queries**
- [ ] `src/sync/staff-sync.js` - audit column names
- [ ] `src/services/ai-admin-v2/modules/data-loader.js` - verify staff.yclients_id usage
- [ ] `src/repositories/StaffRepository.js` - verify column names correct
- [ ] Search for `staff.id` usage (should be `staff.yclients_id`)

### Files Modified This Session (NOT YET COMMITTED)

| File | Change |
|------|--------|
| `tests/repositories/integration/StaffScheduleRepository.integration.test.js` | FIX - date comparison timezone issues |
| `dev/active/database-code-review/*` | UPDATED - context, tasks |

### Commands To Run On Restart

```bash
# Run all integration tests
RUN_INTEGRATION_TESTS=true npx jest tests/repositories/integration/ --no-coverage --forceExit

# Check git status
git status

# Continue with Phase 1.2
grep -rn "staff.id" src/ --include="*.js" | grep -v "yclients_id" | head -20
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

5. **PostgreSQL Date objects with timezone** - When comparing dates from DB:
   - PostgreSQL `date` type returns JS Date object with UTC time (e.g., `2025-11-30T21:00:00.000Z` for Moscow `2025-12-01`)
   - **DON'T use** `date.toISOString().split('T')[0]` - gives wrong date due to UTC
   - **DO use** local date methods:
   ```javascript
   const getDateStr = (d) => {
     if (typeof d === 'string') return d;
     const year = d.getFullYear();
     const month = String(d.getMonth() + 1).padStart(2, '0');
     const day = String(d.getDate()).padStart(2, '0');
     return `${year}-${month}-${day}`;
   };
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
