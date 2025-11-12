# Documentation Naming Conventions

Guidelines for naming documentation files and directories in AI Admin v2.

## Directories

**Format:** lowercase-with-hyphens

**Examples:**
- ✅ `whatsapp/`
- ✅ `ai-system/`
- ✅ `code-reviews/`
- ❌ `WhatsApp/`
- ❌ `ai_system/`
- ❌ `Code Reviews/`

## Files

### Guides and References

**Format:** UPPERCASE_WITH_UNDERSCORES.md

**Examples:**
- ✅ `WHATSAPP_MONITORING_GUIDE.md`
- ✅ `TELEGRAM_BOT_QUICK_REFERENCE.md`
- ✅ `DEPLOYMENT_GUIDE.md`

### Reports

**Format:** Title_Case_YYYY-MM-DD.md (for dated reports)
**Format:** TITLE_CASE_REPORT.md (for general reports)

**Examples:**
- ✅ `DEPLOYMENT_REPORT_2025-10-03.md`
- ✅ `CODE_REVIEW_FIXES_SUMMARY.md`
- ✅ `SCALING_ANALYSIS_20_COMPANIES.md`

### Development Diary

**Format:** YYYY-MM-DD-descriptive-title.md

**Examples:**
- ✅ `2025-11-08-phase-07-monitoring-script-fix.md`
- ✅ `2025-10-19-gemini-integration-with-vpn.md`

### Plans and Designs

**Format:** UPPERCASE_PLAN.md or UPPERCASE_DESIGN.md

**Examples:**
- ✅ `MIGRATION_TIMEWEB_PLAN.md`
- ✅ `SCALING_ANALYSIS_20_COMPANIES.md`

## Special Rules

1. **No spaces in filenames** - Use hyphens or underscores
2. **No special characters** - Avoid apostrophes, quotes, parentheses
3. **Dates use YYYY-MM-DD** - ISO 8601 format
4. **Underscores for multi-word** - In uppercase filenames
5. **Hyphens for directories** - In lowercase directory names

## Bad Examples

❌ `Competitor's_pages.md` - Apostrophe in filename
❌ `Reddit post.md` - Space without replacement
❌ `WhatsApp Setup (Old).md` - Parentheses, space
❌ `2025-10-4-fix.md` - Single-digit day (should be 04)
❌ `Code Reviews/` - Space in directory name

## Renaming Existing Files

When renaming to match conventions:

```bash
# Bad → Good
mv "Competitor's_pages.md" "Competitor-Analysis.md"
mv "Reddit post.md" "Reddit-Post.md"
mv "Code Reviews/" "code-reviews/"
```

## References

- [Google Developer Style Guide](https://developers.google.com/style/filenames)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)