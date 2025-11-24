# Error Runbooks

This directory contains operational runbooks for common errors in the AI Admin system.

## 📚 Available Runbooks

| Runbook | Pattern | Severity | MTTR |
|---------|---------|----------|------|
| [Database Timeout](database-timeout.md) | `ConnectionTimeout`, `connection timed out` | High | 5-10 min |
| [WhatsApp Session Expired](whatsapp-session-expired.md) | `session.*expir`, `Expired session keys` | Critical | 10-15 min |
| [YClients Rate Limit](yclients-rate-limit.md) | `rate.*limit`, `429`, `too.*many.*requests` | Medium | 2-5 min |
| [Redis Connection Refused](redis-connection-refused.md) | `ECONNREFUSED.*redis`, `connect.*6379.*fail` | High | 3-5 min |
| [NPM Module Not Found](npm-module-not-found.md) | `Cannot find module`, `MODULE_NOT_FOUND` | High | 2-3 min |

## 🎯 How Runbooks Work

**Automatic Linking:**
- Script: `scripts/link-runbooks.js`
- Schedule: Hourly (8 AM - 11 PM) via PM2 cron
- Process:
  1. Fetches unresolved issues from GlitchTip
  2. Matches issue title/message against patterns (regex)
  3. Posts comment with runbook link (if not already posted)

**Manual Usage:**
1. Find error in GlitchTip
2. Search this directory for matching pattern
3. Follow runbook steps to diagnose and fix

## 📝 Runbook Template

Use [TEMPLATE.md](TEMPLATE.md) when creating new runbooks.

**Sections:**
- **Symptoms:** How to identify the error
- **Diagnosis:** Root cause and verification steps
- **Fix:** Step-by-step resolution commands
- **Prevention:** Configuration, monitoring, code changes
- **History:** Past occurrences and improvements

## 🔧 Creating New Runbooks

```bash
# 1. Copy template
cp runbooks/TEMPLATE.md runbooks/your-error-name.md

# 2. Fill in all sections (use real commands, examples, file paths)

# 3. Add pattern to scripts/link-runbooks.js
const PATTERNS = {
  // ...
  'YourErrorPattern': 'runbooks/your-error-name.md'
};

# 4. Test pattern matching
node scripts/link-runbooks.js --dry-run

# 5. Commit and deploy
git add runbooks/your-error-name.md scripts/link-runbooks.js
git commit -m "docs: Add runbook for YourError"
```

## 📊 Runbook Effectiveness

**Target Metrics:**
- 80% of known errors have runbooks
- MTTR reduced by 80% for documented errors (15 min → 3 min)
- 95%+ of runbook steps work without modification

**Review Schedule:**
- Monthly: Update occurrences in History section
- Quarterly: Review patterns (add new, refine existing)
- Annually: Archive unused runbooks

## 🔗 Related Resources

**Automation:**
- `scripts/link-runbooks.js` - Pattern matching and auto-linking
- `ecosystem.config.js` - PM2 cron schedule (link-runbooks job)

**Documentation:**
- `docs/ERROR_TRACKING_WORKFLOW.md` - Error handling workflow
- `dev/active/glitchtip-api-integration/` - GlitchTip integration project

**GlitchTip:**
- UI: http://localhost:9090 (via SSH tunnel)
- API: http://localhost:8080/api/0/
- Organization: admin-ai

---

**Last Updated:** 2025-11-24
**Maintainer:** Backend Team
**Version:** 1.0
