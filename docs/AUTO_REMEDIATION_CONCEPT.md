# Auto-Remediation System Concept

**Status:** Concept / RFC
**Created:** 2025-11-24
**Author:** AI Admin v2 Team

---

## 🎯 Goal

Create a semi-automated error remediation system that:
1. Catches errors in GlitchTip
2. Uses Claude Code agents to investigate
3. Suggests fixes (but requires human approval)
4. Tracks resolution progress

**Key Principle:** Humans in the loop for all production changes

---

## 🏗️ Architecture

### Phase 1: Auto-Triage (Safe, Easy)

**Components:**
```
GlitchTip Error
    ↓
Webhook → /api/glitchtip-webhook
    ↓
Triage Agent (analyzes)
    ↓
Actions:
  - Set priority (P0-P3)
  - Add tags
  - Assign to developer
  - Send alert (Telegram)
    ↓
Human reviews and fixes
```

**Implementation:**
```javascript
// src/services/error-triage/webhook-handler.js
const { Task } = require('@anthropic/claude-sdk');

app.post('/api/glitchtip-webhook', async (req, res) => {
  const error = req.body;

  // Launch triage agent
  const analysis = await Task({
    subagent_type: 'general-purpose',
    description: 'Triage GlitchTip error',
    prompt: `
      Analyze this error and provide:
      1. Priority (P0-P3)
      2. Likely root cause
      3. Affected users estimate
      4. Recommended assignee

      Error: ${JSON.stringify(error, null, 2)}
    `
  });

  // Apply triage results
  await applyTriage(error, analysis);

  res.json({ status: 'triaged' });
});
```

---

### Phase 2: Investigation Agent (Safe, Helpful)

**Components:**
```
P0/P1 Error
    ↓
Investigation Agent
    ↓
Gathers:
  - Related code files
  - Recent commits
  - Similar resolved issues
  - Stack Overflow solutions
    ↓
Creates GitHub Issue:
  - Title: "[Auto] Error: ConnectionTimeout in Database"
  - Body: Investigation report + Suggested fix
  - Labels: auto-investigated, needs-review
    ↓
Human reviews and implements
```

**Implementation:**
```javascript
// src/services/error-triage/investigation-agent.js
async function investigateError(error) {
  return await Task({
    subagent_type: 'general-purpose',
    description: 'Investigate error root cause',
    prompt: `
      Investigate this production error:

      Error: ${error.title}
      Stack trace: ${error.stackTrace}
      Occurrences: ${error.count}
      First seen: ${error.firstSeen}

      Please:
      1. Search codebase for related files
      2. Check recent commits in affected areas
      3. Search for similar issues (resolved)
      4. Propose root cause
      5. Suggest specific code fix
      6. Generate test cases

      Output format: Markdown report
    `
  });
}

// Create GitHub issue
async function createInvestigationIssue(error, investigation) {
  await octokit.issues.create({
    owner: 'your-org',
    repo: 'ai-admin-v2',
    title: `[Auto] ${error.title}`,
    body: `
## 🤖 Automated Investigation Report

**Error:** ${error.title}
**Priority:** ${error.priority}
**Occurrences:** ${error.count}
**GlitchTip:** ${error.url}

---

${investigation.report}

---

## 🔧 Suggested Fix

\`\`\`javascript
${investigation.suggestedFix}
\`\`\`

## ✅ Test Cases

${investigation.testCases}

---

**⚠️ Note:** This is an automated investigation. Please review thoroughly before applying fix.
    `,
    labels: ['auto-investigated', 'needs-review', error.priority]
  });
}
```

---

### Phase 3: Suggested Fixes (Safe, Review Required)

**Components:**
```
GitHub Issue created
    ↓
Developer reviews
    ↓
Clicks "Generate PR with fix"
    ↓
Fix Agent creates:
  - Code changes
  - Test cases
  - Documentation updates
    ↓
PR created (draft)
    ↓
Human reviews PR
    ↓
Approves & merges (or requests changes)
    ↓
Normal deployment process
```

**Implementation:**
```javascript
// GitHub Action: .github/workflows/generate-fix.yml
name: Generate Fix PR

on:
  issue_comment:
    types: [created]

