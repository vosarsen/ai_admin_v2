# Database Connection Timeout - Runbook

**Pattern:** `(ConnectionTimeout|connection timed out|could not obtain.*connection|Pool.*timeout)`
**Severity:** High
**MTTR Target:** 5-10 minutes
**Last Updated:** 2025-11-24

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `ConnectionTimeout`, `connection timed out`, `could not obtain connection`
- Stack trace shows: `timeweb-postgres.js`, `BaseRepository`, `pg.Pool`
- Component tags: `database`, `timeweb`, `postgresql`
- Typically occurs: During high load or after database restart

**Examples:**
```
Error: Connection timeout - could not obtain connection from pool within 30s
  at timeweb-postgres.js:45
  at Pool.connect (node_modules/pg/lib/pool.js:42)
```

---

## 🔍 Diagnosis

**Root Cause:**
Database connection pool exhausted or PostgreSQL unresponsive.

**How to verify:**
```bash
# Step 1: Check PM2 services status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Step 2: Check PostgreSQL connection
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c 'SELECT NOW();'"

# Step 3: Check connection pool stats (if logging enabled)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100 | grep -i pool"
```

**Common Triggers:**
1. High concurrent load (multiple WhatsApp messages simultaneously)
2. Long-running queries blocking connections
3. Database maintenance or backup running
4. Network issues between server and Timeweb
5. Connection leak (connections not released)

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: Restart affected services (releases connections)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart ai-admin-worker-v2 ai-admin-api"

# Step 2: Check if services restarted successfully
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Step 3: Verify database connectivity
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c 'SELECT COUNT(*) FROM clients;'"
```

**Verification:**
```bash
# Check error logs for new connection errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 --err"
```

**Expected Result:**
- Services should restart cleanly (exit code 0)
- No more ConnectionTimeout errors in logs
- Queries complete successfully

**Rollback Plan (if fix fails):**
```bash
# If restart doesn't help, check Timeweb PostgreSQL status at:
# https://timeweb.cloud/databases
# Contact Timeweb support if database is down
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] Increase connection pool max size (current: 21, consider 30-40)
  - File: `src/db/timeweb-postgres.js`
  - Change: `max: 21` → `max: 40`
- [ ] Add connection timeout monitoring
  - Add Sentry breadcrumb before each query
- [ ] Enable query timeout (prevent long-running queries)
  - Add `statement_timeout = 30000` (30s)

**Monitoring:**
- Add alert for: Connection pool usage >80%
- Threshold: `pool.totalCount / pool.max > 0.8`
- Action: Send Telegram alert for investigation

**Code Changes:**
- [ ] Add query timeout to all repository methods
  ```javascript
  await this.query('SELECT...', [], { timeout: 30000 });
  ```
- [ ] Ensure all queries use `try/finally` to release connections
- [ ] Add connection pool metrics to daily metrics report

**Documentation:**
- [ ] Update docs at: `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md`
- [ ] Add test case: Simulate high concurrent load
- [ ] Update team knowledge: Connection pool sizing best practices

---

## 📊 History

**Occurrences:**
- 2025-11-11 - After database migration, pool size increased from 10 to 21
- 2025-11-06 - During Baileys migration, temporary connection spikes

**Related Issues:**
- GlitchTip #[pending] - Database timeout during peak load
- GitHub PR #[pending] - Increase connection pool size

**Improvements Made:**
- 2025-11-11 - Increased pool size to 21 (from default 10)
- 2025-11-11 - Added explicit connection pool config with `idleTimeoutMillis: 30000`

---

## 🔗 Related Resources

**Internal Docs:**
- `dev/active/database-migration-supabase-timeweb/database-migration-context.md`
- `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md`
- `src/db/timeweb-postgres.js` - Connection pool configuration

**External Resources:**
- [node-postgres Pool docs](https://node-postgres.com/apis/pool)
- [PostgreSQL Connection Pooling Best Practices](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Timeweb PostgreSQL documentation](https://timeweb.cloud/help/databases)

**Team Contacts:**
- Primary: Backend Developer
- Backup: DevOps Engineer
- Escalation: Timeweb Support (for database infrastructure issues)

---

**Runbook Version:** 1.0
**Author:** Claude Code
**Reviewed By:** [Pending]
**Next Review:** 2025-12-24
