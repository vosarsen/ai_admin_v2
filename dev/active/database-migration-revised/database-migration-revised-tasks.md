# Database Migration - Detailed Task Checklist

**Last Updated:** 2025-11-10
**Total Duration:** 3 weeks (~21 days)
**Status:** Pending start

---

## How to Use This File

- **Check off tasks** as you complete them: `- [ ]` → `- [x]`
- **Mark current task** with `🔄` emoji
- **Add notes** under completed tasks if needed
- **Update progress** daily before context compaction
- **This survives context resets** - always current!

---

## Progress Overview

```
Phase 1: Repository Pattern ⬜ (0/25 tasks)
Phase 2: Code Integration   ⬜ (0/18 tasks)
Phase 3: Data Migration      ⬜ (0/12 tasks)
Phase 4: Testing             ⬜ (0/10 tasks)
Phase 5: Production Cutover  ⬜ (0/8 tasks)

Total: 0/73 tasks complete (0%)
```

---

# Phase 1: Repository Pattern Foundation ⬜

**Timeline:** 2-3 days (Nov 11-13)
**Risk:** Low (no production impact)
**Deliverables:** BaseRepository + 6 domain repos + tests (~1,000 lines total)

## Day 1: BaseRepository Core (8 tasks)

### Task 1.1: Create BaseRepository Class Structure
- [ ] Create file `src/repositories/BaseRepository.js`
- [ ] Add JSDoc comments for class
- [ ] Implement `constructor(db)` - accepts postgres pool
- [ ] Add private properties: `this.db`, `this.tableName`
- [ ] Export class as module.exports

**Acceptance Criteria:**
- ✅ File created at correct path
- ✅ Constructor accepts postgres pool
- ✅ JSDoc documentation complete
- ✅ No syntax errors

**Estimated Time:** 30 minutes

---

### Task 1.2: Implement findOne() Method
- [ ] Add JSDoc for `findOne(table, filters)`
- [ ] Implement method body:
  - [ ] Call `_buildWhere(filters)` to get WHERE clause
  - [ ] Build SQL: `SELECT * FROM ${table} WHERE ${where} LIMIT 1`
  - [ ] Execute query via `this.db.query(sql, params)`
  - [ ] Return `result.rows[0] || null`
- [ ] Add error handling (try/catch)
- [ ] Log query if `LOG_DATABASE_CALLS=true`

**Acceptance Criteria:**
- ✅ Returns single object or null
- ✅ Uses parameterized queries (no SQL injection)
- ✅ Error handling present
- ✅ Logging optional via env var

**Example Usage:**
```javascript
const client = await repo.findOne('clients', { phone: '89686484488' });
// → { id: 1, name: '...', phone: '89686484488' }
```

**Estimated Time:** 45 minutes

---

### Task 1.3: Implement findMany() Method
- [ ] Add JSDoc for `findMany(table, filters, options)`
- [ ] Implement method body:
  - [ ] Call `_buildWhere(filters)` to get WHERE clause
  - [ ] Call `_buildOptions(options, params.length)` to get ORDER BY, LIMIT
  - [ ] Build SQL: `SELECT * FROM ${table} WHERE ${where} ${orderBy} ${limit}`
  - [ ] Execute query
  - [ ] Return `result.rows` (array)
- [ ] Add error handling
- [ ] Add logging

**Acceptance Criteria:**
- ✅ Returns array (empty if no results)
- ✅ Supports ORDER BY (ascending/descending)
- ✅ Supports LIMIT
- ✅ Parameters correctly offset

**Example Usage:**
```javascript
const clients = await repo.findMany(
  'clients',
  { company_id: 962302 },
  { orderBy: 'name', order: 'asc', limit: 10 }
);
// → [ {...}, {...}, ... ] (up to 10 results)
```

**Estimated Time:** 1 hour

---

### Task 1.4: Implement _buildWhere() Helper
- [ ] Add JSDoc for `_buildWhere(filters)`
- [ ] Handle simple equality: `{ id: 5 }` → `"id = $1"`, `[5]`
- [ ] Handle operators:
  - [ ] `{ age: { gte: 18 } }` → `"age >= $1"`
  - [ ] `{ age: { lte: 65 } }` → `"age <= $1"`
  - [ ] `{ status: { neq: 'deleted' } }` → `"status != $1"`
  - [ ] `{ name: { ilike: '%search%' } }` → `"name ILIKE $1"`
  - [ ] `{ id: { in: [1,2,3] } }` → `"id IN ($1, $2, $3)"`
- [ ] Handle NULL: `{ deleted_at: null }` → `"deleted_at IS NULL"`
- [ ] Join multiple conditions with AND
- [ ] Return `{ where, params }`

**Acceptance Criteria:**
- ✅ All operators supported (eq, neq, gte, lte, ilike, in, is null)
- ✅ Parameter indexing correct ($1, $2, etc.)
- ✅ NULL handling works
- ✅ Empty filters return `"1=1"` (no filters)

**Example:**
```javascript
const { where, params } = _buildWhere({
  company_id: 962302,
  created_at: { gte: '2025-11-01' },
  name: { ilike: '%test%' }
});
// → where: "company_id = $1 AND created_at >= $2 AND name ILIKE $3"
// → params: [962302, '2025-11-01', '%test%']
```

**Estimated Time:** 1.5 hours

---

### Task 1.5: Implement _buildOptions() Helper
- [ ] Add JSDoc for `_buildOptions(options, paramOffset)`
- [ ] Handle ORDER BY:
  - [ ] `{ orderBy: 'name' }` → `"ORDER BY name ASC"`
  - [ ] `{ orderBy: 'name', order: 'desc' }` → `"ORDER BY name DESC"`
  - [ ] Handle NULLS LAST: `"ORDER BY name DESC NULLS LAST"`
- [ ] Handle LIMIT:
  - [ ] `{ limit: 10 }` → `"LIMIT 10"`
  - [ ] No limit if not specified
- [ ] Handle OFFSET (for future pagination):
  - [ ] `{ limit: 10, offset: 20 }` → `"LIMIT 10 OFFSET 20"`
- [ ] Return `{ orderBy, limit }` strings

**Acceptance Criteria:**
- ✅ ORDER BY with ASC/DESC
- ✅ NULLS LAST for DESC ordering
- ✅ LIMIT works
- ✅ OFFSET works (for pagination)
- ✅ Returns empty strings if options not specified

**Example:**
```javascript
const { orderBy, limit } = _buildOptions({
  orderBy: 'created_at',
  order: 'desc',
  limit: 50
}, 3); // paramOffset
// → orderBy: "ORDER BY created_at DESC NULLS LAST"
// → limit: "LIMIT 50"
```

**Estimated Time:** 45 minutes

---

### Task 1.6: Implement upsert() Method
- [ ] Add JSDoc for `upsert(table, data, conflictColumns)`
- [ ] Build column list: `['id', 'name', 'phone']`
- [ ] Build VALUES placeholders: `($1, $2, $3)`
- [ ] Build ON CONFLICT clause: `ON CONFLICT (id) DO UPDATE SET ...`
- [ ] Build UPDATE SET clause: `name = EXCLUDED.name, phone = EXCLUDED.phone`
- [ ] Add RETURNING * to get inserted/updated record
- [ ] Execute query
- [ ] Return `result.rows[0]`

