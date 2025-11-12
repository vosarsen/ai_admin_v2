# Documentation Reorganization - Execution Checklist

**Quick checklist for executing the reorganization plan**

## Pre-Execution Checklist

### Prerequisites
- [ ] Read [DOCS_REORGANIZATION_PLAN.md](DOCS_REORGANIZATION_PLAN.md) (full details)
- [ ] Read [REORGANIZATION_SUMMARY.md](REORGANIZATION_SUMMARY.md) (overview)
- [ ] Review [REORGANIZATION_VISUAL_GUIDE.md](REORGANIZATION_VISUAL_GUIDE.md) (before/after)
- [ ] Git working directory is clean (`git status`)
- [ ] No outstanding doc PRs to merge
- [ ] 2.5 hours available for focused work
- [ ] Project lead approval obtained

### Safety Prep
- [ ] Backup space available (~20MB on Desktop)
- [ ] Git configured correctly
- [ ] Understand rollback procedure
- [ ] Team notified (optional: hold doc PRs)

---

## Phase 0: Pre-Migration Safety (15 min)

**Risk:** 🟢 LOW | **Status:** ⬜ Not Started

```bash
# 1. Create backup
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2
tar -czf docs-backup-$(date +%Y%m%d-%H%M%S).tar.gz docs/
mv docs-backup-*.tar.gz ~/Desktop/
```
- [ ] Backup created on Desktop
- [ ] Backup verified (`tar -tzf`)

```bash
# 2. Create branch
git checkout -b docs/reorganization-2025-11-12
git status
```
- [ ] New branch created
- [ ] Working directory clean

```bash
# 3. List duplicates
find docs -name "* 2.*" > /tmp/duplicates-to-remove.txt
echo "Found $(wc -l < /tmp/duplicates-to-remove.txt) duplicate files"
cat /tmp/duplicates-to-remove.txt
```
- [ ] Duplicates list created
- [ ] Count verified (~343 files)

```bash
# 4. Spot-check duplicates are identical
head -5 /tmp/duplicates-to-remove.txt | while read file; do
  original="${file% 2.*}.${file##*.}"
  if [ -f "$original" ]; then
    diff "$file" "$original" && echo "✅ $file is identical" || echo "❌ $file DIFFERS!"
  fi
done
```
- [ ] Spot-checked 5 duplicates
- [ ] All verified identical

**Phase 0 Complete:** ⬜

---

## Phase 1: Remove Duplicate Files (10 min)

**Risk:** 🟡 MEDIUM | **Status:** ⬜ Not Started

```bash
# 1. Remove duplicate files
find docs -name "* 2.md" -type f -delete
find docs -name "* 2.sh" -type f -delete
find docs -name "* 2.yaml" -type f -delete
```
- [ ] Duplicate files deleted

```bash
# 2. Remove duplicate directories
rmdir "docs/archive/code-reviews 2" 2>/dev/null
rmdir "docs/archive/migration-guides 2" 2>/dev/null
rmdir "docs/archive/old-implementations 2" 2>/dev/null
rmdir "docs/archive/outdated-plans 2" 2>/dev/null
rmdir "docs/archive/test-results 2" 2>/dev/null
```
- [ ] Duplicate directories removed

```bash
# 3. Verify
find docs -name "* 2.*" -o -name "* 2" | wc -l
# Should be: 0
```
- [ ] Zero duplicates remain

```bash
# 4. Commit
git add -A
git commit -m "docs: Remove 343 duplicate files and 5 duplicate directories

- Remove all files with ' 2' suffix (macOS copy conflicts)
- Remove 5 empty duplicate directories in archive/
- Verified duplicates are identical to originals before deletion
- No functional changes, cleanup only"
git log -1 --stat
```
- [ ] Changes committed
- [ ] Commit verified

**Phase 1 Complete:** ⬜

---

## Phase 2: Fix Structural Issues (15 min)

**Risk:** 🟢 LOW | **Status:** ⬜ Not Started

