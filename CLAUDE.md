# CLAUDE.md

Quick reference for Claude Code when working with AI Admin v2.

## 🚀 Quick Start

**Before starting work:**
```bash
./start-work.sh  # Get project status and recent changes
```

**Key documentation to check:**
- `config/project-docs/CONTEXT.md` - Where we left off
- `config/project-docs/TASK.md` - Current tasks
- **`docs/02-guides/claude-code/CLAUDE_CODE_MASTER_GUIDE.md`** - 🚀 **ПОЛНОЕ РУКОВОДСТВО по Claude Code (NEW!)**
- `docs/TROUBLESHOOTING.md` - Common issues
- `docs/02-guides/telegram/TELEGRAM_BOT_QUICK_REFERENCE.md` - 🤖 Telegram бот управление
- `docs/02-guides/marketplace/AUTHORIZATION_QUICK_REFERENCE.md` - ⚡ YClients авторизация
- `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md` - 🗄️ Timeweb PostgreSQL миграция
- **`dev/active/database-migration-supabase-timeweb/`** - 🎯 **COMPLETE: Database Migration** (Nov 11, 2025)
- **`dev/active/baileys-resilience-improvements/`** - 🔄 **ACTIVE: Baileys Resilience** (Phase 3: 25% complete)

## 🔧 Essential MCP Servers

Use MCP servers instead of SSH/scripts for faster access:

| Server | Purpose | Example | Status |
|--------|---------|---------|--------|
| @whatsapp | Test messages | `@whatsapp send_message phone:79001234567 message:"Test"` | ✅ Custom |
| @redis | Context cache | `@redis get_context phone:79001234567` | ✅ Custom |
| @supabase | Database | `@supabase query_table table:clients filters:{"phone":"79001234567"}` | ✅ Custom |
| @yclients | YClients API | `@yclients get_available_slots date:2025-11-15` | ✅ Custom |
| @notion | Task management | `@notion create_page parent_id:xxxxx title:"New Task"` | ✅ Official |

### YClients Marketplace MCP Tools (NEW!)

```bash
# Получить подключенные салоны
@yclients marketplace_get_salons page:1 count:100

# Статус интеграции салона
@yclients marketplace_salon_status salon_id:962302

# Регистрация платежа (сохраните payment_id!)
@yclients marketplace_notify_payment salon_id:962302 payment_sum:1990 payment_date:2025-11-26 period_from:2025-11-26 period_to:2025-12-26

# Возврат платежа
@yclients marketplace_notify_refund payment_id:12345

# Управление каналами уведомлений
@yclients marketplace_update_channel salon_id:962302 channel:whatsapp enabled:true

# Отключение салона (ОПАСНО!)
@yclients marketplace_uninstall salon_id:962302 confirm:true
```

**Configuration:** All servers configured in `.mcp.json` (see `.mcp.json.example`)
**Redis tunnel required:** `./scripts/maintain-redis-tunnel.sh start`
**Notion setup:** See `docs/02-guides/notion/NOTION_MCP_SETUP.md`

## 🎯 Claude Code Skills System - ✅ ПОЛНОСТЬЮ РАБОТАЕТ

**Auto-Activation System** - Skills automatically suggest themselves based on your prompts and file context.

**Language Support:** 🇬🇧 English + 🇷🇺 Russian - работает с промптами на обоих языках!

**Status:** 🏆 **100% PRODUCTION READY** - All hooks operational, auto-activation tested and working

### Available Skills

| Skill | When It Activates | Purpose |
|-------|-------------------|---------|
| **backend-dev-guidelines** | Working with src/ files, API, services, queues | Node.js/Express/TypeScript/BullMQ best practices |
| **skill-developer** | Creating/modifying skills, hooks | Meta-skill for managing Claude Code skills |
| **route-tester** | Testing API routes/endpoints | Testing patterns for authenticated routes |
| **error-tracking** | Error handling, monitoring, logging | Error handling and monitoring best practices |

