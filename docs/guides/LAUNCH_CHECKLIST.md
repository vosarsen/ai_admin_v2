# 🚀 Launch Checklist - AI Admin MVP v2.0

## Pre-Launch (Development)

### ✅ Code Complete
- [x] Queue-based message processing
- [x] Worker architecture
- [x] AI Service integration
- [x] YClients integration
- [x] Booking flow
- [x] Reminder system
- [x] Context management
- [x] Error handling

### ⚙️ Configuration
- [ ] Copy `.env` from old project
- [ ] Update all API keys
- [ ] Set correct company ID
- [ ] Configure Redis URL
- [ ] Set timezone correctly

### 🧪 Local Testing
- [ ] Run `./scripts/dev.sh`
- [ ] Test booking flow
- [ ] Test reminder scheduling
- [ ] Check error handling
- [ ] Verify queue processing

## Server Setup

### 📦 Dependencies
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] Redis server running
- [ ] Git repository cloned

### 🔧 Initial Setup
```bash
# On server
cd /opt/ai_admin_v2
npm ci --only=production
cp .env.example .env
nano .env  # Configure all variables
```

### 🗄️ Database
- [ ] Run `scripts/setup-database.sql` in Supabase
- [ ] Verify tables created
- [ ] Test connection from app

### 🔌 Integrations
- [ ] YClients API credentials working
- [ ] WhatsApp venom-bot connected
- [ ] DeepSeek API key valid
- [ ] Supabase connection OK

## Deployment

### 🚀 First Deploy
- [ ] Run `./deploy.sh`
- [ ] Check PM2 status
- [ ] View logs for errors
- [ ] Test health endpoint

### ✅ Smoke Tests
- [ ] Send test message via WhatsApp
- [ ] Check queue metrics
- [ ] Verify booking creation
- [ ] Test reminder scheduling

### 📊 Monitoring
- [ ] Start monitor script
- [ ] Set up alerts (email/SMS)
- [ ] Configure log rotation
- [ ] Set up daily backups

## Post-Launch

### 📈 Performance
- [ ] Monitor queue depth
- [ ] Check processing times
- [ ] Watch memory usage
- [ ] Track error rates

### 🔒 Security
- [ ] Secure Redis with password
- [ ] Enable firewall rules
- [ ] Set up SSL (if needed)
- [ ] Regular security updates

### 📝 Documentation
- [ ] Document API endpoints
- [ ] Create runbook for ops
- [ ] Train support team
- [ ] Prepare scaling guide

## Daily Operations

### Morning Checks
- [ ] Check overnight alerts
- [ ] Review error logs
- [ ] Check queue metrics
- [ ] Verify all services running

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Clean up old logs
- [ ] Update dependencies
- [ ] Plan for scaling needs

## Emergency Contacts

```
Tech Lead: [Your phone]
DevOps: [DevOps phone]
YClients Support: [Support phone]
```

## Common Issues

### WhatsApp Disconnected
```bash
# Check venom-bot
pm2 logs venom
curl http://localhost:3001/status
```

### High Queue Depth
```bash
# Scale workers
pm2 scale ai-admin-worker +3
```

### Memory Issues
```bash
# Restart with lower memory limit
pm2 restart ai-admin-worker --max-memory-restart 300M
```

## Success Metrics

- [ ] < 5s average response time
- [ ] > 95% success rate
- [ ] < 1% error rate
- [ ] > 99% uptime

## Sign-off

- [ ] Development team ✅
- [ ] QA team ✅
- [ ] Operations team ✅
- [ ] Business owner ✅

---

**Launch Date**: ___________
**Version**: 2.0.0
**Responsible**: ___________