**Acceptance Criteria:**
- ✅ Inserts if record doesn't exist
- ✅ Updates if conflict on specified columns
- ✅ Returns inserted/updated record
- ✅ Works with single conflict column and multiple

**Example:**
```javascript
const client = await repo.upsert(
  'clients',
  { yclients_id: 123, company_id: 962302, name: 'Иван' },
  ['yclients_id', 'company_id']
);
// INSERT ... ON CONFLICT (yclients_id, company_id) DO UPDATE SET ...
```

**Estimated Time:** 1.5 hours

---

### Task 1.7: Implement bulkUpsert() Method
- [ ] Add JSDoc for `bulkUpsert(table, dataArray, conflictColumns)`
- [ ] Validate dataArray not empty
- [ ] Get columns from first record: `Object.keys(dataArray[0])`
- [ ] Build multiple VALUES: `($1, $2), ($3, $4), ...`
- [ ] Flatten all params: `[val1, val2, val3, val4, ...]`
- [ ] Build ON CONFLICT and UPDATE SET
- [ ] Add RETURNING *
- [ ] Execute single query for all records
- [ ] Return `result.rows`

**Acceptance Criteria:**
- ✅ Handles up to 500 records (batch limit)
- ✅ Single SQL query for all records
- ✅ Returns all inserted/updated records
- ✅ Fails gracefully if dataArray empty

**Example:**
```javascript
const services = await repo.bulkUpsert(
  'services',
  [
    { yclients_id: 1, name: 'Стрижка', price: 1000 },
    { yclients_id: 2, name: 'Окрашивание', price: 3000 }
  ],
  ['yclients_id']
);
// → [ {...}, {...} ] (2 records)
```

**Estimated Time:** 2 hours

---

### Task 1.8: Implement Helper Methods
- [ ] `_sanitize(value)` - Prevent SQL injection in dynamic table/column names
  - [ ] Whitelist alphanumeric + underscore
  - [ ] Throw error if invalid characters
- [ ] `_handleError(error)` - Normalize PostgreSQL errors
  - [ ] Map error codes to friendly messages
  - [ ] Code 23505: "Duplicate key"
  - [ ] Code 23503: "Foreign key violation"
  - [ ] Code 42P01: "Table doesn't exist"
  - [ ] Return structured error object

**Acceptance Criteria:**
- ✅ _sanitize prevents SQL injection
- ✅ _handleError normalizes common errors
- ✅ Error messages user-friendly

**Estimated Time:** 45 minutes

---

## Day 1 Summary Checkpoint

**Total Tasks:** 8
**Total Time:** ~8 hours
**Files Created:**
- ✅ `src/repositories/BaseRepository.js` (~120 lines)

**Code Review:**
- [ ] Run `npm run lint` (if configured)
- [ ] Review BaseRepository code
- [ ] Check JSDoc completeness
- [ ] Verify error handling

---

## Day 2: Domain Repositories (10 tasks)

### Task 1.9: Create ClientRepository
- [ ] Create file `src/repositories/ClientRepository.js`
- [ ] Extend BaseRepository: `class ClientRepository extends BaseRepository`
- [ ] Implement 7 methods:

#### Method 1: findByPhone(phone)
- [ ] Add JSDoc
- [ ] Implementation: `return this.findOne('clients', { phone });`
- [ ] Maps to: `SupabaseDataLayer.getClientByPhone()`

#### Method 2: findById(yclientsId, companyId)
- [ ] Add JSDoc
- [ ] Implementation:
  ```javascript
  return this.findOne('clients', {
    yclients_id: yclientsId,
    company_id: companyId
  });
  ```
- [ ] Maps to: `SupabaseDataLayer.getClientById()`

#### Method 3: findAppointments(clientId, options = {})
- [ ] Add JSDoc
- [ ] Extract options: `{ startDate, endDate, limit = 10 }`
- [ ] Build filters:
  ```javascript
  const filters = { client_id: clientId };
  if (startDate) filters.datetime = { gte: startDate };
  if (endDate) filters.datetime = { ...filters.datetime, lte: endDate };
  ```
- [ ] Call `this.findMany('bookings', filters, { orderBy: 'datetime', order: 'desc', limit })`
- [ ] Maps to: `SupabaseDataLayer.getClientAppointments()`

#### Method 4: findUpcoming(clientId, companyId)
- [ ] Add JSDoc
- [ ] Build filters:
  ```javascript
  {
    client_id: clientId,
    company_id: companyId,
    datetime: { gte: new Date().toISOString() },
    status: { neq: 'deleted' }
  }
  ```
- [ ] Order by datetime ascending
- [ ] Maps to: `SupabaseDataLayer.getUpcomingAppointments()`

#### Method 5: searchByName(companyId, name, limit = 100)
- [ ] Add JSDoc
- [ ] Custom SQL (ILIKE with NULLS LAST):
  ```javascript
  const sql = `
    SELECT * FROM clients
    WHERE company_id = $1 AND name ILIKE $2
    ORDER BY last_visit_date DESC NULLS LAST
    LIMIT $3
  `;
  const result = await this.db.query(sql, [companyId, `%${name}%`, limit]);
  return result.rows;
  ```
- [ ] Maps to: `SupabaseDataLayer.searchClientsByName()`

#### Method 6: upsert(clientData)
- [ ] Add JSDoc
- [ ] Call `this.upsert('clients', clientData, ['yclients_id', 'company_id'])`
- [ ] Maps to: `SupabaseDataLayer.upsertClient()`

#### Method 7: bulkUpsert(clientsArray)
- [ ] Add JSDoc
- [ ] Call `this.bulkUpsert('clients', clientsArray, ['yclients_id', 'company_id'])`
- [ ] Maps to: `SupabaseDataLayer.upsertClients()`

**Acceptance Criteria:**
- ✅ All 7 methods implemented
- ✅ JSDoc for each method
- ✅ Signatures match SupabaseDataLayer exactly
- ✅ Input validation where needed

**Estimated Time:** 2-3 hours

---

### Task 1.10: Create ServiceRepository
- [ ] Create file `src/repositories/ServiceRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement 4 methods:

#### Method 1: findAll(companyId, includeInactive = false)
- [ ] Build filters: `{ company_id: companyId }`
- [ ] If NOT includeInactive: `{ company_id: companyId, active: true }`
- [ ] Order by: `weight` descending (or `seance_length` as fallback)
- [ ] Maps to: `SupabaseDataLayer.getServices()`

#### Method 2: findById(serviceId, companyId)
- [ ] `return this.findOne('services', { yclients_id: serviceId, company_id: companyId });`
- [ ] Maps to: `SupabaseDataLayer.getServiceById()`

#### Method 3: findByCategory(companyId, categoryId)
- [ ] `return this.findMany('services', { company_id: companyId, category_id: categoryId });`
- [ ] Order by weight DESC
- [ ] Maps to: `SupabaseDataLayer.getServicesByCategory()`

#### Method 4: bulkUpsert(servicesArray)
- [ ] Call `this.bulkUpsert('services', servicesArray, ['yclients_id', 'company_id'])`
- [ ] Maps to: `SupabaseDataLayer.upsertServices()`

**Acceptance Criteria:**
- ✅ All 4 methods implemented
- ✅ Active/inactive filtering works
- ✅ Ordering by weight correct

**Estimated Time:** 1-2 hours

---

### Task 1.11: Create StaffRepository
- [ ] Create file `src/repositories/StaffRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement 2 methods:

#### Method 1: findAll(companyId, includeInactive = false)
- [ ] Similar to ServiceRepository.findAll
- [ ] Filter by `{ company_id: companyId, fired: false }` if not including inactive
- [ ] Order by name
- [ ] Maps to: `SupabaseDataLayer.getStaff()`

#### Method 2: findById(staffId, companyId)
- [ ] `return this.findOne('staff', { yclients_id: staffId, company_id: companyId });`
- [ ] Maps to: `SupabaseDataLayer.getStaffById()`

**Acceptance Criteria:**
- ✅ Both methods implemented
- ✅ Fired staff excluded unless explicitly included

**Estimated Time:** 45 minutes

---

### Task 1.12: Create StaffScheduleRepository
- [ ] Create file `src/repositories/StaffScheduleRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement 3 methods:

#### Method 1: findSchedules(query)
- [ ] Extract from query: `{ companyId, staffId, dateFrom, dateTo, isWorking }`
- [ ] Build complex filters:
  ```javascript
  const filters = { company_id: companyId };
  if (staffId) filters.yclients_staff_id = staffId;
  if (dateFrom) filters.date = { gte: dateFrom };
  if (dateTo) filters.date = { ...filters.date, lte: dateTo };
  if (isWorking !== undefined) filters.is_working = isWorking;
  ```
- [ ] Order by date, then staff_id
- [ ] Maps to: `SupabaseDataLayer.getStaffSchedules()`

#### Method 2: findSchedule(staffId, date, companyId)
- [ ] `return this.findOne('staff_schedules', { yclients_staff_id: staffId, date, company_id: companyId });`
- [ ] Maps to: `SupabaseDataLayer.getStaffSchedule()`

#### Method 3: bulkUpsert(schedulesArray)
- [ ] Call `this.bulkUpsert('staff_schedules', schedulesArray, ['yclients_staff_id', 'date', 'company_id'])`
- [ ] Note: 3-column conflict key (unique constraint)
- [ ] Maps to: `SupabaseDataLayer.upsertStaffSchedules()`

**Acceptance Criteria:**
- ✅ Complex filters work (date ranges, staff filtering)
- ✅ 3-column conflict key handled
- ✅ Ordering correct

**Estimated Time:** 1.5 hours

---

### Task 1.13: Create DialogContextRepository
- [ ] Create file `src/repositories/DialogContextRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement 2 methods:

#### Method 1: findByUserId(userId)
- [ ] `return this.findOne('dialog_contexts', { user_id: userId });`
- [ ] Maps to: `SupabaseDataLayer.getDialogContext()`

#### Method 2: upsert(contextData)
- [ ] Call `this.upsert('dialog_contexts', contextData, ['user_id'])`
- [ ] Maps to: `SupabaseDataLayer.upsertDialogContext()`

**Acceptance Criteria:**
- ✅ Both methods implemented
- ✅ Context JSON field handled correctly

**Estimated Time:** 30 minutes

---

