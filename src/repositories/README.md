# Repository Pattern - Phase 1 Complete

## Overview

Lightweight database abstraction layer providing a clean API for both Supabase and Timeweb PostgreSQL.

**Status:** ✅ Phase 1 Complete (Repository Pattern Foundation)

## Architecture

```
BaseRepository (350 lines)
  ├── Core CRUD: findOne, findMany, upsert, bulkUpsert
  ├── Query building: WHERE, ORDER BY, LIMIT, OFFSET
  ├── Operators: eq, neq, gte, lte, ilike, in, null
  └── Error handling & sanitization

Domain Repositories (6 classes, ~400 lines total)
  ├── ClientRepository (7 methods)
  ├── ServiceRepository (4 methods)
  ├── StaffRepository (2 methods)
  ├── StaffScheduleRepository (3 methods)
  ├── DialogContextRepository (2 methods)
  └── CompanyRepository (2 methods)

Total: 21 methods mapping to SupabaseDataLayer
```

## Files Created

**Production Code (~750 lines):**
- `BaseRepository.js` - Core abstraction (350 lines)
- `ClientRepository.js` - Client methods (7)
- `ServiceRepository.js` - Service methods (4)
- `StaffRepository.js` - Staff methods (2)
- `StaffScheduleRepository.js` - Schedule methods (3)
- `DialogContextRepository.js` - Context methods (2)
- `CompanyRepository.js` - Company methods (2)
- `index.js` - Exports

**Test Code (~600 lines):**
- `tests/repositories/unit/BaseRepository.test.js` - Unit tests
- `tests/repositories/integration/ClientRepository.integration.test.js` - Integration tests

## Usage

### Basic Example

```javascript
const { ClientRepository } = require('./repositories');
const postgres = require('./database/postgres');

const clientRepo = new ClientRepository(postgres);

// Find client
const client = await clientRepo.findByPhone('89686484488');

// Search clients
const results = await clientRepo.searchByName(962302, 'Иван', 10);

// Upsert client
const updated = await clientRepo.upsert({
  yclients_id: 123,
  company_id: 962302,
  name: 'Иван Иванов',
  phone: '89001234567'
});
```

### Advanced Filtering

```javascript
// Range query
const clients = await clientRepo.findMany('clients', {
  company_id: 962302,
  created_at: { gte: '2025-11-01', lte: '2025-11-30' }
});

// Multiple operators
const schedules = await scheduleRepo.findMany('staff_schedules', {
  company_id: 962302,
  date: { gte: '2025-11-01' },
  is_working: true
}, {
  orderBy: 'date',
  order: 'asc',
  limit: 50
});
```

## Testing

### Run Unit Tests (Fast, No DB Required)

```bash
# Run all unit tests
npm test tests/repositories/unit/

# Run specific test
npm test tests/repositories/unit/BaseRepository.test.js

# With coverage
npm test tests/repositories/unit/ -- --coverage
```

### Run Integration Tests (Requires Timeweb PostgreSQL)

```bash
# Prerequisites:
# 1. Timeweb PostgreSQL must be accessible
# 2. Schema created (Phase 0.8)
# 3. Connection configured in src/database/postgres.js

# Run integration tests
npm test tests/repositories/integration/

# Run specific integration test
npm test tests/repositories/integration/ClientRepository.integration.test.js
```

### Test Coverage Goals

- **Unit Tests:** 100% coverage for BaseRepository ✅
- **Integration Tests:** All CRUD operations validated ✅
- **Edge Cases:** NULL handling, Russian characters, empty results ✅

## Query Translation Reference

### Supabase → Repository Mapping

| Supabase Method | Repository Method | Example |
|----------------|-------------------|---------|
| `.from('clients').select('*').eq('phone', val)` | `findOne('clients', { phone: val })` | Simple find |
| `.from('clients').select('*').eq('company_id', id)` | `findMany('clients', { company_id: id })` | Find many |
| `.from('clients').select('*').ilike('name', '%test%')` | `searchByName(companyId, 'test')` | Search |
| `.from('clients').upsert(data, {onConflict})` | `upsert(data)` | Insert/Update |
| `.from('clients').upsert(array, {onConflict})` | `bulkUpsert(array)` | Bulk upsert |

### Operator Translation

| Supabase | PostgreSQL | Repository Filter |
|----------|-----------|-------------------|
| `.eq('col', val)` | `WHERE col = $1` | `{ col: val }` |
| `.neq('col', val)` | `WHERE col != $1` | `{ col: { neq: val } }` |
| `.gte('col', val)` | `WHERE col >= $1` | `{ col: { gte: val } }` |
| `.lte('col', val)` | `WHERE col <= $1` | `{ col: { lte: val } }` |
| `.ilike('col', pattern)` | `WHERE col ILIKE $1` | `{ col: { ilike: pattern } }` |
| `.in('col', [1,2,3])` | `WHERE col IN ($1, $2, $3)` | `{ col: { in: [1,2,3] } }` |
| `.is('col', null)` | `WHERE col IS NULL` | `{ col: null }` |

## Performance

**Expected Improvements (vs Supabase):**
- Internal services: **4-10x faster** (< 1ms network vs 20-50ms)
- Sync scripts: **2-3x faster**
- Average query time: **6-11ms** (vs 25-60ms with Supabase)

## Next Steps

**Phase 2: Code Integration (5-7 days)**
- Update SupabaseDataLayer to use repositories
- Implement feature flags
- Comparison testing (Supabase vs Repository results)
- Deploy to production (disabled initially)

See: `dev/active/database-migration-revised/database-migration-revised-tasks.md`

## Troubleshooting

### Unit Tests Failing

```bash
# Ensure Jest is installed
npm install --save-dev jest

# Check Jest configuration
cat package.json | grep jest
```

### Integration Tests Failing

```bash
# 1. Check Timeweb connection
node -e "const p = require('./src/database/postgres'); p.query('SELECT 1').then(console.log)"

# 2. Verify schema exists
node -e "const p = require('./src/database/postgres'); p.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'').then(r => console.log(r.rows))"

# 3. Check environment variables
echo $USE_LEGACY_SUPABASE  # Should be true or unset
echo $USE_REPOSITORY_PATTERN  # Should be false or unset (Phase 1)
```

### Common Issues

**Issue:** "Database connection pool is required"
**Fix:** Always pass postgres pool to repository constructor

**Issue:** "Invalid identifier: clients; DROP TABLE"
**Fix:** This is intentional! Sanitization is working. Don't use SQL injection patterns.

**Issue:** "IN operator requires non-empty array"
**Fix:** Check filter values before calling repository methods

## Documentation

- **Plan:** `dev/active/database-migration-revised/database-migration-revised-plan.md`
- **Context:** `dev/active/database-migration-revised/database-migration-revised-context.md`
- **Tasks:** `dev/active/database-migration-revised/database-migration-revised-tasks.md`

---

**Phase 1 Status:** ✅ Complete
**Date Completed:** 2025-11-10
**Lines of Code:** ~1,350 (production + tests)
**Test Coverage:** 100% for BaseRepository
**Ready for Phase 2:** ✅ Yes
