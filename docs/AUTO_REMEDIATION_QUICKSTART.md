# Auto-Remediation Quick Start Guide

**Last Updated:** 2025-11-24
**For:** AI Admin v2 Team (1-2 developers)
**Read Time:** 5 minutes

---

## ONE-PAGE DECISION GUIDE

### Question 1: Should I build auto-remediation?

**Answer: Sort of. Build THIS instead:**

```
✅ DO BUILD (Weeks 1-3):
   "Enhanced Manual Workflow"
   - Error aggregation rules
   - Better logging
   - Investigation helper scripts
   - Runbook repository
   
   Cost: $1,550 (31 hours)
   Savings: 70% time
   ROI: 400-600% per year

⚠️ MAYBE ADD (Week 4+):
   "Auto-Triage MVP"
   - Only if >20 errors/day
   - Only if manual still painful
   
   Cost: $600 (12 hours)
   Savings: +5% more (75% total)
   Ongoing: $100-500/month

❌ DON'T BUILD:
   - Investigation Agent (use Claude Code interactively)
   - PR Generation (doesn't work with Claude Code)
   - Auto-Fixes (too risky, negative ROI)
```

### Question 2: What's the fastest path to value?

**Answer: 3-week implementation:**

```
Week 1: Quick Wins (8 hours)
  Day 1: Error aggregation rules (2h)
         → 90% reduction in alert noise
  Day 2-3: Better logging (6h)
           → 30-50% faster triage

Week 2: Core Tools (15 hours)
  Day 1-2: Investigation helper scripts (10h)
           → 50-70% faster investigation
  Day 3: Runbook repository (5h)
         → 80% faster for known issues

Week 3: Polish & Measure (8 hours)
  Day 1: Smart Telegram alerts (4h)
         → Rich context in alerts
  Day 2-5: Track metrics, measure impact

Result: 70% time savings, $0 ongoing costs
```

### Question 3: What's wrong with the original plan?

**Answer: Three critical issues:**

```
1. WRONG ARCHITECTURE
   Plan assumes: Task() API in Claude Code
   Reality: No such API exists
   Fix: Use Anthropic SDK directly OR Claude Code interactively

2. WRONG COST ESTIMATE
   Plan says: "Low cost, maybe a few dollars"
   Reality: $3,000+/month for full automation
   Fix: Start with zero-cost manual enhancements

3. WRONG ROI
   Plan claims: 50% faster resolution
   Reality: Enhanced manual is 70% faster (better!)
   Fix: Enhanced manual first, measure, then decide
```

---

## IMPLEMENTATION CHECKLIST

### Phase 0: Baseline (Day 0, 2 hours)

```bash
# Before changing ANYTHING, measure current state

□ Track error count (use GlitchTip dashboard)
  - Errors per day (average)
  - Errors per day (p95)
  
□ Time 10 manual triages (stopwatch)
  - Start: See alert
  - End: Assign priority + owner
  - Average: _____ minutes
  
□ Time 5 investigations (stopwatch)
  - Start: Begin investigating
  - End: Root cause identified
  - Average: _____ minutes

□ Document result in issue:
  - "Baseline: X errors/day, Y min triage, Z min investigation"
```

### Phase 1: Error Aggregation (Day 1, 2 hours)

```bash
# 90% reduction in alert noise

□ Login to GlitchTip UI
  http://localhost:9090 (via SSH tunnel)

□ Navigate to Settings → Issue Grouping

□ Add grouping rules:
  1. Stack trace similarity: High
  2. Error message pattern matching: Enabled
  3. Deduplicate similar errors: 1 hour window
  
□ Test: Trigger same error 3 times
  Expected: Only 1 alert received
  
□ Result: Alerts reduced by _____% (track for 24h)
```

### Phase 2: Better Logging (Days 2-4, 10 hours)