```bash
# 1. Fix nested docs/docs/
mv docs/docs/technical/* docs/technical/
rmdir docs/docs/technical
rmdir docs/docs
```
- [ ] Nested docs/docs/ fixed

```bash
# 2. Rename problematic files
mv "docs/Competitor's_pages.md" docs/business/Competitor-Analysis.md
mv "docs/Reddit post.md" docs/meta/Reddit-Post.md
```
- [ ] Files renamed (no special chars)

```bash
# 3. Consolidate single-file directories
mv docs/api/* docs/technical/
rmdir docs/api
mv docs/testing-results/* docs/archive/test-results/
rmdir docs/testing-results
mv docs/updates/* docs/archive/
rmdir docs/updates
```
- [ ] Single-file directories consolidated

```bash
# 4. Commit
git add -A
git commit -m "docs: Fix structural issues and naming

- Move docs/docs/technical/ content to docs/technical/
- Rename Competitor's_pages.md to Competitor-Analysis.md
- Rename 'Reddit post.md' to Reddit-Post.md
- Consolidate single-file directories (api, testing-results, updates)
- No content changes, structure improvements only"
```
- [ ] Changes committed

**Phase 2 Complete:** ⬜

---

## Phase 3: Create New Directory Structure (10 min)

**Risk:** 🟢 LOW | **Status:** ⬜ Not Started

```bash
# 1. Create new directories
mkdir -p docs/00-getting-started
mkdir -p docs/01-architecture/{system-overview,whatsapp,ai-system,database,features}
mkdir -p docs/02-guides/{whatsapp,telegram,deployment,marketplace,git}
mkdir -p docs/04-planning/{business,scaling,migrations,research}
mkdir -p docs/05-reports/{code-reviews,deployments,incidents,optimizations}
mkdir -p docs/06-archive/{old-migrations,old-implementations,old-code-reviews,old-test-results}
mkdir -p docs/99-meta/scripts
```
- [ ] All new directories created

```bash
# 2. Rename existing directories
mv docs/development-diary docs/03-development-diary
mv docs/archive/* docs/06-archive/
rmdir docs/archive
```
- [ ] development-diary renamed
- [ ] archive/ merged

```bash
# 3. Verify structure
tree -L 2 docs/ -d
```
- [ ] Structure verified

```bash
# 4. Commit
git add -A
git commit -m "docs: Create new hierarchical directory structure

- Add numbered prefix directories (00-99) for predictable ordering
- Create logical subcategories under each main category
- Rename development-diary to 03-development-diary
- Consolidate archive content into 06-archive
- Prepare for Phase 4 file migration"
```
- [ ] Changes committed

**Phase 3 Complete:** ⬜

---

## Phase 4: Migrate Root-Level Files (30 min)

**Risk:** 🟡 MEDIUM | **Status:** ⬜ Not Started

### 4.1 Getting Started
```bash
mv docs/QUICK_REFERENCE.md docs/00-getting-started/
mv docs/ENVIRONMENT_VARIABLES.md docs/00-getting-started/
mv docs/SERVER_CHECKLIST.md docs/00-getting-started/
mv docs/MINIMAL_CONFIGURATION_START.md docs/00-getting-started/
git add -A && git commit -m "docs: Move getting started files to 00-getting-started/"
```
- [ ] 4 files moved, committed

### 4.2 Architecture - WhatsApp
```bash
mv docs/BAILEYS_STANDALONE_ARCHITECTURE.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_MULTITENANT_ARCHITECTURE.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_SIMPLIFIED_ARCHITECTURE.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_COMPLETE_DOCUMENTATION.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_SYSTEM_ANALYSIS_REPORT.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_AUTH_MANAGEMENT.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_CLIENT.md docs/01-architecture/whatsapp/
mv docs/WHATSAPP_README.md docs/01-architecture/whatsapp/
mv docs/guides/WHATSAPP_NUMBER_CHANGE.md docs/01-architecture/whatsapp/
git add -A && git commit -m "docs: Consolidate WhatsApp architecture documentation"
```
- [ ] 9 files moved, committed

