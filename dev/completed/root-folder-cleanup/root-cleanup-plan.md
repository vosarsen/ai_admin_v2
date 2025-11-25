# Root Folder Cleanup Plan

**Created:** 2025-11-25
**Analyst:** Claude Code (Refactor Planner)
**Current Directory:** /Users/vosarsen/Documents/GitHub/ai_admin_v2.nosync

## Executive Summary

The root folder contains **86 files** (excluding directories), creating significant organizational debt. This plan categorizes all files and provides actionable steps to organize them into appropriate subdirectories.

**Key Findings:**
- 42 documentation files (49%) - many should move to `/docs`
- 15 test files (17%) - should move to `/tests` or `/test-data`
- 11 configuration files (13%) - some should move to `/config`
- 8 script files (9%) - should move to `/scripts`
- 5 generated/state files (6%) - should be in `.gitignore`
- 5 keep in root (6%) - essential files

## File Categorization

### 1. KEEP IN ROOT (5 files)
Essential project files that must stay in root for tooling/standards.

| File | Type | Reasoning |
|------|------|-----------|
| `package.json` | Config | NPM standard location |
| `package-lock.json` | Config | NPM standard location |
| `.gitignore` | Config | Git standard location |
| `README.md` | Docs | Project entry point (standard) |
| `CLAUDE.md` | Docs | Claude Code quick reference (standard) |

**Action:** None required

---

### 2. DOCUMENTATION → Move to `/docs` (42 files)

#### 2.1 Onboarding & Team Documentation (5 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `FOR_BROTHER_CLAUDE.md` | `docs/00-getting-started/FOR_BROTHER_CLAUDE.md` | Team onboarding guide |
| `ARBAK_UPDATE_INSTRUCTIONS.md` | `docs/00-getting-started/ARBAK_UPDATE_INSTRUCTIONS.md` | Historical team onboarding |
| `TEAM_SETUP.md` | `docs/00-getting-started/TEAM_SETUP.md` | Team setup instructions |
| `CONTRIBUTING.md` | `docs/00-getting-started/CONTRIBUTING.md` | Contribution guide |
| `HANDOFF_NOTES.md` | `docs/00-getting-started/HANDOFF_NOTES.md` | Project handoff notes |

#### 2.2 Quick Start & Guides (3 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `PHASE_0_QUICK_START.md` | `docs/00-getting-started/PHASE_0_QUICK_START.md` | Migration quick start |
| `QUICK_START_TIMEWEB_POSTGRES.md` | `docs/02-guides/database/QUICK_START_TIMEWEB_POSTGRES.md` | Database-specific guide |
| `CHANGELOG.md` | `docs/99-meta/CHANGELOG.md` | Project changelog |

#### 2.3 YClients Integration Documentation (10 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `YCLIENTS_API.md` | `docs/01-architecture/integrations/YCLIENTS_API.md` | API reference |
| `YCLIENTS_APP_DESCRIPTION.md` | `docs/04-planning/marketplace/YCLIENTS_APP_DESCRIPTION.md` | App description |
| `YCLIENTS_CALL_TECHNICAL_INFO.md` | `docs/01-architecture/integrations/YCLIENTS_CALL_TECHNICAL_INFO.md` | Technical specs |
| `YCLIENTS_COMPLETE_TECHNICAL_SPECIFICATION.md` | `docs/01-architecture/integrations/YCLIENTS_COMPLETE_TECHNICAL_SPECIFICATION.md` | Complete spec |
| `YCLIENTS_DATA_SUMMARY.md` | `docs/01-architecture/integrations/YCLIENTS_DATA_SUMMARY.md` | Data summary |
| `YCLIENTS_INTEGRATION_INSTRUCTION.md` | `docs/02-guides/yclients/YCLIENTS_INTEGRATION_INSTRUCTION.md` | Integration guide |
| `YCLIENTS_MODERATION_CHECKLIST.md` | `docs/04-planning/marketplace/YCLIENTS_MODERATION_CHECKLIST.md` | Moderation checklist |
| `YCLIENTS_MODERATION_DATA_USAGE.md` | `docs/04-planning/marketplace/YCLIENTS_MODERATION_DATA_USAGE.md` | Data usage policy |
| `YCLIENTS_NEGOTIATION_STRATEGY.md` | `docs/04-planning/marketplace/YCLIENTS_NEGOTIATION_STRATEGY.md` | Business strategy |
| `YCLIENTS_SCALE_ANALYSIS.md` | `docs/04-planning/marketplace/YCLIENTS_SCALE_ANALYSIS.md` | Scaling analysis |