### Task 1.14: Create CompanyRepository
- [ ] Create file `src/repositories/CompanyRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement 2 methods:

#### Method 1: findById(companyId)
- [ ] `return this.findOne('companies', { yclients_id: companyId });`
- [ ] Maps to: `SupabaseDataLayer.getCompany()`

#### Method 2: upsert(companyData)
- [ ] Call `this.upsert('companies', companyData, ['yclients_id'])`
- [ ] Maps to: `SupabaseDataLayer.upsertCompany()`

**Acceptance Criteria:**
- ✅ Both methods implemented
- ✅ Company data structure preserved

**Estimated Time:** 30 minutes

---

### Task 1.15: Create Repository Index
- [ ] Create file `src/repositories/index.js`
- [ ] Export all repositories:
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

**Acceptance Criteria:**
- ✅ All repositories exported
- ✅ No require errors
- ✅ Can import: `const { ClientRepository } = require('./repositories');`

**Estimated Time:** 15 minutes

---

### Task 1.16: Code Review - Repositories
- [ ] Review all 7 repository files
- [ ] Check for:
  - [ ] Consistent naming conventions
  - [ ] JSDoc completeness
  - [ ] Error handling in all methods
  - [ ] No hardcoded values
- [ ] Run linter if available
- [ ] Fix any issues found

**Estimated Time:** 30 minutes

---

## Day 2 Summary Checkpoint

**Total Tasks:** 7
**Total Time:** ~7-8 hours
**Files Created:**
- ✅ `ClientRepository.js` (~80 lines)
- ✅ `ServiceRepository.js` (~60 lines)
- ✅ `StaffRepository.js` (~60 lines)
- ✅ `StaffScheduleRepository.js` (~60 lines)
- ✅ `DialogContextRepository.js` (~40 lines)
- ✅ `CompanyRepository.js` (~40 lines)
- ✅ `index.js` (~20 lines)

**Total Repository Code:** ~480 lines

---

## Day 3: Testing (7 tasks)

### Task 1.17: Setup Test Environment
- [ ] Install test dependencies (if not present):
  - [ ] `npm install --save-dev jest` (or existing test framework)
- [ ] Create `tests/repositories/` directory
- [ ] Create `tests/repositories/integration/` directory
- [ ] Add test configuration (jest.config.js if needed)

**Estimated Time:** 30 minutes

---

### Task 1.18: Write Unit Tests - BaseRepository
- [ ] Create file `tests/repositories/BaseRepository.test.js`
- [ ] Mock postgres client:
  ```javascript
  const mockDb = {
    query: jest.fn()
  };
  ```
- [ ] Test findOne():
  - [ ] Returns single record
  - [ ] Returns null if not found
  - [ ] Uses correct SQL and params
- [ ] Test findMany():
  - [ ] Returns array of records
  - [ ] Returns empty array if no results
  - [ ] ORDER BY works
  - [ ] LIMIT works
- [ ] Test upsert():
  - [ ] Inserts new record
  - [ ] Updates existing record
  - [ ] Returns inserted/updated record
- [ ] Test bulkUpsert():
  - [ ] Handles multiple records
  - [ ] Returns all records
- [ ] Test _buildWhere():
  - [ ] Simple equality: `{ id: 5 }`
  - [ ] Operators: gte, lte, neq, ilike, in
  - [ ] NULL handling: `{ deleted_at: null }`
  - [ ] Multiple conditions (AND)
- [ ] Test _buildOptions():
  - [ ] ORDER BY ascending
  - [ ] ORDER BY descending with NULLS LAST
  - [ ] LIMIT
  - [ ] OFFSET

**Acceptance Criteria:**
- ✅ 20+ test cases
- ✅ 100% code coverage for BaseRepository
- ✅ All edge cases tested (NULL, empty, undefined)
- ✅ All tests pass

**Estimated Time:** 3 hours

---

### Task 1.19: Write Unit Tests - ClientRepository
- [ ] Create file `tests/repositories/ClientRepository.test.js`
- [ ] Mock BaseRepository methods
- [ ] Test all 7 methods:
  - [ ] findByPhone() calls findOne with correct params
  - [ ] findById() calls findOne with correct params
  - [ ] findAppointments() builds correct filters
  - [ ] findUpcoming() builds date filter correctly
  - [ ] searchByName() uses ILIKE correctly
  - [ ] upsert() calls base method
  - [ ] bulkUpsert() calls base method

**Acceptance Criteria:**
- ✅ All methods tested
- ✅ Parameter passing verified
- ✅ All tests pass

**Estimated Time:** 1.5 hours

---

### Task 1.20: Write Unit Tests - Other Repositories
- [ ] Create test files for:
  - [ ] `ServiceRepository.test.js`
  - [ ] `StaffRepository.test.js`
  - [ ] `StaffScheduleRepository.test.js`
  - [ ] `DialogContextRepository.test.js`
  - [ ] `CompanyRepository.test.js`
- [ ] Test all methods in each repository
- [ ] Verify parameter passing
- [ ] Check filter logic

**Acceptance Criteria:**
- ✅ 5 test files created
- ✅ All repository methods tested
- ✅ All tests pass

**Estimated Time:** 2 hours

---

### Task 1.21: Write Integration Tests - ClientRepository
- [ ] Create file `tests/repositories/integration/ClientRepository.integration.test.js`
- [ ] Use REAL Timeweb PostgreSQL connection
- [ ] Setup test data:
  ```javascript
  beforeEach(async () => {
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
    await postgres.query('DELETE FROM clients WHERE yclients_id = $1', [99999]);
  });
  ```
- [ ] Test findByPhone() against real DB
- [ ] Test findById() against real DB
- [ ] Test searchByName() with ILIKE
- [ ] Test upsert() inserts new record
- [ ] Test upsert() updates existing record
- [ ] Test bulkUpsert() with 3 records

**Acceptance Criteria:**
- ✅ All tests use real Timeweb PostgreSQL
- ✅ Tests create and cleanup own data
- ✅ All CRUD operations validated
- ✅ ILIKE search works with Russian characters

**Estimated Time:** 2 hours

---

### Task 1.22: Write Integration Tests - Other Repositories
- [ ] Create integration test files for:
  - [ ] `ServiceRepository.integration.test.js`
  - [ ] `StaffRepository.integration.test.js`
  - [ ] `StaffScheduleRepository.integration.test.js`
  - [ ] `DialogContextRepository.integration.test.js`
  - [ ] `CompanyRepository.integration.test.js`
- [ ] Test against real Timeweb PostgreSQL
- [ ] Create/cleanup test data in each test
- [ ] Verify all methods work end-to-end

**Acceptance Criteria:**
- ✅ 5 integration test files
- ✅ All tests pass with real database
- ✅ No test data left behind

**Estimated Time:** 3 hours

---

### Task 1.23: Run Full Test Suite
- [ ] Run all unit tests: `npm test`
- [ ] Run all integration tests: `npm run test:integration`
- [ ] Check code coverage: `npm run test:coverage`
- [ ] Target: >90% coverage for repositories
- [ ] Fix any failing tests
- [ ] Document any known issues

**Acceptance Criteria:**
- ✅ All tests pass (unit + integration)
- ✅ Code coverage >90%
- ✅ No flaky tests

**Estimated Time:** 1 hour

---

## Phase 1 Final Checkpoint ✅

**Tasks Completed:** 25
**Files Created:**
- ✅ `src/repositories/BaseRepository.js` (~120 lines)
- ✅ `src/repositories/ClientRepository.js` (~80 lines)
- ✅ `src/repositories/ServiceRepository.js` (~60 lines)
- ✅ `src/repositories/StaffRepository.js` (~60 lines)
- ✅ `src/repositories/StaffScheduleRepository.js` (~60 lines)
- ✅ `src/repositories/DialogContextRepository.js` (~40 lines)
- ✅ `src/repositories/CompanyRepository.js` (~40 lines)
- ✅ `src/repositories/index.js` (~20 lines)
- ✅ 12 test files (~800 lines)

**Success Criteria:**
- [ ] All 21 methods from SupabaseDataLayer mapped to repositories
- [ ] 100% unit test coverage for BaseRepository
- [ ] Integration tests pass with Timeweb PostgreSQL
- [ ] Performance >= Supabase baseline
- [ ] Code review approved
- [ ] Ready to proceed to Phase 2

---

# Phase 2: Code Integration ⬜

**Timeline:** 5-7 days (Nov 14-20)
**Risk:** Medium (production code changes)
**Deliverables:** Updated SupabaseDataLayer + feature flags + tests

## Day 4-5: SupabaseDataLayer Integration (8 tasks)

### Task 2.1: Create Feature Flag Configuration
- [ ] Create file `config/database-flags.js`
- [ ] Implement flag checks:
  ```javascript
  module.exports = {
    USE_REPOSITORY_PATTERN: process.env.USE_REPOSITORY_PATTERN === 'true',
    USE_LEGACY_SUPABASE: process.env.USE_LEGACY_SUPABASE !== 'false',
    modules: {
      dataLoader: process.env.TIMEWEB_DATA_LOADER === 'true',
      syncScripts: process.env.TIMEWEB_SYNC === 'true'
    },
    logDatabaseCalls: process.env.LOG_DATABASE_CALLS === 'true'
  };
  ```
- [ ] Add to version control

**Acceptance Criteria:**
- ✅ Flag file created
- ✅ Environment variables documented
- ✅ Default is Supabase (backward compatible)

**Estimated Time:** 30 minutes

---

### Task 2.2: Update SupabaseDataLayer Constructor
- [ ] Open `src/integrations/yclients/data/supabase-data-layer.js`
- [ ] Add imports:
  ```javascript
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
  ```
- [ ] Update constructor:
  ```javascript
  constructor(database = null) {
    if (flags.USE_REPOSITORY_PATTERN) {
      this.clientRepo = new ClientRepository(postgres);
      this.serviceRepo = new ServiceRepository(postgres);
      this.staffRepo = new StaffRepository(postgres);
      this.scheduleRepo = new StaffScheduleRepository(postgres);
      this.contextRepo = new DialogContextRepository(postgres);
      this.companyRepo = new CompanyRepository(postgres);
      this.useRepositories = true;
    } else {
      this.supabase = database || require('../../../database/supabase').supabase;
      this.useRepositories = false;
    }
  }
  ```

**Acceptance Criteria:**
- ✅ Constructor supports both backends
- ✅ Feature flag controls which is used
- ✅ Backward compatible (Supabase by default)

**Estimated Time:** 1 hour

---

### Task 2.3: Update DialogContext Methods (2 methods)
- [ ] Update `getDialogContext(userId)`:
  ```javascript
  if (this.useRepositories) {
    const context = await this.contextRepo.findByUserId(userId);
    return this._buildResponse(context);
  }
  // ... existing Supabase code
  ```
- [ ] Update `upsertDialogContext(userId, context)`:
  ```javascript
  if (this.useRepositories) {
    const result = await this.contextRepo.upsert({ user_id: userId, ...context });
    return this._buildResponse(result);
  }
  // ... existing Supabase code
  ```

**Acceptance Criteria:**
- ✅ Both methods support both backends
- ✅ Response format identical
- ✅ Validation logic preserved

**Estimated Time:** 45 minutes

---

### Task 2.4: Update Client Methods (7 methods)
- [ ] Update `getClientByPhone(phone)`:
  - [ ] Add repository path with `clientRepo.findByPhone()`
  - [ ] Keep Supabase path unchanged
- [ ] Update `getClientById(yclientsId, companyId)`:
  - [ ] Add repository path with `clientRepo.findById()`
- [ ] Update `getClientAppointments(clientId, options)`:
  - [ ] Add repository path with `clientRepo.findAppointments()`
- [ ] Update `getUpcomingAppointments(clientId, companyId)`:
  - [ ] Add repository path with `clientRepo.findUpcoming()`
- [ ] Update `searchClientsByName(companyId, name, limit)`:
  - [ ] Add repository path with `clientRepo.searchByName()`
- [ ] Update `upsertClient(clientData)`:
  - [ ] Add repository path with `clientRepo.upsert()`
- [ ] Update `upsertClients(clientsArray)`:
  - [ ] Add repository path with `clientRepo.bulkUpsert()`

**Pattern for each method:**
```javascript
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

