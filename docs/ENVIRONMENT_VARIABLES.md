# Environment Variables Documentation

## 🔴 Critical Variables (Required)

### WhatsApp Configuration
```bash
BAILEYS_STANDALONE=true    # MUST be true in production
BAILEYS_PORT=3003          # Port for baileys-service
WHATSAPP_PROVIDER=baileys  # Use Baileys instead of Venom
SECRET_KEY=<your_key>      # HMAC authentication for webhooks
```

### Database
```bash
SUPABASE_URL=<your_url>    # Supabase project URL
SUPABASE_KEY=<your_key>    # Service role key with full access
REDIS_URL=redis://localhost:6379  # Redis for queues and cache
REDIS_PASSWORD=<password>  # Redis authentication
```

### AI Configuration
```bash
AI_PROVIDER=deepseek       # AI provider (deepseek/qwen/qwen-72b)
DEEPSEEK_API_KEY=<key>     # DeepSeek API key
DEEPSEEK_MODEL=deepseek-chat
USE_TWO_STAGE=true         # Use Two-Stage processor
AI_PROMPT_VERSION=two-stage # Prompt version
```

### YClients Integration
```bash
YCLIENTS_API_KEY=<key>     # YClients API key
YCLIENTS_USER_TOKEN=<token> # User authentication token
YCLIENTS_PARTNER_ID=8444   # Partner ID for marketplace
YCLIENTS_COMPANY_ID=962302 # Default company ID
```

## 🟡 Important Variables (Recommended)

### Performance
```bash
MAX_CONCURRENT_WORKERS=3   # Number of parallel workers
MESSAGE_QUEUE_NAME=whatsapp-messages
REMINDER_QUEUE_NAME=reminders
```

### Business Rules
```bash
REMINDER_ADVANCE_HOURS=2   # Hours before appointment
REMINDER_DAY_BEFORE_TIME=20:00
MAX_BOOKING_DAYS_AHEAD=30
MIN_BOOKING_MINUTES_AHEAD=30
```

### Monitoring
```bash
LOG_LEVEL=info             # Logging level (debug/info/warn/error)
NODE_ENV=production        # Environment (development/production)
PORT=3000                  # API server port
```

## 🟢 Optional Variables

### Alternative AI Providers
```bash
# Qwen (Alibaba Cloud)
DASHSCOPE_API_KEY=<key>    # For Qwen models
QWEN_MODEL=qwen-plus       # qwen-plus/qwen-max/qwen-turbo

# OpenAI Compatible
OPENAI_API_KEY=<key>
OPENAI_MODEL=gpt-4
```

### Development
```bash
DEBUG=ai-admin:*           # Enable debug logs
MASTER_KEY=<key>           # Master key for encryption
SECRETS_PATH=.secrets      # Path to encrypted secrets
```

### Legacy (Deprecated)
```bash
VENOM_SERVER_URL=http://localhost:3001  # Old WhatsApp provider
VENOM_API_KEY=<key>        # Deprecated
USE_QWEN=false             # Use AI_PROVIDER instead
```

## 🔧 Environment-Specific Settings

### Local Development
```bash
REDIS_URL=redis://localhost:6380  # SSH tunnel port
AI_PROVIDER=deepseek       # Cheaper for testing
LOG_LEVEL=debug
NODE_ENV=development
```

### Production Server
```bash
REDIS_URL=redis://localhost:6379  # Direct connection
BAILEYS_STANDALONE=true    # CRITICAL!
AI_PROVIDER=deepseek       # Or qwen-72b for better quality
LOG_LEVEL=info
NODE_ENV=production
```

## 📝 Example .env File

```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# WhatsApp (CRITICAL)
WHATSAPP_PROVIDER=baileys
BAILEYS_STANDALONE=true
BAILEYS_PORT=3003
SECRET_KEY=sk_webhook_secret_key

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# AI
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
USE_TWO_STAGE=true
AI_PROMPT_VERSION=two-stage

# YClients
YCLIENTS_API_KEY=cfjbs9dpuseefh8ed5cp
YCLIENTS_USER_TOKEN=16e0dffa0d71350dcb83381e03e7af29
YCLIENTS_PARTNER_ID=8444
YCLIENTS_COMPANY_ID=962302

# Workers
MAX_CONCURRENT_WORKERS=3
MESSAGE_QUEUE_NAME=whatsapp-messages

# Business Rules
REMINDER_ADVANCE_HOURS=2
MAX_BOOKING_DAYS_AHEAD=30
```

## ⚠️ Security Notes

1. **Never commit .env files** to version control
2. **Use strong SECRET_KEY** for webhook authentication
3. **Rotate API keys** regularly
4. **Use service role key** for Supabase (not anon key)
5. **Set REDIS_PASSWORD** in production

## 🔄 Variable Loading Order

1. Process environment variables
2. `.env` file in project root
3. Default values in code

## 📚 Related Documentation

- [BAILEYS_STANDALONE_ARCHITECTURE.md](BAILEYS_STANDALONE_ARCHITECTURE.md)
- [docs/deployment/](deployment/) - Deployment guides
- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues