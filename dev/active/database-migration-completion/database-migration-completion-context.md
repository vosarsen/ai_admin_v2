# Database Migration Completion Context
**Last Updated: 2025-11-07**

---

## 🎯 Current Status

**Phase:** Planning Complete, Ready to Execute Phase 0.7
**Date:** November 7, 2025
**Environment:** Production (46.149.70.219)

---

## 📊 Critical Discovery (November 6, 2025)

### What We Thought vs Reality

**Expected after Phase 0 (October 7, 2025):**
- ✅ Baileys WhatsApp data migrated to Timeweb
- ✅ Application using Timeweb PostgreSQL
- ✅ Everything working from new database

**Actual State (November 7, 2025):**
- ✅ Data exists in Timeweb (whatsapp_auth + 728 keys)
- ❌ **Baileys STILL reads from Supabase** (not Timeweb!)
- ❌ Timeweb data completely unused
- ❌ Business tables not migrated

### Root Cause

**File:** `src/integrations/whatsapp/auth-state-supabase.js:11`

```javascript
const { supabase } = require('../../database/supabase');  // ❌ HARDCODED!
```

This file:
- Has direct Supabase import (bypasses USE_LEGACY_SUPABASE flag)
- Used by `src/integrations/whatsapp/session-pool.js`
- Controls ALL Baileys WhatsApp authentication
- Queries `whatsapp_auth` and `whatsapp_keys` tables directly from Supabase

**Impact:** The flag `USE_LEGACY_SUPABASE=false` only affects `src/database/postgres.js` initialization, but Baileys never uses that module.

---

## 🗂️ Data Inventory

### ✅ In Timeweb PostgreSQL (UNUSED)

**Tables:** 2
**Total Records:** 729

| Table | Records | Status |
|-------|---------|--------|
| whatsapp_auth | 1 | Migrated Oct 7, never read |
| whatsapp_keys | 728 | Migrated Oct 7, never updated |

### ❌ Still in Supabase (ACTIVELY USED)

**Tables:** 11+
**Total Records:** 1,500+

| Table | Records | Used By | Priority |
|-------|---------|---------|----------|
| whatsapp_auth | 1 | Baileys (active) | CRITICAL |
| whatsapp_keys | 728 | Baileys (active) | CRITICAL |
| companies | 1 | Core config | HIGH |
| clients | 1,299 | AI context, bookings | HIGH |
| services | 63 | Booking system | HIGH |
| staff | 12 | Booking system | HIGH |
| staff_schedules | 56+ | Scheduling | HIGH |
| bookings | 38 | Active bookings | HIGH |
| appointments_cache | ? | Historical data | MEDIUM |
| dialog_contexts | 21 | AI conversations | MEDIUM |
| reminders | ? | Notifications | MEDIUM |
| sync_status | ? | Sync tracking | LOW |
| messages | ? | History (partitioned) | LOW |

---

## 🔍 Code Analysis

### Files with Hardcoded Supabase Imports

**Total:** 51 files in `src/`

**Critical Categories:**

#### 1. Baileys WhatsApp Auth (1 file) - PHASE 0.7 TARGET
- `src/integrations/whatsapp/auth-state-supabase.js` (358 lines)
  - Direct Supabase import
  - Used by session-pool.js
  - Queries whatsapp_auth, whatsapp_keys
  - **Fix Priority:** URGENT

#### 2. Sync Scripts (11 files) - WEEK 1 TARGET
- `src/sync/clients-sync.js`
- `src/sync/services-sync.js`
- `src/sync/staff-sync.js`
- `src/sync/schedules-sync.js`
- `src/sync/bookings-sync.js`
- `src/sync/client-records-sync.js`
- `src/sync/company-info-sync.js`
- `src/sync/goods-transactions-sync.js`
- `src/sync/visits-sync.js`
- `src/sync/clients-sync-optimized.js`
- `src/sync/sync-manager.js`

#### 3. Data Layer (1 file) - WEEK 1 TARGET
- `src/integrations/yclients/data/supabase-data-layer.js` (977 lines)
  - Central data access layer
  - Used by AI Admin v2, services, API
  - **Critical:** Affects entire application

#### 4. Services (6+ files) - WEEK 1-2 TARGET
- `src/services/ai-admin-v2/index.js`
- `src/services/ai-admin-v2/modules/command-handler.js`
- `src/services/ai-admin-v2/modules/data-loader.js`
- `src/services/booking-monitor/index.js`
- `src/services/webhook-processor/index.js`
- `src/services/marketplace/marketplace-service.js`

#### 5. API Routes (4+ files) - WEEK 1-2 TARGET
- `src/api/routes/health.js`
- `src/api/routes/yclients-marketplace.js`
- `src/api/webhooks/yclients.js`
- `src/api/websocket/marketplace-socket.js`

#### 6. Workers (2 files) - WEEK 1-2 TARGET
- `src/workers/message-worker-v2.js`
- `src/utils/critical-error-logger.js`

