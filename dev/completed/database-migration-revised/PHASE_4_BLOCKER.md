# Phase 4: Data Migration - BLOCKED ❌

**Date:** 2025-11-11
**Status:** ❌ **BLOCKED** - Schema Mismatch
**Duration:** 1 hour (analysis + script creation)

---

## Executive Summary

Phase 4 (Data Migration) **cannot proceed** due to critical schema mismatch between Supabase and Timeweb PostgreSQL.

**Problem:**
- Supabase uses **legacy schema** (old architecture)
- Timeweb uses **new schema** (created in Phase 0.8)
- Schemas are **incompatible** - different column names, structure, and data format

**Impact:**
- ❌ Cannot copy data directly (column names don't match)
- ❌ Phases 1-3 implemented for **wrong schema**
- ⚠️ Need to choose: migrate schema or transform data

---

## Critical Discovery

### Schema Comparison

#### Companies Table Example

**Supabase (Legacy):**
```
id: integer
company_id: integer           ← YClients company ID
yclients_id: integer          ← Same as company_id
title: character varying      ← Company name
address: character varying
phone: character varying
email: character varying
website: character varying
timezone: character varying
working_hours: character varying
coordinate_lat: numeric
coordinate_lon: numeric
currency: character varying
ai_enabled: boolean
sync_enabled: boolean
created_at: timestamp
updated_at: timestamp
last_sync_at: timestamp
raw_data: jsonb              ← Full YClients API response
whatsapp_enabled: boolean
whatsapp_config: jsonb
...
```

**Timeweb (New - Phase 0.8):**
```
id: integer
name: character varying                ← Different from "title"!
yclients_company_id: integer          ← Different from "company_id"!
phone: character varying
email: character varying
website: character varying
marketplace_app_id: character varying  ← NEW field
marketplace_connected_at: timestamp    ← NEW field
marketplace_permissions: jsonb         ← NEW field
settings: jsonb                        ← Different from "raw_data"
timezone: character varying
locale: character varying
is_active: boolean
subscription_status: character varying ← NEW field
created_at: timestamp
updated_at: timestamp
```

### Key Differences

**Column Names:**
- `company_id` → `yclients_company_id`
- `title` → `name`
- `raw_data` → `settings`

**Missing Columns in Timeweb:**
- `address`, `working_hours`, `coordinate_lat/lon`, `currency`
- `ai_enabled`, `sync_enabled`, `last_sync_at`
- `whatsapp_*` columns

**New Columns in Timeweb:**
- `marketplace_*` columns (app_id, connected_at, permissions)
- `subscription_status`, `locale`

**Same Issue for All Tables:**
- ✅ `clients` - different schemas
- ✅ `services` - different schemas
- ✅ `staff` - different schemas
- ✅ `bookings` - different schemas
- ✅ `dialog_contexts` - different schemas

---

## Migration Attempt Results

### Script Created

✅ `scripts/migrate-business-data.js` (249 lines)
- Direct Supabase → Timeweb copy
- Batch processing (100 records/batch)
- Transaction safety
- ON CONFLICT DO UPDATE

### Execution Results

**Tables Attempted:** 7 (companies, clients, services, staff, schedules, bookings, contexts)
**Records Migrated:** 0
**Errors:** 7 (all tables failed)

**Error Examples:**
```
companies:       column "company_id" does not exist
clients:         column "yclients_id" does not exist
services:        column "yclients_id" does not exist
staff:           column "yclients_id" does not exist
staff_schedules: column "staff_name" does not exist
bookings:        column "yclients_record_id" does not exist
dialog_contexts: column "user_id" does not exist
```

**Duration:** 6.88 seconds
**Result:** ❌ Complete failure

---

## Root Cause Analysis

### Phase 0.8 Created Wrong Schema

**What Happened:**
- Phase 0.8 (2025-11-09) created Timeweb schema
- Schema was based on **NEW architecture** design
- Assumed we'd transform data format
- **BUT** Phases 1-3 implemented for **OLD schema**

**Repository Pattern (Phase 1):**
- Methods expect Supabase column names
- Example: `findByPhone()` queries `yclients_id` column
- **But Timeweb has `yclients_company_id`**

**SupabaseDataLayer (Phase 2):**
- Expects `company_id`, `title`, `raw_data`
- **But Timeweb has `yclients_company_id`, `name`, `settings`**

**Phase 3 Tests:**
- Written for Supabase column names
- Would fail even with data in Timeweb

### Why This Wasn't Caught Earlier

1. **Phase 3 blocker masked the issue**
   - Tests failed because "no data"
   - Real issue: "wrong schema"

2. **Repository Pattern never tested**
   - Phase 3b deferred
   - Would have caught schema mismatch

3. **Phase 0.8 schema not reviewed**
   - Assumed schema matched Supabase
   - No verification performed

---

## Options to Proceed

### Option 1: Re-Create Timeweb Schema (Match Supabase)

**Approach:** Drop Timeweb schema, recreate to match Supabase exactly

**Pros:**
- ✅ Simple data migration (direct copy)
- ✅ Phases 1-3 code works unchanged
- ✅ No data transformation needed
- ✅ Fast implementation (1-2 hours)

**Cons:**
- ❌ Lose Phase 0.8 work (schema design)
- ❌ Keep legacy architecture
- ❌ Miss opportunity to improve schema

**Steps:**
1. Export Supabase schema (`pg_dump --schema-only`)
2. Drop Timeweb business tables
3. Import Supabase schema to Timeweb
4. Run migration script (works as-is)
5. Verify data

**Estimated Time:** 2-3 hours

---

### Option 2: Create Data Transformer

**Approach:** Transform data from Supabase format → Timeweb format during migration

**Pros:**
- ✅ Keep new schema (better architecture)
- ✅ Opportunity to clean/normalize data
- ✅ Future-proof design

**Cons:**
- ❌ Complex transformation logic
- ❌ Must rewrite Phases 1-3 for new schema
- ❌ High risk of data loss/corruption
- ❌ Long implementation time (5-7 days)

**Steps:**
1. Analyze all schema differences
2. Create field mapping document
3. Write transformation logic
4. Update Repository Pattern (Phase 1)
5. Update SupabaseDataLayer (Phase 2)
6. Update all tests (Phase 3)
7. Test transformation
8. Execute migration
9. Verify data integrity

**Estimated Time:** 1-2 weeks

---

### Option 3: Hybrid Approach

**Approach:** Keep essential Supabase fields, add new Timeweb fields

**Pros:**
- ✅ Preserve Phase 1-3 work
- ✅ Some schema improvements
- ✅ Moderate complexity

**Cons:**
- ❌ Schema bloat (old + new fields)
- ❌ Still need some transformation
- ❌ Confusing column names

**Steps:**
1. ALTER Timeweb tables to add missing Supabase columns
2. Create transformation for new → old mappings
3. Migrate data
4. Gradually refactor code to use new columns

**Estimated Time:** 3-5 days

---

## Recommendation

**Recommended:** **Option 1 - Re-Create Timeweb Schema**

**Rationale:**
1. **Fastest Path to Production** - 2-3 hours vs 1-2 weeks
2. **Lowest Risk** - Direct copy, no transformation bugs
3. **Preserve Phase 1-3 Work** - All code continues working
4. **Can Refactor Later** - Schema improvements in Phase 6+

**Trade-Off:**
- Lose "new architecture" schema benefits
- Keep legacy column names
- **But:** Can incrementally improve later without blocking migration

**Alternative:**
- If long-term architecture more important than speed
- Choose Option 2 (data transformer)
- Accept 1-2 week delay

---

## What Was Completed

### Phase 4 Work (1 hour)

✅ **Data Analysis:**
- Analyzed Supabase data (7 tables, 1,490 records)
- Documented row counts per table

✅ **Migration Script:**
- Created `migrate-business-data.js` (249 lines)
- Implements direct copy approach
- Transaction safety, batch processing
- **Status:** Written but incompatible with schema

✅ **Schema Analysis:**
- Discovered schema mismatch
- Documented all differences
- Identified root cause

✅ **Options Document:**
- 3 approaches analyzed
- Pros/cons for each
- Time estimates
- Recommendation provided

---

## Next Steps

### Immediate Decision Required

**Question for Team:** Which option to pursue?

1. **Option 1** - Re-create Timeweb schema (fast, safe)
2. **Option 2** - Data transformer (slow, architectural)
3. **Option 3** - Hybrid (middle ground)

### If Option 1 Selected (Recommended)

**Phase 4a: Schema Re-Creation (2-3 hours)**
1. Export Supabase schema
2. Backup Timeweb data (Baileys only)
3. Drop business tables
4. Create tables matching Supabase
5. Restore Baileys data
6. Run migration script
7. Verify data

**Phase 4b: Data Migration (30 minutes)**
1. Execute `migrate-business-data.js`
2. Verify all 1,490 records
3. Test with Repository Pattern
4. Enable `USE_REPOSITORY_PATTERN=true`

**Phase 3b: Testing (2-3 hours)**
1. Run deferred Phase 3b tests
2. Performance benchmarking
3. Load testing

**Phase 5: Production Cutover (1 hour)**
1. Final data sync
2. Switch to Repository Pattern
3. Disable Supabase
4. Monitor

---

## Lessons Learned

### What Went Wrong ✗

1. **Schema Not Verified Early**
   - Phase 0.8 created schema without validation
   - Assumed schema matched Supabase
   - Should have compared immediately

2. **Phase 3 Blocker Masked Real Issue**
   - Tests failed for "no data"
   - Real issue: "wrong schema"
   - Discovered too late

3. **No Schema Documentation**
   - Phase 0.8 didn't document schema decisions
   - No comparison matrix created
   - Hard to spot differences

### What to Do Differently ✓

1. **Verify Schema Immediately After Creation**
   - Compare CREATE TABLE statements
   - Test INSERT with sample data
   - Catch mismatches early

2. **Document Schema Decisions**
   - Why each column exists
   - Mappings from old → new
   - Migration strategy per field

3. **Test End-to-End Earlier**
   - Don't defer critical tests
   - Even without full data, test structure
   - Use sample records

---

## Git Commits

**Phase 4 Work:**
1. `7c28a1d` - feat(phase4): Add business data migration script

**Total:** 1 commit, 249 lines (migration script)

---

## Impact Assessment

### Phases Affected

- ✅ **Phase 0:** Baileys Migration - Unaffected (different tables)
- ✅ **Phase 0.8:** Schema Creation - Need to redo for Option 1
- ❌ **Phase 1:** Repository Pattern - Works for OLD schema only
- ❌ **Phase 2:** Code Integration - Works for OLD schema only
- ❌ **Phase 3a:** Backward Compat - Tested OLD schema
- ❌ **Phase 3b:** Repository Test - Would fail with NEW schema
- ❌ **Phase 4:** Data Migration - BLOCKED
- ❓ **Phase 5:** Production Cutover - Depends on Phase 4 resolution

### Risk Level

**Technical Risk:** HIGH
- Schema incompatibility is critical
- Data corruption risk if wrong transformation

**Timeline Risk:** MEDIUM
- Option 1: +2-3 hours (minimal delay)
- Option 2: +1-2 weeks (significant delay)

**Quality Risk:** LOW (if Option 1)
- Direct copy is safe
- Well-tested approach

---

## Decision Required

⚠️ **BLOCKER:** Cannot proceed with Phase 4 until schema approach decided.

**Please select:**
- [ ] **Option 1:** Re-create Timeweb schema (match Supabase) - RECOMMENDED
- [ ] **Option 2:** Create data transformer (keep new schema)
- [ ] **Option 3:** Hybrid approach (add missing columns)

**After decision:** Can resume Phase 4 implementation.

---

**Phase 4 Status:** ❌ **BLOCKED**
**Blocker:** Schema mismatch between Supabase and Timeweb
**Recommended:** Option 1 (re-create schema)
**Estimated Time to Resolve:** 2-3 hours (Option 1)

**Date:** 2025-11-11 01:00
**Next Step:** Await decision, then implement chosen option

---

## Files Created

- `scripts/migrate-business-data.js` (249 lines) - Migration script (needs compatible schema)
- `dev/active/database-migration-revised/PHASE_4_BLOCKER.md` (this document)

**Git Status:** Clean (blocker documented)
