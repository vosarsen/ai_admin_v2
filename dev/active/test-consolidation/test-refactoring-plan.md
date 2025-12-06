# Test Structure Refactoring Plan v2.0

**Date:** 2025-12-05
**Status:** Ready for Execution
**Estimated Effort:** 10-12 hours (revised from 12-16)
**Risk Level:** Medium (with strong mitigation strategies)
**Version:** 2.0 (incorporates plan-reviewer feedback)

---

## Executive Summary

The AI Admin v2 project has test files scattered across multiple locations with inconsistent organization. This plan consolidates all tests into a single, clean, well-organized structure.

### Key Metrics (Verified)

| Metric | Actual Value | Plan v1 Claimed |
|--------|--------------|-----------------|
| **Tests recognized by Jest** | 23 files | 226 files |
| **Total test files in `tests/`** | 29 files | 152 files |
| **Test files in `src/__tests__/`** | 16 files | 16 files |
| **Root `test-*.js` files** | 56 files | 60 files |
| **Duplicate ` 2.js` files** | 4 confirmed | ~70 estimated |

### Critical Issues Discovered by Review

1. **`src/__tests__/` tests NOT running** - Jest config projects don't include them
2. **`tests/whatsapp/` and `tests/telegram/` NOT running** - Not matched by any Jest project
3. **`test/` directory tests NOT running** - Orphaned from Jest config
4. **File counts were inflated** - Actual active tests: ~45, not 226

---

## Phase 0: Pre-Migration Audit (NEW - 2 hours)

**Purpose:** Establish baseline and discover pre-existing issues before any changes.

### Step 0.1: Document Current Test State

```bash
# Create audit directory
mkdir -p dev/active/test-consolidation/audit

# Document recognized tests
npm test -- --listTests 2>&1 | tee dev/active/test-consolidation/audit/recognized-tests.txt

# Run all tests and capture results
npm test 2>&1 | tee dev/active/test-consolidation/audit/test-results-baseline.txt

# Count actual test execution
npm test -- --listTests 2>/dev/null | grep -v "^$" | wc -l > dev/active/test-consolidation/audit/test-count.txt
```

### Step 0.2: Identify Orphaned Tests

Tests that exist but are NOT being executed:

| Location | Files | Status | Action |
|----------|-------|--------|--------|
| `src/__tests__/**/*.test.js` | 16 | **ORPHANED** - not matched by projects | Will migrate |
| `tests/whatsapp/*.test.js` | 2 | **ORPHANED** - no matching project | Will migrate |
| `tests/telegram/*.test.js` | 4 | **ORPHANED** - no matching project | Will migrate |
| `test/integration/*.test.js` | 3 | **ORPHANED** - not in config | Will migrate |
| `test/e2e/*.e2e.js` | 3 | **ORPHANED** - wrong extension | Will migrate |

**Total Orphaned:** ~28 test files that have NEVER been running!

### Step 0.3: Verify Duplicate Files

```bash
#!/bin/bash
# verify-duplicates.sh

echo "=== Checking telegram duplicates ==="
for file in tests/telegram/*\ 2.js; do
  if [ -f "$file" ]; then
    original="${file/ 2.js/.js}"
    if [ -f "$original" ]; then
      if diff -q "$file" "$original" > /dev/null 2>&1; then
        echo "DUPLICATE (identical): $file"
      else
        echo "DIFFERENT (review manually): $file"
        echo "  Lines in original: $(wc -l < "$original")"
        echo "  Lines in duplicate: $(wc -l < "$file")"
      fi
    else
      echo "NO ORIGINAL: $file (keep this one)"
    fi
  fi
done
```

### Step 0.4: Verify .env.test Exists

```bash
if [ -f .env.test ]; then
  echo "✅ .env.test exists"
  grep -c "=" .env.test | xargs -I {} echo "   Contains {} variables"
else
  echo "❌ .env.test NOT FOUND - integration tests will fail!"
  echo "   Create .env.test before proceeding"
  exit 1
fi
```

### Step 0.5: Document Jest Version

```bash
echo "Jest version: $(npm list jest --depth=0 | grep jest)"
# Expected: jest@30.2.0
```

**Acceptance Criteria for Phase 0:**
- [ ] Baseline test results captured
- [ ] Orphaned tests identified (expected: ~28 files)
- [ ] Duplicates verified (expected: 4 identical)
- [ ] `.env.test` confirmed to exist
- [ ] Jest version documented

