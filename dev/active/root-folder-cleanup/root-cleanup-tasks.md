# Root Folder Cleanup - Tasks

**Project:** AI Admin v2 Root Folder Organization
**Created:** 2025-11-25
**Status:** Ready for Execution

## Pre-Execution Checklist

- [ ] Review `root-cleanup-plan.md` (complete plan)
- [ ] Review `root-cleanup-context.md` (decisions & reasoning)
- [ ] Confirm decisions with project owner
- [ ] Create feature branch: `git checkout -b refactor/root-folder-cleanup`
- [ ] Ensure working directory is clean: `git status`
- [ ] Backup current state (optional): `git stash` or create branch

## Phase 1: Prepare Directories (5 min)

**Status:** ⬜ Pending

### Tasks

- [ ] Create docs subdirectories:
  ```bash
  mkdir -p docs/00-getting-started
  mkdir -p docs/01-architecture/integrations
  mkdir -p docs/01-architecture/api
  mkdir -p docs/01-architecture/database
  mkdir -p docs/02-guides/database
  mkdir -p docs/02-guides/deployment
  mkdir -p docs/02-guides/testing
  mkdir -p docs/02-guides/yclients
  mkdir -p docs/04-planning/marketplace
  mkdir -p docs/04-planning/financial
  mkdir -p docs/04-planning/ai-providers
  mkdir -p docs/04-planning/legal
  mkdir -p docs/04-planning/domain
  mkdir -p docs/04-planning/operations
  mkdir -p docs/04-planning/yandex-cloud
  ```

- [ ] Create config subdirectories:
  ```bash
  mkdir -p config/env-templates
  mkdir -p config/api-specs
  mkdir -p config/nginx
  mkdir -p config/deployment
  ```

- [ ] Create scripts subdirectories:
  ```bash
  mkdir -p scripts/reminders
  mkdir -p scripts/testing
  ```

- [ ] Create tests subdirectories:
  ```bash
  mkdir -p tests/config
  mkdir -p tests/integration/reminders
  mkdir -p tests/performance
  ```

- [ ] Verify directories created: `ls -la docs/ config/ scripts/ tests/`

**Estimated Time:** 5 minutes
**Actual Time:** ___

---

## Phase 2: Move Documentation Files (10 min)

**Status:** ⬜ Pending

### 2.1 Onboarding & Team Docs (5 files)

- [ ] `git mv FOR_BROTHER_CLAUDE.md docs/00-getting-started/`
- [ ] `git mv ARBAK_UPDATE_INSTRUCTIONS.md docs/00-getting-started/`
- [ ] `git mv TEAM_SETUP.md docs/00-getting-started/`
- [ ] `git mv CONTRIBUTING.md docs/00-getting-started/`
- [ ] `git mv HANDOFF_NOTES.md docs/00-getting-started/`

### 2.2 Quick Start & Guides (3 files)

- [ ] `git mv PHASE_0_QUICK_START.md docs/00-getting-started/`
- [ ] `git mv QUICK_START_TIMEWEB_POSTGRES.md docs/02-guides/database/`
- [ ] `git mv CHANGELOG.md docs/99-meta/`

### 2.3 YClients Documentation (10 files)

- [ ] `git mv YCLIENTS_API.md docs/01-architecture/integrations/`
- [ ] `git mv YCLIENTS_CALL_TECHNICAL_INFO.md docs/01-architecture/integrations/`
- [ ] `git mv YCLIENTS_COMPLETE_TECHNICAL_SPECIFICATION.md docs/01-architecture/integrations/`
- [ ] `git mv YCLIENTS_DATA_SUMMARY.md docs/01-architecture/integrations/`
- [ ] `git mv YCLIENTS_APP_DESCRIPTION.md docs/04-planning/marketplace/`
- [ ] `git mv YCLIENTS_INTEGRATION_INSTRUCTION.md docs/02-guides/yclients/`
- [ ] `git mv YCLIENTS_MODERATION_CHECKLIST.md docs/04-planning/marketplace/`
- [ ] `git mv YCLIENTS_MODERATION_DATA_USAGE.md docs/04-planning/marketplace/`
- [ ] `git mv YCLIENTS_NEGOTIATION_STRATEGY.md docs/04-planning/marketplace/`
- [ ] `git mv YCLIENTS_SCALE_ANALYSIS.md docs/04-planning/marketplace/`