#### 2.4 Cloud & Infrastructure (5 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `YANDEX_CLOUD_BOOST_PRESENTATION_OUTLINE.md` | `docs/04-planning/yandex-cloud/YANDEX_CLOUD_BOOST_PRESENTATION_OUTLINE.md` | Planning document |
| `YANDEX_CLOUD_FUNCTIONS_FREE_TIER_ANALYSIS.md` | `docs/04-planning/yandex-cloud/YANDEX_CLOUD_FUNCTIONS_FREE_TIER_ANALYSIS.md` | Cost analysis |
| `YANDEX_CLOUD_GRANT_ANALYSIS.md` | `docs/04-planning/yandex-cloud/YANDEX_CLOUD_GRANT_ANALYSIS.md` | Grant analysis |
| `SUPABASE_STORAGE_SUMMARY.md` | `docs/01-architecture/database/SUPABASE_STORAGE_SUMMARY.md` | Database summary |
| `DEPLOY_GEMINI_COMMANDS.md` | `docs/02-guides/deployment/DEPLOY_GEMINI_COMMANDS.md` | Deployment guide |

#### 2.5 Financial & Business Analysis (5 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `AI_Admin_Financial_Model.md` | `docs/04-planning/financial/AI_Admin_Financial_Model.md` | Financial model |
| `Financial_Model_QuickStart.md` | `docs/04-planning/financial/Financial_Model_QuickStart.md` | Quick start guide |
| `Dashboard_Formulas_Guide.md` | `docs/04-planning/financial/Dashboard_Formulas_Guide.md` | Formula reference |
| `revenue-share-comparison-2years.md` | `docs/04-planning/financial/revenue-share-comparison-2years.md` | Revenue analysis |
| `revenue-share-visualization.html` | `docs/04-planning/financial/revenue-share-visualization.html` | Visualization |

#### 2.6 Pricing & AI Providers (3 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `Open_AI_pricing.md` | `docs/04-planning/ai-providers/OpenAI_pricing.md` | Pricing research |
| `claude_pricing.md` | `docs/04-planning/ai-providers/claude_pricing.md` | Pricing research |
| `gemini_pricing.md` | `docs/04-planning/ai-providers/gemini_pricing.md` | Pricing research |

#### 2.7 Legal & Trademark Research (4 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `trademark-class-38-critical-analysis.md` | `docs/04-planning/legal/trademark-class-38-critical-analysis.md` | Legal analysis |
| `trademark-class-38-decision-brief.md` | `docs/04-planning/legal/trademark-class-38-decision-brief.md` | Legal decision |
| `trademark-registration-russia-2025.md` | `docs/04-planning/legal/trademark-registration-russia-2025.md` | Legal guide |
| `trademark-research-sources.md` | `docs/04-planning/legal/trademark-research-sources.md` | Research sources |

#### 2.8 Domain Research & Misc (7 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `domain-availability-research-2025-11-13.md` | `docs/04-planning/domain/domain-availability-research-2025-11-13.md` | Research document |
| `yclients-partnership-presentation.html` | `docs/04-planning/marketplace/yclients-partnership-presentation.html` | Presentation |
| `СКРИПТ_ДЛЯ_КАТИ_ОБЗВОН_КЛИЕНТОВ.md` | `docs/04-planning/operations/СКРИПТ_ДЛЯ_КАТИ_ОБЗВОН_КЛИЕНТОВ.md` | Operations script |
| `test-e2e-reminder.md` | `docs/02-guides/testing/test-e2e-reminder.md` | Test documentation |
| `Inputs_Template.csv` | `docs/04-planning/financial/Inputs_Template.csv` | Template file |
| `Scaling_Template.csv` | `docs/04-planning/financial/Scaling_Template.csv` | Template file |
| `openapi.yaml` | `docs/01-architecture/api/openapi.yaml` | API specification |

