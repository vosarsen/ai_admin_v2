# Datacenter Migration Tasks Checklist
**Last Updated: 2025-11-09**

---

## 📊 CURRENT STATUS OVERVIEW

**Completed Phases:**
- ✅ Phase 0 (Database Migration): COMPLETE (2025-11-06)
  - Baileys WhatsApp migrated to Timeweb PostgreSQL
  - 1 auth + 728 keys successfully transferred
  - All 7 services online and stable
  - 25+ hours of stable operation confirmed

**In Progress:**
- 🔄 Phase 0.6: Post-Switchover Testing
  - Day 0-1 complete, monitoring Days 2-7
  - Next check: Day 3 (2025-11-09)

**Blocked - Awaiting Prerequisites:**
- ⏸️ Phase 1 (Code Migration): ON HOLD
  - Requires Phase 0.8, 0.9, 0.95, 0.97 completion first
  - Estimated 11-15 days of prerequisite work needed

**Not Started:**
- ⬜ Phase 0.8: Schema Migration (3-4 days) - CRITICAL BLOCKER
- ⬜ Phase 0.9: Query Pattern Library (4-5 days) - CRITICAL BLOCKER
- ⬜ Phase 0.95: Risk Mitigation Setup (2-3 days) - HIGHLY RECOMMENDED
- ⬜ Phase 0.97: Testing Infrastructure (2-3 days) - HIGHLY RECOMMENDED

**Next Immediate Action:** Begin Phase 0.8 (Schema Migration) once Phase 0 stability confirmed (Day 7: 2025-11-13)

**Updated Timeline:** 5-6 weeks total (revised from 3-4 days based on plan review)

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
**Duration**: ~30 minutes ACTUAL (was estimated 10-12 hours)
**Status**: ✅ **COMPLETED 2025-11-06 16:58 UTC**
**Downtime**: 10-15 minutes (Phase 0.5)

**✅ PHASE 0 SUCCESS**: All data migrated, all services online, WhatsApp connected

### 0.1 Prepare Timeweb PostgreSQL ✅ COMPLETE

- [x] ✅ SSL certificate installed: `/root/.cloud-certs/root.crt`
- [x] ✅ Verify Timeweb PostgreSQL accessible via SSL
  - Host: `a84c973324fdaccfc68d929d.twc1.net:5432`
  - PostgreSQL 18.0 confirmed
- [x] ✅ Database `default_db` exists and accessible
- [x] ⚠️ Discovery: Internal IP 192.168.0.4 NOT accessible from Moscow datacenter

### 0.2 Migrate Database Schema ✅ COMPLETE

- [x] ✅ Applied `migrations/20251007_create_whatsapp_auth_tables.sql`
- [x] ✅ Applied `migrations/20251008_optimize_whatsapp_keys.sql`
- [x] ✅ Verified whatsapp_auth table exists
- [x] ✅ Verified whatsapp_keys table exists
- [x] ✅ Indexes and constraints created
- [x] ⚠️ Fixed: Dropped problematic index `idx_whatsapp_keys_company_type_id` (JSONB size limit)

### 0.3 Migrate Data ✅ COMPLETE

- [x] ✅ Created migration script with SSL support
- [x] ✅ Installed missing module: `npm install pg`
- [x] ✅ Ran full migration: `node /opt/ai-admin/migrate-now.js`
- [x] ✅ Verified whatsapp_auth: 1 record (company_962302)
- [x] ✅ Verified whatsapp_keys: **728 keys** migrated (was 335, data grew)
- [x] ✅ No errors during migration
- [x] ✅ Duration: ~20 seconds

### 0.4 Verification ✅ COMPLETE

- [x] ✅ Count records match Supabase: 1 auth + 728 keys
- [x] ✅ JSONB data types correct
- [x] ✅ No data corruption detected
- [x] ✅ Perfect match: Supabase 728 = Timeweb 728

### 0.5 Database Switchover ✅ COMPLETE

**✅ MAINTENANCE WINDOW COMPLETED: 2025-11-06 16:56:38 Moscow Time**

- [x] ✅ All 7 PM2 services stopped
- [x] ✅ Backup created: `.env.backup.before-timeweb-20251106_165638`
- [x] ✅ Updated .env:
  - `USE_LEGACY_SUPABASE=false`
  - `POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net`
  - `POSTGRES_PORT=5432`
  - `POSTGRES_DATABASE=default_db`
  - `POSTGRES_USER=gen_user`
  - `POSTGRES_PASSWORD=}X|oM595A<7n?0`
  - `PGSSLROOTCERT=/root/.cloud-certs/root.crt`