#### 7. WhatsApp Services (1 file) - WEEK 1-2 TARGET
- `src/services/whatsapp/database-cleanup.js`

---

## 🛠️ Infrastructure State

### Production VPS

**Server:** 46.149.70.219 (Timeweb Moscow)
**OS:** Ubuntu 22.04 LTS
**Path:** /opt/ai-admin
**SSH Key:** ~/.ssh/id_ed25519_ai_admin

**PM2 Services (8 running):**
1. ai-admin-api (Port 3000)
2. ai-admin-worker-v2 (Gemini AI)
3. baileys-whatsapp-service (WhatsApp)
4. whatsapp-backup-service (6h intervals)
5. ai-admin-batch-processor
6. ai-admin-booking-monitor (Reminders)
7. ai-admin-telegram-bot (Notifications)
8. whatsapp-safe-monitor (Health monitoring)

### Timeweb PostgreSQL

**Host:** a84c973324fdaccfc68d929d.twc1.net
**Port:** 5432 (SSL required)
**Database:** default_db
**User:** gen_user
**Password:** }X|oM595A<7n?0
**SSL Cert:** /root/.cloud-certs/root.crt

**Connection String:**
```
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full
```

**Current Tables:**
- whatsapp_auth (1 record, last updated Oct 7)
- whatsapp_keys (728 records, last updated Oct 7)

**Status:** Online, accessible, but UNUSED by application

### Supabase PostgreSQL

**Status:** ACTIVE (all queries go here)
**Tables:** 11+ tables with all production data
**Risk:** None (working as before Phase 0 attempt)

### Redis

**Local Port:** 6380 (SSH tunnel)
**Server Port:** 6379 (direct)
**Purpose:** Context cache (ephemeral)
**Status:** Working

---

## 🔑 Key Configuration

### Environment Variables (.env)

**Current State:**
```bash
# Database
USE_LEGACY_SUPABASE=false  # ❌ Set but not effective for Baileys!
POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
PGSSLROOTCERT=/root/.cloud-certs/root.crt

# Supabase (still in use!)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_KEY=[key]

# Other
BAILEYS_STANDALONE=true  # ✅ Critical for WhatsApp stability
REDIS_URL=redis://...
GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU
YCLIENTS_BEARER_TOKEN=...
YCLIENTS_USER_TOKEN=...
```

**Backups:**
- `.env.backup.before-timeweb-20251106_165638` (Phase 0 attempt)

---

## 📁 Modified Files (Phase 0 Attempt - October 2025)

### Scripts Created

1. `scripts/migrate-supabase-to-timeweb.js` - Migration script (whatsapp tables only)
2. `scripts/setup-timeweb-tunnel.sh` - SSH tunnel setup
3. `scripts/test-timeweb-connection.sh` - Connection test
4. `scripts/apply-schema-timeweb.sh` - Schema application

### Migrations Applied

1. `migrations/20251007_create_whatsapp_auth_tables.sql`
   - Created whatsapp_auth table
   - Created whatsapp_keys table
2. `migrations/20251008_optimize_whatsapp_keys.sql`
   - Dropped problematic index (JSONB size limit issue)

### Database Changes

**Timeweb PostgreSQL:**
- Tables created: whatsapp_auth, whatsapp_keys
- Data loaded: 1 auth + 728 keys (Oct 7, 2025)
- Index dropped: idx_whatsapp_keys_company_type_id (caused 8KB limit error)

**Supabase:**
- NO CHANGES (still has all data, still being used)

---

## 🎓 Lessons Learned (Phase 0 Incomplete)

### What Went Wrong

1. **Incomplete Scope Definition**
   - Assumed USE_LEGACY_SUPABASE controlled ALL database access
   - Didn't audit every Supabase import in codebase
   - Missed hardcoded imports in Baileys auth state
   - Didn't verify WHERE data was actually being read from

2. **Testing Gap**
   - ✅ Tested: Services online (PM2 status)
   - ❌ Missed: Verifying which database was queried
   - ❌ Missed: Checking Supabase query logs (should be zero)
   - ❌ Missed: Verifying Timeweb keys updated_at timestamps

3. **Documentation Ambiguity**
   - Phase 0 plan said: "Migrate Baileys WhatsApp sessions"
   - Did NOT say: "Update code to READ from Timeweb"
   - Assumed data migration = code migration
   - Didn't clarify flag scope explicitly

4. **Verification Methodology**
   - Verified data EXISTS in Timeweb ✅
   - Didn't verify data is USED from Timeweb ❌
   - Should have checked connection logs
   - Should have monitored table access patterns

### What To Do Differently

