# Infrastructure Improvements - Task Breakdown

**Last Updated:** 2025-11-11 16:05 MSK
**Status:** 4/6 complete (67%)
**Estimated Remaining:** 10-13 hours

---

## Progress Overview

```
✅ CRITICAL-1: Sentry Error Tracking         (2h) - COMPLETE
✅ CRITICAL-2: Connection Pool Optimization  (1h) - COMPLETE
✅ CRITICAL-3: Transaction Support           (3h) - COMPLETE
⏳ CRITICAL-4: Integration Tests            (8-10h) - PENDING
✅ CRITICAL-5: Error Handling Consistency   (0.5h) - COMPLETE ⚡
⏳ CRITICAL-6: Baileys Monitoring           (2-3h) - PENDING
```

---

## ✅ CRITICAL-1: Sentry Error Tracking (COMPLETE)

**Status:** ✅ Deployed to production
**Time:** 2 hours
**Commits:** `b0f0cdb`, `d7bd8b0`

### Tasks Completed

- [x] Install @sentry/node and @sentry/profiling-node packages
- [x] Create src/instrument.js with Sentry v8 initialization
- [x] Add require('dotenv').config() to instrument.js
- [x] Import instrument.js as first line in src/index.js
- [x] Import instrument.js as first line in src/workers/index-v2.js
- [x] Add Sentry to src/database/postgres.js (4 catch blocks)
  - [x] Pool error handler
  - [x] Connection check error
  - [x] query() catch block
  - [x] transaction() catch block
- [x] Add Sentry to src/repositories/BaseRepository.js (4 catch blocks)
  - [x] findOne() catch block
  - [x] findMany() catch block
  - [x] upsert() catch block
  - [x] bulkUpsert() catch block
- [x] Add Sentry to src/integrations/whatsapp/auth-state-timeweb.js (6 catch blocks)
  - [x] Load credentials catch block
  - [x] Get keys catch block
  - [x] Set keys catch block
  - [x] Save credentials catch block
  - [x] Remove auth state catch block
  - [x] Get stats catch block
- [x] Add SENTRY_DSN to .env.example
- [x] Add SENTRY_DSN to production .env
- [x] Test Sentry integration locally
- [x] Deploy to production
- [x] Restart PM2 services
- [x] Verify Sentry captures errors in production

---

## ✅ CRITICAL-2: Connection Pool Optimization (COMPLETE)

**Status:** ✅ Deployed to production
**Time:** 1 hour
**Commit:** `441252a`

### Tasks Completed

- [x] Change max connections from 20 to 3 per service
- [x] Add min: 1 to keep idle connection ready
- [x] Increase connectionTimeoutMillis from 5s to 10s
- [x] Add query_timeout: 60s for heavy queries
- [x] Add max_lifetime: 1h for connection recycling
- [x] Add connection pool monitoring events
  - [x] 'connect' event - Log new connections
  - [x] 'acquire' event - Warn if usage >80%
  - [x] 'remove' event - Log connection removal
- [x] Add POSTGRES_MAX_CONNECTIONS to .env.example
- [x] Add POSTGRES_MAX_CONNECTIONS to production .env
- [x] Test connection pool configuration
- [x] Deploy to production
- [x] Verify all services restart successfully

---

## ✅ CRITICAL-3: Transaction Support (COMPLETE)

**Status:** ✅ Deployed to production
**Time:** 3 hours
**Commits:** `b92cb08`, `eb38f85`

### Tasks Completed

- [x] Add withTransaction() method to BaseRepository
  - [x] Automatic BEGIN/COMMIT/ROLLBACK
  - [x] Sentry tracking for failed transactions
  - [x] Duration logging
  - [x] Proper client resource management
- [x] Add transactional helper methods
  - [x] _findOneInTransaction()
  - [x] _upsertInTransaction()
- [x] Create comprehensive documentation
  - [x] docs/TRANSACTION_SUPPORT.md (353 lines)
  - [x] Real-world usage examples
  - [x] Best practices guide
  - [x] Migration guide
- [x] Create test script
  - [x] scripts/test-transactions.js
  - [x] Test successful transaction (COMMIT)
  - [x] Test failed transaction (ROLLBACK)
  - [x] Test helper methods
- [x] Test locally (noted USE_LEGACY_SUPABASE=true issue)
- [x] Deploy to production
- [x] Test on production server (with real Timeweb PostgreSQL)
- [x] Verify transaction COMMIT works
- [x] Verify transaction ROLLBACK works

---

## ⏳ CRITICAL-4: Integration Tests for Production Database (PENDING)

**Status:** ⏳ Not started
**Estimated Time:** 8-10 hours
**Priority:** Medium

### Tasks Breakdown

