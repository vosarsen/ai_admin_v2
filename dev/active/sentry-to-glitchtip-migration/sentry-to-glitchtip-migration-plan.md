# Sentry to GlitchTip Migration Plan

**Last Updated:** 2025-11-19
**Status:** Planning
**Owner:** AI Admin v2 Team
**Estimated Duration:** 1 week (12-16 hours active work + 48h testing)

---

## Executive Summary

### Objective
Migrate from Sentry SaaS ($348/year) to GlitchTip self-hosted (free) to reduce costs while maintaining full error tracking capabilities.

### Key Benefits
- 💰 **Cost Savings:** $348/year → $0 (40,800 RUB/year)
- 🔒 **Data Control:** Full ownership of error data
- ⚡ **Zero Code Changes:** Sentry SDK compatible (only DSN changes)
- 🎁 **Bonus Feature:** Built-in uptime monitoring
- 📊 **Resource Efficient:** Fits in existing 2GB RAM server

### Approach
Phased migration with parallel testing to ensure zero downtime and easy rollback.

### Risk Level
**LOW** - Rollback possible in <5 minutes by reverting DSN change

### Success Criteria
- ✅ 100% error capture rate
- ✅ RAM usage <80% (target: ~49%)
- ✅ Zero production incidents during migration
- ✅ Team successfully using GlitchTip UI

---

## Current State Analysis

### Sentry Integration Points

**Core Integration:**
- **File:** `src/instrument.js` - Centralized Sentry initialization
- **Entry Points:**
  - `src/index.js` (API server)
  - `src/workers/index-v2.js` (Worker process)
- **SDK Version:** @sentry/node v10.24.0
- **Configuration:** Environment variable `SENTRY_DSN` in `.env`

**Error Capture Locations:**
- `src/database/postgres.js` - Database error handlers (4 locations)
- `src/repositories/BaseRepository.js` - Repository errors (4 locations)
- `src/integrations/whatsapp/auth-state-timeweb.js` - WhatsApp errors (6 locations)
- Additional scattered `Sentry.captureException()` calls (50+ total)

### Production Server State

**Server:** 46.149.70.219

**Resources:**
- RAM: 1.9 GB total
  - Used: 945 MB (28% utilization)
  - Free: ~1 GB
- CPU: 2 cores @ 3.3GHz
  - Load average: 0.02-0.10 (idle)
- Disk: 30 GB total
  - Used: 12 GB (39%)
  - Free: 18 GB

**Running Services (PM2):**
1. `ai-admin-api` - 190.5 MB RAM
2. `ai-admin-worker-v2` - 103.4 MB RAM
3. `ai-admin-batch-processor` - 66.0 MB RAM
4. `ai-admin-telegram-bot` - 79.3 MB RAM
5. `baileys-whatsapp-service` - 110.4 MB RAM
**Total PM2:** ~549 MB

**Infrastructure Gaps:**
- ❌ Docker NOT installed
- ❌ Docker Compose NOT installed
- ✅ Port 8080 available (only 3000 in use)
- ✅ PostgreSQL + Redis already available

---

## Proposed Future State

### GlitchTip Architecture

**Components:**
```
┌─────────────────────────────────────┐
│  GlitchTip (4 Docker Containers)    │
├─────────────────────────────────────┤
│  1. Web (Django)      ~100 MB       │
│  2. Worker (Celery)   ~100 MB       │
│  3. PostgreSQL         ~100 MB       │
│  4. Redis              ~50 MB        │
├─────────────────────────────────────┤
│  Total:               ~350-400 MB    │
└─────────────────────────────────────┘
```

**Resource Projection:**
- Current usage: 28% (945 MB / 1,900 MB)
- + GlitchTip: +21% (~400 MB)
- **New total: ~49% utilization**
- **Remaining headroom: 21% (~400 MB)**

**Network:**
- Port: 8080 (internal)
- URL: `http://46.149.70.219:8080`
- DSN: `http://[key]@46.149.70.219:8080/1`

### Code Changes Required

**ONLY ONE LINE:**
```bash
# File: /opt/ai-admin/.env
# Change this:
SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936

# To this:
SENTRY_DSN=http://[glitchtip_key]@46.149.70.219:8080/1
```

**All existing code remains unchanged:**
- `src/instrument.js` - No changes
- `Sentry.captureException()` calls - No changes
- All 50+ error handlers - No changes

---

## Implementation Phases

### Phase 0: Preparation & Docker Installation

**Duration:** 2-3 hours
**Effort:** M (Medium)
**Risk:** Low

#### Tasks

**0.1 Install Docker** (30 min, S)
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker
```
**Acceptance:** `docker --version` returns version info

**0.2 Install Docker Compose** (15 min, S)
```bash
# Already included in Docker install script above
docker-compose --version
```
**Acceptance:** `docker-compose --version` returns version info

**0.3 Verify Port Availability** (10 min, S)
```bash
netstat -tlnp | grep 8080
# Should return empty (port free)
```
**Acceptance:** Port 8080 is not in use

**0.4 Create Backup** (30 min, S)
```bash
# Backup current .env
cp /opt/ai-admin/.env /opt/ai-admin/.env.backup.$(date +%Y%m%d)

# Backup Sentry DSN
grep SENTRY_DSN /opt/ai-admin/.env > /tmp/sentry_dsn_backup.txt
```
**Acceptance:** Backup files exist and contain correct data

**0.5 Document Current State** (30 min, S)
```bash
# Capture current metrics
pm2 status > /tmp/pm2_status_before.txt
free -h > /tmp/memory_before.txt
df -h > /tmp/disk_before.txt
```
**Acceptance:** All state files created

**0.6 Reserve Resources** (15 min, S)
- Review PM2 services
- Ensure 400 MB RAM can be allocated
- Check disk space for Docker images (~2 GB)

**Acceptance:** Confirmed 400 MB RAM + 2 GB disk available

#### Dependencies
- SSH access to production server
- sudo/root privileges

#### Rollback
- Uninstall Docker if issues: `apt-get remove docker-ce docker-ce-cli`
- No impact on running services

---

### Phase 1: Local/Staging Testing

**Duration:** 4-6 hours
**Effort:** L (Large)
**Risk:** Low (isolated testing)

#### Tasks

**1.1 Deploy GlitchTip Locally** (1 hour, M)
```bash
# On local machine or staging server
mkdir -p ~/glitchtip-test && cd ~/glitchtip-test

# Download docker-compose
wget https://github.com/glitchtip/glitchtip-docker-compose/releases/latest/download/docker-compose.yml

# Create .env configuration
cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
GLITCHTIP_DOMAIN=http://localhost:8080
DEFAULT_FROM_EMAIL=noreply@test.com
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
ENABLE_ORGANIZATION_CREATION=true
ENABLE_USER_REGISTRATION=false
CELERY_WORKER_AUTOSCALE=1,3
EOF

# Start services
docker-compose up -d

# Wait for startup
sleep 30

# Check status
docker-compose ps
docker-compose logs -f
```
**Acceptance:** All 4 containers running, UI accessible at localhost:8080

**1.2 Create Test Project** (30 min, S)
1. Access UI at `http://localhost:8080`
2. Create superuser: `docker-compose exec web ./manage.py createsuperuser`
3. Login to UI
4. Create organization "Test Org"
5. Create project "AI Admin Test"
6. Get DSN key from project settings

**Acceptance:** DSN key obtained, looks like `http://[key]@localhost:8080/1`

**1.3 Test Sentry SDK Compatibility** (1 hour, M)
```javascript
// test-sentry-compat.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'http://[your-key]@localhost:8080/1',
  environment: 'test',
  release: 'test@1.0.0',
});

// Test 1: Basic error
Sentry.captureException(new Error('Test error 1: Basic'));

// Test 2: With context
Sentry.withScope((scope) => {
  scope.setUser({ id: 'test-123', email: 'test@example.com' });
  scope.setTag('test-type', 'context');
  Sentry.captureException(new Error('Test error 2: With context'));
});

// Test 3: With breadcrumbs
Sentry.addBreadcrumb({
  category: 'test',
  message: 'Test breadcrumb before error',
  level: 'info',
});
Sentry.captureException(new Error('Test error 3: With breadcrumbs'));

// Wait for flush
setTimeout(() => {
  console.log('Tests sent. Check GlitchTip UI.');
  process.exit(0);
}, 2000);
```

```bash
node test-sentry-compat.js
```

**Acceptance:** All 3 test errors appear in GlitchTip UI with correct context

**1.4 Test Real Code Patterns** (2 hours, L)
Copy actual error handling patterns from codebase:

```javascript
// test-real-patterns.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'http://[your-key]@localhost:8080/1',
  environment: 'test',
});

// Pattern 1: Database error (from postgres.js)
async function testDatabaseError() {
  try {
    throw new Error('ECONNREFUSED - Database connection failed');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'database',
        operation: 'connect',
      },
      extra: {
        host: 'localhost',
        port: 5432,
      },
    });
  }
}

// Pattern 2: Repository error (from BaseRepository.js)
async function testRepositoryError() {
  try {
    throw new Error('Unique constraint violation');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        repository: 'ClientRepository',
        operation: 'upsert',
      },
      extra: {
        filters: { phone: '1234567890' },
      },
    });
  }
}

// Pattern 3: WhatsApp error (from auth-state-timeweb.js)
async function testWhatsAppError() {
  try {
    throw new Error('Session not found');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'whatsapp',
        companyId: '962302',
      },
    });
  }
}

// Run tests
(async () => {
  await testDatabaseError();
  await testRepositoryError();
  await testWhatsAppError();

  setTimeout(() => {
    console.log('Real pattern tests sent.');
    process.exit(0);
  }, 2000);
})();
```

**Acceptance:**
- All 3 error types captured
- Tags and extra context visible in UI
- Errors grouped appropriately

**1.5 Performance & Resource Testing** (30 min, M)
```bash
# Monitor resource usage
docker stats --no-stream

# Check memory per container
docker stats --format "table {{.Name}}\t{{.MemUsage}}"

# Stress test: Send 100 errors
for i in {1..100}; do node test-sentry-compat.js & done
wait

# Check GlitchTip handled all
# Check resource usage didn't spike
```

**Acceptance:**
- All 100 errors captured
- RAM usage <500 MB total
- No crashes or errors in logs

**1.6 Uptime Monitoring Test** (30 min, S)
1. Navigate to Uptime in GlitchTip UI
2. Add uptime check: `http://example.com`
3. Verify check runs every 60 seconds
4. Verify alerts work (break URL, check alert)

