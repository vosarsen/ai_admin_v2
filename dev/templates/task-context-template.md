# [Task Name] - Context & Decisions

**Last Updated:** YYYY-MM-DD HH:MM
**Current Status:** [Brief one-line status]

## Current Implementation State

### Completed Components
- ✅ Component A - brief description
- ✅ Component B - brief description

### In Progress
- 🔄 Component C - what's done, what remains
- 🔄 Component D - current blockers

### Not Started
- ⬜ Component E
- ⬜ Component F

## Key Architectural Decisions

### Decision 1: [Title]
**Date:** YYYY-MM-DD
**Why:** Reason for this approach
**Alternatives considered:** Other options we evaluated
**Impact:** How this affects the system

### Decision 2: [Title]
**Date:** YYYY-MM-DD
**Why:** Reason for this approach
**Alternatives considered:** Other options we evaluated
**Impact:** How this affects the system

## Files Modified

### Core Changes
- `path/to/file1.ts:45-89`
  - Added message batching logic
  - Integrated with BullMQ queue
  - **Why:** Need persistence and rate limiting

- `path/to/file2.ts:23-45`
  - Updated API client to use queue
  - **Why:** Prevent rate limit exceeded errors

### Supporting Changes
- `path/to/file3.ts`
  - Minor refactor for consistency

## Integration Points Discovered

### Service A Integration
**File:** `path/to/integration.ts:120`
**Discovery:** [What we learned]
**Approach:** [How we're handling it]

### Database Schema Updates
**File:** `prisma/schema.prisma`
**Changes:** New fields for queue tracking
**Migration:** Pending / Created / Applied

## Blockers & Workarounds

### Current Blockers
1. **Blocker:** Brief description
   - **Impact:** What it's blocking
   - **Workaround:** Temporary solution
   - **Resolution:** Who/what needed

### Resolved Blockers
1. **Blocker:** [Issue that was blocking]
   - **Resolution:** How we fixed it
   - **Lesson:** What we learned

## Performance Considerations

### Optimizations Applied
- Optimization 1: Result achieved
- Optimization 2: Result achieved

### Known Performance Issues
- Issue 1: Impact and mitigation plan
- Issue 2: Impact and mitigation plan

## Testing Notes

### Tests Added
- `test/file1.test.ts` - What it covers
- `test/file2.test.ts` - What it covers

### Manual Testing Performed
- ✅ Test scenario 1 - passed
- ✅ Test scenario 2 - passed
- ❌ Test scenario 3 - failed, needs fix

### Testing TODOs
- [ ] Edge case 1
- [ ] Edge case 2
- [ ] Load testing with 1000+ items

## Code Review Notes

### Self-Review Findings
- Finding 1: Action taken
- Finding 2: Action taken

### Refactoring Opportunities
- Opportunity 1: Why not done now
- Opportunity 2: Tracked in tasks

## Next Immediate Steps

1. **Next Action:** Specific next task
   - **File:** Where to work
   - **Approach:** How to do it

2. **Then:** Following task
   - **Depends on:** Previous completion

3. **After That:** Future task
   - **Note:** Any special considerations

## Session Handoff Notes

**For continuation after context reset or handoff:**

### Exactly Where We Left Off
- **File:** `path/to/file.ts:150`
- **Goal:** What we were implementing
- **Status:** 60% done, needs [specific remaining work]

### Commands to Run on Restart
```bash
# Verify services running
npm run dev:check

# Run tests
npm test path/to/tests
```

### Uncommitted Changes
- [ ] File 1 - ready to commit
- [ ] File 2 - needs review before commit
- [ ] File 3 - temporary debugging code, remove before commit

## Lessons Learned

### What Worked Well
- Approach 1: Why it was effective
- Pattern 2: Will reuse in future

### What to Avoid
- Anti-pattern 1: Why it caused issues
- Mistake 2: How to prevent next time

## Links & References

- [Related Documentation](link)
- [API Reference](link)
- [Similar Feature](link to code)
- [Discussion Thread](link)

---

**Reminder:** Update this file BEFORE context compaction!
