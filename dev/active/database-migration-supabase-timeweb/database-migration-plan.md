# Database Migration Plan: Supabase → Timeweb PostgreSQL

**Project:** AI Admin v2
**Migration Type:** Database Backend Migration
**From:** Supabase PostgreSQL (cloud)
**To:** Timeweb PostgreSQL (self-hosted)
**Created:** 2025-11-09
**Status:** In Progress - Phase 1 (Repository Pattern)

---

## 📊 Migration Overview

### **Goal**
Migrate AI Admin v2 application from Supabase to Timeweb PostgreSQL while maintaining:
- Zero data loss
- Minimal downtime
- Full functionality
- Performance improvements

### **Why Migrate?**
1. **Compliance:** 152-ФЗ requirement for Russian data storage
2. **Performance:** Timeweb internal network <1ms latency (vs Supabase 20-50ms)
3. **Cost:** More predictable pricing
4. **Control:** Full database access and management

### **Current State (2025-11-09)**

**What's Complete:**
- ✅ **Baileys WhatsApp Sessions:** Migrated to Timeweb (Phase 0, 2025-11-06)
  - 1 auth + 728 keys successfully transferred
  - WhatsApp connection stable (Day 3/7 monitoring)
- ✅ **Database Schema:** Created in Timeweb (Phase 0.8, 2025-11-09)
  - 19 tables (10 business + 1 messages + 6 partitions + 2 Baileys)
  - 129 indexes, 8 functions, 9 triggers
  - Execution time: 8 minutes (zero downtime)

**What's Remaining:**
- ❌ **Application Code:** Still uses Supabase (USE_LEGACY_SUPABASE=true)
- ❌ **Business Data:** Still in Supabase (clients, services, staff, bookings)
- ❌ **Production Traffic:** All reads/writes to Supabase

**Database Details:**
- **Timeweb PostgreSQL:** a84c973324fdaccfc68d929d.twc1.net:5432
- **Database:** default_db (11 MB after Phase 0.8)
- **SSL:** Required (verify-full, /root/.cloud-certs/root.crt)
- **Tables:** 19 total (ready for data)

---

## 🎯 Migration Strategy

### **Approach: Staged Migration with Dual-Write**

We will migrate in 5 phases with the ability to rollback at any point:

```
Current State → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Complete
(Supabase)     (Repos)   (Code)    (Data)    (Test)    (Cutover)   (Timeweb)
```

### **Key Principles**
1. **Incremental:** Each phase is independently testable
2. **Reversible:** Can rollback at any stage
3. **Observable:** Monitoring at every step
4. **Safe:** Dual-write period to prevent data loss

---

## 📋 Migration Phases

### **Phase 1: Repository Pattern Implementation** (2-3 days)

**Status:** 🔄 Ready to Start
**Duration:** 2-3 days (20-24 hours)
**Risk Level:** LOW (no production impact)

**Goals:**
- Create PostgreSQL repository layer
- Transform Supabase queries to native PostgreSQL
- Build comprehensive test suite

**Deliverables:**
- `src/repositories/BaseRepository.js`
- 6 domain repositories (Client, Service, Staff, DialogContext, Company, StaffSchedule)
- 19 methods (PostgreSQL equivalents of SupabaseDataLayer)
- Unit tests + Integration tests with Timeweb
- Migration guide documentation

**Target File:**
- `src/integrations/yclients/data/supabase-data-layer.js` (977 lines)
  - 21 query calls using `this.db.from()` pattern
  - 19 async methods to transform

**Success Criteria:**
- All 6 repositories created and tested
- 100% test coverage for repository methods
- Integration tests pass with Timeweb PostgreSQL
- Documentation complete

---

### **Phase 2: Code Integration** (5-7 days)

**Status:** ⬜ Not Started
**Duration:** 5-7 days (40-56 hours)
**Risk Level:** MEDIUM (requires careful integration)

**Goals:**
- Integrate repository pattern into existing codebase
- Implement feature flags for gradual rollout
- Create abstraction layer supporting both databases

**Key Activities:**

#### 2.1 Create Database Abstraction Layer
```javascript
// src/database/DataLayer.js
class DataLayer {
  constructor(config = {}) {
    this.useLegacy = process.env.USE_LEGACY_SUPABASE === 'true';
    this.useRepositories = process.env.USE_REPOSITORY_PATTERN === 'true';

    if (this.useRepositories) {
      this.client = new ClientRepository(postgres);
      this.service = new ServiceRepository(postgres);
      // ... other repositories
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
}
```

#### 2.2 Implement Feature Flags
```bash
# .env configuration
USE_LEGACY_SUPABASE=true           # Current default
USE_REPOSITORY_PATTERN=false       # Enable after Phase 2 complete
ENABLE_DUAL_WRITE=false            # Enable in Phase 3
```

