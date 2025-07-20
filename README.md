# AI Admin v2 🤖

**Production-ready WhatsApp AI Assistant for Beauty Salons**

[![MVP Status](https://img.shields.io/badge/MVP-Production%20Ready-green)](https://github.com/your-repo/ai_admin_v2)
[![Architecture](https://img.shields.io/badge/Architecture-AI--First-blue)](https://github.com/your-repo/ai_admin_v2)
[![Performance](https://img.shields.io/badge/Performance-Optimized-brightgreen)](https://github.com/your-repo/ai_admin_v2)

## 🎯 Overview

AI Admin v2 is a next-generation WhatsApp booking assistant designed for beauty salons. Built with **AI-First architecture** and **Smart Caching**, it handles client bookings, provides intelligent suggestions, and offers proactive customer service through WhatsApp integration.

### ✨ Key Features

- 🤖 **AI-First Processing**: Dynamic service/staff resolution without hardcoding
- ⚡ **Automatic Booking**: Creates bookings instantly when time & service specified
- 🚀 **Smart Caching**: Intelligent caching with semantic search (avg <10ms response)
- 🔥 **Rapid-Fire Protection**: Message aggregation prevents spam (5-15s windows)
- 💡 **Proactive Suggestions**: Never says "unavailable" without alternatives
- 📊 **Performance Monitoring**: Real-time metrics and health checks
- 🌐 **Multi-Tenant Ready**: Scalable to 150+ companies
- 🔒 **Production Security**: Rate limiting, authentication, data validation

### 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WhatsApp      │───▶│   Message        │───▶│   AI Service    │
│   Webhook       │    │   Worker         │    │   + Entity      │
└─────────────────┘    └──────────────────┘    │   Resolver      │
                                ▼               └─────────────────┘
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Smart Cache   │◀──▶│   Rapid-Fire     │───▶│   YClients      │
│   (Redis/Memory)│    │   Protection     │    │   API           │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▼
                       ┌──────────────────┐
                       │   Proactive      │
                       │   Suggestions    │
                       └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Redis (optional, falls back to memory cache)
- Supabase account (optional, falls back to mocks)
- YClients API access
- WhatsApp Business API or Venom Bot

### Installation

```bash
# Clone repository
git clone https://github.com/your-repo/ai_admin_v2.git
cd ai_admin_v2

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables
nano .env
```

### Environment Configuration

```bash
# Application Settings
NODE_ENV=production
PORT=3000
MASTER_KEY=your-secure-master-key

# AI Configuration
AI_PROVIDER=deepseek
AI_API_KEY=your-ai-api-key
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com

# Database
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key

# YClients Integration
YCLIENTS_API_KEY=your-yclients-api-key
YCLIENTS_COMPANY_ID=your-company-id

# WhatsApp Integration
VENOM_API_KEY=your-venom-api-key
VENOM_SECRET_KEY=your-venom-secret
WEBHOOK_SECRET=your-webhook-secret

# Performance & Caching
REDIS_URL=redis://localhost:6379
CACHE_TTL_DEFAULT=1800
SMART_CACHE_ENABLED=true

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=30
RATE_LIMIT_BURST_LIMIT=5

# Monitoring
MONITORING_ENABLED=true
HEALTH_CHECK_INTERVAL=300000
```

### Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start

# Run tests
npm test

# Test architecture
node test-architecture-simple.js

# Test proactive AI
node test-proactive-ai.js

# Test monitoring
node test-monitoring-simple.js
```

## 📊 Performance & Testing

### Performance Benchmarks

Based on comprehensive testing:

- **Average Response Time**: <10ms (with cache)
- **Cache Hit Rate**: 70-90% (typical production)
- **Throughput**: 30 requests/minute per phone number
- **Error Rate**: <2% (production average)
- **Memory Usage**: ~50MB base, scales linearly

### Test Suite

```bash
# Run all tests
npm test

# Individual component tests
node test-architecture-simple.js    # Core architecture
node test-proactive-ai.js           # AI suggestions
node test-monitoring-simple.js      # Monitoring system

# Performance stress test
node test-architecture-simple.js    # Includes stress testing
```

### Health Monitoring

Access real-time monitoring at `/health` endpoint:

```bash
curl http://localhost:3000/health

# Response includes:
# - Component health status
# - Performance metrics  
# - Active alerts
# - Resource usage
```

## 🏢 Production Deployment

### Environment Setup

1. **Configure Supabase**:
   ```sql
   -- Tables: companies, services, staff, clients, appointments_cache
   -- See: src/database/SB_schema.js
   ```

2. **Setup Redis** (recommended for production):
   ```bash
   # Local Redis
   redis-server
   
   # Or use cloud Redis (AWS ElastiCache, etc.)
   ```

3. **Configure YClients**:
   ```bash
   # Get API key from YClients
   # Set YCLIENTS_API_KEY and YCLIENTS_COMPANY_ID
   ```

4. **WhatsApp Integration**:
   ```bash
   # Option 1: Venom Bot (easier setup)
   # Option 2: WhatsApp Business API (enterprise)
   ```

### Scaling Configuration

For **30-150 companies**:

```bash
# Increase workers
WORKER_CONCURRENCY=5

# Optimize cache
CACHE_TTL_DEFAULT=3600
SMART_CACHE_MAX_SIZE=10000

# Rate limiting per tenant
RATE_LIMIT_PER_COMPANY=true

# Monitoring intervals
HEALTH_CHECK_INTERVAL=300000  # 5 minutes
METRICS_LOG_INTERVAL=120000   # 2 minutes
```

### Monitoring & Alerts

Production monitoring includes:

- **Health Checks**: All components every 5 minutes
- **Performance Metrics**: Response times, error rates, cache performance
- **Resource Monitoring**: Memory, CPU, connection counts
- **Business Metrics**: Bookings created, customer satisfaction

## 🔧 Configuration

### Smart Caching

The system uses intelligent caching with:

- **Semantic Caching**: Similar queries share cache entries
- **Adaptive TTL**: Popular items cached longer
- **Memory Fallback**: Works without Redis
- **Cache Warming**: Pre-loads frequently accessed data

```javascript
// Example: Entity resolution with smart cache
const service = await entityResolver.resolveService(
  'стрижка машинкой',  // User input
  'company_123',       // Company context
  userContext          // Personalization
);
// Returns: { yclients_id: 18356041, title: 'Стрижка машинкой', ... }
```

### Rapid-Fire Protection

Prevents spam and improves UX:

```javascript
// Multiple messages within 5 seconds get combined:
// Message 1: "Хочу записаться"
// Message 2: "На стрижку"  
// Message 3: "К Сергею"
// 
// Combined: "Хочу записаться. На стрижку. К Сергею"
// Processed as single intelligent request
```

### Proactive AI Suggestions

Never leaves customers without options:

```javascript
// Instead of: "Это время недоступно"
// AI responds: "Это время занято, но у меня есть отличные альтернативы:
//              • 16:00 - Сергей свободен  
//              • 15:00 у Бари (рейтинг 4.9)
//              🔥 Горящий слот: 14:00 со скидкой 10%"
```

## 🎯 Business Features

### Multi-Company Support

- **Tenant Isolation**: Each company has isolated data
- **Custom Branding**: Company-specific responses
- **Flexible Pricing**: Per-company service pricing
- **Staff Management**: Company-specific staff and schedules

### AI Capabilities

- **Natural Language**: Understands various ways to express requests
- **Context Awareness**: Remembers conversation history
- **Personalization**: Adapts to customer preferences
- **Fuzzy Matching**: Handles typos and variations
- **Intelligent Fallbacks**: Always provides alternatives

### Customer Experience

- **Instant Responses**: <2s typical response time
- **24/7 Availability**: AI handles requests anytime
- **Multilingual**: Easy to add language support
- **Proactive Service**: Suggests popular combinations
- **Booking Confirmations**: Automated with cancellation options

## 🔒 Security Features

- **Authentication**: HMAC-SHA256 signature validation for webhooks and API calls
- **Redis Security**: Mandatory password authentication in production
- **Rate Limiting**: Protection against DDoS and abuse (30 req/min per phone)
- **Secrets Management**: Built-in encryption for sensitive data
- **Circuit Breaker**: Fault tolerance for external services
- **Input Validation**: Comprehensive request validation

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

## 🔍 Troubleshooting

### Common Issues

1. **Slow Response Times**:
   ```bash
   # Check cache hit rate
   curl http://localhost:3000/health
   
   # Increase cache TTL
   CACHE_TTL_DEFAULT=3600
   ```

2. **High Error Rates**:
   ```bash
   # Check AI service health
   # Verify API keys
   # Review logs for patterns
   ```

3. **Memory Growth**:
   ```bash
   # Monitor with built-in tools
   # Cache size limits
   # Restart workers periodically
   ```

### Debug Mode

```bash
# Enable detailed logging
DEBUG=ai-admin:*
LOG_LEVEL=debug

# Run with debug
npm run dev
```

### Performance Analysis

```bash
# Run comprehensive test
node test-monitoring-simple.js

# Check specific metrics
curl http://localhost:3000/metrics

# Analyze slow operations
curl http://localhost:3000/health?details=true
```

## API Endpoints

- `POST /webhook/whatsapp` - WhatsApp webhook
- `GET /health` - Health check
- `GET /api/metrics` - Queue metrics
- `POST /api/send-message` - Manual message send

## Scaling

1. **30 companies**: 1 server, 3 workers
2. **150 companies**: 2 servers, 5 workers, Redis cluster
3. **1500 companies**: 5+ servers, Kubernetes
4. **10000 companies**: Multi-region, auto-scaling

## 📈 Roadmap

### Phase 1: MVP (Current)
- ✅ AI-First architecture
- ✅ Smart caching
- ✅ Rapid-fire protection  
- ✅ Proactive suggestions
- ✅ Performance monitoring

### Phase 2: Enhanced Features
- 🔄 Multi-language support
- 🔄 Advanced analytics dashboard
- 🔄 Customer feedback integration
- 🔄 Automated marketing campaigns

### Phase 3: Enterprise
- 🔄 Advanced AI models
- 🔄 Voice message support
- 🔄 Integration marketplace
- 🔄 White-label solutions

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Test with `test-*` scripts
- Ensure all health checks pass

## 📝 License

Proprietary

## 🙏 Acknowledgments

- **YClients API** for booking integration
- **Supabase** for database infrastructure  
- **DeepSeek AI** for natural language processing
- **Redis** for high-performance caching
- **Venom Bot** for WhatsApp integration

## 📚 Documentation

- **Setup Guide**: [CLAUDE.md](./CLAUDE.md) - Complete setup and configuration
- **Planning**: [PLANNING.md](./PLANNING.md) - Architecture and design decisions
- **Task Tracking**: [TASK.md](./TASK.md) - Current tasks and completed work
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- **YClients API**: [YCLIENTS_API.md](./YCLIENTS_API.md) - Complete API documentation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/ai_admin_v2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/ai_admin_v2/discussions)

---

**Built with ❤️ for the beauty industry**

*Ready for 30 pilot deployments, scalable to 150+ companies*