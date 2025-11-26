# Supabase Full Removal - Tasks

**Last Updated:** 2025-11-26 (Session 3 - Phase 3 Complete)
**Progress:** 31/42 tasks (74%)
**Estimated Time Remaining:** 4-5 hours

---

## Phase 1: Dead Code Removal ✅ COMPLETE

### 1.1 Remove Unused Files
- [x] Delete `src/services/vector-memory/` directory
- [x] Delete `src/database/optimized-supabase.js`
- [x] Delete `src/integrations/whatsapp/auth-state-supabase.js`
- [x] Verify no imports break after deletion

### 1.2 Archive MCP Server
- [x] Create `archive/` directory if not exists
- [x] Move `mcp/mcp-supabase/` → `archive/mcp-supabase/`
- [x] Update `.mcp.json` - remove supabase server entry
- [x] Update `.mcp.json.example` - remove supabase server entry

### 1.3 Additional Cleanup (DISCOVERED)
- [x] Remove `useSupabaseAuthState` import from `session-pool.js`
- [x] Remove feature flag logic from `session-pool.js` (lines 285-303)

### 1.4 Verification & Commit
- [x] Run `grep -r "vector-memory" src/` - ✅ empty
- [x] Run `grep -r "auth-state-supabase" src/` - ✅ empty
- [x] Commit: `2468654` - refactor: remove dead Supabase code (Phase 1)

---

## Phase 2: Bulk Operations in Repositories ✅ COMPLETE

### 2.1 Implement BaseRepository Methods
- [x] Add `_chunk()` helper method
- [x] Add `bulkUpsertBatched(table, dataArray, conflictColumns, options)` method
- [x] Add Sentry tracking with `migration_phase: 'supabase_removal'` tag
- [x] Transaction support for bulk operations

### 2.2 Implement syncBulkUpsert in Each Repository
- [x] ClientRepository.syncBulkUpsert() - conflict on `(yclients_id, company_id)`, batchSize=100
- [x] ServiceRepository.syncBulkUpsert() - conflict on `(yclients_id, company_id)`, batchSize=100
- [x] StaffRepository.syncBulkUpsert() - conflict on `(yclients_id, company_id)`, batchSize=50
- [x] StaffScheduleRepository.syncBulkUpsert() - conflict on `(yclients_staff_id, date, company_id)`, batchSize=200
- [x] BookingRepository.syncBulkUpsert() - conflict on `(yclients_record_id, company_id)`, batchSize=100

### 2.3 Testing & Commit
- [x] Verify all methods exist via node -e test
- [x] Test _chunk() function with edge cases
- [x] Commit: `3770087` - feat: add bulkUpsertBatched() for sync operations (Phase 2)

---

## Phase 3: Sync Modules Migration ✅ COMPLETE

### 3.1 Migrate services-sync.js ✅
- [x] Replace `const { supabase } = require('../database/supabase')`
- [x] Add `const postgres = require('../database/postgres')`
- [x] Add `const ServiceRepository = require('../repositories/ServiceRepository')`
- [x] Replace `supabase.from('services').upsert()` with `serviceRepo.syncBulkUpsert()`
- [x] Commit first services-sync.js commit

### 3.2 Migrate staff-sync.js ✅
- [x] Replace Supabase imports with repository
- [x] Replace `supabase.from('staff')` with `staffRepo.syncBulkUpsert()`
- [x] Replace `deactivateAllStaff()` with direct PostgreSQL query
- [x] Commit: `5785050` - refactor: migrate staff-sync to Repository Pattern

### 3.3 Migrate company-info-sync.js ✅
- [x] Replace Supabase imports
- [x] Replace `supabase.from('companies')` with `companyRepo.upsert()`
- [x] Commit: `1475415` - refactor: migrate company-info-sync to Repository Pattern

### 3.4 Migrate clients-sync.js ✅
- [x] Replace Supabase imports
- [x] Replace `supabase.from('clients')` with `clientRepo.syncBulkUpsert()`
- [x] Replace `syncVisitHistory` supabase call with repository
- [x] Commit: `5d8cbd9` - refactor: migrate clients-sync to Repository Pattern

