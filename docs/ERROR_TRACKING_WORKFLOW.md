# Error Tracking Workflow - GlitchTip

**Last Updated:** 2025-11-24
**Status:** Production Active (after Sentry → GlitchTip migration)

---

## 🎯 Overview

AI Admin v2 uses **GlitchTip** (self-hosted, Sentry-compatible) for error tracking and performance monitoring. All errors are automatically captured via Sentry SDK v10.24.0.

**Access:**
- URL: `http://localhost:9090` (via SSH tunnel)
- SSH Tunnel: `ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219`
- Credentials: `support@adminai.tech` / `AdminSecure2025`

---

## 📊 Error Capture Points

**Total:** 62 Sentry.captureException() calls across 12 files

### Core Services
- `src/database/postgres.js` (4) - Database connection errors
- `src/repositories/BaseRepository.js` (5) - Data layer errors
- `src/integrations/whatsapp/auth-state-timeweb.js` (10) - WhatsApp session errors
- `src/integrations/yclients/data/supabase-data-layer.js` (20) - YClients API errors

### Background Jobs
- `scripts/cleanup-whatsapp-keys.js` - Session cleanup errors
- `scripts/backup/backup-postgresql.js` - Backup errors
- `scripts/cleanup/cleanup-expired-session-keys.js` - Key cleanup errors
- `scripts/emergency/restore-file-sessions.js` - Emergency restore errors

---

## 🔄 Error Processing Workflow

### Stage 1: Automatic Capture

**What Happens:**
1. Error occurs in production code
2. `Sentry.captureException(error, context)` called
3. SDK sends to GlitchTip (localhost:8080)
4. Worker processes event (<5 seconds)
5. Error appears in UI with full context

**Context Included:**
```javascript
{
  tags: {
    component: 'database',
    operation: 'connect',
    backend: 'timeweb-postgresql'
  },
  extra: {
    host: 'a84c973324fdaccfc68d929d.twc1.net',
    port: 5432,
    database: 'default_db',
    attemptNumber: 3
  },
  user: { id: userId, email: userEmail },
  level: 'error' // or 'fatal', 'warning', 'info'
}
```

---

### Stage 2: Issue Grouping

**GlitchTip automatically groups errors by:**
- Error type (TypeError, ConnectionError, etc.)
- Stack trace fingerprint
- File location
- Function name

**Result:** Similar errors → Single Issue with count

**Example:**
```
Issue: ConnectionError: ECONNREFUSED
- First seen: 2025-11-24 10:23:45
- Last seen: 2025-11-24 16:42:12
- Count: 15 occurrences
- Status: Unresolved
```

---

### Stage 3: Triage (Daily)

**Recommended Schedule:** Every morning 9:00 AM

