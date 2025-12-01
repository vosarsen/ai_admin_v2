# Database Code Review - Task Checklist

**Last Updated:** 2025-12-01 18:50 MSK
**Plan Review Status:** B+ (Conditional Go)
**Current Progress:** 11/79 tasks (14%)
**Next Action:** Execute Phase 0.7 Integration Tests

---

## Phase 0.5: Schema Verification (BLOCKER) ✅ COMPLETE

### Tasks
- [x] Create `scripts/verify-db-schema.js`
- [x] Run against production Timeweb PostgreSQL
- [x] Document all 20 tables with actual column names
- [x] Compare with plan documentation
- [x] Save schema dump to `docs/database/schema-snapshot-2025-12-01.sql`

**Result:** ✅ SCHEMA VERIFICATION: PASS
**Files Created:**
- `docs/database/schema-snapshot-2025-12-01.sql`
- `docs/database/schema-snapshot-2025-12-01.json`
- `docs/database/schema-verification-report-2025-12-01.json`

**Verified Critical Columns:**
- staff_schedules: `yclients_staff_id`, `company_id`, `date` ✅
- staff: `yclients_id`, `company_id`, `name` ✅
- bookings: `yclients_record_id`, `company_id`, `staff_id` ✅
- clients: `yclients_id`, `company_id`, `phone` ✅
- services: `yclients_id`, `company_id`, `title` ✅
- companies: `yclients_id`, `company_id` ✅

---

## Phase 0.7: Integration Tests (BLOCKER) ✅ COMPLETE

### Tasks
- [x] Create `StaffScheduleRepository.integration.test.js`
- [x] Create `BookingRepository.integration.test.js`
- [x] Create `StaffRepository.integration.test.js`
- [x] Create `ClientRepository.integration.test.js`
- [x] Run baseline tests
- [x] Document current pass/fail state
- [x] Fix date comparison issues in tests (timezone handling)

### Test Results (2025-12-01)

| Repository | Passed | Total | Coverage |
|------------|--------|-------|----------|
| **StaffScheduleRepository** | 17 | 17 | Schema, CRUD, Edge Cases |
| **BookingRepository** | 24 | 24 | Schema, CRUD, Status Updates |
| **StaffRepository** | 19 | 19 | Schema, CRUD, Active/Inactive |
| **ClientRepository** | 13 | 13 | Schema, CRUD, Search |
| **TOTAL** | **73** | **73** | **100%** |

### Key Verifications
- ✅ `staff_schedules.yclients_staff_id` column exists (NOT `staff_id`)
- ✅ `bookings.yclients_record_id` column exists
- ✅ `bookings.staff_id` column exists (correct for bookings)
- ✅ `staff.yclients_id` column exists
- ✅ `clients.yclients_id` column exists
- ✅ All repositories use correct column names
- ✅ bulkUpsert and syncBulkUpsert work correctly
- ✅ Russian characters handled properly
- ✅ NULL values handled properly

### Run Command
```bash
RUN_INTEGRATION_TESTS=true npx jest tests/repositories/integration/ --no-coverage --forceExit
```

---

## Phase 1: Critical Column Name Audit

### 1.1 staff_schedules Table Queries
- [x] `src/services/ai-admin-v2/modules/command-handler.js` - staff_id → yclients_staff_id (6 places)
- [x] `src/services/ai-admin-v2/modules/data-loader.js` - staff_id → yclients_staff_id (1 place)
- [x] `src/services/ai-admin-v2/modules/formatter.js` - staff_id → yclients_staff_id (3 places)
- [x] `src/integrations/yclients/data/postgres-data-layer.js` - **VERIFIED CORRECT** (input validation uses API names)
- [x] `src/sync/schedules-sync.js` - **VERIFIED CORRECT** (API→staff_id, DB→yclients_staff_id)
- [x] `src/repositories/StaffScheduleRepository.js` - **VERIFIED CORRECT**

### 1.2 staff Table Queries ✅ COMPLETE
- [x] `src/sync/staff-sync.js` - **VERIFIED CORRECT** (uses yclients_id for DB, staff.id for API)
- [x] `src/services/ai-admin-v2/modules/data-loader.js` - **FIXED** (id → yclients_id)
- [x] `src/repositories/StaffRepository.js` - **VERIFIED CORRECT**
- [x] Search for `staff.id` usage - **VERIFIED**: All uses are for API data, not DB queries

**Bug Fixed in Session 5:**
- `getStaffNamesByIds()` was using `id = ANY($2)` instead of `yclients_id = ANY($2)`
- `favorite_staff_ids` contains YClients IDs (e.g., 2895125), not internal DB IDs (e.g., 16)

