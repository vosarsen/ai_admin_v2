# Database Code Review - Context

**Last Updated:** 2025-12-01 22:30 MSK
**Session Status:** Phases 1-3 COMPLETE ✅ | Phase 4 PENDING
**Next Action:** Phase 4 (Legacy Code Cleanup)

---

## 🎯 QUICK RESUME GUIDE

### Current State
- **Progress:** 64/89 tasks (72%)
- **Last Commit:** `0d8d1a0` - feat(db): add Sentry error tracking to all sync scripts
- **All Tests Passing:** 73/73 integration tests ✅
- **No Uncommitted Changes**

### What's Done
1. ✅ Phase 0.5: Schema Verification
2. ✅ Phase 0.7: Integration Tests (73/73)
3. ✅ Phase 1: Column Name Audits (2 bugs fixed)
4. ✅ Phase 2: Repository Pattern Migration (data-loader.js, 6 sync scripts)
5. ✅ Phase 3: Sentry Error Tracking (6 sync scripts)

### What's Next
**Phase 4: Legacy Code Cleanup**
- 4.1 Remove Supabase references
- 4.2 Clean feature flags
- 4.3 Remove deprecated code

---

## Key Discoveries This Session

### 1. data-loader.js Had 9 Direct postgres.query() Calls
Migrated 8 to repository pattern:
- `loadClient` → `ClientRepository.findByRawPhone()`
- `loadBookings` → `BookingRepository.findByClientYclientsId()`
- `loadConversation` → `DialogContextRepository.findByUserIdAndCompany()`
- `loadStaffSchedules` → `StaffRepository.findActiveIds()` + `StaffScheduleRepository.findByStaffIdsAndDateRange()`
- `getStaffNamesByIds` → `StaffRepository.findNamesByYclientsIds()`
- `getServiceNamesByIds` → `ServiceRepository.findTitlesByYclientsIds()`
- `saveContext` → `DialogContextRepository.upsertWithMessages()`

**1 query KEPT:** `loadBusinessStats()` - appointments_cache is read-only cache

### 2. Sync Scripts Had Zero Sentry Integration
Added `Sentry.captureException()` to all 6 core sync scripts with tags:
- `component: 'sync'`
- `sync_type: 'schedules'|'staff'|'services'|'bookings'|'clients'|'company_info'`

### 3. BaseRepository Already Had Full Sentry
No changes needed - already has:
- Sentry.captureException() in all methods
- Tags: component, table, operation
- Extra: filters, duration, conflictColumns
- _handleError() for PostgreSQL error normalization

---

## Files Modified This Session

### Repositories (11 new methods added)
| File | New Methods |
|------|-------------|
| `ClientRepository.js` | `findByRawPhone()` |
| `BookingRepository.js` | `findByClientYclientsId()`, `deleteOlderThan()` |
| `DialogContextRepository.js` | `findByUserIdAndCompany()`, `upsertWithMessages()` |
| `StaffRepository.js` | `findActiveIds()`, `findNamesByYclientsIds()`, `deactivateAll()` |
| `ServiceRepository.js` | `findTitlesByYclientsIds()` |
| `StaffScheduleRepository.js` | `findByStaffIdsAndDateRange()`, `deleteOlderThan()` |

### Sync Scripts (Sentry added)
- `schedules-sync.js`
- `staff-sync.js`
- `services-sync.js`
- `bookings-sync.js`
- `clients-sync.js`
- `company-info-sync.js`

### Core Files
- `data-loader.js` - 8 postgres.query() → repository calls

---

## Commits Made This Session

1. `22ded74` - refactor(db): migrate data-loader.js and sync scripts to repository pattern
2. `0d8d1a0` - feat(db): add Sentry error tracking to all sync scripts

---

## Phase 4 Tasks Preview

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

## Database Schema Quick Reference

### staff_schedules
```
yclients_staff_id | integer (FK to staff.yclients_id)
```
**IMPORTANT:** NOT `staff_id`!

### staff
```
yclients_id | integer (YClients external ID)
```

### bookings
```
yclients_record_id | integer (YClients external ID)
staff_id           | integer (NOTE: This one IS correct!)
```

### clients
```
yclients_id | integer (YClients external ID)
raw_phone   | varchar (with + prefix)
```

### services
```
yclients_id | integer (YClients external ID)
```

---

## Test Commands

```bash
# Run all integration tests
RUN_INTEGRATION_TESTS=true npx jest tests/repositories/integration/ --no-coverage --forceExit

# Check syntax of sync scripts
for f in src/sync/*.js; do node -c "$f"; done

# Check syntax of repositories
for f in src/repositories/*.js; do node -c "$f"; done
```

---

## Key Patterns Learned

### 1. YClients ID vs Internal ID
- **YClients API returns:** `staff.id`, `service.id`, `client.id`
- **Our DB stores as:** `yclients_id`, `yclients_staff_id`, etc.
- **Always use `yclients_*` columns** when querying by external IDs

### 2. Repository Pattern Benefits
- Centralized error handling with Sentry
- Consistent query patterns
- Type-safe method signatures
- Easy to test

### 3. Sentry Tags Convention
```javascript
Sentry.captureException(error, {
  tags: {
    component: 'sync',  // or 'repository', 'worker', 'api'
    sync_type: 'schedules',  // specific operation
    table: 'staff_schedules'  // for DB ops
  },
  extra: {
    duration: `${Date.now() - startTime}ms`,
    // relevant context
  }
});
```