---

### 3. CONFIGURATION FILES (11 files)

#### 3.1 Keep in Root (5 files)

| File | Reasoning |
|------|-----------|
| `.env` | Standard location (in .gitignore) |
| `.env.example` | Template for team |
| `.mcp.json` | Claude Code MCP config |
| `.mcp.json.example` | Template for team |
| `jest.config.js` | Jest standard location |

#### 3.2 Move to `/config` (6 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `.env.for-team` | `config/env-templates/.env.for-team` | Team template |
| `.env.from-server` | `config/env-templates/.env.from-server` | Server reference |
| `.env.mcp` | `config/env-templates/.env.mcp` | MCP template |
| `.env.mcp.example` | `config/env-templates/.env.mcp.example` | MCP template |
| `.env.production` | `config/env-templates/.env.production` | Production reference |
| `.env.production.example` | `config/env-templates/.env.production.example` | Production template |
| `.env.team-safe` | `config/env-templates/.env.team-safe` | Team safe template |
| `.env.test` | `config/env-templates/.env.test` | Test environment |
| `.env.timeweb.example` | `config/env-templates/.env.timeweb.example` | Timeweb template |
| `timeweb_openapi.json` | `config/api-specs/timeweb_openapi.json` | API specification |

**Note:** `.env` stays in root (gitignored), all others are templates/references.

---

### 4. DEPLOYMENT & INFRASTRUCTURE (7 files)

#### 4.1 Move to `/config/deployment` (4 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `Dockerfile` | Keep in root OR move to `config/deployment/Dockerfile` | Docker standard (can be root or organized) |
| `docker-compose.yml` | Keep in root OR move to `config/deployment/docker-compose.yml` | Docker standard |
| `docker-compose.test.yml` | Keep in root OR move to `config/deployment/docker-compose.test.yml` | Docker standard |
| `ecosystem.config.js` | `config/deployment/ecosystem.config.js` | PM2 config |
| `ecosystem.baileys.config.js` | `config/deployment/ecosystem.baileys.config.js` | PM2 config |

**Recommendation:** Keep Docker files in root for standard tooling compatibility, move PM2 configs to config.

#### 4.2 Move to `/config/nginx` (5 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `nginx-ai-admin-fixed.conf` | `config/nginx/nginx-ai-admin-fixed.conf` | Nginx config |
| `nginx-ai-admin.conf` | `config/nginx/nginx-ai-admin.conf` | Nginx config |
| `nginx-config-initial.conf` | `config/nginx/nginx-config-initial.conf` | Nginx config |
| `nginx-config.conf` | `config/nginx/nginx-config.conf` | Nginx config |
| `nginx-ssl-config.conf` | `config/nginx/nginx-ssl-config.conf` | Nginx config |

---

### 5. TEST FILES → Move to `/tests` or `/test-data` (15 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `test-auth-state-timeweb.js` | `tests/integration/test-auth-state-timeweb.js` | Integration test |
| `test-config.js` | `tests/config/test-config.js` | Test configuration |
| `test-final-reminder-showcase.js` | `tests/integration/reminders/test-final-reminder-showcase.js` | Integration test |
| `test-forced-template.js` | `tests/integration/reminders/test-forced-template.js` | Integration test |
| `test-multiple-services-reminder.js` | `tests/integration/reminders/test-multiple-services-reminder.js` | Integration test |
| `test-performance.js` | `tests/performance/test-performance.js` | Performance test |
| `test-production-glitchtip.js` | `tests/integration/test-production-glitchtip.js` | Integration test |
| `test-real-patterns.js` | `tests/integration/test-real-patterns.js` | Integration test |
| `test-reminder-confirmation.js` | `tests/integration/reminders/test-reminder-confirmation.js` | Integration test |
| `test-reminder-system.js` | `tests/integration/reminders/test-reminder-system.js` | Integration test |
| `test-sentry-compat.js` | `tests/integration/test-sentry-compat.js` | Integration test |
| `test-services-formatting-comparison.js` | `tests/integration/test-services-formatting-comparison.js` | Integration test |
| `test-specific-template.js` | `tests/integration/reminders/test-specific-template.js` | Integration test |