---

## Phase 1: Preparation (1 hour)

### Step 1.1: Create Backup

```bash
# Create timestamped backup
tar -czf tests-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  test/ tests/ src/__tests__/ \
  jest.config.js package.json \
  2>/dev/null

echo "✅ Backup created"
```

### Step 1.2: Create Target Directory Structure

```bash
mkdir -p tests/{unit,integration,e2e,fixtures,mocks,helpers,manual,performance,config,setup}
mkdir -p tests/unit/{services,utils,middlewares,integrations,parsers,repositories}
mkdir -p tests/unit/services/ai-admin-v2/modules
mkdir -p tests/integration/{repositories,services,flows,features,integrations,database}
mkdir -p tests/integration/features/reminders
mkdir -p tests/integration/integrations/{whatsapp,telegram,yclients}
mkdir -p tests/manual/{booking,context,marketplace,redis,webhook,whatsapp,yclients}

echo "✅ Directory structure created"
```

### Step 1.3: Git Commit Checkpoint

```bash
git add -A
git commit -m "chore: prepare for test consolidation (backup created)"
```

---

## Phase 2: Migrate Unit Tests (1.5 hours)

**Scope:** 16 files from `src/__tests__/` + 2 files from `tests/unit/`

### Step 2.1: Migrate `src/__tests__/` Files

| Current Location | New Location |
|-----------------|--------------|
| `src/__tests__/middlewares/webhook-auth.test.js` | `tests/unit/middlewares/webhook-auth.test.js` |
| `src/__tests__/utils/data-transformers.test.js` | `tests/unit/utils/data-transformers.test.js` |
| `src/__tests__/utils/secrets-manager.test.js` | `tests/unit/utils/secrets-manager.test.js` |
| `src/__tests__/services/context.test.js` | `tests/unit/services/context.test.js` |
| `src/utils/__tests__/error-messages.test.js` | `tests/unit/utils/error-messages.test.js` |
| `src/utils/__tests__/retry-handler.test.js` | `tests/unit/utils/retry-handler.test.js` |
| `src/utils/__tests__/critical-error-logger.test.js` | `tests/unit/utils/critical-error-logger.test.js` |
| `src/services/ai-admin-v2/__tests__/*.test.js` | `tests/unit/services/ai-admin-v2/*.test.js` |
| `src/services/ai-admin-v2/modules/__tests__/*.test.js` | `tests/unit/services/ai-admin-v2/modules/*.test.js` |

**Migration Script:**
```bash
#!/bin/bash
# migrate-unit-tests.sh

# Migrate src/__tests__/ (preserving structure)
for file in $(find src/__tests__ -name "*.test.js" -type f); do
  # Calculate relative path from src/__tests__/
  relpath="${file#src/__tests__/}"
  target="tests/unit/$relpath"
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target"
  echo "Migrated: $file → $target"
done

# Migrate src/utils/__tests__/
for file in src/utils/__tests__/*.test.js; do
  if [ -f "$file" ]; then
    target="tests/unit/utils/$(basename "$file")"
    cp "$file" "$target"
    echo "Migrated: $file → $target"
  fi
done

# Migrate src/services/ai-admin-v2/__tests__/
for file in src/services/ai-admin-v2/__tests__/*.test.js; do
  if [ -f "$file" ]; then
    target="tests/unit/services/ai-admin-v2/$(basename "$file")"
    cp "$file" "$target"
    echo "Migrated: $file → $target"
  fi
done

# Migrate src/services/ai-admin-v2/modules/__tests__/
for file in src/services/ai-admin-v2/modules/__tests__/*.test.js; do
  if [ -f "$file" ]; then
    target="tests/unit/services/ai-admin-v2/modules/$(basename "$file")"
    cp "$file" "$target"
    echo "Migrated: $file → $target"
  fi
done

echo "✅ Unit test files copied"
```

### Step 2.2: Update Import Paths

Each migrated file needs import path updates. Example:

```javascript
// Before (in src/__tests__/utils/data-transformers.test.js):
const transformers = require('../../utils/data-transformers');

// After (in tests/unit/utils/data-transformers.test.js):
const transformers = require('../../../src/utils/data-transformers');
```