### 3.5 Migrate schedules-sync.js ✅
- [x] Replace Supabase imports
- [x] Replace `supabase.from('staff_schedules')` with `scheduleRepo.syncBulkUpsert()`
- [x] Replace `cleanupOldSchedules()` with direct PostgreSQL query
- [x] Commit: `4fe5fe9` - refactor: migrate schedules-sync to Repository Pattern

### 3.6 Migrate visits-sync.js ✅
- [x] Replace Supabase imports with direct postgres
- [x] Replace `getClientsForSync()` with direct SQL
- [x] Replace `saveVisitsBatch()` with INSERT ON CONFLICT
- [x] Commit: `ab980eb` - refactor: migrate visits-sync to direct PostgreSQL queries

### 3.7 Migrate client-records-sync.js ✅
- [x] Replace Supabase imports with direct postgres
- [x] Replace `syncClientRecordsByPhone()` with direct SQL
- [x] Replace `saveClientVisits()` with direct SQL UPDATE
- [x] Commit: `e4e211a` - refactor: migrate client-records-sync to direct PostgreSQL queries

### 3.8 Migrate goods-transactions-sync.js ✅
- [x] Replace Supabase imports with direct postgres
- [x] Replace `updateClientsWithGoods()` with direct SQL
- [x] Commit: `b3fb67e` - refactor: migrate goods-transactions-sync to direct PostgreSQL queries

### 3.9 Migrate bookings-sync.js ✅
- [x] Replace Supabase imports
- [x] Replace `supabase.from('bookings')` with `bookingRepo.syncBulkUpsert()`
- [x] Replace `cleanupOldBookings()` with direct DELETE query
- [x] Remove old `upsertBookings()` method (replaced by syncBulkUpsert)
- [x] Commit: `0ed6422` - refactor: migrate bookings-sync to Repository Pattern

---

## Phase 4: Code Cleanup (2-3 hours) ⏳ NEXT

### 4.1 Migrate supabase-data-layer.js (CRITICAL - HIGH PRIORITY)
- [ ] This file is used by booking service and AI Admin
- [ ] Options:
  - A) Rename to yclients-data-layer.js and use Repository Pattern
  - B) Make it use direct PostgreSQL (same as sync modules)
- [ ] Replace all 20+ Supabase calls with Repository/direct SQL
- [ ] Update all imports that reference it

### 4.2 Clean Service Imports
- [ ] Clean `src/services/booking/index.js` - remove SupabaseDataLayer
- [ ] Clean `src/services/ai-admin-v2/modules/data-loader.js` - remove supabase
- [ ] Clean `src/services/ai-admin-v2/modules/command-handler.js`
- [ ] Clean `src/services/marketplace/marketplace-service.js`
- [ ] Clean `src/services/webhook-processor/index.js`

### 4.3 Clean API Routes
- [ ] Clean `src/api/routes/health.js`
- [ ] Clean `src/api/routes/yclients-marketplace.js`
- [ ] Clean `src/api/webhooks/yclients.js`
- [ ] Clean `src/api/websocket/marketplace-socket.js`

### 4.4 Clean Workers and Monitoring
- [ ] Clean `src/workers/message-worker-v2.js`
- [ ] Clean `src/monitoring/health-check.js`
- [ ] Clean `src/utils/critical-error-logger.js`

### 4.5 Delete Core Supabase Files
- [ ] Delete `src/database/supabase.js`
- [ ] Delete `src/sync/clients-sync-optimized.js` (dead code)
- [ ] Delete `src/services/booking-monitor/index-old.js` and `index-new.js` (if dead)
- [ ] Verify no import errors

### 4.6 Update Configuration
- [ ] Run `npm uninstall @supabase/supabase-js`
- [ ] Remove `USE_LEGACY_SUPABASE` from `config/database-flags.js`
- [ ] Update `.env.example` - remove SUPABASE_* vars

### 4.7 Final Code Verification
- [ ] `grep -r "require.*supabase" src/` returns 0
- [ ] `grep -r "@supabase" package.json` returns 0
- [ ] Run syntax check on all modified files
- [ ] Commit Phase 4 changes

---

## Phase 5: Documentation & Deploy (1-2 hours) ⬜ PENDING

### 5.1 Update Documentation
- [ ] Update `CLAUDE.md` - remove Supabase references
- [ ] Update `docs/01-architecture/` - update diagrams
- [ ] Create migration summary in `docs/03-development-diary/`

