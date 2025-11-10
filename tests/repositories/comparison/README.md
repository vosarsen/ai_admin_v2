# Comparison Tests - Backend Validation

## Overview

This directory contains comparison tests that verify **identical behavior** between:
- **Supabase SDK** (legacy backend)
- **Repository Pattern** (new backend with Timeweb PostgreSQL)

## Test Strategy

Due to module caching in Node.js, we cannot dynamically switch backends within a single test run.

Instead, we run the same test suite **twice** with different environment configurations:

### Run 1: Supabase Backend
```bash
USE_REPOSITORY_PATTERN=false npm test -- tests/repositories/comparison/DataLayerComparison.test.js
```

### Run 2: Repository Pattern Backend
```bash
USE_REPOSITORY_PATTERN=true npm test -- tests/repositories/comparison/DataLayerComparison.test.js
```

## Comparison Script

Use the provided script to run both tests and compare results:

```bash
cd /opt/ai-admin
npm run test:comparison
```

This script will:
1. Run tests with Supabase backend
2. Run tests with Repository Pattern backend
3. Compare results for discrepancies
4. Generate a comparison report

## Expected Results

All 25 tests should pass with both backends:
- Dialog Context methods (2 tests)
- Client methods (7 tests)
- Staff methods (2 tests)
- Schedule methods (3 tests)
- Service methods (4 tests)
- Company methods (2 tests)
- Edge cases (5 tests)

If any test passes with one backend but fails with another, it indicates a discrepancy that needs investigation.

## Phase 3 Acceptance Criteria

✅ All 25 tests pass with **both** backends
✅ No discrepancies in behavior
✅ No data differences (same queries return same results)
✅ Edge cases handled identically (NULL, empty arrays, invalid IDs)

## See Also

- `DataLayerComparison.test.js` - The test suite
- `../../scripts/run-comparison-tests.sh` - Comparison script
- `../../../dev/active/database-migration-revised/PHASE_3_*.md` - Phase 3 documentation