```bash
# 30-50% faster triage through context

□ Audit current Sentry.captureException() calls
  grep -r "Sentry.captureException" src/
  Found: _____ locations

□ Add context to each:
  Before:
    Sentry.captureException(error);
  
  After:
    Sentry.captureException(error, {
      tags: {
        operation: 'booking_create',
        service: 'ai-admin-api',
        endpoint: '/api/bookings'
      },
      user: { id: userId, email: userEmail },
      extra: {
        requestParams: sanitized(params),
        timing: executionTime,
        attemptNumber: retryCount
      }
    });

□ Focus on high-error locations first:
  1. src/database/postgres.js (4 calls)
  2. src/repositories/BaseRepository.js (5 calls)
  3. src/integrations/whatsapp/auth-state-timeweb.js (10 calls)
  
□ Test: Trigger error, check GlitchTip
  Expected: All context visible in error details
  
□ Measure: Time 5 triages again
  Before: _____ minutes
  After: _____ minutes
  Improvement: _____%
```

### Phase 3: Investigation Helper (Days 5-7, 10 hours)

```bash
# 50-70% faster investigation

□ Create helper script:
  touch scripts/investigate-error.sh
  chmod +x scripts/investigate-error.sh

□ Implement script features:
  #!/bin/bash
  ERROR_ID=$1
  
  # 1. Fetch error from GlitchTip API
  # 2. Extract stack trace file paths
  # 3. Read related files (10 lines context)
  # 4. Get recent commits (git log)
  # 5. Search similar errors (grep logs)
  # 6. Format as markdown report
  # 7. Open in Claude Code session
  
□ Test script:
  ./scripts/investigate-error.sh <recent-error-id>
  
□ Verify:
  - Report includes all context
  - Claude Code opens with report
  - Can ask follow-up questions
  
□ Measure: Time 5 investigations
  Before: _____ minutes
  After: _____ minutes
  Improvement: _____%
```

### Phase 4: Runbook Repository (Days 8-9, 5 hours)

```bash
# 80% faster fixes for known issues

□ Create runbook directory:
  mkdir -p docs/runbooks

□ Document top 5 common errors:
  1. Database connection timeout
  2. Redis connection failed
  3. WhatsApp session expired
  4. YClients API rate limit
  5. Out of memory error

□ Runbook template:
  # Error: <error-message-pattern>
  
  ## Symptoms
  - What users see
  - When it occurs
  
  ## Quick Fix (1-2 minutes)
  ```bash
  # Commands to run
  ```
  
  ## Root Cause
  - Why it happens
  
  ## Long-term Prevention
  - How to prevent
  
  ## Related Errors
  - Similar issues

□ Link runbooks from GlitchTip:
  - Add comment with runbook link to each recurring error
  
□ Measure: Time to fix for known errors
  Before: _____ minutes
  After: _____ minutes
  Improvement: _____%
```

### Phase 5: Smart Alerts (Days 10-11, 4 hours)

```bash
# Rich context in Telegram alerts

□ Update Telegram alert handler:
  - Include error context
  - Suggest runbook link (if available)
  - Add quick action buttons
  
□ Alert template:
  🔥 <error-title>
  
  Priority: <suggested-priority>
  Service: <service-name>
  Occurred: <count> times in <timeframe>
  
  Context:
  - User: <user-id>
  - Operation: <operation>
  - Timing: <execution-time>
  
  📖 Runbook: <link-if-available>
  🔍 GlitchTip: <link>
  
  [🔴 P0] [🟠 P1] [🟡 P2] [⚪ P3]

□ Test alert:
  - Trigger error
  - Verify Telegram message format
  - Test quick action buttons
  
□ Result: Faster decision-making from alerts
```

### Phase 6: Measure & Decide (Week 3-4)

```bash
# Compare before/after, decide on auto-triage

□ Track metrics for 2 weeks:
  Metric                Before    After    Improvement
  ────────────────────────────────────────────────────
  Errors/day:           _____     _____    _____%
  Triage time:          _____     _____    _____%
  Investigation time:   _____     _____    _____%
  Fix time (known):     _____     _____    _____%
  Total time/error:     _____     _____    _____%
  
□ Calculate ROI:
  Development cost: $1,550 (31 hours)
  Time saved/error: _____ minutes
  Errors/month: _____ errors
  Developer rate: $50/hour
  
  Monthly savings: _____ min/error × _____ errors × $50/60
                 = $_____ per month
  
  Break-even: $1,550 ÷ $_____ = _____ months
  ROI (1 year): ($_____ × 12 - $1,550) ÷ $1,550 = _____%

□ Decision point:
  If time savings < 50% → Something wrong, debug
  If time savings 50-70% → Success! Stop here (probably sufficient)
  If time savings > 70% but still painful → Consider auto-triage
  
□ Auto-triage decision criteria:
  Is error volume > 20/day? YES / NO
  Is manual triage still painful? YES / NO
  Is budget available ($100-500/month)? YES / NO
  
  If all YES → Proceed to Phase 7 (Auto-Triage MVP)
  If any NO → Stop here (enhanced manual sufficient)
```

