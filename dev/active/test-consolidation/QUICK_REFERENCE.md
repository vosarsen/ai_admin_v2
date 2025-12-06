# Test Consolidation - Quick Reference Card

**Status:** Planning Complete | **Effort:** 12-16h | **Timeline:** 3 days

---

## 📊 The Numbers

| Metric | Before | After |
|--------|--------|-------|
| Test locations | 8 | 1 |
| Naming patterns | 5 | 1 |
| Duplicate files | ~70 | 0 |
| Jest configs | 2 | 1 |
| Root test files | 60 | 0 |

---

## 🗂️ New Structure (After Migration)

```
tests/
├── unit/              # 50 files - Fast tests, no external deps
├── integration/       # 85 files - Real DB, Redis, APIs
├── e2e/              # 3 files - Full system tests
├── fixtures/          # Test data
├── mocks/            # Mock implementations
├── helpers/          # Test utilities
├── manual/           # 67 files - Manual/debugging (not automated)
├── performance/      # Benchmarks
├── config/           # Test configuration
└── setup/            # Setup files
```

---

## 🚀 New npm Scripts

```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires DB + Redis)
npm run test:integration

# E2E tests (requires full environment)
npm run test:e2e

# All tests
npm run test:all

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Cleanup test data
npm run test:cleanup
```

---

## 📋 Migration Checklist

### Pre-Migration
- [ ] All tests currently passing
- [ ] Create backup: `tar -czf tests-backup-$(date +%Y%m%d).tar.gz test/ tests/ src/__tests__/ test-*.js`
- [ ] Git is clean (`git status`)
- [ ] Team notified

### Phase 1: Preparation (2h)
- [ ] Create new directory structure
- [ ] Document current imports
- [ ] Verify backup exists

### Phase 2: Unit Tests (3h)
- [ ] Migrate `src/__tests__/` → `tests/unit/`
- [ ] Update import paths
- [ ] Run `npm run test:unit` ✅

### Phase 3: Integration Tests (4h)
- [ ] Consolidate repository tests
- [ ] Migrate from 3 locations
- [ ] Run `npm run test:integration` ✅

### Phase 4: E2E Tests (2h)
- [ ] Migrate e2e tests
- [ ] Rename to `*.test.js`
- [ ] Run `npm run test:e2e` ✅

### Phase 5: Manual/Root (2h)
- [ ] Archive 60 root test files
- [ ] Organize manual tests
- [ ] Move utility scripts

### Phase 6: Configuration (1h)
- [ ] Consolidate Jest configs
- [ ] Update setup files
- [ ] Update `package.json` scripts

### Phase 7: Cleanup (2h)
- [ ] Remove old directories
- [ ] Delete duplicates
- [ ] Run `npm run test:all` ✅
- [ ] Run `npm run test:coverage` ✅
- [ ] Update documentation

### Post-Migration
- [ ] All tests passing (100%)
- [ ] Coverage ≥ baseline
- [ ] Documentation updated
- [ ] Team notified
- [ ] CI/CD updated (if applicable)

---

## 🔧 Quick Commands

### Verify Current State
```bash
# Count test files
find test/ tests/ src/__tests__/ -name "*.test.js" | wc -l

# Check duplicates
find . -name "* 2.js" | wc -l

# Run current tests
npm test
```

### During Migration
```bash
# Test specific file
jest path/to/file.test.js

# Test specific directory
jest tests/unit/

# Update imports (example)
sed -i.bak "s|require('../../|require('../../../src/|g" tests/unit/**/*.test.js
```

### Rollback
```bash
# Restore from backup
tar -xzf tests-backup-YYYYMMDD.tar.gz

# Or use git
git checkout HEAD~1 -- test/ tests/ src/__tests__/
```

---

## 🎯 Success Criteria

After migration, you should have:

✅ All tests in `tests/` directory
✅ Consistent `*.test.js` naming
✅ Zero duplicate files
✅ All tests passing (100%)
✅ Coverage ≥ baseline
✅ Single Jest config
✅ Clear separation: unit/integration/e2e
✅ Updated docs
✅ Old directories removed

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `Cannot find module '../../../src/...'` | Update import path depth |
| `Test suite failed to run` | Check jest config syntax |
| `Timeout exceeded` | Increase `testTimeout` in config |
| `Database connection failed` | Check `.env.test` credentials |
| `Redis connection failed` | Ensure Redis running |

---

## 📞 Need Help?

**Full documentation:**
- Complete plan: `test-refactoring-plan.md`
- Summary: `EXECUTIVE_SUMMARY.md`
- Context: `test-consolidation-context.md`

**Questions?**
- Review the detailed plan first
- Check the Q&A section
- Ask team for clarification

---

## ⏱️ Timeline

**Recommended:** 3 days over 1 week

| Day | Hours | Phases |
|-----|-------|--------|
| Day 1 | 4h | Phases 1-2, start Phase 3 |
| Day 2 | 4h | Complete Phase 3, Phases 4-5 |
| Day 3 | 4h | Phases 6-7, verification |

**Buffer:** 2-4h for unexpected issues

---

## 🎓 Learning Resources

**Jest Documentation:**
- Projects: https://jestjs.io/docs/configuration#projects-arraystring--projectconfig
- Setup: https://jestjs.io/docs/configuration#setupfiles-array
- Patterns: https://jestjs.io/docs/configuration#testmatch-arraystring

**Best Practices:**
- Unit tests should be fast (<100ms each)
- Integration tests can be slower (<5s each)
- E2E tests can be slowest (<30s each)
- Use `describe` for grouping, `it` for individual tests
- Name tests clearly: "should [expected behavior]"

---

**Print this card and keep it handy during migration!**

**Last Updated:** 2025-12-05
