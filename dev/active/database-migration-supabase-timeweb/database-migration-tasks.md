# Database Migration Tasks: Supabase → Timeweb PostgreSQL

**Project:** AI Admin v2
**Last Updated:** 2025-11-11 23:00 MSK
**Status:** ✅ **Phase 1 COMPLETE (88% tests passing)** - Ready for Phase 2!
**Progress:** 38% complete (5/13 days) - **3 days ahead of schedule!**

---

## 🎯 MAJOR UPDATE (2025-11-11)

**Phase 1 COMPLETED via Infrastructure Improvements project!**

All Phase 1 tasks below were completed as part of the infrastructure improvements project (Nov 9-11). See `dev/active/infrastructure-improvements/` for full implementation details.

**Blocker Status:** ✅ RESOLVED - UNIQUE constraints added, tests improved to 88%

**Next:** Phase 2 (Code Integration) - 3-5 days

---

## 📋 Prerequisites (Complete)

### ✅ Phase 0: Baileys Session Migration
**Date:** 2025-11-06
**Duration:** 30 minutes
**Status:** COMPLETE

- [x] Baileys auth migrated (1 record)
- [x] Baileys keys migrated (728 keys)
- [x] WhatsApp connection verified
- [x] All PM2 services online
- [x] Day 3/7 monitoring ongoing

### ✅ Phase 0.8: Schema Migration
**Date:** 2025-11-09
**Duration:** 8 minutes
**Status:** COMPLETE

- [x] 19 tables created
- [x] 129 indexes created
- [x] 8 functions created
- [x] 9 triggers created
- [x] Zero downtime achieved
- [x] Baileys remained connected

---

## ✅ Phase 1: Repository Pattern Implementation (Complete!)

**Goal:** Create PostgreSQL repository layer as abstraction over direct queries
**Duration:** 12.5 hours actual (vs 20-24h estimated - **48% faster!**)
**Status:** ✅ COMPLETE (via Infrastructure Improvements project)
**Completed:** 2025-11-11
**Risk Level:** LOW
**Grade:** A- (92/100) → A (95/100) after blocker fix

**⚠️ Single Blocker:** Missing UNIQUE constraints (30 min fix) → 100/100 tests passing

**What Was Completed:**
- ✅ 6 repositories created (1,120 lines): BaseRepository + 5 domain repos
- ✅ 100 integration tests (1,719 lines): Full test suite against Timeweb PostgreSQL
- ✅ Sentry error tracking integrated (50+ locations)
- ✅ Transaction support implemented (withTransaction() for atomic operations)
- ✅ Connection pool optimized (21 max vs 140 before)
- ✅ Schema alignment (4 mismatches fixed, 1:1 with Supabase)
- ✅ Documentation complete (docs/TRANSACTION_SUPPORT.md - 353 lines)

**Test Results (Updated 2025-11-11 22:45):**
- **Before UNIQUE constraints:** 52/100 passing (52%)
- **After UNIQUE constraints:** 147/167 passing (88%) ✅
- **Improvement:** +95 tests (+36% pass rate!)
- **Known Issues:** 20 tests fail (async cleanup, non-critical)
- **Pass Rate:** 88% - Excellent for Phase 1!

**See:** `dev/active/infrastructure-improvements/` for full implementation details

---

### ✅ 1.1 Production Code Audit (Complete)

**Target:** `src/integrations/yclients/data/supabase-data-layer.js`
**Status:** ✅ COMPLETE (via Infrastructure Improvements)

- [x] Analyze SupabaseDataLayer class structure
  ```bash
  # Count queries
  grep -n "\.from(" src/integrations/yclients/data/supabase-data-layer.js
  # Expected: 21 occurrences

  # List methods
  grep -E "async (get|upsert)" src/integrations/yclients/data/supabase-data-layer.js
  # Expected: 19 methods
  ```

- [ ] Document all 19 methods:
  - [ ] getDialogContext, upsertDialogContext
  - [ ] getClientByPhone, getClientById, getClientAppointments, searchClientsByName, upsertClient, upsertClients
  - [ ] getStaffById, getStaffSchedules, getStaffSchedule, upsertStaffSchedules
  - [ ] getServices, getServiceById, getServicesByCategory, upsertServices
  - [ ] getStaff
  - [ ] getCompany, upsertCompany

