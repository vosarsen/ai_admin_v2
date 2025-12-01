# Database Code Review - Comprehensive Plan

**Last Updated:** 2025-12-01
**Status:** Active
**Priority:** CRITICAL
**Estimated Effort:** 16-24 hours

---

## Executive Summary

This is a comprehensive code review focused on database usage throughout the AI Admin v2 application. The review will identify and fix all inconsistencies between code and actual database schema, standardize repository pattern usage, and ensure robust error handling.

### Key Problem Statement

During investigation of "Бари работает сегодня?" bug, we discovered **critical column name mismatches** where code uses `staff_id` but the actual database column is `yclients_staff_id`. This indicates a systemic issue from the Supabase → Timeweb PostgreSQL migration that needs full audit.

### Goals

1. **Zero SQL Errors** - All queries use correct column names
2. **Consistent Repository Usage** - All DB access through repositories
3. **Proper Error Handling** - All DB operations have Sentry tracking
4. **Clean Migration** - Remove all Supabase legacy code

---

## Current State Analysis

### Database Schema (Timeweb PostgreSQL)

**20 Tables Total:**
- Business: `companies`, `clients`, `staff`, `services`, `bookings`, `staff_schedules`
- Messaging: `messages`, `dialog_contexts`, `demo_chat_events`
- Notifications: `booking_notifications`, `appointments_cache`
- Integration: `telegram_*` (3 tables), `marketplace_events`, `webhook_events`
- WhatsApp: `whatsapp_auth`, `whatsapp_keys`
- System: `actions`, `company_sync_status`

### Critical Column Naming Patterns

| Table | ID Column in DB | Code Often Uses | MISMATCH? |
|-------|-----------------|-----------------|-----------|
| staff_schedules | `yclients_staff_id` | `staff_id` | **YES** |
| staff | `yclients_id` | `staff_id`, `id` | **YES** |
| services | `yclients_id` | `service_id` | Possible |
| clients | `yclients_id` | `client_id` | Possible |
| bookings | `yclients_record_id` | `booking_id` | Possible |

### Repository Pattern Status

**17 Repositories Created:**
- BaseRepository.js (foundation)
- ClientRepository.js
- StaffRepository.js
- StaffScheduleRepository.js
- ServiceRepository.js
- BookingRepository.js
- CompanyRepository.js
- DialogContextRepository.js
- BookingNotificationRepository.js
- MessageRepository.js
- AppointmentsCacheRepository.js
- WebhookEventsRepository.js
- MarketplaceEventsRepository.js
- DemoChatAnalyticsRepository.js
- TelegramLinkingRepository.js
- TelegramConnectionRepository.js

### Files Using Direct postgres.query()

**24 files identified** with direct SQL queries outside repositories:
1. `src/services/ai-admin-v2/modules/data-loader.js`
2. `src/services/ai-admin-v2/modules/command-handler.js`
3. `src/sync/*.js` (9 sync files)
4. `src/services/booking-monitor/index.js`
5. `src/workers/message-worker-v2.js`
6. `src/integrations/yclients/data/postgres-data-layer.js`
7. And more...

---

## Proposed Future State

### Target Architecture

```
Application Code
       ↓
Repository Layer (ONLY access point)
       ↓
BaseRepository (connection management)
       ↓
postgres.js (pool management)
       ↓
Timeweb PostgreSQL
```

### Standards to Enforce

1. **Column Names**: All code MUST use actual DB column names
2. **Repository Access**: ALL database access through repositories
3. **Error Handling**: ALL DB operations wrapped with Sentry
4. **No Legacy Code**: Zero Supabase references
5. **Type Safety**: JSDoc types for all repository methods

---

## Implementation Phases

### Phase 1: Critical Column Name Audit (PRIORITY 1)
**Effort: L (8-10 hours)**

Audit all SQL queries and fix column name mismatches.

### Phase 2: Repository Pattern Enforcement
**Effort: M (4-6 hours)**

Migrate direct postgres.query() calls to use repositories.

