# Database Migration Context

**Last Updated:** 2025-11-09 22:45 MSK
**Current Phase:** Preparing Phase 1 (Repository Pattern)
**Status:** 📋 Planning Complete, Ready to Execute

---

## 🔄 Current Session Update (2025-11-09 Evening)

### **Major Plan Restructuring**

**What Happened:**
- Used `plan-reviewer` agent twice to analyze migration plan
- Discovered **critical issues** in original plan
- Created NEW focused plan for database migration only

**Critical Findings:**
1. ❌ **Phase 0.9 was targeting TEST files**, not production code
2. ❌ **Missing Code Integration phase** (repositories → production)
3. ❌ **Missing Data Migration phase** (Supabase → Timeweb)
4. ❌ **Plan confused** database migration with server migration

**Actions Taken:**
- ✅ Created new plan: `database-migration-supabase-timeweb/`
- ✅ Clear focus: Supabase → Timeweb PostgreSQL only
- ✅ 5 phases with logical dependencies
- ✅ Archived old plan for reference

---

## 📊 Current State

### **What's Complete** ✅

#### Phase 0: Baileys Session Migration (2025-11-06)
- **Executed:** 2025-11-06, 13:56-16:58 Moscow Time
- **Duration:** ~30 minutes (10-15 min downtime)
- **Result:** SUCCESS

**Migrated:**
- 1 WhatsApp auth record
- 728 Signal Protocol keys
- All data transferred from Supabase to Timeweb

**Status:**
- ✅ WhatsApp connected and stable
- ✅ All 7 PM2 services online
- ✅ Day 3/7 monitoring (as of 2025-11-09)
- ✅ Zero issues detected

#### Phase 0.8: Schema Migration (2025-11-09)
- **Executed:** 2025-11-09, 21:39-21:47 MSK
- **Duration:** 8 minutes (faster than 15 min estimated!)
- **Result:** EXCEEDS EXPECTATIONS

**Created:**
- 19 tables (10 business + 1 messages parent + 6 partitions + 2 Baileys)
- 129 indexes (target was 70+)
- 8 functions (all tested)
- 9 auto-update triggers

**Impact:**
- ✅ Zero downtime
- ✅ Zero business impact
- ✅ Baileys remained connected throughout
- ✅ Database: 9.6 MB → 11 MB (+1.4 MB)

### **What's Remaining** ❌

#### Application Code
- **Status:** Still uses Supabase
- **File:** `src/integrations/yclients/data/supabase-data-layer.js` (977 lines)
- **Queries:** 21 calls using `this.db.from()` pattern
- **Methods:** 19 async methods to migrate
- **Flag:** `USE_LEGACY_SUPABASE=true`

#### Business Data
- **Location:** Still in Supabase
- **Tables:** clients (1,299), services (63), staff (12), bookings (38), etc.
- **Total:** ~1,500 records to migrate

#### Production Traffic
- **Read/Write:** All operations to Supabase
- **Performance:** 20-50ms latency (external network)
- **Target:** <1ms latency (Timeweb internal network)

---

## 🗄️ Database Details

### **Timeweb PostgreSQL**

**Connection:**
```bash
Host: a84c973324fdaccfc68d929d.twc1.net
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0

# SSL Required
SSL Mode: verify-full
SSL Cert: /root/.cloud-certs/root.crt

# Connection String
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full
```

**Current State:**
- **Size:** 11 MB (after Phase 0.8)
- **Tables:** 19 total
  - 2 Baileys (whatsapp_auth, whatsapp_keys) - ✅ Has Data
  - 17 Business/Messages - ❌ Empty (schema only)
- **Indexes:** 129 total
- **Functions:** 8 total
- **Triggers:** 9 total

**Schema Breakdown:**

| Category | Tables | Status |
|----------|--------|--------|
| **Baileys** | whatsapp_auth, whatsapp_keys | ✅ Migrated (Phase 0) |
| **Business** | companies, clients, services, staff, staff_schedules, bookings, appointments_cache, dialog_contexts, reminders, sync_status | ❌ Empty |
| **Messages** | messages (parent), messages_2025_11, messages_2025_12, messages_2026_01, messages_2026_02, messages_2026_03, messages_2026_04 | ❌ Empty |

### **Supabase PostgreSQL**

**Status:** Still active (production)

**Data:**
- Companies: 1 record
- Clients: 1,299 records
- Services: 63 records
- Staff: 12 records
- Bookings: 38 records
- Dialog contexts: ~50 records
- And more...

**Performance:** 20-50ms latency (external API)

---

## 🎯 Key Decisions

### **Decision 1: Separate Database Migration from Server Migration**
**Date:** 2025-11-09
**Made By:** plan-reviewer analysis + team discussion

**Context:**
- Original plan mixed TWO migrations:
  1. Database: Supabase → Timeweb PostgreSQL
  2. Server: Moscow VPS → St. Petersburg VPS

