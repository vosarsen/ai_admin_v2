# Database Migration: Supabase → Timeweb PostgreSQL (Revised Plan)

**Last Updated:** 2025-11-10
**Status:** Planning Phase
**Estimated Timeline:** 3 weeks
**Risk Level:** Medium (with mitigation strategies)

---

## Executive Summary

This is a **revised comprehensive plan** for migrating from Supabase to Timeweb PostgreSQL, incorporating critical improvements identified by the plan-reviewer agent.

### Key Changes from Previous Approach

| Previous Plan | Revised Plan | Rationale |
|---------------|--------------|-----------|
| 7 days timeline | **3 weeks** | Realistic based on Phase 0/0.8 execution data |
| Direct SQL replacement | **Repository Pattern** | Avoids 1000+ repetitive query transformations |
| 51 files to update | **2 primary files** | Accurate audit (only 2 files use SupabaseDataLayer) |
| No abstraction layer | **Lightweight wrapper (~200 lines)** | Maintainable, testable, gradual migration possible |
| All-or-nothing switch | **Module-by-module with feature flags** | Lower risk, easy rollback |
| Phase 0.7 in plan | **Phase 0.7 already complete** | Nov 7, 2025 - Baileys → Timeweb done |

### Why This Migration?

**Compliance:** 152-ФЗ requirement for Russian data localization
**Performance:** 4-10x faster queries (internal Timeweb network vs Supabase US/EU)
**Cost:** Supabase free tier sustainable as fallback, Timeweb dedicated infrastructure
**Infrastructure:** Moscow datacenter with <1ms latency for internal services

### Current State (Nov 10, 2025)

✅ **Complete:**
- Phase 0: Baileys sessions migrated to Timeweb (stable 4 days)
- Phase 0.8: Schema created on Timeweb (19 tables, 129 indexes, 8 functions)
- PostgreSQL connection pool operational (`postgres.js` - 183 lines)

❌ **Remaining:**
- Production business data still on Supabase (~1,600 records)
- Application code uses SupabaseDataLayer (2 primary files)
- No abstraction layer for gradual migration

### Success Criteria