**Acceptance Criteria:**
- ✅ All 7 methods updated
- ✅ Feature flag checked in each
- ✅ Validation preserved
- ✅ Error handling consistent

**Estimated Time:** 3 hours

---

### Task 2.5: Update Staff Methods (2 methods)
- [ ] Update `getStaffById(staffId, companyId)`:
  - [ ] Add repository path with `staffRepo.findById()`
- [ ] Update `getStaff(companyId, includeInactive)`:
  - [ ] Add repository path with `staffRepo.findAll()`

**Estimated Time:** 45 minutes

---

### Task 2.6: Update Staff Schedule Methods (3 methods)
- [ ] Update `getStaffSchedules(query)`:
  - [ ] Add repository path with `scheduleRepo.findSchedules()`
- [ ] Update `getStaffSchedule(staffId, date, companyId)`:
  - [ ] Add repository path with `scheduleRepo.findSchedule()`
- [ ] Update `upsertStaffSchedules(schedulesArray)`:
  - [ ] Add repository path with `scheduleRepo.bulkUpsert()`

**Estimated Time:** 1.5 hours

---

### Task 2.7: Update Service Methods (4 methods)
- [ ] Update `getServices(companyId, includeInactive)`:
  - [ ] Add repository path with `serviceRepo.findAll()`
- [ ] Update `getServiceById(serviceId, companyId)`:
  - [ ] Add repository path with `serviceRepo.findById()`
- [ ] Update `getServicesByCategory(companyId, categoryId)`:
  - [ ] Add repository path with `serviceRepo.findByCategory()`
- [ ] Update `upsertServices(servicesArray)`:
  - [ ] Add repository path with `serviceRepo.bulkUpsert()`

**Estimated Time:** 1.5 hours

---

### Task 2.8: Update Company Methods (2 methods)
- [ ] Update `getCompany(companyId)`:
  - [ ] Add repository path with `companyRepo.findById()`
- [ ] Update `upsertCompany(companyData)`:
  - [ ] Add repository path with `companyRepo.upsert()`

**Estimated Time:** 30 minutes

---

### Task 2.9: Update healthCheck() Method
- [ ] Implement custom health check using repositories:
  ```javascript
  if (this.useRepositories) {
    const [companies, clients, services] = await Promise.all([
      this.companyRepo.findById(companyId),
      postgres.query('SELECT COUNT(*) FROM clients WHERE company_id = $1', [companyId]),
      postgres.query('SELECT COUNT(*) FROM services WHERE company_id = $1', [companyId])
    ]);

    return this._buildResponse({
      database: 'timeweb',
      company: companies,
      clientCount: parseInt(clients.rows[0].count),
      serviceCount: parseInt(services.rows[0].count)
    });
  }
  // ... existing Supabase health check
  ```

**Estimated Time:** 1 hour

---

## Day 6: Testing with Both Backends (5 tasks)

### Task 2.10: Create Comparison Test Suite
- [ ] Create file `tests/repositories/comparison/DataLayerComparison.test.js`
- [ ] Test all 21 methods comparing Supabase vs Repository results
- [ ] Test pattern:
  ```javascript
  test('getClientByPhone returns same result', async () => {
    // Force Supabase
    process.env.USE_REPOSITORY_PATTERN = 'false';
    const supabaseLayer = new SupabaseDataLayer();
    const supabaseResult = await supabaseLayer.getClientByPhone('89686484488');

    // Force Repository
    process.env.USE_REPOSITORY_PATTERN = 'true';
    const repositoryLayer = new SupabaseDataLayer();
    const repositoryResult = await repositoryLayer.getClientByPhone('89686484488');

    // Compare
    expect(repositoryResult.success).toBe(supabaseResult.success);
    expect(repositoryResult.data).toEqual(supabaseResult.data);
  });
  ```
- [ ] Cover all 21 methods
- [ ] Test edge cases (empty results, NULL values, etc.)

**Acceptance Criteria:**
- ✅ All 21 methods tested
- ✅ Results are identical
- ✅ Edge cases covered

**Estimated Time:** 4 hours

---

### Task 2.11: Run Comparison Tests
- [ ] Execute comparison test suite
- [ ] Document any discrepancies found
- [ ] Fix issues if any
- [ ] Re-run until all pass

**Acceptance Criteria:**
- ✅ All comparison tests pass
- ✅ Zero discrepancies between backends

**Estimated Time:** 2 hours (including fixes)

---

### Task 2.12: Performance Benchmarking
- [ ] Create file `scripts/benchmark-performance.js`
- [ ] Benchmark all 21 methods (100 iterations each)
- [ ] Measure: avg, min, max, p95 latency
- [ ] Run with Supabase: `USE_REPOSITORY_PATTERN=false node scripts/benchmark-performance.js`
- [ ] Run with Repository: `USE_REPOSITORY_PATTERN=true node scripts/benchmark-performance.js`
- [ ] Compare results
- [ ] Document performance gains

**Expected Results:**
- Supabase: ~25-60ms average
- Repository: ~6-11ms average
- Improvement: 4-10x faster

**Acceptance Criteria:**
- ✅ Repository >= Supabase performance
- ✅ No performance regressions
- ✅ Results documented

**Estimated Time:** 2 hours

---

### Task 2.13: Update data-loader.js Testing
- [ ] Test AI Admin v2 with Repository Pattern:
  - [ ] Set `USE_REPOSITORY_PATTERN=true` in local .env
  - [ ] Send test message to WhatsApp bot
  - [ ] Verify context loading works
  - [ ] Verify booking commands work
  - [ ] Check logs for errors
- [ ] Test with Supabase (rollback test):
  - [ ] Set `USE_REPOSITORY_PATTERN=false`
  - [ ] Repeat tests
  - [ ] Verify same behavior

**Acceptance Criteria:**
- ✅ AI Admin works with both backends
- ✅ No functional differences
- ✅ Rollback tested and works

**Estimated Time:** 2 hours

---

### Task 2.14: Code Review - SupabaseDataLayer Changes
- [ ] Review all 21 method updates
- [ ] Check for:
  - [ ] Feature flag consistency
  - [ ] Validation preserved
  - [ ] Error handling consistent
  - [ ] No hardcoded values
- [ ] Run linter
- [ ] Get team review approval

**Estimated Time:** 1 hour

---

## Day 7: Production Deployment Prep (5 tasks)

### Task 2.15: Create Migration Documentation
- [ ] Create `docs/REPOSITORY_PATTERN_GUIDE.md`:
  - [ ] API documentation for all repositories
  - [ ] Usage examples
  - [ ] Migration mapping (Supabase → Repository)
- [ ] Create `docs/MIGRATION_RUNBOOK.md`:
  - [ ] Step-by-step cutover procedure
  - [ ] Environment variable changes
  - [ ] Monitoring checklist