### Phase 3: Error Handling Standardization
**Effort: S (2-3 hours)**

Add consistent Sentry error tracking to all DB operations.

### Phase 4: Legacy Code Cleanup
**Effort: S (2-3 hours)**

Remove all Supabase references and unused feature flags.

---

## Detailed Task Breakdown

### Phase 1: Column Name Audit

#### 1.1 staff_schedules Table Queries
**Effort:** M | **Priority:** CRITICAL

Files to audit:
- [x] `src/services/ai-admin-v2/modules/command-handler.js` - FIXED
- [x] `src/services/ai-admin-v2/modules/data-loader.js` - FIXED
- [x] `src/services/ai-admin-v2/modules/formatter.js` - FIXED
- [ ] `src/integrations/yclients/data/postgres-data-layer.js`
- [ ] `src/sync/schedules-sync.js`
- [ ] `src/repositories/StaffScheduleRepository.js` - verify

**Correct Column Names:**
- `yclients_staff_id` (NOT staff_id)
- `staff_name`
- `date`
- `is_working`
- `has_booking_slots`
- `work_start`, `work_end`
- `working_hours`
- `company_id`
- `last_updated`

**Acceptance Criteria:**
- All queries use `yclients_staff_id`
- No SQL errors in logs related to staff_schedules
- CHECK_STAFF_SCHEDULE command works correctly

#### 1.2 staff Table Queries
**Effort:** M | **Priority:** HIGH

Files to audit:
- [ ] `src/sync/staff-sync.js`
- [ ] `src/services/ai-admin-v2/modules/data-loader.js`
- [ ] `src/repositories/StaffRepository.js`

**Correct Column Names:**
- `yclients_id` (NOT staff_id, NOT id)
- `company_id`
- `name`
- `is_active`
- `is_bookable`
- `specialization`, `position`
- `declensions` (JSONB)

**Acceptance Criteria:**
- All queries use `yclients_id` for staff ID
- Staff sync works without errors

#### 1.3 bookings Table Queries
**Effort:** M | **Priority:** HIGH

Files to audit:
- [ ] `src/sync/bookings-sync.js`
- [ ] `src/repositories/BookingRepository.js`
- [ ] `src/services/booking-monitor/index.js`

**Correct Column Names:**
- `yclients_record_id` (NOT booking_id, NOT record_id)
- `staff_id` (EXISTS - this one is correct!)
- `client_yclients_id`
- `company_id`

**Acceptance Criteria:**
- Booking queries use correct column names
- Booking monitor works correctly

#### 1.4 clients Table Queries
**Effort:** M | **Priority:** HIGH

Files to audit:
- [ ] `src/sync/clients-sync.js`
- [ ] `src/sync/clients-sync-optimized.js`
- [ ] `src/repositories/ClientRepository.js`

**Correct Column Names:**
- `yclients_id` (NOT client_id)
- `company_id`
- `phone`, `raw_phone`
- `favorite_staff_ids` (ARRAY)

#### 1.5 services Table Queries
**Effort:** S | **Priority:** MEDIUM

Files to audit:
- [ ] `src/sync/services-sync.js`
- [ ] `src/repositories/ServiceRepository.js`

**Correct Column Names:**
- `yclients_id` (NOT service_id)
- `company_id`
- `category_id`, `category_title`

#### 1.6 companies Table Queries
**Effort:** S | **Priority:** MEDIUM

Files to audit:
- [ ] `src/sync/company-info-sync.js`
- [ ] `src/repositories/CompanyRepository.js`

**Correct Column Names:**
- `yclients_id` (NOT company_id for external ID)
- `company_id` (internal ID)

---

### Phase 2: Repository Pattern Enforcement

#### 2.1 Migrate command-handler.js DB Queries
**Effort:** L | **Priority:** HIGH

Currently has ~15 direct postgres.query() calls for:
- Staff schedules
- Client lookup
- Booking operations
- Service queries

**Action:** Create repository methods, replace direct queries.

#### 2.2 Migrate data-loader.js DB Queries
**Effort:** M | **Priority:** HIGH