---

### 6. SCRIPTS → Move to `/scripts` (2 files)

| Current File | Target Location | Reasoning |
|--------------|-----------------|-----------|
| `create-reminder-context.js` | `scripts/reminders/create-reminder-context.js` | Utility script |
| `create-test-booking.js` | `scripts/testing/create-test-booking.js` | Test utility |
| `start-work.sh` | Keep in root | Quick access script |
| `launch-claude.sh` | Keep in root | Quick access script |

**Note:** `start-work.sh` and `launch-claude.sh` stay in root for easy access.

---

### 7. GENERATED/STATE FILES → Add to `.gitignore` (5 files)

| File | Action | Reasoning |
|------|--------|-----------|
| `.DS_Store` | DELETE + Add to .gitignore | macOS system file |
| `.notion-sync-state.json` | Keep but ensure in .gitignore | Runtime state file |

**Directories to check for .gitignore:**
- `baileys_sessions/` - Session data (should be gitignored)
- `baileys_stores/` - Store data (should be gitignored)
- `baileys_test_auth/` - Test auth data (should be gitignored)
- `sessions/` - Session data (should be gitignored)
- `logs/` - Log files (should be gitignored)
- `backups/` - Backup files (should be gitignored)

---

## Implementation Plan

### Phase 1: Prepare Directories (5 min)

```bash
# Create target directories
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
mkdir -p config/env-templates
mkdir -p config/api-specs
mkdir -p config/nginx
mkdir -p config/deployment
mkdir -p scripts/reminders
mkdir -p scripts/testing
mkdir -p tests/config
mkdir -p tests/integration/reminders
mkdir -p tests/performance
```

### Phase 2: Move Documentation Files (10 min)

Execute moves for all 42 documentation files as categorized in Section 2.

**Example commands:**
```bash
# Onboarding docs
git mv FOR_BROTHER_CLAUDE.md docs/00-getting-started/
git mv ARBAK_UPDATE_INSTRUCTIONS.md docs/00-getting-started/
git mv TEAM_SETUP.md docs/00-getting-started/
git mv CONTRIBUTING.md docs/00-getting-started/
git mv HANDOFF_NOTES.md docs/00-getting-started/

# YClients docs
git mv YCLIENTS_API.md docs/01-architecture/integrations/
git mv YCLIENTS_APP_DESCRIPTION.md docs/04-planning/marketplace/
# ... (continue for all YClients files)

# Financial docs
git mv AI_Admin_Financial_Model.md docs/04-planning/financial/
git mv Financial_Model_QuickStart.md docs/04-planning/financial/
# ... (continue for all financial files)
```

### Phase 3: Move Configuration Files (5 min)

```bash
# Environment templates
git mv .env.for-team config/env-templates/
git mv .env.from-server config/env-templates/
git mv .env.mcp config/env-templates/
git mv .env.mcp.example config/env-templates/
git mv .env.production config/env-templates/
git mv .env.production.example config/env-templates/
git mv .env.team-safe config/env-templates/
git mv .env.test config/env-templates/
git mv .env.timeweb.example config/env-templates/

# API specs
git mv timeweb_openapi.json config/api-specs/

# Nginx configs
git mv nginx-*.conf config/nginx/

# PM2 configs
git mv ecosystem.config.js config/deployment/
git mv ecosystem.baileys.config.js config/deployment/
```

