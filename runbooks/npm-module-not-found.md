# NPM Module Not Found - Runbook

**Pattern:** `(Cannot find module|MODULE_NOT_FOUND|Error: Cannot resolve|import.*not found)`
**Severity:** High
**MTTR Target:** 2-3 minutes
**Last Updated:** 2025-11-24

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `Cannot find module`, `MODULE_NOT_FOUND`, `Error: Cannot resolve`
- Stack trace shows: Module path (e.g., `'@whiskeysockets/baileys'`, `'./config/unified'`)
- Component tags: `npm`, `dependencies`, `modules`
- Typically occurs: After git pull, deployment, or npm package update
- **Impact:** Service fails to start or crashes on import

**Examples:**
```
Error: Cannot find module '@whiskeysockets/baileys'
  at Function.Module._resolveFilename (internal/modules/cjs/loader.js:902:15)
  at src/integrations/whatsapp/baileys-service.js:3

Error: Cannot find module './config/unified'
  at src/services/ai-admin-v2/index.js:12
```

---

## 📋 Diagnosis

**Root Cause:**
NPM dependencies not installed, outdated, or package.json/package-lock.json out of sync.

**How to verify:**
```bash
# Step 1: Check if node_modules exists
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -la /opt/ai-admin/node_modules | head -20"

# Step 2: Check if specific module exists
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -la /opt/ai-admin/node_modules/@whiskeysockets/baileys"

# Step 3: Check package.json for the module
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && cat package.json | grep -i baileys"

# Step 4: Compare package.json and package-lock.json timestamps
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -l /opt/ai-admin/package*.json"
```

**Common Triggers:**
1. Git pull without running `npm install` after dependency changes
2. Manual edit to package.json without reinstalling
3. Corrupted node_modules directory
4. NPM cache issues
5. Missing or outdated package-lock.json
6. Relative import path typo (`./config/unified` vs `./config/unifiedConfig`)

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: Stop affected services
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 stop all"

# Step 2: Install missing dependencies
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm install"

# Step 3: If still fails, clear npm cache and reinstall
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm cache clean --force && rm -rf node_modules package-lock.json && npm install"

# Step 4: Restart services
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart all"
```

**Verification:**
```bash
# Step 1: Check if services started successfully
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Step 2: Check logs for MODULE_NOT_FOUND errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50 | grep -i 'module.*not.*found'"

# Step 3: Verify specific module is now found
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node -e \"require('@whiskeysockets/baileys'); console.log('✅ Module found')\""
```

**Expected Result:**
- `npm install` completes without errors
- All PM2 services show status: online
- No MODULE_NOT_FOUND errors in logs
- Test import succeeds

**Rollback Plan (if fix fails):**
```bash
# If npm install fails:

# 1. Check Node.js version (should be v20+)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "node --version"

# 2. Check npm version
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "npm --version"

# 3. Try with --legacy-peer-deps (if peer dependency conflicts)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && npm install --legacy-peer-deps"

# 4. Check disk space (npm install needs space)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "df -h"

# 5. If all else fails, restore from git
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git checkout package.json package-lock.json && npm install"
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] Add pre-commit hook to check package-lock.json sync
  ```bash
  # .husky/pre-commit
  npm list --depth=0 || echo "⚠️ npm install needed"
  ```
- [ ] Add CI check for npm install
  - Run `npm ci` (clean install) in pipeline
  - Fail if package-lock.json out of sync
- [ ] Document deployment checklist
  - Always run `npm install` after `git pull`

**Monitoring:**
- Add alert for: Service startup failure (restartCount > 3)
- Check: PM2 restart count via API
- Action: Send Telegram alert "Service failing to start, check dependencies"

**Code Changes:**
- [ ] Add startup health check
  ```javascript
  // At app startup
  try {
    require('@whiskeysockets/baileys');
    require('./config/unified');
    // ... check all critical modules
  } catch (err) {
    console.error('❌ Critical module missing:', err.message);
    process.exit(1);
  }
  ```
- [ ] Use absolute imports instead of relative where possible
  ```javascript
  // BEFORE (brittle):
  const config = require('../../config/unified');

  // AFTER (robust):
  const config = require('config/unified'); // with NODE_PATH or package.json paths
  ```
- [ ] Add npm-check-updates automation
  ```bash
  npm install -g npm-check-updates
  ncu -u # Update package.json
  npm install # Install updates
  ```

**Documentation:**
- [ ] Update docs at: `docs/DEPLOYMENT.md` (add npm install step)
- [ ] Add test case: Delete node_modules, verify recovery script
- [ ] Create deployment checklist in `docs/DEPLOYMENT_CHECKLIST.md`

---

## 📊 History

**Occurrences:**
- 2025-11-15 - After adding new dependency (@anthropic/sdk), forgot npm install
- 2025-10-20 - After git pull with package.json changes, service crashed
- 2025-09-10 - Corrupted node_modules after disk space issue

**Related Issues:**
- GlitchTip #[pending] - Service startup failure due to missing module
- GitHub Issue - Add automated dependency check in CI/CD

**Improvements Made:**
- 2025-11-15 - Added reminder in CLAUDE.md to run npm install
- 2025-10-20 - Created `start-work.sh` script (reminds about git pull + npm install)
- 2025-09-15 - Added package-lock.json to git (was in .gitignore before)

---

## 🔗 Related Resources

**Internal Docs:**
- `CLAUDE.md` - Quick reference (includes npm install reminders)
- `package.json` - Project dependencies
- `docs/DEPLOYMENT.md` - Deployment process (to be created)

**External Resources:**
- [NPM Install Documentation](https://docs.npmjs.com/cli/v9/commands/npm-install)
- [NPM CI vs Install](https://docs.npmjs.com/cli/v9/commands/npm-ci)
- [Node.js Module System](https://nodejs.org/api/modules.html)
- [Troubleshooting NPM](https://docs.npmjs.com/common-errors)

**Team Contacts:**
- Primary: Backend Developer (package.json owner)
- Backup: DevOps Engineer (deployment process)
- Escalation: None (self-service)

---

**Runbook Version:** 1.0
**Author:** Claude Code
**Reviewed By:** [Pending]
**Next Review:** 2025-12-24