**Acceptance:** Uptime monitoring functional (bonus feature!)

#### Dependencies
- Docker installed locally or on staging
- Node.js and @sentry/node package
- Access to test environment

#### Rollback
- `docker-compose down` to remove test environment
- No impact on production

---

### Phase 2: Production Deployment

**Duration:** 2-3 hours
**Effort:** M (Medium)
**Risk:** Low (no cutover yet)

#### Tasks

**2.1 Create Production Directory** (5 min, S)
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

mkdir -p /opt/glitchtip
cd /opt/glitchtip
```
**Acceptance:** Directory exists at `/opt/glitchtip`

**2.2 Download Docker Compose Config** (10 min, S)
```bash
cd /opt/glitchtip

# Download official docker-compose
wget https://github.com/glitchtip/glitchtip-docker-compose/releases/latest/download/docker-compose.yml

# Verify download
cat docker-compose.yml
```
**Acceptance:** `docker-compose.yml` exists and contains 4 services

**2.3 Create Production .env** (15 min, S)
```bash
cat > .env << EOF
# Security
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Domain
GLITCHTIP_DOMAIN=http://46.149.70.219:8080

# Email (console for now, configure SMTP later)
DEFAULT_FROM_EMAIL=noreply@ai-admin.com
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Features
ENABLE_ORGANIZATION_CREATION=true
ENABLE_USER_REGISTRATION=false

# Performance tuning
CELERY_WORKER_AUTOSCALE=1,3
CELERY_WORKER_MAX_TASKS_PER_CHILD=10000

# Environment
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgres://postgres:$(grep POSTGRES_PASSWORD .env | cut -d= -f2)@postgres:5432/postgres

# Optional: Enable SSL later
# ENABLE_SSL=True
EOF

# Secure the file
chmod 600 .env
```
**Acceptance:** `.env` file created with secure permissions

**2.4 Start GlitchTip Services** (30 min, M)
```bash
cd /opt/glitchtip

# Pull images
docker-compose pull

# Start in detached mode
docker-compose up -d

# Wait for services to initialize
sleep 60

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```
**Acceptance:**
- All 4 containers show "Up" status
- No errors in logs
- Web service healthy

**2.5 Create Superuser** (10 min, S)
```bash
cd /opt/glitchtip

docker-compose exec web ./manage.py createsuperuser
# Username: admin
# Email: admin@ai-admin.com
# Password: [secure password - save in password manager]
```
**Acceptance:** Superuser created successfully

**2.6 Access UI and Create Project** (30 min, M)
1. Open browser: `http://46.149.70.219:8080`
2. Login with superuser credentials
3. Create organization "AI Admin"
4. Create project "AI Admin v2 Production"
5. Navigate to Settings → Client Keys
6. Copy DSN (format: `http://[key]@46.149.70.219:8080/1`)
7. Save DSN to `/tmp/glitchtip_dsn.txt` for later use

**Acceptance:**
- UI accessible
- Organization and project created
- DSN key obtained and saved

**2.7 Resource Monitoring Setup** (15 min, S)
```bash
# Create monitoring script
cat > /opt/glitchtip/monitor.sh << 'EOF'
#!/bin/bash
echo "=== GlitchTip Container Stats ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Overall System Resources ==="
free -h
df -h /opt

echo ""
echo "=== GlitchTip Service Status ==="
docker-compose ps
EOF

chmod +x /opt/glitchtip/monitor.sh
```

**Usage:**
```bash
/opt/glitchtip/monitor.sh
```
**Acceptance:** Monitoring script works and shows resource usage

**2.8 Verify Production Deployment** (30 min, M)
```bash
# Health check
curl http://46.149.70.219:8080/api/0/health/

# Test error submission
cat > /tmp/test-glitchtip.js << 'EOF'
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'http://[your-key]@46.149.70.219:8080/1',
  environment: 'production-test',
});

Sentry.captureException(new Error('Production deployment test'));

setTimeout(() => {
  console.log('Test error sent to GlitchTip');
  process.exit(0);
}, 2000);
EOF

cd /opt/ai-admin
node /tmp/test-glitchtip.js
```

Check UI for test error.

**Acceptance:**
- Health endpoint returns 200 OK
- Test error appears in GlitchTip UI
- All services stable

#### Dependencies
- Phase 0 completed (Docker installed)
- Port 8080 available
- 400 MB RAM available

#### Rollback
```bash
cd /opt/glitchtip
docker-compose down
# Removes all containers, networks
# Data volumes preserved
```

---

### Phase 3: Parallel Running (Testing Period)

**Duration:** 24-48 hours
**Effort:** S (Small - mostly monitoring)
**Risk:** Low

#### Tasks

**3.1 Configure Dual Reporting (Optional)** (30 min, S)

If you want both Sentry and GlitchTip to receive errors simultaneously:

```javascript
// src/instrument.js (temporary dual reporting)
const Sentry = require('@sentry/node');

// Primary: Sentry SaaS (current)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // ... existing config
});

// Secondary: GlitchTip (testing)
const SentryGlitchTip = require('@sentry/node');
SentryGlitchTip.init({
  dsn: process.env.GLITCHTIP_DSN, // Add this to .env
  environment: process.env.NODE_ENV || 'development',
  // ... same config
});

// Export both
module.exports = {
  Sentry,
  SentryGlitchTip
};
```

