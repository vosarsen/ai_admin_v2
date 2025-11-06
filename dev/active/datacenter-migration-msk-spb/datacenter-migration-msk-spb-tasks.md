# Datacenter Migration Tasks Checklist
**Last Updated: 2025-11-05**

---

## Migration Strategy: Two-Stage Approach

**Stage 1 (Phase 0)**: Database Migration (Supabase → Timeweb PostgreSQL) - FIRST
**Stage 2 (Phases 1-6)**: Server Migration (Moscow → St. Petersburg) - SECOND

---

## Quick Navigation

### Stage 1: Database Migration
- [Phase 0: Database Migration](#phase-0-database-migration-day--7-to-day-0)

### Stage 2: Server Migration
- [Phase 1: Preparation](#phase-1-server-migration-preparation-day-7)
- [Phase 2: New Server Setup](#phase-2-new-server-setup-day-7-8)
- [Phase 3: Application Deployment](#phase-3-application-deployment-day-8)
- [Phase 4: Testing](#phase-4-testing-and-validation-day-8-10)
- [Phase 5: Migration](#phase-5-production-migration-day-10)
- [Phase 6: Post-Migration](#phase-6-post-migration-day-10-37)

---

## Phase 0: Database Migration (Day -7 to Day 0)

**Goal**: Migrate all data from Supabase to Timeweb PostgreSQL, including Baileys sessions
**Duration**: ~10-12 hours work over 7 days + 10-15 min downtime
**Status**: ⬜ Not Started

**⚠️ CRITICAL**: This phase MUST succeed before starting server migration (Phase 1-6)

### 0.1 Prepare Timeweb PostgreSQL (Day -7, ~2 hours)

- [ ] Verify Timeweb PostgreSQL accessible
  ```bash
  psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db" -c "SELECT NOW();"
  ```
- [ ] Setup SSH tunnel from current server
  ```bash
  ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &
  ```
- [ ] Test tunnel connection
- [ ] Database `default_db` exists and accessible

### 0.2 Migrate Database Schema (Day -7, ~2 hours)

- [ ] Apply Baileys schema migrations
  ```bash
  psql "postgresql://..." -f migrations/20251007_create_whatsapp_auth_tables.sql
  ```
- [ ] Verify whatsapp_auth table exists
- [ ] Verify whatsapp_keys table exists
- [ ] Indexes and constraints created

### 0.3 Migrate Data (Day -6 to -2, ~4-6 hours)

- [ ] Create migration script (`scripts/migrate-supabase-to-timeweb.js`)
- [ ] Test migration on subset of data
- [ ] Run full migration:
  ```bash
  node scripts/migrate-supabase-to-timeweb.js
  ```
- [ ] Verify whatsapp_auth: 1 record (company_962302)
- [ ] Verify whatsapp_keys: 335 keys migrated
- [ ] No errors during migration

### 0.4 Verification (Day -2 to -1, ~2 hours)

- [ ] Count records match Supabase
- [ ] JSONB data types correct
- [ ] Test application connection to Timeweb PostgreSQL (.env.test)
- [ ] Test Baileys session loading
- [ ] No data corruption detected

### 0.5 Database Switchover (Day 0, ~10-15 minutes)

**⚠️ MAINTENANCE WINDOW**

- [ ] Notify clients 24 hours in advance
- [ ] Stop all PM2 services
  ```bash
  pm2 stop all
  ```
- [ ] Final sync (run migration script once more)
- [ ] Update .env to use Timeweb PostgreSQL:
  ```bash
  USE_LEGACY_SUPABASE=false
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5433  # Via tunnel
  POSTGRES_DATABASE=default_db
  POSTGRES_USER=gen_user
  POSTGRES_PASSWORD=}X|oM595A<7n?0
  ```
- [ ] Restart all services
  ```bash
  pm2 start all
  ```
- [ ] Verify all services online
- [ ] WhatsApp connected
- [ ] Test message processed successfully

**GO/NO-GO Decision:**
- [ ] All services online → GO
- [ ] WhatsApp connected → GO
- [ ] Database queries work → GO
- [ ] Test message successful → GO
- [ ] Any issues → ROLLBACK to Supabase

### 0.6 Post-Switchover Testing (Day 0-7)

- [ ] **Day 0**: 2 hours intensive monitoring
- [ ] **Day 1**: 24-hour uptime check
- [ ] **Day 2-6**: Daily health checks
- [ ] **Day 7**: 7-day stability confirmed
- [ ] **Ready for Phase 1** (Server Migration)

**Metrics Tracking:**

| Day | Uptime % | WhatsApp | DB Query Time | Success Rate | Errors |
|-----|----------|----------|---------------|--------------|--------|
| 0 | ___% | ___ | ___ms | ___% | ___ |
| 1 | ___% | ___ | ___ms | ___% | ___ |
| 3 | ___% | ___ | ___ms | ___% | ___ |
| 7 | ___% | ___ | ___ms | ___% | ___ |

**Checkpoint**: Phase 0 SUCCESS - Database migration complete, 7 days stable, READY for server migration

---

## Phase 1: Server Migration Preparation (Day 7)

**Goal**: Create backups, document configuration, create new VPS
**Duration**: ~2 hours
**Status**: ⬜ Not Started

### 1.1 Create Comprehensive Backups

- [ ] Create backup directory with timestamp
  ```bash
  mkdir -p ./migration-backups/$(date +%Y%m%d)
  ```

- [ ] Backup .env file (CRITICAL!)
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin \
    root@46.149.70.219:/opt/ai-admin/.env ./migration-backups/$(date +%Y%m%d)/
  ```

- [ ] Verify .env contains critical variables
  ```bash
  cat migration-backups/*//.env | grep -E "POSTGRES_HOST|REDIS_PASSWORD|GEMINI_API_KEY|SUPABASE_URL" && \
    echo "✅ .env contains critical variables" || \
    echo "❌ ERROR: .env missing critical variables!"
  ```

- [ ] Backup ecosystem.config.js
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin \
    root@46.149.70.219:/opt/ai-admin/ecosystem.config.js ./migration-backups/$(date +%Y%m%d)/
  ```

- [ ] Backup Xray VPN configuration
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin \
    root@46.149.70.219:/usr/local/etc/xray/config.json ./migration-backups/$(date +%Y%m%d)/xray-config.json
  ```

- [ ] Backup recent logs (optional, for debugging)
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin -r \
    root@46.149.70.219:/opt/ai-admin/logs ./migration-backups/$(date +%Y%m%d)/logs-backup
  ```

- [ ] Verify total backup size (~10-50MB expected)
- [ ] Create second backup copy to external location

**Note about Baileys Sessions:**
✅ **No backup needed** - Baileys sessions already stored in Supabase PostgreSQL (whatsapp_auth, whatsapp_keys tables). New server will connect to same database.

**Checkpoint**: All critical configuration backups verified and stored in 2+ locations

### 1.2 Document Current Configuration

- [ ] Save PM2 status
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status" > migration-backups/$(date +%Y%m%d)/pm2-status.txt
  ```

- [ ] Save PM2 environment variables
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 env 0" > migration-backups/$(date +%Y%m%d)/pm2-env-api.txt
  ```

- [ ] Save network configuration
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "netstat -tulpn | grep -E ':(3000|6379|1080)'" > migration-backups/$(date +%Y%m%d)/ports.txt
  ```

- [ ] Save package versions
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm list --depth=0" > migration-backups/$(date +%Y%m%d)/npm-packages.txt
  ```

- [ ] Save system information
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "uname -a && node -v && npm -v && pm2 -v" > migration-backups/$(date +%Y%m%d)/system-info.txt
  ```

**Checkpoint**: All configuration documented

### 1.3 Create New VPS in Timeweb

- [ ] Login to Timeweb control panel
- [ ] Navigate to VPS → Create New Server
- [ ] Select region: **St. Petersburg**
- [ ] Select OS: **Ubuntu 22.04 LTS**
- [ ] Select plan: **8 vCPU, 16GB RAM, 160GB NVMe SSD**
- [ ] Set hostname: `ai-admin-v2-spb` (or similar)
- [ ] **⚠️ CRITICAL**: Enable Private Network → Select **"Cute Crossbill"**
- [ ] Add SSH public key
- [ ] Create VPS and wait for provisioning (~5 minutes)
- [ ] Note new VPS IP address: `________________`
- [ ] Test SSH access to new VPS
- [ ] Verify "Cute Crossbill" network attached in control panel

**Checkpoint**: New VPS created, accessible via SSH, private network attached

**Phase 1 Complete**: ⬜ All tasks completed | Actual Duration: ___ hours

---

## Phase 2: New Server Setup (Day 1-2)

**Goal**: Verify network, install software, configure VPN
**Duration**: ~3-4 hours
**Status**: ⬜ Not Started

### 2.1 Verify Internal Network Connectivity (FIRST PRIORITY!)

- [ ] SSH to new VPS
  ```bash
  ssh root@<NEW_VPS_IP>
  ```

- [ ] Check private network interface
  ```bash
  ip addr show
  # Look for interface with 192.168.0.x address
  ```

- [ ] Ping PostgreSQL host
  ```bash
  ping -c 4 192.168.0.4
  # Expected: 0% packet loss, <1ms latency
  ```

- [ ] Test PostgreSQL port
  ```bash
  telnet 192.168.0.4 5432
  # Expected: Connected to 192.168.0.4
  ```

- [ ] Install PostgreSQL client
  ```bash
  apt update && apt install -y postgresql-client
  ```

- [ ] Test database connection
  ```bash
  psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db" -c "SELECT NOW();"
  # Expected: Returns current timestamp
  ```

**⚠️ CRITICAL CHECKPOINT**:
- [ ] If PostgreSQL NOT accessible → STOP immediately
- [ ] Check Timeweb panel: "Cute Crossbill" network attached?
- [ ] Contact Timeweb support if needed
- [ ] DO NOT PROCEED until database accessible

**Checkpoint**: PostgreSQL accessible via internal network (<1ms latency)

### 2.2 Install Base Software Stack

- [ ] Update system packages
  ```bash
  apt update && apt upgrade -y
  ```

- [ ] Install build essentials
  ```bash
  apt install -y build-essential curl wget git htop nano jq
  ```

- [ ] Install Node.js 20.x LTS
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  ```

- [ ] Verify Node.js installation
  ```bash
  node --version  # Expected: v20.x.x
  npm --version   # Expected: v10.x.x
  ```

- [ ] Install PM2 globally
  ```bash
  npm install -g pm2
  ```

- [ ] Verify PM2 installation
  ```bash
  pm2 --version  # Expected: v5.x.x
  ```

- [ ] Install Redis server
  ```bash
  apt install -y redis-server
  ```

- [ ] Start and enable Redis
  ```bash
  systemctl enable redis-server
  systemctl start redis-server
  ```

- [ ] Test Redis connection
  ```bash
  redis-cli ping  # Expected: PONG
  ```

- [ ] Generate secure Redis password
  ```bash
  # Generate and save password
  REDIS_PASSWORD="<generate_secure_password>"
  echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> /root/migration-notes.txt
  ```

- [ ] Set Redis password
  ```bash
  redis-cli CONFIG SET requirepass "$REDIS_PASSWORD"
  redis-cli CONFIG REWRITE
  ```

- [ ] Test Redis authentication
  ```bash
  redis-cli -a "$REDIS_PASSWORD" ping  # Expected: PONG
  ```

- [ ] Install additional utilities
  ```bash
  apt install -y htop iotop net-tools dnsutils
  ```

**Checkpoint**: All base software installed and verified

### 2.3 Install and Configure Xray VPN

- [ ] Install Xray using official script
  ```bash
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
  ```

- [ ] Verify Xray installation
  ```bash
  xray version
  ```

- [ ] Copy Xray configuration from local backup
  ```bash
  # On local machine:
  scp ./migration-backups/*/xray-config.json root@<NEW_VPS_IP>:/usr/local/etc/xray/config.json
  ```

- [ ] Verify config syntax
  ```bash
  xray run -test -config /usr/local/etc/xray/config.json
  # Expected: Configuration OK
  ```

- [ ] Enable Xray service
  ```bash
  systemctl enable xray
  ```

- [ ] Start Xray service
  ```bash
  systemctl start xray
  ```

- [ ] Check Xray status
  ```bash
  systemctl status xray
  # Expected: active (running)
  ```

- [ ] Test VPN connection (must show USA IP)
  ```bash
  curl -x socks5://127.0.0.1:1080 https://ipinfo.io/json
  # Expected: "country": "US"
  ```

- [ ] Test Gemini API accessibility
  ```bash
  curl -x socks5://127.0.0.1:1080 \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=<GEMINI_API_KEY>"
  # Expected: JSON response with generated content
  ```

**⚠️ CRITICAL CHECKPOINT**:
- [ ] If VPN NOT showing USA IP → Investigate Xray logs
- [ ] If Gemini API fails → Check proxy configuration
- [ ] DO NOT PROCEED until VPN working

**Checkpoint**: Xray VPN working, Gemini API accessible via proxy

**Phase 2 Complete**: ⬜ All tasks completed | Actual Duration: ___ hours

---

## Phase 3: Application Deployment (Day 2)

**Goal**: Deploy application, transfer Baileys, configure environment
**Duration**: ~2-3 hours
**Status**: ⬜ Not Started

### 3.1 Clone Repository

- [ ] Navigate to /opt directory
  ```bash
  cd /opt
  ```

- [ ] Clone repository
  ```bash
  git clone https://github.com/vosarsen/ai_admin_v2.git ai-admin
  ```

- [ ] Navigate to project
  ```bash
  cd ai-admin
  ```

- [ ] Checkout main branch
  ```bash
  git checkout main
  ```

- [ ] Pull latest changes
  ```bash
  git pull origin main
  ```

- [ ] Verify repository state
  ```bash
  git status
  git log -1 --oneline
  ```

- [ ] Check project structure
  ```bash
  ls -la
  ```

**Checkpoint**: Repository cloned and on main branch

### 3.2 Verify Baileys Sessions Access

**✅ NO FILE TRANSFER NEEDED** - Baileys sessions already in Supabase PostgreSQL

- [ ] SSH to new server
  ```bash
  ssh root@<NEW_VPS_IP>
  ```

- [ ] Check .env contains Supabase credentials
  ```bash
  cd /opt/ai-admin
  grep -E "SUPABASE_URL|SUPABASE_KEY|USE_DATABASE_AUTH_STATE" .env
  ```

- [ ] Expected output shows all three variables

- [ ] Test Supabase access
  ```bash
  node -e "
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  supabase.from('whatsapp_auth')
    .select('company_id')
    .eq('company_id', '962302')
    .then(r => {
      if (r.data && r.data.length > 0) {
        console.log('✅ Baileys sessions accessible from new server');
      } else {
        console.error('❌ ERROR: Cannot access Baileys sessions!');
      }
    });
  "
  ```

- [ ] Verify success message appears

**What happens automatically:**
- New server connects to same Supabase database
- WhatsApp service loads sessions from `whatsapp_auth` and `whatsapp_keys` tables
- No files to transfer, no data loss risk
- Instant switchover

**Checkpoint**: Baileys sessions accessible from new server via Supabase

### 3.3 Configure Environment Variables

- [ ] Copy .env from backup
  ```bash
  # On local machine:
  scp ./migration-backups/*/.env root@<NEW_VPS_IP>:/opt/ai-admin/.env
  ```

- [ ] Edit .env on new server
  ```bash
  nano /opt/ai-admin/.env
  ```

- [ ] Update POSTGRES_HOST (verify, should be 192.168.0.4)
- [ ] Update REDIS_PASSWORD to new Redis password
- [ ] Update AI_ADMIN_API_URL to new VPS IP
- [ ] Update WEBHOOK_URL to new VPS IP
- [ ] Verify all other variables preserved

- [ ] Create and run validation script
  ```bash
  cat > /opt/ai-admin/scripts/validate-env.sh << 'EOF'
  #!/bin/bash
  source /opt/ai-admin/.env

  echo "🔍 Validating .env configuration..."

  [ -n "$POSTGRES_HOST" ] && echo "✅ POSTGRES_HOST set" || echo "❌ POSTGRES_HOST missing"
  [ -n "$REDIS_PASSWORD" ] && echo "✅ REDIS_PASSWORD set" || echo "❌ REDIS_PASSWORD missing"
  [ -n "$GEMINI_API_KEY" ] && echo "✅ GEMINI_API_KEY set" || echo "❌ GEMINI_API_KEY missing"
  [ -n "$BAILEYS_STANDALONE" ] && echo "✅ BAILEYS_STANDALONE set" || echo "❌ BAILEYS_STANDALONE missing"

  echo "🔍 Testing PostgreSQL connection..."
  psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DATABASE" \
    -c "SELECT 1;" > /dev/null 2>&1 && \
    echo "✅ PostgreSQL connection OK" || echo "❌ PostgreSQL connection FAILED"

  echo "🔍 Testing Redis connection..."
  redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1 && \
    echo "✅ Redis connection OK" || echo "❌ Redis connection FAILED"

  echo "✅ Validation complete"
  EOF

  chmod +x /opt/ai-admin/scripts/validate-env.sh
  ```

- [ ] Run validation script
  ```bash
  /opt/ai-admin/scripts/validate-env.sh
  # All checks should pass
  ```

**Checkpoint**: .env configured and validated

### 3.4 Install Dependencies

- [ ] Install production dependencies
  ```bash
  cd /opt/ai-admin
  npm install --production
  ```

- [ ] Verify critical packages installed
  ```bash
  npm ls | grep -E "(express|bullmq|ioredis|baileys|@google)"
  # All should be listed
  ```

- [ ] Check for critical vulnerabilities
  ```bash
  npm audit
  # Review output, fix if needed
  ```

- [ ] Verify package.json scripts
  ```bash
  npm run
  ```

**Checkpoint**: Dependencies installed successfully

**Phase 3 Complete**: ⬜ All tasks completed | Actual Duration: ___ hours

---

## Phase 4: Testing and Validation (Day 2-3)

**Goal**: Start services, validate functionality, parallel run
**Duration**: ~6 hours + 48 hours parallel
**Status**: ⬜ Not Started

### 4.1 Start PM2 Services

- [ ] Verify ecosystem.config.js
  ```bash
  cat /opt/ai-admin/ecosystem.config.js
  ```

- [ ] Start all services
  ```bash
  cd /opt/ai-admin
  pm2 start ecosystem.config.js
  ```

- [ ] Check PM2 status
  ```bash
  pm2 status
  # Expected: All 8 services "online"
  ```

- [ ] Review logs for immediate errors
  ```bash
  pm2 logs --err --lines 50
  ```

- [ ] Save PM2 configuration
  ```bash
  pm2 save
  ```

- [ ] Setup PM2 startup on boot
  ```bash
  pm2 startup
  # Execute the command PM2 outputs
  ```

**Checkpoint**: All 8 PM2 services online, no critical errors

### 4.2 Validate Core Services

**API Server:**
- [ ] Test health endpoint
  ```bash
  curl http://<NEW_VPS_IP>:3000/health
  # Expected: {"status":"ok"}
  ```

- [ ] Check API logs
  ```bash
  pm2 logs ai-admin-api --lines 50
  # Look for: "API server listening on port 3000"
  ```

**PostgreSQL:**
- [ ] Check database connection in logs
  ```bash
  pm2 logs ai-admin-api --lines 100 | grep -i postgres
  # Expected: No connection errors
  ```

- [ ] Verify database latency
  ```bash
  curl http://<NEW_VPS_IP>:3000/api/health/database
  # Expected: Latency <1ms
  ```

**Redis:**
- [ ] Check Redis connection in logs
  ```bash
  pm2 logs --lines 100 | grep -i redis
  # Expected: "Redis connected"
  ```

- [ ] Test Redis via API
  ```bash
  curl http://<NEW_VPS_IP>:3000/api/health/redis
  # Expected: {"status":"ok"}
  ```

**Gemini AI:**
- [ ] Check worker logs for Gemini
  ```bash
  pm2 logs ai-admin-worker-v2 --lines 100 | grep -i gemini
  # Expected: No connection errors
  ```

- [ ] Check VPN proxy usage
  ```bash
  pm2 logs ai-admin-worker-v2 --lines 100 | grep -i socks5
  # Expected: Messages showing proxy usage
  ```

**WhatsApp:**
- [ ] Check Baileys service logs
  ```bash
  pm2 logs baileys-whatsapp-service --lines 100
  ```

- [ ] Look for connection status
  ```bash
  pm2 logs baileys-whatsapp-service --lines 100 | grep -i "connection\|status"
  # Expected: "connection: open" or "Connected"
  ```

- [ ] Verify NO QR code generation
  ```bash
  pm2 logs baileys-whatsapp-service --lines 100 | grep -i "qr"
  # Expected: No QR codes (means session loaded successfully)
  ```

**⚠️ CRITICAL CHECKPOINT**:
- [ ] If WhatsApp shows QR code → STOP, check Baileys sessions
- [ ] If authentication errors → Restore creds.json from backup
- [ ] DO NOT PROCEED until WhatsApp connected

**Checkpoint**: All core services validated and operational

### 4.3 Functional Testing

**Test 1: Simple Message**
- [ ] Send message from test number (89686484488): "Привет"
- [ ] Monitor logs: `pm2 logs --timestamp`
- [ ] Verify message received in Baileys logs
- [ ] Verify AI processing in worker logs
- [ ] Verify response sent back
- [ ] Confirm response received in WhatsApp

**Test 2: Database Query (Schedules)**
- [ ] Send message: "Какие есть свободные слоты на завтра?"
- [ ] Verify PostgreSQL query in logs
- [ ] Check query latency (<1ms expected)
- [ ] Verify response includes available time slots

**Test 3: Context Persistence (Redis)**
- [ ] Send message 1: "Хочу записаться на маникюр"
- [ ] Send message 2: "На завтра"
- [ ] Verify context saved in Redis
  ```bash
  redis-cli -a "$REDIS_PASSWORD" KEYS "context:*"
  ```
- [ ] Verify bot remembers "маникюр" from previous message

**Test 4: AI Processing (Gemini via VPN)**
- [ ] Send message: "Расскажи подробнее об услуге маникюр"
- [ ] Check VPN usage in logs
- [ ] Check Gemini API call logs
- [ ] Verify detailed response received

**Test 5: Booking Creation**
- [ ] Send message: "Записать меня на маникюр завтра в 14:00"
- [ ] Check booking creation logs
- [ ] Verify in database:
  ```bash
  psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" \
    -c "SELECT * FROM bookings ORDER BY created_at DESC LIMIT 1;"
  ```

**Test 6: Telegram Notifications**
- [ ] Trigger event that sends Telegram notification
- [ ] Check Telegram bot logs
- [ ] Verify notification received in Telegram

**Test 7: Automated Services**
- [ ] Check booking monitor logs
  ```bash
  pm2 logs ai-admin-booking-monitor --lines 100
  ```
- [ ] Check WhatsApp backup service logs
  ```bash
  pm2 logs whatsapp-backup-service --lines 50
  ```
- [ ] Verify backup files created

**Checkpoint**: All functional tests passed

### 4.4 Performance Validation

**Database Latency:**
- [ ] Run latency test (100 queries)
  ```bash
  for i in {1..100}; do
    time psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" \
      -c "SELECT NOW();" > /dev/null 2>&1
  done
  ```
- [ ] Verify average latency <10ms (mostly connection overhead)
- [ ] Test from application
  ```bash
  curl http://<NEW_VPS_IP>:3000/api/performance/database-latency
  ```

**Redis Latency:**
- [ ] Run Redis latency test
  ```bash
  redis-cli -a "$REDIS_PASSWORD" --latency
  # Ctrl+C after 30 seconds
  ```
- [ ] Verify avg <1ms, max <5ms

**AI Response Time:**
- [ ] Send 10 test messages and measure time
- [ ] Check logs for processing time
  ```bash
  pm2 logs ai-admin-worker-v2 | grep "Processing time"
  ```
- [ ] Verify 9-15 seconds total (acceptable)

**Checkpoint**: Performance validated, 20-50x improvement confirmed

### 4.5 Parallel Run (48 Hours)

**Setup:**
- [ ] Old server continues serving production traffic
- [ ] New server serves only test number (89686484488)
- [ ] Both servers monitored

**Monitoring Schedule:**

**Every 2 hours:**
- [ ] Check PM2 status on new server
  ```bash
  ssh root@<NEW_VPS_IP> "pm2 status"
  ```

**Every 4 hours:**
- [ ] Review error logs
  ```bash
  ssh root@<NEW_VPS_IP> "pm2 logs --err --lines 100"
  ```

**Every 8 hours:**
- [ ] Send test messages (full flow validation)
- [ ] Test: Simple message
- [ ] Test: Database query
- [ ] Test: Context persistence
- [ ] Test: Booking creation

**Every 12 hours:**
- [ ] Check resource usage
  ```bash
  ssh root@<NEW_VPS_IP> "pm2 monit"
  ```
- [ ] Check Baileys file count
  ```bash
  ssh root@<NEW_VPS_IP> "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l"
  ```

**Every 24 hours:**
- [ ] Generate status report
- [ ] Review all metrics
- [ ] Document any issues

**48 Hour Checklist:**
- [ ] All services online for 48 consecutive hours
- [ ] Zero critical errors
- [ ] Test messages: >95% success rate
- [ ] No service restarts due to crashes
- [ ] Resource usage stable (no memory leaks)
- [ ] Baileys file count stable (162-220 range)
- [ ] Database latency consistently <1ms
- [ ] AI responses consistently 9-15 seconds

**GO/NO-GO Decision:**
- [ ] All success criteria met → GO to Phase 5 (Migration)
- [ ] Any critical issues → NO-GO, investigate and fix

**Phase 4 Complete**: ⬜ All tasks completed | Actual Duration: ___ hours + 48h parallel

---

## Phase 5: Production Migration (Day 4)

**Goal**: Migrate production traffic to new server
**Duration**: 2-4 hours downtime
**Status**: ⬜ Not Started

### 5.1 Pre-Migration Preparation (Day 3 - Before migration window)

**Client Notification:**
- [ ] Compose notification message
- [ ] Send notification 24 hours before migration
- [ ] Post in all client communication channels
- [ ] Confirm clients notified

**Final Backup:**
- [ ] SSH to old server
- [ ] Stop all PM2 services
  ```bash
  pm2 stop all
  ```
- [ ] Create final comprehensive backup
  ```bash
  tar -czf /root/final-backup-$(date +%Y%m%d-%H%M).tar.gz \
    /opt/ai-admin/baileys_sessions \
    /opt/ai-admin/.env \
    /opt/ai-admin/logs
  ```
- [ ] Restart services
  ```bash
  pm2 start all
  ```
- [ ] Download final backup to local machine
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin \
    root@46.149.70.219:/root/final-backup-*.tar.gz \
    ./migration-backups/final-backup/
  ```

**Checkpoint**: Pre-migration preparation complete

### 5.2 Migration Window: 02:00 - 06:00 (Day 4)

**02:00 - Stop Old Server (5 minutes)**

- [ ] Record migration start time: `____________`
- [ ] SSH to old server
- [ ] Check current PM2 status
  ```bash
  pm2 status
  pm2 logs --lines 50
  ```
- [ ] Stop all PM2 processes
  ```bash
  pm2 stop all
  ```
- [ ] Verify all stopped
  ```bash
  pm2 status
  # All should show "stopped"
  ```
- [ ] Record exact stop time
  ```bash
  date +"%Y-%m-%d %H:%M:%S" > /root/migration-stop-time.txt
  ```

**02:05 - Verification Check (2 minutes)**

- [ ] SSH to new server
  ```bash
  ssh root@<NEW_VPS_IP>
  cd /opt/ai-admin
  ```

- [ ] Verify Baileys sessions accessible from Supabase
  ```bash
  node -e "
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  supabase.from('whatsapp_auth')
    .select('company_id')
    .eq('company_id', '962302')
    .then(r => {
      if (r.data && r.data.length > 0) {
        console.log('✅ Baileys sessions accessible from new server');
      } else {
        console.error('❌ ERROR: Cannot access Baileys sessions!');
        process.exit(1);
      }
    });
  "
  ```

- [ ] Verify success message appears
- [ ] No file sync needed - Baileys data already in Supabase

**02:15 - Restart New Server (5 minutes)**

- [ ] SSH to new server
- [ ] Navigate to project directory
  ```bash
  cd /opt/ai-admin
  ```
- [ ] Restart all services
  ```bash
  pm2 restart all
  ```
- [ ] Wait 30 seconds for stabilization
- [ ] Check PM2 status
  ```bash
  pm2 status
  # All 8 services should be "online"
  ```
- [ ] Check for immediate errors
  ```bash
  pm2 logs --err --lines 50
  ```
- [ ] Verify WhatsApp connection
  ```bash
  pm2 logs baileys-whatsapp-service --lines 50 | grep -i connection
  # Expected: "connection: open"
  ```

**02:20 - Smoke Tests (10 minutes)**

- [ ] **Test 1**: API Health
  ```bash
  curl http://<NEW_VPS_IP>:3000/health
  # Expected: {"status":"ok"}
  ```

- [ ] **Test 2**: Database connection
  ```bash
  curl http://<NEW_VPS_IP>:3000/api/health/database
  # Expected: {"status":"ok","latency":"<1ms"}
  ```

- [ ] **Test 3**: Redis connection
  ```bash
  curl http://<NEW_VPS_IP>:3000/api/health/redis
  # Expected: {"status":"ok"}
  ```

- [ ] **Test 4**: Send test message
  - From test number (89686484488): "Тест после миграции"
  - Verify bot responds within 15 seconds

- [ ] **Test 5**: Check error logs
  ```bash
  pm2 logs --err --lines 100
  # Expected: No critical errors
  ```

- [ ] **Test 6**: Verify all services stable
  ```bash
  pm2 status
  # All online, no restarts beyond initial restart
  ```

**⚠️ CRITICAL GO/NO-GO CHECKPOINT:**

**GO Criteria (Continue):**
- [ ] All 8 services online
- [ ] WhatsApp connected
- [ ] API health check passes
- [ ] Database queries successful
- [ ] Test message processed successfully
- [ ] No critical errors in logs

**NO-GO Criteria (Rollback):**
- [ ] Any service failing to start
- [ ] WhatsApp not connecting
- [ ] Database connection errors
- [ ] Critical errors in logs
- [ ] Test message not processed

**Decision**: ⬜ GO | ⬜ NO-GO (If NO-GO → Execute Rollback in Phase 5.6)

**02:30 - Intensive Monitoring (30 minutes)**

- [ ] Monitor logs in real-time
  ```bash
  pm2 logs --timestamp
  ```

**Every 5 minutes:**
- [ ] Check service status: `pm2 status`
- [ ] Check error logs: `pm2 logs --err --lines 50`
- [ ] Check WhatsApp connection
- [ ] Send test message

**Every 10 minutes:**
- [ ] Check resource usage: `pm2 monit`
- [ ] Check database latency
- [ ] Check Baileys file count

- [ ] 30-minute monitoring complete - system stable

**03:00 - Extended Monitoring (3 hours)**

**Every 15 minutes:**
- [ ] Check PM2 status
- [ ] Review recent errors
- [ ] Check Baileys file count
- [ ] Send test message
- [ ] Monitor Telegram alerts
- [ ] Check disk usage
- [ ] Check memory usage

**Every hour:**
- [ ] Generate status report
- [ ] Document report timestamp: `____________`

**06:00 - Migration Complete**

- [ ] Record migration end time: `____________`
- [ ] Calculate total downtime: `___ hours ___ minutes`
- [ ] Generate final migration report
- [ ] All smoke tests still passing
- [ ] All services stable
- [ ] Zero critical errors

**Checkpoint**: Migration completed successfully

### 5.3 Post-Migration Announcement

**Client Notification:**
- [ ] Compose completion message
- [ ] Send to all client communication channels
- [ ] Confirm clients notified

**Team Notification:**
- [ ] Generate success report
- [ ] Send to team members
- [ ] Update project status

**Checkpoint**: Stakeholders notified

**Phase 5 Complete**: ⬜ All tasks completed | Actual Downtime: ___ hours ___ minutes

---

## Phase 6: Post-Migration (Day 4-30)

**Goal**: Ensure stability, optimize, decommission old server
**Duration**: 7-30 days
**Status**: ⬜ Not Started

### 6.1 Extended Monitoring (Day 4-7)

**Daily Health Checks:**

- [ ] **Day 4**: Create daily health check script
  ```bash
  cat > /opt/ai-admin/scripts/daily-health-check.sh << 'EOF'
  #!/bin/bash
  echo "Daily Health Check - $(date)"
  echo "1. PM2 Status:"
  pm2 status
  echo "2. Recent Errors:"
  pm2 logs --err --lines 100 --nostream
  echo "3. Resource Usage:"
  free -h && df -h /opt/ai-admin
  echo "4. Baileys File Count:"
  ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l
  echo "5. Database Latency:"
  time psql "$POSTGRES_CONNECTION_STRING" -c "SELECT NOW();" > /dev/null 2>&1
  EOF
  chmod +x /opt/ai-admin/scripts/daily-health-check.sh
  ```

- [ ] **Day 4**: Setup daily cron job
  ```bash
  (crontab -l 2>/dev/null; echo "0 9 * * * /opt/ai-admin/scripts/daily-health-check.sh >> /var/log/ai-admin-health.log 2>&1") | crontab -
  ```

**Daily Checklist (Day 4-7):**

- [ ] **Day 4**: Run health check and review
  - [ ] All 8 services online
  - [ ] No critical errors
  - [ ] Memory usage <12GB
  - [ ] Disk usage <50%
  - [ ] Baileys file count 162-220
  - [ ] Database latency <1ms
  - [ ] Test messages successful

- [ ] **Day 5**: Run health check and review
  - [ ] All metrics within acceptable ranges
  - [ ] Document any issues: ________________
  - [ ] Issues resolved: Yes / No

- [ ] **Day 6**: Run health check and review
  - [ ] All metrics within acceptable ranges
  - [ ] Document any issues: ________________
  - [ ] Issues resolved: Yes / No

- [ ] **Day 7**: Run health check and review
  - [ ] All metrics within acceptable ranges
  - [ ] 7 days continuous stable operation confirmed
  - [ ] Ready to proceed with decommission: Yes / No

**Checkpoint**: 7 days stable operation confirmed

### 6.2 Performance Optimization (Day 5-7)

**Database Query Optimization:**
- [ ] Check for slow queries (>100ms)
  ```bash
  pm2 logs --lines 1000 | grep -E "Query.*[0-9]{3,}ms"
  ```
- [ ] Analyze most frequent queries
- [ ] Consider adding indexes if needed
- [ ] Document optimizations made: ________________

**Redis Cache Optimization:**
- [ ] Check Redis memory usage
  ```bash
  redis-cli -a "$REDIS_PASSWORD" INFO memory
  ```
- [ ] Check cache hit rate
  ```bash
  redis-cli -a "$REDIS_PASSWORD" INFO stats | grep -E "keyspace_hits|keyspace_misses"
  ```
- [ ] Calculate hit rate: ____ %
- [ ] Target: >80%

**PM2 Process Optimization:**
- [ ] Review PM2 process memory usage
  ```bash
  pm2 list
  ```
- [ ] Identify any processes using >2GB consistently
- [ ] Investigate memory leaks if found
- [ ] Update ecosystem.config.js if needed

**Network Optimization:**
- [ ] Verify internal network latency
  ```bash
  ping -c 100 192.168.0.4
  ```
- [ ] Average latency: ____ ms (target: <1ms)
- [ ] Packet loss: ____ % (target: 0%)

**Checkpoint**: Performance optimized

### 6.3 Security Hardening (Day 7-10)

**Firewall Configuration:**
- [ ] Install UFW
  ```bash
  apt install -y ufw
  ```
- [ ] Set default policies
  ```bash
  ufw default deny incoming
  ufw default allow outgoing
  ```
- [ ] Allow SSH (CRITICAL - do first!)
  ```bash
  ufw allow 22/tcp
  ufw limit 22/tcp
  ```
- [ ] Enable firewall
  ```bash
  ufw enable
  ```
- [ ] Verify status
  ```bash
  ufw status verbose
  ```

**SSH Security:**
- [ ] Edit SSH config
  ```bash
  nano /etc/ssh/sshd_config
  ```
- [ ] Disable password authentication
  ```
  PasswordAuthentication no
  PubkeyAuthentication yes
  PermitRootLogin prohibit-password
  ```
- [ ] Restart SSH
  ```bash
  systemctl restart sshd
  ```
- [ ] Verify configuration
  ```bash
  sshd -T | grep -E "passwordauthentication|pubkeyauthentication"
  ```

**Automated Security Updates:**
- [ ] Install unattended-upgrades
  ```bash
  apt install -y unattended-upgrades
  ```
- [ ] Configure automatic updates
  ```bash
  dpkg-reconfigure -plow unattended-upgrades
  ```
- [ ] Verify configuration
  ```bash
  cat /etc/apt/apt.conf.d/50unattended-upgrades
  ```

**System Hardening:**
- [ ] Set proper file permissions
  ```bash
  chmod 600 /opt/ai-admin/.env
  chmod 600 /opt/ai-admin/baileys_sessions/company_962302/creds.json
  chmod 700 /opt/ai-admin/baileys_sessions/company_962302
  ```
- [ ] Install fail2ban (optional)
  ```bash
  apt install -y fail2ban
  systemctl enable fail2ban
  systemctl start fail2ban
  ```

**Checkpoint**: Security hardening complete

### 6.4 Documentation Updates (Day 7-10)

**Update Project Documentation:**
- [ ] Update CLAUDE.md
  - [ ] Server IP: 46.149.70.219 → <NEW_VPS_IP>
  - [ ] Location: Moscow → St. Petersburg
  - [ ] PostgreSQL access: SSH tunnel → internal network
  - [ ] Add migration date and notes

- [ ] Update docs/TIMEWEB_POSTGRES_SUMMARY.md
  - [ ] Confirm internal network details
  - [ ] Update connection examples

- [ ] Create migration documentation
  ```bash
  cat > docs/migrations/2025-11-05-datacenter-migration.md
  # Document migration summary, changes, lessons learned
  ```

**Update Scripts:**
- [ ] Check for hardcoded old IP addresses
  ```bash
  grep -r "46.149.70.219" /opt/ai-admin/scripts/
  ```
- [ ] Update any found references to new IP
- [ ] Update monitoring scripts
- [ ] Update health check endpoints

**Update External Services:**
- [ ] YClients webhooks (if applicable)
- [ ] DNS records (if using domain names)
- [ ] Monitoring services (if using external monitoring)
- [ ] Team documentation (wikis, runbooks)

**Checkpoint**: All documentation updated

### 6.5 Old Server Standby (Day 4-7)

**Daily Verification:**

- [ ] **Day 4**: Check old server accessible
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 uptime
  ```
- [ ] Verify PM2 services stopped
- [ ] Verify backups intact

- [ ] **Day 5**: Check old server accessible
- [ ] **Day 6**: Check old server accessible
- [ ] **Day 7**: Check old server accessible

**Rollback Readiness:**
- [ ] Rollback procedure documented
- [ ] Can execute rollback in <5 minutes
- [ ] Team knows rollback procedure

**Checkpoint**: Old server on standby, rollback ready

### 6.6 Decommission Old Server (Day 7+)

**Pre-Decommission Verification:**

- [ ] New server operational for 7 consecutive days
- [ ] Zero critical incidents in last 7 days
- [ ] All metrics within acceptable ranges
- [ ] Performance stable or improved
- [ ] No rollback needed in last 7 days
- [ ] Team consensus to proceed

**Metrics Review (Last 7 Days):**
- [ ] Uptime: >99.9%
- [ ] Average response time: <15s
- [ ] Database latency: <1ms
- [ ] Message success rate: >98%
- [ ] Service restarts: <3 per day per service
- [ ] Memory usage: <12GB
- [ ] No unresolved issues

**Backup Verification:**
- [ ] All backups from old server downloaded locally
- [ ] Backup integrity verified
- [ ] Backups stored in 2+ locations
- [ ] Restoration tested successfully

**GO/NO-GO Decision:**
- [ ] All prerequisites met: Yes / No
- [ ] Team approval obtained: Yes / No
- [ ] **Decision**: ⬜ GO | ⬜ NO-GO

**If GO - Decommission (Day 7+):**

- [ ] Create final archive of old server
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
    "tar -czf /root/old-server-final-archive-$(date +%Y%m%d).tar.gz \
    /opt/ai-admin /etc/systemd/system/pm2-* /usr/local/etc/xray /var/log/pm2"
  ```

- [ ] Download final archive
  ```bash
  scp -i ~/.ssh/id_ed25519_ai_admin \
    root@46.149.70.219:/root/old-server-final-archive-*.tar.gz \
    ./migration-backups/old-server-archive/
  ```

- [ ] Delete PM2 processes
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 delete all"
  ```

- [ ] Disable PM2 startup
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 unstartup"
  ```

- [ ] Stop services
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl stop xray redis-server"
  ```

- [ ] Generate decommission report
- [ ] Document decommission date: `____________`

**After 30 Days Stable Operation:**

- [ ] Cancel old VPS subscription (via hosting provider panel)
- [ ] Document cancellation date: `____________`
- [ ] Archive old server data (retain for 1 year)

**Checkpoint**: Old server decommissioned

**Phase 6 Complete**: ⬜ All tasks completed

---

## Migration Summary

**Migration Type**: Timeweb Datacenter Migration (Moscow → St. Petersburg)
**Start Date**: `____________`
**End Date**: `____________`
**Total Duration**: `___ days`
**Downtime**: `___ hours ___ minutes`

**Final Status**: ⬜ SUCCESS | ⬜ PARTIAL SUCCESS | ⬜ FAILURE

### Success Metrics Achieved

**Primary Metrics:**
- [ ] Uptime >99.9% (7 days): ____%
- [ ] Database latency <1ms: ___ ms
- [ ] Zero data loss: Yes / No
- [ ] Message success rate >98%: ____%
- [ ] Downtime <4 hours: ___ hours

**Secondary Metrics:**
- [ ] AI response time 9-15s: ___ s
- [ ] Service stability <3 restarts/day: ___ restarts
- [ ] Resource usage <75%: ____%
- [ ] Disk usage <50%: ____%
- [ ] Baileys file count 162-220: ___ files

**Operational Metrics:**
- [ ] Rollback events: ___ (target: 0)
- [ ] Critical errors: ___ (target: 0)
- [ ] Timeline met: Yes / No
- [ ] Team satisfaction: ⬜ High | ⬜ Medium | ⬜ Low

### Issues Encountered

1. **Issue**: ________________
   - **Resolution**: ________________
   - **Impact**: ________________

2. **Issue**: ________________
   - **Resolution**: ________________
   - **Impact**: ________________

### Lessons Learned

1. ________________
2. ________________
3. ________________

### Recommendations for Future Migrations

1. ________________
2. ________________
3. ________________

---

**Migration Completed By**: ________________
**Report Generated**: `____________`
**Status**: ⬜ ARCHIVED

