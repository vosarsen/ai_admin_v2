# Root Folder Cleanup - Context

**Project:** AI Admin v2 Root Folder Organization
**Created:** 2025-11-25
**Status:** Planning Complete, Ready for Execution
**Location:** `dev/active/root-folder-cleanup/`

## Current State

### The Problem
The project root folder contains **86 files** creating significant organizational debt:
- 42 documentation files scattered in root
- 15 test files mixed with production code
- 11 configuration files (many duplicates/templates)
- 8 deployment configuration files
- 5 generated/temporary files
- Only 5 files should actually be in root

### Impact
- **Developer Experience:** Hard to find files, cluttered workspace
- **Onboarding:** Confusing for new developers
- **Maintenance:** Difficult to understand project structure
- **Git History:** Noisy diffs when searching root
- **Professional Appearance:** Looks disorganized

### Current Directory Structure
```
/ai_admin_v2.nosync/
├── .claude/              ✅ Well organized
├── .github/              ✅ Well organized
├── archive/              ✅ Well organized
├── config/               ⚠️ Could be better organized
├── dev/                  ✅ Well organized
├── docs/                 ✅ Well organized (but missing files)
├── examples/             ✅ Well organized
├── mcp/                  ✅ Well organized
├── scripts/              ✅ Well organized (but missing files)
├── src/                  ✅ Well organized
├── tests/                ⚠️ Missing many test files
├── 86 FILES IN ROOT      ❌ MAJOR PROBLEM
```

## Solution Overview

### Plan Summary
Reorganize root folder by moving 81 files to appropriate subdirectories:
- 42 docs → `/docs` (organized by category)
- 9 env templates → `/config/env-templates/`
- 5 nginx configs → `/config/nginx/`
- 2 PM2 configs → `/config/deployment/`
- 15 test files → `/tests` (organized by type)
- 2 utility scripts → `/scripts`
- 5 files remain in root (essential only)
- 1 file deleted (.DS_Store)

### Target State
Root folder should contain only ~10-13 essential files:
- `package.json`, `package-lock.json` (NPM)
- `.gitignore` (Git)
- `README.md`, `CLAUDE.md` (Documentation)
- `.env.example`, `.mcp.json.example` (Templates)
- `jest.config.js` (Testing)
- `Dockerfile`, `docker-compose*.yml` (Docker - optional)
- `start-work.sh`, `launch-claude.sh` (Quick access - optional)

## Key Decisions

### 1. Documentation Organization
**Decision:** Organize docs into existing structure in `/docs`
- Onboarding → `docs/00-getting-started/`
- Architecture → `docs/01-architecture/`
- Guides → `docs/02-guides/`
- Planning → `docs/04-planning/`
- Meta → `docs/99-meta/`

**Reasoning:** Follows existing conventions in project

### 2. Environment Templates
**Decision:** Move all .env templates to `config/env-templates/`
**Keep in root:** Only `.env` (gitignored) and `.env.example`

**Reasoning:**
- Reduces clutter
- Clear separation between active config and templates
- Easier to find templates for team onboarding

### 3. Docker Files
**Decision:** Keep `Dockerfile` and `docker-compose*.yml` in root
**Reasoning:** Docker tooling expects these in root (standard)

### 4. Quick Access Scripts
**Decision:** Keep `start-work.sh` and `launch-claude.sh` in root
**Reasoning:** Common pattern for quick access scripts

### 5. Test Organization
**Decision:** Organize tests by type in `/tests`:
- Integration tests → `tests/integration/`
- Reminder tests → `tests/integration/reminders/`
- Performance tests → `tests/performance/`
- Config → `tests/config/`

**Reasoning:** Clear categorization, follows testing best practices

### 6. Git Strategy
**Decision:** Use `git mv` for all moves to preserve history
**Reasoning:** Maintains file history for future reference

## Risk Assessment