**Alternative (Simpler):** Just monitor GlitchTip manually by triggering test errors periodically.

**Acceptance:** (If dual reporting) Both services receive errors

**3.2 Monitoring Schedule** (48 hours, S)

Set reminders to check every 4-6 hours:

```bash
# Check script
cat > /tmp/check-glitchtip.sh << 'EOF'
#!/bin/bash
echo "=== $(date) ==="
echo "GlitchTip Status:"
docker-compose -f /opt/glitchtip/docker-compose.yml ps

echo ""
echo "Resource Usage:"
docker stats --no-stream | grep glitchtip

echo ""
echo "Recent Errors in GlitchTip:"
echo "Check UI: http://46.149.70.219:8080"
echo ""
EOF

chmod +x /tmp/check-glitchtip.sh
```

**Monitoring Checklist:**
- [ ] All containers still running
- [ ] RAM usage <80%
- [ ] No errors in `docker-compose logs`
- [ ] Errors appearing in GlitchTip UI
- [ ] Disk space not growing rapidly

**3.3 Comparison Testing** (2 hours spread over 48h, M)

Compare Sentry SaaS vs GlitchTip:

| Aspect | Sentry SaaS | GlitchTip | Notes |
|--------|-------------|-----------|-------|
| Error capture | ✅ | ✅ | |
| Grouping quality | ✅ | ✅ | |
| Stack traces | ✅ | ✅ | |
| Breadcrumbs | ✅ | ✅ | |
| User context | ✅ | ✅ | |
| Tags/extras | ✅ | ✅ | |
| Search | ✅ | ⚠️ Basic | Acceptable |
| UI speed | ✅ Fast | ✅ Fast | |
| Alerts | ✅ | ✅ | |
| Uptime monitoring | ❌ | ✅ Bonus! | GlitchTip advantage |

**Acceptance:** GlitchTip performs comparably for all critical features

**3.4 Load Testing** (1 hour, M)

Send burst of errors to test stability:

```bash
# Stress test script
cat > /tmp/stress-test.sh << 'EOF'
#!/bin/bash
echo "Sending 50 errors to GlitchTip..."

for i in {1..50}; do
  node -e "
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn: 'http://[key]@46.149.70.219:8080/1' });
    Sentry.captureException(new Error('Load test error ${i}'));
    setTimeout(() => process.exit(0), 1000);
  " &
done

wait
echo "Done. Check GlitchTip UI and resources."
EOF

chmod +x /tmp/stress-test.sh
/tmp/stress-test.sh
```

Monitor during and after:
```bash
watch -n 5 'docker stats --no-stream | grep glitchtip'
```

**Acceptance:**
- All 50 errors captured
- RAM usage spike <100 MB
- Services remain stable
- No errors in logs

**3.5 24-Hour Stability Check** (monitoring, S)

After 24 hours continuous running:
```bash
# Uptime check
docker-compose ps | grep Up

# Resource check
docker stats --no-stream

# Log check (look for errors/warnings)
docker-compose logs --since 24h | grep -i error

# Count captured errors
# (Check GlitchTip UI - should have recent errors)
```

**Acceptance:**
- All containers up for 24+ hours
- No crashes or restarts
- RAM usage stable
- Error capture working

**3.6 Team Feedback** (30 min, S)

Have team members:
1. Access GlitchTip UI
2. Browse recent errors
3. Test search functionality
4. Review UI/UX
5. Provide feedback

**Acceptance:** Team comfortable with GlitchTip UI

#### Dependencies
- Phase 2 completed (GlitchTip deployed)
- Production errors occurring naturally

#### Rollback
- Stop checking GlitchTip, continue with Sentry
- No changes to production services yet

---

### Phase 4: Production Cutover

**Duration:** 30 minutes
**Effort:** S (Small)
**Risk:** Low (easy rollback)

#### Tasks

**4.1 Pre-Cutover Checklist** (10 min, S)

Verify before proceeding:
```bash
# All systems GO?
cd /opt/glitchtip
docker-compose ps  # All "Up"?
docker stats --no-stream  # RAM <70%?
curl http://46.149.70.219:8080/api/0/health/  # Returns 200?

# Backup current config
cp /opt/ai-admin/.env /opt/ai-admin/.env.pre-glitchtip-$(date +%Y%m%d-%H%M)

# Get GlitchTip DSN ready
cat /tmp/glitchtip_dsn.txt
```

**Acceptance:** All checks pass, ready to proceed

**4.2 Update Environment Variable** (5 min, S)

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

cd /opt/ai-admin

# Edit .env
nano .env

# Change:
# SENTRY_DSN=https://f0e84f5737f802e81f871ed4cad08749@o4510346290069504.ingest.de.sentry.io/4510346297081936
# To:
# SENTRY_DSN=http://[glitchtip-key]@46.149.70.219:8080/1

# Save and exit (Ctrl+X, Y, Enter)
```

**Acceptance:** `grep SENTRY_DSN .env` shows new GlitchTip DSN

**4.3 Restart All Services** (5 min, S)

```bash
cd /opt/ai-admin

# Restart all PM2 services
pm2 restart all

# Verify all started successfully
pm2 status
```

**Acceptance:** All 5 services show "online" status

**4.4 Immediate Verification** (10 min, S)

```bash
# Watch PM2 logs for Sentry initialization
pm2 logs --lines 50 | grep -i sentry