### 2.4 Cloud & Infrastructure (5 files)

- [ ] `git mv YANDEX_CLOUD_BOOST_PRESENTATION_OUTLINE.md docs/04-planning/yandex-cloud/`
- [ ] `git mv YANDEX_CLOUD_FUNCTIONS_FREE_TIER_ANALYSIS.md docs/04-planning/yandex-cloud/`
- [ ] `git mv YANDEX_CLOUD_GRANT_ANALYSIS.md docs/04-planning/yandex-cloud/`
- [ ] `git mv SUPABASE_STORAGE_SUMMARY.md docs/01-architecture/database/`
- [ ] `git mv DEPLOY_GEMINI_COMMANDS.md docs/02-guides/deployment/`

### 2.5 Financial & Business (6 files)

- [ ] `git mv AI_Admin_Financial_Model.md docs/04-planning/financial/`
- [ ] `git mv Financial_Model_QuickStart.md docs/04-planning/financial/`
- [ ] `git mv Dashboard_Formulas_Guide.md docs/04-planning/financial/`
- [ ] `git mv revenue-share-comparison-2years.md docs/04-planning/financial/`
- [ ] `git mv revenue-share-visualization.html docs/04-planning/financial/`
- [ ] `git mv Inputs_Template.csv docs/04-planning/financial/`
- [ ] `git mv Scaling_Template.csv docs/04-planning/financial/`

### 2.6 Pricing & AI Providers (3 files)

- [ ] `git mv Open_AI_pricing.md docs/04-planning/ai-providers/OpenAI_pricing.md`
- [ ] `git mv claude_pricing.md docs/04-planning/ai-providers/`
- [ ] `git mv gemini_pricing.md docs/04-planning/ai-providers/`

### 2.7 Legal & Trademark (4 files)

- [ ] `git mv trademark-class-38-critical-analysis.md docs/04-planning/legal/`
- [ ] `git mv trademark-class-38-decision-brief.md docs/04-planning/legal/`
- [ ] `git mv trademark-registration-russia-2025.md docs/04-planning/legal/`
- [ ] `git mv trademark-research-sources.md docs/04-planning/legal/`

### 2.8 Domain & Misc (6 files)

- [ ] `git mv domain-availability-research-2025-11-13.md docs/04-planning/domain/`
- [ ] `git mv yclients-partnership-presentation.html docs/04-planning/marketplace/`
- [ ] `git mv СКРИПТ_ДЛЯ_КАТИ_ОБЗВОН_КЛИЕНТОВ.md docs/04-planning/operations/`
- [ ] `git mv test-e2e-reminder.md docs/02-guides/testing/`
- [ ] `git mv openapi.yaml docs/01-architecture/api/`

**Estimated Time:** 10 minutes
**Actual Time:** ___

---

## Phase 3: Move Configuration Files (5 min)

**Status:** ⬜ Pending

### 3.1 Environment Templates (9 files)

- [ ] `git mv .env.for-team config/env-templates/`
- [ ] `git mv .env.from-server config/env-templates/`
- [ ] `git mv .env.mcp config/env-templates/`
- [ ] `git mv .env.mcp.example config/env-templates/`
- [ ] `git mv .env.production config/env-templates/`
- [ ] `git mv .env.production.example config/env-templates/`
- [ ] `git mv .env.team-safe config/env-templates/`
- [ ] `git mv .env.test config/env-templates/`
- [ ] `git mv .env.timeweb.example config/env-templates/`

### 3.2 API Specs (1 file)

- [ ] `git mv timeweb_openapi.json config/api-specs/`

### 3.3 Nginx Configs (5 files)

- [ ] `git mv nginx-ai-admin-fixed.conf config/nginx/`
- [ ] `git mv nginx-ai-admin.conf config/nginx/`
- [ ] `git mv nginx-config-initial.conf config/nginx/`
- [ ] `git mv nginx-config.conf config/nginx/`
- [ ] `git mv nginx-ssl-config.conf config/nginx/`

