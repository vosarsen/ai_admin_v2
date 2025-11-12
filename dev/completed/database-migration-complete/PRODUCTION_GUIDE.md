# Production Guide: Operational Details

**Last Updated:** 2025-11-12
**Production Status:** ✅ LIVE on Timeweb PostgreSQL
**Uptime:** 17+ hours (since Nov 11, 13:30 MSK)
**Error Rate:** 0%

---

## Current Production Status

### Database Backend

**Active:** ✅ Timeweb PostgreSQL (via Repository Pattern)
**Status:** STABLE
**Configuration:** `USE_REPOSITORY_PATTERN=true`

### Service Health

| Service | Status | Uptime | Memory | CPU |
|---------|--------|--------|--------|-----|
| ai-admin-worker-v2 | ✅ online | 17h+ | 81 MB | 0% |
| ai-admin-api | ✅ online | 17h+ | 145 MB | 0% |
| baileys-whatsapp-service | ✅ online | 17h+ | 89 MB | 0% |
| ai-admin-booking-monitor | ✅ online | 17h+ | 124 MB | 0% |
| ai-admin-batch-processor | ✅ online | 17h+ | 73 MB | 0% |
| ai-admin-telegram-bot | ✅ online | 17h+ | 59 MB | 0% |
| whatsapp-backup-service | ✅ online | 17h+ | 91 MB | 0% |

### Production Metrics

**Performance:**
- Message Processing: 5.5s (within 10s baseline) ✅
- Context Loading: 691ms (faster than 1s baseline) ✅
- Database Queries: <100ms ✅

**Reliability:**
- Error Rate: 0% ✅
- Data Integrity: 100% (1,490/1,490 records) ✅
- WhatsApp Connection: Stable ✅

---

## Connection Strings & Credentials

### Timeweb PostgreSQL (PRODUCTION)

**Connection Details:**
```bash
Host: a84c973324fdaccfc68d929d.twc1.net
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0

# SSL Required
SSL Mode: verify-full
SSL Certificate: /root/.cloud-certs/root.crt
```

**Connection String:**
```
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full
```

**psql Connection:**
```bash
psql "host=a84c973324fdaccfc68d929d.twc1.net port=5432 dbname=default_db user=gen_user sslmode=verify-full sslrootcert=/root/.cloud-certs/root.crt"
```

### Production Server

**SSH Access:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
```

**Server Details:**
- Location: Moscow datacenter
- IP: 46.149.70.219
- Path: /opt/ai-admin
- OS: Ubuntu

---

## Feature Flags Configuration

### Current Production Settings

**File:** `/opt/ai-admin/.env`

```bash
# Database Backend (ACTIVE)
USE_REPOSITORY_PATTERN=true
USE_LEGACY_SUPABASE=false
TIMEWEB_IS_PRIMARY=true

# PostgreSQL Connection
POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
POSTGRES_MAX_CONNECTIONS=3
POSTGRES_IDLE_TIMEOUT=30000
POSTGRES_CONNECTION_TIMEOUT=10000
PGSSLROOTCERT=/root/.cloud-certs/root.crt

# Debugging (OPTIONAL)
LOG_DATABASE_CALLS=false  # Set to true for query logging

# Error Tracking
SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936
SENTRY_ENVIRONMENT=production
```

### Backup Configuration

**Backup .env (for rollback):**
```bash
/opt/ai-admin/.env.backup-phase5-20251111-131000
```

---

## Monitoring & Health Checks

### Health Endpoints

**1. General Health Check:**
```bash
curl http://46.149.70.219:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-12T10:30:00.000Z",
  "uptime": 62100,
  "database": "Timeweb PostgreSQL (via Repository Pattern)",
  "services": {
    "whatsapp": "connected",
    "database": "connected",
    "redis": "connected"
  }
}
```

**2. WhatsApp Health:**
```bash
curl http://46.149.70.219:3000/health/whatsapp
```

**Expected Response:**
```json
{
  "status": "healthy",
  "auth_records": 1,
  "total_keys": 1127,
  "expired_keys": 0,
  "thresholds": {
    "warning": 100,
    "critical": 250
  },
  "last_check": "2025-11-12T10:30:00.000Z"
}
```

**3. Database Health:**
```bash
curl http://46.149.70.219:3000/health/database
```

**Expected Response:**
```json
{
  "status": "connected",
  "backend": "Timeweb PostgreSQL (via Repository Pattern)",
  "latency": 2,
  "pool": {
    "total": 3,
    "idle": 2,
    "waiting": 0
  }
}
```

### PM2 Monitoring

**Check Service Status:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
```