jobs:
  generate-fix:
    if: contains(github.event.comment.body, '/generate-fix')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Generate Fix
        run: |
          # Launch Claude Code agent
          claude-code agent fix \
            --issue ${{ github.event.issue.number }} \
            --create-pr

      - name: Create Draft PR
        run: |
          # PR is created in draft mode
          # Requires human review before merge
```

---

### Phase 4: Pattern-Based Auto-Fix (Controlled)

**Only for known, safe patterns:**

```javascript
// src/services/error-triage/pattern-matcher.js
const SAFE_AUTO_FIX_PATTERNS = [
  {
    pattern: /Module not found: @sentry\/node/,
    fix: async () => {
      await exec('npm install @sentry/node');
      await exec('pm2 restart all');
    },
    confidence: 'high',
    requires_approval: false
  },
  {
    pattern: /ECONNREFUSED.*redis/,
    fix: async () => {
      await exec('systemctl restart redis');
    },
    confidence: 'high',
    requires_approval: false
  },
  {
    pattern: /Disk space critically low/,
    fix: async () => {
      await exec('./scripts/cleanup-logs.sh');
      await sendAlert('Disk cleanup executed automatically');
    },
    confidence: 'high',
    requires_approval: false
  }
];

async function tryAutoFix(error) {
  const pattern = SAFE_AUTO_FIX_PATTERNS.find(p =>
    p.pattern.test(error.message)
  );

  if (!pattern) {
    return { applied: false, reason: 'No pattern matched' };
  }

  if (pattern.requires_approval) {
    await requestApproval(error, pattern);
    return { applied: false, reason: 'Awaiting approval' };
  }

  // Apply fix
  try {
    await pattern.fix();
    await sendAlert(`✅ Auto-fix applied for: ${error.title}`);
    return { applied: true, pattern: pattern };
  } catch (fixError) {
    await sendAlert(`❌ Auto-fix failed: ${fixError.message}`);
    return { applied: false, reason: fixError.message };
  }
}
```

---

## ⚠️ Safety Guidelines

### Always Require Human Review For:

1. **Code changes** (any production code)
2. **Database operations** (migrations, schema changes)
3. **Configuration changes** (env vars, docker-compose)
4. **Security-related fixes** (auth, permissions, encryption)
5. **User-facing changes** (UI, API responses)

### Auto-Fix Only For:

1. **Infrastructure issues** (restart services, cleanup logs)
2. **Known safe patterns** (install missing packages)
3. **Transient errors** (retry operations)
4. **Resource management** (disk cleanup, cache clear)

### Never Auto-Fix:

1. **Complex logic errors** (require business context)
2. **Data corruption** (risk of data loss)
3. **Security vulnerabilities** (need thorough review)
4. **API breaking changes** (affect clients)

---

## 📊 Metrics to Track

1. **Triage Accuracy**
   - Agent-assigned priority vs human adjustment
   - Target: >90% correct

2. **Investigation Quality**
   - How often suggested fix is correct
   - Target: >70% helpful

3. **Time to Resolution**
   - With agent assistance vs without
   - Target: 30% faster

4. **False Positives**
   - Wrong auto-fixes applied
   - Target: <1%

5. **Human Intervention Rate**
   - How often human overrides agent
   - Target: <20%

---

## 🚀 Rollout Plan

### Stage 1: Monitoring Only (Week 1)

- Deploy webhook endpoint
- Log all errors, no actions
- Tune triage agent
- Measure accuracy

### Stage 2: Triage + Alerts (Week 2-3)

- Enable auto-triage
- Send Telegram alerts
- Create GitHub issues
- Collect feedback

### Stage 3: Investigation (Week 4-5)

- Enable investigation agent
- Generate suggested fixes
- Create draft PRs
- Review effectiveness

### Stage 4: Pattern Auto-Fix (Week 6+)

- Implement 3-5 safe patterns
- Monitor closely (24h)
- Expand gradually
- Document all patterns

---

## 💡 Example Use Cases

### Use Case 1: Database Connection Timeout

**Error:**
```
Error: Connection timeout
Component: database
Operation: connect
Occurrences: 15
```

**Agent Action:**
1. Triage: P1 (High - affects users)
2. Investigation:
   - Check database health
   - Review connection pool settings
   - Check recent schema changes
3. Suggested Fix:
   ```javascript
   // Increase connection timeout
   const pool = new Pool({
     connectionTimeoutMillis: 10000, // 5000 → 10000
     idleTimeoutMillis: 30000
   });
   ```
4. Create PR (draft)
5. Human reviews → Approves → Merges

**Time Saved:** ~2 hours of investigation

---

### Use Case 2: Missing NPM Package

**Error:**
```
Error: Cannot find module '@sentry/node'
Service: ai-admin-worker-v2
```

**Agent Action:**
1. Triage: P0 (Critical - service down)
2. Pattern Match: Known issue
3. Auto-Fix:
   ```bash
   npm install @sentry/node
   pm2 restart ai-admin-worker-v2
   ```
4. Alert sent: "✅ Auto-fix applied"

**Time Saved:** ~15 minutes (immediate fix)

---

### Use Case 3: API Rate Limit

**Error:**
```
Error: YClients API rate limit exceeded
Occurrences: 50 in 5 minutes
```

**Agent Action:**
1. Triage: P1 (High - API calls failing)
2. Investigation:
   - Check API call frequency
   - Review caching strategy
   - Check concurrent requests
3. Suggested Fix:
   ```javascript
   // Add exponential backoff
   const retry = async (fn, retries = 3) => {
     try {
       return await fn();
     } catch (error) {
       if (error.status === 429 && retries > 0) {
         await sleep(2 ** (3 - retries) * 1000);
         return retry(fn, retries - 1);
       }
       throw error;
     }
   };
   ```
4. Create GitHub issue with fix
5. Human reviews and implements

**Time Saved:** ~1 hour of research

---

## 🔐 Security Considerations

### Access Control

- Webhook endpoint: API key authentication
- GitHub integration: Read-only initially
- Auto-fix patterns: Allowlist only
- Audit log: All actions logged

### Secrets Management

- Never log sensitive data
- Redact credentials in error messages
- Secure API keys (Vault/AWS Secrets)
- Rotate keys regularly

### Approval Workflow

- All PRs created as drafts
- Required reviewers: 2 minimum
- Auto-merge disabled
- Manual deployment required

---

## 📚 Implementation Checklist

**Infrastructure:**
- [ ] GlitchTip webhook endpoint
- [ ] Triage agent deployment
- [ ] Telegram bot integration
- [ ] GitHub integration (issue creation)
- [ ] Monitoring dashboard

**Safety:**
- [ ] Human approval workflow
- [ ] Rollback procedures documented
- [ ] Audit logging enabled
- [ ] Rate limiting on auto-fixes
- [ ] Kill switch (disable all auto-actions)

**Testing:**
- [ ] Test with staging errors first
- [ ] Measure triage accuracy (>90%)
- [ ] Test suggested fixes (sandbox)
- [ ] Load testing (100 errors/min)
- [ ] Security review

**Documentation:**
- [ ] Runbook for operators
- [ ] Pattern allowlist documented
- [ ] Metrics dashboard
- [ ] Incident response procedures
- [ ] Team training materials

---

## 🎯 Success Criteria

**After 1 month:**
- [ ] 90%+ triage accuracy
- [ ] 50% faster time to resolution
- [ ] 0 incidents caused by auto-fixes
- [ ] 80%+ positive developer feedback
- [ ] 20+ safe patterns identified

---

## 🤔 Open Questions

1. **Cost:** Claude API calls per error?
2. **Latency:** How fast can agent investigate?
3. **Scale:** Can we handle 1000 errors/day?
4. **Accuracy:** What's acceptable false positive rate?
5. **Team Buy-in:** Will developers trust agent suggestions?

---

## 📖 References

- GlitchTip Webhooks: https://glitchtip.com/documentation/webhooks
- Claude Code SDK: https://github.com/anthropics/claude-code
- GitHub Actions: https://docs.github.com/actions
- Auto-remediation patterns: (to be documented)

---

**Status:** RFC (Request for Comments)
**Next Steps:**
1. Team discussion (validate concept)
2. Cost estimation (API usage)
3. Security review
4. POC development (Stage 1)

**Last Updated:** 2025-11-24