#### Phase 1: Setup Test Infrastructure (2h)
- [ ] Create test database configuration
- [ ] Set up Jest test environment for integration tests
- [ ] Create test helpers for database cleanup
- [ ] Add RUN_INTEGRATION_TESTS environment variable
- [ ] Configure test database connection (can use production read-only or separate test DB)

#### Phase 2: BaseRepository Tests (2h)
- [ ] Create tests/repositories/BaseRepository.test.js
- [ ] Test findOne()
  - [ ] With simple filters
  - [ ] With complex filters (gte, lte, ilike, in)
  - [ ] Returns null when not found
- [ ] Test findMany()
  - [ ] With filters
  - [ ] With orderBy
  - [ ] With limit/offset
  - [ ] Returns empty array when no results
- [ ] Test upsert()
  - [ ] Creates new record
  - [ ] Updates existing record
  - [ ] Returns upserted record
- [ ] Test bulkUpsert()
  - [ ] Handles multiple records
  - [ ] Respects batch size limit (500)
  - [ ] Handles conflicts correctly
- [ ] Test withTransaction()
  - [ ] Commits on success
  - [ ] Rolls back on error
  - [ ] Releases client properly

#### Phase 3: Domain Repository Tests (3h)
- [ ] Create tests/repositories/ClientRepository.test.js
  - [ ] Test findByPhone()
  - [ ] Test findAppointments()
  - [ ] Test domain-specific methods
- [ ] Create tests/repositories/ServiceRepository.test.js
  - [ ] Test findByCategory()
  - [ ] Test active services filtering
- [ ] Create tests/repositories/StaffRepository.test.js
  - [ ] Test findByCompany()
  - [ ] Test staff availability
- [ ] Create tests/repositories/StaffScheduleRepository.test.js
  - [ ] Test findSchedules()
  - [ ] Test date range queries
- [ ] Create tests/repositories/DialogContextRepository.test.js
  - [ ] Test context save/load
  - [ ] Test JSONB field handling
- [ ] Create tests/repositories/CompanyRepository.test.js
  - [ ] Test company lookup

#### Phase 4: Integration Tests (2h)
- [ ] Create tests/integration/transaction-scenarios.test.js
  - [ ] Test client + booking creation
  - [ ] Test booking rescheduling
  - [ ] Test bulk sync operations
- [ ] Create tests/integration/connection-pool.test.js
  - [ ] Test concurrent queries
  - [ ] Test connection pool exhaustion handling
  - [ ] Test connection timeout handling
- [ ] Create tests/integration/error-handling.test.js
  - [ ] Test foreign key violations
  - [ ] Test unique constraint violations
  - [ ] Test Timeweb-specific error codes

#### Phase 5: Documentation & CI (1h)
- [ ] Update README with test instructions
- [ ] Add npm test scripts
- [ ] Document test database setup
- [ ] Add CI configuration (if applicable)

---

## ✅ CRITICAL-5: Error Handling Consistency (COMPLETE)

**Status:** ✅ Deployed to production
**Time:** 30 minutes ⚡ (Much faster than estimated 3-4h!)
**Commit:** `be09de0`

### Why So Fast?
Audit revealed ALL 20 methods already had try-catch blocks! Only needed to add Sentry tracking.

### Tasks Completed

#### Phase 1: Audit Current State ✅
- [x] Read src/integrations/yclients/data/supabase-data-layer.js
- [x] Discovered all 20 methods already have try-catch with logger.error
- [x] Pattern found: Consistent error response via _buildErrorResponse()
- [x] Only missing: Sentry.captureException() calls

#### Phase 2: Add Sentry Tracking ✅
- [x] Add Sentry import to data layer
- [x] Add Sentry.captureException() to all 20 catch blocks with:
  - [x] Tags: component='data-layer', operation=methodName, backend=current
  - [x] Extra: method-specific context (IDs, counts, filters)

#### Phase 3: Methods Updated (20 total) ✅

**Dialog Context (2):**
- [x] getDialogContext
- [x] upsertDialogContext

**Client Methods (7):**
- [x] getClientByPhone
- [x] getClientById
- [x] getClientAppointments
- [x] getUpcomingAppointments
- [x] searchClientsByName
- [x] upsertClient
- [x] upsertClients

**Staff Methods (4):**
- [x] getStaffById
- [x] getStaffSchedules
- [x] getStaffSchedule
- [x] upsertStaffSchedules

**Service Methods (4):**
- [x] getServices
- [x] getServiceById
- [x] getServicesByCategory
- [x] upsertServices

**Staff List (1):**
- [x] getStaff

**Company Methods (2):**
- [x] getCompany
- [x] upsertCompany

#### Phase 4: Testing & Deployment ✅
- [x] Deploy to production
- [x] All PM2 services restarted successfully
- [x] Send test message through WhatsApp
- [x] Verify message processed correctly
- [x] Monitor for errors (none detected)

---

## ⏳ CRITICAL-6: Baileys Store Monitoring (PENDING)