# Should see Sentry initialization with new DSN (partially shown in logs)

# Send test error
curl -X POST http://localhost:3000/api/test/error
# Or trigger manually in app

# Check GlitchTip UI
open http://46.149.70.219:8080
# Should see new error appear within seconds
```

**Acceptance:**
- Services started without errors
- Test error appears in GlitchTip UI
- Sentry SaaS dashboard no longer receiving errors

**4.5 Monitor First Hour** (60 min, S)

Every 15 minutes for the first hour:
```bash
# Service status
pm2 status

# Resource usage
free -h
docker stats --no-stream

# Recent errors in GlitchTip
# Check UI manually

# PM2 logs for any issues
pm2 logs --err --lines 20
```

**Acceptance:**
- All services stable
- Errors flowing to GlitchTip
- No production issues reported

#### Dependencies
- Phase 3 completed (48h stable testing)
- Team approval to proceed
- Low-traffic time window (recommended)

#### Rollback Procedure

If ANY issues detected:

```bash
# 1. Revert DSN (takes 30 seconds)
cd /opt/ai-admin
cp .env.pre-glitchtip-[timestamp] .env

# 2. Restart services
pm2 restart all

# 3. Verify
pm2 status
pm2 logs --lines 20

# 4. Check Sentry SaaS receiving errors again
```

**Rollback Time:** <5 minutes

---

### Phase 5: Cleanup & Finalization

**Duration:** 1 hour
**Effort:** S (Small)
**Risk:** None

#### Tasks

**5.1 24-Hour Post-Cutover Monitoring** (24 hours, S)

Monitor for full 24 hours after cutover:

```bash
# Daily check script
cat > /opt/glitchtip/daily-check.sh << 'EOF'
#!/bin/bash
echo "=== Daily GlitchTip Health Check ==="
echo "Date: $(date)"

echo ""
echo "Container Status:"
cd /opt/glitchtip
docker-compose ps

echo ""
echo "Resource Usage:"
docker stats --no-stream

echo ""
echo "Disk Usage:"
df -h /opt/glitchtip

echo ""
echo "PM2 Services:"
pm2 status

echo ""
echo "Recent Errors Count:"
echo "Check UI: http://46.149.70.219:8080"
EOF

chmod +x /opt/glitchtip/daily-check.sh
```

**Acceptance:** No issues detected over 24 hours

**5.2 Cancel Sentry Subscription** (15 min, S)

1. Login to Sentry.io
2. Navigate to Settings → Subscription
3. Cancel subscription
4. Confirm cancellation
5. Download final invoice/receipt
6. Archive Sentry project data (optional)

**Acceptance:** Subscription cancelled, confirmation email received

**5.3 Update Documentation** (30 min, M)

Create `/opt/ai-admin/docs/ERROR_TRACKING.md`:

```markdown
# Error Tracking with GlitchTip

## Access
- **URL:** http://46.149.70.219:8080
- **Login:** admin@ai-admin.com
- **Project:** AI Admin v2 Production

## Quick Start
1. Login to GlitchTip UI
2. Navigate to "Issues" to see recent errors
3. Click error to see details, stack trace, breadcrumbs
4. Use filters to search errors

## Common Tasks

### Search Errors
- Filter by environment: `environment:production`
- Filter by tag: `tag:component:database`
- Filter by date: Use date picker

### Create Alerts
1. Settings → Alerts
2. Add new alert rule
3. Configure conditions (error count, specific errors)
4. Set notification channel (email/webhook)

### Uptime Monitoring
1. Navigate to "Uptime" tab
2. Add new check
3. Enter URL to monitor
4. Set check interval

## Troubleshooting

### Errors Not Appearing
1. Check DSN in `/opt/ai-admin/.env`
2. Restart PM2 services: `pm2 restart all`
3. Check GlitchTip logs: `cd /opt/glitchtip && docker-compose logs -f`

### GlitchTip Down
1. Check containers: `docker-compose ps`
2. Restart if needed: `docker-compose restart`
3. Check resources: `docker stats`

### Rollback to Sentry
1. Restore old DSN from `/opt/ai-admin/.env.pre-glitchtip-[date]`
2. Restart PM2: `pm2 restart all`

## Maintenance

### Backup
Run daily at 2 AM (crontab):
```bash
0 2 * * * cd /opt/glitchtip && docker-compose exec -T postgres pg_dump -U postgres > /backups/glitchtip_$(date +\%Y\%m\%d).sql
```

### Updates
```bash
cd /opt/glitchtip
docker-compose pull
docker-compose up -d
```

### Resource Monitoring
```bash
/opt/glitchtip/monitor.sh
```
```

**Acceptance:** Documentation created and accessible

**5.4 Setup Automated Backups** (20 min, M)

```bash
# Create backup directory
mkdir -p /backups/glitchtip
chmod 700 /backups/glitchtip

# Create backup script
cat > /opt/glitchtip/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/glitchtip"
DATE=$(date +%Y%m%d)
BACKUP_FILE="${BACKUP_DIR}/glitchtip_${DATE}.sql"

# Backup PostgreSQL
cd /opt/glitchtip
docker-compose exec -T postgres pg_dump -U postgres > "${BACKUP_FILE}"

# Compress
gzip "${BACKUP_FILE}"

