# Database Code Review - Task Checklist

**Last Updated:** 2025-12-01

---

## Phase 1: Critical Column Name Audit

### 1.1 staff_schedules Table Queries
- [x] `src/services/ai-admin-v2/modules/command-handler.js` - staff_id → yclients_staff_id (6 places)
- [x] `src/services/ai-admin-v2/modules/data-loader.js` - staff_id → yclients_staff_id (1 place)
- [x] `src/services/ai-admin-v2/modules/formatter.js` - staff_id → yclients_staff_id (3 places)
- [ ] `src/integrations/yclients/data/postgres-data-layer.js` - audit for staff_id usage
- [ ] `src/sync/schedules-sync.js` - verify uses yclients_staff_id
- [ ] `src/repositories/StaffScheduleRepository.js` - verify column names correct

### 1.2 staff Table Queries
- [ ] `src/sync/staff-sync.js` - audit column names
- [ ] `src/services/ai-admin-v2/modules/data-loader.js` - verify staff.yclients_id usage
- [ ] `src/repositories/StaffRepository.js` - verify column names correct
- [ ] Search for `staff.id` usage (should be `staff.yclients_id`)

### 1.3 bookings Table Queries
- [ ] `src/sync/bookings-sync.js` - audit column names
- [ ] `src/repositories/BookingRepository.js` - verify column names
- [ ] `src/services/booking-monitor/index.js` - audit queries
- [ ] NOTE: bookings.staff_id IS correct (not yclients_staff_id)

### 1.4 clients Table Queries
- [ ] `src/sync/clients-sync.js` - audit column names
- [ ] `src/sync/clients-sync-optimized.js` - audit column names
- [ ] `src/repositories/ClientRepository.js` - verify uses yclients_id
- [ ] Search for `client_id` usage (should be `yclients_id` or `client_yclients_id`)

### 1.5 services Table Queries
- [ ] `src/sync/services-sync.js` - audit column names
- [ ] `src/repositories/ServiceRepository.js` - verify uses yclients_id
- [ ] Search for `service_id` vs `yclients_id`

### 1.6 companies Table Queries
- [ ] `src/sync/company-info-sync.js` - audit column names
- [ ] `src/repositories/CompanyRepository.js` - verify column names

---

## Phase 2: Repository Pattern Enforcement

### 2.1 command-handler.js Migration
- [ ] Identify all direct postgres.query() calls
- [ ] Map to existing repository methods
- [ ] Create new repository methods if needed
- [ ] Replace direct calls with repository methods
- [ ] Test affected commands

### 2.2 data-loader.js Migration
- [ ] Identify direct postgres.query() calls
- [ ] Use StaffScheduleRepository.findSchedules()
- [ ] Use StaffRepository.findByCompany()
- [ ] Test data loading

### 2.3 Sync Scripts Migration
- [ ] `schedules-sync.js` - uses StaffScheduleRepository ✓
- [ ] `staff-sync.js` - uses StaffRepository ✓
- [ ] `services-sync.js` - uses ServiceRepository ✓
- [ ] `clients-sync.js` - verify repository usage
- [ ] `clients-sync-optimized.js` - verify repository usage
- [ ] `bookings-sync.js` - verify repository usage
- [ ] `visits-sync.js` - audit and migrate
- [ ] `goods-transactions-sync.js` - audit and migrate
- [ ] `company-info-sync.js` - verify repository usage

### 2.4 postgres-data-layer.js Deprecation
- [ ] List all methods in postgres-data-layer.js
- [ ] Map each method to repository equivalent
- [ ] Find all callers
- [ ] Migrate callers to repositories
- [ ] Mark file as deprecated
- [ ] (Future) Delete file

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
| Phase 1.1 | ✅ Done | 3/6 | 6 |
| Phase 1.2 | ⏳ Pending | 0/4 | 4 |
| Phase 1.3 | ⏳ Pending | 0/4 | 4 |
| Phase 1.4 | ⏳ Pending | 0/4 | 4 |
| Phase 1.5 | ⏳ Pending | 0/3 | 3 |
| Phase 1.6 | ⏳ Pending | 0/2 | 2 |
| Phase 2 | ⏳ Pending | 0/18 | 18 |
| Phase 3 | ⏳ Pending | 0/18 | 18 |
| Phase 4 | ⏳ Pending | 0/9 | 9 |
| **TOTAL** | **In Progress** | **3/68** | **68** |

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