**Before ANY Migration:**
1. Audit ALL database connections (grep entire codebase)
2. Map every import of database modules
3. Identify ALL flags/config controlling DB selection
4. Document scope EXPLICITLY (what changes, what doesn't)

**During Migration:**
1. Verify data is being READ from new DB (not just migrated)
2. Check old DB query logs (should drop to zero)
3. Monitor with real-time tools (not just snapshots)
4. Test with actual queries, not just connection tests

**After Migration:**
1. Confirm old DB is IDLE (zero queries)
2. Check timestamps on new DB tables (should be recent)
3. Remove old DB credentials temporarily (force errors if still used)
4. Monitor for 7 days before declaring success

---

## 🔄 Current Implementation Strategy

### Why Conservative Approach

**User chose Variant B:** Migrate EVERYTHING (not just Baileys)

**Reasoning:**
- ✅ Complete separation from Supabase
- ✅ Clean architecture (no legacy code)
- ✅ No future "gotchas" with hardcoded imports
- ✅ Cost savings (decommission Supabase)
- ❌ More work (3 weeks vs 3 days)
- ❌ Higher complexity (51 files to update)

### Phased Approach

**Phase 0.7** (URGENT - 1-2 days):
- Fix Baileys ONLY
- Validate Timeweb works for production WhatsApp
- Prove concept before full migration
- Low risk, fast rollback

**Week 1** (Abstraction Layer):
- Create unified database interface
- Update critical files (data layer, sync scripts)
- Maintain backward compatibility (Supabase still works)
- Testing without production impact

**Week 2** (Migration Prep):
- Build complete migration scripts
- Test on staging
- Dry-run on production (read-only)
- Fix issues found

**Week 3** (Execution):
- Planned maintenance window (Sunday 02:00-08:00)
- Full cutover
- Verification
- 7-day monitoring

---

## 🚀 Next Steps

### Immediate (Today - November 7)

1. **Review this plan** with stakeholder
2. **Confirm approach** (Phase 0.7 → Full Migration)
3. **Set timeline** (start Phase 0.7 tomorrow?)
4. **Assign resources** (developer + QA + DevOps)

### Phase 0.7 (Days 1-2)

1. Create `auth-state-timeweb.js` (3 hours)
2. Create `auth-state-database.js` (1 hour)
3. Update `session-pool.js` (30 min)
4. Unit tests locally (1 hour)
5. Deploy to VPS + integration test (1 hour)
6. E2E test with phone 89686484488 (30 min)
7. Monitor 24 hours

### Week 1 (Days 3-9)

1. Design unified-db.js API
2. Implement Supabase adapter
3. Implement Timeweb adapter
4. Update data layer (977 lines)
5. Update 5-10 sync scripts
6. Code review + testing

### Week 2 (Days 10-16)

1. Create migration script (all tables)
2. Test migrations on staging
3. Dry-run on production
4. Performance benchmarks
5. Fix issues
6. Final preparations

### Week 3 (Days 17-23)

1. Preparations (Days 17-22)
2. **Execution** (Day 23, Sunday 02:00-08:00)
3. Post-migration monitoring
4. Decommission Supabase (after 7 days stable)

---

## 📞 Key Contacts

**VPS SSH:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
```

**Timeweb Control Panel:** (user has access)

**Test Phone:** 89686484488 (ONLY this number for testing!)

**MCP Servers:**
- @whatsapp - Test messages
- @logs - PM2 logs
- @redis - Context cache
- @supabase - Database queries

---

## 🎯 Success Indicators

### Phase 0.7 Complete When:
- [ ] Baileys reads from Timeweb (not Supabase)
- [ ] WhatsApp messages work (send + receive)
- [ ] Logs show "Using Timeweb PostgreSQL auth state"
- [ ] Zero Supabase queries in Baileys logs
- [ ] Timeweb whatsapp_keys has fresh updated_at timestamps
- [ ] 24 hours stable operation

### Full Migration Complete When:
- [ ] All 11 tables in Timeweb
- [ ] All 51 files use unified-db
- [ ] Zero Supabase queries (entire app)
- [ ] All services online
- [ ] E2E tests pass
- [ ] 7 days stable operation
- [ ] Supabase decommissioned

---

## 📚 Related Documentation

**Dev Docs:**
- `database-migration-completion-plan.md` - This comprehensive plan
- `database-migration-completion-tasks.md` - Checklist tracker

**Previous Attempts:**
- `dev/active/datacenter-migration-msk-spb/CRITICAL_ISSUE_PHASE_0_INCOMPLETE.md` - Discovery
- `dev/active/datacenter-migration-msk-spb/datacenter-migration-msk-spb-context.md` - Phase 0 execution

**Project Docs:**
- `docs/TIMEWEB_POSTGRES_SUMMARY.md` - Timeweb setup
- `docs/TROUBLESHOOTING.md` - Common issues
- `CLAUDE.md` - Project quick reference

---

**Status:** Planning Complete
**Next Action:** Review plan → Get approval → Begin Phase 0.7
**Timeline:** Start tomorrow (November 8) if approved today