**Status:** ⏳ Not started
**Estimated Time:** 2-3 hours
**Priority:** High

### Tasks Breakdown

#### Phase 1: Session Health Checking (1h)
- [ ] Add checkSessionHealth() to src/integrations/whatsapp/auth-state-timeweb.js
  - [ ] Count total auth records
  - [ ] Count total keys
  - [ ] Count expired keys
  - [ ] Return health status object
- [ ] Test session health check locally
- [ ] Add health check to existing getAuthStateStats()

#### Phase 2: Cleanup Script (1h)
- [ ] Create scripts/cleanup-whatsapp-keys.js
  - [ ] Delete expired keys (WHERE expires_at < NOW())
  - [ ] Log cleanup statistics
  - [ ] Add Sentry tracking for cleanup errors
  - [ ] Add dry-run mode for testing
- [ ] Test cleanup script on production
- [ ] Add to cron schedule (run every 6 hours)

#### Phase 3: Health Endpoint (30min)
- [ ] Add /health/whatsapp endpoint to src/api/routes/health.js
- [ ] Return:
  - [ ] Session status (healthy/warning/critical)
  - [ ] Auth record count
  - [ ] Total keys
  - [ ] Expired keys
  - [ ] File count (if available)
  - [ ] Last cleanup timestamp
- [ ] Add thresholds:
  - [ ] Healthy: <200 files, <100 expired keys
  - [ ] Warning: 200-300 files, 100-500 expired keys
  - [ ] Critical: >300 files, >500 expired keys

#### Phase 4: File Monitoring (30min)
- [ ] Add file count monitoring to baileys-service.js
- [ ] Log warning if file count >200
- [ ] Log critical if file count >300
- [ ] Add to health endpoint response

---

## Test Commands

### Local Testing (with Timeweb disabled)
```bash
# Note: Local .env has USE_LEGACY_SUPABASE=true
# To test with Timeweb, temporarily set USE_LEGACY_SUPABASE=false

# Run transaction tests (requires Timeweb)
node scripts/test-transactions.js
```

### Production Testing
```bash
# SSH to production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Check environment variables
grep 'SENTRY_DSN\|POSTGRES_MAX_CONNECTIONS' /opt/ai-admin/.env

# Check PM2 status
pm2 status

# Test transactions
cd /opt/ai-admin && node scripts/test-transactions.js

# Check Sentry errors
# Visit: https://sentry.io → ai-admin-v2 → Issues

# Test WhatsApp message processing
# Use MCP: @whatsapp send_message phone:89686484488 message:"Тест"

# Check logs
pm2 logs ai-admin-worker-v2 --lines 50
```

---

## Success Criteria

### CRITICAL-1: Sentry ✅
- [x] All database errors captured to Sentry
- [x] Test error visible in Sentry dashboard
- [x] Errors include component, operation, duration tags
- [x] Errors include relevant context (filters, query, etc.)

### CRITICAL-2: Connection Pool ✅
- [x] Max connections set to 3 per service
- [x] Connection monitoring events logging
- [x] No connection exhaustion under normal load
- [x] All services restart successfully

### CRITICAL-3: Transactions ✅
- [x] withTransaction() method works
- [x] COMMIT works for successful transactions
- [x] ROLLBACK works for failed transactions
- [x] Sentry tracks failed transactions
- [x] Documentation complete

### CRITICAL-4: Integration Tests (Pending)
- [ ] Test coverage >80% for repositories
- [ ] All tests pass against production database
- [ ] CI/CD integration (if applicable)

### CRITICAL-5: Error Handling (Pending)
- [ ] All 19 data layer methods have try-catch
- [ ] All errors captured to Sentry
- [ ] Consistent error response pattern
- [ ] No unhandled promise rejections

### CRITICAL-6: Baileys Monitoring (Pending)
- [ ] Health check endpoint returns accurate data
- [ ] Cleanup script removes expired keys
- [ ] File count monitored and logged
- [ ] Alerts trigger at thresholds

---

## Deployment Checklist

Before deploying changes:
- [ ] All tests pass locally (if applicable)
- [ ] Code committed to git
- [ ] Changes documented in commit message
- [ ] Environment variables added to .env.example
- [ ] Environment variables added to production .env (if needed)

Deployment steps:
1. [ ] Push to GitHub: `git push origin main`
2. [ ] SSH to production: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
3. [ ] Pull changes: `cd /opt/ai-admin && git pull origin main`
4. [ ] Install dependencies (if needed): `npm install`
5. [ ] Restart services: `pm2 restart all`
6. [ ] Verify services online: `pm2 status`
7. [ ] Check logs: `pm2 logs --lines 50 --nostream`
8. [ ] Test critical functionality

---

**Total Tasks:** 150+
**Completed:** ~50 (33%)
**Remaining:** ~100 (67%)

**Realistic completion time:** 14-19 hours over 2-3 weeks