**Decision:**
- Focus on database migration FIRST
- Server migration can happen LATER or in parallel
- Clear separation of concerns

**Rationale:**
- Database migration is CRITICAL for 152-ФЗ compliance
- Server migration is about performance/cost optimization
- Can be done independently
- Reduces complexity and risk

### **Decision 2: Repository Pattern Implementation**
**Date:** 2025-11-09
**Made By:** plan-reviewer recommendation

**Decision:**
- Implement Repository Pattern as abstraction layer
- Create 6 domain repositories
- Use dependency injection

**Rationale:**
- Prevents 500+ scattered `postgres.query()` calls
- Enables testing (mock repositories)
- Future-proof (easy to change database later)
- Industry best practice
- Additional time (+2-3 days) is worth it

**Alternative Rejected:**
- Direct `postgres.query()` everywhere
- Would be faster short-term but painful long-term

### **Decision 3: Dual-Write Strategy**
**Date:** 2025-11-09
**Made By:** Team + plan-reviewer

**Decision:**
- Implement dual-write period during migration
- Write to BOTH Supabase and Timeweb simultaneously
- Timeweb is primary, Supabase is backup

**Rationale:**
- Zero data loss guarantee
- Easy rollback if issues found
- Can compare data for verification
- Industry standard for migrations

**Duration:** 3-5 days (Phase 3)

### **Decision 4: Feature Flags for Gradual Rollout**
**Date:** 2025-11-09

**Flags:**
```bash
USE_LEGACY_SUPABASE=true          # Current: Supabase
USE_REPOSITORY_PATTERN=false      # Phase 2: Enable repositories
ENABLE_DUAL_WRITE=false           # Phase 3: Enable dual-write
```

**Rationale:**
- Can switch databases without code deployment
- Test with specific users/phones first
- Instant rollback capability
- Gradual percentage rollout possible

### **Decision 5: Timeline: 3 Weeks**
**Date:** 2025-11-09

**Breakdown:**
- Week 1-2: Repository Pattern + Code Integration (7-10 days)
- Week 2-3: Data Migration (3-5 days)
- Week 3: Testing + Cutover (2-3 days + 48h + 4h)

**Total:** ~19 days conservative

**Rationale:**
- Based on Phase 0/0.8 experience
- Accounts for testing and validation
- Buffer for unexpected issues

---

## 📝 Lessons Learned

### **From Phase 0 (Baileys Migration)**

1. **Database operations faster than estimated**
   - Estimated: 7-14 days
   - Actual: 30 minutes
   - Learning: Simple data migrations are quick

2. **Downtime can be minimal**
   - Estimated: 1-2 hours
   - Actual: 10-15 minutes
   - Learning: With preparation, downtime is short

3. **External SSL endpoints work**
   - Used external endpoint from Moscow datacenter
   - Performance acceptable (~20-50ms)
   - Will improve after server migration

### **From Phase 0.8 (Schema Migration)**

1. **Empty table creation is FAST**
   - Estimated: 3-4 days
   - Actual: 8 minutes
   - Learning: Schema operations are quick when no data

2. **Zero downtime is possible**
   - Created 19 tables while services running
   - No impact on production
   - Learning: DDL operations don't require downtime

3. **Plan review is CRITICAL**
   - plan-reviewer caught major issues twice
   - Would have migrated wrong files
   - Learning: ALWAYS review before executing

### **From Plan Review Sessions**

1. **grep searches can be misleading**
   - Searched for `supabase.from` → found test files
   - Production used `this.db.from` → missed it!
   - Learning: Understand code patterns before searching

2. **Missing phases are common**
   - Forgot code integration phase
   - Forgot data migration phase
   - Learning: Think through entire flow

3. **Timeline estimates wildly off**
   - Database ops: 100-1000x overestimated
   - Server ops: Accurate
   - Learning: Use historical data

---

## 🚨 Critical Risks & Mitigations

### **Risk 1: Data Loss During Migration**
- **Probability:** 15%
- **Impact:** CRITICAL
- **Mitigation:**
  - Dual-write mechanism
  - Verification scripts
  - Multiple backups
  - Row-by-row comparison

### **Risk 2: Extended Downtime (>4 hours)**
- **Probability:** 20%
- **Impact:** HIGH
- **Mitigation:**
  - Parallel preparation
  - Tested rollback procedure (<10 min)
  - Client notification 24h advance
  - Buffer time in estimate

### **Risk 3: Performance Regression**
- **Probability:** 10%
- **Impact:** MEDIUM
- **Mitigation:**
  - Benchmarking before/after
  - Load testing
  - Connection pooling
  - Query optimization

### **Risk 4: Integration Bugs**
- **Probability:** 30%
- **Impact:** MEDIUM
- **Mitigation:**
  - Extensive testing (unit + integration)
  - Gradual rollout with feature flags
  - Test number parallel run
  - Monitoring and alerts

---

## 🔧 Technical Implementation Details

### **Repository Pattern Architecture**

```javascript
// Base Repository
class BaseRepository {
  constructor(tableName, db) {
    this.table = tableName;
    this.db = db;
  }

  async findOne(field, value) {
    const result = await this.db.query(
      `SELECT * FROM ${this.table} WHERE ${field} = $1 LIMIT 1`,
      [value]
    );
    return { data: result.rows[0] || null, error: null };
  }

  async upsert(data, conflictField) {
    // PostgreSQL UPSERT implementation
    // INSERT ... ON CONFLICT ... DO UPDATE ...
  }
}

// Domain Repositories
class ClientRepository extends BaseRepository {
  constructor(db) {
    super('clients', db);
  }

  async findByPhone(phone) {
    return this.findOne('phone', phone);
  }
}
```

### **Abstraction Layer**

```javascript
// Data Layer supporting both backends
class DataLayer {
  constructor() {
    this.useLegacy = process.env.USE_LEGACY_SUPABASE === 'true';
    this.useRepos = process.env.USE_REPOSITORY_PATTERN === 'true';

    if (this.useRepos) {
      this.client = new ClientRepository(postgres);
      // ... other repos
    } else if (this.useLegacy) {
      this.legacy = new SupabaseDataLayer(supabase);
    }
  }

  async getClientByPhone(phone) {
    if (this.useRepos) {
      return this.client.findByPhone(phone);
    } else {
      return this.legacy.getClientByPhone(phone);
    }
  }
}
```

### **Dual-Write Implementation**

```javascript
async upsertClient(clientData) {
  // Write to Timeweb (primary)
  const timewebResult = await this.client.upsert(clientData);

  // Write to Supabase (backup) if dual-write enabled
  if (process.env.ENABLE_DUAL_WRITE === 'true') {
    try {
      await this.legacy.upsertClient(clientData);
    } catch (error) {
      // Log but don't fail (Timeweb is primary)
      logger.warn('Dual-write to Supabase failed:', error);
      Sentry.captureException(error);
    }
  }

  return timewebResult;
}
```

---

## 📊 Production Environment

### **Server**
- **Location:** Moscow datacenter
- **IP:** 46.149.70.219
- **SSH:** `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- **Path:** /opt/ai-admin

### **PM2 Services (7 total)**
- ai-admin-api
- ai-admin-worker-v2
- baileys-whatsapp-service
- whatsapp-backup-service
- ai-admin-batch-processor
- ai-admin-booking-monitor
- ai-admin-telegram-bot

**Current Status:** All online, stable

### **Environment Variables**
```bash
# Current Configuration
USE_LEGACY_SUPABASE=true
POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
PGSSLROOTCERT=/root/.cloud-certs/root.crt

# Will add in Phase 2
USE_REPOSITORY_PATTERN=false

# Will add in Phase 3
ENABLE_DUAL_WRITE=false
```

---

## 📈 Success Metrics

### **Achieved (Phases 0 & 0.8)**
- ✅ Baileys sessions migrated (728 keys)
- ✅ Schema created (19 tables, 129 indexes)
- ✅ Zero downtime achieved
- ✅ All services online

### **Target (Phases 1-5)**
- ⏳ Repository pattern created
- ⏳ Code integrated
- ⏳ All data migrated (1,500+ records)
- ⏳ Performance >20x improvement
- ⏳ Production running on Timeweb

---

## 🔗 Related Files

**Current Plan:**
- `database-migration-plan.md` - Complete migration plan
- `database-migration-tasks.md` - Detailed task breakdown
- `database-migration-context.md` - This file

**Historical Reference:**
- `../datacenter-migration-msk-spb/` - Original plan (archived)
- `../datacenter-migration-msk-spb/PHASE_0_EXECUTION_REPORT.md`
- `../datacenter-migration-msk-spb/PHASE_08_EXECUTION_REPORT.md`

**Code:**
- `src/integrations/yclients/data/supabase-data-layer.js` - Target for migration
- `src/database/supabase.js` - Current Supabase connection
- `src/database/postgres.js` - Timeweb PostgreSQL connection

---

## 🚀 Next Steps

**Immediate (This Week):**
1. Begin Phase 1: Repository Pattern Implementation
2. Create 6 repositories with 19 methods
3. Build comprehensive test suite
4. Integration tests with Timeweb

**Short Term (Week 2-3):**
5. Code Integration (Phase 2)
6. Data Migration (Phase 3)

**Medium Term (Week 3-4):**
7. Testing & Validation (Phase 4)
8. Production Cutover (Phase 5)

---

**Last Updated:** 2025-11-09 22:45 MSK
**Next Review:** After Phase 1 completion
**Status:** Ready to Execute Phase 1
