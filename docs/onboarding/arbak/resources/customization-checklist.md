# Customization Checklist for Arbak's Project

> Use this checklist to adapt the Claude Code infrastructure to your specific project.

**Time Required:** 2-4 hours for Priority 1 items
**Recommended Order:** Follow priorities (1 → 2 → 3)

---

## ✅ Priority 1: MUST Customize (2-3 hours)

These are **critical** for the system to work properly with your project.

### [ ] 1. Update `skill-rules.json` Keywords (30 min)

**File:** `.claude/skills/skill-rules.json`

**Tasks:**
- [ ] Remove AI Admin v2 specific keywords:
  - [ ] "WhatsApp", "ватсап", "вацап"
  - [ ] "YClients"
  - [ ] "booking", "бронирование", "запись"
  - [ ] "BullMQ", "очередь", "воркер"
  - [ ] "context service"

- [ ] Add YOUR project keywords:
  ```json
  "keywords": [
    "your-service-name",
    "your-api-name",
    "your-queue-system",
    "your-domain-term-1",
    "your-domain-term-2"
  ]
  ```

- [ ] Add Russian translations if needed:
  ```json
  "keywords": [
    "service", "сервис",
    "API", "апи",
    "queue", "очередь"
  ]
  ```

**Test:**
```bash
# Try a prompt with your keywords
"How do I create a new [your-service-name] endpoint?"

# Should see skill activation
```

---

### [ ] 2. Update File Path Patterns (15 min)

**File:** `.claude/skills/skill-rules.json`

**Tasks:**
- [ ] Review your project structure:
  ```bash
  tree -L 2 -d src/  # or backend/, server/, etc.
  ```

- [ ] Update `pathPatterns` to match:
  ```json
  "pathPatterns": [
    "src/**/*.ts",        // Change if you use different folder
    "backend/**/*.ts",    // Add your paths
    "api/**/*.ts"         // Add your paths
  ]
  ```

- [ ] Update `contentPatterns` for your stack:
  ```json
  "contentPatterns": [
    "router\\.",          // If you use Express
    "app\\.(get|post)",   // If you use Express
    "fastify\\.",         // If you use Fastify
    "// Add YOUR patterns here"
  ]
  ```

**Test:**
```bash
# Edit a file in your backend
# Should trigger backend-dev-guidelines skill
```

---

### [ ] 3. Customize Backend Skill (45 min)

**File:** `.claude/skills/backend-dev-guidelines/SKILL.md`

**Tasks:**
- [ ] Update project name in YAML frontmatter:
  ```yaml
  ---
  title: Backend Development Guidelines
  project: YOUR_PROJECT_NAME  # Change this
  ---
  ```

- [ ] Replace folder paths in "Project Structure" section:
  ```markdown
  ## Project Structure

  - Routes: YOUR_PATH/routes/
  - Controllers: YOUR_PATH/controllers/
  - Services: YOUR_PATH/services/
  ```

- [ ] Update tech stack references:
  - [ ] Replace "Express" if you use different framework
  - [ ] Replace "Prisma" if you use different ORM
  - [ ] Replace "BullMQ" if you use different queue

- [ ] Update code examples with YOUR patterns:
  - [ ] Controller example (lines ~100-150)
  - [ ] Service example (lines ~200-250)
  - [ ] Route example (lines ~50-100)

**Keep:**
- [ ] Overall structure (<500 lines)
- [ ] Resource file references
- [ ] Progressive disclosure pattern

**Test:**
```bash
# Invoke skill manually
/skill backend-dev-guidelines

# Check examples match your project
```

---

### [ ] 4. Create `CLAUDE.md` (60 min)

**File:** `CLAUDE.md` (root of your project)

**Required sections:**

- [ ] **Quick Start** - Commands to check project status
  ```markdown
  ## 🚀 Quick Start

  **Before starting work:**
  - Run `npm test` to ensure tests pass
  - Check `docs/TODO.md` for current tasks
  ```

- [ ] **Essential Commands** - Table with common commands
  ```markdown
  | Command | Purpose |
  |---------|---------|
  | `npm run dev` | YOUR_COMMAND_DESCRIPTION |
  ```

- [ ] **Environment** - Local paths, server access
  ```markdown
  ## 📍 Environment

  - **Local:** /path/to/your/project
  - **Server:** ssh user@server (if applicable)
  ```

- [ ] **Architecture** - 5-10 line overview
  ```markdown
  ## 🏗️ Architecture

  Brief description of your system architecture
  ```

- [ ] **Documentation** - Links to detailed docs
  ```markdown
  ## 📚 Documentation

  - `docs/ARCHITECTURE.md` - System architecture
  - `docs/API.md` - API reference
  ```

**Keep it SHORT:** 100-200 lines max

**Test:**
```bash
# Claude should reference CLAUDE.md automatically
# Ask: "What commands are available?"
```

---

### [ ] 5. Review Permissions (10 min)

**File:** `.claude/settings.json`

**Tasks:**
- [ ] Review bash permissions:
  ```json
  "allow": [
    "Bash:*"  // Allows ALL bash commands - is this OK?
  ]
  ```

- [ ] Consider restricting if needed:
  ```json
  "allow": [
    "Bash(npm:*)",      // Only npm commands
    "Bash(git:*)",      // Only git commands
    "Edit:*",           // Keep this
    "Write:*"           // Keep this
  ]
  ```