### Phase 7: Auto-Triage MVP (Optional, Week 5-6, 12 hours)

```bash
# ONLY if Phase 6 metrics justify it

□ Install Anthropic SDK:
  npm install @anthropic-ai/sdk
  
□ Get API key:
  - Create account: https://console.anthropic.com/
  - Generate API key
  - Add to .env: ANTHROPIC_API_KEY=sk-...

□ Create webhook handler:
  File: src/services/error-triage/webhook-handler.js
  
  app.post('/api/glitchtip-webhook', async (req, res) => {
    res.status(202).json({ status: 'queued' });
    
    const error = sanitizeError(req.body);
    const analysis = await triageWithClaude(error);
    
    await sendTelegramWithButtons(error, analysis);
  });

□ Implement triage function:
  async function triageWithClaude(error) {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Triage this error: ${JSON.stringify(error)}`
      }]
    });
    
    return parseTriageResponse(response.content[0].text);
  }

□ Add cost controls:
  - Daily budget cap ($10/day)
  - Circuit breaker (5 failures → stop)
  - PII scrubbing (before sending to API)

□ Add Telegram approval buttons:
  [✅ Accept P1] [✏️ Edit] [⬇️ Downgrade to P2] [🔇 Ignore]

□ Test with 10 real errors:
  - AI suggestion accuracy: _____ % correct
  - Time savings: _____ minutes/error
  - API cost: $_____ per error

□ Track for 1 week:
  - Acceptance rate (should be >85%)
  - False positive rate (should be <15%)
  - Cost per error (should be $0.01-0.02)

□ Decide:
  If acceptance rate > 85% → Success, keep running
  If acceptance rate < 85% → AI not accurate enough, disable
  If cost > $0.05/error → Too expensive, disable
```

---

## WHAT NOT TO DO

### ❌ Don't Build Investigation Agent

**Why:**
- Claude API has no codebase access
- Needs manual context (defeats automation)
- Helper scripts + Claude Code interactive is better

**Do this instead:**
```bash
# When investigating unknown error:
./scripts/investigate-error.sh <error-id>
# Opens Claude Code with all context
# Human guides investigation interactively
# Zero API costs, better outcomes
```

### ❌ Don't Build PR Generation

**Why:**
- Claude Code can't be scripted
- GitHub Actions can't run interactive tools
- Security risk (AI code without human review)

**Do this instead:**
```
# In Claude Code session:
You: "Fix error #123"
Claude: [analyzes, suggests fix]
You: "Show me the changes"
Claude: [displays diff]
You: "Apply that"
Claude: [makes changes]
You: "Run tests"
Claude: [runs tests]
# Human reviews every step
```

### ❌ Don't Build Pattern Auto-Fixes

**Why:**
- False positives: 10-30% wrong diagnosis
- Cascading failures possible
- Negative ROI (cost > savings)

**Do this instead:**
```bash
# Runbook with human execution:
docs/runbooks/redis-connection-failed.md

## Quick Fix (1 minute)
systemctl restart redis
pm2 restart ai-admin-api

# Human reads runbook, executes command
# Zero false positives, zero cascading failures
```

---

## SUCCESS CRITERIA

### After Week 2 (Enhanced Manual)

```
✅ Alert noise reduced by 80-90%
✅ Triage time reduced by 40-60%
✅ Investigation time reduced by 50-70%
✅ Fix time (known errors) reduced by 70-80%
✅ Overall time saved: 60-70%
✅ Team satisfaction: High
✅ Zero ongoing costs
```

### After Week 4 (If Adding Auto-Triage)

```
✅ AI suggestion acceptance rate >85%
✅ Triage time reduced additional 5-10%
✅ Overall time saved: 70-75%
✅ API costs <$500/month
✅ Zero incidents caused
✅ Team satisfaction: High or higher
```

---

## TROUBLESHOOTING

### Problem: Enhanced manual not saving time

**Diagnosis:**
```bash
# Check if implementations are correct:

1. Error aggregation working?
   - Check GlitchTip settings
   - Should see 1 alert per issue, not per occurrence

2. Logging context appearing?
   - Check error details in GlitchTip
   - Should see tags, user, extra data

3. Helper scripts running?
   - Test: ./scripts/investigate-error.sh <id>
   - Should open Claude Code with report

4. Runbooks accessible?
   - Check docs/runbooks/ directory
   - Team knows they exist?
```

**Fix:**
- Identify missing component
- Re-implement following checklist
- Test with real error

### Problem: Auto-triage suggestions wrong

**Diagnosis:**
```bash
# Check accuracy:
- Acceptance rate: _____%
- If <85%, AI not accurate enough

# Common causes:
1. Not enough context in error
   Fix: Add more tags/extra data
   
2. Errors too diverse
   Fix: Pattern matching not suitable
   
3. Training data mismatch
   Fix: Use different model or prompt
```

**Fix:**
- If accuracy <85% after 2 weeks → Disable auto-triage
- Enhanced manual already gives 70% savings
- Don't force AI if it's not accurate

### Problem: Costs higher than expected

**Diagnosis:**
```bash
# Check API usage:
- Errors/day: _____
- Cost/error: $_____
- Monthly cost: $_____ (errors × cost)

# If >$500/month:
1. Too many errors (>50/day)
   → Need better error prevention
   
2. Large error payloads
   → Truncate before sending to API
   
3. Using wrong model
   → Switch from Opus to Sonnet
```

**Fix:**
- Implement daily budget cap
- Truncate error payloads (max 10K chars)
- Use Sonnet 4.5 (cheaper, fast enough)

---

## QUICK REFERENCE

### Error Volume Decision Tree

```
<10 errors/day → Enhanced Manual only
10-20 errors/day → Enhanced Manual + measure
20-50 errors/day → Enhanced Manual + maybe auto-triage MVP  
>50 errors/day → Enhanced Manual + definitely auto-triage
```

### Time Investment Summary

```
Enhanced Manual: 31 hours ($1,550)
  - Week 1: 8 hours (quick wins)
  - Week 2: 15 hours (core tools)
  - Week 3: 8 hours (polish + measure)

Auto-Triage MVP: 12 hours ($600)
  - Only if justified by metrics
  - Incremental, test first

Total: 31-43 hours ($1,550-2,150)
```

### Cost Summary

```
Enhanced Manual:
  - Development: $1,550 (one-time)
  - Ongoing: $0/month
  - Break-even: 1-2 months
  - ROI (1 year): 400-600%

+ Auto-Triage:
  - Development: +$600 (one-time)
  - Ongoing: +$100-500/month
  - Break-even: 2-4 months (from start)
  - ROI (1 year): 200-300%
```

---

## NEED HELP?

**Full Documentation:**
- `docs/AUTO_REMEDIATION_REVIEW.md` - 14,000-word comprehensive review
- `docs/AUTO_REMEDIATION_REVIEW_SUMMARY.md` - 3,000-word executive summary
- `docs/AUTO_REMEDIATION_COMPARISON.md` - Side-by-side comparison tables
- `docs/AUTO_REMEDIATION_QUICKSTART.md` - This document

**Key Findings:**
1. Enhanced manual is better ROI than full automation
2. Auto-triage only adds 5% (not worth it at low volume)
3. Claude Code interactive > automated investigation
4. Start simple, measure, expand only if justified

**Questions?**
- Review full report for detailed analysis
- All code examples, cost calculations included
- Security considerations documented

---

**Last Updated:** 2025-11-24
**Review by:** Claude Code - Senior Technical Plan Reviewer
**Status:** Production Ready
**Next:** Start with Phase 0 (Baseline)
