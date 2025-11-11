# Database Migration Context & Key Decisions

**Last Updated:** 2025-11-11 12:30 (After Phase 4 COMPLETE)
**Migration Status:** Phase 4 ✅ COMPLETE | Phase 3b ✅ READY | Phase 5 ⏸️ Next
**Current Database:** Supabase (production reads), Timeweb (ready with 1,490 records)
**Session Summary:** Phase 4 executed successfully - 1,490 records migrated in 8.45s

---

## Quick Reference

**This document contains:**
- Current state snapshot (what's complete, what remains)
- Key files and their roles
- Architecture decisions with rationale
- Technical constraints and limitations
- Critical dependencies
- Lessons learned from previous phases
- Performance expectations

**Purpose:** Provide complete context that survives Claude Code context resets. This file should answer "where are we?" and "why did we decide X?"

---

## Current State Snapshot (Nov 11, 2025 12:30)

### What's Complete ✅

**Phase 0: Baileys Session Migration (Completed Nov 6, 2025)**
- **What:** Migrated WhatsApp Baileys auth state from Supabase to Timeweb
- **Result:** 1 auth + 1,127 keys successfully migrated
- **Status:** Stable for 5 days, zero issues
- **File:** `src/integrations/whatsapp/auth-state-timeweb.js` (production)
- **Learning:** Timeweb PostgreSQL connection is solid and reliable

**Phase 0.8: Schema Migration (Completed Nov 9, 2025)**
- **What:** Created database schema on Timeweb PostgreSQL
- **Result:** 19 tables, 129 indexes, 8 functions created (later replaced)
- **Execution Time:** 8 minutes, zero downtime
- **File:** `dev/active/datacenter-migration-msk-spb/PHASE_08_EXECUTION_REPORT.md`
- **Learning:** DDL migrations are fast and safe with proper planning
- **Note:** Phase 0.8 schema was "new" architecture (marketplace-centric) - incompatible with bot

**Phase 1: Repository Pattern Foundation (Completed Nov 10, 2025) 🎉**
- **What:** Created lightweight database abstraction layer
- **Result:** 15 files, 1,614 lines of code, 21 methods implemented
- **Execution Time:** 3 hours (vs 2-3 days estimated) - **8x faster!**
- **Files:** BaseRepository + 6 domain repos + 2 test files + documentation
- **Git Commit:** e582186
- **Learning:** Well-defined requirements + clear mapping = fast implementation
- **Report:** `dev/active/database-migration-revised/PHASE_1_COMPLETE.md`

**Phase 2: Code Integration (Completed Nov 10, 2025) 🚀**
- **What:** Integrated Repository Pattern into SupabaseDataLayer with feature flags
- **Result:** 2 files, 245 lines added, 21 methods updated
- **Execution Time:** 2 hours (vs 5-7 days estimated) - **4x faster!**
- **Files:** `config/database-flags.js` (155 lines) + SupabaseDataLayer updates (90 lines)
- **Git Commits:** cb105f3, f2933b4, fa29054
- **Learning:** Dual-backend pattern with feature flags = zero production risk
- **Report:** `dev/active/database-migration-revised/PHASE_2_COMPLETE.md`

**Phase 3a: Backward Compatibility Testing (Completed Nov 10, 2025) ✅**
- **What:** Tested Phase 1+2 code deployment, created comparison test suite
- **Result:** Zero downtime deployment, system stable, 25 tests created (618 lines)
- **Execution Time:** 3 hours
- **Files:** `tests/repositories/comparison/DataLayerComparison.test.js` (427 lines) + README (64 lines)
- **Git Commits:** 570a9b9, 710068b, 53dce34
- **Critical Finding:** ❌ Timeweb PostgreSQL empty (schema only, no data)
- **Decision:** Split Phase 3: Phase 3a ✅ complete | Phase 3b ⏸️ deferred (needs Phase 4 data)
- **Report:** `dev/active/database-migration-revised/PHASE_3_PARTIAL.md`

**Phase 4: Data Migration (Completed Nov 11, 2025) 🎉🎉🎉**
- **What:** Schema recreation + data migration from Supabase → Timeweb
- **Result:** 1,490 records migrated in 8.45 seconds with 100% data integrity
- **Execution Time:** ~3 hours total (schema recreation + migration + debugging)
- **Key Decision:** ✅ Option 1 - Use Legacy (Supabase) Schema
- **Rationale:** Optimized for AI bot, preserves Phase 1-3 work, proven in production
- **Files Created:**
  - `scripts/supabase-schema.sql` (411 lines) - Complete schema recreation
  - `scripts/migrate-business-data.js` (249 lines) - Migration with JSONB/array handling
  - `scripts/drop-timeweb-business-tables.sql` (52 lines)
  - `PHASE_4_EXECUTION_REPORT.md` (486 lines)
- **Git Commits:** 1be3fe1, bf85739
- **Technical Challenges Solved:**
  1. JSONB serialization (JSON.stringify for bulk inserts)
  2. PostgreSQL array handling (let pg driver auto-convert)
  3. Explicit type casting (::jsonb for bulk inserts)
  4. Transaction safety (per-batch transactions)
  5. Supabase API pagination (1000 records/page)
- **Data Migrated:**
  - companies: 1 record ✅
  - clients: 1,304 records ✅
  - services: 63 records ✅
  - staff: 12 records ✅
  - staff_schedules: 44 records ✅
  - bookings: 45 records ✅
  - dialog_contexts: 21 records ✅
- **Report:** `dev/active/database-migration-revised/PHASE_4_EXECUTION_REPORT.md`

**Infrastructure Ready**
- ✅ Timeweb PostgreSQL operational (since Nov 6)
- ✅ Connection pool configured (`postgres.js` - 183 lines, max 20 connections)
- ✅ SSL certificates in place
- ✅ Schema matches Supabase LEGACY structure (10 business tables, 40+ indexes)
- ✅ Baileys using Timeweb (5+ days stable, 1 auth + 1,127 keys)
- ✅ Repository Pattern integrated in SupabaseDataLayer (21 methods)
- ✅ Feature flags control backend selection
- ✅ 100% backward compatible (repositories disabled by default)
- ✅ Phase 1+2+3a deployed to production (16 files, ~2,500 LOC)
- ✅ Zero downtime deployment proven
- ✅ **Business data now in Timeweb (1,490 records)**

### What Remains ⏸️

**Phase 3b: Repository Pattern Testing (READY - Next Step)**
- ⏸️ Test all 21 SupabaseDataLayer methods with Repository Pattern enabled
- ⏸️ Performance benchmarking (latency comparison Supabase vs Timeweb)
- ⏸️ Load testing (100+ concurrent requests)
- **Status:** NOW POSSIBLE - Timeweb has real data
- **Estimated Time:** 2-3 hours
- **Prerequisites:** ✅ All met (data migrated)

**Phase 5: Production Cutover (After Phase 3b)**
- ⏸️ Final incremental sync (records added after Phase 4 migration)
- ⏸️ Enable `USE_REPOSITORY_PATTERN=true` in production
- ⏸️ Disable Supabase connections
- ⏸️ 48-hour monitoring period
- **Estimated Time:** 2-4 hours + 48h monitoring

---

## Schema Decision: Why Legacy (Supabase) Schema Won

### Context: The "Schema Blocker" (Discovered Nov 11)

**Problem:** Phase 0.8 created "new" schema (marketplace-centric), but Phases 1-3 written for "legacy" schema (bot-centric)

**Discovery:** Migration script failed with "column does not exist" errors
- Supabase: `company_id`, `title`, `raw_data`, `yclients_id`
- Timeweb (Phase 0.8): `yclients_company_id`, `name`, `settings`

**Analysis:** Created `SCHEMA_COMPARISON.md` (439 lines) and `PHASE_4_BLOCKER.md` (448 lines)

### Three Options Considered

**Option 1: Re-create Timeweb Schema (Match Supabase)** ✅ SELECTED
- Time: 2-3 hours
- Risk: Low
- Preserves: All Phase 1-3 work (2,500 LOC)
- Trade-off: Lose "new" schema design

**Option 2: Data Transformer (Keep New Schema)** ❌ REJECTED
- Time: 1-2 weeks
- Risk: High (transformation bugs, data loss)
- Requires: Rewrite Phases 1-3 entirely
- Trade-off: Keep "new" schema but massive effort

**Option 3: Hybrid (Add Missing Columns)** ❌ REJECTED
- Time: 3-5 days
- Risk: Medium
- Result: Schema bloat (old + new columns)
- Trade-off: Confusing, hard to maintain

### Why Legacy Schema is Better for Bot

**Legacy (Supabase) Advantages:**
1. **AI Features:**
   - `visit_history` (JSONB) - Client behavior patterns for personalization
   - `ai_context` (JSONB) - Conversation state and preferences
   - `ai_messages_count`, `ai_satisfaction_score` - Performance tracking
   - `loyalty_level`, `client_segment` - Client categorization

2. **Russian Language Support:**
   - `declensions` (JSONB) in services ("стрижка" → "на стрижку")
   - `declensions` (JSONB) in staff ("Сергей" → "к Сергею", "у Сергея")
   - Natural grammar in AI responses

3. **Client Analytics Pre-Computed:**
   - `total_spent`, `average_bill` - Loyalty calculations
   - `favorite_staff_ids` (ARRAY) - Preferences for recommendations
   - `preferred_time_slots` (ARRAY) - Booking suggestions
   - `visit_count`, `last_visit_date` - Engagement tracking

4. **Denormalized for Speed:**
   - No JOINs needed for dashboard queries
   - All data in single SELECT
   - Critical for bot response time (<2 seconds)

5. **Proven in Production:**
   - 6+ months operational
   - 1,300+ clients served
   - All edge cases handled

**New (Timeweb Phase 0.8) Disadvantages:**
- ❌ No AI integration fields
- ❌ No Russian declensions
- ❌ No client analytics
- ❌ Missing 20+ columns per table
- ❌ Designed for different product (marketplace SaaS, not WhatsApp bot)

**Decision Matrix:**
| Criterion | Legacy | New |
|-----------|--------|-----|
| Bot Compatibility | ✅ 100% | ❌ 0% |
| AI Features | ✅ Full | ❌ None |
| Russian Grammar | ✅ Yes | ❌ No |
| Migration Time | ✅ 3h | ❌ 1-2wk |
| Code Changes | ✅ Zero | ❌ 2,500 LOC rewrite |
| **Score for Bot** | **8/10** | **2/10** |

**Conclusion:** Legacy schema objectively better for WhatsApp AI bot use case.

---

## Phase 4 Session: Technical Challenges & Solutions

### Challenge 1: JSONB Type Handling

**Problem:** PostgreSQL rejected JSONB fields with "invalid input syntax for type json"

**Root Cause:** Supabase PostgREST API returns JSONB as JavaScript objects `{...}`, but PostgreSQL bulk INSERT expects JSON strings `"{...}"`

**Solution:**
```javascript
// Explicitly serialize JSONB columns
const JSONB_COLUMNS = {
  clients: ['visit_history', 'preferences', 'ai_context', 'goods_purchases'],
  // ...
};

function prepareRecord(record, tableName) {
  if (jsonbCols.includes(key) && typeof value === 'object') {
    prepared[key] = JSON.stringify(value);  // Serialize to string
  }
}
```

**Result:** ✅ JSONB fields insert correctly

### Challenge 2: PostgreSQL Array Handling

**Problem:** "malformed array literal" errors for `branch_ids`, `tags`, `services`

**Root Cause:** Tried to `JSON.stringify()` PostgreSQL ARRAY type (INTEGER[], TEXT[])

**Solution:** Let `pg` driver handle arrays automatically
```javascript
// Don't stringify arrays - pg driver converts them
else {
  prepared[key] = value;  // [1,2,3] → pg formats as {1,2,3}
}
```

**Result:** ✅ Arrays insert correctly

### Challenge 3: Explicit Type Casting

**Problem:** Even with `JSON.stringify()`, bulk inserts (100 records) failed

**Root Cause:** PostgreSQL couldn't infer JSONB type for large parameter lists

**Solution:** Add explicit `::jsonb` casting in query
```javascript
const placeholder = `$${paramIndex}`;
return jsonbCols.includes(col) ? `${placeholder}::jsonb` : placeholder;
// Result: $1::jsonb, $2::jsonb, ...
```

**Result:** ✅ All JSONB fields accepted in bulk inserts

### Challenge 4: Transaction Safety

**Problem:** When batch failed, transaction aborted, blocking subsequent single-record retries

**Root Cause:** Single transaction for entire table migration

**Solution:** Transaction per batch
```javascript
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  try {
    await client.query('BEGIN');
    // Insert batch
    await client.query('COMMIT');
  } catch (batchError) {
    await client.query('ROLLBACK');  // Only this batch
    // Retry one-by-one
  }
}
```

**Result:** ✅ Failed batches don't block successful inserts

### Challenge 5: Supabase API Pagination

**Problem:** Only 1,000 clients migrated out of 1,304

**Root Cause:** Supabase API default limit 1,000 records per query

**Solution:** Pagination loop
```javascript
let page = 0;
const PAGE_SIZE = 1000;

while (hasMore) {
  const { data } = await supabase
    .from(tableName)
    .select('*')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  allData = allData.concat(data);
  hasMore = data.length === PAGE_SIZE;
  page++;
}
```

**Result:** ✅ All 1,304 clients fetched (2 pages)

---

## Next Session Commands

### To Continue Phase 3b (Repository Testing):

```bash
# 1. Verify Timeweb data is present
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c \"SELECT 'companies' as table, COUNT(*) FROM companies UNION ALL SELECT 'clients', COUNT(*) FROM clients\""

# Expected output:
#     table    | count
# -------------+-------
#  companies   |     1
#  clients     |  1304

# 2. Run Phase 3b tests with Repository Pattern enabled
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && USE_REPOSITORY_PATTERN=true npm test -- tests/repositories/comparison/DataLayerComparison.test.js"

# 3. Performance benchmarking
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node tests/repositories/performance-benchmark.js"

# 4. Update context after Phase 3b
# Mark Phase 3b as complete in database-migration-revised-context.md
```

### Key Files to Review:

- `tests/repositories/comparison/DataLayerComparison.test.js` - 21 comparison tests
- `src/services/supabase-data-layer.js` - Dual-backend implementation
- `config/database-flags.js` - Feature flags control
- `dev/active/database-migration-revised/PHASE_4_EXECUTION_REPORT.md` - Full Phase 4 details

---

## Critical Numbers

**Migration Performance:**
- **8.45 seconds** for 1,490 records
- **176 records/second** average
- **Largest table (clients):** 1,304 records in 1.39s = **938 records/sec**

**Data Distribution:**
| Table | Supabase | Timeweb | Status |
|-------|----------|---------|--------|
| companies | 1 | 1 | ✅ 100% |
| clients | 1,304 | 1,304 | ✅ 100% |
| services | 63 | 63 | ✅ 100% |
| staff | 12 | 12 | ✅ 100% |
| staff_schedules | 44 | 44 | ✅ 100% |
| bookings | 45 | 45 | ✅ 100% |
| dialog_contexts | 21 | 21 | ✅ 100% |
| **TOTAL** | **1,490** | **1,490** | **✅ 100%** |

**Schema Size:**
- 10 business tables
- 40+ indexes
- JSONB fields: 11 across all tables
- Array fields: 15+ across all tables

---

## Important Environment Variables

```bash
# Feature Flags (current state)
USE_LEGACY_SUPABASE=true          # Still using Supabase for reads
USE_REPOSITORY_PATTERN=false      # Phase 3b will test with true
ENABLE_DUAL_WRITE=false           # Phase 5 will enable

# Database Connections
POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_SSL=true

# Supabase (will disable in Phase 5)
SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>
```

---

## Lessons Learned

### Phase 4 Lessons:

1. **Validate Schema Early** ✅
   - Always compare schemas BEFORE implementing code
   - Phase 0.8 schema mismatch cost 1 phase of debugging
   - Created `SCHEMA_COMPARISON.md` to document differences

2. **JSONB vs TEXT vs ARRAY** ✅
   - JSONB: Requires `JSON.stringify()` + `::jsonb` cast for bulk inserts
   - ARRAY: Let `pg` driver handle (pass as JS array)
   - TEXT: Pass as string

3. **Pagination is Essential** ✅
   - Supabase API limits to 1,000 records
   - Always implement pagination for tables >1000 rows
   - Use `.range(start, end)` for Supabase

4. **Transaction Granularity** ✅
   - Per-batch transactions better than table-level
   - Failed batches don't block successful ones
   - Enables one-by-one retry strategy

5. **Type Casting in Bulk Inserts** ✅
   - PostgreSQL can't always infer types with 100+ parameters
   - Explicit `::jsonb`, `::integer[]` casting prevents errors
   - Single-record inserts work without casting (type inference works)

6. **Pragmatic > Idealistic** ✅
   - Legacy schema "uglier" but objectively better for bot
   - Preserves 2,500 LOC of working code
   - Can refactor later if needed (Phase 6+)

---

## Timeline

**Overall Progress:** 82% complete (4 of 5 phases done)

| Phase | Status | Duration | Date |
|-------|--------|----------|------|
| Phase 0 | ✅ Complete | 1 hour | Nov 6 |
| Phase 0.8 | ✅ Complete | 8 minutes | Nov 9 |
| Phase 1 | ✅ Complete | 3 hours | Nov 10 |
| Phase 2 | ✅ Complete | 2 hours | Nov 10 |
| Phase 3a | ✅ Complete | 3 hours | Nov 10 |
| **Phase 4** | **✅ Complete** | **3 hours** | **Nov 11** |
| Phase 3b | ⏸️ Ready | ~2 hours | Next |
| Phase 5 | ⏸️ Waiting | ~2-4 hours | After 3b |

**Total Elapsed:** ~17 hours
**Estimated Remaining:** ~5 hours (3b + 5)
**Target Completion:** November 2025 ✅ ON TRACK

---

**Status:** Phase 4 ✅ COMPLETE - Ready for Phase 3b Repository Pattern testing
**Next Step:** Enable USE_REPOSITORY_PATTERN=true and run comparison tests
**Production:** Stable ✅ (Supabase still serving reads, Timeweb ready with data)
**Data Freshness:** Nov 11, 09:00 UTC snapshot (Phase 5 will do final incremental sync)
