# AI Admin MVP v2.0 - Deployment Guide

## Prerequisites

- Node.js 18+
- Redis 6+
- PM2 (`npm install -g pm2`)
- YClients API credentials
- WhatsApp Venom-bot server running

## Quick Start

### 1. Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
- `YCLIENTS_BEARER_TOKEN` - Your YClients partner token
- `YCLIENTS_USER_TOKEN` - Your YClients user token
- `DEEPSEEK_API_KEY` - DeepSeek AI API key
- `SUPABASE_URL` & `SUPABASE_KEY` - Database credentials
- `VENOM_SERVER_URL` - WhatsApp server URL

### 2. Local Development

```bash
# Install dependencies
npm install

# Start Redis with Docker
docker-compose up -d redis

# Run in development mode
npm run dev      # API server
npm run worker   # Workers (in another terminal)

# Test the flow
node scripts/test-flow.js
```

### 3. Production Deployment

```bash
# Run deployment script
./deploy.sh

# Or manually:
npm ci --only=production
node scripts/cache-initial-data.js
pm2 start ecosystem.config.js
```

### 4. Server Setup (for new server)

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Redis
sudo apt-get install redis-server
sudo systemctl enable redis-server

# Clone repository
git clone https://github.com/yourusername/ai_admin.git
cd ai_admin/ai_admin_v2

# Deploy
./deploy.sh

# Setup PM2 startup
pm2 startup
pm2 save
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### PM2 Commands
```bash
pm2 status              # View all processes
pm2 logs                # View all logs
pm2 logs ai-admin-api   # API logs only
pm2 logs ai-admin-worker # Worker logs only
pm2 monit               # Real-time monitoring
pm2 restart all         # Restart everything
```

### Queue Metrics
```bash
curl http://localhost:3000/api/metrics
```

## Scaling

### Add More Workers
```bash
# Edit ecosystem.config.js
# Change instances: 3 to instances: 5

# Reload PM2
pm2 reload ecosystem.config.js
```

### Add Another Server
1. Setup new server with Node.js, PM2, Redis
2. Copy code and .env file
3. Start only workers (not API):
   ```bash
   pm2 start src/workers/index.js -i 5 --name ai-admin-worker
   ```

## Troubleshooting

### WhatsApp not connected
```bash
# Check venom-bot status
curl http://localhost:3001/status
```

### YClients API errors
```bash
# Test YClients connection
node scripts/cache-initial-data.js
```

### Redis connection issues
```bash
# Check Redis
redis-cli ping
```

### High memory usage
```bash
# Workers auto-restart at 400MB
# API auto-restarts at 500MB
# Manual restart:
pm2 restart ai-admin-worker
```

## Backup

### Redis data
```bash
# Backup
redis-cli --rdb /backup/dump.rdb

# Restore
sudo systemctl stop redis
sudo cp /backup/dump.rdb /var/lib/redis/dump.rdb
sudo systemctl start redis
```

### Application logs
```bash
# Logs are in ./logs/
# Rotate with PM2:
pm2 install pm2-logrotate
```

## Updates

```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm ci --only=production

# Reload PM2
pm2 reload ecosystem.config.js
```