- [ ] Verify defaultMode:
  ```json
  "defaultMode": "acceptEdits"  // Auto-accept edits
  ```

**Test:**
```bash
# Try a bash command
# Should work based on your permissions
```

---

## ✅ Priority 2: SHOULD Customize (2-3 hours)

These improve the system but aren't critical for basic functionality.

### [ ] 6. Customize Route Tester Skill (30 min)

**File:** `.claude/skills/route-tester/SKILL.md`

**Tasks:**
- [ ] Update authentication method (if different from cookies)
- [ ] Add YOUR testing patterns
- [ ] Update example API endpoints
- [ ] Add project-specific test setup

---

### [ ] 7. Customize Error Tracking Skill (30 min)

**File:** `.claude/skills/error-tracking/SKILL.md`

**Tasks:**
- [ ] Update error tracking service (Sentry → YOUR_SERVICE)
- [ ] Add YOUR error patterns
- [ ] Update logging examples
- [ ] Add project-specific error categories

---

### [ ] 8. Customize Agent Prompts (2 hours)

**Files:** `.claude/agents/*.md`

**For each agent you plan to use:**
- [ ] `code-architecture-reviewer.md` - Update review criteria
- [ ] `auto-error-resolver.md` - Add YOUR error patterns
- [ ] `auth-route-tester.md` - Update auth method
- [ ] Others as needed

**Tip:** Start with defaults, customize when you see how they work

---

### [ ] 9. Update Slash Commands (30 min)

**Files:** `.claude/commands/*.md`

**Tasks:**
- [ ] Review `/dev-docs` command prompt
- [ ] Update `/dev-docs-update` command
- [ ] Add project-specific commands (optional)

---

## ✅ Priority 3: NICE TO HAVE (4-8 hours)

These are advanced customizations for specialized needs.

### [ ] 10. Create Frontend Skill (2-3 hours)

**Only if you have a frontend**

**Tasks:**
- [ ] Create `.claude/skills/frontend-dev-guidelines/`
- [ ] Write SKILL.md (<500 lines)
- [ ] Create resource files:
  - [ ] `react-patterns.md` (if React)
  - [ ] `styling-guide.md`
  - [ ] `component-structure.md`
  - [ ] `state-management.md`
- [ ] Add to `skill-rules.json`
- [ ] Test auto-activation

---

### [ ] 11. Create Domain-Specific Skills (2-3 hours each)

**For complex domain logic**

**Example:** If you have a payment system, workflow engine, etc.

**Tasks:**
- [ ] Create `.claude/skills/your-domain-skill/`
- [ ] Document domain patterns
- [ ] Add triggers to `skill-rules.json`
- [ ] Create resource files as needed

---

### [ ] 12. Add PM2 Integration (1-2 hours)

**Only if you use PM2 for process management**

**Tasks:**
- [ ] Add PM2 commands to `CLAUDE.md`
- [ ] Create utility scripts for log reading
- [ ] Update hooks to work with PM2 logs
- [ ] Document debugging workflow

---

### [ ] 13. Create Build Checker Hook (2 hours)

**For TypeScript/build error detection**

**Tasks:**
- [ ] Create `.claude/hooks/build-checker.sh`
- [ ] Configure to run on Stop hook
- [ ] Add build commands for YOUR project
- [ ] Test error detection

**Note:** This can consume tokens - use carefully

---

### [ ] 14. Create Project-Specific Agents (2-3 hours each)

**For specialized workflows**

**Examples:**
- Database migration agent
- API documentation generator
- Test data generator
- Deployment checker

**Tasks:**
- [ ] Identify recurring complex tasks
- [ ] Create agent prompts
- [ ] Test agent behavior
- [ ] Document usage in `CLAUDE.md`

---

## 🧪 Verification Tests

After completing Priority 1:

### [ ] Test 1: Skills Auto-Activate
```bash
Prompt: "How do I create a new API endpoint?"
Expected: See skill activation notification
```

### [ ] Test 2: Error Reminder Shows
```bash
Prompt: "Add error handling to src/service.ts"
Expected: See error handling reminder after response
```

### [ ] Test 3: Dev Docs Work
```bash
Command: /dev-docs implement user feature
Expected: Creates 3 files in dev/active/
```

### [ ] Test 4: Agent Launches
```bash
Prompt: "Review recent backend changes"
Expected: Launches code-architecture-reviewer agent
```

---

## 📊 Completion Checklist

**Minimum Viable Setup (2-3 hours):**
- [x] Install .claude folder
- [x] Update skill-rules.json keywords
- [x] Update file path patterns
- [x] Create CLAUDE.md
- [x] Run verification tests

**Recommended Setup (4-6 hours):**
- [x] Everything above +
- [x] Customize backend skill
- [x] Customize route-tester skill
- [x] Customize error-tracking skill
- [x] Review permissions

**Advanced Setup (8-12 hours):**
- [x] Everything above +
- [x] Create frontend skill (if applicable)
- [x] Customize all agents
- [x] Create domain-specific skills
- [x] Add custom hooks

---

## 💡 Tips

1. **Don't customize everything at once** - Start with Priority 1
2. **Test after each change** - Verify skills still activate
3. **Keep examples relevant** - Use code from YOUR project
4. **Document as you go** - Update CLAUDE.md with learnings
5. **Iterate gradually** - Refine over weeks, not hours

---

**Next:** See `integration-guide.md` for detailed instructions on each item.
