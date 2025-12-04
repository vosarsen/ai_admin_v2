# Database Code Review - Comprehensive Plan

**Last Updated:** 2025-12-01 18:50 MSK
**Status:** Active - Phase 0.5 COMPLETE, Phase 0.7 NEXT
**Priority:** CRITICAL
**Estimated Effort:** 22-32 hours (revised after plan review)
**Plan Review:** B+ (Conditional Go) - see review notes below
**Progress:** 11/79 tasks (14%) - Phase 0.5 done, schedules-sync bug fixed

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

### Plan Review Notes (2025-12-01)

**Reviewer verdict: CONDITIONAL GO** - Proceed after addressing blockers.

**Key findings from review:**
1. ✅ `StaffScheduleRepository.js` - Already correct, no changes needed
2. ✅ `schedules-sync.js` - Already correct (uses `staff_id` for API, `yclients_staff_id` for DB)
3. ✅ `postgres-data-layer.js` - Already correct (input validation uses API field names)
4. ⚠️ Need Phase 0.5 (Schema Verification) before starting
5. ⚠️ Need Phase 0.7 (Integration Tests) before starting
6. ⚠️ 38 files reference Supabase (not 10 as initially estimated)

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

### Phase 0.5: Schema Verification (BLOCKER - NEW)
**Effort: S (2-3 hours)**

Verify actual production schema matches documentation before any fixes.

**Tasks:**
- [ ] Create `scripts/verify-db-schema.js` to dump all column names
- [ ] Run against production Timeweb PostgreSQL
- [ ] Compare with documented schema in this plan
- [ ] Update documentation with any discrepancies

**Acceptance Criteria:**
- All 20 tables documented with actual column names
- Schema dump saved to `docs/database/schema-snapshot-YYYY-MM-DD.sql`

### Phase 0.7: Integration Tests (BLOCKER - NEW)
**Effort: M (4-6 hours)**

Create integration tests BEFORE fixing code to establish baseline.

**Tasks:**
- [ ] Create `StaffScheduleRepository.integration.test.js`
- [ ] Create `BookingRepository.integration.test.js`
- [ ] Create `StaffRepository.integration.test.js`
- [ ] Run baseline tests, document current pass/fail state
- [ ] Create regression test for CHECK_STAFF_SCHEDULE command

**Acceptance Criteria:**
- All critical repositories have integration tests
- Tests run against test database (not production)
- Baseline documented before Phase 1 starts

### Phase 1: Critical Column Name Audit (PRIORITY 1)
**Effort: M (6-8 hours)** *(revised down - some files already correct)*

Audit all SQL queries and fix column name mismatches.

**Note from review:** Several files already use correct column names:
- ✅ `StaffScheduleRepository.js` - no changes needed
- ✅ `schedules-sync.js` - no changes needed
- ✅ `postgres-data-layer.js` - no changes needed (see explanation below)

### Phase 2: Repository Pattern Enforcement
**Effort: M (4-6 hours)**

Migrate direct postgres.query() calls to use repositories.

### Phase 3: Error Handling Standardization
**Effort: S (2-3 hours)**

Add consistent Sentry error tracking to all DB operations.

### Phase 4: Legacy Code Cleanup & Deprecation
**Effort: M (4-6 hours)** *(revised up - 38 files, not 10)*

Deprecate (NOT remove) Supabase references and feature flags.

**Important:** Keep feature flags until 1 week after Phase 3 completion for safe rollback.

---

## Detailed Task Breakdown

### Phase 1: Column Name Audit

#### 1.1 staff_schedules Table Queries
**Effort:** M | **Priority:** CRITICAL

Files to audit:
- [x] `src/services/ai-admin-v2/modules/command-handler.js` - FIXED
- [x] `src/services/ai-admin-v2/modules/data-loader.js` - FIXED
- [x] `src/services/ai-admin-v2/modules/formatter.js` - FIXED
- [x] `src/integrations/yclients/data/postgres-data-layer.js` - **VERIFIED CORRECT** (see note below)
- [x] `src/sync/schedules-sync.js` - **VERIFIED CORRECT** (uses API names for input, DB names for output)
- [x] `src/repositories/StaffScheduleRepository.js` - **VERIFIED CORRECT**

> **Important clarification on postgres-data-layer.js:**
> Lines 427-428 validate INPUT data from YClients API which uses `staff_id`.
> The repository then maps this to `yclients_staff_id` when writing to DB.
> This is CORRECT behavior - do NOT change it.
> ```javascript
> // This is INPUT validation (YClients API field names) - CORRECT
> if (!schedule.staff_id || !Number.isInteger(Number(schedule.staff_id))) {
>   throw new Error(`Invalid staff_id at index ${index}`);
> }
> ```

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
   - Rollback: See detailed rollback strategy below

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

3. **Incorrect grep pattern matches**
   - Risk: Grep finds `staff_id` in variable names, not SQL queries
   - Mitigation: Use AST-based search or manual review of SQL strings only

### Low Risks

1. **Breaking Tests**
   - Mitigation: Update tests with code
   - CI: Run test suite before deploy

---

## Rollback Strategy

### Pre-Implementation Safeguards

1. **Git Tags Before Each Phase:**
   ```bash
   git tag pre-db-review-phase0.5
   git tag pre-db-review-phase0.7
   git tag pre-db-review-phase1
   # etc.
   ```

2. **Keep Feature Flags Active:**
   - DO NOT remove `USE_LEGACY_SUPABASE` or `USE_REPOSITORY_PATTERN` until 1 week after Phase 3
   - These provide instant rollback capability

