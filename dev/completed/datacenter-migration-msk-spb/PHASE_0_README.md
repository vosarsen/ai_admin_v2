# Phase 0: Database Migration - Implementation Summary

**Created:** 2025-11-06
**Status:** Implementation Complete - Ready for Execution
**Developer:** Claude Code

---

## 📋 What Was Implemented

### Scripts Created

1. **`scripts/migrate-supabase-to-timeweb.js`** - Main migration script
   - Purpose: Migrate Baileys WhatsApp sessions from Supabase to Timeweb PostgreSQL
   - Features:
     - ✅ Migrates `whatsapp_auth` table (Baileys credentials)
     - ✅ Migrates `whatsapp_keys` table (Signal Protocol keys)
     - ✅ Supports dry-run mode (`--dry-run`)
     - ✅ Supports verify-only mode (`--verify-only`)
     - ✅ Batch processing for performance (100 records at a time)
     - ✅ Progress tracking with formatted output
     - ✅ Error handling and rollback support
     - ✅ Automatic data verification after migration
     - ✅ User confirmation before writing data
   - Usage:
     ```bash
     # Dry run (test without writing)
     node scripts/migrate-supabase-to-timeweb.js --dry-run

     # Verify counts only
     node scripts/migrate-supabase-to-timeweb.js --verify-only

     # Full migration
     node scripts/migrate-supabase-to-timeweb.js
     ```

2. **`scripts/setup-timeweb-tunnel.sh`** - SSH tunnel manager
   - Purpose: Create/manage SSH tunnel to Timeweb PostgreSQL
   - Features:
     - ✅ Start tunnel in background
     - ✅ Stop tunnel gracefully
     - ✅ Check tunnel status
     - ✅ Auto-restart tunnel
     - ✅ PID file management
     - ✅ Connection testing
   - Usage:
     ```bash
     # Start tunnel
     ./scripts/setup-timeweb-tunnel.sh start

     # Check status
     ./scripts/setup-timeweb-tunnel.sh status

     # Stop tunnel
     ./scripts/setup-timeweb-tunnel.sh stop

     # Restart tunnel
     ./scripts/setup-timeweb-tunnel.sh restart
     ```

### Documentation Created

1. **`PHASE_0_QUICK_START.md`** - Comprehensive execution guide
   - Complete step-by-step instructions for all Phase 0 sub-phases
   - Includes troubleshooting section
   - Emergency rollback procedures
   - Daily monitoring checklists
   - Success criteria and verification steps

2. **`dev/active/datacenter-migration-msk-spb/PHASE_0_README.md`** - This file
   - Implementation summary
   - Quick reference for developers
   - Integration with main migration plan

---

## 🎯 Implementation Completion Status

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 0.1 | Prepare Timeweb PostgreSQL | ✅ Complete | Tunnel script created |
| 0.2 | Migrate Database Schema | ⏳ Ready | Existing scripts can be used |
| 0.3 | Migrate Data | ✅ Complete | Migration script created |
| 0.4 | Verification | ⏳ Ready | Verification built into migration script |
| 0.5 | Database Switchover | ⏳ Ready | Step-by-step guide in PHASE_0_QUICK_START.md |
| 0.6 | Post-Switchover Testing | ⏳ Ready | Monitoring checklist provided |

**Legend:**
- ✅ Complete - Script/docs created and ready
- ⏳ Ready - Can proceed with existing tools
- ❌ Blocked - Cannot proceed

---

## 🚀 How to Execute Phase 0

### Quick Start

```bash
# 1. Read the guide
cat PHASE_0_QUICK_START.md

# 2. Setup SSH tunnel (if local)
./scripts/setup-timeweb-tunnel.sh start

# 3. Test connection
./scripts/test-timeweb-connection.sh

# 4. Apply schema
./scripts/apply-schema-timeweb.sh

# 5. Verify before migration
node scripts/migrate-supabase-to-timeweb.js --verify-only

# 6. Dry run
node scripts/migrate-supabase-to-timeweb.js --dry-run

# 7. Full migration
node scripts/migrate-supabase-to-timeweb.js

# 8. Follow PHASE_0_QUICK_START.md for remaining steps
```

### Prerequisites

- [ ] All packages installed: `npm install @supabase/supabase-js pg dotenv`
- [ ] PostgreSQL client installed
- [ ] `.env` configured with Supabase and Timeweb credentials
- [ ] SSH access to production server
- [ ] Backup of current `.env` file

---

## 📊 Migration Script Features

### Safety Features

1. **Dry Run Mode**
   - Test migration without writing any data
   - Shows what would be migrated
   - Verifies connections

2. **Verify-Only Mode**
   - Compare record counts between Supabase and Timeweb
   - Useful for checking migration success
   - No data written

3. **User Confirmation**
   - Script asks for confirmation before writing data
   - Clear warnings about what will happen
   - Easy to abort

4. **Automatic Verification**
   - After migration, automatically compares counts
   - Highlights any mismatches
   - Provides detailed summary

