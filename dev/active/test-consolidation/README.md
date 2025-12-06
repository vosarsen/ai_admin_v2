# Test Structure Consolidation Project

**Status:** 📋 Planning Complete - Awaiting Approval
**Created:** 2025-12-05
**Estimated Effort:** 12-16 hours
**Timeline:** 3 days (recommended)

---

## Overview

This project consolidates AI Admin v2's scattered test files (350+ files across 8 locations) into a single, well-organized `tests/` directory with clear separation by test type.

---

## Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** | Quick ref card for migration | 2 min |
| **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** | High-level overview | 5 min |
| **[test-refactoring-plan.md](./test-refactoring-plan.md)** | Complete detailed plan | 30 min |
| **[test-consolidation-context.md](./test-consolidation-context.md)** | Context and decisions | 10 min |

**Start here:**
- For quick overview → `EXECUTIVE_SUMMARY.md`
- For migration execution → `QUICK_REFERENCE.md`
- For complete details → `test-refactoring-plan.md`

---

## The Problem

```
Current test structure is chaos:
- 350+ test files across 8 locations
- 5 different naming patterns
- ~70 duplicate files
- 60 test files in project root
- Mixed unit/integration tests
- Difficult to find relevant tests
```

---

## The Solution

```
Single, clean tests/ directory:
- Clear separation: unit/integration/e2e
- Consistent naming: *.test.js
- Zero duplication
- Easy to navigate
- Better developer experience
```

---

## Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Test locations | 8 | 1 | 87.5% reduction |
| Naming patterns | 5 | 1 | Standardized |
| Duplicate files | ~70 | 0 | 100% removed |
| Files in root | 60 | 0 | Cleaned |

---

## Quick Start

### 1. Review the Plan
```bash
# Read the executive summary (5 min)
cat EXECUTIVE_SUMMARY.md

# Review the full plan (30 min)
cat test-refactoring-plan.md
```

### 2. Prepare for Migration
```bash
# Verify all tests pass
npm test

# Create backup
tar -czf tests-backup-$(date +%Y%m%d).tar.gz test/ tests/ src/__tests__/ test-*.js

# Check git is clean
git status
```

### 3. Execute Migration
```bash
# Follow the checklist in QUICK_REFERENCE.md
# Execute phase by phase
# Commit after each phase
# Verify tests after each phase
```

---

## Migration Phases

1. **Preparation (2h)** - Backup, create structure
2. **Unit Tests (3h)** - Migrate unit tests
3. **Integration Tests (4h)** - Consolidate integration tests
4. **E2E Tests (2h)** - Migrate e2e tests
5. **Manual/Root (2h)** - Archive root files
6. **Configuration (1h)** - Consolidate configs
7. **Cleanup (2h)** - Remove old dirs, verify

**Total:** 12-16 hours over 3 days

---

## Success Criteria

After migration:
- ✅ All tests in single `tests/` directory
- ✅ Consistent `*.test.js` naming
- ✅ Zero duplicate files
- ✅ All tests passing (100%)
- ✅ Coverage ≥ baseline
- ✅ Single Jest config
- ✅ Clear separation by test type

---

## Need Help?

**Before starting:**
- Read `EXECUTIVE_SUMMARY.md` for overview
- Read `test-refactoring-plan.md` for details
- Review `QUICK_REFERENCE.md` for commands

**During migration:**
- Follow checklist in `QUICK_REFERENCE.md`
- Refer to detailed steps in `test-refactoring-plan.md`
- Document issues in `test-consolidation-context.md`

**After migration:**
- Update `test-consolidation-context.md` with lessons learned
- Update project `CLAUDE.md` with new test structure
- Communicate changes to team

---

## Questions?

See the "Questions to Consider" section in:
- `EXECUTIVE_SUMMARY.md` (bottom)
- `test-refactoring-plan.md` (Conclusion section)

---

## Project Status

**Planning:** ✅ Complete (2025-12-05)
**Approval:** ⏳ Pending
**Execution:** ⏸️ Not started
**Completion:** ⏸️ Pending

---

## Files in This Directory

```
test-consolidation/
├── README.md (this file)
├── QUICK_REFERENCE.md
├── EXECUTIVE_SUMMARY.md
├── test-refactoring-plan.md
└── test-consolidation-context.md
```

---

**Created by:** Claude Code (Refactor Planner)
**Date:** 2025-12-05
**Version:** 1.0