### 4.3 Architecture - AI System
```bash
mv docs/GEMINI_INTEGRATION_GUIDE.md docs/01-architecture/ai-system/
mv docs/GEMINI_MONITORING.md docs/01-architecture/ai-system/
mv docs/OPTIMIZATION_EXPLAINED.md docs/01-architecture/ai-system/
mv docs/PROMPT_OPTIMIZATION_RESULTS.md docs/01-architecture/ai-system/
mv docs/technical/AI_PROVIDERS_GUIDE.md docs/01-architecture/ai-system/
git add -A && git commit -m "docs: Consolidate AI system architecture documentation"
```
- [ ] 5 files moved, committed

### 4.4 Architecture - Database
```bash
mv docs/TIMEWEB_POSTGRES_SUMMARY.md docs/01-architecture/database/
mv docs/TIMEWEB_POSTGRES_MIGRATION.md docs/01-architecture/database/
mv docs/DATABASE_REQUIREMENTS_50_COMPANIES.md docs/01-architecture/database/
mv docs/TRANSACTION_SUPPORT.md docs/01-architecture/database/
mv docs/technical/DB_COMPLIANCE_STRATEGY.md docs/01-architecture/database/
git add -A && git commit -m "docs: Consolidate database architecture documentation"
```
- [ ] 5 files moved, committed

### 4.5 Architecture - Features
```bash
mv docs/SERVICE_SELECTION_SYSTEM.md docs/01-architecture/features/
mv docs/DECLENSION_SYSTEM.md docs/01-architecture/features/
mv docs/SEARCH_SLOTS_IMPROVEMENT.md docs/01-architecture/features/
git add -A && git commit -m "docs: Move feature documentation to architecture"
```
- [ ] 3 files moved, committed

### 4.6 Architecture - System Overview
```bash
mv docs/COMPREHENSIVE_ANALYSIS.md docs/01-architecture/system-overview/
mv docs/MONITORING_SUMMARY.md docs/01-architecture/system-overview/
git add -A && git commit -m "docs: Move system overview documentation"
```
- [ ] 2 files moved, committed

### 4.7 Guides - WhatsApp
```bash
mv docs/WHATSAPP_MONITORING_GUIDE.md docs/02-guides/whatsapp/
mv docs/WHATSAPP_PAIRING_CODE_GUIDE.md docs/02-guides/whatsapp/
mv docs/WHATSAPP_PAIRING_QUICK_GUIDE.md docs/02-guides/whatsapp/
mv docs/WHATSAPP_RECONNECTION_GUIDE.md docs/02-guides/whatsapp/
mv docs/WHATSAPP_PAIRING_CODE_SOLUTION.md docs/02-guides/whatsapp/
mv docs/WHATSAPP_WEB_CONNECTION_GUIDE.md docs/02-guides/whatsapp/
git add -A && git commit -m "docs: Move WhatsApp operational guides to 02-guides/whatsapp/"
```
- [ ] 6 files moved, committed

### 4.8 Guides - Telegram
```bash
mv docs/TELEGRAM_BOT_QUICK_REFERENCE.md docs/02-guides/telegram/
mv docs/TELEGRAM_SETUP.md docs/02-guides/telegram/
mv docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md docs/02-guides/telegram/
git add -A && git commit -m "docs: Move Telegram guides to 02-guides/telegram/"
```
- [ ] 3 files moved, committed

### 4.9 Guides - Deployment
```bash
mv docs/TIMEWEB_CONFIGURATION_FINAL.md docs/02-guides/deployment/
mv docs/VPS_MIGRATION_CHECKLIST.md docs/02-guides/deployment/
mv docs/VPS_MIGRATION_ROLLBACK_PLAN.md docs/02-guides/deployment/
mv docs/guides/DEPLOYMENT.md docs/02-guides/deployment/
mv docs/guides/DEPLOYMENT_GUIDE.md docs/02-guides/deployment/
git add -A && git commit -m "docs: Consolidate deployment guides"
```
- [ ] 5 files moved, committed

