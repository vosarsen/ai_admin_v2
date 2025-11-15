# ⚠️ PLAN ARCHIVED - 2025-11-09

This plan has been **ARCHIVED** and replaced with a focused database migration plan.

---

## Why Archived?

**Original Plan Issues:**
1. **Mixed Two Migrations:**
   - Database migration (Supabase → Timeweb PostgreSQL)
   - Server migration (Moscow → St. Petersburg)

2. **Confusing Phases:**
   - Phase 0-0.9: Database work
   - Phase 1-6: Server work
   - No clear separation

3. **Missing Critical Phases:**
   - Code integration phase (repositories → production)
   - Data migration phase (Supabase → Timeweb)

4. **Discovered by plan-reviewer:**
   - Phase 0.9 was targeting TEST files, not production code
   - Would have migrated wrong files and missed production code
   - Multiple fundamental issues in sequencing

---

## New Plan Location

**Active Plan:** `../database-migration-supabase-timeweb/`

**Focus:** Database migration ONLY (Supabase → Timeweb PostgreSQL)

**Files:**
- `database-migration-plan.md` - Complete migration plan
- `database-migration-context.md` - Current state and decisions
- `database-migration-tasks.md` - Detailed task breakdown

---

## What to Keep from This Plan

### ✅ Successfully Completed

**Phase 0: Baileys Session Migration (2025-11-06)**
- Migrated 1 auth + 728 keys to Timeweb PostgreSQL
- WhatsApp connection stable
- See: `PHASE_0_EXECUTION_REPORT.md`

**Phase 0.8: Schema Migration (2025-11-09)**
- Created 19 tables, 129 indexes, 8 functions, 9 triggers
- Zero downtime, 8 minutes execution time
- See: `PHASE_08_EXECUTION_REPORT.md`

### 📚 Valuable Documents to Reference

- `PHASE_0_EXECUTION_REPORT.md` - Baileys migration details
- `PHASE_08_EXECUTION_REPORT.md` - Schema migration details
- `datacenter-migration-msk-spb-context.md` - Historical decisions
- `plan-review-2025-11-08.md` - First plan review findings

---

## Server Migration (Future)

**Status:** Separate project, can be done after database migration

**When:** After successful completion of database migration to Timeweb

**Goal:** Migrate from Moscow datacenter (46.149.70.219) to St. Petersburg datacenter

**Benefit:** Access to internal network, <1ms latency to PostgreSQL

**Timeline:** 2-3 days when needed

---

## Lessons Learned

1. **Separate concerns:** Database migration ≠ Server migration
2. **Use plan-reviewer:** Caught critical issues twice
3. **Verify grep results:** `supabase.from` found tests, not production (`this.db.from`)
4. **Missing phases common:** Code integration and data migration were missed
5. **Timeline estimates:** Database ops 100-1000x overestimated

---

**Archived:** 2025-11-09
**Reason:** Restructured into focused database migration plan
**Status:** Historical reference only
**See:** `../database-migration-supabase-timeweb/` for active plan