**Process:**
1. **Open GlitchTip Dashboard**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219
   # Open http://localhost:9090
   ```

2. **Review New Issues**
   - Filter: `status:unresolved is:new`
   - Sort by: First seen (newest first)
   - Check: Last 24 hours

3. **Prioritize by Severity**

   **🔴 P0 - Critical (Immediate Action)**
   - All `level:fatal` errors
   - Production down/degraded
   - Data corruption risk
   - Security vulnerabilities
   - **SLA:** Fix within 4 hours

   **🟠 P1 - High (Same Day)**
   - `level:error` with >10 occurrences
   - User-facing functionality broken
   - Payment processing issues
   - WhatsApp message failures
   - **SLA:** Fix within 24 hours

   **🟡 P2 - Medium (This Week)**
   - `level:error` with <10 occurrences
   - Edge case failures
   - Non-critical features affected
   - **SLA:** Fix within 1 week

   **🔵 P3 - Low (Backlog)**
   - `level:warning`
   - Deprecated API usage
   - Performance degradation (<10%)
   - **SLA:** Fix when capacity available

4. **Assign Issues**
   - Click issue → Assign to developer
   - Add tags: `P0`, `P1`, `P2`, `P3`
   - Add comment with investigation notes

5. **Update Status**
   - New → Assigned (when assigned to developer)
   - Assigned → In Progress (when work starts)
   - In Progress → Resolved (when fixed + deployed)
   - Resolved → Ignored (if known issue, won't fix)

---

### Stage 4: Investigation

**For each assigned issue:**

1. **Examine Stack Trace**
   ```
   Error: Connection timeout
     at Database.connect (src/database/postgres.js:42)
     at Repository.query (src/repositories/BaseRepository.js:156)
     at BookingService.create (src/services/booking.js:89)
   ```

2. **Check Context Tags**
   - `component`: Which service?
   - `operation`: What was it doing?
   - `backend`: Which backend system?

3. **Review Extra Data**
   - Request parameters
   - User ID (if authenticated)
   - Timestamp
   - Environment variables

4. **Check Frequency**
   - One-time glitch? (Maybe transient)
   - Regular pattern? (Systemic issue)
   - Increasing trend? (Degradation)

5. **Reproduce Locally**
   - Use context to recreate scenario
   - Test with same parameters
   - Check logs for additional clues

---

### Stage 5: Resolution

**Fix Process:**

1. **Create Fix**
   - Implement solution in code
   - Add additional error handling if needed
   - Update Sentry context if needed

2. **Test Thoroughly**
   - Unit tests for error case
   - Integration tests
   - Manual testing in staging

3. **Deploy to Production**
   - Follow standard deployment process
   - Monitor GlitchTip for 1 hour post-deploy
   - Verify error count drops to zero

4. **Mark as Resolved**
   - GlitchTip UI → Issue → Resolve
   - Add comment: "Fixed in commit [hash]"
   - Monitor for 24h to ensure no recurrence

5. **Document Known Issues**
   - If not fixable, document in runbook
   - Add comment explaining why
   - Mark as "Ignored" if acceptable

---

## 🔔 Alert Configuration

### Email Alerts

**Setup:**
1. Login to GlitchTip
2. Settings → Notifications
3. Add email: `support@adminai.tech`
4. Configure alert rules:

**Recommended Rules:**

**Critical Errors:**
```yaml
Name: Critical Errors
Condition: level:fatal
Frequency: Immediately
Notification: Email
```

**High Frequency Errors:**
```yaml
Name: High Frequency Errors
Condition: count > 10 in 1 hour
Frequency: Once per hour
Notification: Email
```

**New Issues:**
```yaml
Name: New Issues
Condition: is:new
Frequency: Daily digest (9 AM)
Notification: Email
```

### Telegram Integration (Optional)

**Setup:**
1. Create Telegram bot via @BotFather
2. Get bot token and chat ID
3. Configure webhook in GlitchTip
4. Test with sample error

**Webhook URL:**
```
https://api.telegram.org/bot<TOKEN>/sendMessage
```

**Payload:**
```json
{
  "chat_id": "<CHAT_ID>",
  "text": "🔴 Critical Error: {{ issue.title }}\nCount: {{ issue.count }}\nURL: {{ issue.url }}"
}
```

---

## 📊 Monitoring & Reports

### Daily Check (5 minutes)

**Every morning 9:00 AM:**

1. **Check Dashboard Stats**
   - Total errors last 24h
   - New issues count
   - Unresolved issues count

2. **Review Critical Issues**
   - Filter: `level:fatal OR level:error`
   - Sort: Last seen (newest first)
   - Action: Triage and assign

3. **Check Performance**
   - Average response time
   - Slow transactions (>1 second)
   - Database query performance

### Weekly Review (30 minutes)

**Every Monday 10:00 AM:**

1. **Error Trends**
   - Week-over-week comparison
   - Increasing/decreasing patterns
   - Seasonal variations

2. **Top Issues**
   - Most frequent errors
   - Highest impact issues
   - Recurring problems

3. **Resolution Rate**
   - Resolved vs New issues
   - Average time to resolution
   - SLA compliance

4. **Service Health**
   - Error rate by service
   - Performance by endpoint
   - Database query efficiency

### Monthly Report

**First Monday of month:**

1. **Executive Summary**
   - Total errors (month)
   - Critical incidents (count & details)
   - Resolution metrics
   - Service uptime

2. **Top Issues**
   - Most frequent errors (top 10)
   - Impact on users
   - Actions taken

3. **Improvements**
   - Error rate reduction
   - Performance gains
   - Code quality metrics

4. **Action Items**
   - Technical debt identified
   - Improvements planned
   - Resource needs

---

## 🎯 Best Practices

### 1. Error Prevention

**Proactive Measures:**
- ✅ Add comprehensive error handling
- ✅ Validate input data
- ✅ Use try-catch blocks
- ✅ Handle edge cases
- ✅ Test error paths

**Code Example:**
```javascript
try {
  const result = await database.query(sql, params);
  return result;
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'database',
      operation: 'query',
      query_type: 'select'
    },
    extra: {
      sql: sql.substring(0, 100), // Don't log full SQL
      params: params,
      duration: Date.now() - startTime
    }
  });
  throw error; // Re-throw after capturing
}
```

### 2. Context is Key

**Always include:**
- ✅ Operation being performed
- ✅ User ID (if authenticated)
- ✅ Service/component name
- ✅ Request parameters (sanitized)
- ✅ Timestamp

**Never include:**
- ❌ Passwords or secrets
- ❌ Credit card numbers
- ❌ Personal identifiable info (PII)
- ❌ API keys or tokens

### 3. Error Levels

**Use appropriate severity:**
```javascript
// ❌ BAD - All errors at same level
Sentry.captureException(error);