**View Logs:**
```bash
# All services
pm2 logs --lines 50

# Specific service
pm2 logs ai-admin-worker-v2 --lines 50

# Error logs only
pm2 logs --err --lines 50

# Follow live logs
pm2 logs --lines 0
```

**Restart Service:**
```bash
pm2 restart ai-admin-worker-v2
# or
pm2 restart all
```

### Database Monitoring

**Check Connections:**
```sql
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'default_db';
```

**Expected:** 7-21 connections (7 services × 3 max each)

**Check Query Performance:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Check Table Sizes:**
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback Procedures

### Emergency Rollback to Supabase (< 5 minutes)

**When to Rollback:**
- Critical errors detected (error rate >1%)
- Data corruption suspected
- Performance degradation (>10s message processing)
- Database connection issues

**Rollback Steps:**

```bash
# 1. SSH to production
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Navigate to project
cd /opt/ai-admin

# 3. Restore backup .env
cp .env.backup-phase5-20251111-131000 .env

# 4. Verify configuration
grep "USE_REPOSITORY_PATTERN" .env
# Should show: USE_REPOSITORY_PATTERN=false

# 5. Restart all services
pm2 restart all

# 6. Verify rollback
pm2 logs --lines 50 | grep -i backend
# Should see: "Using legacy Supabase"

# 7. Check health
curl http://localhost:3000/health

# 8. Verify services online
pm2 status

# 9. Test message processing
# Send test message to 89686484488

# 10. Monitor for 10 minutes
pm2 logs --lines 0
```

**Expected Downtime:** < 2 minutes

**Verification Checklist:**
- [ ] All 7 services online
- [ ] WhatsApp connected
- [ ] Backend shows "Supabase" in logs
- [ ] Test message processed successfully
- [ ] No critical errors in logs

### Rollback if Database Unavailable

```bash
# If Timeweb PostgreSQL is unreachable:

# 1. Check database connectivity
psql "host=a84c973324fdaccfc68d929d.twc1.net ..." -c "SELECT NOW();"

# 2. If fails, rollback to Supabase immediately
cp .env.backup-phase5-20251111-131000 .env
pm2 restart all

# 3. Alert team
# 4. Investigate database issue
# 5. Don't switch back until issue resolved
```

---

## Common Operational Tasks

### Restart Services After .env Changes

```bash
# After modifying .env:
pm2 restart all

# Verify changes applied
pm2 logs --lines 50 | grep -i "Repository Pattern"
# Should see initialization message
```

### Enable Query Logging (Debugging)

```bash
# Edit .env
LOG_DATABASE_CALLS=true

# Restart services
pm2 restart all

# View query logs
pm2 logs ai-admin-worker-v2 | grep "Query:"
```

### Clear Redis Cache

```bash
# If context issues:
redis-cli -h localhost -p 6379 FLUSHDB

# Or specific keys:
redis-cli -h localhost -p 6379 KEYS "context:*" | xargs redis-cli DEL
```

### Backup Database

```bash
# Export all tables
pg_dump "host=a84c973324fdaccfc68d929d.twc1.net port=5432 dbname=default_db user=gen_user sslmode=verify-full" \
  > /root/backups/timeweb-backup-$(date +%Y%m%d-%H%M%S).sql

# Compress backup
gzip /root/backups/timeweb-backup-*.sql
```