Currently loads:
- Staff schedules
- Staff list
- Company info

**Action:** Use existing repository methods.

#### 2.3 Migrate sync/*.js Scripts
**Effort:** M | **Priority:** MEDIUM

9 sync scripts with direct DB access:
- schedules-sync.js - partially migrated
- staff-sync.js - partially migrated
- services-sync.js - partially migrated
- clients-sync.js
- clients-sync-optimized.js
- bookings-sync.js
- visits-sync.js
- goods-transactions-sync.js
- company-info-sync.js

**Action:** Ensure all use repositories consistently.

#### 2.4 Migrate postgres-data-layer.js
**Effort:** M | **Priority:** MEDIUM

Legacy data layer that should be deprecated.

**Action:** Mark as deprecated, migrate callers to repositories.

---

### Phase 3: Error Handling Standardization

#### 3.1 Repository Error Handling Audit
**Effort:** S | **Priority:** HIGH

Verify all repository methods:
- Catch errors
- Call Sentry.captureException()
- Include context (table, operation, params)
- Re-throw with meaningful message

#### 3.2 Sync Scripts Error Handling
**Effort:** S | **Priority:** MEDIUM

Ensure all sync scripts:
- Wrap operations in try/catch
- Report failures to Sentry
- Don't fail silently

#### 3.3 Worker Error Handling
**Effort:** S | **Priority:** MEDIUM

Verify workers (message-worker-v2, booking-monitor) have proper error handling.

---

### Phase 4: Legacy Code Cleanup

#### 4.1 Remove Supabase References
**Effort:** S | **Priority:** LOW

Files with Supabase references to clean:
- [ ] Remove `USE_LEGACY_SUPABASE` from .env
- [ ] Update database-flags.js (simplify)
- [ ] Remove any remaining Supabase client code

#### 4.2 Remove Deprecated Data Layer
**Effort:** S | **Priority:** LOW

- [ ] Deprecate `postgres-data-layer.js`
- [ ] Migrate all callers
- [ ] Delete file

#### 4.3 Clean Feature Flags
**Effort:** XS | **Priority:** LOW

Simplify config/database-flags.js:
- Remove dual-write logic
- Remove Supabase fallback
- Keep only LOG_DATABASE_CALLS

---

## Risk Assessment

### High Risks

1. **Query Failures in Production**
   - Mitigation: Test each fix in staging first
   - Rollback: Immediate deploy of previous version

2. **Data Integrity Issues**
   - Mitigation: Add validation in repositories
   - Monitoring: Sentry alerts for DB errors

### Medium Risks

1. **Performance Regression**
   - Mitigation: Benchmark before/after
   - Monitoring: Slow query logging enabled

2. **Missing Edge Cases**
   - Mitigation: Comprehensive grep searches
   - Testing: Manual test each feature

### Low Risks

1. **Breaking Tests**
   - Mitigation: Update tests with code
   - CI: Run test suite before deploy

---

## Success Metrics

1. **Zero SQL Column Errors** in logs (current: ~5-10/day)
2. **100% Repository Coverage** for DB operations
3. **100% Sentry Coverage** for DB errors
4. **Zero Supabase References** in active code
5. **All Features Working**: Staff schedules, bookings, sync

---

## Required Resources

- Developer time: 16-24 hours
- Production DB access: Yes
- Staging environment: Recommended
- Monitoring: Sentry, PM2 logs

---

## Dependencies

- Phase 1 must complete before Phase 2
- Phase 3 can run in parallel with Phase 2
- Phase 4 depends on Phase 2 completion

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 8-10 hours | None |
| Phase 2 | 4-6 hours | Phase 1 |
| Phase 3 | 2-3 hours | None |
| Phase 4 | 2-3 hours | Phase 2 |
| **Total** | **16-24 hours** | |

---

## Next Steps

1. Start Phase 1.1 (staff_schedules) - IN PROGRESS
2. Create automated grep scripts for pattern detection
3. Set up Sentry dashboard for DB errors
4. Schedule deployment windows for fixes
