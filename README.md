# AI Admin MVP v2.0

Scalable WhatsApp-based AI administrator for beauty salons integrated with YClients CRM.

## Architecture

```
WhatsApp → API Server → Redis Queue → Workers → AI/YClients → WhatsApp
```

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start with Docker
docker-compose up

# Or start manually
npm run dev      # API server
npm run worker   # Workers
```

### Production
```bash
# PM2 deployment
pm2 start ecosystem.config.js

# Or Docker
docker-compose -f docker-compose.prod.yml up -d
```

## Key Features

- ✅ Queue-based message processing
- ✅ Horizontal scaling with workers
- ✅ Company isolation
- ✅ AI-powered natural conversations
- ✅ YClients CRM integration
- ✅ Automated reminders
- ✅ Redis caching
- ✅ Production-ready logging

## 🔒 Security Features

- **Authentication**: HMAC-SHA256 signature validation for webhooks and API calls
- **Redis Security**: Mandatory password authentication in production
- **Rate Limiting**: Protection against DDoS and abuse
- **Secrets Management**: Built-in encryption for sensitive data
- **Circuit Breaker**: Fault tolerance for external services
- **Input Validation**: Comprehensive request validation

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

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

## Monitoring

- Logs: Winston + ELK Stack
- Metrics: Prometheus + Grafana
- Alerts: Critical service failures

## License

Proprietary