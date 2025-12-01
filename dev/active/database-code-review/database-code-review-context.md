# Database Code Review - Context

**Last Updated:** 2025-12-01 22:15 MSK
**Session Status:** Phase 3 MOSTLY COMPLETE ✅ (Sentry added to all sync scripts)
**Next Action:** Commit changes, then Phase 4 (Legacy Cleanup)

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

### Current State
- **Phase 1: COMPLETE** ✅ (All column name audits done)
- **Next: Phase 2** - Repository Pattern Enforcement
- **Progress:** 35/80 tasks (44%)

---

### What Was Completed This Session (Session 5 - data-loader fixes)

1. **Fixed StaffScheduleRepository Tests** (3 failing → 0 failing)
   - Root cause: PostgreSQL DATE timezone conversion
   - PostgreSQL server in Moscow (UTC+3), stores DATE as midnight MSK
   - When retrieved, comes as UTC timestamp (e.g., `2025-11-30T21:00:00Z` for `2025-12-01 MSK`)
   - Fix: Add MSK offset (+3h) before extracting date string

2. **Phase 1.2: staff table queries** ✅
   - `staff-sync.js` - VERIFIED CORRECT
   - `StaffRepository.js` - VERIFIED CORRECT
   - **BUG FOUND & FIXED**: `data-loader.js::getStaffNamesByIds()` used `id` instead of `yclients_id`

3. **Phase 1.3: bookings table queries** ✅
   - All files VERIFIED CORRECT
   - Note: `bookings.staff_id` IS correct (not yclients_staff_id)

4. **Phase 1.4: clients table queries** ✅
   - All files VERIFIED CORRECT

5. **Phase 1.5: services table queries** ✅
   - `services-sync.js` - VERIFIED CORRECT
   - **BUG FOUND & FIXED**: `data-loader.js::getServiceNamesByIds()` used `id` instead of `yclients_id`

### Commits Made
- `52d86cd`: fix(db): use yclients_id for staff/service lookups in data-loader

### Progress: 64/89 tasks (72%)

---

### What Was Completed Session 7 (Current)

1. **Phase 3.1: Repository Error Handling** ✅ VERIFIED
   - BaseRepository.js already has full Sentry integration
   - All methods capture exceptions with tags and extra context
   - _handleError() normalizes PostgreSQL errors

2. **Phase 3.2: Sync Scripts Error Handling** ✅ COMPLETE
   - Added Sentry.captureException() to 6 core sync scripts:
     - schedules-sync.js
     - staff-sync.js
     - services-sync.js
     - bookings-sync.js
     - clients-sync.js
     - company-info-sync.js
   - All errors now tracked with component=sync, sync_type=<type>

3. **Phase 2.2: data-loader.js Migration** ✅ COMPLETE (from earlier)
   - Migrated 8 of 9 postgres.query() calls to repository pattern
   - Added 8 new repository methods:
     - `ClientRepository.findByRawPhone()`
     - `BookingRepository.findByClientYclientsId()`
     - `BookingRepository.deleteOlderThan()`
     - `DialogContextRepository.findByUserIdAndCompany()`
     - `DialogContextRepository.upsertWithMessages()`
     - `StaffRepository.findActiveIds()`
     - `StaffRepository.findNamesByYclientsIds()`
     - `StaffRepository.deactivateAll()`
     - `ServiceRepository.findTitlesByYclientsIds()`
     - `StaffScheduleRepository.findByStaffIdsAndDateRange()`
     - `StaffScheduleRepository.deleteOlderThan()`
   - 1 query KEPT: loadBusinessStats (appointments_cache is read-only cache)

2. **Phase 2.3: Sync Scripts Migration** ✅ MOSTLY COMPLETE
   - Core sync scripts fully migrated: schedules, staff, services, clients, bookings, company
   - Secondary sync scripts deferred (clients-sync-optimized, visits, client-records, goods-transactions)

3. **All tests passing:** 73/73 integration tests ✅

**Progress:** 50/89 tasks (56%) - up from 35/80 (44%)

---

### What Was Completed Session 6

1. **Phase 1.6: companies table queries** ✅ COMPLETE
   - `company-info-sync.js` - **VERIFIED CORRECT** (uses `yclients_id: companyData.id`)
   - `CompanyRepository.js` - **VERIFIED CORRECT** (uses `yclients_id` for all lookups)

**🎉 Phase 1 COMPLETE! Summary:**
- Phase 1.1: staff_schedules ✅
- Phase 1.2: staff ✅ (1 bug fixed in data-loader.js)
- Phase 1.3: bookings ✅
- Phase 1.4: clients ✅
- Phase 1.5: services ✅ (1 bug fixed in data-loader.js)
- Phase 1.6: companies ✅

**Total Phase 1 bugs found and fixed: 2**
- `getStaffNamesByIds()`: id → yclients_id
- `getServiceNamesByIds()`: id → yclients_id

---

### What Was Completed Session 4 (Integration Tests)

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