- [x] ✅ All services restarted
- [x] ✅ All services online (7/7)
- [x] ✅ WhatsApp connected
- [x] ✅ Test message sent successfully

**✅ GO Decision Made - All checks passed**

### 0.6 Post-Switchover Testing (IN PROGRESS - Day 0)

- [x] ✅ **Day 0**: Initial verification complete (16:57:00)
  - All 7 services online
  - WhatsApp connected (company 962302)
  - Database queries working
  - 728 keys loaded from Timeweb
  - No errors after switchover
  - Test message processed
- [ ] 🔄 **Day 1**: 24-hour uptime check (due: 2025-11-07 16:56)
- [ ] 🔄 **Day 2-6**: Daily health checks
- [ ] 🔄 **Day 7**: 7-day stability confirmed (due: 2025-11-13)
- [ ] 🔄 **Ready for Phase 1** (Server Migration)

**Metrics Tracking:**

| Day | Date | Uptime % | WhatsApp | DB Query Time | Success Rate | Errors | Notes |
|-----|------|----------|----------|---------------|--------------|--------|-------|
| 0 | 2025-11-06 | 100% | ✅ Connected | ~20-50ms | 100% | 0 | Switchover 16:56, all services online |
| 1 | 2025-11-07 | ___% | ___ | ___ms | ___% | ___ | Check @ 16:56 |
| 3 | 2025-11-09 | ___% | ___ | ___ms | ___% | ___ | Mid-week check |
| 7 | 2025-11-13 | ___% | ___ | ___ms | ___% | ___ | Final stability check |

**Monitoring Commands:**
```bash
# Daily health check
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status && pm2 logs --nostream --lines 20 | grep -iE 'error|connected'"

# Check WhatsApp
pm2 logs baileys-whatsapp-service --lines 50 | grep "WhatsApp connected"

# Check database
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
psql 'postgresql://gen_user:PASSWORD@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full' -c "SELECT COUNT(*) FROM whatsapp_keys;"
```

**Checkpoint**: ✅ Phase 0 COMPLETE - Database migration successful, monitoring for 7 days before Phase 1

---

## 🔄 PHASE 0.7 COMPLETE - Phase 1 Prerequisites Required

**Status Update (2025-11-08):** Phase 0.7 deployed and stable, but plan review identified critical prerequisites for Phase 1.

**Next Steps:**
- Phase 0.8: Schema Migration (3-4 days) - **MANDATORY**
- Phase 0.9: Query Pattern Library (4-5 days) - **CRITICAL**
- Phase 0.95: Risk Mitigation Setup (2-3 days) - **RECOMMENDED**
- Phase 0.97: Testing Infrastructure (2-3 days) - **RECOMMENDED**
- Then: Phase 1 Code Migration (3 weeks)

**Total Timeline to Phase 1 Complete:** 5-6 weeks

---

## Phase 0.8: Database Schema Migration (Day 1-4)

**Goal**: Create all required database tables in Timeweb PostgreSQL
**Duration**: ~3-4 days (26 hours)
**Status**: ⬜ Not Started
**Priority**: 🔴 **CRITICAL - BLOCKING Phase 1**

### 0.8.1 Export and Analyze Supabase Schema (Day 1, ~4 hours)

- [ ] Connect to Supabase database
  ```bash
  # Using Supabase Studio or pg_dump
  pg_dump --schema-only <SUPABASE_CONNECTION> > supabase-schema.sql
  ```

- [ ] Analyze all tables required
  ```bash
  # List all tables
  psql <SUPABASE_CONNECTION> -c "\dt"

  # Count records per table
  psql <SUPABASE_CONNECTION> -c "
  SELECT
    schemaname,
    tablename,
    n_tup_ins - n_tup_del as rowcount
  FROM pg_stat_user_tables
  ORDER BY rowcount DESC;
  "
  ```

- [ ] Document table dependencies
  - [ ] Identify foreign key relationships
  - [ ] Create dependency graph
  - [ ] Determine creation order

- [ ] Identify Supabase-specific features
  - [ ] Row Level Security (RLS) policies
  - [ ] Custom PostgreSQL functions
  - [ ] Triggers
  - [ ] Extensions used

- [ ] Document schema differences needed for Timeweb
  - [ ] UUID vs Serial IDs
  - [ ] Timestamp defaults
  - [ ] JSON vs JSONB
  - [ ] Array types