### How It Works (✅ All Operational)

1. **UserPromptSubmit Hook** ✅ - Analyzes your prompts for keywords (backend, service, API, error, etc.)
   - English: "create a new booking route" → backend-dev-guidelines
   - Russian: "исправить ошибку в сервисе" → backend-dev-guidelines + error-tracking
2. **PostToolUse Hook** ✅ - Tracks file changes to understand context
3. **Stop Hook** ✅ - Error handling reminders after code changes
4. **skill-rules.json** - Configuration with triggers adapted for AI Admin v2 structure

### Auto-Activation Examples

```
You: "Создай новый контроллер для WhatsApp сообщений"

🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
  → error-tracking
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Manual Skill Invocation

```bash
# If auto-activation doesn't trigger, manually invoke:
/skill backend-dev-guidelines
/skill route-tester
/skill error-tracking
/skill skill-developer
```

### Configuration

- **Skills:** `.claude/skills/` - 4 specialized skills with resources
- **Rules:** `.claude/skills/skill-rules.json` - Activation triggers
- **Hooks:** `.claude/hooks/` - Auto-activation scripts (3 hooks operational)
- **Settings:** `.claude/settings.json` - Hook configuration

**Source:** Based on [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase)

**Testing Results:**
- ✅ "create a new booking route" → backend-dev-guidelines
- ✅ "исправить ошибку в сервисе" → backend-dev-guidelines + error-tracking
- ✅ "тест маршрута API для ватсап" → backend-dev-guidelines + route-tester

## 📋 Dev Docs System - Task Management

**"Out of everything (besides skills), this has made the most impact"** - diet103

### The Problem
Claude has "extreme amnesia" - loses track of what you're doing on large tasks, especially after context compaction.

### The Solution
Persistent documentation system that survives context resets:

```
dev/active/[task-name]/
  ├── [task-name]-plan.md      # What we're building
  ├── [task-name]-context.md   # Where we are + key decisions
  └── [task-name]-tasks.md     # What's done, what's next
```

### Workflow

**1. Start Any Task >30 minutes:**
```bash
/dev-docs implement WhatsApp message queueing
```
Auto-creates plan + context + tasks files with comprehensive breakdown.

**2. During Implementation:**
- Mark tasks ✅ completed immediately
- Update context with key decisions
- Note blockers and workarounds

**3. Before Context Limits (~10-15% left):**
```bash
/dev-docs-update
```
Captures current state, decisions, next steps - ready for seamless continuation.

**4. After Context Reset:**
- Read all three files
- Continue exactly where you left off
- No "what was I doing?" moments

### Slash Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/dev-docs [description]` | Create strategic plan + 3 files | Starting any task >30 min |
| `/dev-docs-update` | Update docs before compaction | Context ~10-15% remaining |
| `/route-research-for-testing` | Research & test API routes | API development |

### Specialized Agents

Available in `.claude/agents/` (10 агентов):

**Quality Control:**
- **code-architecture-reviewer** - Reviews code for best practices adherence
- **auto-error-resolver** - Systematically fixes TypeScript/build errors
- **refactor-planner** - Creates comprehensive refactoring plans
- **code-refactor-master** - Executes complex refactoring tasks

**Testing & Debugging:**
- **auth-route-tester** - Tests backend routes with authentication
- **auth-route-debugger** - Debugs 401/403 errors and route issues
- **frontend-error-fixer** - Diagnoses and fixes frontend errors (React/MUI)

**Planning & Strategy:**
- **plan-reviewer** - Reviews implementation plans before starting
- **documentation-architect** - Creates/updates comprehensive documentation
- **web-research-specialist** - Researches issues, best practices, solutions

**Usage:** `Task(subagent_type='agent-name', description='...', prompt='...')`

**Example:**
```python
Task(subagent_type='code-architecture-reviewer',
     description='Review booking service changes',
     prompt='Review the recent changes in src/services/booking/ for best practices')
```