### Phase 4: Move Test Files (5 min)

```bash
# Integration tests
git mv test-auth-state-timeweb.js tests/integration/
git mv test-production-glitchtip.js tests/integration/
git mv test-real-patterns.js tests/integration/
git mv test-sentry-compat.js tests/integration/
git mv test-services-formatting-comparison.js tests/integration/

# Reminder tests
git mv test-final-reminder-showcase.js tests/integration/reminders/
git mv test-forced-template.js tests/integration/reminders/
git mv test-multiple-services-reminder.js tests/integration/reminders/
git mv test-reminder-confirmation.js tests/integration/reminders/
git mv test-reminder-system.js tests/integration/reminders/
git mv test-specific-template.js tests/integration/reminders/

# Other tests
git mv test-config.js tests/config/
git mv test-performance.js tests/performance/
```

### Phase 5: Move Scripts (2 min)

```bash
git mv create-reminder-context.js scripts/reminders/
git mv create-test-booking.js scripts/testing/
```

### Phase 6: Update .gitignore (2 min)

Add to `.gitignore`:
```gitignore
# macOS system files
.DS_Store
**/.DS_Store

# Runtime state files
.notion-sync-state.json

# Session data (verify these are already included)
baileys_sessions/
baileys_stores/
baileys_test_auth/
sessions/
logs/
backups/

# Environment files (keep .env, ignore the rest)
.env
.env.local
```

### Phase 7: Clean Up Generated Files (1 min)

```bash
# Remove .DS_Store files
find . -name ".DS_Store" -type f -delete
```

### Phase 8: Update Documentation References (15 min)

**Files to update:**
- `CLAUDE.md` - Update paths to moved documentation
- `README.md` - Update links to moved files
- `docs/README.md` - Update directory structure
- Any scripts that reference moved files

**Example updates needed in CLAUDE.md:**
```markdown
# Before
cat FOR_BROTHER_CLAUDE.md

# After
cat docs/00-getting-started/FOR_BROTHER_CLAUDE.md
```

### Phase 9: Verify and Commit (5 min)

```bash
# Check git status
git status

# Verify no broken imports/requires in code
npm test  # Run tests to ensure nothing broke

# Commit the reorganization
git add -A
git commit -m "refactor: reorganize root folder - move 81 files to appropriate subdirectories

- Move 42 documentation files to /docs (organized by category)
- Move 9 env templates to config/env-templates/
- Move 5 nginx configs to config/nginx/
- Move 2 PM2 configs to config/deployment/
- Move 15 test files to /tests (organized by type)
- Move 2 utility scripts to /scripts
- Update .gitignore for generated files
- Remove .DS_Store files
- Keep 5 essential files in root (package.json, README.md, CLAUDE.md, .gitignore, .env.example)

Related: Root folder cleanup initiative
See: dev/active/root-folder-cleanup/root-cleanup-plan.md"
```

---

## Post-Cleanup Root Folder

After cleanup, root should contain only:

**Files (5):**
- `package.json` - NPM config
- `package-lock.json` - NPM lock
- `.gitignore` - Git ignore rules
- `README.md` - Project readme
- `CLAUDE.md` - Claude Code quick reference
- `.env.example` - Environment template
- `.mcp.json.example` - MCP template
- `jest.config.js` - Jest config
- `start-work.sh` - Quick start script (optional: could move to scripts/)
- `launch-claude.sh` - Launch script (optional: could move to scripts/)

**Potentially Keep:**
- `Dockerfile` - Docker standard location
- `docker-compose.yml` - Docker standard location
- `docker-compose.test.yml` - Docker standard location

**Total:** ~10-13 files maximum (vs current 86)

---

## Risk Assessment

### Low Risk
- Moving documentation files (no code dependencies)
- Moving test files (self-contained)
- Moving nginx configs (not imported by code)
- Cleaning .DS_Store files