- [ ] Create `docs/ROLLBACK_PROCEDURES.md`:
  - [ ] Emergency rollback steps
  - [ ] Validation after rollback

**Estimated Time:** 2 hours

---

### Task 2.16: Create Monitoring Scripts
- [ ] Create `scripts/monitor-database.sh`:
  - [ ] Query performance metrics
  - [ ] Connection pool stats
  - [ ] Error rate tracking
- [ ] Create `scripts/migration-dashboard.sh`:
  - [ ] Real-time monitoring dashboard
  - [ ] Shows current backend, errors, performance

**Estimated Time:** 1.5 hours

---

### Task 2.17: Update Environment Variables
- [ ] Document production .env changes:
  ```bash
  # Phase 2 deployment (Repository Pattern disabled initially)
  USE_REPOSITORY_PATTERN=false
  USE_LEGACY_SUPABASE=true
  ```
- [ ] Create .env.example with all flags
- [ ] Update deployment documentation

**Estimated Time:** 30 minutes

---

### Task 2.18: Deploy to Production (Disabled)
- [ ] Create feature branch: `feature/database-migration-phase2`
- [ ] Merge to main (after code review)
- [ ] Deploy to production:
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
  cd /opt/ai-admin
  git pull origin main
  pm2 restart all
  ```
- [ ] Verify deployment:
  - [ ] Application starts successfully
  - [ ] Uses Supabase (Repository Pattern disabled)
  - [ ] No errors in logs
- [ ] Monitor for 24 hours

**Acceptance Criteria:**
- ✅ Deployment successful
- ✅ Application runs with Supabase
- ✅ Repository Pattern code deployed but disabled
- ✅ No errors for 24 hours

**Estimated Time:** 2 hours (including monitoring)

---

## Phase 2 Final Checkpoint ✅

**Tasks Completed:** 18
**Files Updated:**
- ✅ `SupabaseDataLayer.js` (all 21 methods)
- ✅ `config/database-flags.js` (new)

**Files Created:**
- ✅ Comparison tests
- ✅ Benchmark scripts
- ✅ Monitoring scripts
- ✅ Documentation (3 files)

**Success Criteria:**
- [ ] All 21 methods support both backends
- [ ] Comparison tests show identical results
- [ ] Performance benchmarks: Repository >= Supabase
- [ ] Production deployment successful (Repository disabled)
- [ ] 24-hour monitoring clean
- [ ] Rollback procedure tested
- [ ] Ready to proceed to Phase 3

---

# Phase 3: Data Migration ⬜

**Timeline:** 3-5 days (Nov 21-25)
**Risk:** High (data integrity critical)
**Deliverables:** All data migrated to Timeweb + validation

## Day 8: Export Data (4 tasks)

### Task 3.1: Create Export Script
- [ ] Create file `scripts/export-supabase-data.js`
- [ ] Implement export for 8 tables:
  - [ ] companies
  - [ ] clients
  - [ ] services
  - [ ] staff
  - [ ] staff_schedules
  - [ ] bookings
  - [ ] dialog_contexts
  - [ ] reminders
- [ ] Export to JSON files in `exports/` directory
- [ ] Create metadata.json with export timestamp and row counts

**Acceptance Criteria:**
- ✅ Script exports all 8 tables
- ✅ JSON files valid and readable
- ✅ Metadata file created

**Estimated Time:** 3 hours

---

### Task 3.2: Run Export Script
- [ ] Execute: `node scripts/export-supabase-data.js`
- [ ] Verify output:
  - [ ] All 8 JSON files created
  - [ ] Row counts match Supabase
  - [ ] No errors in logs
- [ ] Backup export files:
  - [ ] Copy to safe location
  - [ ] Create zip archive

**Acceptance Criteria:**
- ✅ Export successful
- ✅ ~1,600 records exported
- ✅ Backup created

**Estimated Time:** 30 minutes

---

### Task 3.3: Validate Export Data
- [ ] Check JSON file integrity:
  - [ ] All files parse without errors
  - [ ] No truncated data
  - [ ] Special characters preserved (Russian text)
- [ ] Spot check critical records:
  - [ ] Company 962302 present
  - [ ] Test client 89686484488 present
  - [ ] Recent bookings present

**Acceptance Criteria:**
- ✅ All JSON files valid
- ✅ Critical records present
- ✅ No data corruption

**Estimated Time:** 1 hour

---

## Day 9: Import Data (4 tasks)

### Task 3.4: Create Import Script
- [ ] Create file `scripts/import-timeweb-data.js`
- [ ] Implement bulk import with ON CONFLICT:
  ```javascript
  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${valuesList}
    ON CONFLICT (id) DO UPDATE SET
      ${updateSet}
  `;
  ```
- [ ] Import tables in correct order:
  1. companies (referenced by others)
  2. clients
  3. services
  4. staff
  5. staff_schedules
  6. bookings
  7. dialog_contexts
  8. reminders

**Acceptance Criteria:**
- ✅ Script handles all 8 tables
- ✅ Foreign key constraints satisfied
- ✅ Upsert handles existing Baileys data

**Estimated Time:** 3 hours

---

### Task 3.5: Run Import Script
- [ ] Execute: `node scripts/import-timeweb-data.js`
- [ ] Monitor progress:
  - [ ] Watch for errors
  - [ ] Check row counts as they import
- [ ] Verify completion:
  - [ ] All 8 tables imported
  - [ ] Row counts match export
  - [ ] No errors in logs

**Acceptance Criteria:**
- ✅ Import successful
- ✅ ~1,600 records imported
- ✅ No errors

**Estimated Time:** 30 minutes

---

### Task 3.6: Validate Import Data
- [ ] Check row counts:
  - [ ] Query Timeweb for each table
  - [ ] Compare with export metadata
- [ ] Spot check records:
  - [ ] Company 962302 data matches
  - [ ] Client 89686484488 data matches
  - [ ] Recent bookings data matches
- [ ] Check foreign keys:
  - [ ] All bookings reference valid clients
  - [ ] All clients reference valid company

**Acceptance Criteria:**
- ✅ Row counts match 100%
- ✅ Spot checks pass
- ✅ Foreign keys valid

**Estimated Time:** 1 hour

---

## Day 10: Data Validation (4 tasks)

### Task 3.7: Create Validation Script
- [ ] Create file `scripts/validate-migration.js`
- [ ] Compare Supabase vs Timeweb:
  - [ ] Row counts for all 8 tables
  - [ ] Sample records (10 per table)
  - [ ] Critical fields (IDs, timestamps, names)
- [ ] Output comparison report
- [ ] Exit code 0 if valid, 1 if issues

**Acceptance Criteria:**
- ✅ Script compares all tables
- ✅ Reports any discrepancies
- ✅ Clear pass/fail output

**Estimated Time:** 2 hours

---

### Task 3.8: Run Validation Script
- [ ] Execute: `node scripts/validate-migration.js`
- [ ] Review output:
  - [ ] All tables validated
  - [ ] Row counts match
  - [ ] Sample records match
- [ ] If issues found:
  - [ ] Document discrepancies
  - [ ] Investigate root cause
  - [ ] Re-run import if needed

**Acceptance Criteria:**
- ✅ Validation passes
- ✅ 100% data consistency
- ✅ Zero discrepancies

**Estimated Time:** 1 hour (plus fixes if needed)

---

