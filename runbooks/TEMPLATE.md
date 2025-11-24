# [Error Name] - Runbook

**Pattern:** `[regex pattern for matching]`
**Severity:** [Low/Medium/High/Critical]
**MTTR Target:** [X minutes]
**Last Updated:** [YYYY-MM-DD]

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `[specific text]`
- Stack trace shows: `[file/function]`
- Component tags: `[service names]`
- Typically occurs: [when/where/how often]

**Examples:**
```
[paste actual error message example]
```

---

## 🔍 Diagnosis

**Root Cause:**
[Explain what causes this error]

**How to verify:**
```bash
# Step 1: Check [service/resource] status
[command]

# Step 2: Verify [configuration/connection]
[command]

# Step 3: Look for [specific condition]
[command]
```

**Common Triggers:**
1. [Trigger 1 - e.g., "High load"]
2. [Trigger 2 - e.g., "Network issue"]
3. [Trigger 3 - e.g., "Configuration change"]

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: [Action description]
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "[command]"

# Step 2: [Action description]
[command]

# Step 3: [Action description]
[command]
```

**Verification:**
```bash
# Check if fix worked
[verification command]
```

**Expected Result:**
- [What should happen after fix]
- [How to confirm it's resolved]

**Rollback Plan (if fix fails):**
```bash
# Revert changes
[rollback command]
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] [Change 1 - e.g., "Increase connection pool"]
- [ ] [Change 2 - e.g., "Add health check"]
- [ ] [Change 3 - e.g., "Enable monitoring alert"]

**Monitoring:**
- Add alert for: [metric/condition]
- Threshold: [value]
- Action: [what to do when alert fires]

**Code Changes:**
- [ ] [Improvement 1 - e.g., "Add retry logic"]
- [ ] [Improvement 2 - e.g., "Add timeout"]
- [ ] [Improvement 3 - e.g., "Improve error handling"]

**Documentation:**
- [ ] Update docs at: [file path]
- [ ] Add test case: [description]
- [ ] Update team knowledge: [where]

---

## 📊 History

**Occurrences:**
- [YYYY-MM-DD] - [brief description, fix applied]
- [YYYY-MM-DD] - [brief description, fix applied]

**Related Issues:**
- GlitchTip #[issue_id] - [title]
- GitHub #[pr_number] - [title]

**Improvements Made:**
- [YYYY-MM-DD] - [what was improved]

---

## 🔗 Related Resources

**Internal Docs:**
- [Link to architecture doc]
- [Link to service README]
- [Link to configuration file]

**External Resources:**
- [Link to library docs]
- [Link to Stack Overflow solution]
- [Link to GitHub issue]

**Team Contacts:**
- Primary: [Name/Role]
- Backup: [Name/Role]
- Escalation: [Name/Role]

---

**Runbook Version:** 1.0
**Author:** [Name]
**Reviewed By:** [Name]
**Next Review:** [YYYY-MM-DD]