**Automated Update Script:**
```bash
#!/bin/bash
# update-unit-imports.sh

for file in tests/unit/**/*.test.js; do
  if [ -f "$file" ]; then
    # Calculate depth from tests/unit/
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    # Subtract 2 for tests/unit/
    prefix_depth=$((depth - 2))

    # Generate correct prefix (e.g., ../../../src/)
    prefix=""
    for ((i=0; i<prefix_depth; i++)); do
      prefix="../$prefix"
    done
    prefix="${prefix}src/"

    # Update require paths (simple replacement)
    sed -i.bak "s|require('\\.\\./|require('${prefix}|g" "$file"
    sed -i.bak "s|require('\\.\\./\\.\\./|require('${prefix}|g" "$file"

    rm -f "$file.bak"
  fi
done
```

### Step 2.3: Reorganize Existing `tests/unit/` Files

| Current | New |
|---------|-----|
| `tests/unit/notion-parser.test.js` | `tests/unit/parsers/notion-parser.test.js` |
| `tests/unit/whatsapp/phone-utils.test.js` | `tests/unit/integrations/whatsapp/phone-utils.test.js` |

### Step 2.4: Verify Unit Tests

```bash
# Quick verification
npm test -- --selectProjects unit --listTests

# Full run
npm test -- --selectProjects unit
```

**Acceptance Criteria:**
- [ ] All 18 unit tests migrated
- [ ] Import paths updated
- [ ] `npm run test:unit` passes
- [ ] Git commit completed

---

## Phase 3: Migrate Integration Tests (2 hours)

**Scope:** ~15 integration test files

### Step 3.1: Consolidate Repository Tests

Current `tests/repositories/` structure will be flattened:

| Current | New | Type |
|---------|-----|------|
| `tests/repositories/AppointmentsCacheRepository.test.js` | `tests/integration/repositories/` | Integration |
| `tests/repositories/BaseRepository.test.js` | `tests/integration/repositories/` | Integration |
| `tests/repositories/ClientRepository.test.js` | `tests/integration/repositories/` | Integration |
| `tests/repositories/integration/*.test.js` | `tests/integration/repositories/` | Integration |
| `tests/repositories/unit/BaseRepository.test.js` | `tests/unit/repositories/` | Unit |

```bash
# Move repository integration tests
mv tests/repositories/*.test.js tests/integration/repositories/
mv tests/repositories/integration/*.test.js tests/integration/repositories/

# Move unit repository test
mkdir -p tests/unit/repositories
mv tests/repositories/unit/BaseRepository.test.js tests/unit/repositories/
```

### Step 3.2: Migrate WhatsApp and Telegram Tests

| Current | New |
|---------|-----|
| `tests/whatsapp/whatsapp.test.js` | `tests/integration/integrations/whatsapp/whatsapp.test.js` |
| `tests/whatsapp/whatsapp.integration.test.js` | `tests/integration/integrations/whatsapp/whatsapp-client.test.js` |
| `tests/telegram/telegram-manager.test.js` | `tests/integration/integrations/telegram/telegram-manager.test.js` |
| `tests/telegram/telegram-errors.test.js` | `tests/integration/integrations/telegram/telegram-errors.test.js` |
| `tests/telegram/telegram-rate-limiter.test.js` | `tests/integration/integrations/telegram/telegram-rate-limiter.test.js` |
| `tests/telegram/telegram-webhook.integration.test.js` | `tests/integration/integrations/telegram/telegram-webhook.test.js` |

**Delete duplicates:**
```bash
rm -f "tests/telegram/telegram-webhook.integration.test 2.js"
rm -f "tests/telegram/telegram-errors.test 2.js"
rm -f "tests/telegram/telegram-rate-limiter.test 2.js"
rm -f "tests/telegram/telegram-manager.test 2.js"
```

### Step 3.3: Migrate `test/integration/` Files

| Current | New |
|---------|-----|
| `test/integration/webhook-flow.test.js` | `tests/integration/flows/webhook-flow.test.js` |
| `test/integration/message-processing.test.js` | `tests/integration/flows/message-processing.test.js` |
| `test/integration/booking-flow.test.js` | `tests/integration/flows/booking-flow.test.js` |

### Step 3.4: Verify Integration Tests

```bash
RUN_INTEGRATION_TESTS=true npm test -- --selectProjects integration --listTests
RUN_INTEGRATION_TESTS=true npm test -- --selectProjects integration
```