### 3.4 PM2 Configs (2 files)

- [ ] `git mv ecosystem.config.js config/deployment/`
- [ ] `git mv ecosystem.baileys.config.js config/deployment/`

**Estimated Time:** 5 minutes
**Actual Time:** ___

---

## Phase 4: Move Test Files (5 min)

**Status:** ⬜ Pending

### 4.1 Integration Tests (5 files)

- [ ] `git mv test-auth-state-timeweb.js tests/integration/`
- [ ] `git mv test-production-glitchtip.js tests/integration/`
- [ ] `git mv test-real-patterns.js tests/integration/`
- [ ] `git mv test-sentry-compat.js tests/integration/`
- [ ] `git mv test-services-formatting-comparison.js tests/integration/`

### 4.2 Reminder Tests (5 files)

- [ ] `git mv test-final-reminder-showcase.js tests/integration/reminders/`
- [ ] `git mv test-forced-template.js tests/integration/reminders/`
- [ ] `git mv test-multiple-services-reminder.js tests/integration/reminders/`
- [ ] `git mv test-reminder-confirmation.js tests/integration/reminders/`
- [ ] `git mv test-reminder-system.js tests/integration/reminders/`
- [ ] `git mv test-specific-template.js tests/integration/reminders/`

### 4.3 Other Tests (2 files)

- [ ] `git mv test-config.js tests/config/`
- [ ] `git mv test-performance.js tests/performance/`

**Estimated Time:** 5 minutes
**Actual Time:** ___

---

## Phase 5: Move Scripts (2 min)

**Status:** ⬜ Pending

### 5.1 Utility Scripts (2 files)

- [ ] `git mv create-reminder-context.js scripts/reminders/`
- [ ] `git mv create-test-booking.js scripts/testing/`

**Estimated Time:** 2 minutes
**Actual Time:** ___

---

## Phase 6: Update .gitignore (2 min)

**Status:** ⬜ Pending

### 6.1 Add Entries

- [ ] Add to .gitignore:
  ```gitignore
  # macOS system files
  .DS_Store
  **/.DS_Store

  # Runtime state files
  .notion-sync-state.json

  # Verify these are already included:
  # baileys_sessions/
  # baileys_stores/
  # baileys_test_auth/
  # sessions/
  # logs/
  # backups/
  ```

**Estimated Time:** 2 minutes
**Actual Time:** ___

---

## Phase 7: Clean Generated Files (1 min)

**Status:** ⬜ Pending

### 7.1 Remove .DS_Store Files

- [ ] `find . -name ".DS_Store" -type f -delete`
- [ ] Verify removal: `find . -name ".DS_Store" -type f`

**Estimated Time:** 1 minute
**Actual Time:** ___

---

## Phase 8: Update Documentation References (15 min)

**Status:** ⬜ Pending

### 8.1 Update CLAUDE.md

- [ ] Find all references to moved files
- [ ] Update paths (search for file names, replace with new paths)
- [ ] Test all links/references

**Key files to update:**
```markdown
# Examples of changes needed:

# Before:
cat FOR_BROTHER_CLAUDE.md
cat TEAM_SETUP.md

# After:
cat docs/00-getting-started/FOR_BROTHER_CLAUDE.md
cat docs/00-getting-started/TEAM_SETUP.md
```

### 8.2 Update README.md

- [ ] Check for references to moved files
- [ ] Update any links
- [ ] Test all links

### 8.3 Update Other Documentation

- [ ] Check `docs/README.md` for references
- [ ] Update `docs/00-getting-started/TEAM_SETUP.md` if it references files
- [ ] Update `docs/00-getting-started/FOR_BROTHER_CLAUDE.md` if it references files

### 8.4 Check for Code References

- [ ] Search for script imports:
  ```bash
  grep -r "create-reminder-context" src/
  grep -r "create-test-booking" src/
  ```
- [ ] Update any import paths in code

**Estimated Time:** 15 minutes
**Actual Time:** ___

---

