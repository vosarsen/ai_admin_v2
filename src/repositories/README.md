# Repository Pattern - Database Layer

## Overview

Database abstraction layer for Timeweb PostgreSQL using Repository Pattern.

**Status:** ✅ Production (Migration complete November 2025)

## Architecture

```
BaseRepository (750+ lines)
  ├── Core CRUD: findOne, findMany, upsert, bulkUpsert, syncBulkUpsert
  ├── Query building: WHERE, ORDER BY, LIMIT, OFFSET
  ├── Operators: eq, neq, gte, lte, ilike, in, null
  ├── Sentry error tracking
  └── Error handling & sanitization

Domain Repositories (7 classes, ~1,200 lines total)
  ├── ClientRepository (9 methods)
  ├── ServiceRepository (5 methods)
  ├── StaffRepository (5 methods)
  ├── StaffScheduleRepository (5 methods)
  ├── DialogContextRepository (4 methods)
  ├── CompanyRepository (2 methods)
  └── BookingRepository (5 methods)

Total: 35+ methods with full Sentry integration
```

## Files

**Production Code:**
- `BaseRepository.js` - Core abstraction with Sentry
- `ClientRepository.js` - Client methods
- `ServiceRepository.js` - Service methods
- `StaffRepository.js` - Staff methods
- `StaffScheduleRepository.js` - Schedule methods
- `DialogContextRepository.js` - Context methods
- `CompanyRepository.js` - Company methods
- `BookingRepository.js` - Booking methods
- `index.js` - Exports

**Test Code:**
- `tests/repositories/unit/BaseRepository.test.js` - Unit tests
- `tests/repositories/integration/*.test.js` - Integration tests (73 tests)

## Usage

### Basic Example

```javascript
const { ClientRepository } = require('./repositories');
const postgres = require('./database/postgres');

const clientRepo = new ClientRepository(postgres);

// Find client by phone
const client = await clientRepo.findByPhone('89686484488');

// Find by raw phone (with +)
const client2 = await clientRepo.findByRawPhone('+79686484488', 962302);

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

### Run Unit Tests

```bash
npm test tests/repositories/unit/
```

### Run Integration Tests

```bash
# Requires connection to Timeweb PostgreSQL
RUN_INTEGRATION_TESTS=true npx jest tests/repositories/integration/ --no-coverage --forceExit
```

### Test Coverage

- **Unit Tests:** 100% coverage for BaseRepository
- **Integration Tests:** 73 passing tests (all CRUD operations)
- **Edge Cases:** NULL handling, Russian characters, empty results

## Operator Reference

| Operator | PostgreSQL | Repository Filter |
|----------|-----------|-------------------|
| Equal | `WHERE col = $1` | `{ col: val }` |
| Not Equal | `WHERE col != $1` | `{ col: { neq: val } }` |
| Greater/Equal | `WHERE col >= $1` | `{ col: { gte: val } }` |
| Less/Equal | `WHERE col <= $1` | `{ col: { lte: val } }` |
| ILIKE | `WHERE col ILIKE $1` | `{ col: { ilike: pattern } }` |
| IN | `WHERE col IN (...)` | `{ col: { in: [...] } }` |
| NULL | `WHERE col IS NULL` | `{ col: null }` |

## Sentry Integration

All repositories have built-in Sentry error tracking:

```javascript
// Errors are automatically captured with:
Sentry.captureException(error, {
  tags: {
    component: 'repository',
    table: 'clients',
    operation: 'findOne'
  },
  extra: {
    filters: { phone: '...' },
    duration: '15ms'
  }
});
```

## Troubleshooting

### Connection Issues

```bash
# Test connection
node -e "const p = require('./src/database/postgres'); p.query('SELECT 1').then(console.log)"

# Verify schema
node -e "const p = require('./src/database/postgres'); p.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'').then(r => console.log(r.rows))"
```

### Common Issues

**Issue:** "Database connection pool is required"
**Fix:** Always pass postgres pool to repository constructor

**Issue:** "Invalid identifier"
**Fix:** Sanitization is working correctly - don't use SQL injection patterns

**Issue:** "IN operator requires non-empty array"
**Fix:** Check filter values before calling repository methods

## Documentation

- **Database:** `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md`
- **Migration:** `dev/completed/database-migration-supabase-timeweb/`
- **Code Review:** `dev/active/database-code-review/`

---

**Status:** ✅ Production
**Migration Completed:** November 2025
**Test Coverage:** 73 integration tests passing