### 5.2 Pre-Deploy Checklist
- [ ] All Phase 1-4 tasks marked complete
- [ ] All tests passing (`npm test`)
- [ ] Backup created and verified
- [ ] Deploy window selected (3-5 AM Moscow)

### 5.3 Production Deploy
- [ ] SSH to server
- [ ] Create backup: `node scripts/backup/backup-postgresql.js`
- [ ] Pull changes: `git pull origin main`
- [ ] Install deps: `npm install`
- [ ] Remove SUPABASE_* from .env
- [ ] Restart: `pm2 restart all --update-env`

### 5.4 Post-Deploy Verification
- [ ] PM2 status: All "online"
- [ ] No errors in logs (5 min watch)
- [ ] WhatsApp bot responding (test 89686484488)
- [ ] Sync test: trigger manual sync
- [ ] Sentry: no new errors for 30 min

### 5.5 Finalize
- [ ] Update this task file - mark all complete
- [ ] Move project to `dev/completed/`
- [ ] Update CLAUDE.md with new status

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Dead Code | 12/12 | ✅ Complete |
| Phase 2: Bulk Operations | 10/10 | ✅ Complete |
| Phase 3: Sync Migration | 9/9 | ✅ Complete |
| Phase 4: Code Cleanup | 0/18 | ⏳ Next |
| Phase 5: Deploy | 0/11 | ⬜ Pending |
| **TOTAL** | **31/60** | **52% Complete** |

---

## Session 3 Commits

| Commit | Message | Files Changed |
|--------|---------|---------------|
| (first) | refactor: migrate services-sync to Repository Pattern | 1 file |
| `5785050` | refactor: migrate staff-sync to Repository Pattern | 1 file, -58 lines |
| `1475415` | refactor: migrate company-info-sync to Repository Pattern | 1 file, -28 lines |
| `5d8cbd9` | refactor: migrate clients-sync to Repository Pattern | 1 file, -55 lines |
| `4fe5fe9` | refactor: migrate schedules-sync to Repository Pattern | 1 file, -34 lines |
| `ab980eb` | refactor: migrate visits-sync to direct PostgreSQL queries | 1 file, +1/-1 |
| `e4e211a` | refactor: migrate client-records-sync to direct PostgreSQL queries | 1 file, +7/-7 |
| `b3fb67e` | refactor: migrate goods-transactions-sync to direct PostgreSQL queries | 1 file, -2 lines |
| `0ed6422` | refactor: migrate bookings-sync to Repository Pattern | 1 file, -101 lines |

**Total Session 3:** ~400+ lines removed from 9 sync modules

---

## Files Still Using Supabase (Phase 4 Targets)

```
src/database/supabase.js                    # DELETE
src/utils/critical-error-logger.js          # CLEAN
src/integrations/yclients/data/supabase-data-layer.js  # MIGRATE (BIG!)
src/api/websocket/marketplace-socket.js     # CLEAN
src/api/webhooks/yclients.js               # CLEAN
src/api/routes/health.js                    # CLEAN
src/api/routes/yclients-marketplace.js      # CLEAN
src/workers/message-worker-v2.js            # CLEAN
src/sync/clients-sync-optimized.js          # DELETE (dead code)
src/monitoring/health-check.js              # CLEAN
src/services/booking-monitor/index-old.js   # DELETE (dead code)
src/services/booking-monitor/index-new.js   # CHECK if used
src/services/booking/index.js               # MIGRATE
src/services/marketplace/marketplace-service.js  # CLEAN
src/services/ai-admin-v2/index.js           # CLEAN
src/services/ai-admin-v2/modules/data-loader.js  # MIGRATE
src/services/ai-admin-v2/modules/command-handler.js  # CLEAN
src/services/webhook-processor/index.js     # CLEAN
```

**Total: ~18 files to migrate/clean/delete in Phase 4**

---

## Next Session Instructions

1. Read `supabase-full-removal-context.md` for full context
2. Start with `supabase-data-layer.js` - it's the largest and most critical
3. Then clean service files one by one
4. After all cleaned, delete `src/database/supabase.js`
5. Run `npm uninstall @supabase/supabase-js`
6. Final verification

**Key insight from Session 3:** Direct PostgreSQL queries work well for sync modules without dedicated repositories. Consider same approach for Phase 4 where Repository doesn't exist.