**Acceptance Criteria:**
- [ ] All repository tests migrated
- [ ] WhatsApp/Telegram tests migrated
- [ ] Duplicate files deleted
- [ ] Integration tests pass
- [ ] Git commit completed

---

## Phase 4: Migrate E2E Tests (1 hour)

**Scope:** 3 e2e files from `test/e2e/`

| Current | New |
|---------|-----|
| `test/e2e/booking-scenario.e2e.js` | `tests/e2e/booking-scenario.test.js` |
| `test/e2e/performance.e2e.js` | `tests/e2e/performance.test.js` |
| `test/e2e/reliability.e2e.js` | `tests/e2e/reliability.test.js` |

**Note:** These tests may be broken (never ran). Verify they work after migration.

```bash
cp test/e2e/*.e2e.js tests/e2e/
# Rename .e2e.js to .test.js
for f in tests/e2e/*.e2e.js; do
  mv "$f" "${f/.e2e.js/.test.js}"
done
```

---

## Phase 5: Handle Manual/Root Tests (1 hour)

### Step 5.1: Archive Root Test Files

```bash
mkdir -p archive/root-test-scripts

# Move all root test files
for file in test-*.js; do
  if [ -f "$file" ]; then
    mv "$file" archive/root-test-scripts/
  fi
done

echo "✅ Moved $(ls archive/root-test-scripts/ | wc -l) files to archive"
```

### Step 5.2: Keep Manual Tests Organized

The `tests/manual/` directory is already well-organized. Add README:

```markdown
# Manual Tests

These are debugging/manual tests - NOT automated by Jest.

## Running Manual Tests

```bash
node tests/manual/whatsapp/test-send-message.js
node tests/manual/booking/test-create-booking.js
```

## Structure

- `booking/` - Booking flow testing
- `context/` - Context service testing
- `marketplace/` - YClients marketplace testing
- `redis/` - Redis connection testing
- `webhook/` - Webhook testing
- `whatsapp/` - WhatsApp client testing
- `yclients/` - YClients API testing
```

---

## Phase 6: Update Configuration (1 hour)

### Step 6.1: New jest.config.js

```javascript
// jest.config.js (UPDATED)
require('dotenv').config({ path: '.env.test' });

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/index.js',
    '!src/workers/index-v2.js',
    '!src/instrument.js'
  ],
  testTimeout: 60000,
  clearMocks: true,
  verbose: true,

  // Single unified config with projects
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup/unit.setup.js'],
      testTimeout: 30000
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup/unit.setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
      testTimeout: 60000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup/unit.setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
      testTimeout: 120000
    }
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/archive/',
    '/tests/manual/'
  ]
};
```

**Key Changes from Current Config:**
1. Removed fragile `testPathIgnorePatterns: process.env.RUN_INTEGRATION_TESTS ? [] : ['.*']`
2. Use `<rootDir>` for clarity
3. Removed separate `repositories` project (merged into `integration`)
4. All tests now run by default with `--selectProjects`

### Step 6.2: Create Setup Files

**`tests/setup/unit.setup.js`:**
```javascript
// tests/setup/unit.setup.js
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock logger to reduce noise
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));
```

**`tests/setup/integration.setup.js`:**
```javascript
// tests/setup/integration.setup.js
require('dotenv').config({ path: '.env.test' });
const logger = require('../../src/utils/logger');

jest.setTimeout(60000);

beforeAll(async () => {
  logger.info('Starting integration test suite');
});

afterAll(async () => {
  // Close connections
  try {
    const postgres = require('../../src/database/postgres');
    if (postgres.pool) {
      await postgres.pool.end();
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});
```

### Step 6.3: Update package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration",
    "test:e2e": "jest --selectProjects e2e",
    "test:all": "jest",
    "test:watch": "jest --watch --selectProjects unit",
    "test:coverage": "jest --coverage --selectProjects unit integration",
    "test:cleanup": "node scripts/cleanup-test-data.js",
    "test:cleanup:dry-run": "node scripts/cleanup-test-data.js --dry-run"
  }
}
```

**Key Changes:**
- Removed `RUN_INTEGRATION_TESTS` env var requirement
- Use `--selectProjects` for filtering
- All tests run by default

---

## Phase 7: Cleanup and Verification (1 hour)

### Step 7.1: Remove Old Directories

**Only after ALL tests pass:**

```bash
# Remove old src/__tests__/ directories
find src -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null