### Error Handling Reminder

**Stop Hook** runs after each response:
- Detects risky patterns (try-catch, async, database calls)
- Shows gentle self-check reminders
- Non-blocking awareness system

Example:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ERROR HANDLING SELF-CHECK
⚠️  Backend Changes Detected (2 files)
   ❓ Did you add proper error handling?
   💡 Backend Best Practice:
      - All errors should be captured
      - Controllers should extend BaseController
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Disable: `export SKIP_ERROR_REMINDER=1`

### Best Practices

**✅ Do:**
- Use `/dev-docs` for ANY task >30 minutes
- Update context BEFORE running low
- Mark tasks completed IMMEDIATELY
- Include file paths & line numbers in notes

**❌ Don't:**
- Skip dev docs thinking task is "quick"
- Batch-update tasks at end
- Leave vague notes like "fixed bug"

**See:** `dev/README.md` for complete guide

## 📍 Environment

- **Local:** /Users/vosarsen/Documents/GitHub/ai_admin_v2
- **Server:** `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- **Server path:** /opt/ai-admin
- **WhatsApp:** +79936363848
- **Test phone:** 89686484488 (для тестирования - ТОЛЬКО этот номер!)

⚠️ **ВАЖНО:** НИКОГДА не тестируй на реальных клиентах! Используй только тестовый номер 89686484488.

## 🔄 Development Workflow (GitHub Flow)

**Правила:**
- `main` = единственная долгоживущая ветка (production-ready)
- Короткие feature ветки (1-7 дней макс)
- Pull Requests для каждой фичи
- Merge в main после review

```bash
# 1. Новая задача → новая ветка из main
git checkout main
git pull origin main
git checkout -b feature/task-name  # или fix/, docs/, refactor/

# 2. Работа + коммиты
git add -A && git commit -m "feat: описание"

# 3. Push и создать PR
git push origin feature/task-name
# Создать Pull Request на GitHub

# 4. После review и merge → Deploy
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && pm2 restart all"

# 5. Удалить merged ветку
git branch -d feature/task-name

# 6. Test via MCP
@whatsapp send_message phone:89686484488 message:"Test"
@logs logs_tail service:ai-admin-worker-v2 lines:50
```

**Именование веток:**
- `feature/` - новая функциональность
- `fix/` - исправление бага
- `docs/` - только документация
- `refactor/` - рефакторинг

**Commit messages (Conventional Commits):**
```
feat: добавлена новая фича
fix: исправлен баг
docs: обновлена документация
refactor: рефакторинг кода
test: добавлены тесты
chore: обновление зависимостей
```

**См. подробнее:**
- `docs/GIT_WORKFLOW_STRATEGY.md` - полная стратегия
- `docs/GIT_QUICK_REFERENCE.md` - краткая шпаргалка

## 🏗️ Architecture

**Current: v2 with Two-Stage Processing + Gemini**
```
Message → Stage 1: Extract Commands (JSON) → Execute → Stage 2: Generate Response
         ↓ ~5 sec (Gemini)                   ↓ 0.01s   ↓ ~4 sec (Gemini)
         Total: ~9 seconds (2.6x faster than DeepSeek)
```

**AI Provider: Google Gemini 2.5 Flash**
- Via SOCKS5 proxy (Xray VPN) to bypass geo-blocking
- USA server (us.cdn.stun.su) - 108ms latency
- Cost: $29/month (vs $106/month with DeepSeek)
- Speed: 2.6x faster (9s vs 24s)

**Activate Two-Stage:**
```bash
export USE_TWO_STAGE=true
export AI_PROMPT_VERSION=two-stage
export AI_PROVIDER=gemini-flash
export SOCKS_PROXY=socks5://127.0.0.1:1080
```

## 🎯 Core Services

| Service | Location | Purpose |
|---------|----------|---------|
| AI Admin v2 | `src/services/ai-admin-v2/` | Main AI orchestrator |
| Message Queue | `src/queue/` | BullMQ message handling |
| Booking Monitor | `src/services/booking-monitor/` | Reminders & notifications |
| WhatsApp Client | `src/integrations/whatsapp/` | Baileys integration |
| Context Service | `src/services/context/` | Redis conversation cache |
| **Schedules Sync** | `src/sync/schedules-sync.js` | **Гибридная синхронизация расписаний** |

## ⚠️ Critical Configuration

```bash
# MUST be set in production
BAILEYS_STANDALONE=true  # Prevents session conflicts

# AI Provider (Gemini with VPN)
AI_PROVIDER=gemini-flash
GEMINI_API_KEY=***REMOVED***
SOCKS_PROXY=socks5://127.0.0.1:1080

# Redis ports
Local: 6380 (SSH tunnel)
Server: 6379 (direct)

# VPN/Proxy
Xray service: systemctl status xray
Config: /usr/local/etc/xray/config.json
```

## 🔄 Data Synchronization

**Hybrid Schedules Sync (NEW!):**
```bash
# FULL sync (30 days) - automatic at 05:00 or manual:
curl -X POST http://localhost:3000/api/sync/schedules

# TODAY-ONLY sync (today+tomorrow) - automatic hourly 8-23 or manual:
curl -X POST http://localhost:3000/api/sync/schedules/today
```

**Schedule:**
- **FULL**: 05:00 daily (30 days ahead)
- **TODAY-ONLY**: Every hour 08:00-23:00 (today+tomorrow)
- **Result**: Max 1 hour delay vs 24 hours before
- **Details**: `docs/03-development-diary/2025-10-23-hybrid-schedules-sync.md`

## 🐛 Troubleshooting

**Common issues:**
1. "Извините, произошла ошибка" → Check logs: `@logs logs_tail service:ai-admin-worker-v2`
2. Session errors → Check WhatsApp service: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs baileys-whatsapp-service --lines 50"`
3. Redis connection → Ensure tunnel: `./scripts/maintain-redis-tunnel.sh status`
4. Too many Telegram alerts → See `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md`
5. WhatsApp file accumulation → See `docs/WHATSAPP_MONITORING_GUIDE.md`
6. **Gemini API errors** → Check VPN: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl status xray"`
7. **Slow responses** → Test proxy: `curl -x socks5://127.0.0.1:1080 https://ipinfo.io/json`
8. **Outdated schedules** → Manual sync: `POST /api/sync/schedules/today` (see Data Synchronization above)
9. **Monitoring false negatives** → Check script handles log rotation: `./scripts/monitor-phase07-timeweb.sh` (See `dev/completed/monitoring-script-fix/`)

