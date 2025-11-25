# Root Folder Cleanup Project

**Status:** 📋 Planning Complete, Ready for Execution
**Created:** 2025-11-25
**Priority:** Medium
**Estimated Time:** 50 minutes

## Overview

Comprehensive reorganization of the project root folder to improve maintainability, developer experience, and professional appearance.

## The Problem

```
Current State:
/ai_admin_v2.nosync/
├── 86 FILES IN ROOT ❌
├── .claude/
├── .github/
├── docs/
├── scripts/
└── ... (other directories)

Target State:
/ai_admin_v2.nosync/
├── 10-15 ESSENTIAL FILES ✅
├── .claude/
├── .github/
├── docs/
├── scripts/
└── ... (other directories)
```

**Current Issues:**
- 42 documentation files scattered in root
- 15 test files mixed with production code
- 11 configuration files (many duplicates)
- Hard to find files, cluttered workspace
- Confusing for new developers

## The Solution

Reorganize 81 files into appropriate subdirectories:

| Category | Files | Destination |
|----------|-------|-------------|
| Documentation | 42 | `/docs` (organized by category) |
| Env Templates | 9 | `/config/env-templates/` |
| Nginx Configs | 5 | `/config/nginx/` |
| PM2 Configs | 2 | `/config/deployment/` |
| Test Files | 15 | `/tests` (organized by type) |
| Utility Scripts | 2 | `/scripts` |
| Keep in Root | 10-15 | Root (essential only) |
| Delete | 1 | .DS_Store |

## Project Files

### 📋 [root-cleanup-plan.md](./root-cleanup-plan.md)
**1,004 lines** - Complete execution plan with:
- Full file categorization (all 86 files)
- Detailed move plan (exact source → destination)
- Risk assessment and mitigation
- Phase-by-phase implementation guide
- Success metrics and verification steps
- Rollback plan
- Questions for project owner

**Use this for:** Understanding the complete strategy and execution details

### 📝 [root-cleanup-context.md](./root-cleanup-context.md)
**350 lines** - Context and decisions:
- Current state analysis
- Key decisions and reasoning
- Risk assessment
- Next steps
- Related documentation

**Use this for:** Understanding why decisions were made

### ✅ [root-cleanup-tasks.md](./root-cleanup-tasks.md)
**503 lines** - Executable checklist:
- 9 phases with individual tasks
- 83 total tasks with checkboxes
- Time estimates per phase
- Verification steps
- Rollback procedures

**Use this for:** Step-by-step execution

## Quick Start

### For Execution Agent

1. **Review the plan:**
   ```bash
   cat dev/active/root-folder-cleanup/root-cleanup-plan.md
   ```

2. **Review decisions:**
   ```bash
   cat dev/active/root-folder-cleanup/root-cleanup-context.md
   ```

3. **Execute checklist:**
   ```bash
   cat dev/active/root-folder-cleanup/root-cleanup-tasks.md
   # Follow phase by phase, checking off tasks
   ```

4. **Create feature branch:**
   ```bash
   git checkout -b refactor/root-folder-cleanup
   ```

5. **Start with Phase 1:**
   - Create all subdirectories
   - Then proceed to Phase 2-9

### For Code Reviewer

**Review checklist:**
- [ ] All 81 files moved correctly
- [ ] Git history preserved (used `git mv`)
- [ ] No broken imports/requires
- [ ] All tests passing
- [ ] Documentation updated (CLAUDE.md, README.md)
- [ ] Root folder has <15 files
- [ ] .gitignore updated

## File Organization

### Documentation (42 files → `/docs`)

```
docs/
├── 00-getting-started/
│   ├── FOR_BROTHER_CLAUDE.md
│   ├── ARBAK_UPDATE_INSTRUCTIONS.md
│   ├── TEAM_SETUP.md
│   ├── CONTRIBUTING.md
│   ├── HANDOFF_NOTES.md
│   └── PHASE_0_QUICK_START.md
├── 01-architecture/
│   ├── integrations/
│   │   ├── YCLIENTS_API.md
│   │   ├── YCLIENTS_CALL_TECHNICAL_INFO.md
│   │   ├── YCLIENTS_COMPLETE_TECHNICAL_SPECIFICATION.md
│   │   └── YCLIENTS_DATA_SUMMARY.md
│   ├── api/
│   │   └── openapi.yaml
│   └── database/
│       ├── SUPABASE_STORAGE_SUMMARY.md
│       └── (existing files)
├── 02-guides/
│   ├── database/
│   │   └── QUICK_START_TIMEWEB_POSTGRES.md
│   ├── deployment/
│   │   └── DEPLOY_GEMINI_COMMANDS.md
│   ├── testing/
│   │   └── test-e2e-reminder.md
│   └── yclients/
│       └── YCLIENTS_INTEGRATION_INSTRUCTION.md
├── 04-planning/
│   ├── marketplace/
│   │   ├── YCLIENTS_APP_DESCRIPTION.md
│   │   ├── YCLIENTS_MODERATION_CHECKLIST.md
│   │   ├── YCLIENTS_MODERATION_DATA_USAGE.md
│   │   ├── YCLIENTS_NEGOTIATION_STRATEGY.md
│   │   ├── YCLIENTS_SCALE_ANALYSIS.md
│   │   └── yclients-partnership-presentation.html
│   ├── financial/
│   │   ├── AI_Admin_Financial_Model.md
│   │   ├── Financial_Model_QuickStart.md
│   │   ├── Dashboard_Formulas_Guide.md
│   │   ├── revenue-share-comparison-2years.md
│   │   ├── revenue-share-visualization.html
│   │   ├── Inputs_Template.csv
│   │   └── Scaling_Template.csv
│   ├── ai-providers/
│   │   ├── OpenAI_pricing.md
│   │   ├── claude_pricing.md
│   │   └── gemini_pricing.md
│   ├── legal/
│   │   ├── trademark-class-38-critical-analysis.md
│   │   ├── trademark-class-38-decision-brief.md
│   │   ├── trademark-registration-russia-2025.md
│   │   └── trademark-research-sources.md
│   ├── domain/
│   │   └── domain-availability-research-2025-11-13.md
│   ├── operations/
│   │   └── СКРИПТ_ДЛЯ_КАТИ_ОБЗВОН_КЛИЕНТОВ.md
│   └── yandex-cloud/
│       ├── YANDEX_CLOUD_BOOST_PRESENTATION_OUTLINE.md
│       ├── YANDEX_CLOUD_FUNCTIONS_FREE_TIER_ANALYSIS.md
│       └── YANDEX_CLOUD_GRANT_ANALYSIS.md
└── 99-meta/
    └── CHANGELOG.md
```

### Configuration (17 files → `/config`)

```
config/
├── env-templates/
│   ├── .env.for-team
│   ├── .env.from-server
│   ├── .env.mcp
│   ├── .env.mcp.example
│   ├── .env.production
│   ├── .env.production.example
│   ├── .env.team-safe
│   ├── .env.test
│   └── .env.timeweb.example
├── api-specs/
│   └── timeweb_openapi.json
├── nginx/
│   ├── nginx-ai-admin-fixed.conf
│   ├── nginx-ai-admin.conf
│   ├── nginx-config-initial.conf
│   ├── nginx-config.conf
│   └── nginx-ssl-config.conf
└── deployment/
    ├── ecosystem.config.js
    └── ecosystem.baileys.config.js
```

### Tests (15 files → `/tests`)

```
tests/
├── config/
│   └── test-config.js
├── integration/
│   ├── test-auth-state-timeweb.js
│   ├── test-production-glitchtip.js
│   ├── test-real-patterns.js
│   ├── test-sentry-compat.js
│   ├── test-services-formatting-comparison.js
│   └── reminders/
│       ├── test-final-reminder-showcase.js
│       ├── test-forced-template.js
│       ├── test-multiple-services-reminder.js
│       ├── test-reminder-confirmation.js
│       ├── test-reminder-system.js
│       └── test-specific-template.js
└── performance/
    └── test-performance.js
```

### Scripts (2 files → `/scripts`)

```
scripts/
├── reminders/
│   └── create-reminder-context.js
└── testing/
    └── create-test-booking.js
```

### Root (10-15 files remain)

```
/
├── package.json             # NPM
├── package-lock.json        # NPM
├── .gitignore               # Git
├── README.md                # Docs
├── CLAUDE.md                # Docs
├── .env.example             # Template
├── .mcp.json.example        # Template
├── jest.config.js           # Config
├── Dockerfile               # Docker (optional in root)
├── docker-compose.yml       # Docker (optional in root)
├── docker-compose.test.yml  # Docker (optional in root)
├── start-work.sh            # Quick access (optional in root)
└── launch-claude.sh         # Quick access (optional in root)
```

## Execution Timeline

| Phase | Time | Tasks |
|-------|------|-------|
| 1. Prepare Directories | 5 min | Create all subdirectories |
| 2. Move Documentation | 10 min | Move 42 doc files |
| 3. Move Configs | 5 min | Move 17 config files |
| 4. Move Tests | 5 min | Move 15 test files |
| 5. Move Scripts | 2 min | Move 2 script files |
| 6. Update .gitignore | 2 min | Add generated file rules |
| 7. Clean Generated | 1 min | Delete .DS_Store files |
| 8. Update References | 15 min | Update CLAUDE.md, README.md |
| 9. Verify & Commit | 5 min | Test, commit, PR |
| **TOTAL** | **50 min** | **83 tasks** |

## Risk Assessment

### Low Risk (80%)
- Moving documentation (no code dependencies)
- Moving tests (self-contained)
- Moving nginx configs (deployment only)

### Medium Risk (20%)
- Moving PM2 configs (deployment scripts may reference)
- Moving env templates (onboarding docs reference)
- Moving utility scripts (code may import)

### Mitigation
- Use `git mv` (preserves history)
- Search for imports before moving
- Update all documentation
- Run full test suite
- Easy rollback with `git revert`

## Success Metrics

**Quantitative:**
- ✅ Root folder: 86 files → <15 files (82% reduction)
- ✅ All 83 tasks completed
- ✅ All tests passing
- ✅ No broken imports

**Qualitative:**
- ✅ Easier to find files
- ✅ Better developer experience
- ✅ More professional appearance
- ✅ Clearer project structure

## Questions for Owner

Before execution, confirm:

1. **Docker files:** Keep in root or move to `config/deployment/`?
   - Recommendation: Keep in root (standard)

2. **Quick scripts:** Keep `start-work.sh` in root?
   - Recommendation: Keep in root (easy access)

3. **Old configs:** Archive or delete 5 nginx config versions?
   - Recommendation: Keep most recent, archive others

4. **Test files:** Delete old tests or keep all?
   - Recommendation: Move all, review later

5. **Env templates:** Which of 9 templates are needed?
   - Recommendation: Keep all, organize in subdirectory

## Related Documentation

- **Git Workflow:** `docs/GIT_WORKFLOW_STRATEGY.md`
- **CLAUDE.md:** Root reference guide (will be updated)
- **Project Structure:** `docs/01-architecture/`

## Next Steps

1. [ ] Review plan with project owner
2. [ ] Confirm decisions on open questions
3. [ ] Create feature branch
4. [ ] Execute Phase 1-9 using tasks checklist
5. [ ] Create PR for review
6. [ ] Merge to main
7. [ ] Update project documentation
8. [ ] Notify team of new structure

---

**Created:** 2025-11-25
**Location:** `dev/active/root-folder-cleanup/`
**Status:** Ready for execution
**Estimated Time:** 50 minutes
**Risk Level:** Low-Medium
**Impact:** High (improves entire project structure)
