# Claude Code Infrastructure - Quick Start for Arbak

> **Goal:** Get the system running in 15 minutes, customize in 2-3 hours.

**What you're getting:** Auto-activating skills, error-checking hooks, task management system, and 10 specialized agents.

---

## ⚡ 15-Minute Setup

### Step 1: Copy Infrastructure (2 min)

```bash
# Navigate to Arbak's project
cd /path/to/arbak/project

# Copy the .claude folder from AI Admin v2
cp -r /path/to/ai_admin_v2/.claude .

# Verify
ls -la .claude
# Should see: skills/, hooks/, agents/, commands/, settings.json
```

---

### Step 2: Install Dependencies (3 min)

```bash
# Install hook dependencies
cd .claude/hooks
npm install

# Make hooks executable
chmod +x *.sh

# Go back to project root
cd ../..
```

---

### Step 3: Quick Test (5 min)

```bash
# Start Claude Code in your project
# (in terminal or via IDE)

# Test 1: Try auto-activation
# Type this prompt:
"How do I create a new API endpoint?"

# You should see:
# 🎯 SKILL ACTIVATION CHECK
# 📚 RECOMMENDED SKILLS:
#   → backend-dev-guidelines

# Test 2: Edit a file
# Ask Claude to edit any backend file
# After response, you should see:
# 📋 ERROR HANDLING SELF-CHECK
```

**✅ If both tests passed:** System is working!

**❌ If tests failed:** See Troubleshooting section below

---

### Step 4: Create Basic CLAUDE.md (5 min)

```bash
# Create a basic quick reference
cat > CLAUDE.md << 'EOF'
# CLAUDE.md - Quick Reference

## 🚀 Quick Start

**Before starting work:**
- Run `npm test` to ensure tests pass
- Check current tasks in backlog

## 🔧 Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm test` | Run test suite |
| `npm run build` | Build for production |

## 🎯 Claude Code Skills

**Auto-activating skills:**
- `backend-dev-guidelines` - Backend best practices
- `route-tester` - API testing patterns
- `error-tracking` - Error handling

**Manual invocation:**
- `/skill backend-dev-guidelines` - Load backend guidelines
- `/dev-docs [description]` - Create task planning docs

## 📍 Environment

- **Local:** $(pwd)

## 📚 Documentation

- See `docs/` for detailed documentation
EOF

# Review and edit as needed
cat CLAUDE.md
```

---

## 🎯 What Works Now

**✅ Skills System:**
- 4 skills installed (backend, route-tester, error-tracking, skill-developer)
- Auto-activation via hooks
- Manual invocation with `/skill [name]`

**✅ Hooks:**
- Skill activation on every prompt
- File edit tracking
- Error handling reminders

**✅ Dev Docs:**
- `/dev-docs` - Create strategic plan
- `/dev-docs-update` - Update before compaction
- Task tracking system

**✅ Agents:**
- 10 specialized agents ready to use
- Code review, testing, debugging, planning

---

## ⚠️ What Needs Customization

The system will work, but **won't be optimal** until you customize for YOUR project.

**MUST customize (2-3 hours):**
1. **Keywords** in `skill-rules.json` - Replace AI Admin terms with yours
2. **File paths** in `skill-rules.json` - Match your folder structure
3. **Backend skill** in `backend-dev-guidelines/SKILL.md` - Use your examples
4. **CLAUDE.md** - Add your specific commands and workflows

**See:** `customization-checklist.md` for detailed steps

---

## 🧪 Quick Verification

### Test 1: Skill Auto-Activation (1 min)

```bash
# Prompt with backend keywords
"How do I create a new service?"

# Expected result:
🎯 SKILL ACTIVATION CHECK
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines

# ✅ PASS: Skill suggests automatically
# ❌ FAIL: No suggestion appears
```

**If failed:**
- Check `.claude/hooks/skill-activation-prompt.sh` is executable
- Verify `settings.json` has UserPromptSubmit hook
- Try: `chmod +x .claude/hooks/*.sh`

---

### Test 2: Error Handling Reminder (1 min)

```bash
# Ask to edit a backend file
"Add error handling to [any backend file]"

# After Claude responds, expected:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ERROR HANDLING SELF-CHECK
⚠️  Backend Changes Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ✅ PASS: Reminder appears
# ❌ FAIL: No reminder
```

**If failed:**
- Check `.claude/hooks/error-handling-reminder.sh` is executable
- Verify Stop hook in `settings.json`
- Check hook dependencies: `cd .claude/hooks && npm install`

---

### Test 3: Dev Docs System (2 min)

```bash
# Create task planning docs
/dev-docs implement user authentication

# Expected: Creates 3 files
dev/active/user-authentication/
├── user-authentication-plan.md
├── user-authentication-context.md
└── user-authentication-tasks.md

# Verify
ls dev/active/user-authentication/

# ✅ PASS: 3 files created
# ❌ FAIL: Error or no files
```

**If failed:**
- Create directory: `mkdir -p dev/active`
- Check command exists: `ls .claude/commands/dev-docs.md`
- Try different syntax: `/dev-docs "implement user auth"`

---

### Test 4: Agent Usage (2 min)

```bash
# Ask Claude to use an agent
"Review the code in [backend folder] for best practices"

# Claude should respond:
"I'll use the code-architecture-reviewer agent..."

# Then launch: Task(subagent_type='code-architecture-reviewer', ...)

# ✅ PASS: Agent launches
# ❌ FAIL: Claude doesn't use agent
```

**If failed:**
- Be more explicit: "Use the code-architecture-reviewer agent"
- Check agent exists: `ls .claude/agents/code-architecture-reviewer.md`
- Try different agent: "Use the auto-error-resolver agent"

---

## 🆘 Troubleshooting

### Skills Don't Activate

**Symptoms:**
- No "🎯 SKILL ACTIVATION CHECK" message
- Skills don't load automatically

**Solutions:**
```bash
# 1. Make hooks executable
chmod +x .claude/hooks/*.sh

# 2. Install dependencies
cd .claude/hooks && npm install

# 3. Check settings.json has:
# "hooks": {
#   "UserPromptSubmit": [...]
# }

# 4. Test manually
/skill backend-dev-guidelines
```

---

### Error Reminder Doesn't Show

**Symptoms:**
- No "📋 ERROR HANDLING SELF-CHECK" after edits

**Solutions:**
```bash
# 1. Make hook executable
chmod +x .claude/hooks/error-handling-reminder.sh

# 2. Check settings.json has:
# "hooks": {
#   "Stop": [...]
# }

# 3. Edit a backend file to trigger
```

---

### Dev Docs Fails

**Symptoms:**
- `/dev-docs` command not found
- Files not created

**Solutions:**
```bash
# 1. Create directory
mkdir -p dev/active

# 2. Check command exists
ls .claude/commands/dev-docs.md

# 3. Try full syntax
/dev-docs implement feature xyz
```

---

### Agents Don't Launch

**Symptoms:**
- Claude doesn't use agents when expected

**Solutions:**
```bash
# 1. Be explicit in prompt
"Use the code-architecture-reviewer agent to review X"

# 2. Check agent exists
ls .claude/agents/

# 3. Try different phrasing
"Launch the auto-error-resolver agent"
```

---

## 📚 Next Steps

### Immediate (Day 1):
1. ✅ Complete 15-minute setup above
2. ✅ Run all 4 verification tests
3. ✅ Try a small task with dev docs system

### This Week (2-3 hours):
1. 📝 Work through `customization-checklist.md` Priority 1
2. 🔧 Update `skill-rules.json` with YOUR keywords
3. 📖 Customize `backend-dev-guidelines/SKILL.md`
4. ✏️ Expand `CLAUDE.md` with YOUR commands

### Next Week (2-3 hours):
1. 🎨 Customize remaining skills (route-tester, error-tracking)
2. 🤖 Test and customize agents
3. 📚 Create project-specific documentation
4. 🏗️ Add domain-specific skills (if needed)

---

## 💡 Usage Tips

**Starting a Task:**
```bash
# 1. Plan first (ALWAYS)
# Enter planning mode and discuss approach

# 2. Create dev docs
/dev-docs [task description]

# 3. Let Claude implement
# Skills will auto-activate
# Hooks will check for errors
# Agents will review code
```

**During Implementation:**
```bash
# Update tasks immediately
"Mark task 1 as complete in tasks.md"

# Update context with decisions
"Add to context.md: We chose approach X because Y"

# Before context runs low (~10-15%)
/dev-docs-update
```

**Reviewing Code:**
```bash
# Launch reviewer agent
"Review the recent changes in [folder] for best practices"

# Or manual review
"Review this code: [paste code]"
```

**Testing:**
```bash
# Use route-tester skill
"Test the POST /api/users endpoint"

# Or launch agent
"Use auth-route-tester agent to test login flow"
```

---

## 🔗 Full Documentation

- **Integration Guide:** `integration-guide.md` - Complete setup guide (30+ pages)
- **Customization Checklist:** `customization-checklist.md` - Step-by-step customization
- **Reddit Post:** `../methodology/original-reddit-post.md` - Original methodology (diet103)

---

## ✅ Completion Checklist

**Minimal Setup (15 min):**
- [ ] Copy `.claude/` folder
- [ ] Install hook dependencies
- [ ] Make hooks executable
- [ ] Create basic `CLAUDE.md`
- [ ] Run 4 verification tests
- [ ] All tests pass ✅

**Ready to Use!** 🎉

**Recommended Next (2-3 hours):**
- [ ] Customize `skill-rules.json` keywords
- [ ] Update file path patterns
- [ ] Customize backend skill examples
- [ ] Expand `CLAUDE.md`

---

**Questions or issues?** See troubleshooting above or refer to full guides.

**Good luck!** 🚀