# Remove old test/ directory
rm -rf test/

# Remove old structure in tests/
rm -rf tests/repositories/integration/
rm -rf tests/repositories/unit/
rm -rf tests/repositories/comparison/
rm -rf tests/whatsapp/
rm -rf tests/telegram/

# Remove old setup files
rm -f src/__tests__/setup.js
rm -f tests/repositories/integration/jest.config.js
```

### Step 7.2: Final Verification

```bash
# All tests should pass
npm run test:unit
npm run test:integration
npm run test:e2e

# Coverage should be maintained
npm run test:coverage

# List all tests
npm test -- --listTests
```

### Step 7.3: Create Documentation

**`tests/README.md`:**
```markdown
# AI Admin v2 Test Suite

## Structure

- `unit/` - Fast, isolated tests (no external dependencies)
- `integration/` - Tests with real dependencies (DB, Redis, APIs)
- `e2e/` - End-to-end tests (full system)
- `fixtures/` - Test data
- `mocks/` - Mock implementations
- `helpers/` - Test utilities
- `manual/` - Manual/debugging tests (NOT automated)
- `performance/` - Performance benchmarks
- `setup/` - Test setup files

## Running Tests

```bash
# Unit tests only (fast)
npm run test:unit

# Integration tests (requires DB + Redis)
npm run test:integration

# E2E tests (full environment)
npm run test:e2e

# All tests
npm test

# With coverage
npm run test:coverage
```

## Writing Tests

- Place unit tests in `tests/unit/` mirroring `src/` structure
- Place integration tests in appropriate subdirectory under `tests/integration/`
- Use `.test.js` extension for all automated tests
- Keep manual/debugging scripts in `tests/manual/`

## Cleanup

```bash
npm run test:cleanup
```
```

---

## Execution Timeline (Revised)

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 0 | 2h | Pre-Migration Audit (NEW) |
| Phase 1 | 1h | Preparation |
| Phase 2 | 1.5h | Unit Tests |
| Phase 3 | 2h | Integration Tests |
| Phase 4 | 1h | E2E Tests |
| Phase 5 | 1h | Manual/Root Tests |
| Phase 6 | 1h | Configuration |
| Phase 7 | 1h | Cleanup |
| **Total** | **10.5h** | + 1.5h buffer = **12h max** |

**Recommended Schedule:**
- **Day 1:** Phase 0 + 1 + 2 (4.5h)
- **Day 2:** Phase 3 + 4 + 5 (4h)
- **Day 3:** Phase 6 + 7 + buffer (3.5h)

---

## Risk Assessment (Updated)

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **Pre-existing broken tests** | HIGH | CONFIRMED | Phase 0 documents baseline |
| **Import path breakage** | HIGH | Medium | Automated scripts + manual review |
| **Jest 30 incompatibilities** | MEDIUM | Low | Test config changes before full migration |
| **Missing test files** | LOW | Low | Complete inventory in Phase 0 |
| **Database connection issues** | MEDIUM | Low | Verify `.env.test` exists |

---

## Rollback Strategy

After each phase, git commit with clear message:
```bash
git commit -m "test(consolidation): Phase N - [description]"
```

To rollback any phase:
```bash
git revert HEAD  # Revert last phase
# OR
git checkout HEAD~1 -- tests/ jest.config.js package.json  # Selective revert
```

Full restore from backup:
```bash
tar -xzf tests-backup-YYYYMMDD-HHMMSS.tar.gz
```

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Test locations | 8 | 1 |
| Tests recognized by Jest | 23 | ~45 |
| Orphaned tests | ~28 | 0 |
| Naming patterns | 5 | 1 |
| Duplicate files | 4+ | 0 |
| Jest configs | 2 | 1 |

---

## Post-Migration Checklist

- [ ] All tests pass (`npm test`)
- [ ] Coverage ≥ baseline
- [ ] Documentation updated (tests/README.md)
- [ ] CLAUDE.md updated with new structure
- [ ] Old directories removed
- [ ] Git commits clean and atomic
- [ ] Team notified of changes

---

**Document Version:** 2.0
**Last Updated:** 2025-12-05
**Status:** Ready for Execution
**Reviewer Feedback:** Incorporated
