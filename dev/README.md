# Development Task Management

This directory contains active development tasks and their documentation, following the **Dev Docs System** pattern.

## 📁 Structure

```
dev/
├── active/           # Current tasks being worked on
│   └── [task-name]/
│       ├── [task-name]-plan.md      # Comprehensive implementation plan
│       ├── [task-name]-context.md   # Key context, decisions, files
│       └── [task-name]-tasks.md     # Checklist for tracking progress
├── archive/          # Completed tasks (for reference)
└── templates/        # Templates for new tasks
```

## 🚀 Workflow

### Starting a New Task

**Step 1: Planning Phase**
```bash
# Use planning mode or /dev-docs command
/dev-docs implement WhatsApp message queueing
```

This will:
1. Research your codebase
2. Create comprehensive plan
3. Generate three files automatically in `dev/active/[task-name]/`

**Step 2: Review the Plan**
- Read `[task-name]-plan.md` thoroughly
- Check if Claude understood requirements correctly
- Catch any misunderstandings BEFORE implementation

**Step 3: Start Implementation**
- Work through tasks in `[task-name]-tasks.md`
- Update context in `[task-name]-context.md` as you go
- Mark tasks completed immediately (use ✅)

### During Implementation

**Update regularly:**
- Mark tasks as ✅ Done immediately when finished
- Add new tasks discovered during work
- Update context with key decisions
- Note any blockers or issues

**Before context limits:**
```bash
# Update dev docs before compaction
/dev-docs-update

# This captures:
# - Current implementation state
# - Key decisions made
# - Files modified and why
# - Next steps
```

### After Context Reset

**Continue seamlessly:**
1. Check `/dev/active/` for existing tasks
2. Read all three files before proceeding:
   - `plan.md` - What we're building
   - `context.md` - Current state & decisions
   - `tasks.md` - What's done, what's next
3. Update "Last Updated" timestamps as you work

## 📋 File Purposes

### `[task-name]-plan.md`
**The master plan** - created once, rarely changed:
- Executive Summary
- Current State Analysis
- Implementation Phases
- Detailed Tasks with acceptance criteria
- Risk Assessment
- Success Metrics
- Timeline Estimates

### `[task-name]-context.md`
**Living context document** - updated frequently:
- Current implementation state
- Key architectural decisions
- Files modified and why
- Integration points discovered
- Blockers and workarounds
- Performance considerations
- Testing notes

**Update this BEFORE context compaction!**

### `[task-name]-tasks.md`
**Progress tracker** - updated constantly:
- Checklist format with ✅/⬜
- Group tasks by phase/component
- Mark completed immediately
- Add new tasks as discovered
- Reorder priorities as needed

## 🎯 Best Practices

### ✅ Do:
- Create dev docs for ANY task >30 minutes
- Update context BEFORE running low on context
- Mark tasks completed IMMEDIATELY
- Be specific in context notes
- Include file paths and line numbers
- Note "why" not just "what"

### ❌ Don't:
- Skip dev docs for "quick" tasks that grow
- Batch-update tasks at end of session
- Forget to update timestamps
- Leave vague notes like "fixed bug"
- Assume you'll remember details later

## 🔄 Task Lifecycle

```
Planning → Active Development → Context Updates → Completion → Archive

1. /dev-docs [description]     # Creates plan + context + tasks
2. Work on tasks               # Update context & tasks frequently
3. /dev-docs-update            # Before context limits
4. Complete task               # Move to archive/
```

## 📚 Examples

### Good Context Entry:
```markdown
## 2025-11-03: WhatsApp Queue Implementation

**Modified Files:**
- `src/queue/whatsapp-queue.ts:45-89` - Added message batching logic
- `src/integrations/whatsapp/client.ts:23` - Updated to use queue

**Decision:** Using BullMQ instead of simple array because:
- Need persistence across restarts
- Rate limiting requires delayed jobs
- Better monitoring with Redis

**Next:** Test queue with 100+ messages, verify rate limiting works
```

### Bad Context Entry:
```markdown
## 2025-11-03
Fixed stuff. Updated files. Works now.
```

## 🤖 Slash Commands

### `/dev-docs [description]`
Create comprehensive strategic plan with all three files.

**Use when:**
- Starting any task >30 minutes
- Exiting planning mode
- Complex features that need structure

### `/dev-docs-update [optional context]`
Update dev docs before context compaction.

**Use when:**
- Approaching context limits (~10-15% left)
- Switching to different task
- End of session

### `/route-research-for-testing`
Research affected routes and launch tests (for API development).

## 🎓 Why This System Works

**Problem:** Claude has "extreme amnesia" - loses track easily on large tasks.

**Solution:** Persistent documentation that survives context resets:
- **plan.md** = "What we're building"
- **context.md** = "Where we are + key decisions"
- **tasks.md** = "What's done, what's next"

**Result:**
- ✅ No more "lost the plot" moments
- ✅ Seamless continuation after compaction
- ✅ Easy handoffs between sessions
- ✅ Clear progress tracking
- ✅ Prevents rework

## 📖 Source

Based on the **Dev Docs System** from [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase) by diet103.

**Quote from creator:**
> "This system, out of everything (besides skills), I think has made the most impact on the results I'm getting out of CC."

---

**Last Updated:** November 3, 2025
**Status:** ✅ Active