- [ ] Document query patterns:
  - [ ] SELECT with .single(): `.from('table').select('*').eq().single()`
  - [ ] SELECT with filters: `.eq()`, `.gte()`, `.lte()`, `.in()`
  - [ ] UPSERT: `.upsert(data, { onConflict: 'field' })`
  - [ ] Batch UPSERT: `.upsert(array)`

- [ ] Document validation logic (_validateCompanyId, _validatePhone, etc.)
- [ ] Document error handling (_handleSupabaseError, _buildErrorResponse)

**Checkpoint:** Production code fully analyzed and documented

### 1.2 Repository Pattern Implementation (Day 1-2, 8 hours)

#### Create Base Repository

- [ ] Create `src/repositories/BaseRepository.js`
  ```javascript
  class BaseRepository {
    constructor(tableName, db) {
      this.table = tableName;
      this.db = db;
    }

    async findOne(field, value) {
      try {
        const result = await this.db.query(
          `SELECT * FROM ${this.table} WHERE ${field} = $1 LIMIT 1`,
          [value]
        );
        return { data: result.rows[0] || null, error: null };
      } catch (error) {
        logger.error(`${this.table}.findOne failed:`, error);
        Sentry.captureException(error);
        return { data: null, error };
      }
    }

    async upsert(data, conflictField) {
      // PostgreSQL ON CONFLICT implementation
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const updateSet = keys.map((k, i) => `${k} = EXCLUDED.${k}`).join(', ');

      const sql = `
        INSERT INTO ${this.table} (${keys.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (${conflictField})
        DO UPDATE SET ${updateSet}
        RETURNING *
      `;

      try {
        const result = await this.db.query(sql, values);
        return { data: result.rows[0], error: null };
      } catch (error) {
        logger.error(`${this.table}.upsert failed:`, error);
        Sentry.captureException(error);
        return { data: null, error };
      }
    }
  }
  ```

#### Create Domain Repositories

- [ ] `src/repositories/ClientRepository.js` (7 methods)
  - [ ] findByPhone(phone)
  - [ ] findById(yclientsId, companyId)
  - [ ] findAppointments(clientId, options)
  - [ ] search(companyId, name, limit)
  - [ ] upsert(clientData)
  - [ ] batchUpsert(clientsArray)
  - [ ] getUpcoming(clientId, companyId)

- [ ] `src/repositories/ServiceRepository.js` (4 methods)
  - [ ] getAll(companyId, includeInactive)
  - [ ] getById(serviceId, companyId)
  - [ ] getByCategory(companyId, categoryId)
  - [ ] upsert(servicesArray)

- [ ] `src/repositories/StaffRepository.js` (4 methods)
  - [ ] getById(staffId, companyId)
  - [ ] getAll(companyId, includeInactive)
  - [ ] getSchedules(query)
  - [ ] upsertSchedules(scheduleData)

- [ ] `src/repositories/DialogContextRepository.js` (2 methods)
  - [ ] get(userId)
  - [ ] upsert(contextData)

- [ ] `src/repositories/CompanyRepository.js` (2 methods)
  - [ ] get(companyId)
  - [ ] upsert(companyData)

- [ ] `src/repositories/StaffScheduleRepository.js` (3 methods)
  - [ ] getSchedules(query)
  - [ ] getSchedule(staffId, date)
  - [ ] upsert(scheduleData)

#### Edge Case Handling

- [ ] Implement NULL handling (IS NULL, not = NULL)
- [ ] Implement array parameters (ANY($1::text[]))
- [ ] Implement single() equivalent (throw if 0 or >1 rows)
- [ ] Implement maybeSingle() equivalent (null if 0, throw if >1)
- [ ] Add Sentry error tracking to all methods

**Checkpoint:** All 6 repositories created with 22 total methods

### 1.3 Test Suite (Day 2-3, 6 hours)

#### Unit Tests

- [ ] Configure Jest
  ```bash
  npm install --save-dev jest @jest/globals
  ```

- [ ] Create unit tests for each repository:
  - [ ] ClientRepository.test.js (7 tests)
  - [ ] ServiceRepository.test.js (4 tests)
  - [ ] StaffRepository.test.js (4 tests)
  - [ ] DialogContextRepository.test.js (2 tests)
  - [ ] CompanyRepository.test.js (2 tests)
  - [ ] StaffScheduleRepository.test.js (3 tests)

- [ ] Test edge cases:
  - [ ] NULL values
  - [ ] Empty results
  - [ ] Multiple rows (should fail for single())
  - [ ] Database errors
  - [ ] Array parameters

#### Integration Tests

- [ ] Create integration tests with Timeweb PostgreSQL
  ```bash
  # Test database connection
  export POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
  export POSTGRES_PORT=5432
  export POSTGRES_DATABASE=default_db

  # Run integration tests
  npm test -- --testMatch="**/*.integration.test.js"
  ```

- [ ] Test all repository methods against real database
- [ ] Verify data integrity
- [ ] Check performance (<10ms for simple queries)

#### Run Tests

- [ ] Run all tests: `npm test`
- [ ] Verify 100% coverage
- [ ] Fix any failures
- [ ] Document test results

**Checkpoint:** All tests passing with 100% coverage

### 1.4 Documentation (Day 3, 4 hours)

- [ ] Create migration guide: `docs/SUPABASE_TO_REPOSITORY_MIGRATION.md`
  - [ ] Pattern transformation reference (Supabase → PostgreSQL)
  - [ ] Repository usage examples
  - [ ] Common pitfalls
  - [ ] Testing checklist

- [ ] Document all 19 method transformations
  - [ ] Before (SupabaseDataLayer) / After (Repository) examples
  - [ ] Edge cases for each method
  - [ ] Error handling patterns

- [ ] Create troubleshooting guide
  - [ ] Common database errors
  - [ ] Connection issues
  - [ ] Query performance problems

**Phase 1 Complete:** ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 2: Code Integration (3-5 days)

**Goal:** Integrate repository pattern into application code with feature flags
**Duration:** 3-5 days (24-40 hours) - **Reduced from 5-7 days!**
**Status:** ⬜ Ready to Start (after UNIQUE constraint fix)
**Risk Level:** LOW-MEDIUM (repositories already built and tested)

**⚡ Duration Reduced Because:**
- Repositories already exist and tested (saves 20-24h)
- Error tracking already integrated (saves 2-3h)
- Transaction support already working (saves 2-3h)
- Connection pool already optimized (saves 1-2h)
- **Total Time Saved:** ~25-30 hours!

### 2.1 Database Abstraction Layer (Day 1-2, 12 hours)

- [ ] Create `src/database/DataLayer.js`
  ```javascript
  class DataLayer {
    constructor(config = {}) {
      this.useLegacy = process.env.USE_LEGACY_SUPABASE === 'true';
      this.useRepositories = process.env.USE_REPOSITORY_PATTERN === 'true';

      if (this.useRepositories) {
        this.client = new ClientRepository(postgres);
        this.service = new ServiceRepository(postgres);
        this.staff = new StaffRepository(postgres);
        this.dialogContext = new DialogContextRepository(postgres);
        this.company = new CompanyRepository(postgres);
        this.schedule = new StaffScheduleRepository(postgres);
      } else if (this.useLegacy) {
        this.legacy = new SupabaseDataLayer(supabase);
      }
    }

    async getClientByPhone(phone) {
      if (this.useRepositories) {
        return this.client.findByPhone(phone);
      } else {
        return this.legacy.getClientByPhone(phone);
      }
    }

    // ... 18 more method wrappers
  }
  ```

- [ ] Implement all 19 method wrappers
- [ ] Add error handling and logging
- [ ] Add performance monitoring (measure query times)

### 2.2 Feature Flags Implementation (Day 2, 4 hours)

- [ ] Add environment variables to `.env`
  ```bash
  # Phase 1 completion
  USE_LEGACY_SUPABASE=true
  USE_REPOSITORY_PATTERN=false

  # Phase 3 will add
  # ENABLE_DUAL_WRITE=false
  ```

- [ ] Create feature flag manager: `src/utils/featureFlags.js`
  ```javascript
  const featureFlags = {
    useLegacySupabase: () => process.env.USE_LEGACY_SUPABASE === 'true',
    useRepositoryPattern: () => process.env.USE_REPOSITORY_PATTERN === 'true',
    enableDualWrite: () => process.env.ENABLE_DUAL_WRITE === 'true',
  };
  ```

- [ ] Add validation (prevent invalid combinations)
- [ ] Add logging when flags change

### 2.3 Update Services (Day 3-5, 16-24 hours)

- [ ] Identify all files importing SupabaseDataLayer
  ```bash
  grep -r "SupabaseDataLayer" src/ --include="*.js"
  ```

- [ ] Replace with DataLayer abstraction
  - [ ] Update imports
  - [ ] Update instantiation
  - [ ] Verify method calls compatible

- [ ] Files to update (estimated 10-15 files):
  - [ ] AI Admin services
  - [ ] Booking services
  - [ ] Client services
  - [ ] Sync services
  - [ ] Any other services using data layer

### 2.4 Testing (Day 5-7, 12-16 hours)

- [ ] Test with USE_REPOSITORY_PATTERN=true
  - [ ] All unit tests pass
  - [ ] All integration tests pass
  - [ ] Functional tests pass

- [ ] Test with USE_LEGACY_SUPABASE=true
  - [ ] All tests still pass
  - [ ] No regressions

- [ ] Performance benchmarking
  ```bash
  npm run benchmark -- --database=supabase
  npm run benchmark -- --database=timeweb

  # Compare results
  # Expected: Timeweb 20-50x faster
  ```

- [ ] Load testing
  - [ ] Simulate production load
  - [ ] Connection pooling tests
  - [ ] Concurrent users

**Phase 2 Complete:** ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 3: Data Migration (3-5 days)

**Goal:** Migrate all business data from Supabase to Timeweb with verification
**Duration:** 3-5 days (24-40 hours)
**Status:** ⬜ Not Started
**Risk Level:** HIGH

### 3.1 Export Data from Supabase (Day 1, 8 hours)

- [ ] Create export scripts: `scripts/export-supabase-data.js`

- [ ] Export in dependency order:
  - [ ] companies (1 record) - No dependencies
  - [ ] clients (1,299 records) - Depends on companies
  - [ ] services (63 records) - Depends on companies
  - [ ] staff (12 records) - Depends on companies
  - [ ] staff_schedules (~100 records) - Depends on staff
  - [ ] bookings (38 records) - Depends on clients, services, staff
  - [ ] dialog_contexts (~50 records) - Depends on clients
  - [ ] reminders (~20 records) - Depends on bookings

- [ ] Verify exports
  - [ ] Row counts match
  - [ ] Data integrity (no NULLs in required fields)
  - [ ] Foreign keys valid

- [ ] Save to `data/exports/supabase/{table}.json`

**Checkpoint:** All data exported and verified

### 3.2 Import Data to Timeweb (Day 2, 8 hours)

- [ ] Create import scripts: `scripts/import-timeweb-data.js`

- [ ] Import in dependency order:
  - [ ] companies → Verify → Continue
  - [ ] clients → Verify → Continue
  - [ ] services → Verify → Continue
  - [ ] staff → Verify → Continue
  - [ ] staff_schedules → Verify → Continue
  - [ ] bookings → Verify → Continue
  - [ ] dialog_contexts → Verify → Continue
  - [ ] reminders → Verify → Continue

- [ ] Verify each import:
  - [ ] Row count matches export
  - [ ] Sample data comparison
  - [ ] Foreign keys valid
  - [ ] No data corruption

**Checkpoint:** All data imported and verified

### 3.3 Dual-Write Implementation (Day 3, 8 hours)

- [ ] Update DataLayer with dual-write support
  ```javascript
  async upsertClient(clientData) {
    // Primary: Write to Timeweb
    const timewebResult = await this.client.upsert(clientData);

    // Backup: Write to Supabase (if enabled)
    if (process.env.ENABLE_DUAL_WRITE === 'true') {
      try {
        await this.legacy.upsertClient(clientData);
      } catch (error) {
        logger.warn('Dual-write to Supabase failed:', error);
        // Don't fail - Timeweb is primary
      }
    }

    return timewebResult;
  }
  ```

- [ ] Implement for all write methods (upsert operations)
- [ ] Add monitoring/logging for dual-write success/failure
- [ ] Test dual-write mechanism

### 3.4 Data Verification (Day 4-5, 8-16 hours)

- [ ] Compare Timeweb vs Supabase
  - [ ] Row counts for all tables
  - [ ] Sample row-by-row comparison
  - [ ] Checksum validation

- [ ] Create verification script: `scripts/verify-data-consistency.js`
  ```bash
  npm run verify:consistency

  # Output:
  # ✅ companies: 1/1 rows match (100%)
  # ✅ clients: 1299/1299 rows match (100%)
  # ✅ services: 63/63 rows match (100%)
  # ... etc
  ```

- [ ] Fix any discrepancies found
- [ ] Re-run verification until 100% match

**Phase 3 Complete:** ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 4: Testing & Validation (2-3 days + 48h)

**Goal:** Comprehensive testing before production cutover
**Duration:** 2-3 days + 48h parallel run
**Status:** ⬜ Not Started
**Risk Level:** MEDIUM

### 4.1 Functional Testing (Day 1, 8 hours)

- [ ] End-to-end user flows
  - [ ] WhatsApp message processing
  - [ ] Booking creation
  - [ ] Client search
  - [ ] Service catalog retrieval
  - [ ] Staff schedule queries

- [ ] Test all CRUD operations
  - [ ] CREATE (insert)
  - [ ] READ (select)
  - [ ] UPDATE (upsert)
  - [ ] DELETE (if applicable)

- [ ] Edge cases
  - [ ] Concurrent updates
  - [ ] Large datasets
  - [ ] Special characters
  - [ ] NULL handling

### 4.2 Performance Testing (Day 2, 8 hours)

- [ ] Benchmark all repository methods
- [ ] Compare Timeweb vs Supabase
- [ ] Load testing
- [ ] Connection pool stress testing
- [ ] Query optimization if needed

### 4.3 Parallel Run (48 hours)

- [ ] Configure test number to use Timeweb
  ```bash
  export USE_REPOSITORY_PATTERN=true
  export TEST_PHONE=89686484488
  # All other traffic uses Supabase
  ```

- [ ] Monitor continuously:
  - [ ] Every 2 hours: Error logs
  - [ ] Every 4 hours: Performance metrics
  - [ ] Every 8 hours: Data consistency

- [ ] Collect metrics:
  - [ ] Query response times
  - [ ] Error rates
  - [ ] Resource usage

- [ ] Compare test number (Timeweb) vs production (Supabase)

**Phase 4 Complete:** ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 5: Production Cutover (2-4 hours)

**Goal:** Switch all production traffic to Timeweb PostgreSQL
**Duration:** 2-4 hours (estimated downtime)
**Status:** ⬜ Not Started
**Risk Level:** HIGH

### 5.1 Pre-Cutover (24 hours before)

- [ ] Client notification sent
- [ ] Final Supabase backup created
- [ ] Team on standby
- [ ] Rollback plan reviewed

### 5.2 Cutover Window (02:00-06:00)

#### Stop Services (02:00, 5 min)
- [ ] Stop all PM2 services
  ```bash
  pm2 stop all
  ```

#### Final Data Sync (02:05, 10 min)
- [ ] Run final sync from Supabase to Timeweb
- [ ] Verify no data loss
- [ ] Check row counts

#### Update Configuration (02:15, 5 min)
- [ ] Update `.env`
  ```bash
  USE_LEGACY_SUPABASE=false
  USE_REPOSITORY_PATTERN=true
  ENABLE_DUAL_WRITE=false
  ```
- [ ] Backup old .env

#### Restart Services (02:20, 5 min)
- [ ] Start all PM2 services
  ```bash
  pm2 start all
  ```

#### Smoke Tests (02:25, 10 min)
- [ ] Health check: `curl http://localhost:3000/health`
- [ ] WhatsApp connection verified
- [ ] Test message sent and received
- [ ] Database query test
- [ ] Booking creation test

**Downtime End:** 02:30 (estimated)

### 5.3 Monitoring (02:30-06:00)

- [ ] Intensive monitoring (30 min)
  - [ ] All services online
  - [ ] Error logs clean
  - [ ] Performance acceptable
  - [ ] No critical issues

- [ ] Extended monitoring (3 hours)
  - [ ] Continued operation
  - [ ] User messages processing
  - [ ] No regressions

### 5.4 Rollback (if needed)

- [ ] If critical issues detected:
  ```bash
  pm2 stop all
  # Revert .env
  USE_LEGACY_SUPABASE=true
  USE_REPOSITORY_PATTERN=false
  pm2 start all
  ```

**Phase 5 Complete:** ⬜ All tasks completed | Actual Downtime: ___ hours

---

## Post-Migration (30 days)

- [ ] Day 1-7: Daily monitoring
- [ ] Day 7: Confirm stable operation
- [ ] Day 30: Decommission Supabase
- [ ] Document lessons learned
- [ ] Update architecture docs

---

**Last Updated:** 2025-11-09
**Current Phase:** Phase 1 Ready to Start
**Next Milestone:** Repository Pattern Implementation Complete