**Checkpoint**: Schema fully documented and analyzed

### 0.8.2 Create Core Tables (Day 1-2, ~8 hours)

**Table Creation Order (dependencies first):**

- [ ] Create `companies` table
  ```sql
  CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `clients` table (1,299 records)
  ```sql
  CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `services` table (63 records)
  ```sql
  CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    title VARCHAR(255) NOT NULL,
    duration INTEGER,
    cost DECIMAL(10,2),
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `staff` table (12 records)
  ```sql
  CREATE TABLE staff (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255),
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `staff_schedules` table (56+ records)
  ```sql
  CREATE TABLE staff_schedules (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    available BOOLEAN DEFAULT true,
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `bookings` table (38 records)
  ```sql
  CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    service_id INTEGER REFERENCES services(id),
    staff_id INTEGER REFERENCES staff(id),
    datetime TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `appointments_cache` table
- [ ] Create `dialog_contexts` table (21 records)
  ```sql
  CREATE TABLE dialog_contexts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    context JSONB,
    expires_at TIMESTAMP,
    -- ... other fields
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Create `reminders` table
- [ ] Create `sync_status` table

**Checkpoint**: All core tables created

### 0.8.3 Create Partitioned Messages Table (Day 2, ~4 hours)

- [ ] Design partition strategy
  - [ ] Partition by date range (recommended)
  - [ ] Or partition by company_id
  - [ ] Define retention policy

- [ ] Create parent table
  ```sql
  CREATE TABLE messages (
    id BIGSERIAL,
    company_id INTEGER NOT NULL,
    phone VARCHAR(20) NOT NULL,
    message TEXT,
    direction VARCHAR(10), -- 'inbound' | 'outbound'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
  ) PARTITION BY RANGE (created_at);
  ```

- [ ] Create initial partitions
  ```sql
  -- Current month
  CREATE TABLE messages_2025_11 PARTITION OF messages
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

  -- Next month
  CREATE TABLE messages_2025_12 PARTITION OF messages
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

  -- Future months (create 3 months ahead)
  CREATE TABLE messages_2026_01 PARTITION OF messages
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
  ```

- [ ] Create partition maintenance script
  ```bash
  cat > scripts/maintain-message-partitions.sh << 'EOF'
  #!/bin/bash
  # Automatically create next month's partition
  # Run via cron: 0 0 1 * * /opt/ai-admin/scripts/maintain-message-partitions.sh
  EOF
  chmod +x scripts/maintain-message-partitions.sh
  ```

- [ ] Test partition switching
  - [ ] Insert test data spanning multiple months
  - [ ] Verify data lands in correct partitions
  - [ ] Test query performance

**Checkpoint**: Partitioned messages table operational

### 0.8.4 Create Indexes (Day 2-3, ~4 hours)

- [ ] Create indexes on `clients`
  ```sql
  CREATE INDEX idx_clients_phone ON clients(phone);
  CREATE INDEX idx_clients_company_id ON clients(company_id);
  CREATE INDEX idx_clients_created_at ON clients(created_at);
  ```

- [ ] Create indexes on `bookings`
  ```sql
  CREATE INDEX idx_bookings_client_id ON bookings(client_id);
  CREATE INDEX idx_bookings_staff_id ON bookings(staff_id);
  CREATE INDEX idx_bookings_service_id ON bookings(service_id);
  CREATE INDEX idx_bookings_datetime ON bookings(datetime);
  CREATE INDEX idx_bookings_status ON bookings(status);
  CREATE INDEX idx_bookings_company_datetime ON bookings(company_id, datetime);
  ```

- [ ] Create indexes on `services`
  ```sql
  CREATE INDEX idx_services_company_id ON services(company_id);
  ```

- [ ] Create indexes on `staff`
  ```sql
  CREATE INDEX idx_staff_company_id ON staff(company_id);
  ```

- [ ] Create indexes on `staff_schedules`
  ```sql
  CREATE INDEX idx_schedules_staff_date ON staff_schedules(staff_id, date);
  CREATE INDEX idx_schedules_date ON staff_schedules(date);
  ```

- [ ] Create indexes on `messages`
  ```sql
  CREATE INDEX idx_messages_phone ON messages(phone);
  CREATE INDEX idx_messages_company_created ON messages(company_id, created_at);
  ```

- [ ] Create indexes on `dialog_contexts`
  ```sql
  CREATE INDEX idx_contexts_phone ON dialog_contexts(phone);
  CREATE INDEX idx_contexts_expires ON dialog_contexts(expires_at);
  ```

- [ ] Verify index creation
  ```sql
  SELECT
    tablename,
    indexname,
    indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
  ```

**Checkpoint**: All indexes created and verified

### 0.8.5 Verify Constraints and Foreign Keys (Day 3, ~4 hours)

- [ ] Verify NOT NULL constraints
  ```sql
  SELECT
    table_name,
    column_name,
    is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND is_nullable = 'NO';
  ```

- [ ] Verify UNIQUE constraints
- [ ] Verify CHECK constraints
- [ ] Verify DEFAULT values
- [ ] Verify foreign key constraints
  ```sql
  SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY';
  ```

- [ ] Test constraint enforcement
  - [ ] Try inserting invalid data
  - [ ] Verify constraints block it
  - [ ] Test cascading deletes (if applicable)

**Checkpoint**: All constraints verified

### 0.8.6 Test Schema with Sample Data (Day 3-4, ~4 hours)

- [ ] Create test data generation script
  ```javascript
  // scripts/generate-test-data.js
  // Insert sample records for each table
  ```

- [ ] Insert test data
  - [ ] 1 company
  - [ ] 10 clients
  - [ ] 5 services
  - [ ] 3 staff members
  - [ ] 10 staff schedules
  - [ ] 5 bookings
  - [ ] 20 messages

- [ ] Test foreign key relationships
  - [ ] Booking references client, service, staff
  - [ ] All references resolve correctly

- [ ] Test query patterns
  ```sql
  -- Test JOIN query
  SELECT
    b.*,
    c.name as client_name,
    s.title as service_title,
    st.name as staff_name
  FROM bookings b
  LEFT JOIN clients c ON b.client_id = c.id
  LEFT JOIN services s ON b.service_id = s.id
  LEFT JOIN staff st ON b.staff_id = st.id
  WHERE b.company_id = 962302;
  ```

- [ ] Measure query performance
  - [ ] All queries <100ms on test data
  - [ ] Document slow queries for optimization

- [ ] Clean up test data
  ```sql
  TRUNCATE TABLE bookings CASCADE;
  TRUNCATE TABLE staff_schedules CASCADE;
  TRUNCATE TABLE clients CASCADE;
  TRUNCATE TABLE services CASCADE;
  TRUNCATE TABLE staff CASCADE;
  TRUNCATE TABLE companies CASCADE;
  TRUNCATE TABLE messages CASCADE;
  ```

**Checkpoint**: Schema tested and validated

### 0.8.7 Document Schema Differences (Day 4, ~2 hours)

- [ ] Create schema documentation file
  ```markdown
  # Timeweb PostgreSQL Schema Documentation

  ## Tables Created
  - companies (1 record expected)
  - clients (1,299 records expected)
  - services (63 records expected)
  - staff (12 records expected)
  - staff_schedules (56+ records expected)
  - bookings (38 records expected)
  - appointments_cache
  - dialog_contexts (21 records expected)
  - reminders
  - sync_status
  - messages (partitioned)

  ## Differences from Supabase
  - ...

  ## Indexes Created
  - ...

  ## Partitioning Strategy
  - messages table partitioned by created_at (monthly)
  ```

- [ ] Document migration notes
- [ ] Create rollback scripts
  ```sql
  -- scripts/rollback-schema.sql
  DROP TABLE IF EXISTS messages CASCADE;
  DROP TABLE IF EXISTS bookings CASCADE;
  -- ...
  ```

- [ ] Update main plan with actual timeline

**Phase 0.8 Complete**: ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 0.9: Query Pattern Library (Day 5-9)

**Goal**: Extract Supabase query patterns and create PostgreSQL equivalents
**Duration**: ~4-5 days (32 hours)
**Status**: ⬜ Not Started
**Priority**: 🔴 **CRITICAL - BLOCKING Phase 1**

### 0.9.1 Audit Supabase Query Patterns (Day 5-6, ~8 hours)

- [ ] Search codebase for Supabase usage
  ```bash
  # Find all files using Supabase
  grep -r "supabase.from" src/ --include="*.js" > supabase-usage.txt

  # Count occurrences
  grep -r "supabase.from" src/ --include="*.js" | wc -l
  ```

- [ ] Categorize query patterns
  - [ ] Simple SELECT: `.from().select().eq()`
  - [ ] SELECT with filters: `.gte()`, `.lte()`, `.in()`
  - [ ] SELECT with JOINs: `.select('*, table(field)')`
  - [ ] SELECT with ordering: `.order()`
  - [ ] SELECT with pagination: `.range()`
  - [ ] INSERT: `.insert()`
  - [ ] UPDATE: `.update().eq()`
  - [ ] DELETE: `.delete().eq()`
  - [ ] UPSERT: `.upsert()`
  - [ ] Single vs Maybe Single: `.single()`, `.maybeSingle()`

- [ ] Extract unique patterns
  ```bash
  # Create pattern catalog
  cat > docs/supabase-query-patterns.md << 'EOF'
  # Supabase Query Patterns Catalog

  ## Pattern 1: Simple Select
  ### Supabase
  ```javascript
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phone)
    .single();
  ```

  ### PostgreSQL
  ```javascript
  const result = await postgres.query(
    'SELECT * FROM clients WHERE phone = $1 LIMIT 1',
    [phone]
  );
  const data = result.rows[0];
  ```
  EOF
  ```

- [ ] Document complex patterns from `supabase-data-layer.js` (977 lines)
  - [ ] Extract top 20 most complex queries
  - [ ] Document JOIN patterns
  - [ ] Document aggregation patterns
  - [ ] Document JSON field access

**Checkpoint**: All query patterns documented

### 0.9.2 Create PostgreSQL Equivalents (Day 6-8, ~12 hours)

- [ ] Create query transformation library
  ```javascript
  // src/database/query-patterns.js

  /**
   * Simple select with filter
   */
  async function selectByField(table, field, value) {
    const result = await postgres.query(
      `SELECT * FROM ${table} WHERE ${field} = $1`,
      [value]
    );
    return { data: result.rows, error: null };
  }

  /**
   * Select with JOIN
   */
  async function selectWithJoin(/* ... */) {
    // Implementation
  }
  ```

- [ ] Implement all pattern transformations
  - [ ] Simple SELECT patterns
  - [ ] Complex JOIN patterns
  - [ ] Filter patterns (eq, gte, lte, in)
  - [ ] Ordering and pagination
  - [ ] INSERT patterns
  - [ ] UPDATE patterns
  - [ ] DELETE patterns
  - [ ] UPSERT patterns

- [ ] Handle edge cases
  - [ ] NULL handling
  - [ ] Array parameters (`.in()` → `ANY($1::text[])`)
  - [ ] JSON field access
  - [ ] Full-text search
  - [ ] Date/time formatting

- [ ] Create error handling wrapper
  ```javascript
  async function safeQuery(sql, params) {
    try {
      const result = await postgres.query(sql, params);
      return { data: result.rows, error: null };
    } catch (error) {
      logger.error('Query error:', error);
      Sentry.captureException(error);
      return { data: null, error };
    }
  }
  ```

**Checkpoint**: All PostgreSQL equivalents created

### 0.9.3 Build Test Suite (Day 8-9, ~8 hours)

- [ ] Create test framework
  ```javascript
  // tests/query-patterns.test.js
  const { describe, it, expect } = require('@jest/globals');

  describe('Query Pattern Transformations', () => {
    it('should transform simple select', async () => {
      // Test implementation
    });

    it('should handle NULL values', async () => {
      // Test implementation
    });
  });
  ```

- [ ] Write tests for each pattern
  - [ ] Test simple SELECT
  - [ ] Test complex JOINs
  - [ ] Test filters (eq, gte, lte, in)
  - [ ] Test ordering
  - [ ] Test pagination
  - [ ] Test INSERT
  - [ ] Test UPDATE
  - [ ] Test DELETE
  - [ ] Test UPSERT

- [ ] Test edge cases
  - [ ] NULL handling
  - [ ] Empty arrays
  - [ ] Special characters in strings
  - [ ] Large datasets
  - [ ] Concurrent queries

- [ ] Run test suite
  ```bash
  npm test -- query-patterns.test.js
  ```

- [ ] Fix failing tests
- [ ] Achieve 100% pattern coverage

**Checkpoint**: Test suite passing with 100% coverage

### 0.9.4 Document Edge Cases (Day 9, ~4 hours)

- [ ] Create edge cases documentation
  ```markdown
  # Query Transformation Edge Cases

  ## 1. NULL Handling

  ### Supabase
  `.is('field', null)` or `.eq('field', null)`

  ### PostgreSQL
  `WHERE field IS NULL` (NOT `= NULL`)

  ## 2. Array Parameters

  ### Supabase
  `.in('status', ['confirmed', 'pending'])`

  ### PostgreSQL
  `WHERE status = ANY($1::text[])`
  Pass: `[['confirmed', 'pending']]`

  ## 3. Single vs MaybeSingle

  ### Supabase .single()
  - Throws error if >1 row
  - Throws error if 0 rows

  ### Supabase .maybeSingle()
  - Returns null if 0 rows
  - Throws error if >1 row

  ### PostgreSQL
  ```javascript
  // .single() equivalent
  const result = await postgres.query(sql, params);
  if (result.rows.length === 0) throw new Error('No rows');
  if (result.rows.length > 1) throw new Error('Multiple rows');
  return result.rows[0];

  // .maybeSingle() equivalent
  const result = await postgres.query(sql, params);
  if (result.rows.length > 1) throw new Error('Multiple rows');
  return result.rows[0] || null;
  ```
  ```

- [ ] Document common pitfalls
- [ ] Create troubleshooting guide
- [ ] Add examples for each edge case

**Phase 0.9 Complete**: ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 0.95: Risk Mitigation Setup (Day 10-12)

**Goal**: Configure connection pool, monitoring, error handling
**Duration**: ~2-3 days (16-24 hours)
**Status**: ⬜ Not Started
**Priority**: 🟡 **HIGHLY RECOMMENDED**

### 0.95.1 Configure Connection Pool (Day 10, ~4 hours)

- [ ] Update `src/database/postgres.js` with proper configuration
  ```javascript
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.TIMEWEB_DATABASE_URL,

    // Connection limits
    min: 2,                      // Keep 2 connections alive
    max: 20,                     // Max 20 concurrent

    // Timeouts
    idleTimeoutMillis: 30000,    // Close idle after 30s
    connectionTimeoutMillis: 10000,  // Wait 10s for connection

    // Health checks
    allowExitOnIdle: false,

    // Error handling
    statement_timeout: 30000,    // Kill queries after 30s
    query_timeout: 30000,        // Client-side timeout
  });

  // Handle pool errors
  pool.on('error', (err, client) => {
    logger.error('Unexpected pool error:', err);
    Sentry.captureException(err);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await pool.end();
    process.exit(0);
  });

  module.exports = pool;
  ```

- [ ] Add pool stats endpoint
  ```javascript
  // src/api/routes/health.js
  router.get('/health/database/pool', async (req, res) => {
    res.json({
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  });
  ```

- [ ] Test pool under load
- [ ] Verify connection limits
- [ ] Document pool configuration

**Checkpoint**: Connection pool properly configured

### 0.95.2 Add Performance Instrumentation (Day 10-11, ~6 hours)

- [ ] Add query timing wrapper
  ```javascript
  // src/database/instrumented-query.js
  async function query(sql, params) {
    const start = Date.now();
    const spanId = generateSpanId();

    logger.info('Query started', { spanId, sql: sql.substring(0, 100) });

    try {
      const result = await pool.query(sql, params);
      const duration = Date.now() - start;

      logger.info('Query succeeded', {
        spanId,
        duration,
        rows: result.rowCount
      });

      // Send to monitoring
      metrics.histogram('db.query.duration', duration, {
        query: sql.split(' ')[0] // SELECT, INSERT, etc.
      });

      // Warn on slow queries
      if (duration > 100) {
        logger.warn('Slow query detected', { spanId, duration, sql });
      }

      return result;
    } catch (error) {
      logger.error('Query failed', { spanId, error, sql, params });
      metrics.increment('db.query.errors', {
        query: sql.split(' ')[0]
      });
      throw error;
    }
  }
  ```

- [ ] Add Prometheus metrics
  ```javascript
  // src/monitoring/metrics.js
  const client = require('prom-client');

  const queryDuration = new client.Histogram({
    name: 'db_query_duration_ms',
    help: 'Database query duration',
    labelNames: ['query_type'],
    buckets: [10, 50, 100, 500, 1000, 5000]
  });

  const queryErrors = new client.Counter({
    name: 'db_query_errors_total',
    help: 'Database query errors',
    labelNames: ['query_type']
  });
  ```

- [ ] Create metrics endpoint
  ```javascript
  router.get('/metrics', (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(client.register.metrics());
  });
  ```

**Checkpoint**: Performance instrumentation added

### 0.95.3 Create Monitoring Dashboard (Day 11, ~4 hours)

- [ ] Set up Grafana dashboard (or alternative)
- [ ] Add database metrics panel
  - [ ] Query duration (P50, P95, P99)
  - [ ] Query rate (queries/second)
  - [ ] Error rate
  - [ ] Connection pool stats
  - [ ] Slow query count

- [ ] Add alerting rules
  - [ ] Alert if P95 latency >100ms
  - [ ] Alert if error rate >5%
  - [ ] Alert if pool exhausted
  - [ ] Alert if slow queries >10/min

- [ ] Test dashboard and alerts

**Checkpoint**: Monitoring dashboard operational

### 0.95.4 Define Error Handling Standard (Day 11-12, ~4 hours)

- [ ] Choose error handling pattern
  ```javascript
  // Option 1: Try/Catch (chosen)
  async function getClient(phone) {
    try {
      const result = await postgres.query(
        'SELECT * FROM clients WHERE phone = $1 LIMIT 1',
        [phone]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get client:', error);
      Sentry.captureException(error);
      throw error; // or return null, depending on requirements
    }
  }
  ```

- [ ] Create error handling utilities
  ```javascript
  // src/utils/db-errors.js
  function isConnectionError(error) {
    return error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT';
  }

  function isConstraintError(error) {
    return error.code === '23505' || // unique violation
           error.code === '23503';   // foreign key violation
  }
  ```

- [ ] Document error handling standard
- [ ] Create code style guide
- [ ] Add linter rules (if applicable)

**Checkpoint**: Error handling standard defined

### 0.95.5 Write Rollback Runbook (Day 12, ~2-4 hours)

- [ ] Document rollback procedure
  ```markdown
  # Phase 1 Rollback Runbook

  ## When to Rollback
  - Database connection failures
  - >100 errors/hour
  - Message processing stops >5min
  - Any PRIMARY success criteria not met

  ## Rollback Steps (<5 minutes)

  1. Stop all services
  ```bash
  pm2 stop all
  ```

  2. Switch to Supabase
  ```bash
  export USE_LEGACY_SUPABASE=true
  # Update .env file
  sed -i 's/USE_LEGACY_SUPABASE=false/USE_LEGACY_SUPABASE=true/' .env
  ```

  3. Restart services
  ```bash
  pm2 start all
  ```

  4. Verify
  ```bash
  pm2 status
  curl http://localhost:3000/health
  ```
  ```

- [ ] Create automated rollback script
  ```bash
  #!/bin/bash
  # scripts/rollback-to-supabase.sh
  echo "🔄 Rolling back to Supabase..."
  pm2 stop all
  sed -i 's/USE_LEGACY_SUPABASE=false/USE_LEGACY_SUPABASE=true/' /opt/ai-admin/.env
  pm2 start all
  echo "✅ Rollback complete"
  pm2 status
  ```

- [ ] Test rollback in staging
- [ ] Document recovery procedures

**Phase 0.95 Complete**: ⬜ All tasks completed | Actual Duration: ___ days

---

## Phase 0.97: Testing Infrastructure (Day 13-15)

**Goal**: Set up comprehensive testing framework
**Duration**: ~2-3 days (16-24 hours)
**Status**: ⬜ Not Started
**Priority**: 🟡 **HIGHLY RECOMMENDED**

### 0.97.1 Unit Testing Setup (Day 13, ~8 hours)

- [ ] Set up Jest testing framework
  ```bash
  npm install --save-dev jest @types/jest
  ```

- [ ] Configure Jest
  ```javascript
  // jest.config.js
  module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
      'src/**/*.js',
      '!src/**/*.test.js'
    ],
    testMatch: [
      '**/__tests__/**/*.js',
      '**/*.test.js'
    ]
  };
  ```

- [ ] Write unit tests for repositories
  ```javascript
  // src/repositories/__tests__/ClientRepository.test.js
  const ClientRepository = require('../ClientRepository');

  describe('ClientRepository', () => {
    let repo;
    let mockDb;

    beforeEach(() => {
      mockDb = {
        query: jest.fn()
      };
      repo = new ClientRepository(mockDb);
    });

    it('should find client by phone', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 1, phone: '79001234567', name: 'Test' }]
      });

      const client = await repo.findByPhone('79001234567');

      expect(client).toEqual({ id: 1, phone: '79001234567', name: 'Test' });
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM clients WHERE phone = $1 LIMIT 1',
        ['79001234567']
      );
    });
  });
  ```

- [ ] Write unit tests for services
- [ ] Write unit tests for query patterns
- [ ] Achieve >80% code coverage

**Checkpoint**: Unit tests operational

### 0.97.2 Integration Testing Setup (Day 13-14, ~8 hours)

- [ ] Set up test database
  ```bash
  # Create test database in Timeweb
  psql "postgresql://..." -c "CREATE DATABASE ai_admin_test;"
  ```

- [ ] Create test data fixtures
  ```javascript
  // tests/fixtures/test-data.js
  module.exports = {
    companies: [{ id: 1, name: 'Test Company' }],
    clients: [
      { id: 1, company_id: 1, phone: '79001234567', name: 'Test Client' }
    ],
    services: [
      { id: 1, company_id: 1, title: 'Test Service', duration: 60, cost: 1000 }
    ]
  };
  ```

- [ ] Write integration tests for sync system
  ```javascript
  // tests/integration/clients-sync.test.js
  describe('Clients Sync', () => {
    beforeAll(async () => {
      // Set up test database
      await setupTestDB();
    });

    afterAll(async () => {
      // Clean up test database
      await cleanupTestDB();
    });

    it('should sync clients from YClients to Timeweb', async () => {
      // Test implementation
    });
  });
  ```

- [ ] Write integration tests for API endpoints
- [ ] Write integration tests for message processing

**Checkpoint**: Integration tests operational

### 0.97.3 Load Testing Setup (Day 14-15, ~6 hours)

- [ ] Install Artillery
  ```bash
  npm install --save-dev artillery
  ```

- [ ] Create load test scenarios
  ```yaml
  # tests/load/api-load-test.yml
  config:
    target: "http://localhost:3000"
    phases:
      - duration: 60
        arrivalRate: 10  # 10 requests/sec
        name: "Warm up"
      - duration: 120
        arrivalRate: 50  # 50 requests/sec
        name: "Sustained load"
      - duration: 60
        arrivalRate: 100  # 100 requests/sec
        name: "Peak load"

  scenarios:
    - name: "Message processing"
      flow:
        - post:
            url: "/api/messages"
            json:
              phone: "79001234567"
              message: "Test message"
  ```

- [ ] Run baseline load tests against Supabase
  ```bash
  artillery run tests/load/api-load-test.yml --output baseline-report.json
  artillery report baseline-report.json
  ```

- [ ] Document baseline metrics
  - [ ] P50 latency: ___ ms
  - [ ] P95 latency: ___ ms
  - [ ] P99 latency: ___ ms
  - [ ] Max throughput: ___ req/sec
  - [ ] Error rate: ___ %

- [ ] Create load test for Timeweb (to run after Phase 1)

**Checkpoint**: Load testing framework ready

### 0.97.4 Rollback Drill (Day 15, ~4 hours)

- [ ] Set up staging environment
  - [ ] Clone production data (subset)
  - [ ] Configure for testing
  - [ ] Verify isolated from production

- [ ] Practice rollback procedure
  1. [ ] Simulate Phase 1 migration
  2. [ ] Trigger rollback
  3. [ ] Measure rollback time: ___ minutes
  4. [ ] Verify system functional after rollback
  5. [ ] Document any issues

- [ ] Refine rollback procedure based on learnings
- [ ] Update rollback runbook
- [ ] Train team on rollback procedure

**Checkpoint**: Rollback procedure tested and verified

**Phase 0.97 Complete**: ⬜ All tasks completed | Actual Duration: ___ days

---

## ✅ Prerequisites Complete - Ready for Phase 1

**All prerequisites completed:**
- ✅ Phase 0.8: Schema Migration (12+ tables created)
- ✅ Phase 0.9: Query Pattern Library (all patterns documented and tested)
- ✅ Phase 0.95: Risk Mitigation (monitoring, error handling, rollback tested)
- ✅ Phase 0.97: Testing Infrastructure (unit, integration, load tests ready)

**Total Prerequisites Time:** ___ days (target: 11-15 days)

**Ready to proceed with Phase 1 Code Migration**

---

## Phase 1: Code Migration (Week 1-3)

**Goal**: Migrate all 49 files from Supabase to Timeweb PostgreSQL
**Duration**: ~3 weeks (15 days)
**Status**: ⬜ Not Started
**Prerequisites**: ✅ Phases 0.8, 0.9, 0.95, 0.97 complete

**Note:** This section replaces original "Phase 1: Server Migration Preparation"

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

