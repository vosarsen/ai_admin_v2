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
- `docs/TROUBLESHOOTING.md` - Common issues

## 🔧 Essential MCP Servers

Use MCP servers instead of SSH/scripts for faster access:

| Server | Purpose | Example |
|--------|---------|---------|
| @logs | PM2 logs | `@logs logs_tail service:ai-admin-worker-v2 lines:50` |
| @whatsapp | Test messages | `@whatsapp send_message phone:79001234567 message:"Test"` |
| @supabase | Database | `@supabase query_table table:clients filters:{"phone":"79001234567"}` |
| @redis | Context cache | `@redis get_context phone:79001234567` |

**Redis tunnel required:** `./scripts/maintain-redis-tunnel.sh start`

## 📍 Environment

- **Local:** /Users/vosarsen/Documents/GitHub/ai_admin_v2
- **Server:** `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- **Server path:** /opt/ai-admin
- **WhatsApp:** +79936363848
- **Test phone:** 89686484488 (для тестирования - ТОЛЬКО этот номер!)

⚠️ **ВАЖНО:** НИКОГДА не тестируй на реальных клиентах! Используй только тестовый номер 89686484488.

## 🔄 Development Workflow

```bash
# 1. Make changes locally
# 2. Commit immediately
git add -A && git commit -m "fix: description"

# 3. Push to GitHub
git push origin feature/redis-context-cache

# 4. Deploy to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"

# 5. Test via MCP
@whatsapp send_message phone:89686484488 message:"Test"
@logs logs_tail service:ai-admin-worker-v2 lines:50
```

## 🏗️ Architecture

**Current: v2 with Two-Stage Processing**
```
Message → Stage 1: Extract Commands (JSON) → Execute → Stage 2: Generate Response
         ↓ 8 sec                              ↓ 0.01s   ↓ 5 sec
         Total: ~13 seconds (vs 33 sec with ReAct)
```

**Activate Two-Stage:**
```bash
export USE_TWO_STAGE=true
export AI_PROMPT_VERSION=two-stage
```

## 🎯 Core Services

| Service | Location | Purpose |
|---------|----------|---------|
| AI Admin v2 | `src/services/ai-admin-v2/` | Main AI orchestrator |
| Message Queue | `src/queue/` | BullMQ message handling |
| Booking Monitor | `src/services/booking-monitor/` | Reminders & notifications |
| WhatsApp Client | `src/integrations/whatsapp/` | Baileys integration |
| Context Service | `src/services/context/` | Redis conversation cache |

## ⚠️ Critical Configuration

```bash
# MUST be set in production
BAILEYS_STANDALONE=true  # Prevents session conflicts

# Redis ports
Local: 6380 (SSH tunnel)
Server: 6379 (direct)
```

## 🐛 Troubleshooting

**Common issues:**
1. "Извините, произошла ошибка" → Check logs: `@logs logs_tail service:ai-admin-worker-v2`
2. Session errors → Check Baileys cleanup: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -1 /opt/ai-admin/baileys_sessions/company_* | wc -l"`
3. Redis connection → Ensure tunnel: `./scripts/maintain-redis-tunnel.sh status`
4. Too many Telegram alerts → See `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md`
5. WhatsApp file accumulation → See `docs/WHATSAPP_MONITORING_GUIDE.md`

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
- `docs/WHATSAPP_MONITORING_GUIDE.md` - WhatsApp monitoring and file management
- `docs/TELEGRAM_ALERTS_TROUBLESHOOTING.md` - Telegram alert troubleshooting
- `docs/development-diary/` - Recent changes and decisions

## 🚫 Important Rules

1. **No hardcoding** - Use config files or environment variables
2. **Commit after EVERY change** - Don't accumulate changes
3. **Test in production** - Local testing isn't enough
4. **Use MCP servers** - Faster than SSH/scripts
5. **Document success only** - Create diary entries after fixes work

## 📂 Project Structure

```
/
├── src/              # Source code
├── scripts/          # Utility scripts
├── mcp/             # MCP servers
├── docs/            # Documentation
├── config/          # Configuration
│   └── project-docs/  # Project management (CONTEXT, TASK, etc.)
├── examples/        # Code patterns
├── archive/         # Old files (reference only)
└── tests/           # Test files
```

---
**Last updated:** September 26, 2025
**Current branch:** feature/redis-context-cache