### Low Risk Operations (80% of work)
- Moving documentation files (no code dependencies)
- Moving test files (self-contained)
- Moving nginx configs (referenced only in deployment)
- Cleaning .DS_Store files

### Medium Risk Operations (20% of work)
- Moving PM2 configs (deployment scripts may reference)
- Moving environment templates (onboarding docs reference)
- Moving utility scripts (code may import)

### Mitigation Strategy
1. Use `git mv` to preserve history
2. Search for imports before moving scripts
3. Update all documentation references
4. Run full test suite after moves
5. Test deployment in staging
6. Easy rollback with `git revert`

## Implementation Approach

### Phase-by-Phase Execution
```
Phase 1: Prepare Directories (5 min) ← START HERE
Phase 2: Move Documentation (10 min)
Phase 3: Move Configs (5 min)
Phase 4: Move Tests (5 min)
Phase 5: Move Scripts (2 min)
Phase 6: Update .gitignore (2 min)
Phase 7: Clean Generated Files (1 min)
Phase 8: Update References (15 min)
Phase 9: Verify & Commit (5 min)
```

**Total Time:** ~50 minutes

### Success Criteria
- ✅ Root reduced from 86 to <15 files
- ✅ All files in appropriate subdirectories
- ✅ No broken imports/requires
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Git history preserved

## Questions to Resolve

Before execution, confirm with project owner:

1. **Docker files:** Keep in root or move to `config/deployment/`?
   - Current recommendation: Keep in root

2. **Quick scripts:** Keep `start-work.sh` in root or move?
   - Current recommendation: Keep in root

3. **Old configs:** Archive or delete old nginx configs (5 versions)?
   - Current recommendation: Keep most recent, archive others

4. **Test consolidation:** Delete old test files or keep all?
   - Current recommendation: Move all, review later

5. **Env templates:** Which of 9 templates are actually needed?
   - Current recommendation: Keep all, organize in subdirectory

## Related Documentation

- **Plan:** `root-cleanup-plan.md` - Complete execution plan
- **Tasks:** `root-cleanup-tasks.md` - Checklist for execution
- **CLAUDE.md:** Root reference guide (needs update after cleanup)
- **Git Workflow:** `docs/GIT_WORKFLOW_STRATEGY.md`

## Next Steps

1. Review this context with project owner
2. Confirm decisions on open questions
3. Execute Phase 1 (prepare directories)
4. Execute remaining phases sequentially
5. Update CLAUDE.md with new file locations
6. Create PR for review
7. Merge and celebrate clean root folder!

## Notes

### Files That Will Stay in Root
```
Essential (must stay):
- package.json, package-lock.json
- .gitignore
- README.md
- CLAUDE.md

Templates (should stay):
- .env.example
- .mcp.json.example

Configuration (standard location):
- jest.config.js
- Dockerfile
- docker-compose.yml
- docker-compose.test.yml

Quick Access (optional):
- start-work.sh
- launch-claude.sh

Runtime (gitignored):
- .env
- .mcp.json
```

### Files That Need Path Updates in CLAUDE.md
After moving files, update references in CLAUDE.md:
- FOR_BROTHER_CLAUDE.md → docs/00-getting-started/
- TEAM_SETUP.md → docs/00-getting-started/
- All YCLIENTS_*.md files → docs/01-architecture/integrations/ or docs/04-planning/marketplace/
- Financial docs → docs/04-planning/financial/
- And more... (see plan for complete list)

### Testing Strategy After Cleanup
```bash
# 1. Verify no broken imports
npm test

# 2. Check for broken file references
grep -r "require.*create-reminder" src/
grep -r "\.\.\/YCLIENTS" docs/

# 3. Test deployment scripts
npm run test:deployment

# 4. Verify MCP servers still work
npm run test:mcp
```

---

**Last Updated:** 2025-11-25
**Next Review:** After Phase 1 execution
**Owner:** vosarsen
**Executor:** Claude Code