3. **Database Backup Before Phase 1:**
   ```sql
   -- Create backup tables before any schema-affecting changes
   CREATE TABLE _backup_staff_schedules_20251201 AS SELECT * FROM staff_schedules;
   ```

### Rollback Procedures

**Level 1 - Code Rollback (< 5 min):**
```bash
git checkout pre-db-review-phase1
pm2 restart all
```

**Level 2 - Feature Flag Rollback (< 1 min):**
```bash
# In .env
USE_REPOSITORY_PATTERN=false
USE_LEGACY_SUPABASE=true
pm2 restart all
```

**Level 3 - Data Rollback (< 10 min):**
```sql
-- Only if data corruption occurred
DROP TABLE staff_schedules;
ALTER TABLE _backup_staff_schedules_20251201 RENAME TO staff_schedules;
```

### Monitoring for Rollback Triggers

Rollback immediately if:
- Sentry error rate > 10 errors/minute for DB operations
- Error code `42703` (column does not exist) appears
- Any critical command fails (CHECK_STAFF_SCHEDULE, CREATE_BOOKING)

---

## Monitoring Plan

### Before Starting (Setup Phase)

1. **Sentry Alert for Column Errors:**
   - Create filter for PostgreSQL error code `42703`
   - Set up Telegram notification on trigger

2. **PM2 Log Monitoring:**
   ```bash
   pm2 logs ai-admin-worker-v2 --err | grep -E "(column|does not exist|42703)"
   ```

3. **Baseline Metrics:**
   - Current DB error rate: ~5-10/day (document exact number)
   - Current response times for DB operations

### During Implementation

- Check Sentry after each file change
- Run affected commands manually after each fix
- Document any new errors discovered

### Post-Implementation

- Monitor for 48 hours after Phase 3 completion
- Compare error rates to baseline
- Sign-off checklist before removing feature flags

---

## Success Metrics

1. **Zero SQL Column Errors** in logs (current: ~5-10/day)
2. **100% Repository Coverage** for DB operations
3. **100% Sentry Coverage** for DB errors
4. **Zero Supabase References** in active code
5. **All Features Working**: Staff schedules, bookings, sync

---

## Required Resources

- Developer time: 22-32 hours (revised)
- Production DB access: Yes
- Staging environment: Recommended
- Monitoring: Sentry, PM2 logs, Telegram alerts

---

## Dependencies

```
Phase 0.5 (Schema Verification) ──┐
                                  ├──► Phase 1 (Column Audit) ──► Phase 2 (Repository) ──► Phase 4 (Cleanup)
Phase 0.7 (Integration Tests) ────┘                         ↘
                                                             Phase 3 (Error Handling) ─────────────────────┘
```

- **Phase 0.5 and 0.7 are BLOCKERS** - must complete before Phase 1
- Phase 1 must complete before Phase 2
- Phase 3 can run in parallel with Phase 2
- Phase 4 depends on Phase 2 AND Phase 3 completion
- Feature flags removal: 1 week after Phase 4

---

## Timeline Estimate (Revised)

| Phase | Duration | Dependencies | Status |
|-------|----------|--------------|--------|
| Phase 0.5 | 2-3 hours | None | **BLOCKER** |
| Phase 0.7 | 4-6 hours | None | **BLOCKER** |
| Phase 1 | 6-8 hours | Phase 0.5, 0.7 | Pending |
| Phase 2 | 4-6 hours | Phase 1 | Pending |
| Phase 3 | 2-3 hours | None (parallel) | Pending |
| Phase 4 | 4-6 hours | Phase 2, 3 | Pending |
| **Total** | **22-32 hours** | | |

---

## Schema Naming Inconsistency (Acknowledged Technical Debt)

The database schema has an inconsistency that we are NOT fixing (too risky):

| Table | Column for Staff Reference | Notes |
|-------|---------------------------|-------|
| `staff_schedules` | `yclients_staff_id` | References staff by YClients ID |
| `bookings` | `staff_id` | Also references staff by YClients ID, but different name |

**Decision:** We are fixing CODE to match SCHEMA, not changing the schema.

**Rationale:**
- Schema changes require migration across all dependent systems
- Current schema works correctly, just has naming inconsistency
- Code-level fix is safer and can be tested incrementally

**Future consideration:** When doing major database refactoring, consider standardizing all `yclients_*` prefixes.

---

## Field Name Mapping Reference

Understanding the difference between API fields and DB columns is critical:

| Layer | Field Name | Example |
|-------|------------|---------|
| **YClients API** | `staff_id` | `{ staff_id: 123, name: "Бари" }` |
| **Input Validation** | `staff_id` | Check API response validity |
| **DB Column** | `yclients_staff_id` | `INSERT INTO staff_schedules (yclients_staff_id, ...)` |
| **Repository** | `yclients_staff_id` | `findByStaffId(yclientsStaffId)` |
| **Application Code** | `staffId` / `yclientsStaffId` | Variable naming varies |

**Rule:**
- When validating INPUT from YClients API → use `staff_id`
- When writing SQL queries → use `yclients_staff_id`
- Repository methods handle the mapping

---

## Next Steps

1. **BLOCKER:** Complete Phase 0.5 (Schema Verification)
2. **BLOCKER:** Complete Phase 0.7 (Integration Tests)
3. Set up Sentry alert for error code `42703`
4. Create git tag `pre-db-review-phase0.5`
5. Then proceed with Phase 1.1 (staff_schedules audit)
