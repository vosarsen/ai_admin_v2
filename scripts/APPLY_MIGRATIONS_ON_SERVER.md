# Apply Phase 0.8 Migrations on Server

**Date:** 2025-11-09
**Purpose:** Instructions to apply Phase 0.8 schema migrations directly on the production server

---

## Prerequisites

- SSH access to production server: `46.149.70.219`
- Git repository updated with latest migrations

---

## Option 1: Run on Server (Recommended)

### Step 1: SSH to Server

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
```

### Step 2: Navigate to Project

```bash
cd /opt/ai-admin
```

### Step 3: Pull Latest Migrations

```bash
git fetch origin
git checkout main
git pull origin main
```

### Step 4: Verify Migration Files

```bash
ls -lh migrations/20251109*
```

Expected output:
- `migrations/20251109_create_business_tables_phase_08.sql`
- `migrations/20251109_create_partitioned_messages_table.sql`

### Step 5: Check Current Database Tables

```bash
node scripts/apply-migrations-direct.js
```

If this fails (USE_LEGACY_SUPABASE=true), use psql directly:

```bash
export PGSSLROOTCERT=/root/.cloud-certs/root.crt

psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full" -c "\dt"
```

### Step 6: Apply Migrations Using psql

```bash
# Migration 1: Business Tables
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full" \
  -f migrations/20251109_create_business_tables_phase_08.sql

# Migration 2: Partitioned Messages Table
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full" \
  -f migrations/20251109_create_partitioned_messages_table.sql
```

### Step 7: Verify Schema

```bash
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full" -c "
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

Expected tables:
- companies
- clients
- services
- staff
- staff_schedules
- bookings
- appointments_cache
- dialog_contexts
- reminders
- sync_status
- messages (parent table)
- messages_2025_11, messages_2025_12, ... (partitions)

### Step 8: Verify Indexes

```bash
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full" -c "
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'whatsapp_%'
GROUP BY tablename
ORDER BY tablename;
"
```

### Step 9: Test with Sample Data (Optional)

```bash
# Note: This requires USE_LEGACY_SUPABASE=false
# Temporarily set it for testing:
export USE_LEGACY_SUPABASE=false

node scripts/test-phase-08-schema.js

# Restore after testing:
export USE_LEGACY_SUPABASE=true
```

---

## Option 2: Create Standalone Migration Script (No Node.js)

If Node.js scripts don't work, use pure bash:

### Create Script on Server

```bash
cat > /opt/ai-admin/scripts/apply-migrations.sh << 'EOFSCRIPT'
#!/bin/bash

set -e

export PGSSLROOTCERT=/root/.cloud-certs/root.crt
PGCONNSTRING="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full"

echo "Applying Phase 0.8 migrations..."

echo "Migration 1: Business Tables"
psql "$PGCONNSTRING" -f /opt/ai-admin/migrations/20251109_create_business_tables_phase_08.sql

echo "Migration 2: Partitioned Messages"
psql "$PGCONNSTRING" -f /opt/ai-admin/migrations/20251109_create_partitioned_messages_table.sql

echo "Verifying schema..."
psql "$PGCONNSTRING" -c "\dt"

echo "✅ Migration complete!"
EOFSCRIPT

chmod +x /opt/ai-admin/scripts/apply-migrations.sh
```

### Run Script

```bash
/opt/ai-admin/scripts/apply-migrations.sh
```

---

## Verification Checklist

After migrations:

- [ ] All 11 required tables exist (companies, clients, services, staff, staff_schedules, bookings, appointments_cache, dialog_contexts, reminders, sync_status, messages)
- [ ] Message partitions created (6 months: messages_2025_11 through messages_2026_04)
- [ ] Indexes created (check with `\di` in psql)
- [ ] Foreign key constraints working (check with `\d bookings` - should show FK constraints)
- [ ] Functions created:
  - [ ] `get_database_stats()`
  - [ ] `get_messages_stats()`
  - [ ] `create_messages_partition(DATE)`
  - [ ] `maintain_messages_partitions()`
  - [ ] `cleanup_expired_dialog_contexts()`
  - [ ] `cleanup_expired_appointments_cache()`
  - [ ] `get_recent_messages(VARCHAR, INTEGER, INTEGER)`

---

## Troubleshooting

### Error: "relation already exists"

This is OK - migrations use `IF NOT EXISTS`, so they'll skip existing tables.

### Error: "index row requires X bytes, maximum size is 8191"

If this occurs with a JSONB index, the migration will drop that index. This is expected (same issue we had with whatsapp_keys).

### Error: "SSL connection required"

Make sure:
1. SSL certificate exists: `/root/.cloud-certs/root.crt`
2. Using `sslmode=verify-full` in connection string
3. Export `PGSSLROOTCERT` environment variable

### Connection refused

Check:
1. PostgreSQL host is correct: `a84c973324fdaccfc68d929d.twc1.net`
2. Port is 5432 (not 5433)
3. Server has network access to Timeweb PostgreSQL

---

## Next Steps After Migration

1. **Test Schema:** Run `node scripts/test-phase-08-schema.js` (requires USE_LEGACY_SUPABASE=false temporarily)
2. **Begin Phase 0.9:** Query Pattern Library development
3. **Data Migration Planning:** Prepare to migrate data from Supabase to Timeweb

---

## Rollback (If Needed)

To rollback migrations:

```bash
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
PGCONNSTRING="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full"

# Drop tables in reverse dependency order
psql "$PGCONNSTRING" << 'EOFSQL'
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS staff_schedules CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS appointments_cache CASCADE;
DROP TABLE IF EXISTS dialog_contexts CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS messages CASCADE;  -- This will drop all partitions
DROP TABLE IF EXISTS companies CASCADE;

DROP FUNCTION IF EXISTS get_database_stats() CASCADE;
DROP FUNCTION IF EXISTS get_messages_stats() CASCADE;
DROP FUNCTION IF EXISTS create_messages_partition(DATE) CASCADE;
DROP FUNCTION IF EXISTS maintain_messages_partitions() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_dialog_contexts() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_appointments_cache() CASCADE;
DROP FUNCTION IF EXISTS get_recent_messages(VARCHAR, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
EOFSQL
```

---

**Last Updated:** 2025-11-09
**Status:** Ready for execution on server