### 4.10 Guides - Git
```bash
mv docs/GIT_QUICK_REFERENCE.md docs/02-guides/git/
mv docs/GIT_WORKFLOW_STRATEGY.md docs/02-guides/git/
mv docs/GIT_WORKFLOW_EXPLANATION.md docs/02-guides/git/
git add -A && git commit -m "docs: Move Git workflow guides to 02-guides/git/"
```
- [ ] 3 files moved, committed

### 4.11 Guides - Marketplace
```bash
mv docs/marketplace/* docs/02-guides/marketplace/
rmdir docs/marketplace
mv docs/YCLIENTS_MARKETPLACE_PAGE.md docs/02-guides/marketplace/
git add -A && git commit -m "docs: Consolidate marketplace documentation"
```
- [ ] Marketplace merged, committed

### 4.12 Planning - Business
```bash
mv docs/LEGAL_STRUCTURE_GEORGIA_RUSSIA.md docs/04-planning/business/
mv docs/NEWO_AI_INTEGRATION.md docs/04-planning/business/
mv docs/NEWO_LEGAL_TERMS.md docs/04-planning/business/
mv docs/NEWO_QUICK_REFERENCE.md docs/04-planning/business/
mv docs/business/* docs/04-planning/business/
rmdir docs/business
git add -A && git commit -m "docs: Consolidate business planning documentation"
```
- [ ] Business docs consolidated, committed

### 4.13 Planning - Scaling
```bash
mv docs/SCALING_ANALYSIS_20_COMPANIES.md docs/04-planning/scaling/
mv docs/SCALING_REAL_LOAD_ANALYSIS.md docs/04-planning/scaling/
git add -A && git commit -m "docs: Move scaling analysis to planning"
```
- [ ] 2 files moved, committed

### 4.14 Planning - Migrations
```bash
mv docs/MIGRATION_152FZ_REQUIRED.md docs/04-planning/migrations/
mv docs/MIGRATION_DECISION_FINAL.md docs/04-planning/migrations/
mv docs/MIGRATION_TIMEWEB_ALL_IN_ONE.md docs/04-planning/migrations/
mv docs/YANDEX_CLOUD_MIGRATION_PLAN.md docs/04-planning/migrations/
mv docs/YANDEX_CLOUD_PRICING_COMPARISON.md docs/04-planning/migrations/
git add -A && git commit -m "docs: Consolidate migration planning documentation"
```
- [ ] 5 files moved, committed

### 4.15 Planning - Research
```bash
mv docs/research/* docs/04-planning/research/
rmdir docs/research
git add -A && git commit -m "docs: Move research documentation to planning"
```
- [ ] Research moved, committed

### 4.16 Reports - Code Reviews
```bash
mv docs/CODE_REVIEW_REPORT_2025_09_20.md docs/05-reports/code-reviews/
mv docs/CODE_REVIEW_FIXES_SUMMARY.md docs/05-reports/code-reviews/
mv docs/CLEANUP_REPORT.md docs/05-reports/code-reviews/
git add -A && git commit -m "docs: Move code review reports to 05-reports/"
```
- [ ] 3 files moved, committed

### 4.17 Reports - Deployments
```bash
mv docs/DEPLOYMENT_REPORT_2025-10-03.md docs/05-reports/deployments/
mv docs/DEPLOYMENT_DATABASE_AUTH_STATE.md docs/05-reports/deployments/
git add -A && git commit -m "docs: Move deployment reports to 05-reports/"
```
- [ ] 2 files moved, committed

### 4.18 Reports - Incidents
```bash
mv docs/CRITICAL_DISK_ISSUE_2025-10-04.md docs/05-reports/incidents/
git add -A && git commit -m "docs: Move incident reports to 05-reports/"
```
- [ ] 1 file moved, committed