# Keep last 30 days
find "${BACKUP_DIR}" -name "glitchtip_*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
EOF

chmod +x /opt/glitchtip/backup.sh

# Test backup
/opt/glitchtip/backup.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/glitchtip/backup.sh") | crontab -
```

**Acceptance:** Backup runs successfully, added to crontab

**5.5 Configure Alerts** (15 min, S)

In GlitchTip UI:
1. Settings → Alerts
2. Create alert "Critical Errors"
   - Condition: Event count > 10 in 1 hour
   - Notification: Email to admin@ai-admin.com
3. Create alert "New Issues"
   - Condition: New issue created
   - Notification: Email to team

**Acceptance:** Test alerts fire correctly

**5.6 Team Training** (30 min, M)

Schedule 30-minute session with team:
1. Demo GlitchTip UI navigation
2. Show how to search/filter errors
3. Explain grouping and issue lifecycle
4. Demo uptime monitoring
5. Q&A

**Acceptance:** Team comfortable using GlitchTip

**5.7 Update Runbook** (15 min, S)

Add GlitchTip to operational runbook:
- Monitoring commands
- Restart procedures
- Backup/restore procedures
- Rollback to Sentry (if ever needed)

**Acceptance:** Runbook updated and reviewed

#### Dependencies
- Phase 4 completed (cutover successful)
- 24 hours stable operation

#### Final Verification

Before closing this phase:
- [ ] Sentry subscription cancelled
- [ ] Documentation complete
- [ ] Backups automated
- [ ] Alerts configured
- [ ] Team trained
- [ ] All systems stable

---

## Risk Assessment Matrix

| Risk | Likelihood | Impact | Severity | Mitigation | Rollback |
|------|------------|--------|----------|------------|----------|
| **Docker installation fails** | Low | Medium | LOW | Test on staging first | Uninstall Docker, no impact |
| **Port 8080 conflict** | Very Low | Low | LOW | Check port before deploy | Use different port |
| **GlitchTip resource spike** | Low | High | MEDIUM | Set CELERY autoscale, monitor | Rollback DSN |
| **Errors not captured** | Very Low | High | MEDIUM | Parallel testing 48h | Rollback DSN immediately |
| **Database disk full** | Low | High | MEDIUM | Monitor disk, set retention | Clean old data, add disk |
| **Service crashes during cutover** | Very Low | High | MEDIUM | Low-traffic cutover window | Rollback DSN, restart PM2 |
| **Team unfamiliar with UI** | Medium | Low | LOW | Training session | N/A, training issue |
| **Sentry refund not received** | Low | Low | LOW | Cancel early in billing cycle | Follow up with support |

**Overall Risk Level:** LOW

**Key Success Factor:** Parallel testing period (Phase 3) catches issues before production impact

---

## Success Metrics

### Technical Metrics

**Error Tracking:**
- ✅ 100% error capture rate (verified via test errors)
- ✅ Error grouping accuracy >95%
- ✅ Stack traces complete and readable
- ✅ Context (tags, user, breadcrumbs) preserved

**Performance:**
- ✅ GlitchTip response time <200ms for UI
- ✅ Error ingestion latency <5 seconds
- ✅ RAM usage <80% (target: ~49%)
- ✅ CPU usage <50% average
- ✅ Disk growth <500 MB/month

**Reliability:**
- ✅ Uptime >99.5%
- ✅ Zero data loss during migration
- ✅ Zero production incidents caused by migration

### Business Metrics

**Cost:**
- ✅ Sentry subscription cancelled ($348/year saved)
- ✅ No new infrastructure costs (uses existing server)
- ✅ Total savings: 40,800 RUB/year

**Team:**
- ✅ Team trained on GlitchTip UI
- ✅ No increase in error triage time
- ✅ Uptime monitoring bonus feature utilized

**Timeline:**
- ✅ Migration completed within 1 week
- ✅ Zero downtime during migration
- ✅ Rollback capability maintained

---

## Resource Requirements

### Infrastructure

**Server:**
- ✅ Existing: 46.149.70.219 (2GB RAM, 2 CPU cores)
- 🔧 Add: Docker + Docker Compose (Phase 0)
- 📊 Reserve: 400 MB RAM for GlitchTip
- 💾 Reserve: 2-3 GB disk for Docker images + data

**Network:**
- ✅ Port 8080 available (internal)
- ✅ Outbound internet for Docker image downloads

### Access & Permissions

- ✅ SSH key: `~/.ssh/id_ed25519_ai_admin`
- ✅ sudo/root access on production server
- ✅ Sentry.io account access (for cancellation)

### Skills Required

- Docker basics (docker-compose up/down, logs, ps)
- Linux command line (ssh, nano, chmod, crontab)
- PM2 process management (restart, status, logs)
- Basic troubleshooting skills

### Time Investment

**By Phase:**
- Phase 0: 2-3 hours (Docker setup)
- Phase 1: 4-6 hours (local testing)
- Phase 2: 2-3 hours (production deploy)
- Phase 3: 2 hours active + 48h monitoring
- Phase 4: 30 minutes (cutover)
- Phase 5: 1 hour (cleanup)

**Total Active Work:** 12-16 hours
**Total Elapsed Time:** ~1 week (includes 48h testing period)

---

## Timeline & Dependencies

### Week 1: Implementation

```
Day 1 (Mon):
  Phase 0 (2-3h)
  └─> Phase 1 start (2-3h)

