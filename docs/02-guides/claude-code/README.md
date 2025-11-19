# Claude Code Integration Guides

Complete documentation for Claude Code AI assistant integration in AI Admin v2.

## Available Guides

### [CLAUDE_CODE_MASTER_GUIDE.md](CLAUDE_CODE_MASTER_GUIDE.md) 🚀
**The Complete Claude Code Guide** (1500+ lines)
- MCP server configuration
- Skills system with auto-activation
- Dev docs workflow for task management
- Specialized agents for code review and refactoring
- Error handling hooks
- Best practices for AI-assisted development

### [CLAUDE_CODE_SKILLS_INTEGRATION_SUMMARY.md](CLAUDE_CODE_SKILLS_INTEGRATION_SUMMARY.md) 📚
**Skills System Deep Dive**
- Auto-activation mechanism
- Hook pipeline (UserPromptSubmit, PostToolUse, Stop)
- Skill configuration and triggers
- Language support (English + Russian)
- Integration testing results

## Quick Start

### 1. Skills Auto-Activation
The system automatically suggests relevant skills based on your prompts:

```
You: "Create a new booking service"
→ Auto-activates: backend-dev-guidelines + error-tracking
```

### 2. Available Skills

| Skill | Triggers | Purpose |
|-------|----------|---------|
| `backend-dev-guidelines` | API, service, controller, route | Backend best practices |
| `error-tracking` | error, exception, sentry, logging | Error handling patterns |
| `route-tester` | test, endpoint, auth, 401, 403 | API testing strategies |
| `skill-developer` | skill, hook, trigger, activation | Meta-skill for skills |

### 3. Manual Invocation
If auto-activation doesn't trigger:
```bash
/skill backend-dev-guidelines
/skill route-tester
```

## Dev Docs Workflow

For any task >30 minutes, use the dev docs system:

```bash
# Start task with comprehensive planning
/dev-docs implement WhatsApp message queueing

# Update before context compaction
/dev-docs-update

# Auto-creates three files:
dev/active/[task]/
  ├── [task]-plan.md      # Strategic plan
  ├── [task]-context.md   # Current state
  └── [task]-tasks.md     # Task checklist
```

## Configuration Files

```
.claude/
├── skills/               # 4 specialized skills
│   ├── skill-rules.json # Activation triggers
│   └── */               # Individual skills
├── hooks/               # 3 auto-activation hooks
├── agents/              # 10 specialized agents
└── settings.json        # Hook configuration
```

## MCP Servers

Essential servers for AI Admin v2:

| Server | Purpose | Example |
|--------|---------|---------|
| `@whatsapp` | Message testing | `send_message phone:79001234567` |
| `@redis` | Context management | `get_context phone:79001234567` |
| `@yclients` | Booking operations | `get_available_slots date:2025-11-15` |
| `@notion` | Task management | `create_page title:"New Task"` |

## Best Practices

### ✅ DO
- Use `/dev-docs` for complex tasks
- Let auto-activation suggest skills
- Update context before compaction
- Mark tasks complete immediately
- Use MCP servers over SSH

### ❌ DON'T
- Skip dev docs for "quick" tasks
- Ignore skill suggestions
- Batch update tasks at end
- Use SSH when MCP available

## Integration Status

✅ **100% PRODUCTION READY**
- All 3 hooks operational
- 4 skills configured for AI Admin v2
- Auto-activation tested (EN + RU)
- 10 specialized agents available
- Dev docs system proven in production

## Language Support

🇬🇧 **English** + 🇷🇺 **Russian**

Examples:
- "Create new controller" → backend-dev-guidelines
- "Создай новый контроллер" → backend-dev-guidelines
- "Fix authentication error" → error-tracking + route-tester
- "Исправить ошибку авторизации" → error-tracking + route-tester

## Troubleshooting

### Skills not auto-activating?
1. Check `.claude/settings.json` - hooks enabled?
2. Verify `.claude/hooks/` scripts exist
3. Test with explicit triggers: "create API endpoint"

### Dev docs not creating files?
1. Ensure `/dev-docs` command includes description
2. Check `dev/active/` directory permissions
3. Try manual creation in correct structure

### MCP servers not working?
1. Verify `.mcp.json` configuration
2. Check server logs in `.mcp-logs/`
3. Ensure required tunnels are active (Redis)

## Source

Based on [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase) by diet103, adapted for AI Admin v2 structure and requirements.

---
*Last updated: 2025-11-17 | Status: Production Ready*