### 4.19 Reports - Optimizations
```bash
mv docs/BAILEYS_IMPROVEMENTS.md docs/05-reports/optimizations/
mv docs/FIXES_IMPLEMENTATION_REPORT_2025_09_20.md docs/05-reports/optimizations/
mv docs/TECHNICAL_DEBT_ELIMINATION.md docs/05-reports/optimizations/
git add -A && git commit -m "docs: Move optimization reports to 05-reports/"
```
- [ ] 3 files moved, committed

### 4.20 Archive - Old Migrations
```bash
mv docs/ADMINVPS_MIGRATION_GUIDE.md docs/06-archive/old-migrations/
mv docs/BAILEYS_CLEANUP_STRATEGY.md docs/06-archive/old-migrations/
mv docs/BAILEYS_CLEANUP_SYSTEM.md docs/06-archive/old-migrations/
git add -A && git commit -m "docs: Archive completed migration documentation"
```
- [ ] 3 files archived, committed

### 4.21 Meta Files
```bash
mv docs/update-mcp-supabase-config.sh docs/99-meta/scripts/
mv docs/whatsapp-api-openapi.yaml docs/99-meta/
git add -A && git commit -m "docs: Move meta documentation and scripts"
```
- [ ] Meta files moved, committed

**Phase 4 Complete:** ⬜

---

## Phase 5: Create README Files (20 min)

**Risk:** 🟢 LOW | **Status:** ⬜ Not Started

See full commands in [DOCS_REORGANIZATION_PLAN.md](DOCS_REORGANIZATION_PLAN.md) Section 3, Phase 5.

- [ ] Main README.md created
- [ ] 01-architecture/README.md created
- [ ] 02-guides/README.md created
- [ ] 06-archive/README.md created
- [ ] 99-meta/DOCS_NAMING_CONVENTIONS.md created
- [ ] All READMEs committed

**Phase 5 Complete:** ⬜

---

## Phase 6: Update References (20 min)

**Risk:** 🟡 MEDIUM | **Status:** ⬜ Not Started

```bash
# 1. Find broken links
grep -r "docs/" docs --include="*.md" | grep -E "\[.*\]\(.*docs/" > /tmp/links-to-update.txt
```
- [ ] Potential broken links identified

```bash
# 2. Automated updates
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2
find . -type f -name "*.md" -exec sed -i '' 's|docs/development-diary/|docs/03-development-diary/|g' {} +
find . -type f -name "*.md" -exec sed -i '' 's|docs/marketplace/|docs/02-guides/marketplace/|g' {} +
```
- [ ] Automated reference updates complete

**MANUAL REVIEW REQUIRED:**
- [ ] CLAUDE.md paths updated
- [ ] README.md (project root) paths updated
- [ ] docs/TROUBLESHOOTING.md paths updated
- [ ] docs/CLAUDE_CODE_MASTER_GUIDE.md paths updated

```bash
# 3. Commit
git add -A
git commit -m "docs: Update internal references after reorganization

- Update development-diary → 03-development-diary
- Update marketplace/ → 02-guides/marketplace/
- Manual review completed for CLAUDE.md"
```
- [ ] Reference updates committed

**Phase 6 Complete:** ⬜

---

## Phase 7: Final Verification (15 min)

**Risk:** 🟢 LOW | **Status:** ⬜ Not Started

```bash
# 1. Check root files
find docs -maxdepth 1 -type f -name "*.md" | wc -l
# Should be: 4
```
- [ ] Root files = 4 ✅

```bash
# 2. Check no duplicates
find docs -name "* 2.*" -o -name "* 2" | wc -l
# Should be: 0
```
- [ ] Duplicates = 0 ✅

```bash
# 3. Verify structure
tree -L 2 docs/ -d
```
- [ ] Structure looks correct

```bash
# 4. Count files
find docs -type f | wc -l
# Should be: ~478 (was 821)
```
- [ ] File count correct (~478)

```bash
# 5. Git status
git status
git log --oneline --graph --all | head -30
```
- [ ] Git clean
- [ ] All commits look good