**PM2 monitoring:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50"
```

## 📊 Monitoring & Alerts

**WhatsApp file monitoring thresholds:**
- ✅ OK: < 200 files
- ⚠️ WARNING: 200+ files (alert 1/hour)
- 🟠 CRITICAL: 250+ files (alert 1/30min)
- 🔴 EMERGENCY: 300+ files (alert 1/15min)

**Note:** We tested with 230 files without issues. The "device_removed" warnings are precautionary, not based on hard limits.

## 📚 Detailed Documentation

For more information, see:
- `docs/ARCHITECTURE.md` - Full system architecture
- `docs/MCP_SERVERS_GUIDE.md` - Complete MCP setup
- `docs/SYNC_SYSTEM.md` - YClients sync details
- `docs/AI_PROVIDERS_GUIDE.md` - AI provider configuration
- `docs/GEMINI_INTEGRATION_GUIDE.md` - **Gemini setup and testing**
- `docs/03-development-diary/2025-10-19-gemini-integration-with-vpn.md` - **Full Gemini deployment story**
- `docs/03-development-diary/2025-10-23-hybrid-schedules-sync.md` - **🔄 Гибридная синхронизация расписаний**
- `docs/03-development-diary/2025-10-28-reschedule-booking-fix.md` - **📅 Исправление переноса записей**
- `docs/03-development-diary/2025-11-08-phase-07-monitoring-script-fix.md` - **🔧 Phase 0.7 monitoring script log rotation fix**
- `docs/WHATSAPP_MONITORING_GUIDE.md` - WhatsApp monitoring and file management
- `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md` - Telegram alert troubleshooting
- `docs/features/EXPLAIN_SERVICE_COMMAND.md` - **📖 Контекстные описания услуг**
- `docs/03-development-diary/` - Recent changes and decisions
- `docs/marketplace/` - YClients Marketplace интеграция и авторизация

## 🚫 Important Rules

1. **No hardcoding** - Use config files or environment variables
2. **Commit after EVERY change** - Don't accumulate changes
3. **Test in production** - Local testing isn't enough
4. **Use MCP servers** - Faster than SSH/scripts
5. **Document success only** - Create diary entries after fixes work

## 📊 Notion Workspace Integration

**Status:** ✅ **COMPLETE** - All Phases Finished (2025-11-16)
**Databases:** Projects | Tasks | Knowledge Base
**Sync:** Every 15 minutes (8am-11pm) + Nightly (2am) - Automated via PM2 cron
**Performance:** 30-60s sync, 0.030 req/sec (136x under API limit), 100% uptime

### Quick Reference

**View in Notion:**
- Projects: https://www.notion.so/2ac0a520-3786-819a-b0ab-c7758efab9fb (3 projects)
- Tasks: https://www.notion.so/2ac0a520-3786-81ed-8d10-ef3bc2974e3a (25 phase-level tasks)
- Knowledge Base: https://www.notion.so/2ac0a520-3786-81b6-8430-d98b279dc5f2

**Manual Sync Commands:**
```bash
npm run notion:sync              # Sync all projects (smart, skip unchanged)
npm run notion:sync:force        # Force full re-sync (all projects)
npm run notion:sync:project <path>  # Sync specific project only
npm run notion:parse --all       # Test parser (no sync to Notion)
npm run notion:health            # Health check + stats
```

**Workflow:**
1. Work in markdown as usual (`dev/active/*/` files)
2. Sync happens automatically every 15 minutes
3. View updates in Notion (read-only team visibility)
4. Markdown = source of truth (NEVER edit in Notion!)

**What's Synced:**
- Project metadata (name, status, phase, components, priority, risk)
- Rich page content (8000+ chars from plan.md - development diary style)
- Phase-level tasks with checklists (25 phases, not 253 individual tasks)
- Progress auto-calculated (completed/total)
- Implementation plan grouped by status (✅ Done / 🔄 In Progress / ⬜ Upcoming)

**Team Onboarding:**
- Read: `docs/02-guides/notion/NOTION_WORKSPACE_GUIDE.md` - Comprehensive guide (789 lines)
- Execute: `docs/02-guides/notion/NOTION_PHASE2_CHECKLIST.md` - Organizational tasks (guided tour, permissions, mobile)
- Estimated time: 1-2 hours (requires manual execution)

**Emergency:**
- See `docs/02-guides/notion/NOTION_EMERGENCY_SYNC.md` for troubleshooting
- State tracking: `.notion-sync-state.json`
- Logs: Console output + Telegram alerts on failure

**Project Status:**
- ✅ Phase 0: POC (3h actual vs 8h estimated)
- ✅ Phase 1: Core Foundation (4h actual vs 21.5h estimated)
- ✅ Phase 1.5: Tasks Restructure (3h actual vs 3-4h estimated)
- ✅ Phase 2.0: Rich Page Content (2h actual vs 8-11h estimated)
- ✅ Phase 2: Team Adoption - Technical (1h actual vs 6h estimated)
- **Total:** 13 hours (63% under estimate) - Completed 2025-11-16
- **Location:** `dev/completed/notion-workspace-redesign/`

## 📊 Google Sheets Financial Model

**Ссылка:** https://docs.google.com/spreadsheets/d/1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg
**Credentials:** `config/google-service-account.json`
**Scripts:** `scripts/notion/` (setup-financial-sheets.js, read-sheets-data.js, etc.)

### Структура (7 листов)
| Лист | Назначение |
|------|------------|
| Dashboard | Hero-метрики, milestones, данные для графиков |
| Parameters | Бизнес-параметры (цена 50K, rev share 20%, налог 1%) |
| LLM_Models | Сравнение 5 моделей с Value Score |
| Infrastructure | Тиерные затраты (MVP 999₽ → Enterprise 22.5K₽) |
| Scaling | Модель 1→10K салонов (MRR, LLM Cost, Net Profit в ₽ и USD) |
| Unit_Economics | P&L breakdown для 1 салона |
| Sensitivity | Анализ влияния Price, Rev Share, LLM model |

### Ключевые метрики (5 салонов)
- **MRR:** 250,000₽ | **Net Profit:** 186K₽ | **Margin:** 74-75%
- **LLM cost:** 0.9% от выручки (Gemini 2.5 Flash-Lite = 459₽/салон)
- **@ 10K салонов:** $45.9K USD/месяц на карте для LLM

### Работа с таблицей
```bash
# Чтение данных из таблицы
node scripts/notion/read-sheets-data.js

# Чтение Dashboard полностью
node scripts/notion/read-dashboard-full.js
```

**Документация:** `dev/completed/google-sheets-financial-model/`

## 📂 Project Structure

```
/
├── src/              # Source code
├── scripts/          # Utility scripts
│   ├── notion-parse-markdown.js     # Parse project markdown files
│   ├── notion-sync-project.js       # Sync single project to Notion
│   └── notion-daily-sync.js         # Orchestrate multi-project sync
├── mcp/             # MCP servers
├── docs/            # Documentation
├── config/          # Configuration
│   └── project-docs/  # Project management (CONTEXT, TASK, etc.)
├── dev/active/      # Active projects (synced to Notion)
├── examples/        # Code patterns
├── archive/         # Old files (reference only)
└── tests/           # Test files
```

## 🔑 YClients Marketplace Authorization

**ВАЖНО: НЕ нужен User Token для маркетплейса!**

```javascript
// Для работы с API салона через маркетплейс достаточно:
headers = {
  'Authorization': `Bearer ${PARTNER_TOKEN}`,  // Только Partner Token!
  'Accept': 'application/vnd.yclients.v2+json'
}

// Все API endpoints работают с salon_id после подключения:
GET/POST https://api.yclients.com/api/v1/records/{salon_id}
GET https://api.yclients.com/api/v1/clients/{salon_id}
```

Детали: `docs/marketplace/AUTHORIZATION_QUICK_REFERENCE.md`

## 🗄️ Database Migration: Supabase → Timeweb PostgreSQL (ACTIVE!)

**Статус:** ✅ **MIGRATION COMPLETE!** (All 5 phases done) 🎉
**Цель:** Переход с Supabase на Timeweb PostgreSQL (152-ФЗ соответствие + производительность)
**Result:** Production live since Nov 11 | Grade A (94/100) | Zero downtime, zero data loss

### 📊 Migration Complete (Updated 2025-11-12)

**Complete:**
- ✅ Phase 0: Baileys Session Migration (2025-11-06)
  - 1 auth + 728 keys migrated
  - WhatsApp stable, Day 3/7 monitoring
  - **28,700% faster than estimated!**
- ✅ Phase 0.7: Monitoring Script Fix (2025-11-08)
  - Fixed false negatives after daily log rotation
  - 30,000x performance improvement (<1s vs 30s)
  - See `dev/completed/monitoring-script-fix/`
- ✅ Phase 0.8: Schema Migration (2025-11-09)
  - 19 tables, 129 indexes, 8 functions created
  - Zero downtime, 8 minutes execution
  - **10,700% faster than estimated!**
- ✅ **Phase 1: Repository Pattern (2025-11-09 to 11-11)**
  - **COMPLETED via Infrastructure Improvements project**
  - 6 repositories created (1,120 lines)
  - 147/167 integration tests passing (88%) ✅
  - Sentry error tracking (50+ locations)
  - Transaction support implemented
  - Connection pool optimized (21 max)
  - **48% faster than estimated! (12.5h vs 20-24h)**
- ✅ **Phase 2: Code Integration (2025-11-09 to 11-11)**
  - **DISCOVERED: Already complete!**
  - All 20 methods have repository integration
  - Feature flags system (`config/database-flags.js`)
  - Backward compatibility (fallback to Supabase)
  - Error tracking with backend tags
  - **100% faster than estimated! (0h vs 24-40h)**
- ✅ **Phase 3: Data Migration (2025-11-11, 3 hours)**
  - 1,490 records migrated in 8.45 seconds
  - 100% data integrity verified
  - Zero data loss
- ✅ **Phase 4: Testing (2025-11-11)**
  - All smoke tests passed
  - Functional validation: 100%
  - Performance within baseline
- ✅ **Phase 5: Production Cutover (2025-11-11, 75 min)**
  - Zero downtime deployment
  - Instant rollback capability
  - 17+ hours stable operation
- ✅ **Code Review & Fixes (2025-11-12)**
  - Grade: A (94/100)
  - Test coverage: 165/167 (98.8%)
  - Async cleanup fixed
  - Technical debt removed

**Final Status:**
- ✅ ALL PHASES COMPLETE
- ✅ Production: Timeweb PostgreSQL active
- ✅ Zero downtime, zero data loss
- ✅ 2.5x faster than estimated (6 days vs 3 weeks)

### 📋 Active Migration Plan

**Location:** `dev/active/database-migration-supabase-timeweb/`

**Key Files:**
- `database-migration-plan.md` - Complete 5-phase migration plan (updated with Phase 1 details)
- `database-migration-unified-timeline.md` - **⭐ UNIFIED TIMELINE** (all phases + infrastructure integration)
- `database-migration-context.md` - Current state, decisions, lessons learned
- `database-migration-tasks.md` - Detailed task breakdown with checklists

**Related Project:**
- `dev/active/infrastructure-improvements/` - **Completed Phase 1 work** (repositories, tests, Sentry, transactions)

**Timeline:** 6 days actual (vs 3 weeks estimated - **2.5x faster!**)
**Completed:** November 11, 2025 (19 days ahead of schedule!)
**Code Review:** A (94/100) - Production ready ✅

### 🗄️ Timeweb PostgreSQL Connection

```bash
# Production (external SSL endpoint from Moscow datacenter)
Host: a84c973324fdaccfc68d929d.twc1.net
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0

# SSL Required
SSL Mode: verify-full
SSL Cert: /root/.cloud-certs/root.crt

# Connection string
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full
```

### Current Database State

```bash
# Timeweb PostgreSQL (11 MB)
19 tables total:
  ✅ 2 Baileys tables (has data)
  ❌ 17 Business/Messages tables (empty - schema only)

# Supabase PostgreSQL (still active)
Production data:
  - Companies: 1
  - Clients: 1,299
  - Services: 63
  - Bookings: 38
  - And more...
```

### Feature Flags

```bash
# Current (.env)
USE_LEGACY_SUPABASE=true          # Using Supabase
USE_REPOSITORY_PATTERN=false      # Phase 2 will enable
ENABLE_DUAL_WRITE=false           # Phase 3 will enable
```

### Reference Documentation

- **Historical:** `dev/active/datacenter-migration-msk-spb/` (archived)
- **Execution Reports:**
  - Phase 0: `datacenter-migration-msk-spb/PHASE_0_EXECUTION_REPORT.md`
  - Phase 0.8: `datacenter-migration-msk-spb/PHASE_08_EXECUTION_REPORT.md`

---

## 🛡️ Baileys Resilience Improvements (ACTIVE - Phase 3)

**Status:** Phase 1 & 2 COMPLETE ✅ | Phase 3: 25% (1/4 tasks done)
**Location:** `dev/active/baileys-resilience-improvements/`

### Latest Update (Session 8 - Nov 19, 2025)

**Task 4.1 Completed:** PostgreSQL Backups ✅
- **Problem Solved:** pg_dump version mismatch (server v18.0, client v16.10)
- **Solution:** Installed postgresql-client-18 from official pgdg repo
- **Result:** Backups working perfectly (352.56 KB, 100% data integrity)
- **Production:** Daily backups scheduled (03:00 UTC), retention 7 daily + 4 monthly

**Key Achievements:**
- ✅ Emergency rollback capability (<10 min RTO) - Task 1.1-1.3
- ✅ Database health monitoring (Sentry + Telegram) - Task 2.1-2.4
- ✅ In-memory credentials cache (5-min grace period) - Task 3.1
- ✅ File-based cache persistence (survives restarts) - Task 3.1.1
- ✅ Automated key cleanup (daily 3 AM) - Task 3.2
- ✅ PostgreSQL backups (daily, verified) - Task 4.1

**Remaining Tasks (Phase 3):**
- ⏸️ Task 4.2: Backup restoration testing (6h estimated)
- ⏸️ Task 4.3: Disaster recovery checklist (4h estimated)
- ⏸️ Task 4.4: Backup validation automation (4h estimated)

**Progress:** 16/22 tasks complete (73%)

**Documentation:**
- Plan: `baileys-resilience-improvements-plan.md` (1,004 lines)
- Context: `baileys-resilience-improvements-context.md` (Session 8 summary)
- Tasks: `baileys-resilience-improvements-tasks.md` (503 lines, detailed checklist)

**Quick Commands:**
```bash
# Test backup (dry-run)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/backup/backup-postgresql.js --dry-run"

# Create backup manually
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/backup/backup-postgresql.js"

# Check backup size
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -lh /var/backups/postgresql/daily/"

# Check PM2 cron status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 info backup-postgresql"
```

---
**Last updated:** November 19, 2025 (Session 8)
**Current branch:** main (GitHub Flow с короткими feature ветками)
**AI Provider:** Gemini 2.5 Flash (via USA VPN) - 2.6x faster, $77/month savings 🚀
**Latest change:** 🛡️ Baileys Resilience - Task 4.1 PostgreSQL Backups COMPLETE! Phase 3: 25% ✅
**Infrastructure Status:** 100% Complete - Skills System ✅ | Dev Docs ✅ | 10 Agents ✅ | Hook Pipeline ✅ | Error Handling ✅
---

## 📊 Monitoring & Error Tracking

### GlitchTip Access

**URL:** https://glitchtip.adminai.tech
**Credentials:**
- Email: `support@adminai.tech`
- Password: `SecureAdmin2025GT!`

**Features:**
- ✅ HTTPS with Let's Encrypt SSL (A+ rating)
- ✅ HTTP/2 enabled (~80ms response time)
- ✅ Security headers configured
- ✅ Automatic SSL renewal
- ✅ **No SSH tunnel required!**

**Technical Details:**
- Reverse proxy: Nginx 1.24.0
- Backend: Docker Compose (localhost:8080)
- Config: `/etc/nginx/sites-available/glitchtip.adminai.tech`
- Logs: `/var/log/nginx/glitchtip-*.log`

**Quick Access:**
```bash
# Open in browser
open https://glitchtip.adminai.tech

# Health check
curl https://glitchtip.adminai.tech/health-nginx

# Check logs
ssh root@46.149.70.219 "tail -f /var/log/nginx/glitchtip-access.log"
```

**Documentation:** `docs/GLITCHTIP_ACCESS.md`