### Task 3.9: Schedule Hourly Validation
- [ ] Add to crontab (or equivalent):
  ```bash
  0 * * * * cd /opt/ai-admin && node scripts/validate-migration.js >> /var/log/migration-validation.log
  ```
- [ ] Run for 48 hours
- [ ] Alert if any validation fails

**Acceptance Criteria:**
- ✅ Automated validation running
- ✅ Logs captured
- ✅ Alerts configured

**Estimated Time:** 30 minutes

---

## Phase 3 Final Checkpoint ✅

**Tasks Completed:** 12
**Files Created:**
- ✅ `scripts/export-supabase-data.js`
- ✅ `scripts/import-timeweb-data.js`
- ✅ `scripts/validate-migration.js`
- ✅ `exports/*.json` (8 data files + metadata)

**Data Migrated:**
- ✅ ~1,600 records across 8 tables
- ✅ 100% data consistency validated

**Success Criteria:**
- [ ] All tables exported
- [ ] All data imported to Timeweb
- [ ] Validation script confirms 100% match
- [ ] No data corruption
- [ ] Hourly validation running
- [ ] Ready to proceed to Phase 4

---

# Phase 4: Testing & Validation ⬜

**Timeline:** 2-3 days + 48h monitoring (Nov 26-29)
**Risk:** Medium (final validation before cutover)
**Deliverables:** Production tested with Repository Pattern

## Day 13: Enable in Production (10 tasks)

### Task 4.1: Production Environment Update
- [ ] SSH to production server
- [ ] Backup current .env: `cp .env .env.backup`
- [ ] Update .env:
  ```bash
  USE_REPOSITORY_PATTERN=true   # Enable repositories
  USE_LEGACY_SUPABASE=true      # Keep fallback
  LOG_DATABASE_CALLS=true       # Enable logging
  ```
- [ ] Restart application: `pm2 restart all`
- [ ] Verify restart successful: `pm2 status`

**Acceptance Criteria:**
- ✅ Environment variables updated
- ✅ Application restarted successfully
- ✅ No startup errors

**Estimated Time:** 30 minutes

---

### Task 4.2: Smoke Tests
- [ ] Test 1: WhatsApp Bot Message
  - [ ] Send: "Привет" to +79936363848
  - [ ] Expected: Bot responds within 10 seconds
  - [ ] Verify: Context loaded from Timeweb
- [ ] Test 2: Client Query
  - [ ] Query client 89686484488
  - [ ] Expected: Data returned
  - [ ] Verify: Data matches Supabase
- [ ] Test 3: Booking Creation
  - [ ] Create test booking
  - [ ] Expected: Saved to Timeweb
  - [ ] Verify: Can retrieve booking
- [ ] Test 4: Health Check
  - [ ] `curl http://localhost:3000/api/health`
  - [ ] Expected: {"status": "ok", "database": "timeweb"}

**Acceptance Criteria:**
- ✅ All 4 smoke tests pass
- ✅ Responses within expected time
- ✅ Data correct

**Estimated Time:** 1 hour

---

### Task 4.3: Functional Test - New Client Booking Flow
- [ ] Send WhatsApp message from new number (test number)
- [ ] Bot loads company info
- [ ] Request service list
- [ ] Select service
- [ ] View staff schedule
- [ ] Complete booking
- [ ] Verify booking in Timeweb database
- [ ] Check all logs for errors

**Acceptance Criteria:**
- ✅ End-to-end booking works
- ✅ All data from/to Timeweb
- ✅ No errors in logs

**Estimated Time:** 30 minutes

---

### Task 4.4: Functional Test - Existing Client
- [ ] Send message from known number (89686484488)
- [ ] Bot recognizes client
- [ ] Request upcoming appointments
- [ ] Verify appointments from Timeweb
- [ ] Cancel test booking
- [ ] Verify cancellation persisted

**Acceptance Criteria:**
- ✅ Client recognition works
- ✅ Appointments loaded correctly
- ✅ Updates persist to Timeweb

**Estimated Time:** 30 minutes

---

### Task 4.5: Functional Test - Sync Scripts
- [ ] Manually trigger clients sync: `node src/sync/clients-sync.js`
- [ ] Verify writes to Timeweb
- [ ] Manually trigger services sync: `node src/sync/services-sync.js`
- [ ] Verify writes to Timeweb
- [ ] Check for errors in logs
- [ ] Compare Timeweb vs Supabase data

**Acceptance Criteria:**
- ✅ Sync scripts work with Timeweb
- ✅ Data written correctly
- ✅ No errors

**Estimated Time:** 1 hour

---

### Task 4.6: Performance Benchmarking
- [ ] Run benchmark script: `node scripts/benchmark-performance.js`
- [ ] Capture metrics:
  - [ ] Average query time
  - [ ] p95 latency
  - [ ] p99 latency
- [ ] Compare with baseline (from Phase 2)
- [ ] Expected: 4-10x faster than Supabase
- [ ] Document results

**Acceptance Criteria:**
- ✅ Performance meets expectations
- ✅ No regressions
- ✅ Results documented

**Estimated Time:** 1 hour

---

### Task 4.7: 1-Hour Intensive Monitoring
- [ ] Monitor PM2 logs continuously: `pm2 logs ai-admin-worker-v2`
- [ ] Watch for:
  - [ ] Database errors
  - [ ] Connection timeouts
  - [ ] Slow queries (>100ms)
  - [ ] Unexpected NULL results
- [ ] Check metrics every 15 minutes:
  - [ ] Error count: Target 0
  - [ ] Average query time: Target <10ms
  - [ ] Pool utilization: Target <80%
- [ ] Document any issues

**Acceptance Criteria:**
- ✅ Zero critical errors
- ✅ Performance stable
- ✅ No connection issues

**Estimated Time:** 1 hour

---

### Task 4.8: Run Validation Script
- [ ] Execute: `node scripts/validate-migration.js`
- [ ] Verify 100% match between Supabase and Timeweb
- [ ] If discrepancies:
  - [ ] Investigate cause
  - [ ] Fix if needed
  - [ ] Re-validate

**Acceptance Criteria:**
- ✅ Validation passes
- ✅ Zero discrepancies
- ✅ Data consistency maintained

**Estimated Time:** 30 minutes

---

### Task 4.9: 48-Hour Monitoring Period
- [ ] Continue monitoring for 48 hours
- [ ] Check logs every 6 hours
- [ ] Run validation script at:
  - [ ] 12 hours
  - [ ] 24 hours
  - [ ] 36 hours
  - [ ] 48 hours
- [ ] Monitor metrics:
  - [ ] Error rate
  - [ ] Query performance
  - [ ] Connection pool
- [ ] Create monitoring log

**Acceptance Criteria:**
- ✅ 48 hours with zero critical errors
- ✅ Performance stable
- ✅ Data consistency maintained

**Estimated Time:** 48 hours (passive monitoring)

---

### Task 4.10: Go/No-Go Decision
- [ ] Review all test results
- [ ] Check success criteria:
  - [ ] All functional tests passed
  - [ ] Performance >= baseline (target: 4-10x faster)
  - [ ] Zero critical errors in 48h
  - [ ] Data consistency 100%
  - [ ] Team confidence high
- [ ] If GO:
  - [ ] Document decision
  - [ ] Proceed to Phase 5
- [ ] If NO-GO:
  - [ ] Analyze root cause
  - [ ] Fix issues
  - [ ] Repeat Phase 4
  - [ ] Consider rollback if unfixable

