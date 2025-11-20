# Claude Code Infrastructure - Integration Guide for Arbak

> **Source:** Based on [reddit post by diet103](https://github.com/diet103/claude-code-infrastructure-showcase) and AI Admin v2 implementation

**Version:** 1.0
**Date:** November 20, 2025
**For:** Arbak's project setup

---

## 🎯 What You're Getting

A **production-ready Claude Code infrastructure** that includes:

1. **✅ Skills System** - Auto-activating guidelines (4 skills + skill-rules.json)
2. **✅ Hooks System** - 3 hooks for auto-activation and error checking
3. **✅ Dev Docs Workflow** - Task management system with 3 slash commands
4. **✅ 10 Specialized Agents** - Code review, testing, planning, debugging
5. **✅ Dual Language Support** - English + Russian prompts/triggers

**What This System Does:**
- Skills **automatically activate** based on your prompts and files
- Hooks **prevent errors** from being left behind
- Dev docs **prevent Claude from losing the plot** on large tasks
- Agents **handle specialized tasks** autonomously

---

## 📦 Package Contents

You'll receive a **`.claude/` folder** with this structure:

```
.claude/
├── settings.json              # Main configuration
├── skills/
│   ├── skill-rules.json       # Auto-activation triggers
│   ├── backend-dev-guidelines/
│   │   ├── SKILL.md           # Main skill file (<500 lines)
│   │   └── resources/         # 11 resource files
│   ├── skill-developer/       # Meta-skill for managing skills
│   ├── route-tester/          # API testing patterns
│   └── error-tracking/        # Error handling best practices
├── hooks/
│   ├── skill-activation-prompt.sh      # UserPromptSubmit hook
│   ├── post-tool-use-tracker.sh        # PostToolUse hook
│   ├── error-handling-reminder.sh      # Stop hook
│   ├── package.json                    # Hook dependencies
│   └── tsconfig.json                   # TypeScript config
├── agents/
│   ├── code-architecture-reviewer.md
│   ├── auto-error-resolver.md
│   ├── refactor-planner.md
│   ├── plan-reviewer.md
│   ├── auth-route-tester.md
│   ├── auth-route-debugger.md
│   ├── frontend-error-fixer.md
│   ├── code-refactor-master.md
│   ├── documentation-architect.md
│   └── web-research-specialist.md
└── commands/
    ├── dev-docs.md             # Create strategic plan
    ├── dev-docs-update.md      # Update before compaction
    └── route-research-for-testing.md
```

---

## 🚀 Quick Start (15 minutes)

### Step 1: Copy Infrastructure (2 min)

```bash
# 1. Get the .claude folder from this project
cp -r /path/to/ai_admin_v2/.claude /path/to/arbak/project/

# 2. Verify it copied
ls -la /path/to/arbak/project/.claude
```

### Step 2: Install Hook Dependencies (3 min)

```bash
cd /path/to/arbak/project/.claude/hooks
npm install
```

### Step 3: Customize for Your Project (10 min)

See **Customization Checklist** below - you MUST customize these files:

1. `skill-rules.json` - Update keywords/paths for your project
2. `backend-dev-guidelines/SKILL.md` - Replace AI Admin examples with yours
3. `settings.json` - Review permissions
4. `CLAUDE.md` - Create project-specific quick reference

---

## 🔧 Customization Checklist

### Priority 1: MUST Customize

#### 1. Update `skill-rules.json` (30 min)

**File:** `.claude/skills/skill-rules.json`

**What to change:**
- `keywords` - Add your project-specific terms
- `pathPatterns` - Update to match your folder structure
- `contentPatterns` - Add patterns from your codebase

**Example changes:**

```json
{
  "backend-dev-guidelines": {
    "promptTriggers": {
      "keywords": [
        // REMOVE AI Admin specific:
        "WhatsApp", "YClients", "booking", "BullMQ",

        // ADD YOUR PROJECT terms:
        "your-service", "your-api", "your-queue-system"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        // REMOVE:
        "src/services/**/*",
        "src/queue/**/*",

        // ADD YOUR paths:
        "backend/controllers/**/*",
        "api/routes/**/*"
      ]
    }
  }
}
```

**Tips:**
- Keep Russian translations if you work in Russian
- Test triggers with: `/skill skill-developer` then ask about skill activation

#### 2. Customize Backend Skill (45 min)

**File:** `.claude/skills/backend-dev-guidelines/SKILL.md`

**What to change:**
- Replace AI Admin v2 examples with your project examples
- Update folder paths (src/ vs backend/ vs server/)
- Modify architecture patterns to match yours
- Update technology stack references

**Example sections to customize:**

```markdown
## Project Structure (CUSTOMIZE THIS)

- Routes: src/api/routes/**/*.ts       # Change to YOUR path
- Controllers: src/api/controllers/    # Change to YOUR path
- Services: src/services/              # Change to YOUR path
```

**Don't change:**
- Overall structure (keep under 500 lines)
- Resource file references
- YAML frontmatter format

#### 3. Create `CLAUDE.md` (60 min)

**File:** `CLAUDE.md` (root of your project)

**What to include:**

```markdown
# CLAUDE.md - Quick Reference for Your Project

## 🚀 Quick Start

**Before starting work:**
- Check `docs/current-tasks.md` for active tasks
- Run `npm test` to ensure everything works

## 🔧 Essential Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm test` | Run test suite |
| `npm run build` | Build for production |

## 🎯 Claude Code Skills System

**Available Skills:**
- `backend-dev-guidelines` - Backend patterns
- `route-tester` - API testing
- `error-tracking` - Error handling
- `skill-developer` - Skill management

## 📍 Environment

- **Local:** /path/to/your/project
- **Server:** ssh user@server (if applicable)

## 🏗️ Architecture

[Brief 5-10 line overview of your architecture]

## 📚 Documentation

- `docs/ARCHITECTURE.md` - System architecture
- `docs/API.md` - API reference
```

**Tips:**
- Keep it SHORT (100-200 lines max)
- Link to detailed docs, don't duplicate them
- Update as your project evolves

### Priority 2: SHOULD Customize

#### 4. Review `settings.json` (10 min)

**File:** `.claude/settings.json`

**Check these settings:**

```json
{
  "permissions": {
    "allow": [
      "Edit:*",      // Allow all edits without asking
      "Write:*",     // Allow file creation
      "Bash:*"       // Allow all bash commands
    ]
  }
}
```

**Consider changing:**
- Remove `"Bash:*"` if you want more control
- Add specific bash commands you want to allow
- Review hook configuration

#### 5. Customize Agent Prompts (Optional, 2-3 hours)

**Files:** `.claude/agents/*.md`

**What agents do:**
- `code-architecture-reviewer` - Reviews code for best practices
- `auto-error-resolver` - Fixes TypeScript/build errors
- `auth-route-tester` - Tests backend routes
- etc.

**Customization:**
- Update examples to match your project
- Modify review criteria
- Add project-specific checks

**Tip:** Start with default agents, customize later when you see how they work

### Priority 3: NICE TO HAVE

#### 6. Add Frontend Skill (Optional, 2-3 hours)

The Reddit post includes a `frontend-dev-guidelines` skill. If your project has a frontend:

1. Create `.claude/skills/frontend-dev-guidelines/`
2. Follow same structure as backend skill
3. Add to `skill-rules.json`

**Example structure:**

```
frontend-dev-guidelines/
├── SKILL.md (main file, <500 lines)
└── resources/
    ├── react-patterns.md
    ├── styling-guide.md
    ├── component-structure.md
    └── state-management.md
```

#### 7. Create Project-Specific Skills (Optional)

If you have complex domain logic (like our WhatsApp booking system), create specialized skills:

```
.claude/skills/your-domain-skill/
├── SKILL.md
└── resources/
    └── domain-specific-patterns.md
```

---

## 🧪 Testing Your Setup

### Test 1: Skills Auto-Activation (5 min)

```bash
# 1. Start Claude Code in your project
cd /path/to/your/project

# 2. Type a prompt that should trigger backend-dev-guidelines:
"How do I create a new API endpoint?"

# 3. Look for this in Claude's response:
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If you DON'T see this:**
- Check `.claude/hooks/skill-activation-prompt.sh` is executable
- Verify `settings.json` has UserPromptSubmit hook configured
- Check `skill-rules.json` keywords match your prompt

### Test 2: Error Handling Reminder (5 min)

```bash
# 1. Ask Claude to edit a backend file:
"Add error handling to src/services/user-service.ts"

# 2. After Claude responds, look for:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ERROR HANDLING SELF-CHECK
⚠️  Backend Changes Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If you DON'T see this:**
- Check `.claude/hooks/error-handling-reminder.sh` is executable
- Verify Stop hook is configured in `settings.json`

### Test 3: Dev Docs Workflow (10 min)

```bash
# 1. Start a new feature:
/dev-docs implement user authentication

# 2. Claude should create:
dev/active/user-authentication/
├── user-authentication-plan.md
├── user-authentication-context.md
└── user-authentication-tasks.md

# 3. Verify files were created:
ls dev/active/user-authentication/
```

**If it doesn't work:**
- Check `.claude/commands/dev-docs.md` exists
- Verify slash command syntax
- Create `dev/active/` folder if missing

### Test 4: Agent Usage (10 min)

```bash
# 1. Launch an agent to review code:
"Review the recent changes in src/services/ for best practices"

# 2. Claude should use the Task tool:
Task(subagent_type='code-architecture-reviewer', ...)

# 3. Wait for agent report
```

**If agent doesn't launch:**
- Check `.claude/agents/code-architecture-reviewer.md` exists
- Verify agent prompt is clear
- Try explicitly: "Use the code-architecture-reviewer agent"

---

## 🎓 Learning the System

### Week 1: Get Comfortable

**Days 1-2: Skills**
- Read `skill-developer/SKILL.md`
- Manually invoke skills: `/skill backend-dev-guidelines`
- Watch auto-activation in action

**Days 3-4: Dev Docs**
- Use `/dev-docs` for small tasks (1-2 hours)
- Practice updating context during implementation
- Use `/dev-docs-update` before context limits

**Days 5-7: Agents**
- Try each agent manually
- Learn when to use which agent
- Customize agent prompts for your needs

### Week 2: Customize

- Update `skill-rules.json` with YOUR keywords
- Customize backend skill with YOUR examples
- Create project-specific skills (optional)

### Week 3: Master

- Build custom agents for your workflow
- Create domain-specific skills
- Fine-tune hook behavior

---

## 📊 Expected Results

**After setup (30-60 min work):**
- ✅ Skills suggest automatically
- ✅ Hooks remind about errors
- ✅ Dev docs prevent context loss

**After customization (3-5 hours work):**
- ✅ Skills match YOUR project patterns
- ✅ Auto-activation works reliably
- ✅ Agents understand YOUR codebase

**After mastery (2-3 weeks):**
- ✅ 40-60% faster development
- ✅ Consistent code quality
- ✅ No errors left behind
- ✅ Complex tasks stay on track

---

## 🆘 Troubleshooting

### Skills Not Activating

**Problem:** Skills don't auto-activate when expected

**Solutions:**
1. Check hook is executable:
   ```bash
   chmod +x .claude/hooks/skill-activation-prompt.sh
   ```

2. Verify `settings.json`:
   ```json
   "hooks": {
     "UserPromptSubmit": [{ ... }]
   }
   ```

3. Check `skill-rules.json` keywords match your prompt

4. Test manually: `/skill backend-dev-guidelines`

### Hooks Not Running

**Problem:** Error reminder doesn't show after edits

**Solutions:**
1. Make hooks executable:
   ```bash
   chmod +x .claude/hooks/*.sh
   ```

2. Install hook dependencies:
   ```bash
   cd .claude/hooks && npm install
   ```

3. Check logs (if Claude Code provides them)

### Dev Docs Not Creating Files

**Problem:** `/dev-docs` doesn't create files

**Solutions:**
1. Create target directory:
   ```bash
   mkdir -p dev/active
   ```

2. Check slash command exists:
   ```bash
   ls .claude/commands/dev-docs.md
   ```

3. Verify command syntax (no typos)

### Agents Not Launching

**Problem:** Claude doesn't use agents when expected

**Solutions:**
1. Be explicit: "Use the code-architecture-reviewer agent"
2. Check agent file exists: `ls .claude/agents/`
3. Review agent prompt for clarity
4. Try different phrasing

---

## 🔗 Resources

**Original Sources:**
- Reddit Post: `../methodology/original-reddit-post.md`
- GitHub Repo: https://github.com/diet103/claude-code-infrastructure-showcase

**Your Project Docs:**
- This guide: `integration-guide.md` (this file)
- Customization checklist: `customization-checklist.md`
- Quick start: `quick-start-guide.md`

**AI Admin v2 Reference:**
- CLAUDE.md: Complete setup for reference
- Skills: `.claude/skills/` - see how we customized for our project

---

## 💡 Tips from 6 Months of Use

1. **Planning is King** - ALWAYS use planning mode first
2. **Review Code** - Have agents review Claude's work
3. **Update Dev Docs Immediately** - Mark tasks complete right away
4. **Customize Gradually** - Start with defaults, customize as you learn
5. **Re-prompt Often** - Double-ESC to branch and try again
6. **Trust the System** - Let hooks and skills do their job
7. **Document Success** - Add patterns that work to your skills

---

## 📝 Next Steps

1. **Copy `.claude/` folder** to your project
2. **Install hook dependencies**
3. **Work through Customization Checklist** (Priority 1 items)
4. **Run tests** to verify setup
5. **Start with small tasks** to learn the system
6. **Gradually customize** based on your needs

---

**Questions?** Ask in our chat or refer to the detailed guides.

**Good luck!** 🚀