### Medium Risk
- Moving PM2 configs (deployment scripts may reference)
- Moving environment templates (onboarding docs reference)
- Moving scripts (code may import/reference)

### Mitigation
1. **Use `git mv`** for all moves (preserves history)
2. **Search for imports** before moving scripts:
   ```bash
   grep -r "require.*create-reminder-context" src/
   grep -r "import.*create-test-booking" src/
   ```
3. **Update all documentation** that references moved files
4. **Run full test suite** after moving files
5. **Test deployment** in staging before production

---

## Success Metrics

- [ ] Root folder reduced from 86 files to <15 files
- [ ] All documentation properly categorized in `/docs`
- [ ] All test files in `/tests` directory
- [ ] All configs in `/config` directory
- [ ] All scripts in `/scripts` directory
- [ ] `.gitignore` updated to prevent generated files
- [ ] No broken imports/requires
- [ ] All tests passing
- [ ] Documentation updated with new paths
- [ ] Git history preserved (using `git mv`)

---

## Timeline

**Total Time:** ~50 minutes

| Phase | Duration | Risk |
|-------|----------|------|
| 1. Prepare directories | 5 min | Low |
| 2. Move documentation | 10 min | Low |
| 3. Move configs | 5 min | Medium |
| 4. Move tests | 5 min | Low |
| 5. Move scripts | 2 min | Medium |
| 6. Update .gitignore | 2 min | Low |
| 7. Clean generated files | 1 min | Low |
| 8. Update references | 15 min | Medium |
| 9. Verify & commit | 5 min | Low |

---

## Rollback Plan

If issues arise after cleanup:

```bash
# Revert the commit
git revert HEAD

# Or reset to before cleanup
git reset --hard HEAD~1

# Cherry-pick specific file moves if needed
git checkout HEAD~1 -- path/to/file
```

---

## Future Considerations

### Optional Phase 2 Cleanup
After this initial cleanup, consider:

1. **Archive old configs:** Move old nginx configs to `docs/06-archive/nginx/`
2. **Consolidate test files:** Review if all test files in root are still needed
3. **Script organization:** Further organize scripts/ into subdirectories
4. **Docker decision:** Decide whether to keep Dockerfile in root or move to config/

### Maintenance
- Add linting rule to prevent files in root
- Create `docs/99-meta/ROOT_FOLDER_POLICY.md` with rules
- Add pre-commit hook to warn about root folder files

---

## Appendix: Complete File Inventory

### Current Root Files (86 total)

**Configuration (11):**
1. .env (keep - gitignored)
2. .env.example (keep)
3. .env.for-team (move)
4. .env.from-server (move)
5. .env.mcp (move)
6. .env.mcp.example (move)
7. .env.production (move)
8. .env.production.example (move)
9. .env.team-safe (move)
10. .env.test (move)
11. .env.timeweb.example (move)
12. .gitignore (keep)
13. .mcp.json (keep - gitignored)
14. .mcp.json.example (keep)
15. jest.config.js (keep)
16. timeweb_openapi.json (move)