```bash
# 6. Generate report
cat > /tmp/reorganization-report.md << EOF
# Documentation Reorganization Report

**Date:** $(date +%Y-%m-%d)
**Branch:** docs/reorganization-2025-11-12

## Summary
- Files before: 821
- Files after: $(find docs -type f | wc -l)
- Files removed: 343 (duplicates)
- Root-level files: $(find docs -maxdepth 1 -type f -name "*.md" | wc -l)
- Commits made: $(git log --oneline main..HEAD | wc -l)

## Next Steps
1. Manual review of CLAUDE.md references
2. Manual review of README.md references
3. Test all critical documentation paths
4. Merge to main branch
5. Update project documentation
EOF
cat /tmp/reorganization-report.md
```
- [ ] Report generated and reviewed

**Phase 7 Complete:** ⬜

---

## Phase 8: Merge and Deploy (10 min)

**Risk:** 🟡 MEDIUM | **Status:** ⬜ Not Started

```bash
# 1. Final review
git log --oneline main..HEAD
git diff main --stat
```
- [ ] Changes reviewed

```bash
# 2. Merge to main
git checkout main
git merge docs/reorganization-2025-11-12 --no-ff -m "docs: Complete documentation reorganization

Major reorganization of /docs folder:
- Removed 343 duplicate files (' 2' suffix)
- Consolidated 124 root-level files into 9 categories
- Created hierarchical structure with numbered prefixes
- Added README files for navigation
- Updated internal references
- Established naming conventions

See docs/99-meta/DOCS_REORGANIZATION_PLAN.md for details."
```
- [ ] Merged to main

```bash
# 3. Verify
git log --oneline -5
git status
```
- [ ] Merge verified

```bash
# 4. Push
git push origin main
```
- [ ] Pushed to remote

```bash
# 5. Cleanup
git branch -d docs/reorganization-2025-11-12
```
- [ ] Branch deleted

**Phase 8 Complete:** ⬜

---

## Post-Execution Checklist

### Immediate (Day 1)
- [ ] Test critical documentation links
- [ ] Verify development diary accessible
- [ ] Check CLAUDE.md references work
- [ ] Announce completion to team
- [ ] Update any external bookmarks

### Week 1
- [ ] Update external documentation
- [ ] Search codebase for hardcoded paths
- [ ] Train team on new structure
- [ ] Monitor for broken link reports

### Week 2
- [ ] Delete backup from Desktop (after verification)
- [ ] Document lessons learned in Appendix C
- [ ] Review effectiveness of new structure
- [ ] Create maintenance guidelines

---

## Emergency Rollback

If critical issues discovered:

```bash
# Option 1: Revert merge commit
git log --oneline | grep "Complete documentation reorganization"
git revert <merge-commit-hash> -m 1
git push origin main

# Option 2: Restore from backup (if not pushed)
rm -rf docs/
tar -xzf ~/Desktop/docs-backup-*.tar.gz
git add docs/
git commit -m "docs: Rollback reorganization - restore from backup"
git push origin main
```

- [ ] Rollback procedure understood
- [ ] Backup location known

---

## Success Criteria

- ✅ Zero duplicate files
- ✅ Only 4 root-level files
- ✅ All phases completed
- ✅ All commits clean
- ✅ No broken critical links
- ✅ Team trained
- ✅ Documentation updated

---

## Notes & Issues

Use this space to track any issues or deviations during execution:

```
Date/Time | Phase | Issue | Resolution
----------|-------|-------|------------
          |       |       |
          |       |       |
          |       |       |
```

---

**Execution Started:** _______________
**Execution Completed:** _______________
**Total Time:** _______________
**Executed By:** _______________

---

**See also:**
- [Full Plan](DOCS_REORGANIZATION_PLAN.md) - Complete 1,516 line plan
- [Summary](REORGANIZATION_SUMMARY.md) - Executive summary
- [Visual Guide](REORGANIZATION_VISUAL_GUIDE.md) - Before/after comparison
