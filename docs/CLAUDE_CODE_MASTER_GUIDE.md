# 🚀 Claude Code Master Guide - Работа на 100%

**Полное руководство по эффективному использованию Claude Code в AI Admin v2**

> "After 6 months of hardcore use, here's the system I built" - diet103

---

## 📋 Содержание

1. [Философия Работы](#философия-работы)
2. [Система Skills (Auto-Activation)](#система-skills)
3. [Dev Docs System (Task Management)](#dev-docs-system)
4. [Specialized Agents](#specialized-agents)
5. [Hook Pipeline](#hook-pipeline)
6. [Промптинг на 100%](#промптинг-на-100)
7. [Workflow Examples](#workflow-examples)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Философия Работы

### Ключевой Принцип

> "Claude - это как extremely confident junior dev с extreme amnesia"

**Что это значит:**
- ✅ **Confident** - пишет код быстро и уверенно
- ⚠️ **Junior** - нужен контроль и review
- 🧠 **Amnesia** - легко теряет контекст и забывает что делал

### Ваша Роль

**Вы НЕ пассивный наблюдатель, вы - Senior Developer + PM:**

```
Вы → Planning (что делать)
   ↓
Claude → Implementation (как делать)
   ↓
Вы → Review & Guidance (правильно ли)
   ↓
Claude → Fixes & Improvements
   ↓
Вы → Final Approval & Deploy
```

### Golden Rules

1. **Planning is King** 👑
   - ВСЕГДА планируй перед имплементацией
   - Используй planning mode или `/dev-docs`
   - Review план ПЕРЕД началом работы

2. **Review is Queen** 👸
   - Проверяй код между task sections
   - Используй `code-architecture-reviewer` agent
   - Catch mistakes early, не в конце

3. **Context is Everything** 🎯
   - Update dev docs BEFORE context limits
   - Не надейся на память Claude
   - Документируй решения immediately

4. **No Mess Left Behind** 🧹
   - Hooks автоматически ловят errors
   - Но всё равно проверяй build output
   - Zero tolerance для TypeScript errors

---

## 🎯 Система Skills

### Как Это Работает

**Автоматическая активация на основе:**

1. **Keywords в промпте**
   ```
   Вы: "создать новый сервис для booking"
   → Детектит: "сервис", "booking"
   → Активирует: backend-dev-guidelines
   ```

2. **Intent patterns (regex)**
   ```
   Вы: "исправить ошибку в API"
   → Детектит: "(исправить|fix).*?(ошибк|error)"
   → Активирует: error-tracking
   ```

3. **File context**
   ```
   Вы: Редактируете src/services/booking/BookingService.ts
   → Детектит: путь файла
   → Активирует: backend-dev-guidelines
   ```

### Что Вы Увидите

```
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
  → error-tracking

ACTION: Use Skill tool BEFORE responding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Available Skills

| Skill | Активируется При | Что Даёт |
|-------|------------------|----------|
| **backend-dev-guidelines** | Работа с API, services, routes, controllers | Layered architecture, BaseController, Sentry, Zod validation, DI patterns |
| **error-tracking** | Ошибки, исключения, monitoring, logging | Sentry integration, error capture patterns, Telegram alerts |
| **route-tester** | Тестирование API routes, endpoints | Testing patterns, MCP servers usage, authentication testing |
| **skill-developer** | Создание/модификация skills, hooks | Meta-skill для управления Claude Code инфраструктурой |

### Когда Использовать Вручную

**Auto-activation не сработала?** Активируй вручную:

```bash
/skill backend-dev-guidelines
/skill error-tracking
/skill route-tester
```

### Best Practices

**✅ Do:**
- Доверяй auto-activation - она точна
- Если skill предложен - используй его
- Проверяй что Claude действительно загрузил skill

**❌ Don't:**
- Игнорировать skill recommendations
- Надеяться что Claude "помнит" best practices
- Пропускать skill activation "для скорости"

---

## 📋 Dev Docs System

### Проблема

```
Hour 0: "Давай сделаем feature X"
Hour 2: Claude делает task A, B, C...
Hour 3: Context compaction
Hour 3.5: "Что мы делали? Где мы остановились?"
```

**Результат:** Rework, потерянное время, forgotten tasks

### Решение: Dev Docs

```
dev/active/feature-name/
├── feature-name-plan.md      # ЧТО мы строим
├── feature-name-context.md   # ГДЕ мы находимся
└── feature-name-tasks.md     # ЧТО сделано/осталось
```

**Эти файлы ПЕРЕЖИВАЮТ context compaction!**

---

### Полный Workflow

#### 1️⃣ **Начало Task (>30 минут)**

```bash
# Сначала - Planning Mode
[Включить planning mode в Claude Code]

You: "Нужно сделать систему уведомлений о предстоящих записях"

Claude: [Исследует codebase, анализирует, предлагает план]

You: [Читаешь план, корректируешь, утверждаешь]

# Затем - Create Dev Docs
/dev-docs система уведомлений о записях
```

**Что происходит:**
1. Claude создаёт `dev/active/notification-system/`
2. Генерирует 3 файла:
   - `notification-system-plan.md` - detailed implementation plan
   - `notification-system-context.md` - key files, architecture decisions
   - `notification-system-tasks.md` - checklist формат

**Пример tasks.md:**
```markdown
## Phase 1: Core Infrastructure
- [ ] Create BookingMonitorService
- [ ] Add cron job for checking upcoming bookings
- [ ] Implement notification templates

## Phase 2: Integration
- [ ] Connect to WhatsApp API
- [ ] Add Telegram notification fallback
- [ ] Setup Redis cache for sent notifications

## Phase 3: Testing & Polish
- [ ] Unit tests for BookingMonitorService
- [ ] Integration tests with real bookings
- [ ] Load testing for 1000+ bookings
```

#### 2️⃣ **Во Время Implementation**

**CRITICAL:** Не делай всё сразу!

```
You: "Claude, реализуй ТОЛЬКО Phase 1: Core Infrastructure из плана"

Claude: [Делает Phase 1]

You: [Review code, test, approve]

You: "Теперь Phase 2"
```

**Почему по частям?**
- ✅ Early feedback - ловишь ошибки сразу
- ✅ Context control - не уходишь далеко от плана
- ✅ Quality assurance - каждая фаза tested

**Update Progress:**

```
You: "Claude, отметь завершённые tasks в tasks.md"

Claude: [Обновляет tasks.md с ✅]

You: "Добавь в context.md что мы решили использовать BullMQ вместо cron"

Claude: [Обновляет context.md]
```

#### 3️⃣ **Before Context Limits (~10-15% left)**

```bash
You: "Context на исходе, давай сохраним прогресс"

/dev-docs-update
```

**Что происходит:**
- Claude читает текущее состояние
- Обновляет `context.md`:
  ```markdown
  ## 2025-11-03: Phase 2 Implementation

  **Modified Files:**
  - src/services/booking-monitor/BookingMonitorService.ts:45-120
  - src/queue/notification-queue.ts (created)

  **Key Decisions:**
  - Using BullMQ instead of cron for better reliability
  - Notifications sent 24h and 2h before booking
  - Redis TTL: 48h to prevent duplicates

  **Current Status:**
  - ✅ Phase 1 complete
  - 🔄 Phase 2: 70% done (WhatsApp OK, Telegram pending)

  **Next Steps:**
  - Finish Telegram integration
  - Add error handling for failed sends
  - Write integration tests
  ```

- Обновляет `tasks.md` с текущим прогрессом

#### 4️⃣ **After Context Reset**

```
[New conversation after compaction]

You: "Продолжаем работу над notification-system"

Claude: "Дай мне прочитать dev docs..."

[Claude читает все 3 файла]

Claude: "Понял! Мы на Phase 2, осталось сделать Telegram integration. Продолжаем?"

You: "Да, давай!"
```

**Zero context loss!** 🎉

---

### Dev Docs Best Practices

**✅ Do:**
- Create dev docs для ЛЮБОЙ task >30 min
- Update context IMMEDIATELY при важных решениях
- Mark tasks ✅ КАК ТОЛЬКО завершены
- Include file paths с line numbers
- Note "WHY", не только "WHAT"

**❌ Don't:**
- Think "это быстрая задача, не нужны docs" (spoiler: нужны)
- Batch-update tasks в конце (забудешь детали)
- Write vague notes: "fixed bug" ❌ → "fixed race condition in Redis cache by adding lock" ✅
- Forget timestamps

**Good Context Entry Example:**
```markdown
## 2025-11-03 15:30: Redis Cache Implementation

**Modified:**
- src/services/context/ContextService.ts:78-120 - Added distributed lock
- src/integrations/redis/RedisClient.ts:45 - Increased timeout to 5s

**Decision:** Using Redlock algorithm instead of simple SET NX because:
- Need atomic operations across multiple Redis nodes
- Handle network partitions gracefully
- TTL management more robust

**Issue Found:** Race condition when 2 workers process same message
**Solution:** Distributed lock with 5s timeout + retry logic

**Next:** Test with 10 concurrent workers, verify no duplicates
```

**Bad Context Entry Example:**
```markdown
## 2025-11-03
Fixed Redis. Works now.
```

---

## 🤖 Specialized Agents

### Когда Использовать Agents

**Agents vs Manual Work:**

| Scenario | Use Agent | Do Manually |
|----------|-----------|-------------|
| Review всех controllers | ✅ code-architecture-reviewer | ❌ |
| Fix 1 specific TypeScript error | ❌ | ✅ |
| Plan major refactoring | ✅ refactor-planner | ❌ |
| Test 1 API endpoint | ❌ | ✅ Use MCP directly |
| Fix 20+ TypeScript errors | ✅ auto-error-resolver | ❌ |
| Research "best queue library" | ✅ web-research-specialist | ❌ |

**Rule of Thumb:**
- Multi-step, autonomous work → **Agent**
- Quick, specific task → **Manual**

### Available Agents

#### 🔍 **Quality Control**

**code-architecture-reviewer**
```
When: После завершения feature или большой refactoring
What: Reviews code for best practices, patterns, security

Example:
You: "Use code-architecture-reviewer agent to review booking service"
Agent: [Анализирует, находит issues, предлагает improvements]
```

**auto-error-resolver**
```
When: Build выдал 5+ TypeScript errors
What: Systematically fixes errors один за другим

Example:
You: "We have 15 TypeScript errors after refactoring. Use auto-error-resolver"
Agent: [Fixes errors, runs build, verifies]
```

**refactor-planner**
```
When: BEFORE начала сложного refactoring
What: Creates comprehensive plan with risks, steps

Example:
You: "Plan refactoring of message queue system to BullMQ"
Agent: [Analyzes current, plans migration, identifies risks]
```

**code-refactor-master**
```
When: Execute complex refactoring
What: Breaks down files, updates imports, maintains consistency

Example:
You: "Execute refactoring plan from refactor-planner"
Agent: [Does refactoring step-by-step]
```

#### 🧪 **Testing & Debugging**

**auth-route-tester**
```
When: Testing API routes with authentication
What: Uses JWT cookies, validates responses

Example:
You: "Test POST /api/booking/create route"
Agent: [Gets auth token, makes request, validates]
```

**auth-route-debugger**
```
When: 401/403 errors, auth не работает
What: Debugs JWT, cookies, permissions

Example:
You: "Getting 401 on /api/booking route, help debug"
Agent: [Checks auth flow, finds issue]
```

**frontend-error-fixer**
```
When: React errors, browser console errors, build failures
What: Diagnoses and fixes frontend issues

Example:
You: "React app crashing with 'cannot read property of undefined'"
Agent: [Finds issue, proposes fix, tests]
```

#### 📋 **Planning & Strategy**

**plan-reviewer**
```
When: BEFORE implementation, want second opinion
What: Reviews plan for issues, missing pieces

Example:
You: "Review this plan before I start: [plan details]"
Agent: [Analyzes, questions decisions, suggests improvements]
```

**documentation-architect**
```
When: Need comprehensive documentation
What: Creates/updates docs with full context

Example:
You: "Document the new notification system"
Agent: [Gathers context, writes comprehensive docs]
```

**web-research-specialist**
```
When: Need to research solutions, best practices
What: Searches web, GitHub, Stack Overflow, forums

Example:
You: "Research best practices for handling WhatsApp rate limits"
Agent: [Researches, compiles findings, recommends approach]
```

---

### Agent Usage Patterns

#### Pattern 1: Quality Gate

```
You: "Implement booking notification system"
Claude: [Implements]

You: "Use code-architecture-reviewer to review implementation"
Agent: [Reviews]

Agent Report:
"Found 3 issues:
1. Controllers don't extend BaseController
2. Missing Sentry error tracking
3. No input validation with Zod"

You: "Claude, fix issues from review"
Claude: [Fixes]

You: "Run code-architecture-reviewer again"
Agent: [Reviews again] "All issues resolved ✅"
```

#### Pattern 2: Research → Plan → Implement

```
You: "Use web-research-specialist to research queue libraries"
Agent: [Researches] "BullMQ recommended for Redis-based queuing"

You: "Use refactor-planner to plan migration to BullMQ"
Agent: [Creates plan]

You: "Review plan, looks good"

You: "Use code-refactor-master to execute migration"
Agent: [Executes]

You: "Use code-architecture-reviewer to verify"
Agent: [Reviews] "Migration successful ✅"
```

#### Pattern 3: Error Blitz

```
[After major refactoring]

You: "Run build"
Build: "47 TypeScript errors"

You: "Use auto-error-resolver to fix all errors"
Agent: [Fixes 47 errors systematically]

Agent: "All errors resolved, build successful ✅"
```

---

## ⚙️ Hook Pipeline

### The Complete Flow

```
You: "создать новый контроллер для booking"
    ↓
┌─────────────────────────────────────┐
│ 1. UserPromptSubmit Hook            │
│ Analyzes prompt                     │
│ → Detected: "контроллер", "booking" │
│ → Suggests: backend-dev-guidelines  │
└─────────────────────────────────────┘
    ↓
🎯 SKILL ACTIVATION CHECK
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
    ↓
Claude: [Uses skill, implements controller]
    ↓
┌─────────────────────────────────────┐
│ 2. PostToolUse Hook                 │
│ Tracks edited files                 │
│ → src/api/booking/BookingController.ts │
│ → Logs to edited-files.log         │
└─────────────────────────────────────┘
    ↓
Claude: "Implementation complete"
    ↓
┌─────────────────────────────────────┐
│ 3. Stop Hook                        │
│ Analyzes edited files               │
│ → Detected: Controller, async code  │
│ → Shows error handling reminder     │
└─────────────────────────────────────┘
    ↓
📋 ERROR HANDLING SELF-CHECK
⚠️ Backend Changes Detected
❓ Did you add Sentry.captureException()?
❓ Does controller extend BaseController?
    ↓
Claude: "Let me review... yes, added error handling ✅"
```

### Hook Details

#### Hook 1: skill-activation-prompt (UserPromptSubmit)

**Purpose:** Suggest skills BEFORE Claude responds

**Triggers:**
- Keywords: backend, сервис, ошибка, тест, API, route, etc.
- Intent patterns: "(create|создать).*?(route|маршрут)"
- Bilingual: English + Russian

**Output:**
```
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL SKILLS (REQUIRED):
  → database-verification

📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
  → error-tracking

💡 SUGGESTED SKILLS:
  → route-tester
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Disable:** Can't disable (critical for workflow)

#### Hook 2: post-tool-use-tracker (PostToolUse)

**Purpose:** Track which files were edited

**Triggers:** After Edit, MultiEdit, Write tools

**What it does:**
- Logs edited files to `.claude/tsc-cache/[session]/edited-files.log`
- Detects repo (backend, frontend, database)
- Stores build commands
- Used by Stop hook for error checking

**Disable:** Not recommended (needed for Hook 3)

#### Hook 3: error-handling-reminder (Stop)

**Purpose:** Gentle reminder to check error handling

**Triggers:** After Claude finishes responding

**Analyzes:**
- Files with try-catch blocks
- Async functions
- Prisma database calls
- Controllers
- API calls

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ERROR HANDLING SELF-CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Backend Changes Detected
   2 file(s) edited

   ❓ Did you add Sentry.captureException() in catch blocks?
   ❓ Are Prisma operations wrapped in error handling?
   ❓ Do controllers use BaseController.handleError()?

   💡 Backend Best Practice:
      - All errors should be captured to Sentry
      - Use appropriate error helpers for context
      - Controllers should extend BaseController

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 TIP: Disable with SKIP_ERROR_REMINDER=1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Disable:**
```bash
export SKIP_ERROR_REMINDER=1
```

---

### Hook Best Practices

**✅ Trust the Hooks:**
- Skills suggestions are accurate - use them
- Error reminders catch real issues
- File tracking helps maintain context

**⚠️ Hook Limitations:**
- Hooks don't ENFORCE, they SUGGEST
- You still need to verify
- Claude might ignore reminders (check manually)

**🔧 When Hooks Fail:**
```bash
# Check hook logs
ls -la .claude/tsc-cache/[session]/

# Test hook manually
echo '{"prompt":"create backend route"}' | \
  CLAUDE_PROJECT_DIR=. npx tsx .claude/hooks/skill-activation-prompt.ts
```

---

## 💬 Промптинг на 100%

### The Golden Rules

> "Ask not what Claude can do for you, ask what context you can give to Claude"

#### Rule 1: Be Specific

**❌ Bad:**
```
"Fix the booking system"
```

**✅ Good:**
```
"The booking system has a race condition when two users book the same time slot.
It's in src/services/booking/BookingService.ts:156-180.
Need to add distributed lock using Redis to prevent double-booking.
Lock should timeout after 5 seconds."
```

**Why:** Claude needs to know WHAT, WHERE, WHY, HOW MUCH

#### Rule 2: Provide Context

**❌ Bad:**
```
"Why is this error happening?"
[Error message only]
```

**✅ Good:**
```
"Getting this error when testing booking creation:

Error: "Client phone not found in Redis cache"

Context:
- Happens on POST /api/booking/create
- Only for new clients (no previous bookings)
- Redis is running (checked with @redis)
- Client data exists in Supabase
- Might be timing issue with context service

Relevant files:
- src/services/context/ContextService.ts
- src/api/booking/BookingController.ts:45-67
```

**Why:** Context = faster diagnosis = better solution

#### Rule 3: Break Down Complex Tasks

**❌ Bad:**
```
"Build a complete notification system with WhatsApp, Telegram,
email, SMS, scheduled sending, retry logic, templates, admin panel"
```

**✅ Good:**
```
"Let's plan a notification system. First use planning mode to:
1. Analyze current architecture
2. Propose modular design
3. Break into phases

Then we'll implement Phase 1: WhatsApp notifications only"
```

**Why:** Prevents Claude from getting lost, ensures quality

#### Rule 4: Ask for Research When Unsure

**❌ Bad:**
```
[Assuming solution]
"Use library X for feature Y"
```

**✅ Good:**
```
"Use web-research-specialist to research best queue libraries for:
- Redis-based
- Node.js
- TypeScript support
- Active maintenance
- Good documentation

Compare BullMQ vs Bee-Queue vs Kue and recommend best option"
```

**Why:** Better decisions, learn best practices

#### Rule 5: Don't Lead the Witness

**❌ Bad:**
```
"This code is good, right?"
"Should we use approach X? I think it's best"
```

**✅ Good:**
```
"Review this implementation and suggest improvements"
"What are the pros and cons of approach X vs Y?"
```

**Why:** Get honest feedback, avoid confirmation bias

---

### Prompting Patterns

#### Pattern 1: Discovery

```
You: "Explain how the booking flow works in this codebase"

Claude: [Uses Explore agent, reads files]

Claude: "The booking flow:
1. Client sends message via WhatsApp
2. AI Admin parses intent and extracts data
3. ContextService stores conversation state in Redis
4. BookingService validates availability via YClients API
5. If available, creates booking and confirms to client"

You: "What happens if YClients API is down?"

Claude: "Looking at error handling... Currently throws error.
Should add retry logic and fallback notification."

You: "Good catch. Plan the retry implementation"
```

#### Pattern 2: Implementation

```
You: "Implement retry logic for YClients API calls. Plan first."

Claude: [Creates plan]

You: [Reviews plan] "Looks good, but add exponential backoff"

Claude: [Updates plan]

You: "Approve. Implement only the retry logic, not notification part yet"

Claude: [Implements]

You: [Tests] "Works! Now add the notification part"
```

#### Pattern 3: Debugging

```
You: "Getting 401 error on /api/booking/create. Here's the curl:
[paste curl command]

Auth cookies look correct. Check auth flow."

Claude: "Let me check authentication middleware..."

Claude: "Found issue: Cookie domain mismatch. Should be .domain.com not domain.com"

You: "Fix it"

Claude: [Fixes]

You: "Test with auth-route-tester agent"

Agent: "All tests pass ✅"
```

#### Pattern 4: Review & Improve

```
You: "Just implemented notification system. Use code-architecture-reviewer"

Agent: [Reviews] "Found issues: [list]"

You: "Claude, address these issues"

Claude: [Fixes]

You: "Review again"

Agent: "All issues resolved ✅"

You: "Great! Now use documentation-architect to document it"

Agent: [Creates comprehensive docs]
```

---

### Advanced Prompting

#### Technique 1: Constrained Creativity

```
You: "Design a caching strategy for booking data.

Constraints:
- Must use Redis (already in stack)
- TTL: 5 minutes for availability data
- TTL: 1 hour for client data
- Must handle cache invalidation on booking changes
- Memory limit: 100MB max

Propose 2-3 different approaches with pros/cons"
```

#### Technique 2: Incremental Refinement

```
You: "Draft an error handling strategy for the booking service"

Claude: [Draft 1]

You: "Good start. Add specific Sentry contexts for:
- User phone
- Booking ID
- YClients salon ID
- Timestamp"

Claude: [Draft 2]

You: "Better. Now add error recovery strategies for each error type"

Claude: [Draft 3]

You: "Perfect. Implement this"
```

#### Technique 3: Teach-Back Verification

```
You: "Explain back to me your understanding of the task:
We need to implement rate limiting for WhatsApp messages"

Claude: "I understand we need to:
1. Track message count per client per hour
2. Limit to 10 messages per hour
3. Use Redis for tracking with 1h TTL
4. Return friendly message if limit exceeded
5. Log rate limit events to Sentry"

You: "Correct, except limit is 20, not 10. Proceed with implementation"
```

---

### Common Prompting Mistakes

**❌ Mistake 1: Vague Requests**
```
"Make it better"
"Fix the code"
"Optimize this"
```
→ **Fix:** Be specific about WHAT and WHY

**❌ Mistake 2: Too Much at Once**
```
"Implement features A, B, C, D, E all at once"
```
→ **Fix:** One feature at a time, with review between

**❌ Mistake 3: No Context**
```
"Why doesn't this work?" [paste error only]
```
→ **Fix:** Include what you tried, relevant files, expected behavior

**❌ Mistake 4: Assuming Knowledge**
```
"Use that library we discussed" (when?)
"Fix it like before" (which before?)
```
→ **Fix:** Always be explicit, Claude has amnesia

**❌ Mistake 5: Not Using Tools**
```
"Just tell me what the error is" (instead of checking logs)
```
→ **Fix:** Use MCP servers:
```
@logs logs_tail service:ai-admin-worker-v2 lines:50
@redis get_context phone:79001234567
```

---

## 🎬 Workflow Examples

### Example 1: New Feature (Notification System)

```
═══════════════════════════════════════════════════════════
📝 STEP 1: PLANNING
═══════════════════════════════════════════════════════════

You: [Enable planning mode]

You: "Нужна система уведомлений за 24ч и 2ч до записи.
Отправка через WhatsApp, если не доставлено - Telegram.
Хранить историю отправок в БД."

Claude: [Researches codebase, analyzes integrations]

Claude: [Presents comprehensive plan with:
- Current state analysis
- Proposed architecture (BullMQ для scheduling)
- Phase breakdown
- Risk assessment
- Timeline estimate]

You: [Reviews plan carefully]

You: "План хороший, но:
1. Add Redis cache для предотвращения дублей
2. TTL для notifications: 48h
3. Use existing Telegram bot, не создавай новый"

Claude: [Updates plan]

You: "Approved! Exit planning mode"

═══════════════════════════════════════════════════════════
📝 STEP 2: CREATE DEV DOCS
═══════════════════════════════════════════════════════════

You: "/dev-docs booking notification system"

Claude: [Creates dev/active/booking-notifications/]
Claude: [Generates plan.md, context.md, tasks.md]

You: [Verifies files created]

═══════════════════════════════════════════════════════════
📝 STEP 3: PHASE 1 IMPLEMENTATION
═══════════════════════════════════════════════════════════

You: "Implement ONLY Phase 1: Core Infrastructure

Tasks:
- Create BookingMonitorService
- Add BullMQ job for checking bookings
- Add notification templates"

🎯 SKILL ACTIVATION CHECK
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
  → error-tracking

Claude: [Uses skills, implements Phase 1]

Claude: "Phase 1 complete. Files created:
- src/services/booking-monitor/BookingMonitorService.ts
- src/queue/notification-queue.ts
- src/templates/notification-templates.ts"

═══════════════════════════════════════════════════════════
📝 STEP 4: REVIEW PHASE 1
═══════════════════════════════════════════════════════════

📋 ERROR HANDLING SELF-CHECK
⚠️ Backend Changes Detected (3 files)
❓ Did you add Sentry error tracking?

Claude: "Yes, all errors are captured to Sentry ✅"

You: "Use code-architecture-reviewer to review Phase 1 implementation"

Agent: [Reviews]

Agent Report:
"✅ Code follows backend-dev-guidelines
✅ Error handling present
✅ Uses dependency injection
⚠️ Suggestion: Add integration tests"

You: "Add integration tests as suggested"

Claude: [Adds tests]

You: "Run tests"

Tests: "All pass ✅"

You: "Update tasks.md - mark Phase 1 complete"

Claude: [Updates tasks.md with ✅]

═══════════════════════════════════════════════════════════
📝 STEP 5: PHASE 2 IMPLEMENTATION
═══════════════════════════════════════════════════════════

You: "Now Phase 2: WhatsApp Integration

Tasks from plan:
- Connect to existing WhatsApp client
- Add template rendering
- Handle delivery failures"

Claude: [Implements Phase 2]

═══════════════════════════════════════════════════════════
📝 STEP 6: TESTING
═══════════════════════════════════════════════════════════

You: "Test notification sending with real data"

You: "@whatsapp send_message phone:89686484488 message:'Test notification'"

[Success]

You: "Check logs for any errors"

You: "@logs logs_tail service:ai-admin-worker-v2 lines:50"

[No errors]

You: "Update context.md with test results"

Claude: [Updates context.md]

═══════════════════════════════════════════════════════════
📝 STEP 7: FINAL REVIEW & DOCUMENTATION
═══════════════════════════════════════════════════════════

You: "Use code-architecture-reviewer for full system review"

Agent: "All phases implemented correctly ✅"

You: "Use documentation-architect to create docs"

Agent: [Creates comprehensive documentation]

You: "Mark all tasks complete in tasks.md"

Claude: [Updates tasks.md - all ✅]

You: "Move to archive"

You: "mv dev/active/booking-notifications dev/archive/"

═══════════════════════════════════════════════════════════
📝 STEP 8: DEPLOY
═══════════════════════════════════════════════════════════

You: "Create git commit"

Claude: [Creates detailed commit with:
- feat: booking notification system
- Full description
- Testing notes
- Co-authored by Claude]

You: "Push and deploy"

ssh root@server "cd /opt/ai-admin && git pull && pm2 restart all"

═══════════════════════════════════════════════════════════
✅ DONE!
═══════════════════════════════════════════════════════════

Total time: ~2-3 hours
Quality: High (reviewed at each phase)
Context loss: Zero (dev docs preserved everything)
Technical debt: Zero (hooks caught all issues)
```

---

### Example 2: Bug Fix (Auth Issue)

```
═══════════════════════════════════════════════════════════
🐛 STEP 1: REPRODUCE & GATHER CONTEXT
═══════════════════════════════════════════════════════════

You: "Users report: 'Getting 401 error when creating bookings'"

You: "@logs logs_tail service:ai-admin-worker-v2 lines:100"

Logs: "JWT token validation failed: invalid signature"

You: "Check recent changes"

git log --oneline -10

Recent: "feat: update JWT secret rotation"

You: "Aha! Possible issue with JWT secret. Let me gather more context"

You: "Claude, explain current JWT authentication flow"

🎯 SKILL ACTIVATION CHECK
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
  → route-tester

Claude: [Uses skill, explains auth flow]

═══════════════════════════════════════════════════════════
🐛 STEP 2: DIAGNOSE
═══════════════════════════════════════════════════════════

You: "Use auth-route-debugger to debug /api/booking/create"

Agent: [Debugs]

Agent Report:
"Found issue:
1. JWT secret in .env: 'new_secret_key'
2. Old tokens signed with: 'old_secret_key'
3. Validation fails for existing tokens

Solution: Add grace period supporting both secrets"

═══════════════════════════════════════════════════════════
🐛 STEP 3: FIX
═══════════════════════════════════════════════════════════

You: "Implement the grace period solution. Support both old and new secrets
for 7 days, then remove old secret."

Claude: [Implements solution]

═══════════════════════════════════════════════════════════
🐛 STEP 4: TEST
═══════════════════════════════════════════════════════════

You: "Test with old token"

You: "Use auth-route-tester with old JWT token"

Agent: "Old token works ✅"

You: "Test with new token"

Agent: "New token works ✅"

═══════════════════════════════════════════════════════════
🐛 STEP 5: DEPLOY & MONITOR
═══════════════════════════════════════════════════════════

You: "Create commit and deploy"

[Commit, push, deploy]

You: "Monitor logs for 10 minutes"

@logs logs_tail service:ai-admin-worker-v2 lines:50

[No auth errors]

You: "Check Sentry for any new auth errors"

[No new errors]

═══════════════════════════════════════════════════════════
✅ BUG FIXED!
═══════════════════════════════════════════════════════════

Time: ~30 minutes
Root cause: JWT secret rotation without migration
Solution: Grace period supporting both secrets
Verified: Tests pass, no production errors
```

---

### Example 3: Refactoring (Legacy Code)

```
═══════════════════════════════════════════════════════════
🔧 STEP 1: ASSESS CURRENT STATE
═══════════════════════════════════════════════════════════

You: "The message queue system is messy. Let's refactor to BullMQ.
First, use web-research-specialist to research BullMQ best practices"

Agent: [Researches]

Agent Report:
"BullMQ Best Practices:
1. Separate queues for different job types
2. Use delayed jobs for scheduling
3. Implement retry with exponential backoff
4. Monitor with Bull Board
5. Handle job failures gracefully"

═══════════════════════════════════════════════════════════
🔧 STEP 2: PLAN REFACTORING
═══════════════════════════════════════════════════════════

You: "Use refactor-planner to plan migration from current queue to BullMQ"

Agent: [Analyzes current code, creates detailed plan]

Agent Plan:
"Phase 1: Setup
- Install BullMQ
- Create queue instances
- Add Bull Board for monitoring

Phase 2: Migration
- Replace old queue in message-handler
- Replace old queue in notification service
- Keep old code as fallback

Phase 3: Testing
- Integration tests with real jobs
- Load test with 1000+ jobs
- Monitor for 24h

Phase 4: Cleanup
- Remove old queue code
- Update documentation

Risks:
- Job loss during migration (mitigation: parallel running)
- Different behavior (mitigation: extensive testing)"

You: "Use plan-reviewer to review this plan"

Agent: [Reviews]

Agent: "Plan is solid. Add: Database backup before migration"

═══════════════════════════════════════════════════════════
🔧 STEP 3: EXECUTE REFACTORING
═══════════════════════════════════════════════════════════

You: "/dev-docs bullmq migration plan"

[Creates dev docs]

You: "Execute Phase 1 only"

You: "Use code-refactor-master to execute Phase 1 from plan"

Agent: [Executes Phase 1]

You: [Review code, test]

You: "Phase 1 looks good. Execute Phase 2"

Agent: [Executes Phase 2]

📋 ERROR HANDLING SELF-CHECK
⚠️ Backend Changes Detected
❓ Did you add error handling for queue operations?

You: "Add error handling for all queue operations"

Claude: [Adds comprehensive error handling]

═══════════════════════════════════════════════════════════
🔧 STEP 4: TESTING
═══════════════════════════════════════════════════════════

You: "Run tests"

Tests: "12/15 pass, 3 failures"

You: "Use auto-error-resolver to fix test failures"

Agent: [Fixes tests]

Tests: "15/15 pass ✅"

You: "Deploy to staging, monitor for 2 hours"

[Deploy, monitor]

Monitoring: "All jobs processed successfully, 0 failures"

═══════════════════════════════════════════════════════════
🔧 STEP 5: PRODUCTION DEPLOY
═══════════════════════════════════════════════════════════

You: "Backup database"

[Backup complete]

You: "Deploy to production with old queue as fallback"

[Deploy]

You: "Monitor logs closely"

@logs logs_live service:ai-admin-worker-v2 seconds:60

[All jobs processing correctly]

You: "After 24h, execute Phase 4 (cleanup)"

[24h later, no issues]

You: "Remove old queue code"

Claude: [Removes old code]

═══════════════════════════════════════════════════════════
✅ REFACTORING COMPLETE!
═══════════════════════════════════════════════════════════

Duration: 2 days (with 24h monitoring)
Risk level: Low (thanks to detailed planning)
Issues: 0 (caught all in testing)
Performance: Improved (BullMQ more efficient)
Code quality: Much better (modern patterns)
```

---

## 🔧 Troubleshooting

### Issue 1: Skills Not Auto-Activating

**Symptoms:**
- No "🎯 SKILL ACTIVATION CHECK" message
- Claude doesn't use skills automatically

**Debug:**
```bash
# 1. Check hook is registered
cat .claude/settings.json | grep -A5 "UserPromptSubmit"

# 2. Test hook manually
echo '{"prompt":"create backend route"}' | \
  CLAUDE_PROJECT_DIR=. npx tsx .claude/hooks/skill-activation-prompt.ts

# 3. Check skill-rules.json exists
ls -la .claude/skills/skill-rules.json

# 4. Verify TypeScript can run
npx tsx --version
```

**Solutions:**
- If hook not registered → Check `.claude/settings.json`
- If manual test fails → Check TypeScript installation
- If skill-rules.json missing → Restore from backup
- If tsx not found → `cd .claude/hooks && npm install`

---

### Issue 2: Dev Docs Not Persisting

**Symptoms:**
- `/dev-docs` command doesn't create files
- Files disappear after context reset

**Debug:**
```bash
# 1. Check dev/active directory exists
ls -la dev/active/

# 2. Check command file
cat .claude/commands/dev-docs.md

# 3. Test creating files manually
mkdir -p dev/active/test-task
echo "test" > dev/active/test-task/plan.md
ls -la dev/active/test-task/
```

**Solutions:**
- If directory missing → `mkdir -p dev/active dev/archive`
- If command missing → Restore from showcase
- If files not persisting → Check file permissions
- If `/dev-docs` not working → Try manual file creation

---

### Issue 3: Error Reminder Too Noisy

**Symptoms:**
- Error reminder shows for every change
- False positives for non-risky code

**Solutions:**
```bash
# Temporary disable
export SKIP_ERROR_REMINDER=1

# Or edit detection logic
nano .claude/hooks/error-handling-reminder.ts

# Make more selective:
# - Skip more file types
# - Raise detection thresholds
# - Filter specific patterns
```

---

### Issue 4: Agents Not Working

**Symptoms:**
- "Agent not found" error
- Agent doesn't complete task
- Agent returns empty results

**Debug:**
```bash
# 1. Check agent exists
ls -la .claude/agents/

# 2. Check agent content
head -30 .claude/agents/code-architecture-reviewer.md

# 3. Verify agent can be invoked
# (через Claude Code interface)
```

**Solutions:**
- If agent missing → Copy from showcase
- If agent incomplete → Check file wasn't truncated
- If agent fails → Check task is within agent's scope
- If timeout → Break task into smaller pieces

---

### Issue 5: Context Compaction During Critical Work

**Symptoms:**
- Working on complex task
- Context usage >90%
- Not ready to compact

**Solutions:**
```bash
# BEFORE compaction:
1. Immediately use /dev-docs-update
2. Save current state to dev docs
3. List next steps clearly
4. Compact conversation
5. Continue with "Read dev docs and continue"

# If already compacted without saving:
1. Check git history for code changes
2. Reconstruct from recent commits
3. Use "git diff HEAD~5" to see changes
4. Manually update dev docs
```

---

### Issue 6: Claude Ignoring Skills

**Symptoms:**
- Skill suggested but Claude doesn't use it
- Code doesn't follow patterns from skill

**Solutions:**
```
You: "🎯 SKILL ACTIVATION suggested backend-dev-guidelines.
Use /skill backend-dev-guidelines BEFORE implementing"

Claude: [Loads skill explicitly]

You: "Now implement following the patterns from the skill"
```

**Prevention:**
- Explicitly say "Use the skill first"
- Reference specific sections: "Follow layered architecture from backend-dev-guidelines"
- Review code against skill patterns

---

### Issue 7: Hooks Not Running

**Symptoms:**
- No skill suggestions
- No error reminders
- PostToolUse not tracking files

**Debug:**
```bash
# 1. Check hooks directory
ls -la .claude/hooks/

# 2. Check hook scripts are executable
ls -l .claude/hooks/*.sh

# 3. Make executable if needed
chmod +x .claude/hooks/*.sh

# 4. Check TypeScript files exist
ls -la .claude/hooks/*.ts

# 5. Test hook manually
cat /dev/stdin | CLAUDE_PROJECT_DIR=. \
  .claude/hooks/skill-activation-prompt.sh \
  <<< '{"prompt":"test backend route"}'
```

**Solutions:**
- If hooks missing → Copy from showcase
- If not executable → `chmod +x .claude/hooks/*.sh`
- If TypeScript missing → `curl` from GitHub
- If still failing → Check `.claude/settings.json`

---

## 🎓 Final Tips

### 1. Start Small, Scale Up

Don't try to use everything at once:

**Week 1:** Just skills auto-activation
**Week 2:** Add dev docs for one task
**Week 3:** Try one agent (code-architecture-reviewer)
**Week 4:** Use full workflow

### 2. Trust But Verify

Claude + infrastructure is powerful, but:
- ✅ Trust skills to guide patterns
- ✅ Trust agents for analysis
- ⚠️ Always verify critical code
- ⚠️ Test before deploying

### 3. Measure Your Improvement

Track metrics:
- Time to complete features
- Bugs caught in development vs production
- Code review comments
- Context resets survived without lost work

### 4. Customize for Your Project

This infrastructure is a template:
- Add project-specific skills
- Create custom agents for your domain
- Adjust hooks to your workflow
- Modify dev docs structure

### 5. Keep Learning

Resources:
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Showcase Repository](https://github.com/diet103/claude-code-infrastructure-showcase)
- [Original Reddit Post](docs/Reddit%20post.md)
- Your own `dev/archive/` - review past successes

---

## 📊 Success Metrics

**You're doing it right when:**

✅ Skills auto-activate without manual invocation
✅ Context resets don't cause lost work
✅ Code reviews consistently find fewer issues
✅ Feature velocity increases over time
✅ Technical debt decreases
✅ You spend more time planning, less time fixing
✅ Claude "remembers" patterns from skills
✅ Error reminders catch real issues
✅ Agents save you hours on reviews/research

**Warning signs:**

⚠️ Constantly forgetting what you were doing
⚠️ Repeating same mistakes in code
⚠️ Skills never auto-activate
⚠️ Never using dev docs (tasks >30 min)
⚠️ Agents always fail or timeout
⚠️ Ignoring error reminders
⚠️ Context resets = lost work

---

## 🎯 Quick Reference Card

**Starting a Task:**
```bash
1. Enable planning mode
2. Review + approve plan
3. /dev-docs [task description]
4. Implement phase by phase
5. Review between phases
6. Update dev docs frequently
```

**During Implementation:**
```bash
- Trust skill suggestions → use them
- Break into phases → review between
- Update tasks.md → mark ✅ immediately
- Update context.md → key decisions
- Use agents → for reviews/research
- Check error reminders → verify handling
```

**Before Context Limits:**
```bash
/dev-docs-update
[Review what was saved]
[Compact conversation]
[Continue: "Read dev docs and continue"]
```

**Quality Checklist:**
```bash
□ Skills used for relevant code
□ Error handling added (Sentry)
□ Tests written and passing
□ Code reviewed (agent or manual)
□ Documentation updated
□ No TypeScript errors
□ MCP servers tested (if API changes)
```

---

## 🚀 You're Ready!

You now have:
- ✅ Understanding of the philosophy
- ✅ Skills system knowledge
- ✅ Dev docs workflow
- ✅ Agents arsenal
- ✅ Prompting techniques
- ✅ Real workflow examples
- ✅ Troubleshooting guide

**Start with one small task and use the full workflow.**

The more you use it, the more natural it becomes.

Good luck! 🎉

---

**Last updated:** November 3, 2025
**Based on:** [diet103/claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase)
**Project:** AI Admin v2
**Status:** ✅ Production Ready - All Systems Operational