#### 2.3 Update Services to Use DataLayer
- Replace direct `SupabaseDataLayer` imports
- Use abstraction layer instead
- Maintain backward compatibility

#### 2.4 Testing Strategy
- Test with `USE_REPOSITORY_PATTERN=true` (Timeweb)
- Test with `USE_LEGACY_SUPABASE=true` (Supabase)
- Ensure identical behavior
- Performance benchmarking

**Success Criteria:**
- Application runs with both database backends
- All tests pass with both configurations
- No functional regressions
- Performance meets or exceeds Supabase baseline

---

### **Phase 3: Data Migration** (3-5 days)

**Status:** ⬜ Not Started
**Duration:** 3-5 days (24-40 hours)
**Risk Level:** HIGH (data integrity critical)

**Goals:**
- Migrate all business data from Supabase to Timeweb
- Implement dual-write mechanism
- Verify data integrity

**Data to Migrate:**

| Table | Estimated Rows | Priority | Dependencies |
|-------|---------------|----------|--------------|
| companies | 1 | HIGH | None |
| clients | 1,299 | CRITICAL | companies |
| services | 63 | HIGH | companies |
| staff | 12 | HIGH | companies |
| staff_schedules | ~100 | MEDIUM | staff |
| bookings | 38 | CRITICAL | clients, services, staff |
| dialog_contexts | ~50 | MEDIUM | None |
| reminders | ~20 | LOW | bookings |

**Migration Strategy:**

#### 3.1 Export Phase (Day 1)
```bash
# Export data from Supabase
npm run export:supabase -- --table=companies
npm run export:supabase -- --table=clients
# ... for each table

# Output: data/exports/supabase/{table}.json
```

#### 3.2 Validation Phase (Day 1)
- Verify export completeness
- Check data integrity
- Validate foreign key relationships
- Document any data issues

#### 3.3 Import Phase (Day 2)
```bash
# Import to Timeweb PostgreSQL
npm run import:timeweb -- --table=companies --verify
npm run import:timeweb -- --table=clients --verify
# ... for each table

# Includes verification after each import
```

#### 3.4 Dual-Write Setup (Day 3)
```javascript
// Enable dual-write in DataLayer
async upsertClient(clientData) {
  const results = [];

  // Write to Timeweb (primary)
  const timewebResult = await this.client.upsert(clientData);
  results.push({ db: 'timeweb', ...timewebResult });

  // Write to Supabase (backup)
  if (process.env.ENABLE_DUAL_WRITE === 'true') {
    const supabaseResult = await this.legacy.upsertClient(clientData);
    results.push({ db: 'supabase', ...supabaseResult });
  }

  return timewebResult; // Return primary result
}
```

#### 3.5 Verification Phase (Day 4-5)
- Compare Timeweb vs Supabase data
- Run consistency checks
- Validate all relationships
- Performance testing with real data

**Success Criteria:**
- All data migrated (100% row count match)
- Data integrity verified (checksums, foreign keys)
- Dual-write operational
- Zero data loss or corruption
- Rollback procedure tested

---

### **Phase 4: Testing & Validation** (2-3 days + 48h parallel run)

**Status:** ⬜ Not Started
**Duration:** 2-3 days active work + 48 hours monitoring
**Risk Level:** MEDIUM (thorough testing required)

**Goals:**
- Validate all functionality with Timeweb database
- Performance benchmarking
- Parallel run with production traffic

**Testing Levels:**

#### 4.1 Unit Testing (Day 1)
- All repository methods
- Data layer abstraction
- Feature flag behavior
- Error handling

#### 4.2 Integration Testing (Day 1-2)
- End-to-end user flows
- WhatsApp message processing
- Booking creation/modification
- Client search and retrieval
- Service catalog operations

#### 4.3 Performance Testing (Day 2)
```bash
# Benchmark queries
npm run benchmark -- --database=supabase
npm run benchmark -- --database=timeweb

# Compare results
# Expected: Timeweb 20-50x faster (internal network)
```

#### 4.4 Load Testing (Day 2)
- Simulate production load
- Concurrent users
- Peak traffic scenarios
- Database connection pooling

#### 4.5 Parallel Run (48 hours)
```bash
# Enable Timeweb for test number only
export USE_REPOSITORY_PATTERN=true
export TEST_PHONE=89686484488  # Only this number uses Timeweb

# Production traffic stays on Supabase
# Monitor both systems
```

**Monitoring During Parallel Run:**
- Query performance (Timeweb vs Supabase)
- Error rates
- Data consistency
- Resource usage
- Response times

**Success Criteria:**
- All tests passing
- Performance meets or exceeds Supabase
- 48 hours stable parallel run
- Zero critical errors
- Data consistency maintained

---

### **Phase 5: Production Cutover** (2-4 hours downtime)

