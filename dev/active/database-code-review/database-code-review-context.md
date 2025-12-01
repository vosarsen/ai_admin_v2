# Database Code Review - Context

**Last Updated:** 2025-12-01

---

## Key Discovery

### The staff_id vs yclients_staff_id Bug

**Symptom:** User asked "Бари работает сегодня?" and got incorrect response saying Бари doesn't work.

**Root Cause:** SQL queries used `staff_id` but actual column is `yclients_staff_id`.

**Error in logs:**
```
[DB Error] column "staff_id" does not exist
query: SELECT * FROM staff_schedules WHERE date = $1 AND staff_id = $2
```

**Fixed in:**
- command-handler.js (6 places)
- data-loader.js (1 place)
- formatter.js (3 places)

---

## Database Schema Reference

### staff_schedules Table
```sql
id                | bigint (PK)
yclients_staff_id | integer (FK to staff.yclients_id)
staff_name        | varchar
date              | date
is_working        | boolean
work_start        | time
work_end          | time
working_hours     | varchar
last_updated      | timestamp
has_booking_slots | boolean
company_id        | integer
```

### staff Table
```sql
id               | integer (PK)
yclients_id      | integer (YClients external ID)
company_id       | integer
name             | varchar
specialization   | varchar
position         | varchar
is_active        | boolean
is_bookable      | boolean
rating           | numeric
declensions      | jsonb
...
```

### bookings Table
```sql
id                 | uuid (PK)
yclients_record_id | integer (YClients external ID)
company_id         | integer
client_phone       | varchar
client_yclients_id | integer
staff_id           | integer (NOTE: This one IS correct!)
staff_name         | varchar
services           | array
datetime           | timestamp
...
```

---

## Key Files

### Database Layer
- `src/database/postgres.js` - Connection pool, query(), getClient(), transaction()

### Repositories (17 total)
- `src/repositories/BaseRepository.js` - Foundation class
- `src/repositories/StaffScheduleRepository.js` - Staff schedules
- `src/repositories/StaffRepository.js` - Staff members
- `src/repositories/ClientRepository.js` - Clients
- `src/repositories/BookingRepository.js` - Bookings
- `src/repositories/ServiceRepository.js` - Services
- `src/repositories/CompanyRepository.js` - Companies

### Sync Scripts (9 total)
- `src/sync/schedules-sync.js` - Schedules from YClients
- `src/sync/staff-sync.js` - Staff from YClients
- `src/sync/services-sync.js` - Services from YClients
- `src/sync/clients-sync.js` - Clients from YClients
- `src/sync/bookings-sync.js` - Bookings from YClients

### Main Application Files
- `src/services/ai-admin-v2/modules/command-handler.js` - Command execution (~2800 lines)
- `src/services/ai-admin-v2/modules/data-loader.js` - Data loading
- `src/services/ai-admin-v2/modules/formatter.js` - Response formatting

### Feature Flags
- `config/database-flags.js` - USE_REPOSITORY_PATTERN, USE_LEGACY_SUPABASE

---

## Naming Convention Mapping

| YClients API | Database Column | Code Variable |
|--------------|-----------------|---------------|
| staff.id | yclients_id (staff) | staffId, staff.yclients_id |
| staff.id | yclients_staff_id (schedules) | staffId |
| record.id | yclients_record_id | recordId, bookingId |
| client.id | yclients_id | clientId |
| service.id | yclients_id | serviceId |
| company.id | yclients_id | companyId |

---

## Known Issues (To Fix)

### 1. postgres-data-layer.js Still Uses staff_id
Location: `src/integrations/yclients/data/postgres-data-layer.js`
Line ~427: `if (!schedule.staff_id || ...)`

### 2. Some Sync Scripts May Have Issues
Need to verify:
- clients-sync.js
- bookings-sync.js
- visits-sync.js

### 3. Tests May Have Outdated Column Names
Location: `src/services/ai-admin-v2/__tests__/`

---

## Decisions Made

1. **Column naming follows database** - Code adapts to DB schema, not vice versa
2. **All access through repositories** - Direct postgres.query() to be phased out
3. **Keep yclients_ prefix** - Distinguishes external IDs from internal PKs
4. **Sentry for all errors** - No silent failures

---

## Session Notes

### Session 1 (2025-12-01)
- Discovered staff_id vs yclients_staff_id bug
- Fixed command-handler.js, data-loader.js, formatter.js
- Created this code review project
- Need to continue with full audit

---

## Quick Reference Commands

```bash
# Find all staff_id references (potential issues)
grep -rn "staff_id" src/ --include="*.js" | grep -v "yclients_staff_id"

# Find all direct postgres queries
grep -rn "postgres\.query" src/ --include="*.js"

# Check database schema
psql $DB_URL -c "\d+ staff_schedules"

# Run schedules sync manually
node -e "require('./src/sync/schedules-sync').SchedulesSync().sync()"
```

---

## Related Documentation

- `dev/completed/database-migration-supabase-timeweb/` - Migration history
- `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md` - DB overview
- `src/repositories/README.md` - Repository pattern guide
