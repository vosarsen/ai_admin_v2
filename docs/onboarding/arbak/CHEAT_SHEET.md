# Claude Code Infrastructure - Cheat Sheet для Арбака

> **Quick reference** для повседневной работы. Распечатай или держи открытым! 📋

---

## ⚡ Quick Start

### У тебя УЖЕ всё работает!

Просто открой `ai_admin_v2` в Claude Code → система активна автоматически.

---

## 🎯 Основные команды

| Команда | Что делает |
|---------|------------|
| `/dev-docs [задача]` | Создать план для большой задачи |
| `/dev-docs-update` | Обновить контекст перед compaction |
| `/route-research-for-testing` | Найти роуты для тестирования |
| `/skill backend-dev-guidelines` | Загрузить backend skill вручную |

---

## 🤖 Когда использовать агентов

| Задача | Промпт |
|--------|--------|
| **Code Review** | "Review recent changes in src/services/ for best practices" |
| **Fix Errors** | "Use auto-error-resolver agent to fix TypeScript errors" |
| **Test Routes** | "Use auth-route-tester agent to test POST /api/bookings" |
| **Debug Auth** | "Use auth-route-debugger agent to debug 401 error on /api/endpoint" |
| **Plan Refactor** | "Use refactor-planner agent to plan refactoring of booking-service" |
| **Create Docs** | "Use documentation-architect agent to document the booking flow" |
| **Research** | "Use web-research-specialist agent to find solutions for X" |

---

## 📚 Доступные скиллы

| Скилл | Активируется когда... |
|-------|----------------------|
| `backend-dev-guidelines` | Пишешь "backend", "service", "API", "route", "controller" |
| `route-tester` | Пишешь "test route", "test endpoint", "test API" |
| `error-tracking` | Пишешь "error", "exception", "logging", "monitoring" |
| `skill-developer` | Пишешь "skill", "hook", "create skill" |

---

## 🎓 Workflow для разных задач

### Новая фича (большая задача)

```bash
1. /dev-docs добавить функцию X
2. Claude создаст план + context + tasks
3. Работай по плану
4. Периодически: "Update tasks.md - mark task 1 as done"
5. Перед compaction: /dev-docs-update
6. После compaction: "continue"
```

---

### Backend изменения

```bash
1. Просто пиши промпт: "Создать service для X"
2. backend-dev-guidelines активируется автоматически
3. Claude использует правильные паттерны
4. После ответа увидишь reminder об error handling
```

---

### Тестирование

```bash
# MCP (быстро):
@whatsapp send_message phone:89686484488 message:"Test"
@redis get_context phone:89686484488

# Через агента (детально):
"Use auth-route-tester agent to test POST /api/bookings"
```

---

### Code Review

```bash
# После большого изменения:
"Review the changes in src/services/booking/ for best practices"

# Или с агентом:
"Use code-architecture-reviewer agent to review recent backend changes"
```

---

## 🔍 Что проверить когда что-то не работает

### Skills не активируются

```bash
chmod +x .claude/hooks/*.sh
cd .claude/hooks && npm install
```

---

### Hooks не срабатывают

```bash
# Проверь settings.json:
cat .claude/settings.json | grep -A 10 "hooks"

# Должно быть:
# "UserPromptSubmit": [...]
# "PostToolUse": [...]
# "Stop": [...]
```

---

### Dev docs не создаёт файлы

```bash
mkdir -p dev/active
/dev-docs test task
```

---

## 📖 Где что искать

| Что нужно | Где смотреть |
|-----------|-------------|
| Quick commands для проекта | `CLAUDE.md` |
| Backend best practices | `.claude/skills/backend-dev-guidelines/SKILL.md` |
| Как работают скиллы | `.claude/skills/skill-developer/SKILL.md` |
| Методология системы | `methodology/original-reddit-post.md` |
| Полный onboarding | `README.md` (эта папка) |
| Триггеры активации | `.claude/skills/skill-rules.json` |

---

## 🎯 Признаки что система работает

### ✅ Skills активируются

Когда пишешь промпт → видишь:
```
🎯 SKILL ACTIVATION CHECK
📚 RECOMMENDED SKILLS:
  → backend-dev-guidelines
```

---

### ✅ Hooks работают

После изменения backend файлов → видишь:
```
📋 ERROR HANDLING SELF-CHECK
⚠️  Backend Changes Detected
```

---

### ✅ Dev docs создаются

После `/dev-docs задача` → появляются файлы:
```
dev/active/task-name/
├── task-name-plan.md
├── task-name-context.md
└── task-name-tasks.md
```

---

### ✅ Агенты запускаются

Когда просишь review → Claude говорит:
```
"I'll use the code-architecture-reviewer agent..."
```

---

## 💡 Pro Tips

### 1. Доверяй auto-activation
Не нужно говорить "use backend skill" - он сам загрузится

### 2. Планируй большие задачи
ВСЕГДА используй `/dev-docs` для задач >1 час

### 3. Review периодически
Раз в день: "Review recent changes for issues"

### 4. Update tasks сразу
Не батчи в конце, а сразу: "Mark task 1 as done"

### 5. Используй CLAUDE.md
Забыл команду? → CMD+P → "CLAUDE.md"

---

## 🆘 Quick Troubleshooting

| Проблема | Решение |
|----------|---------|
| Skills не активируются | `chmod +x .claude/hooks/*.sh` |
| Reminder не показывается | `cd .claude/hooks && npm install` |
| Dev docs не работает | `mkdir -p dev/active` |
| Агент не запускается | Будь explicit: "Use the X agent" |

---

## 📱 MCP Servers Quick Reference

| Сервер | Пример |
|--------|--------|
| WhatsApp | `@whatsapp send_message phone:89686484488 message:"Test"` |
| Redis | `@redis get_context phone:89686484488` |
| YClients | `@yclients get_services` |
| Supabase | `@supabase query_table table:clients` |

---

## 🎉 Remember

**У тебя УЖЕ всё настроено!**

- ✅ Просто работай в ai_admin_v2
- ✅ Skills активируются автоматически
- ✅ Hooks проверяют ошибки
- ✅ Агенты готовы помочь
- ✅ Dev docs не дадут потерять фокус

**Наслаждайся!** 🚀

---

**Вопросы?** → Напиши Арсену или см. `README.md`