**Documentation (42):**
17. AI_Admin_Financial_Model.md (move)
18. ARBAK_UPDATE_INSTRUCTIONS.md (move)
19. CHANGELOG.md (move)
20. CLAUDE.md (keep)
21. CONTRIBUTING.md (move)
22. DEPLOY_GEMINI_COMMANDS.md (move)
23. Dashboard_Formulas_Guide.md (move)
24. FOR_BROTHER_CLAUDE.md (move)
25. Financial_Model_QuickStart.md (move)
26. HANDOFF_NOTES.md (move)
27. Inputs_Template.csv (move)
28. Open_AI_pricing.md (move)
29. PHASE_0_QUICK_START.md (move)
30. QUICK_START_TIMEWEB_POSTGRES.md (move)
31. README.md (keep)
32. SUPABASE_STORAGE_SUMMARY.md (move)
33. Scaling_Template.csv (move)
34. TEAM_SETUP.md (move)
35. YANDEX_CLOUD_BOOST_PRESENTATION_OUTLINE.md (move)
36. YANDEX_CLOUD_FUNCTIONS_FREE_TIER_ANALYSIS.md (move)
37. YANDEX_CLOUD_GRANT_ANALYSIS.md (move)
38. YCLIENTS_API.md (move)
39. YCLIENTS_APP_DESCRIPTION.md (move)
40. YCLIENTS_CALL_TECHNICAL_INFO.md (move)
41. YCLIENTS_COMPLETE_TECHNICAL_SPECIFICATION.md (move)
42. YCLIENTS_DATA_SUMMARY.md (move)
43. YCLIENTS_INTEGRATION_INSTRUCTION.md (move)
44. YCLIENTS_MODERATION_CHECKLIST.md (move)
45. YCLIENTS_MODERATION_DATA_USAGE.md (move)
46. YCLIENTS_NEGOTIATION_STRATEGY.md (move)
47. YCLIENTS_SCALE_ANALYSIS.md (move)
48. claude_pricing.md (move)
49. domain-availability-research-2025-11-13.md (move)
50. gemini_pricing.md (move)
51. openapi.yaml (move)
52. revenue-share-comparison-2years.md (move)
53. revenue-share-visualization.html (move)
54. test-e2e-reminder.md (move)
55. trademark-class-38-critical-analysis.md (move)
56. trademark-class-38-decision-brief.md (move)
57. trademark-registration-russia-2025.md (move)
58. trademark-research-sources.md (move)
59. yclients-partnership-presentation.html (move)
60. СКРИПТ_ДЛЯ_КАТИ_ОБЗВОН_КЛИЕНТОВ.md (move)

**Deployment (7):**
61. Dockerfile (keep or move)
62. docker-compose.test.yml (keep or move)
63. docker-compose.yml (keep or move)
64. ecosystem.baileys.config.js (move)
65. ecosystem.config.js (move)
66. nginx-ai-admin-fixed.conf (move)
67. nginx-ai-admin.conf (move)
68. nginx-config-initial.conf (move)
69. nginx-config.conf (move)
70. nginx-ssl-config.conf (move)

**Tests (15):**
71. test-auth-state-timeweb.js (move)
72. test-config.js (move)
73. test-final-reminder-showcase.js (move)
74. test-forced-template.js (move)
75. test-multiple-services-reminder.js (move)
76. test-performance.js (move)
77. test-production-glitchtip.js (move)
78. test-real-patterns.js (move)
79. test-reminder-confirmation.js (move)
80. test-reminder-system.js (move)
81. test-sentry-compat.js (move)
82. test-services-formatting-comparison.js (move)
83. test-specific-template.js (move)

**Scripts (4):**
84. create-reminder-context.js (move)
85. create-test-booking.js (move)
86. launch-claude.sh (keep or move)
87. start-work.sh (keep or move)

**Generated (2):**
88. .DS_Store (delete)
89. .notion-sync-state.json (ensure gitignored)

**NPM (2):**
90. package.json (keep)
91. package-lock.json (keep)

---

## Questions for Project Owner

Before executing this plan, confirm:

1. **Docker files location:** Keep `Dockerfile` and `docker-compose*.yml` in root (standard) or move to `config/deployment/`?
   - **Recommendation:** Keep in root for Docker tooling compatibility

2. **Quick access scripts:** Keep `start-work.sh` and `launch-claude.sh` in root or move to `scripts/`?
   - **Recommendation:** Keep in root for easy access (common pattern)

3. **Old configs:** Archive or delete old nginx configs (5 versions)?
   - **Recommendation:** Keep most recent, move others to `docs/06-archive/nginx/`

4. **Test file consolidation:** Some test files look similar/old - delete or keep all?
   - **Recommendation:** Move all for now, review and delete after verification

5. **Environment templates:** 9 .env templates - which are actually needed?
   - **Recommendation:** Keep all but organize in `config/env-templates/`

---

**End of Plan**