// ✅ GOOD - Appropriate levels
Sentry.captureException(error, { level: 'fatal' });  // System down
Sentry.captureException(error, { level: 'error' });  // Operation failed
Sentry.captureMessage('Slow query', { level: 'warning' }); // Performance issue
```

### 4. Noise Reduction

**Filter out known issues:**
```javascript
// Ignore specific errors
if (error.code === 'ECONNRESET' && retries < 3) {
  return retry(); // Don't capture, just retry
}

// Only capture after retry limit
if (retries >= 3) {
  Sentry.captureException(error, {
    tags: { retries: retries }
  });
}
```

### 5. Performance Monitoring

**Track slow operations:**
```javascript
const transaction = Sentry.startTransaction({
  op: 'database.query',
  name: 'BookingService.findByUserId',
});

try {
  const result = await database.query(sql);
  return result;
} finally {
  transaction.finish(); // Automatically reports duration
}
```

---

## 🚨 Incident Response

### When Critical Error Occurs

**Immediate Actions (within 5 minutes):**

1. **Assess Impact**
   - How many users affected?
   - What functionality broken?
   - Is service down or degraded?

2. **Notify Team**
   - Alert on-call engineer
   - Update status page (if applicable)
   - Inform stakeholders

3. **Initial Mitigation**
   - Rollback if recent deploy
   - Scale resources if capacity issue
   - Enable maintenance mode if needed

4. **Start Investigation**
   - Check GlitchTip for error details
   - Review deployment logs
   - Check system resources

**Follow-up (within 1 hour):**

1. **Root Cause Analysis**
   - Identify what caused issue
   - Document in incident report
   - Add to GlitchTip issue comments

2. **Implement Fix**
   - Code changes
   - Configuration updates
   - Infrastructure adjustments

3. **Verify Resolution**
   - Test in staging
   - Deploy to production
   - Monitor for 1 hour

4. **Post-Mortem (within 24 hours)**
   - Write incident report
   - Identify preventive measures
   - Update runbooks

---

## 📈 Metrics & KPIs

### Error Rate

**Target:** <0.1% of requests

**Formula:**
```
Error Rate = (Total Errors / Total Requests) * 100
```

**Monitoring:**
- Daily: Check if >0.1%
- Weekly: Track trend
- Monthly: Review patterns

### Mean Time to Resolution (MTTR)

**Targets:**
- P0 (Critical): <4 hours
- P1 (High): <24 hours
- P2 (Medium): <1 week
- P3 (Low): <1 month

**Monitoring:**
- Track time from "New" to "Resolved"
- Calculate average per priority
- Identify bottlenecks

### Error-Free Rate

**Target:** >99.9% of time

**Formula:**
```
Error-Free Rate = (Time without critical errors / Total time) * 100
```

**Monitoring:**
- Track critical error-free periods
- Measure uptime
- Report monthly

### Top Issues Resolution

**Target:** Top 10 issues resolved within 1 sprint

**Monitoring:**
- Identify top 10 by frequency
- Track resolution status
- Report in sprint review

---

## 🔗 Related Documentation

**Migration Documentation:**
- `dev/active/sentry-to-glitchtip-migration/PHASE_3_START.md` - Current monitoring
- `dev/active/sentry-to-glitchtip-migration/sentry-to-glitchtip-production-review.md` - Production review

**Technical Documentation:**
- `src/instrument.js` - Sentry initialization
- `.claude/skills/error-tracking/` - Error tracking skill

**Operational Docs:**
- `docs/TROUBLESHOOTING.md` - Common issues
- `docs/ARCHITECTURE.md` - System architecture

---

## 🆘 Support

**Questions?**
- Check GlitchTip documentation: https://glitchtip.com/documentation/
- Review Sentry SDK docs: https://docs.sentry.io/platforms/node/
- Ask in team chat

**Issues with GlitchTip?**
- Check container status: `ssh root@46.149.70.219 "cd /opt/glitchtip && docker compose ps"`
- Review logs: `docker compose logs -f`
- Restart if needed: `docker compose restart`

**Emergency Rollback:**
- Revert to Sentry SaaS (< 5 min): See `PHASE_3_START.md`

---

**Last Updated:** 2025-11-24
**Status:** Production Active
**Next Review:** After Phase 3 completion (2025-11-26)