5. **Error Handling**
   - Catches and reports errors gracefully
   - Continues with other records if one fails
   - Detailed error messages

### Performance Features

1. **Batch Processing**
   - Processes 100 records at a time
   - Reduces memory usage
   - Shows progress updates

2. **Progress Tracking**
   - Real-time progress percentage
   - Formatted numbers (with commas)
   - Clear visual feedback

3. **Connection Pooling**
   - PostgreSQL connection pool (max 10)
   - Automatic connection management
   - Timeout handling

---

## 🔧 Technical Details

### Tables Migrated

#### whatsapp_auth
```sql
CREATE TABLE whatsapp_auth (
  company_id TEXT PRIMARY KEY,
  creds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expected data:**
- Records: 1 (company_962302)
- Size: ~10-50 KB
- Criticality: **CRITICAL** - Contains Baileys credentials

#### whatsapp_keys
```sql
CREATE TABLE whatsapp_keys (
  company_id TEXT NOT NULL,
  key_type TEXT NOT NULL,
  key_id TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (company_id, key_type, key_id)
);
```

**Expected data:**
- Records: 335 keys
- Types: app-state-sync-key, lid-mapping, session, etc.
- Size: ~500 KB - 1 MB
- Criticality: **CRITICAL** - Signal Protocol keys

### Connection Details

**Supabase:**
- URL: From `SUPABASE_URL` in `.env`
- Key: From `SUPABASE_KEY` in `.env`
- Library: `@supabase/supabase-js`

**Timeweb PostgreSQL:**
- Host: `192.168.0.4` (internal) or `localhost:5433` (via tunnel)
- Port: `5432` (internal) or `5433` (tunnel)
- Database: `default_db`
- User: `gen_user`
- Password: From `POSTGRES_PASSWORD` in `.env`
- Library: `pg` (node-postgres)

---

## 📖 Related Documentation

- **Main Plan:** `datacenter-migration-msk-spb-plan.md`
- **Tasks Checklist:** `datacenter-migration-msk-spb-tasks.md`
- **Context:** `datacenter-migration-msk-spb-context.md`
- **Quick Start:** `PHASE_0_QUICK_START.md` (root directory)

---

## ✅ Next Steps

1. **Review PHASE_0_QUICK_START.md** - Read full execution guide
2. **Test locally** - Run dry-run mode to verify everything works
3. **Schedule maintenance window** - Notify users 24h in advance
4. **Execute Phase 0** - Follow PHASE_0_QUICK_START.md step-by-step
5. **Monitor for 7 days** - Use monitoring checklist
6. **Proceed to Phase 1** - Server migration after successful Phase 0

---

## 🚨 Emergency Contacts

**If issues occur during migration:**

1. **Rollback to Supabase:** <5 minutes
   ```bash
   # Stop services
   pm2 stop all

   # Restore .env backup
   cp .env.backup.* .env

   # Set USE_LEGACY_SUPABASE=true
   nano .env

   # Restart services
   pm2 start all
   ```

2. **Check logs:**
   ```bash
   pm2 logs --lines 100 --nostream
   ```

3. **Verify rollback successful:**
   ```bash
   pm2 status
   # All services should be "online"
   ```

**Data loss risk:** None - Supabase retains all data during migration

---

## 📝 Developer Notes

### Key Decisions Made

1. **Two-stage migration approach**
   - Phase 0: Database first
   - Phase 1-6: Server second
   - Rationale: Separate risks, test DB independently

2. **Dry-run by default**
   - User must explicitly confirm before writing
   - Prevents accidental data modification
   - Encourages testing

3. **Batch processing**
   - 100 records per batch
   - Balance between performance and memory
   - Suitable for 335 keys

4. **SSH tunnel for local testing**
   - Allows local testing without VPS access
   - Easier development workflow
   - Script manages tunnel lifecycle

### Known Limitations

1. **No automatic rollback in script**
   - Manual rollback required if issues occur
   - Rationale: Safer to have human decision
   - Rollback is simple: restore .env

2. **No incremental migration**
   - Full table migration each time
   - Uses INSERT...ON CONFLICT for idempotency
   - Not an issue for small dataset (336 records)

3. **No progress persistence**
   - If script fails mid-migration, restart from beginning
   - ON CONFLICT ensures no duplicates
   - Not a concern for small dataset

### Future Improvements

1. **Progress persistence**
   - Save progress to temp file
   - Resume from last successful batch
   - Useful if migrating larger datasets

2. **Automatic rollback**
   - Auto-rollback on critical errors
   - Would require more complex state management
   - Current manual process is safer

3. **Migration history table**
   - Track migration runs in database
   - Store timestamps, counts, duration
   - Useful for audit trail

---

**Implementation by:** Claude Code
**Date:** 2025-11-06
**Status:** ✅ Ready for Execution
**Next Phase:** Execution (follow PHASE_0_QUICK_START.md)
