# Claude Code Configuration

This directory contains Claude Code configuration, skills, hooks, and automation scripts.

## 📁 Structure

```
.claude/
├── skills/                    # Specialized skills for different domains
│   ├── backend-dev-guidelines/    # Backend development best practices
│   ├── skill-developer/           # Meta-skill for managing skills
│   ├── route-tester/              # API testing patterns
│   ├── error-tracking/            # Error handling and monitoring
│   └── skill-rules.json           # Auto-activation triggers
├── hooks/                     # Automation hooks
│   ├── skill-activation-prompt.sh # Auto-suggests skills based on prompts
│   └── post-tool-use-tracker.sh  # Tracks file changes for context
├── agents/                    # (Future) Specialized agents
├── commands/                  # (Future) Custom slash commands
├── settings.json              # Main settings with hooks configuration
└── settings.local.json        # Local user-specific settings

## 🎯 Skills System

### How Auto-Activation Works

1. **You write a prompt** mentioning keywords like "backend", "service", "API", "error" (or in Russian: "бэкенд", "сервис", "ошибка", etc.)
2. **UserPromptSubmit hook** analyzes your prompt against `skill-rules.json`
3. **Skill suggestion** appears if triggers match
4. **You can accept or ignore** the suggestion

**Language Support:** 🇬🇧 English + 🇷🇺 Russian - система работает с промптами на обоих языках!

### Available Skills

#### backend-dev-guidelines
**Activates when:** Working with `src/` files, APIs, services, queues, workers
**Provides:** Node.js/Express/TypeScript/BullMQ best practices, layered architecture patterns

#### skill-developer
**Activates when:** Managing skills, creating new skills, modifying hooks
**Provides:** Meta-skill for skill system development and management

#### route-tester
**Activates when:** Testing API routes, endpoints, integration tests
**Provides:** Testing patterns for authenticated routes and API endpoints

#### error-tracking
**Activates when:** Error handling, logging, monitoring, debugging
**Provides:** Error handling best practices and monitoring patterns

### Manual Invocation

If auto-activation doesn't work, manually invoke skills:

```bash
/skill backend-dev-guidelines
/skill route-tester
/skill error-tracking
/skill skill-developer
```

## 🔧 Configuration

### skill-rules.json

Defines when skills activate based on:
- **Keywords** in prompts (e.g., "backend" / "бэкенд", "service" / "сервис", "API")
- **Intent patterns** (regex for flexible matching in English & Russian)
- **File path patterns** (e.g., `src/**/*.ts`)
- **Content patterns** (e.g., `router.`, `export.*Service`)

**Adapted for AI Admin v2:**
- Single backend application structure (not monorepo)
- Specific to our tech stack (Express, BullMQ, WhatsApp, YClients)
- Covers our project directories (src/services/, src/api/, src/queue/)
- **Bilingual support:** English + Russian keywords and patterns

**Example triggers (English):**
- "create a new service for booking"
- "fix error in queue processing"
- "test the API endpoint"
- "how to handle errors in worker"

**Example triggers (Russian):**
- "создать новый сервис для бронирования"
- "исправить ошибку в обработке очереди"
- "протестировать эндпоинт API"
- "как обработать ошибки в воркере"

### settings.json

Hooks configuration:
- **UserPromptSubmit:** Triggers skill activation based on prompts
- **PostToolUse:** Tracks file edits to understand context

## 🚀 Integration Source

Based on [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase)

**Adaptations made:**
- Removed frontend skill (backend-only project)
- Adjusted pathPatterns for single application structure
- Added AI Admin v2 specific keywords (WhatsApp, YClients, booking, BullMQ)
- Removed monorepo-specific hooks (tsc-check, trigger-build-resolver)

## 📚 Learn More

- **CLAUDE.md** - Quick reference for skills system usage
- **skills/README.md** - Detailed skill documentation (from showcase)
- **Integration Guide:** [CLAUDE_INTEGRATION_GUIDE.md](https://github.com/diet103/claude-code-infrastructure-showcase/blob/main/CLAUDE_INTEGRATION_GUIDE.md)

---

**Integrated:** November 3, 2025
**Status:** ✅ Active and ready to use