### Verify Data Integrity

```bash
# Check row counts
psql ... -c "
SELECT
  'clients' as table, COUNT(*) as count FROM clients
UNION ALL
SELECT 'services', COUNT(*) FROM services
UNION ALL
SELECT 'staff', COUNT(*) FROM staff
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings;
"

# Expected:
# clients: 1304
# services: 63
# staff: 12
# bookings: 45+
```

---

## Performance Optimization

### Connection Pool Tuning

**Current Settings (Safe):**
```bash
POSTGRES_MAX_CONNECTIONS=3  # 7 services × 3 = 21 total
POSTGRES_IDLE_TIMEOUT=30000  # 30s
POSTGRES_CONNECTION_TIMEOUT=10000  # 10s
```

**If Experiencing Connection Issues:**
```bash
# Increase per-service max (cautiously)
POSTGRES_MAX_CONNECTIONS=5  # 7 services × 5 = 35 total

# Restart services
pm2 restart all

# Monitor connection count
psql ... -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'default_db';"
# Should stay < 40
```

### Query Performance Monitoring

```bash
# Enable pg_stat_statements (if not already)
psql ... -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# View slowest queries
psql ... -c "
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

---

## Troubleshooting

### Issue: High Message Processing Time (>10s)

**Check:**
1. Database latency: `psql ... -c "SELECT NOW();"` (should be <10ms)
2. Connection pool: View PM2 logs for "Connection timeout" errors
3. AI provider (DeepSeek): Check external API latency
4. Redis cache: Verify Redis responding: `redis-cli PING`

**Fix:**
- If database latency high: Check Timeweb status
- If connection timeouts: Increase `POSTGRES_CONNECTION_TIMEOUT`
- If AI slow: Check DeepSeek API status
- If Redis slow: Restart Redis service

### Issue: "Too Many Connections" Error

**Check:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'default_db';
```

**If > 30 connections:**
```bash
# Reduce max connections
sed -i 's/POSTGRES_MAX_CONNECTIONS=.*/POSTGRES_MAX_CONNECTIONS=2/' /opt/ai-admin/.env
pm2 restart all
```

**If Still Failing:**
- Check for connection leaks in code
- Verify `afterAll` closes pools in tests
- Check for hung queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';`

### Issue: WhatsApp Disconnected

**Check:**
```bash
curl http://localhost:3000/health/whatsapp

# If unhealthy, check Baileys logs
pm2 logs baileys-whatsapp-service --lines 50
```

**Common Causes:**
1. Expired session (need to re-scan QR)
2. Too many expired keys (run cleanup)
3. Database connection issue (check Baileys data accessible)

**Fix:**
```bash
# Cleanup expired keys
node scripts/cleanup-whatsapp-keys.js --company-id 962302

# Restart Baileys service
pm2 restart baileys-whatsapp-service

# If still disconnected, may need QR re-scan
```

### Issue: "Repository Pattern initialized" Not Showing

**Check:**
```bash
grep "USE_REPOSITORY_PATTERN" /opt/ai-admin/.env
# Should show: USE_REPOSITORY_PATTERN=true

pm2 logs ai-admin-worker-v2 --lines 50 | grep -i "Repository Pattern"
# Should see initialization message
```

**If Not Showing:**
```bash
# Verify .env loaded
pm2 restart all

# Check for syntax errors in .env
cat /opt/ai-admin/.env | grep -v "^#" | grep "="
```

---

## Alerts & Notifications

### Sentry Alerts

**Dashboard:** https://sentry.io/organizations/.../projects/...

**Alert Rules:**
1. **Critical Errors:** Email + Slack immediately
2. **Error Rate >1%:** Email within 5 minutes
3. **Performance Degradation:** Email if P95 >1s

**To View:**
```bash
# Open Sentry dashboard
# Filter by: environment:production, backend:Timeweb
# View error trends, stack traces, user impact
```

### PM2 Monitoring