**Status:** ⬜ Not Started
**Duration:** 2-4 hours
**Risk Level:** HIGH (production impact)

**Goals:**
- Switch all production traffic to Timeweb
- Minimize downtime
- Ensure zero data loss

**Timeline:**

| Time | Duration | Activity | Status |
|------|----------|----------|--------|
| 02:00 | 10 min | Final Supabase data sync | Downtime |
| 02:10 | 5 min | Enable dual-write verification | Downtime |
| 02:15 | 5 min | Flip feature flags | Downtime |
| 02:20 | 10 min | Smoke tests | Downtime |
| 02:30 | 30 min | Intensive monitoring | Restored |
| 03:00 | 180 min | Extended monitoring | Operational |

**Cutover Steps:**

#### 5.1 Pre-Cutover (Day before)
- [ ] Client notification (24h advance)
- [ ] Final backup of Supabase data
- [ ] Team on standby
- [ ] Rollback plan documented

#### 5.2 Cutover Window (02:00-02:30)
```bash
# 1. Stop new writes to Supabase
pm2 stop ai-admin-worker-v2
pm2 stop ai-admin-api

# 2. Final data sync from Supabase
npm run sync:final -- --verify

# 3. Update .env
USE_LEGACY_SUPABASE=false         # Disable Supabase
USE_REPOSITORY_PATTERN=true       # Enable Timeweb
ENABLE_DUAL_WRITE=false           # No longer needed

# 4. Restart services
pm2 start all

# 5. Smoke tests
curl http://localhost:3000/health
# Test WhatsApp message
# Verify booking creation
```

#### 5.3 Verification (02:30-03:00)
- All services online
- WhatsApp connected
- Database queries working
- Test messages processing
- No critical errors

#### 5.4 Extended Monitoring (03:00-06:00)
- Error logs
- Performance metrics
- Data consistency checks
- User reports

**Rollback Procedure (<10 minutes):**
```bash
# If issues detected:
pm2 stop all

# Revert .env
USE_LEGACY_SUPABASE=true
USE_REPOSITORY_PATTERN=false

pm2 start all

# Verify Supabase operational
curl http://localhost:3000/health
```

**Success Criteria:**
- Downtime <4 hours (target: 2 hours)
- All services operational
- Zero data loss
- Performance meets expectations
- Rollback tested and ready

---

## 📊 Timeline Summary

| Phase | Duration | Dates (Est) | Cumulative |
|-------|----------|-------------|------------|
| Phase 1: Repository Pattern | 2-3 days | Nov 10-12 | 3 days |
| Phase 2: Code Integration | 5-7 days | Nov 13-19 | 10 days |
| Phase 3: Data Migration | 3-5 days | Nov 20-24 | 15 days |
| Phase 4: Testing & Validation | 2-3 days + 48h | Nov 25-29 | 19 days |
| Phase 5: Production Cutover | 4 hours | Nov 30 02:00 | 19 days |

**Total Duration:** ~3 weeks (conservative estimate)
**Start Date:** November 10, 2025
**Target Completion:** November 30, 2025

---

## 🎯 Success Metrics

### **Primary Metrics:**
- ✅ Zero data loss (100% data migrated and verified)
- ✅ Downtime <4 hours (target: 2 hours)
- ✅ Performance improvement: 20-50x query speed
- ✅ Zero critical errors post-cutover
- ✅ All services operational

### **Secondary Metrics:**
- Response time <10ms for simple queries
- All tests passing (100% coverage)
- Documentation complete
- Team trained on new system
- Rollback procedure tested

---

## ⚠️ Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Data corruption during migration | 15% | CRITICAL | Dual-write + verification + backups |
| Extended downtime (>4h) | 20% | HIGH | Parallel preparation, tested rollback |
| Performance regression | 10% | MEDIUM | Benchmarking, load testing |
| Integration bugs | 30% | MEDIUM | Extensive testing, gradual rollout |
| Feature flag issues | 15% | MEDIUM | Testing both configurations |
| Database connection pool exhaustion | 10% | LOW | Connection pooling setup |

---

## 📚 Related Documents

- **Context:** `database-migration-context.md` - Current state and decisions
- **Tasks:** `database-migration-tasks.md` - Detailed task breakdown
- **History:** `../datacenter-migration-msk-spb/` - Previous plan (archived)
- **Guides:**
  - Phase 0 Report: `../datacenter-migration-msk-spb/PHASE_0_EXECUTION_REPORT.md`
  - Phase 0.8 Report: `../datacenter-migration-msk-spb/PHASE_08_EXECUTION_REPORT.md`

---

**Last Updated:** 2025-11-09
**Next Review:** After Phase 1 completion
**Owner:** DevOps Team
**Status:** Active - Phase 1 Ready to Start