1. **Zero data loss** - All 1,600+ records migrated intact
2. **Performance** - Response time ≤ Supabase baseline (target: 4-10x faster)
3. **Feature parity** - 100% functional equivalence
4. **Rollback capability** - Can switch back to Supabase in <5 minutes
5. **Code quality** - Maintainable abstraction layer (<300 lines total)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Proposed Architecture](#proposed-architecture)
3. [Phase 1: Repository Pattern Foundation](#phase-1-repository-pattern-foundation)
4. [Phase 2: Code Integration](#phase-2-code-integration)
5. [Phase 3: Data Migration](#phase-3-data-migration)
6. [Phase 4: Testing & Validation](#phase-4-testing--validation)
7. [Phase 5: Production Cutover](#phase-5-production-cutover)
8. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
9. [Rollback Procedures](#rollback-procedures)
10. [Success Metrics & Monitoring](#success-metrics--monitoring)

---

## Current State Analysis

### Infrastructure Status

**Timeweb PostgreSQL (Production Ready)**
```
Host: a84c973324fdaccfc68d929d.twc1.net
Port: 5432
Database: default_db
Status: ✅ Operational since Phase 0 (Nov 6, 2025)
```

**Current Data:**
- **Baileys Sessions:** ✅ Migrated (1 auth + 728 keys)
- **Business Data:** ❌ Still on Supabase

**Schema Status (Phase 0.8 - Nov 9, 2025):**
- 19 tables created
- 129 indexes created
- 8 functions created
- Zero downtime execution (8 minutes)

### Application Code Analysis

**Files Using SupabaseDataLayer: 2 Primary Files**

1. **`src/integrations/yclients/data/supabase-data-layer.js`** (977 lines)
   - **21 async methods** covering all CRUD operations
   - 6 domain areas: DialogContext, Client, Staff, Service, Company, Health
   - Well-structured with validation, error handling, batch protection
   - **This is the primary migration target**

2. **`src/services/ai-admin-v2/modules/data-loader.js`** (150 lines)
   - Uses SupabaseDataLayer for loading conversation context
   - High traffic (every AI message)
   - Well abstracted (easy to update)

**Additional References:**
- 10 sync scripts reference Supabase (but will use repositories via SupabaseDataLayer)
- 7 service files reference Supabase (same - indirect via SupabaseDataLayer)
- Migration impact: **Update 2 files, benefit flows to ~35 dependent files**

### Current Supabase Usage Patterns

**Query Patterns Identified:**

| Pattern | Frequency | PostgreSQL Equivalent |
|---------|-----------|----------------------|
| `.from('table').select('*').eq('id', val)` | High | `SELECT * FROM table WHERE id = $1` |
| `.from('table').upsert(data, {onConflict})` | High | `INSERT ... ON CONFLICT DO UPDATE` |
| `.ilike('name', '%search%')` | Medium | `WHERE name ILIKE $1` |
| `.gte('date', start).lte('date', end)` | Medium | `WHERE date >= $1 AND date <= $2` |
| `.order('col', {ascending: false})` | Medium | `ORDER BY col DESC` |
| `.single()` | Medium | `LIMIT 1` + return `rows[0]` |
| `.maybeSingle()` | Low | `LIMIT 1` + return `rows[0] \|\| null` |

**Not Used (Simplifies Migration):**
- ❌ No Row Level Security (RLS)
- ❌ No Realtime subscriptions
- ❌ No Supabase Auth API
- ❌ No Supabase Storage
- ❌ No complex transactions (all queries atomic)

### Data Volume Analysis

**Tables to Migrate (~1,600 total records):**

| Table | Estimated Rows | Migration Priority |
|-------|----------------|-------------------|
| companies | 1 | HIGH |
| clients | 1,299 | HIGH |
| services | 63 | HIGH |
| staff | 12 | HIGH |
| bookings | 38 | CRITICAL |
| staff_schedules | ~100 | MEDIUM |
| dialog_contexts | ~50 | MEDIUM |
| reminders | ~20 | MEDIUM |

**Dataset Characteristics:**
- Small total size (~15 MB estimated)
- Single company (company_id = 962302)
- No complex relationships requiring careful ordering
- Export/Import estimated: <30 minutes

---

## Proposed Architecture

### Repository Pattern Overview

We'll implement a **lightweight abstraction layer** (~200-300 lines total) that:
1. Provides a clean API matching SupabaseDataLayer's 21 methods
2. Supports both Supabase and PostgreSQL backends
3. Enables gradual migration via feature flags
4. Maintains code quality and testability

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                          │
│  (AI Admin, Sync Scripts, Services, API Routes)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─ Uses SupabaseDataLayer API
                     │
┌────────────────────▼────────────────────────────────────────┐
│            SupabaseDataLayer (977 lines)                    │
│  21 Methods: getClient, upsertClient, getServices, etc.     │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │  Feature Flag Check   │
         │ USE_REPOSITORY_PATTERN│
         └───────────┬───────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
┌───────▼────────┐       ┌─────────▼──────────┐
│  Supabase SDK  │       │  Repository Layer  │
│  (current)     │       │    (new - 200L)    │
└────────────────┘       └─────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
          ┌─────────▼─────────┐         ┌────────▼─────────┐
          │ BaseRepository    │         │ Domain Repos     │
          │ (~120 lines)      │         │ (~60L each × 6)  │
          │ - findOne()       │         │ - ClientRepo     │
          │ - findMany()      │         │ - ServiceRepo    │
          │ - upsert()        │         │ - StaffRepo      │
          │ - bulkUpsert()    │         │ - ContextRepo    │
          └───────────────────┘         │ - CompanyRepo    │
                                        │ - ScheduleRepo   │
                                        └──────────────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │  postgres.js     │
                                        │  Connection Pool │
                                        │  (existing 183L) │
                                        └──────────────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │ Timeweb PostgreSQL│
                                        └──────────────────┘
```

### File Structure

```
src/
├── repositories/
│   ├── BaseRepository.js           (~120 lines) - Core CRUD methods
│   ├── ClientRepository.js         (~80 lines)  - 7 client methods
│   ├── ServiceRepository.js        (~60 lines)  - 4 service methods
│   ├── StaffRepository.js          (~60 lines)  - 2 staff methods
│   ├── StaffScheduleRepository.js  (~60 lines)  - 3 schedule methods
│   ├── DialogContextRepository.js  (~40 lines)  - 2 context methods
│   ├── CompanyRepository.js        (~40 lines)  - 2 company methods
│   └── index.js                    (~20 lines)  - Exports
│
├── integrations/yclients/data/
│   └── supabase-data-layer.js      (977 lines) - UPDATE to use repos
│
└── database/
    ├── postgres.js                 (183 lines) - ✅ Already exists
    └── supabase.js                 (existing)  - Keep for fallback
```

**Total New Code:** ~460 lines of repository pattern
**Code to Update:** 2 primary files

### BaseRepository API

```javascript
// src/repositories/BaseRepository.js
class BaseRepository {
  constructor(db) {
    this.db = db; // postgres pool from postgres.js
  }

  /**
   * Find single record
   * @param {string} table - Table name
   * @param {Object} filters - WHERE conditions { column: value }
   * @returns {Promise<Object|null>}
   */
  async findOne(table, filters) {
    const { where, params } = this._buildWhere(filters);
    const sql = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    const result = await this.db.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Find multiple records
   * @param {string} table
   * @param {Object} filters
   * @param {Object} options - { orderBy, order, limit }
   * @returns {Promise<Array>}
   */
  async findMany(table, filters, options = {}) {
    const { where, params } = this._buildWhere(filters);
    const { orderBy, limit } = this._buildOptions(options, params.length);
    const sql = `SELECT * FROM ${table} WHERE ${where} ${orderBy} ${limit}`;
    const result = await this.db.query(sql, params);
    return result.rows;
  }

  /**
   * Insert or update record
   * @param {string} table
   * @param {Object} data - Record data
   * @param {Array<string>} conflictColumns - Columns for ON CONFLICT
   * @returns {Promise<Object>}
   */
  async upsert(table, data, conflictColumns) {
    // Implementation in Phase 1
  }

  /**
   * Bulk insert or update
   * @param {string} table
   * @param {Array<Object>} dataArray
   * @param {Array<string>} conflictColumns
   * @returns {Promise<Array>}
   */
  async bulkUpsert(table, dataArray, conflictColumns) {
    // Implementation in Phase 1
  }

  // Private helper methods
  _buildWhere(filters) { /* ... */ }
  _buildOptions(options, paramOffset) { /* ... */ }
  _sanitize(value) { /* ... */ }
  _handleError(error) { /* ... */ }
}
```

### Domain Repository Example

```javascript
// src/repositories/ClientRepository.js
const BaseRepository = require('./BaseRepository');

class ClientRepository extends BaseRepository {
  /**
   * Find client by phone number
   * Maps to: SupabaseDataLayer.getClientByPhone()
   */
  async findByPhone(phone) {
    return this.findOne('clients', { phone });
  }

  /**
   * Find client by YClients ID
   * Maps to: SupabaseDataLayer.getClientById()
   */
  async findById(yclientsId, companyId) {
    return this.findOne('clients', {
      yclients_id: yclientsId,
      company_id: companyId
    });
  }

  /**
   * Search clients by name (case-insensitive)
   * Maps to: SupabaseDataLayer.searchClientsByName()
   */
  async searchByName(companyId, name, limit = 100) {
    const sql = `
      SELECT * FROM clients
      WHERE company_id = $1 AND name ILIKE $2
      ORDER BY last_visit_date DESC NULLS LAST
      LIMIT $3
    `;
    const result = await this.db.query(sql, [companyId, `%${name}%`, limit]);
    return result.rows;
  }

  // ... 4 more methods
}
```

### Feature Flag Strategy

```javascript
// config/database-flags.js (NEW)
module.exports = {
  // Global flag to enable Repository Pattern
  USE_REPOSITORY_PATTERN: process.env.USE_REPOSITORY_PATTERN === 'true',

  // Legacy flag (keep for backward compatibility)
  USE_LEGACY_SUPABASE: process.env.USE_LEGACY_SUPABASE !== 'false',

  // Per-module flags (for granular rollout)
  modules: {
    dataLoader: process.env.TIMEWEB_DATA_LOADER === 'true',
    syncScripts: process.env.TIMEWEB_SYNC === 'true',
    services: process.env.TIMEWEB_SERVICES === 'true'
  }
};
```

**Usage in SupabaseDataLayer:**

```javascript
// src/integrations/yclients/data/supabase-data-layer.js
const flags = require('../../../config/database-flags');
const { ClientRepository } = require('../../../repositories');
const postgres = require('../../../database/postgres');

class SupabaseDataLayer {
  constructor(database = null) {
    if (flags.USE_REPOSITORY_PATTERN) {
      this.clientRepo = new ClientRepository(postgres);
      // ... other repos
    } else {
      this.supabase = database || require('../../../database/supabase').supabase;
    }
  }

  async getClientByPhone(phone) {
    if (flags.USE_REPOSITORY_PATTERN) {
      return this.clientRepo.findByPhone(phone);
    }

    // Legacy Supabase implementation
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) throw error;
    return data;
  }
}
```

---

## Phase 1: Repository Pattern Foundation

**Timeline:** 2-3 days
**Risk:** Low (no production impact)
**Effort:** ~460 lines of new code + ~500 lines of tests

### Objectives

1. Create `BaseRepository` class with core CRUD methods
2. Create 6 domain-specific repositories
3. Implement all 21 methods from SupabaseDataLayer
4. Write comprehensive test suite (unit + integration)
5. Validate against Timeweb PostgreSQL

### Task Breakdown

#### Day 1: BaseRepository Foundation

**Task 1.1: Create BaseRepository Class** (3-4 hours)

**File:** `src/repositories/BaseRepository.js` (~120 lines)

**Methods to Implement:**
1. `constructor(db)` - Accept postgres pool
2. `findOne(table, filters)` - Single record SELECT
3. `findMany(table, filters, options)` - Multiple records with ORDER BY, LIMIT
4. `upsert(table, data, conflictColumns)` - INSERT ON CONFLICT DO UPDATE
5. `bulkUpsert(table, dataArray, conflictColumns)` - Batch upsert
6. `_buildWhere(filters)` - Build WHERE clause with parameter binding
7. `_buildOptions(options, paramOffset)` - Build ORDER BY and LIMIT
8. `_sanitize(value)` - Prevent SQL injection
9. `_handleError(error)` - Normalize PostgreSQL errors

**Acceptance Criteria:**
- ✅ All methods return consistent format: `{ success, data, error }`
- ✅ WHERE builder handles: `eq`, `neq`, `gte`, `lte`, `ilike`, `in`, `is null`
- ✅ Parameter binding prevents SQL injection
- ✅ Bulk operations support batches up to 500 records
- ✅ Error messages are user-friendly

**Query Pattern Examples:**

```javascript
// Example 1: Simple equality
filters = { company_id: 962302, phone: '89686484488' }
// → WHERE company_id = $1 AND phone = $2
// → params = [962302, '89686484488']

// Example 2: Range query
filters = {
  company_id: 962302,
  date: { gte: '2025-11-01', lte: '2025-11-30' }
}
// → WHERE company_id = $1 AND date >= $2 AND date <= $3
// → params = [962302, '2025-11-01', '2025-11-30']

// Example 3: Case-insensitive search
filters = {
  company_id: 962302,
  name: { ilike: '%Иван%' }
}
// → WHERE company_id = $1 AND name ILIKE $2
// → params = [962302, '%Иван%']

// Example 4: Options
options = {
  orderBy: 'created_at',
  order: 'desc',
  limit: 10
}
// → ORDER BY created_at DESC LIMIT 10
```

**Task 1.2: Unit Tests for BaseRepository** (2-3 hours)

**File:** `tests/repositories/BaseRepository.test.js` (~200 lines)

**Test Cases:**
1. `findOne()` with various filter types
2. `findMany()` with orderBy and limit
3. `upsert()` single record (INSERT and UPDATE paths)
4. `bulkUpsert()` batch operations
5. WHERE clause builder edge cases (NULL, empty array, undefined)
6. SQL injection protection
7. Error handling (connection errors, syntax errors)

**Acceptance Criteria:**
- ✅ 100% code coverage for BaseRepository
- ✅ All edge cases tested (NULL, empty, invalid input)
- ✅ Mock postgres client (no real DB in unit tests)

#### Day 2-3: Domain Repositories

**Task 1.3: ClientRepository** (2-3 hours)

**File:** `src/repositories/ClientRepository.js` (~80 lines)

**Methods (7 total):**

1. **findByPhone(phone)** → maps to `getClientByPhone`
```javascript
async findByPhone(phone) {
  return this.findOne('clients', { phone });
}
```

2. **findById(yclientsId, companyId)** → maps to `getClientById`
```javascript
async findById(yclientsId, companyId) {
  return this.findOne('clients', {
    yclients_id: yclientsId,
    company_id: companyId
  });
}
```

3. **findAppointments(clientId, options)** → maps to `getClientAppointments`
```javascript
async findAppointments(clientId, options = {}) {
  const { startDate, endDate, limit = 10 } = options;
  const filters = { client_id: clientId };

  if (startDate) filters.datetime = { gte: startDate };
  if (endDate) filters.datetime = { ...filters.datetime, lte: endDate };

  return this.findMany('bookings', filters, {
    orderBy: 'datetime',
    order: 'desc',
    limit
  });
}
```

4. **findUpcoming(clientId, companyId)** → maps to `getUpcomingAppointments`
5. **searchByName(companyId, name, limit)** → maps to `searchClientsByName`
6. **upsert(clientData)** → maps to `upsertClient`
7. **bulkUpsert(clientsArray)** → maps to `upsertClients`

**Acceptance Criteria:**
- ✅ All 7 methods match SupabaseDataLayer API exactly
- ✅ Input validation (phone format, required fields)
- ✅ Returns same data structure as Supabase version
- ✅ Handles edge cases (NULL last_visit_date, empty results)

**Task 1.4: ServiceRepository** (1-2 hours)

**File:** `src/repositories/ServiceRepository.js` (~60 lines)

**Methods (4 total):**
1. `findAll(companyId, includeInactive)` → maps to `getServices`
2. `findById(serviceId, companyId)` → maps to `getServiceById`
3. `findByCategory(companyId, categoryId)` → maps to `getServicesByCategory`
4. `bulkUpsert(servicesArray)` → maps to `upsertServices`

**Task 1.5: StaffRepository** (1 hour)

**File:** `src/repositories/StaffRepository.js` (~60 lines)

**Methods (2 total):**
1. `findAll(companyId, includeInactive)` → maps to `getStaff`
2. `findById(staffId, companyId)` → maps to `getStaffById`

**Task 1.6: StaffScheduleRepository** (1-2 hours)

**File:** `src/repositories/StaffScheduleRepository.js` (~60 lines)

**Methods (3 total):**
1. `findSchedules(query)` → maps to `getStaffSchedules`
   - Complex filters: company_id, staff_id, date range, is_working
2. `findSchedule(staffId, date)` → maps to `getStaffSchedule`
3. `bulkUpsert(schedulesArray)` → maps to `upsertStaffSchedules`

**Task 1.7: DialogContextRepository** (1 hour)

**File:** `src/repositories/DialogContextRepository.js` (~40 lines)

**Methods (2 total):**
1. `findByUserId(userId)` → maps to `getDialogContext`
2. `upsert(contextData)` → maps to `upsertDialogContext`

**Task 1.8: CompanyRepository** (1 hour)

**File:** `src/repositories/CompanyRepository.js` (~40 lines)

**Methods (2 total):**
1. `findById(companyId)` → maps to `getCompany`
2. `upsert(companyData)` → maps to `upsertCompany`

**Task 1.9: Repository Index** (30 minutes)

**File:** `src/repositories/index.js` (~20 lines)

```javascript
const BaseRepository = require('./BaseRepository');
const ClientRepository = require('./ClientRepository');
const ServiceRepository = require('./ServiceRepository');
const StaffRepository = require('./StaffRepository');
const StaffScheduleRepository = require('./StaffScheduleRepository');
const DialogContextRepository = require('./DialogContextRepository');
const CompanyRepository = require('./CompanyRepository');

module.exports = {
  BaseRepository,
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository
};
```

#### Day 3: Integration Tests

**Task 1.10: Integration Tests** (2-3 hours)

**Directory:** `tests/repositories/integration/`

**Test Files:**
1. `ClientRepository.integration.test.js`
2. `ServiceRepository.integration.test.js`
3. `StaffRepository.integration.test.js`
4. `StaffScheduleRepository.integration.test.js`
5. `DialogContextRepository.integration.test.js`
6. `CompanyRepository.integration.test.js`

**Test Approach:**
- Use **real Timeweb PostgreSQL** (not mocks)
- Test against existing schema from Phase 0.8
- Use test data (not production data)
- Clean up after each test

**Example Test:**

```javascript
// tests/repositories/integration/ClientRepository.integration.test.js
const { ClientRepository } = require('../../../src/repositories');
const postgres = require('../../../src/database/postgres');

describe('ClientRepository Integration Tests', () => {
  let clientRepo;
  let testClient;

  beforeAll(() => {
    clientRepo = new ClientRepository(postgres);
  });

  beforeEach(async () => {
    // Insert test client
    testClient = {
      yclients_id: 99999,
      company_id: 962302,
      name: 'Test Client',
      phone: '89999999999',
      created_at: new Date().toISOString()
    };
    await clientRepo.upsert(testClient);
  });

  afterEach(async () => {
    // Clean up test data
    await postgres.query(
      'DELETE FROM clients WHERE yclients_id = $1',
      [99999]
    );
  });

  test('findByPhone returns client', async () => {
    const result = await clientRepo.findByPhone('89999999999');
    expect(result).toBeTruthy();
    expect(result.name).toBe('Test Client');
  });

  test('findById returns client', async () => {
    const result = await clientRepo.findById(99999, 962302);
    expect(result).toBeTruthy();
    expect(result.phone).toBe('89999999999');
  });

  test('searchByName finds partial match', async () => {
    const results = await clientRepo.searchByName(962302, 'Test', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Test');
  });

  test('upsert updates existing record', async () => {
    testClient.name = 'Updated Name';
    const result = await clientRepo.upsert(testClient);
    expect(result.name).toBe('Updated Name');

    // Verify update
    const fetched = await clientRepo.findById(99999, 962302);
    expect(fetched.name).toBe('Updated Name');
  });
});
```

**Acceptance Criteria:**
- ✅ All repositories tested against real Timeweb PostgreSQL
- ✅ Tests create/cleanup their own data
- ✅ All CRUD operations validated
- ✅ Edge cases tested (NULL handling, empty results)

### Phase 1 Deliverables

**Code:**
- ✅ BaseRepository.js (~120 lines)
- ✅ 6 domain repositories (~360 lines total)
- ✅ repositories/index.js (~20 lines)
- ✅ **Total: ~500 lines**

**Tests:**
- ✅ Unit tests (~200 lines)
- ✅ Integration tests (~300 lines)
- ✅ **Total: ~500 lines**

**Documentation:**
- ✅ Repository API documentation
- ✅ Migration mapping guide (Supabase → Repository methods)

### Phase 1 Success Criteria

- [ ] All 21 methods from SupabaseDataLayer mapped to repositories
- [ ] 100% unit test coverage for BaseRepository
- [ ] Integration tests pass with Timeweb PostgreSQL
- [ ] Performance >= Supabase baseline (measured with benchmarks)
- [ ] No production code changed (repositories isolated)
- [ ] Code review approved

---

## Phase 2: Code Integration

**Timeline:** 5-7 days
**Risk:** Medium (production code changes)
**Effort:** Update 2 primary files + configuration

### Objectives

1. Update SupabaseDataLayer to use Repository Pattern
2. Implement feature flags for gradual rollout
3. Maintain backward compatibility with Supabase
4. Test with both backends (Supabase + Timeweb)
5. Deploy to production with Repository Pattern disabled initially

### Task Breakdown

#### Day 4-5: SupabaseDataLayer Integration

**Task 2.1: Update SupabaseDataLayer Constructor** (2 hours)

**File:** `src/integrations/yclients/data/supabase-data-layer.js`

**Changes:**

```javascript
// Add at top
const flags = require('../../../config/database-flags');
const {
  ClientRepository,
  ServiceRepository,
  StaffRepository,
  StaffScheduleRepository,
  DialogContextRepository,
  CompanyRepository
} = require('../../../repositories');
const postgres = require('../../../database/postgres');

class SupabaseDataLayer {
  constructor(database = null) {
    // NEW: Repository Pattern
    if (flags.USE_REPOSITORY_PATTERN) {
      this.clientRepo = new ClientRepository(postgres);
      this.serviceRepo = new ServiceRepository(postgres);
      this.staffRepo = new StaffRepository(postgres);
      this.scheduleRepo = new StaffScheduleRepository(postgres);
      this.contextRepo = new DialogContextRepository(postgres);
      this.companyRepo = new CompanyRepository(postgres);
      this.useRepositories = true;
    } else {
      // LEGACY: Supabase SDK
      this.supabase = database || require('../../../database/supabase').supabase;
      this.useRepositories = false;
    }
  }

  // ... methods updated below
}
```

**Task 2.2: Update All 21 Methods** (6-8 hours)

**Pattern for Each Method:**

```javascript
// Example: getClientByPhone
async getClientByPhone(phone) {
  // Validation (keep existing)
  const phoneError = this._validatePhone(phone);
  if (phoneError) return this._buildErrorResponse(phoneError);

  try {
    // NEW: Repository Pattern
    if (this.useRepositories) {
      const client = await this.clientRepo.findByPhone(phone);
      return this._buildResponse(client);
    }

    // LEGACY: Supabase (keep unchanged)
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) return this._handleSupabaseError(error, 'getClientByPhone');
    return this._buildResponse(data);

  } catch (error) {
    console.error('Error in getClientByPhone:', error);
    return this._buildErrorResponse('Failed to fetch client by phone');
  }
}
```

**Methods to Update (21 total):**

**DialogContext (2 methods):**
1. `getDialogContext` → `contextRepo.findByUserId()`
2. `upsertDialogContext` → `contextRepo.upsert()`

**Client (7 methods):**
3. `getClientByPhone` → `clientRepo.findByPhone()`
4. `getClientById` → `clientRepo.findById()`
5. `getClientAppointments` → `clientRepo.findAppointments()`
6. `getUpcomingAppointments` → `clientRepo.findUpcoming()`
7. `searchClientsByName` → `clientRepo.searchByName()`
8. `upsertClient` → `clientRepo.upsert()`
9. `upsertClients` → `clientRepo.bulkUpsert()`

**Staff (2 methods):**
10. `getStaffById` → `staffRepo.findById()`
11. `getStaff` → `staffRepo.findAll()`

**Staff Schedules (3 methods):**
12. `getStaffSchedules` → `scheduleRepo.findSchedules()`
13. `getStaffSchedule` → `scheduleRepo.findSchedule()`
14. `upsertStaffSchedules` → `scheduleRepo.bulkUpsert()`

**Service (4 methods):**
15. `getServices` → `serviceRepo.findAll()`
16. `getServiceById` → `serviceRepo.findById()`
17. `getServicesByCategory` → `serviceRepo.findByCategory()`
18. `upsertServices` → `serviceRepo.bulkUpsert()`

**Company (2 methods):**
19. `getCompany` → `companyRepo.findById()`
20. `upsertCompany` → `companyRepo.upsert()`

**Health (1 method):**
21. `healthCheck` → Custom implementation (queries multiple repos)

**Acceptance Criteria:**
- ✅ All 21 methods support both backends
- ✅ Feature flag controls which backend is used
- ✅ Validation logic preserved
- ✅ Error handling consistent
- ✅ Response format identical

**Task 2.3: Feature Flag Configuration** (1 hour)

**File:** `config/database-flags.js` (NEW)

```javascript
module.exports = {
  // Main toggle for Repository Pattern
  USE_REPOSITORY_PATTERN: process.env.USE_REPOSITORY_PATTERN === 'true',

  // Legacy flag (for backward compatibility)
  USE_LEGACY_SUPABASE: process.env.USE_LEGACY_SUPABASE !== 'false',

  // Per-module flags (future: granular rollout)
  modules: {
    dataLoader: process.env.TIMEWEB_DATA_LOADER === 'true',
    syncScripts: process.env.TIMEWEB_SYNC === 'true',
    services: process.env.TIMEWEB_SERVICES === 'true',
    apiRoutes: process.env.TIMEWEB_API === 'true'
  },

  // Monitoring flags
  logDatabaseCalls: process.env.LOG_DATABASE_CALLS === 'true',
  compareDualResults: process.env.COMPARE_DUAL_RESULTS === 'true'
};
```

**Environment Variables:**

```bash
# .env (production - initial deployment)
USE_REPOSITORY_PATTERN=false  # Start disabled
USE_LEGACY_SUPABASE=true      # Keep Supabase active

# After validation
USE_REPOSITORY_PATTERN=true   # Enable repositories
USE_LEGACY_SUPABASE=true      # Keep fallback available
```

#### Day 6: Testing with Both Backends

**Task 2.4: Comparison Testing** (3-4 hours)

**Create:** `tests/repositories/comparison/DataLayerComparison.test.js`

**Purpose:** Verify Repository Pattern returns identical results to Supabase

```javascript
const SupabaseDataLayer = require('../../../src/integrations/yclients/data/supabase-data-layer');

describe('DataLayer Comparison Tests', () => {
  let supabaseLayer;
  let repositoryLayer;

  beforeAll(() => {
    // Force Supabase backend
    process.env.USE_REPOSITORY_PATTERN = 'false';
    supabaseLayer = new SupabaseDataLayer();

    // Force Repository backend
    process.env.USE_REPOSITORY_PATTERN = 'true';
    repositoryLayer = new SupabaseDataLayer();
  });

  test('getClientByPhone returns same result', async () => {
    const phone = '89686484488';

    const supabaseResult = await supabaseLayer.getClientByPhone(phone);
    const repositoryResult = await repositoryLayer.getClientByPhone(phone);

    expect(repositoryResult.success).toBe(supabaseResult.success);
    expect(repositoryResult.data).toEqual(supabaseResult.data);
  });

  test('searchClientsByName returns same results', async () => {
    const companyId = 962302;
    const name = 'Иван';
    const limit = 10;

    const supabaseResult = await supabaseLayer.searchClientsByName(
      companyId, name, limit
    );
    const repositoryResult = await repositoryLayer.searchClientsByName(
      companyId, name, limit
    );

    expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
    // Deep comparison of first result
    if (repositoryResult.data.length > 0) {
      expect(repositoryResult.data[0]).toEqual(supabaseResult.data[0]);
    }
  });

  // ... test all 21 methods
});
```

**Acceptance Criteria:**
- ✅ All 21 methods tested with comparison
- ✅ Results are identical (data structure and content)
- ✅ Performance measured (Repository should be faster)
- ✅ Edge cases tested (empty results, NULL values)

**Task 2.5: Update data-loader.js** (2 hours)

**File:** `src/services/ai-admin-v2/modules/data-loader.js`

**Current Usage:**
```javascript
const SupabaseDataLayer = require('../../../integrations/yclients/data/supabase-data-layer');
const dataLayer = new SupabaseDataLayer();

// Uses dataLayer.getCompany(), dataLayer.getClientByPhone(), etc.
```

**Changes:** None required! SupabaseDataLayer already handles backend switching internally.

**Testing:**
- ✅ Run AI Admin with `USE_REPOSITORY_PATTERN=true`
- ✅ Send test message to WhatsApp bot
- ✅ Verify context loading works
- ✅ Verify booking commands work

#### Day 7: Production Deployment Preparation

**Task 2.6: Documentation** (2 hours)

**Create:**
1. `docs/REPOSITORY_PATTERN_GUIDE.md` - API documentation
2. `docs/MIGRATION_RUNBOOK.md` - Step-by-step cutover guide
3. `docs/ROLLBACK_PROCEDURES.md` - Emergency rollback steps

**Task 2.7: Monitoring Setup** (2 hours)

**Add to:** `src/repositories/BaseRepository.js`

```javascript
async findOne(table, filters) {
  const startTime = Date.now();

  try {
    const { where, params } = this._buildWhere(filters);
    const sql = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    const result = await this.db.query(sql, params);

    // Log performance
    const duration = Date.now() - startTime;
    if (flags.logDatabaseCalls) {
      console.log(`[DB] findOne ${table} - ${duration}ms`);
    }

    return result.rows[0] || null;
  } catch (error) {
    console.error(`[DB Error] findOne ${table}:`, error);
    throw error;
  }
}
```

**Task 2.8: Deploy to Production** (1 hour)

**Steps:**
1. Merge feature branch to main
2. Deploy to production
3. Keep `USE_REPOSITORY_PATTERN=false` initially
4. Monitor for 24 hours
5. No code changes during monitoring period

**Acceptance Criteria:**
- ✅ Deployment successful
- ✅ Application runs with Supabase (no changes to user experience)
- ✅ No errors in logs
- ✅ Repository Pattern code deployed but disabled

### Phase 2 Deliverables

**Code Changes:**
- ✅ SupabaseDataLayer updated (all 21 methods)
- ✅ Feature flags configuration
- ✅ Monitoring added to repositories

**Tests:**
- ✅ Comparison tests (verify identical results)
- ✅ Integration tests with data-loader

**Documentation:**
- ✅ Repository Pattern API guide
- ✅ Migration runbook
- ✅ Rollback procedures

### Phase 2 Success Criteria

- [ ] All 21 methods work with both backends
- [ ] Comparison tests show identical results
- [ ] Performance benchmarks: Repository >= Supabase
- [ ] Production deployment successful (Repository Pattern disabled)
- [ ] 24-hour monitoring clean (no errors)
- [ ] Rollback procedure tested and documented

---

## Phase 3: Data Migration

**Timeline:** 3-5 days
**Risk:** High (data integrity critical)
**Effort:** Export/Import scripts + validation

### Objectives

1. Export all production data from Supabase
2. Import data to Timeweb PostgreSQL
3. Verify data integrity (row counts, checksums)
4. Optional: Run dual-write for validation period
5. Prepare for cutover

### Task Breakdown

#### Day 8: Export Scripts

**Task 3.1: Create Export Script** (3-4 hours)

**File:** `scripts/export-supabase-data.js`

```javascript
const { supabase } = require('../src/database/supabase');
const fs = require('fs').promises;
const path = require('path');

const TABLES = [
  'companies',
  'clients',
  'services',
  'staff',
  'staff_schedules',
  'bookings',
  'dialog_contexts',
  'reminders'
];

async function exportTable(tableName) {
  console.log(`Exporting ${tableName}...`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to export ${tableName}: ${error.message}`);
  }

  const outputPath = path.join(__dirname, `../exports/${tableName}.json`);
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ Exported ${data.length} rows from ${tableName}`);
  return { table: tableName, rows: data.length };
}

async function exportAll() {
  console.log('Starting Supabase data export...\n');

  // Create exports directory
  await fs.mkdir(path.join(__dirname, '../exports'), { recursive: true });

  const results = [];
  for (const table of TABLES) {
    const result = await exportTable(table);
    results.push(result);
  }

  // Summary
  console.log('\n=== Export Summary ===');
  const total = results.reduce((sum, r) => sum + r.rows, 0);
  results.forEach(r => console.log(`${r.table}: ${r.rows} rows`));
  console.log(`Total: ${total} rows\n`);

  // Save metadata
  const metadata = {
    exportDate: new Date().toISOString(),
    tables: results,
    totalRows: total
  };
  await fs.writeFile(
    path.join(__dirname, '../exports/metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log('✅ Export complete!');
}

exportAll().catch(console.error);
```

**Usage:**
```bash
node scripts/export-supabase-data.js
```

**Output:**
```
exports/
├── companies.json (1 row)
├── clients.json (1,299 rows)
├── services.json (63 rows)
├── staff.json (12 rows)
├── staff_schedules.json (~100 rows)
├── bookings.json (38 rows)
├── dialog_contexts.json (~50 rows)
├── reminders.json (~20 rows)
└── metadata.json (summary)
```

**Acceptance Criteria:**
- ✅ All 8 tables exported
- ✅ JSON files valid and readable
- ✅ Row counts match Supabase totals
- ✅ Metadata file created with export timestamp

#### Day 9: Import Scripts

**Task 3.2: Create Import Script** (3-4 hours)

**File:** `scripts/import-timeweb-data.js`

```javascript
const postgres = require('../src/database/postgres');
const fs = require('fs').promises;
const path = require('path');

const TABLES = [
  'companies',      // First (referenced by others)
  'clients',
  'services',
  'staff',
  'staff_schedules',
  'bookings',
  'dialog_contexts',
  'reminders'
];

async function importTable(tableName) {
  console.log(`Importing ${tableName}...`);

  // Read exported JSON
  const filePath = path.join(__dirname, `../exports/${tableName}.json`);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

  if (data.length === 0) {
    console.log(`⚠️  No data to import for ${tableName}`);
    return { table: tableName, rows: 0 };
  }

  // Build bulk INSERT with ON CONFLICT
  const columns = Object.keys(data[0]);
  const values = data.map((row, i) => {
    const params = columns.map((col, j) => `$${i * columns.length + j + 1}`);
    return `(${params.join(', ')})`;
  }).join(', ');

  const allParams = data.flatMap(row => columns.map(col => row[col]));

  const sql = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}
  `;

  await postgres.query(sql, allParams);

  console.log(`✅ Imported ${data.length} rows to ${tableName}`);
  return { table: tableName, rows: data.length };
}

async function importAll() {
  console.log('Starting Timeweb data import...\n');

  const results = [];
  for (const table of TABLES) {
    const result = await importTable(table);
    results.push(result);
  }

  // Summary
  console.log('\n=== Import Summary ===');
  const total = results.reduce((sum, r) => sum + r.rows, 0);
  results.forEach(r => console.log(`${r.table}: ${r.rows} rows`));
  console.log(`Total: ${total} rows\n`);

  console.log('✅ Import complete!');
}

importAll().catch(console.error);
```

**Usage:**
```bash
node scripts/import-timeweb-data.js
```

**Acceptance Criteria:**
- ✅ All 8 tables imported to Timeweb
- ✅ Row counts match export files
- ✅ No duplicate key errors (ON CONFLICT handles existing Baileys data)
- ✅ Foreign key constraints satisfied

#### Day 10: Data Validation

**Task 3.3: Create Validation Script** (2-3 hours)

**File:** `scripts/validate-migration.js`

```javascript
const { supabase } = require('../src/database/supabase');
const postgres = require('../src/database/postgres');

const TABLES = [
  'companies', 'clients', 'services', 'staff',
  'staff_schedules', 'bookings', 'dialog_contexts', 'reminders'
];

async function validateTable(tableName) {
  console.log(`Validating ${tableName}...`);

  // Count rows in Supabase
  const { count: supabaseCount, error: supabaseError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (supabaseError) throw supabaseError;

  // Count rows in Timeweb
  const timewebResult = await postgres.query(
    `SELECT COUNT(*) FROM ${tableName}`
  );
  const timewebCount = parseInt(timewebResult.rows[0].count);

  const match = supabaseCount === timewebCount;
  const status = match ? '✅' : '❌';

  console.log(`${status} ${tableName}: Supabase=${supabaseCount}, Timeweb=${timewebCount}`);

  return {
    table: tableName,
    supabaseCount,
    timewebCount,
    match
  };
}

async function validateAll() {
  console.log('Starting data validation...\n');

  const results = [];
  for (const table of TABLES) {
    const result = await validateTable(table);
    results.push(result);
  }

  console.log('\n=== Validation Summary ===');
  const allMatch = results.every(r => r.match);

  if (allMatch) {
    console.log('✅ All tables validated successfully!');
  } else {
    console.log('❌ Some tables have mismatched counts:');
    results
      .filter(r => !r.match)
      .forEach(r => console.log(`  - ${r.table}: ${r.supabaseCount} vs ${r.timewebCount}`));
  }

  return allMatch;
}

validateAll()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
```

**Usage:**
```bash
node scripts/validate-migration.js
```

**Expected Output:**
```
✅ companies: Supabase=1, Timeweb=1
✅ clients: Supabase=1299, Timeweb=1299
✅ services: Supabase=63, Timeweb=63
✅ staff: Supabase=12, Timeweb=12
✅ staff_schedules: Supabase=98, Timeweb=98
✅ bookings: Supabase=38, Timeweb=38
✅ dialog_contexts: Supabase=47, Timeweb=47
✅ reminders: Supabase=19, Timeweb=19

✅ All tables validated successfully!
```

**Acceptance Criteria:**
- ✅ Row counts match for all 8 tables
- ✅ No data corruption
- ✅ Foreign keys valid
- ✅ Timestamps preserved

#### Day 11-12: Optional Dual-Write Testing

**Task 3.4: Implement Dual-Write (Optional)** (4-6 hours)

**Purpose:** Write to both databases simultaneously for validation period

**File:** `src/repositories/BaseRepository.js`

```javascript
async upsert(table, data, conflictColumns) {
  const result = await this._performUpsert(table, data, conflictColumns);

  // Optional: Dual-write to Supabase for validation
  if (flags.dualWrite && this.supabase) {
    try {
      await this.supabase
        .from(table)
        .upsert(data, { onConflict: conflictColumns.join(',') });
    } catch (error) {
      console.error(`[DualWrite] Failed to sync ${table} to Supabase:`, error);
      // Don't fail the operation - Timeweb is source of truth
    }
  }

  return result;
}
```

**Configuration:**
```bash
# Enable dual-write
DUAL_WRITE=true

# Run for 48 hours, then disable
DUAL_WRITE=false
```

**Monitoring:**
- Compare Supabase vs Timeweb data every hour
- Alert if discrepancies detected
- Log all dual-write failures

**Note:** Dual-write is **optional** per user preference. Can rely on feature flags for rollback instead.

### Phase 3 Deliverables

**Scripts:**
- ✅ export-supabase-data.js
- ✅ import-timeweb-data.js
- ✅ validate-migration.js

**Data:**
- ✅ All 8 tables exported (JSON files)
- ✅ All data imported to Timeweb
- ✅ Validation passed (row counts match)

**Optional:**
- ✅ Dual-write implementation
- ✅ 48-hour validation period

### Phase 3 Success Criteria

- [ ] All tables exported successfully
- [ ] All data imported to Timeweb
- [ ] Validation script confirms 100% match
- [ ] No data corruption detected
- [ ] Foreign key constraints satisfied
- [ ] Optional: 48h dual-write shows no discrepancies

---

## Phase 4: Testing & Validation

**Timeline:** 2-3 days + 48 hours monitoring
**Risk:** Medium (final validation before cutover)
**Effort:** Comprehensive testing

### Objectives

1. Enable Repository Pattern in production (read-only from Timeweb)
2. Run functional tests (all user flows)
3. Performance benchmarking (compare vs Supabase baseline)
4. 48-hour monitoring period
5. Final go/no-go decision

### Task Breakdown

#### Day 13: Enable Repository Pattern

**Task 4.1: Production Configuration Update** (1 hour)

**Steps:**
1. SSH to production server
2. Update `.env`:
   ```bash
   USE_REPOSITORY_PATTERN=true   # Enable repositories
   USE_LEGACY_SUPABASE=true      # Keep fallback
   ```
3. Restart application: `pm2 restart all`
4. Monitor logs for 1 hour

**Acceptance Criteria:**
- ✅ Application starts successfully
- ✅ No errors in PM2 logs
- ✅ Test WhatsApp message works

**Task 4.2: Functional Testing** (4-6 hours)

**Test Scenarios:**

1. **WhatsApp Bot - New Client Booking**
   - Send: "Привет"
   - Bot should load company info from Timeweb
   - Send: "Записаться на стрижку"
   - Bot should load services from Timeweb
   - Complete booking
   - Verify booking saved to Timeweb

2. **WhatsApp Bot - Existing Client**
   - Send message from known number (89686484488)
   - Bot should recognize client from Timeweb
   - Check upcoming appointments from Timeweb

3. **Client Search**
   - Search for client by name
   - Verify results from Timeweb
   - Compare with Supabase results (should match)

4. **Service Listing**
   - Request services list
   - Verify all 63 services loaded from Timeweb
   - Check ordering and filtering

5. **Staff Schedules**
   - Query staff schedule
   - Verify data from Timeweb
   - Check date range queries

6. **Booking Monitor**
   - Verify reminders sent based on Timeweb data
   - Check notification timing

7. **Sync Scripts**
   - Run manual sync (clients, services, staff)
   - Verify writes to Timeweb
   - Check for errors

**Acceptance Criteria:**
- ✅ All user flows work end-to-end
- ✅ No errors in application logs
- ✅ Data loaded from Timeweb correctly
- ✅ Writes persist to Timeweb

**Task 4.3: Performance Benchmarking** (3-4 hours)

**Create:** `scripts/benchmark-performance.js`

```javascript
const SupabaseDataLayer = require('../src/integrations/yclients/data/supabase-data-layer');

async function benchmark(method, ...args) {
  const iterations = 100;
  const times = [];

  const dataLayer = new SupabaseDataLayer();

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await dataLayer[method](...args);
    times.push(Date.now() - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

  return { avg, min, max, p95 };
}

async function runBenchmarks() {
  console.log('Running performance benchmarks...\n');

  // Test various operations
  const tests = [
    ['getClientByPhone', '89686484488'],
    ['searchClientsByName', 962302, 'Иван', 10],
    ['getServices', 962302, false],
    ['getStaffSchedules', { companyId: 962302, date: '2025-11-10' }],
    ['getCompany', 962302]
  ];

  for (const [method, ...args] of tests) {
    const stats = await benchmark(method, ...args);
    console.log(`${method}:`);
    console.log(`  avg: ${stats.avg}ms`);
    console.log(`  min: ${stats.min}ms`);
    console.log(`  max: ${stats.max}ms`);
    console.log(`  p95: ${stats.p95}ms\n`);
  }
}

runBenchmarks().catch(console.error);
```

**Run twice:**
```bash
# With Supabase (baseline)
USE_REPOSITORY_PATTERN=false node scripts/benchmark-performance.js

# With Timeweb
USE_REPOSITORY_PATTERN=true node scripts/benchmark-performance.js
```

**Expected Results:**

| Operation | Supabase (baseline) | Timeweb (target) | Improvement |
|-----------|---------------------|------------------|-------------|
| getClientByPhone | 35ms | 8ms | 4.4x faster |
| searchClientsByName | 42ms | 10ms | 4.2x faster |
| getServices | 38ms | 9ms | 4.2x faster |
| getStaffSchedules | 45ms | 11ms | 4.1x faster |
| getCompany | 30ms | 7ms | 4.3x faster |

**Acceptance Criteria:**
- ✅ Timeweb queries are faster than Supabase (target: 4-10x)
- ✅ p95 latency < 20ms for all operations
- ✅ No performance regressions

#### Day 14: Monitoring Period

**Task 4.4: 48-Hour Production Monitoring** (passive)

**Metrics to Track:**

1. **Error Rate**
   - Total errors in logs
   - Database connection errors
   - Query failures
   - Target: Zero database-related errors

2. **Response Times**
   - Average query time
   - p95 query time
   - p99 query time
   - Target: < Supabase baseline

3. **Throughput**
   - Queries per minute
   - Concurrent connections
   - Pool utilization
   - Target: No connection pool exhaustion

4. **Data Consistency**
   - Run validation script every 6 hours
   - Compare Supabase vs Timeweb row counts
   - Target: 100% match

**Monitoring Script:**

```bash
# scripts/monitor-production.sh
#!/bin/bash

echo "=== Production Monitoring Report ==="
echo "Time: $(date)"
echo ""

# Error count (last hour)
echo "Errors (last hour):"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-worker-v2 --err --lines 1000 | grep -i error | wc -l"

# Database query times (from logs)
echo ""
echo "Average query time (last 100 queries):"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs --lines 1000 | grep '\[DB\]' | tail -100 | awk '{print \$NF}' | \
   awk '{sum+=\$1; n++} END {print sum/n \"ms\"}'"

# Pool stats
echo ""
echo "Connection pool stats:"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs --lines 100 | grep 'Pool:'"

echo ""
echo "==================================="
```

**Run every 6 hours:**
```bash
# Add to crontab
0 */6 * * * /path/to/scripts/monitor-production.sh >> /var/log/migration-monitoring.log
```

**Acceptance Criteria:**
- ✅ Zero database errors during 48h period
- ✅ Response times stable or improved
- ✅ No connection pool issues
- ✅ Data consistency maintained

**Task 4.5: Go/No-Go Decision** (1 hour)

**Decision Criteria:**

✅ **GO if:**
- All functional tests passed
- Performance >= Supabase baseline (ideally 4-10x faster)
- Zero critical errors during 48h monitoring
- Data validation shows 100% consistency
- Team confidence high

❌ **NO-GO if:**
- Any functional test failures
- Performance regression vs Supabase
- >1% error rate
- Data inconsistencies detected
- Team has concerns

**If GO:** Proceed to Phase 5 (Production Cutover)
**If NO-GO:**
1. Analyze root cause of issues
2. Fix problems
3. Repeat Phase 4 testing
4. Consider rollback if unfixable

### Phase 4 Deliverables

**Testing:**
- ✅ Functional tests (all flows)
- ✅ Performance benchmarks
- ✅ 48-hour monitoring logs

**Reports:**
- ✅ Functional test results
- ✅ Performance comparison report
- ✅ Monitoring summary

**Decision:**
- ✅ Go/No-Go decision documented

### Phase 4 Success Criteria

- [ ] All functional tests pass
- [ ] Performance benchmarks show 4-10x improvement
- [ ] 48-hour monitoring clean (zero errors)
- [ ] Data consistency validated
- [ ] Go decision approved by team

---

## Phase 5: Production Cutover

**Timeline:** 2-4 hours
**Risk:** Medium (final switch)
**Effort:** Configuration changes + monitoring

### Objectives

1. Disable Supabase as primary database
2. Make Timeweb the source of truth
3. Monitor for immediate issues
4. Keep Supabase available as fallback
5. Celebrate success! 🎉

### Task Breakdown

#### Cutover Day: Early Morning (02:00-06:00 recommended)

**Task 5.1: Pre-Cutover Checklist** (30 minutes)

**Verify:**
- [ ] All Phase 4 tests passed
- [ ] 48-hour monitoring clean
- [ ] Team available for support
- [ ] Rollback procedure tested and ready
- [ ] Backup of current Supabase data
- [ ] PM2 logs clear

**Task 5.2: Configuration Update** (15 minutes)

**SSH to production:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
```

**Update `.env`:**
```bash
# Before (current state)
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=true

# After (cutover)
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=true  # Keep as fallback initially
TIMEWEB_IS_PRIMARY=true   # New flag to mark Timeweb as source of truth
```

**Restart services:**
```bash
pm2 restart all
pm2 logs --lines 100
```

**Acceptance Criteria:**
- ✅ Application starts successfully
- ✅ No errors in startup logs
- ✅ First few queries successful

**Task 5.3: Smoke Tests** (30 minutes)

**Immediately after restart, test:**

1. **WhatsApp Bot Message**
   ```
   Send: "Привет" to +79936363848
   Expected: Bot responds within 10 seconds
   ```

2. **Client Query**
   ```
   Query client 89686484488
   Expected: Data returned from Timeweb
   ```

3. **Booking Creation**
   ```
   Create test booking
   Expected: Saved to Timeweb, booking ID returned
   ```

4. **Health Check**
   ```
   curl http://localhost:3000/api/health
   Expected: {"status": "ok", "database": "timeweb"}
   ```

**If any test fails:** Immediate rollback to Supabase

**Task 5.4: 1-Hour Intensive Monitoring** (1 hour)

**Monitor logs:**
```bash
pm2 logs ai-admin-worker-v2 --lines 500
```

**Watch for:**
- Database connection errors
- Query failures
- Timeout errors
- Unexpected null results
- Performance degradation

**Check metrics every 15 minutes:**
```bash
# Error count
pm2 logs --err --lines 100 | grep -i error | wc -l

# Average query time
pm2 logs --lines 200 | grep '\[DB\]' | tail -50 | \
  awk '{print $NF}' | awk '{sum+=$1; n++} END {print sum/n "ms"}'

# Pool stats
pm2 logs --lines 50 | grep 'Pool:'
```

**Acceptance Criteria:**
- ✅ Zero critical errors
- ✅ Query times < 20ms (avg)
- ✅ All user flows working
- ✅ No connection pool issues

**Task 5.5: 24-Hour Monitoring** (passive)

**Continue monitoring for 24 hours:**
- Check logs every 6 hours
- Run validation script (Supabase vs Timeweb) at 12h and 24h
- Monitor error rate and performance

**Alert triggers:**
- Error rate > 0.1%
- Average query time > 50ms
- Connection pool > 80% utilization
- Data inconsistencies detected

**Task 5.6: Final Supabase Disable** (after 7 days successful operation)

**After 7 days of stable Timeweb operation:**

```bash
# Update .env
USE_LEGACY_SUPABASE=false  # Disable Supabase fallback

# Keep Supabase project alive but remove from production config
# (It's free tier, so no rush to delete)
```

**Note:** Keep Supabase project for 30+ days as backup before considering deletion.

### Phase 5 Deliverables

**Configuration:**
- ✅ Production environment using Timeweb as primary
- ✅ Supabase available as fallback

**Monitoring:**
- ✅ 1-hour intensive monitoring logs
- ✅ 24-hour monitoring report

**Documentation:**
- ✅ Cutover execution report
- ✅ Post-migration performance report

### Phase 5 Success Criteria

- [ ] Cutover executed successfully
- [ ] All smoke tests passed
- [ ] 1-hour monitoring clean
- [ ] 24-hour monitoring shows stable operation
- [ ] Performance meets expectations (4-10x faster)
- [ ] Zero data loss
- [ ] User experience unchanged (or better)

---

## Risk Assessment & Mitigation

### Critical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Query transformation errors** | Medium | High | Comprehensive test suite (unit + integration + comparison) |
| **Performance regression** | Low | High | Benchmark before/after, optimize indexes if needed |
| **Data inconsistency** | Low | Critical | Validation scripts, optional dual-write period |
| **Connection pool exhaustion** | Low | Medium | Monitor pool usage, adjust max connections if needed |
| **Timeweb downtime** | Very Low | High | Keep Supabase active as fallback, feature flag rollback |
| **Migration script failure** | Low | High | Test on non-prod first, validate checksums |
| **Feature flag misconfiguration** | Medium | Medium | Clear documentation, testing with both states |
| **Timezone handling differences** | Very Low | Low | Both DBs use UTC, app handles TZ conversion |

### Mitigation Strategies

**1. Comprehensive Testing**
- Unit tests for all repository methods
- Integration tests against real Timeweb PostgreSQL
- Comparison tests (Supabase vs Repository results)
- Performance benchmarks before/after
- 48-hour monitoring period before full cutover

**2. Gradual Rollout**
- Phase 1: No production impact (repositories isolated)
- Phase 2: Code deployed but disabled
- Phase 4: Enabled for reads only (Supabase still available)
- Phase 5: Full cutover (Supabase kept as fallback)

**3. Feature Flags**
- Global flag: `USE_REPOSITORY_PATTERN`
- Per-module flags for future granular control
- Instant rollback capability (<5 minutes)

**4. Monitoring**
- Database query logging
- Connection pool metrics
- Error rate tracking
- Performance metrics (avg, p95, p99)
- Data consistency validation

**5. Rollback Capability**
- Supabase stays active during entire migration
- Feature flag can instantly switch back
- No data loss (writes continue to Supabase until Phase 5)
- Documented rollback procedure

---

## Rollback Procedures

### Immediate Rollback (During Phase 4 or 5)

**Scenario:** Critical issue detected, need to switch back to Supabase immediately

**Steps (5 minutes):**

1. **SSH to production:**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
   cd /opt/ai-admin
   ```

2. **Disable Repository Pattern:**
   ```bash
   # Edit .env
   USE_REPOSITORY_PATTERN=false
   ```

3. **Restart application:**
   ```bash
   pm2 restart all
   pm2 logs --lines 50
   ```

4. **Verify rollback:**
   - Send test WhatsApp message
   - Check logs for Supabase queries
   - Confirm no errors

5. **Notify team:**
   - Post to Telegram: "Migration rolled back to Supabase due to [reason]"

**Acceptance Criteria:**
- ✅ Application using Supabase within 5 minutes
- ✅ All user flows working
- ✅ No errors in logs

### Post-Rollback Analysis

**After rollback, investigate:**
1. What triggered the rollback?
2. Root cause analysis
3. Can issue be fixed quickly?
4. Do we need to revise the plan?

**Options:**
- **Fix and retry:** If issue is minor (e.g., missing index)
- **Delay Phase 5:** If issue needs more investigation
- **Revise plan:** If fundamental flaw discovered

---

## Success Metrics & Monitoring

### Key Performance Indicators (KPIs)

**1. Data Integrity**
- **Metric:** Row count match (Supabase vs Timeweb)
- **Target:** 100% match
- **Measurement:** Validation script every 6 hours

**2. Performance**
- **Metric:** Average query response time
- **Baseline:** Supabase ~35ms
- **Target:** Timeweb <10ms (4-10x improvement)
- **Measurement:** Benchmark script, production logs

**3. Reliability**
- **Metric:** Error rate
- **Target:** <0.01% (1 error per 10,000 queries)
- **Measurement:** PM2 logs analysis

**4. Availability**
- **Metric:** Uptime during migration
- **Target:** 100% (zero downtime)
- **Measurement:** Health check endpoint

**5. User Experience**
- **Metric:** WhatsApp bot response time
- **Baseline:** ~24 seconds (with DeepSeek)
- **Current:** ~9 seconds (with Gemini)
- **Target:** Maintain or improve (faster DB should help)
- **Measurement:** Message timestamp logs

### Monitoring Dashboard

**Create:** `scripts/migration-dashboard.sh`

```bash
#!/bin/bash

echo "╔════════════════════════════════════════════╗"
echo "║   DATABASE MIGRATION MONITORING DASHBOARD  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Current backend
echo "📊 Current Configuration:"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "grep 'USE_REPOSITORY_PATTERN' /opt/ai-admin/.env"
echo ""

# Error count (last hour)
echo "❌ Errors (last hour):"
ERROR_COUNT=$(ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-worker-v2 --err --lines 1000 | grep -i error | wc -l")
echo "   $ERROR_COUNT errors"
echo ""

# Average query time
echo "⚡ Query Performance (last 100 queries):"
AVG_TIME=$(ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs --lines 1000 | grep '\[DB\]' | tail -100 | \
   awk '{print \$NF}' | sed 's/ms//' | \
   awk '{sum+=\$1; n++} END {print sum/n}'")
echo "   Average: ${AVG_TIME}ms"
echo ""

# Connection pool
echo "🔌 Connection Pool:"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs --lines 100 | grep 'Pool:' | tail -1"
echo ""

# Data consistency
echo "✅ Data Consistency Check:"
echo "   (Running validation script...)"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && node scripts/validate-migration.js"
echo ""

echo "═══════════════════════════════════════════"
echo "Last updated: $(date)"
```

**Run periodically:**
```bash
watch -n 300 ./scripts/migration-dashboard.sh  # Every 5 minutes
```

### Post-Migration Success Report

**After 7 days of stable operation, create final report:**

```markdown
# Database Migration Success Report

**Migration Date:** [Date]
**Duration:** 3 weeks (planning + execution)
**Downtime:** 0 minutes

## Results

### Performance Improvements
- Average query time: 35ms → 8ms (4.4x faster)
- p95 latency: 58ms → 12ms (4.8x faster)
- WhatsApp bot response: Maintained ~9 seconds

### Data Integrity
- Total records migrated: 1,600
- Data loss: 0 records
- Validation success rate: 100%

### Reliability
- Error rate: 0.003% (3 errors in 100,000 queries)
- Uptime: 100%
- Rollbacks required: 0

### Cost Impact
- Supabase cost: $0/month (free tier, kept as backup)
- Timeweb cost: Included in existing infrastructure
- Net savings: Improved performance at no additional cost

## Lessons Learned
1. Repository Pattern abstraction was critical for maintainability
2. Comprehensive testing prevented production issues
3. Feature flags enabled confident, gradual rollout
4. Keeping Supabase as fallback provided peace of mind

## Next Steps
- Continue monitoring for 30 days
- Consider disabling Supabase fallback after 30 days
- Document learnings for future migrations
```

---

## Timeline Summary

| Phase | Duration | Tasks | Risk | Status |
|-------|----------|-------|------|--------|
| **Phase 1: Repository Pattern** | 2-3 days | Create BaseRepository + 6 domain repos + tests | Low | Pending |
| **Phase 2: Code Integration** | 5-7 days | Update SupabaseDataLayer, feature flags, testing | Medium | Pending |
| **Phase 3: Data Migration** | 3-5 days | Export, import, validation | High | Pending |
| **Phase 4: Testing** | 2-3 days + 48h | Functional tests, benchmarks, monitoring | Medium | Pending |
| **Phase 5: Cutover** | 2-4 hours | Production switch, smoke tests, monitoring | Medium | Pending |
| **Total** | **~3 weeks** | **21 days** | **Medium** | **Planning** |

### Gantt Chart

```
Week 1: Foundation
Day 1-2: BaseRepository + tests         [████████░░]
Day 2-3: Domain repositories            [████████████]

Week 2: Integration
Day 4-5: Update SupabaseDataLayer       [████████████]
Day 6:   Comparison testing             [██████░░░░░░]
Day 7:   Deploy to production (disabled)[████████░░░░]

Week 3: Migration & Testing
Day 8:   Export Supabase data           [██████░░░░░░]
Day 9:   Import to Timeweb              [██████░░░░░░]
Day 10:  Validation                     [████░░░░░░░░]
Day 11-12: Optional dual-write          [████████████]

Week 4: Final Testing & Cutover
Day 13:  Enable in production           [████████░░░░]
Day 14:  Functional tests               [████████████]
Day 15:  Performance benchmarks         [██████░░░░░░]
Day 16-17: 48h monitoring               [████████████]
Day 18:  Go/No-Go decision              [██░░░░░░░░░░]
Day 19:  Production cutover (02:00-06:00)[████░░░░░░░░]
Day 20-21: Post-cutover monitoring      [████████████]
```

---

## Appendix

### A. Repository Pattern API Reference

See `docs/REPOSITORY_PATTERN_GUIDE.md` (created in Phase 2)

### B. Query Translation Guide

| Supabase Pattern | PostgreSQL Equivalent | Repository Method |
|------------------|----------------------|-------------------|
| `.from('table').select('*')` | `SELECT * FROM table` | `findMany('table', {})` |
| `.eq('col', val)` | `WHERE col = $1` | `findMany('table', { col: val })` |
| `.neq('col', val)` | `WHERE col != $1` | `findMany('table', { col: { neq: val } })` |
| `.gte('col', val)` | `WHERE col >= $1` | `findMany('table', { col: { gte: val } })` |
| `.lte('col', val)` | `WHERE col <= $1` | `findMany('table', { col: { lte: val } })` |
| `.ilike('col', pattern)` | `WHERE col ILIKE $1` | `findMany('table', { col: { ilike: pattern } })` |
| `.in('col', [v1, v2])` | `WHERE col IN ($1, $2)` | `findMany('table', { col: { in: [v1, v2] } })` |
| `.is('col', null)` | `WHERE col IS NULL` | `findMany('table', { col: null })` |
| `.order('col', {ascending: false})` | `ORDER BY col DESC` | `findMany('table', {}, { orderBy: 'col', order: 'desc' })` |
| `.limit(n)` | `LIMIT $n` | `findMany('table', {}, { limit: n })` |
| `.single()` | `LIMIT 1` + `rows[0]` | `findOne('table', filters)` |
| `.maybeSingle()` | `LIMIT 1` + `rows[0] \|\| null` | `findOne('table', filters)` (same) |
| `.upsert(data, {onConflict})` | `INSERT ... ON CONFLICT DO UPDATE` | `upsert('table', data, conflictCols)` |

### C. Feature Flag Reference

```javascript
// config/database-flags.js

module.exports = {
  // Main toggle
  USE_REPOSITORY_PATTERN: process.env.USE_REPOSITORY_PATTERN === 'true',

  // Legacy support
  USE_LEGACY_SUPABASE: process.env.USE_LEGACY_SUPABASE !== 'false',

  // Optional: Per-module flags
  modules: {
    dataLoader: process.env.TIMEWEB_DATA_LOADER === 'true',
    syncScripts: process.env.TIMEWEB_SYNC === 'true',
    services: process.env.TIMEWEB_SERVICES === 'true',
    apiRoutes: process.env.TIMEWEB_API === 'true'
  },

  // Optional: Dual-write for validation
  dualWrite: process.env.DUAL_WRITE === 'true',

  // Monitoring
  logDatabaseCalls: process.env.LOG_DATABASE_CALLS === 'true',
  compareDualResults: process.env.COMPARE_DUAL_RESULTS === 'true'
};
```

**Environment Variables:**

```bash
# Production states during migration

# Phase 1-2: Repository Pattern deployed but disabled
USE_REPOSITORY_PATTERN=false
USE_LEGACY_SUPABASE=true

# Phase 4: Repository Pattern enabled for testing
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=true

# Phase 5: Timeweb as primary, Supabase fallback
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=true
TIMEWEB_IS_PRIMARY=true

# After 7 days: Disable Supabase fallback (optional)
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=false
```

### D. Rollback Decision Tree

```
                     ┌─────────────────┐
                     │ Issue Detected? │
                     └────────┬────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
              YES                         NO
                 │                         │
         ┌───────▼────────┐         ┌─────▼──────┐
         │ Critical issue?│         │  Continue  │
         └───────┬────────┘         │ monitoring │
                 │                  └────────────┘
    ┌────────────┴────────────┐
    │                         │
  YES                        NO
    │                         │
┌───▼────────────┐    ┌──────▼────────┐
│ ROLLBACK NOW!  │    │ Log & Monitor │
│ (5 min)        │    │ Can it wait?  │
└────────────────┘    └───────┬───────┘
                              │
                  ┌───────────┴──────────┐
                  │                      │
            Worsening                 Stable
                  │                      │
         ┌────────▼─────────┐    ┌──────▼────────┐
         │ ROLLBACK         │    │ Fix in Phase  │
         │ (within 30 min)  │    │ (log issue)   │
         └──────────────────┘    └───────────────┘
```

**Critical Issues (Immediate Rollback):**
- Database connection failures
- Data corruption detected
- Error rate > 1%
- Complete service outage
- Performance degradation > 2x baseline

**Non-Critical Issues (Log & Monitor):**
- Single query failure (< 0.1% error rate)
- Slow query (but avg still acceptable)
- Warning logs (no functional impact)
- Minor performance variance

### E. Contact & Escalation

**Team Contacts:**
- **Migration Lead:** [Name]
- **Backend Engineer:** [Name]
- **DevOps:** [Name]

**Escalation Path:**
1. **Minor issue:** Log in monitoring dashboard
2. **Moderate issue:** Post to team Telegram
3. **Major issue:** Call migration lead
4. **Critical issue:** Initiate rollback, call all team members

**Support Schedule During Migration:**
- Phase 4 (Testing): Team on standby
- Phase 5 (Cutover): 24/7 on-call for first 48 hours

---

## Conclusion

This revised plan incorporates all critical improvements identified by the plan-reviewer agent:

✅ **Realistic timeline** (3 weeks vs 7 days)
✅ **Repository Pattern abstraction** (~500 lines vs 1000+ SQL queries)
✅ **Accurate scope** (2 primary files vs 51)
✅ **Gradual migration** (feature flags vs all-or-nothing)
✅ **Comprehensive testing** (unit + integration + comparison + 48h monitoring)
✅ **Risk mitigation** (rollback procedures, monitoring, validation)

**Next Steps:**
1. Review this plan with team
2. Approve Phase 1 start
3. Create feature branch: `feature/database-migration-phase1-repositories`
4. Begin BaseRepository implementation

**Confidence Level:** High
**Risk Level:** Medium (with mitigation strategies)
**Recommended:** Proceed with Phase 1

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
**Approved By:** Pending team review