**Enable PM2 Plus (Optional):**
```bash
pm2 link <secret> <public>
pm2 install pm2-server-monit
```

**Metrics Tracked:**
- CPU usage
- Memory usage
- Event loop lag
- HTTP latency
- Custom metrics

---

## Maintenance Windows

### Scheduled Maintenance

**Recommended Schedule:**
- **Weekly:** Sunday 02:00-04:00 MSK (low traffic)
- **Monthly:** First Sunday of month (larger updates)

**Maintenance Checklist:**
```bash
# 1. Notify users (24h advance)

# 2. Create backup
pg_dump ... > /root/backups/pre-maintenance-$(date +%Y%m%d).sql

# 3. Backup .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# 4. Update code
git pull origin main

# 5. Install dependencies
npm ci

# 6. Run migrations (if any)
npm run migrate

# 7. Restart services
pm2 restart all

# 8. Verify health
curl http://localhost:3000/health

# 9. Monitor for 1 hour
pm2 logs --lines 0

# 10. Send all-clear notification
```

---

## Security

### SSL Certificate

**Location:** `/root/.cloud-certs/root.crt`

**Renewal:** Managed by Timeweb (auto-renewal)

**Verification:**
```bash
openssl s_client -connect a84c973324fdaccfc68d929d.twc1.net:5432 -showcerts < /dev/null
```

### Database Credentials Rotation

**If Credentials Compromised:**
```bash
# 1. Login to Timeweb panel
# 2. Generate new password
# 3. Update .env
sed -i 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=NEW_PASSWORD/' /opt/ai-admin/.env

# 4. Restart services
pm2 restart all

# 5. Verify connection
psql "host=... user=gen_user password=NEW_PASSWORD ..." -c "SELECT NOW();"
```

### Access Control

**Who Has Access:**
- Production Server SSH: DevOps team only
- Timeweb Dashboard: Admin only
- Sentry Dashboard: Dev team (read-only)

**Audit Log:**
```bash
# SSH access logs
tail -f /var/log/auth.log

# Database access (if audit enabled)
psql ... -c "SELECT * FROM pg_stat_activity WHERE usename = 'gen_user' ORDER BY query_start DESC LIMIT 10;"
```

---

## Disaster Recovery

### Scenarios & Procedures

**Scenario 1: Database Corruption**
```bash
# 1. Rollback to Supabase immediately
cp .env.backup-phase5-20251111-131000 .env
pm2 restart all

# 2. Restore from backup
psql ... < /root/backups/timeweb-backup-latest.sql

# 3. Verify data integrity
# 4. Test with single service
# 5. Switch back when verified
```

**Scenario 2: Complete Server Failure**
```bash
# 1. Provision new server
# 2. Restore code from GitHub
git clone https://github.com/username/ai_admin_v2.git

# 3. Restore .env from backup
# 4. Install dependencies
npm ci

# 5. Verify database accessible
psql ... -c "SELECT NOW();"

# 6. Start services
pm2 start ecosystem.config.js

# 7. Update DNS (if needed)
```

**Scenario 3: Data Loss**
```bash
# 1. Stop all writes
pm2 stop all

# 2. Assess data loss
# Compare Supabase vs Timeweb row counts

# 3. Restore from backup
pg_dump ... | psql ...

# 4. Resume operations
pm2 start all
```

**Recovery Time Objective (RTO):** < 1 hour
**Recovery Point Objective (RPO):** < 1 hour (daily backups)

---

## Documentation References

**Related Guides:**
- [MIGRATION_MASTER_GUIDE.md](./MIGRATION_MASTER_GUIDE.md) - Complete timeline
- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) - Technical details
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Test suite
- [LESSONS_LEARNED.md](./LESSONS_LEARNED.md) - Best practices

**External Documentation:**
- PostgreSQL: https://www.postgresql.org/docs/
- PM2: https://pm2.keymetrics.io/docs/
- Sentry: https://docs.sentry.io/

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Production Status:** ✅ STABLE (17+ hours uptime, 0% errors)