### 1.3 bookings Table Queries ✅ COMPLETE
- [x] `src/sync/bookings-sync.js` - **VERIFIED CORRECT** (yclients_record_id, staff_id)
- [x] `src/repositories/BookingRepository.js` - **VERIFIED CORRECT**
- [x] `src/services/booking-monitor/index.js` - **VERIFIED CORRECT**
- [x] NOTE: bookings.staff_id IS correct (not yclients_staff_id)

### 1.4 clients Table Queries ✅ COMPLETE
- [x] `src/sync/clients-sync.js` - **VERIFIED CORRECT** (yclients_id: client.id)
- [x] `src/sync/clients-sync-optimized.js` - **VERIFIED CORRECT**
- [x] `src/repositories/ClientRepository.js` - **VERIFIED CORRECT**
- [x] Search for `client_id` usage - **VERIFIED**: Uses yclients_id consistently

### 1.5 services Table Queries ✅ COMPLETE
- [x] `src/sync/services-sync.js` - **VERIFIED CORRECT** (yclients_id: service.id)
- [x] `src/repositories/ServiceRepository.js` - **VERIFIED CORRECT**
- [x] Search for `service_id` vs `yclients_id` - **VERIFIED**

**Bug Fixed in Session 5:**
- `getServiceNamesByIds()` was using `id = ANY($2)` instead of `yclients_id = ANY($2)`
- `last_service_ids` contains YClients IDs (e.g., 18356010), not internal DB IDs

### 1.6 companies Table Queries ✅ COMPLETE
- [x] `src/sync/company-info-sync.js` - **VERIFIED CORRECT** (yclients_id: companyData.id)
- [x] `src/repositories/CompanyRepository.js` - **VERIFIED CORRECT** (uses yclients_id for lookups)

---

## Phase 2: Repository Pattern Enforcement

### 2.1 command-handler.js Migration ⏸️ DEFERRED
- [ ] Identify all direct postgres.query() calls (2 calls - low priority)
- [ ] Map to existing repository methods
- **NOTE:** command-handler.js has complex booking queries - defer to Phase 2.5

### 2.2 data-loader.js Migration ✅ COMPLETE
- [x] Identify direct postgres.query() calls (was 9 calls)
- [x] Migrate loadClient → ClientRepository.findByRawPhone()
- [x] Migrate loadBookings → BookingRepository.findByClientYclientsId()
- [x] Migrate loadConversation → DialogContextRepository.findByUserIdAndCompany()
- [x] Migrate loadStaffSchedules → StaffRepository.findActiveIds() + StaffScheduleRepository.findByStaffIdsAndDateRange()
- [x] Migrate getStaffNamesByIds → StaffRepository.findNamesByYclientsIds()
- [x] Migrate getServiceNamesByIds → ServiceRepository.findTitlesByYclientsIds()
- [x] Migrate saveContext → DialogContextRepository.upsertWithMessages()
- [x] loadBusinessStats - KEPT (appointments_cache is read-only cache, no repo needed)
- [x] Test: All 73 integration tests passing

### 2.3 Sync Scripts Migration ✅ MOSTLY COMPLETE
**Core Sync (✅ Fully migrated):**
- [x] `schedules-sync.js` - uses StaffScheduleRepository ✓ + deleteOlderThan()
- [x] `staff-sync.js` - uses StaffRepository ✓ + deactivateAll()
- [x] `services-sync.js` - uses ServiceRepository ✓
- [x] `clients-sync.js` - uses ClientRepository ✓
- [x] `bookings-sync.js` - uses BookingRepository ✓ + deleteOlderThan()
- [x] `company-info-sync.js` - uses CompanyRepository ✓

**Secondary Sync (⏸️ Low priority - complex queries):**
- [ ] `clients-sync-optimized.js` - 3 direct queries (batch insert, visit history)
- [ ] `visits-sync.js` - 3 direct queries (visit upsert, statistics)
- [ ] `client-records-sync.js` - 3 direct queries (visit history sync)
- [ ] `goods-transactions-sync.js` - 2 direct queries (rarely used)

### 2.4 postgres-data-layer.js Deprecation ⏸️ DEFERRED
- [ ] List all methods in postgres-data-layer.js
- [ ] Map each method to repository equivalent
- [ ] Find all callers
- [ ] Migrate callers to repositories
- [ ] Mark file as deprecated
- [ ] (Future) Delete file
- **NOTE:** This file is barely used - only 1 postgres.query call for health check

---

## Phase 3: Error Handling Standardization

### 3.1 Repository Error Handling
- [ ] BaseRepository.js - verify Sentry integration
- [ ] ClientRepository.js - audit error handling
- [ ] StaffRepository.js - audit error handling
- [ ] StaffScheduleRepository.js - audit error handling
- [ ] BookingRepository.js - audit error handling
- [ ] ServiceRepository.js - audit error handling
- [ ] CompanyRepository.js - audit error handling
- [ ] All other repositories - audit error handling

### 3.2 Sync Scripts Error Handling
- [ ] schedules-sync.js - add Sentry to catch blocks
- [ ] staff-sync.js - add Sentry to catch blocks
- [ ] services-sync.js - add Sentry to catch blocks
- [ ] All other sync scripts - audit and add Sentry

### 3.3 Worker Error Handling
- [ ] message-worker-v2.js - audit DB error handling
- [ ] booking-monitor-worker.js - audit DB error handling
- [ ] batch-processor.js - audit DB error handling

---

## Phase 4: Legacy Code Cleanup

### 4.1 Remove Supabase References
- [ ] Search for `supabase` in codebase
- [ ] Remove unused imports
- [ ] Clean up commented code
- [ ] Update documentation

### 4.2 Clean Feature Flags
- [ ] Simplify config/database-flags.js
- [ ] Remove USE_LEGACY_SUPABASE (always false)
- [ ] Remove dual-write logic
- [ ] Update .env.example

### 4.3 Remove Deprecated Code
- [ ] Mark postgres-data-layer.js as @deprecated
- [ ] Remove SB_schema.js if unused
- [ ] Clean up test mocks

---

## Verification Checklist

### After Each Phase
- [ ] No SQL errors in PM2 logs
- [ ] All features work (manual test)
- [ ] Sentry shows no new DB errors
- [ ] Run existing tests

### Final Verification
- [ ] CHECK_STAFF_SCHEDULE works
- [ ] Booking creation works
- [ ] Booking cancellation works
- [ ] Booking reschedule works
- [ ] All sync jobs run successfully
- [ ] Search slots works
- [ ] Client lookup works

---

## Progress Summary

| Phase | Status | Tasks Done | Tasks Total |
|-------|--------|------------|-------------|
| **Phase 0.5** | ✅ COMPLETE | 5/5 | 5 |
| **Phase 0.7** | ✅ COMPLETE | 7/7 | 7 |
| Phase 1.1 | ✅ Done | 6/6 | 6 |
| Phase 1.2 | ✅ COMPLETE | 4/4 | 4 |
| Phase 1.3 | ✅ COMPLETE | 4/4 | 4 |
| Phase 1.4 | ✅ COMPLETE | 4/4 | 4 |
| Phase 1.5 | ✅ COMPLETE | 3/3 | 3 |
| Phase 1.6 | ✅ COMPLETE | 2/2 | 2 |
| Phase 2.1 | ⏸️ Deferred | 0/2 | 2 |
| Phase 2.2 | ✅ COMPLETE | 9/9 | 9 |
| Phase 2.3 | ✅ MOSTLY | 6/10 | 10 |
| Phase 2.4 | ⏸️ Deferred | 0/6 | 6 |
| Phase 3 | ⏳ Pending | 0/18 | 18 |
| Phase 4 | ⏳ Pending | 0/9 | 9 |
| **TOTAL** | **In Progress** | **50/89** | **89** |

### Blockers Status
- ✅ **Phase 0.5 (Schema Verification)** - COMPLETE (2025-12-01)
- ✅ **Phase 0.7 (Integration Tests)** - COMPLETE (2025-12-01) - 73/73 tests passing

### Files Verified Correct (No Changes Needed)
- ✅ `StaffScheduleRepository.js` - uses correct `yclients_staff_id`
- ✅ `schedules-sync.js` - correctly maps API to DB names
- ✅ `postgres-data-layer.js` - input validation is correct (uses API field names)

---

## Notes

### Commit Messages Convention
```
fix(db): correct column name in [file] - [description]
refactor(db): migrate [component] to repository pattern
chore(db): remove Supabase legacy code from [file]
```

### Testing Commands
```bash
# Test staff schedule query
curl -X POST http://localhost:3000/api/test/check-staff-schedule \
  -H "Content-Type: application/json" \
  -d '{"staffName": "Бари", "date": "сегодня"}'

# Run sync manually
node -e "require('./src/sync/schedules-sync').SchedulesSync().sync()"

# Check logs for errors
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i error
```