**Acceptance Criteria:**
- ✅ Decision documented
- ✅ All stakeholders agree
- ✅ Ready for Phase 5 (if GO)

**Estimated Time:** 1 hour

---

## Phase 4 Final Checkpoint ✅

**Tasks Completed:** 10
**Monitoring Duration:** 48 hours

**Success Criteria:**
- [ ] All functional tests passed
- [ ] Performance benchmarks show 4-10x improvement
- [ ] 48-hour monitoring clean (zero errors)
- [ ] Data consistency validated
- [ ] Go decision approved
- [ ] Ready to proceed to Phase 5

---

# Phase 5: Production Cutover ⬜

**Timeline:** 2-4 hours (Early morning recommended)
**Risk:** Medium (final switch)
**Deliverables:** Timeweb as primary database

## Cutover Day: 02:00-06:00 Window (8 tasks)

### Task 5.1: Pre-Cutover Checklist
- [ ] Verify Phase 4 complete:
  - [ ] All tests passed
  - [ ] 48-hour monitoring clean
  - [ ] Go decision documented
- [ ] Team availability:
  - [ ] Migration lead on call
  - [ ] Backend engineer available
  - [ ] Support team briefed
- [ ] Rollback ready:
  - [ ] Rollback procedure tested
  - [ ] .env.backup exists
  - [ ] Team knows rollback steps
- [ ] Backup current Supabase data:
  - [ ] Run export script one final time
  - [ ] Save to safe location

**Acceptance Criteria:**
- ✅ All checks pass
- ✅ Team ready
- ✅ Rollback tested

**Estimated Time:** 30 minutes

---

### Task 5.2: Configuration Update
- [ ] SSH to production
- [ ] Update .env:
  ```bash
  # Mark Timeweb as primary
  USE_REPOSITORY_PATTERN=true
  TIMEWEB_IS_PRIMARY=true
  USE_LEGACY_SUPABASE=true  # Keep fallback initially
  ```
- [ ] Restart application: `pm2 restart all`
- [ ] Watch startup logs: `pm2 logs --lines 100`

**Acceptance Criteria:**
- ✅ Application starts successfully
- ✅ No errors in startup logs
- ✅ First queries use Timeweb

**Estimated Time:** 15 minutes

---

### Task 5.3: Immediate Smoke Tests
- [ ] Test 1: Health Check
  - [ ] `curl http://localhost:3000/api/health`
  - [ ] Expected: {"database": "timeweb", "status": "ok"}
- [ ] Test 2: WhatsApp Message
  - [ ] Send: "Привет"
  - [ ] Expected: Response within 10s
- [ ] Test 3: Client Query
  - [ ] Query test client
  - [ ] Expected: Data returned
- [ ] Test 4: Booking Creation
  - [ ] Create test booking
  - [ ] Expected: Saved to Timeweb

**If any test fails:** Immediate rollback to Supabase

**Acceptance Criteria:**
- ✅ All smoke tests pass
- ✅ Responses within expected time
- ✅ Data correct

**Estimated Time:** 30 minutes

---

### Task 5.4: 1-Hour Intensive Monitoring
- [ ] Monitor PM2 logs continuously
- [ ] Watch for:
  - [ ] Database errors
  - [ ] Query failures
  - [ ] Timeout errors
  - [ ] NULL results
  - [ ] Performance issues
- [ ] Check metrics every 15 minutes:
  - [ ] Error count: `pm2 logs --err --lines 100 | grep -i error | wc -l`
  - [ ] Query time: Check `[DB]` logs
  - [ ] Pool stats: Check `Pool:` logs
- [ ] If issues detected:
  - [ ] Assess severity
  - [ ] Rollback if critical

**Acceptance Criteria:**
- ✅ Zero critical errors
- ✅ Query times <20ms
- ✅ Pool utilization <80%

**Estimated Time:** 1 hour

---

### Task 5.5: Functional Validation
- [ ] Test all user flows:
  - [ ] New client booking
  - [ ] Existing client booking
  - [ ] Booking cancellation
  - [ ] Service search
  - [ ] Staff schedule query
- [ ] Test sync scripts:
  - [ ] Clients sync
  - [ ] Services sync
  - [ ] Schedules sync
- [ ] Verify all writes persist to Timeweb

**Acceptance Criteria:**
- ✅ All flows work
- ✅ No errors
- ✅ Data persists correctly

**Estimated Time:** 1 hour

---

### Task 5.6: Performance Validation
- [ ] Run benchmark script
- [ ] Compare with Phase 4 baseline
- [ ] Expected: Similar or better performance
- [ ] Check for any regressions

**Acceptance Criteria:**
- ✅ Performance meets expectations
- ✅ No regressions

**Estimated Time:** 30 minutes

---

### Task 5.7: 24-Hour Monitoring
- [ ] Continue monitoring for 24 hours
- [ ] Check logs every 6 hours
- [ ] Run validation script at:
  - [ ] 6 hours
  - [ ] 12 hours
  - [ ] 18 hours
  - [ ] 24 hours
- [ ] Monitor:
  - [ ] Error rate (<0.01%)
  - [ ] Query performance (<20ms avg)
  - [ ] Connection pool (<80%)
  - [ ] Data consistency (100%)

**Acceptance Criteria:**
- ✅ 24 hours stable operation
- ✅ All metrics within targets

**Estimated Time:** 24 hours (passive)

---

### Task 5.8: Final Success Report
- [ ] Document migration results:
  - [ ] Performance improvements
  - [ ] Data integrity (zero loss)
  - [ ] Downtime (expected: 0)
  - [ ] Issues encountered
  - [ ] Lessons learned
- [ ] Update team on success
- [ ] Celebrate! 🎉

**Acceptance Criteria:**
- ✅ Report complete
- ✅ Team notified
- ✅ Success confirmed

**Estimated Time:** 1 hour

---

## Phase 5 Final Checkpoint ✅

**Tasks Completed:** 8
**Migration Status:** COMPLETE

**Success Criteria:**
- [ ] Cutover executed successfully
- [ ] All smoke tests passed
- [ ] 1-hour monitoring clean
- [ ] 24-hour monitoring stable
- [ ] Performance meets expectations (4-10x faster)
- [ ] Zero data loss
- [ ] User experience unchanged (or better)
- [ ] 🎉 MIGRATION COMPLETE! 🎉

---

## Post-Migration (After 7 days)

### Optional: Disable Supabase Fallback
- [ ] After 7 days of stable operation:
  - [ ] Update .env: `USE_LEGACY_SUPABASE=false`
  - [ ] Restart application
  - [ ] Monitor for 24 hours
- [ ] Keep Supabase project active (free tier)
- [ ] Consider final export for archive
- [ ] Can delete Supabase after 30+ days if desired

---

## Summary

**Total Tasks:** 73
**Total Duration:** ~3 weeks (21 days)
**Total Code:** ~1,400 lines (500 production + 800 test)
**Data Migrated:** ~1,600 records
**Performance Gain:** 4-10x faster
**Downtime:** 0 minutes
**Risk:** Medium (with comprehensive mitigation)

**Key Success Factors:**
1. Repository Pattern abstraction
2. Comprehensive testing
3. Feature flags for rollback
4. Gradual migration
5. Continuous monitoring

---

**Last Updated:** 2025-11-10
**Document Version:** 1.0
**Status:** Ready to execute
**Next Action:** Start Phase 1, Task 1.1