## Phase 9: Verify & Commit (5 min)

**Status:** ⬜ Pending

### 9.1 Verification

- [ ] Check git status: `git status`
- [ ] Review changes: `git diff --stat`
- [ ] Verify no broken imports: `npm test` (or relevant test command)
- [ ] Check root folder: `ls -la` (should have ~10-15 files)
- [ ] Verify moved files exist in new locations

### 9.2 Commit Changes

- [ ] Stage all changes: `git add -A`
- [ ] Commit with descriptive message:
  ```bash
  git commit -m "refactor: reorganize root folder - move 81 files to appropriate subdirectories

  - Move 42 documentation files to /docs (organized by category)
  - Move 9 env templates to config/env-templates/
  - Move 5 nginx configs to config/nginx/
  - Move 2 PM2 configs to config/deployment/
  - Move 15 test files to /tests (organized by type)
  - Move 2 utility scripts to /scripts
  - Update .gitignore for generated files
  - Remove .DS_Store files
  - Update CLAUDE.md and README.md with new paths
  - Keep 10-15 essential files in root

  Root folder reduced from 86 files to ~15 files.

  Related: Root folder cleanup initiative
  See: dev/active/root-folder-cleanup/root-cleanup-plan.md"
  ```

### 9.3 Final Checks

- [ ] Review commit: `git show --stat`
- [ ] Create PR or push to branch:
  ```bash
  git push origin refactor/root-folder-cleanup
  ```

**Estimated Time:** 5 minutes
**Actual Time:** ___

---

## Post-Execution Checklist

- [ ] Create Pull Request on GitHub
- [ ] Review PR for any issues
- [ ] Run CI/CD tests (if available)
- [ ] Test deployment in staging environment
- [ ] Get code review from team
- [ ] Merge PR to main
- [ ] Update project documentation
- [ ] Notify team of new file locations
- [ ] Close this task in project tracker

---

## Rollback Plan (If Needed)

If issues arise:

### Option 1: Revert Commit
```bash
git revert HEAD
```

### Option 2: Reset (before push)
```bash
git reset --hard HEAD~1
```

### Option 3: Cherry-pick (selective restore)
```bash
git checkout HEAD~1 -- path/to/file
```

---

## Success Metrics

**Before:**
- 86 files in root
- Cluttered, hard to navigate
- Mixed file types

**After:**
- ~10-15 files in root (essential only)
- Clean, professional structure
- Files organized by type/purpose

**Verification:**
- [ ] Root folder has <15 files
- [ ] All tests passing
- [ ] No broken imports/requires
- [ ] Documentation updated
- [ ] Git history preserved
- [ ] Team can find files easily

---

## Timeline Summary

| Phase | Tasks | Est. Time | Actual Time |
|-------|-------|-----------|-------------|
| 1. Prepare Directories | 4 task groups | 5 min | ___ |
| 2. Move Documentation | 42 files | 10 min | ___ |
| 3. Move Configs | 17 files | 5 min | ___ |
| 4. Move Tests | 13 files | 5 min | ___ |
| 5. Move Scripts | 2 files | 2 min | ___ |
| 6. Update .gitignore | 1 task | 2 min | ___ |
| 7. Clean Generated | 1 task | 1 min | ___ |
| 8. Update References | 4 task groups | 15 min | ___ |
| 9. Verify & Commit | 3 task groups | 5 min | ___ |
| **TOTAL** | **83 tasks** | **50 min** | **___** |

---

## Notes

### Files Remaining in Root After Cleanup

**Essential (5):**
1. package.json
2. package-lock.json
3. .gitignore
4. README.md
5. CLAUDE.md

**Templates (2):**
6. .env.example
7. .mcp.json.example

**Config (1):**
8. jest.config.js

**Docker (3) - Optional:**
9. Dockerfile
10. docker-compose.yml
11. docker-compose.test.yml

**Scripts (2) - Optional:**
12. start-work.sh
13. launch-claude.sh

**Total:** 10-15 files (vs 86 before)

---

**Last Updated:** 2025-11-25
**Status:** Ready for execution
**Next Step:** Start Phase 1