Day 2 (Tue):
  Phase 1 complete (2-3h)
  └─> Phase 2 (2-3h)

Day 3 (Wed):
  Phase 3 start (30min setup)
  └─> Monitor every 6h

Day 4 (Thu):
  Phase 3 continue
  └─> Monitor every 6h

Day 5 (Fri):
  Phase 3 complete (48h passed)
  └─> Phase 4 (30min cutover)
  └─> Monitor first hour

Day 6 (Sat):
  Monitor post-cutover

Day 7 (Sun):
  Phase 5 (1h cleanup)
  └─> DONE!
```

### Critical Path

```
Docker Install (Phase 0)
  ↓
Local Testing (Phase 1)
  ↓
Production Deploy (Phase 2)
  ↓
48h Parallel Testing (Phase 3) ← CRITICAL (cannot skip)
  ↓
Production Cutover (Phase 4)
  ↓
24h Monitoring (Phase 5)
  ↓
Cleanup & Cancel Sentry (Phase 5)
```

**Cannot Skip:** Phase 3 (parallel testing) is mandatory to ensure stability

**Optional:** Dual reporting in Phase 3 (can just manually test)

---

## Rollback Procedures

### Quick Rollback (During Phase 4 Cutover)

**Scenario:** Errors not appearing in GlitchTip after cutover

**Time:** <5 minutes

```bash
# 1. SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Restore old .env
cd /opt/ai-admin
cp .env.pre-glitchtip-[timestamp] .env

# 3. Restart PM2 services
pm2 restart all

# 4. Verify
pm2 status
pm2 logs --lines 20 | grep -i sentry

# 5. Check Sentry SaaS receiving errors
# Visit Sentry.io dashboard
```

### Full Rollback (Uninstall GlitchTip)

**Scenario:** Decide to completely remove GlitchTip and stay with Sentry

```bash
# 1. Restore Sentry DSN (if not already done)
cd /opt/ai-admin
cp .env.pre-glitchtip-[timestamp] .env
pm2 restart all

# 2. Stop and remove GlitchTip
cd /opt/glitchtip
docker-compose down -v  # -v removes volumes (data)

# 3. Remove Docker (optional)
systemctl stop docker
apt-get remove docker-ce docker-ce-cli containerd.io

# 4. Clean up files
rm -rf /opt/glitchtip
rm -rf /backups/glitchtip

# 5. Verify production stable
pm2 status
# Check Sentry.io for incoming errors
```

**Data Loss:** GlitchTip error data will be lost (keep Sentry active during parallel testing to avoid this)

---

## Troubleshooting Guide

### GlitchTip Containers Won't Start

**Symptoms:** `docker-compose up -d` fails or containers exit immediately

**Diagnosis:**
```bash
cd /opt/glitchtip
docker-compose logs
```

**Solutions:**
1. **Port conflict:** Change port in docker-compose.yml
2. **Insufficient RAM:** Check `free -h`, stop other services temporarily
3. **Corrupted image:** `docker-compose pull` to re-download
4. **Invalid .env:** Check for syntax errors in .env file

### Errors Not Appearing in GlitchTip

**Symptoms:** Test errors don't show up in UI

**Diagnosis:**
```bash
# Check DSN in application
grep SENTRY_DSN /opt/ai-admin/.env

# Check GlitchTip logs
cd /opt/glitchtip
docker-compose logs -f web

# Check PM2 logs
pm2 logs --lines 50 | grep -i sentry
```

**Solutions:**
1. **Wrong DSN:** Verify DSN matches GlitchTip project
2. **Network issue:** Test `curl http://46.149.70.219:8080` from server
3. **Sentry SDK not initialized:** Check `src/instrument.js` imported first
4. **Firewall:** Ensure port 8080 accessible

### High Memory Usage

**Symptoms:** Docker containers consuming >500 MB RAM

**Diagnosis:**
```bash
docker stats --no-stream
```

**Solutions:**
1. **Too many workers:** Reduce CELERY_WORKER_AUTOSCALE to 1,2
2. **Memory leak:** Restart services: `docker-compose restart`
3. **Large event volume:** Configure retention policies in GlitchTip UI
4. **Database bloat:** Run cleanup: `docker-compose exec web ./manage.py cleanup`

### GlitchTip UI Slow

**Symptoms:** UI takes >3 seconds to load pages

**Diagnosis:**
```bash
# Check CPU/RAM
docker stats

# Check disk I/O
iostat -x 1 5
```

**Solutions:**
1. **High load:** Reduce CELERY workers
2. **Disk full:** Clean old backups, increase retention cleanup
3. **Too many events:** Archive old issues in UI
4. **Database needs tuning:** Increase PostgreSQL shared_buffers

### Docker Disk Space Full

**Symptoms:** `docker-compose` commands fail with "no space left"

**Diagnosis:**
```bash
df -h /opt
docker system df
```

**Solutions:**
```bash
# Clean unused Docker data
docker system prune -a

# Remove old images
docker image prune -a

# Increase retention cleanup frequency
# (configure in GlitchTip UI)
```

---

## Post-Migration Checklist

Before declaring migration complete:

### Technical Verification
- [ ] All 4 GlitchTip containers running (`docker-compose ps`)
- [ ] RAM usage <80% (`free -h`)
- [ ] Disk usage <70% (`df -h`)
- [ ] Test errors captured successfully
- [ ] Real production errors appearing in UI
- [ ] Stack traces readable and complete
- [ ] Breadcrumbs and context preserved
- [ ] Error grouping working correctly
- [ ] Alerts configured and tested
- [ ] Uptime monitoring configured
- [ ] Backups automated and tested

### Business Verification
- [ ] Sentry subscription cancelled
- [ ] Confirmation email received
- [ ] Final Sentry invoice paid/archived
- [ ] Cost savings documented
- [ ] Team trained on GlitchTip UI
- [ ] Documentation updated
- [ ] Runbook updated

### Operational Verification
- [ ] 24+ hours stable operation
- [ ] Zero production incidents
- [ ] Rollback procedure documented and tested
- [ ] Monitoring dashboards updated
- [ ] On-call runbook includes GlitchTip

### Team Acceptance
- [ ] Team can search errors effectively
- [ ] Team can triage issues efficiently
- [ ] No increase in error resolution time
- [ ] Team comfortable with UI/UX
- [ ] Team knows how to escalate issues

---

## Next Steps After Migration

### Immediate (Week 2)
1. Monitor daily for first week
2. Tune CELERY workers if needed
3. Adjust retention policies based on volume
4. Set up additional alerts as needed

### Short-term (Month 1)
1. Review error trends and patterns
2. Configure email notifications (SMTP)
3. Set up webhook integrations (Slack/Teams)
4. Optimize database queries if slow

### Medium-term (Months 2-3)
1. Evaluate error volume trends
2. Adjust resource allocation if needed
3. Consider SSL/HTTPS setup
4. Review and archive old issues

### Long-term (Months 3+)
1. Evaluate if additional features needed (APM)
2. Consider upgrade to larger server if scaling
3. Or migrate to Sentry SaaS if budget allows and needs justify

---

## Appendix A: Quick Reference Commands

### GlitchTip Management

```bash
# Start GlitchTip
cd /opt/glitchtip && docker-compose up -d

# Stop GlitchTip
cd /opt/glitchtip && docker-compose down

# Restart GlitchTip
cd /opt/glitchtip && docker-compose restart

# View logs
cd /opt/glitchtip && docker-compose logs -f

# Check status
cd /opt/glitchtip && docker-compose ps

# Resource usage
docker stats --no-stream

# Health check
curl http://46.149.70.219:8080/api/0/health/
```

### PM2 Management

```bash
# Restart all services
pm2 restart all

# Restart specific service
pm2 restart ai-admin-api

# View status
pm2 status

# View logs
pm2 logs --lines 50

# Monitor resources
pm2 monit
```

### Backup & Restore

```bash
# Manual backup
/opt/glitchtip/backup.sh

# Restore from backup
cd /opt/glitchtip
gunzip /backups/glitchtip/glitchtip_20251119.sql.gz
docker-compose exec -T postgres psql -U postgres < /backups/glitchtip/glitchtip_20251119.sql
```

### Monitoring

```bash
# Daily health check
/opt/glitchtip/daily-check.sh

# Resource check
/opt/glitchtip/monitor.sh

# Disk usage
df -h /opt

# Memory usage
free -h
```

---

## Appendix B: Configuration Files

### docker-compose.yml (Reference)

Will be downloaded from GlitchTip official repo. Contains:
- `web` service (Django app)
- `worker` service (Celery)
- `postgres` service (Database)
- `redis` service (Cache/broker)

### .env (Template)

```env
# Security
SECRET_KEY=[generated-32-char-hex]
POSTGRES_PASSWORD=[generated-16-char-hex]

# Domain
GLITCHTIP_DOMAIN=http://46.149.70.219:8080

# Email
DEFAULT_FROM_EMAIL=noreply@ai-admin.com
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Features
ENABLE_ORGANIZATION_CREATION=true
ENABLE_USER_REGISTRATION=false

# Performance
CELERY_WORKER_AUTOSCALE=1,3
CELERY_WORKER_MAX_TASKS_PER_CHILD=10000

# Database
DATABASE_URL=postgres://postgres:[POSTGRES_PASSWORD]@postgres:5432/postgres
```

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/glitchtip"
DATE=$(date +%Y%m%d)
BACKUP_FILE="${BACKUP_DIR}/glitchtip_${DATE}.sql"

cd /opt/glitchtip
docker-compose exec -T postgres pg_dump -U postgres > "${BACKUP_FILE}"
gzip "${BACKUP_FILE}"
find "${BACKUP_DIR}" -name "glitchtip_*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

---

## Appendix C: Support & Resources

### Official Documentation
- **GlitchTip:** https://glitchtip.com/documentation/
- **Docker:** https://docs.docker.com/
- **Sentry SDK:** https://docs.sentry.io/platforms/node/

### Community
- **GlitchTip GitLab:** https://gitlab.com/glitchtip/glitchtip
- **GlitchTip Gitter:** Community chat
- **Stack Overflow:** Tag `glitchtip`

### Internal
- **Error Tracking Docs:** `/opt/ai-admin/docs/ERROR_TRACKING.md`
- **Runbook:** Check operational runbook
- **Team:** Escalate to DevOps lead if stuck

---

**Plan Version:** 1.0
**Last Updated:** 2025-11-19
**Status:** Ready for execution
**Next Action:** Begin Phase 0 (Docker installation)
