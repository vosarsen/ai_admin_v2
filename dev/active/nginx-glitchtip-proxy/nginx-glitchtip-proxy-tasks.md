# Nginx GlitchTip Proxy - Task Checklist

**Project:** nginx-glitchtip-proxy
**Status:** ⬜ Not Started
**Last Updated:** 2025-11-24

---

## Phase 0: Prerequisites & Validation (15 min)

**Status:** ⬜ Not Started
**Goal:** Verify all requirements before starting

### Tasks

- [ ] **0.1** Verify DNS provider access available
  - Effort: S
  - Depends on: None
  - Result: Can create A records

- [ ] **0.2** Confirm GlitchTip running on localhost:8080
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "curl -I http://localhost:8080"
  ```
  - Effort: S
  - Depends on: None
  - Result: HTTP 200 response

- [ ] **0.3** Test Nginx config syntax
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "nginx -t"
  ```
  - Effort: S
  - Depends on: None
  - Result: syntax is ok

- [ ] **0.4** Backup existing Nginx configs
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "tar -czf /root/nginx-backup-$(date +%Y%m%d).tar.gz /etc/nginx/sites-available/"
  ```
  - Effort: S
  - Depends on: None
  - Result: Backup created

- [ ] **0.5** Verify ports 80/443 available
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "netstat -tlnp | grep ':80\|:443'"
  ```
  - Effort: S
  - Depends on: None
  - Result: Ports in use by Nginx (expected)

**Acceptance Criteria:**
- ✅ All prerequisites met
- ✅ No blocking issues
- ✅ Backup created
- ✅ Ready to proceed

---

## Phase 1: DNS Configuration (5 min + wait time)

**Status:** ⬜ Not Started
**Goal:** Setup DNS A record for subdomain

### Tasks

- [ ] **1.1** Create DNS A Record
  ```
  Type: A
  Host: glitchtip
  Domain: adminai.tech
  Value: 46.149.70.219
  TTL: 3600
  ```
  - Effort: S
  - Depends on: 0.1
  - Result: A record created

- [ ] **1.2** Wait for DNS propagation (10-15 minutes)
  - Effort: S
  - Depends on: 1.1
  - Result: Wait time

- [ ] **1.3** Verify DNS resolves
  ```bash
  dig glitchtip.adminai.tech
  dig @8.8.8.8 glitchtip.adminai.tech
  nslookup glitchtip.adminai.tech
  ```
  - Effort: S
  - Depends on: 1.2
  - Result: Returns 46.149.70.219

**Acceptance Criteria:**
- ✅ DNS A record created
- ✅ DNS resolves to correct IP
- ✅ Works from multiple DNS servers

---

## Phase 2: Nginx Configuration (20 min)

**Status:** ⬜ Not Started
**Goal:** Create reverse proxy configuration without SSL

### Tasks

- [ ] **2.1** Create initial HTTP config
  - Create `/etc/nginx/sites-available/glitchtip.adminai.tech`
  - Add basic reverse proxy config
  - Include logging, headers, timeouts
  - Effort: M
  - Depends on: 0.3
  - Result: Config file created

- [ ] **2.2** Test config syntax
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "nginx -t"
  ```
  - Effort: S
  - Depends on: 2.1
  - Result: syntax is ok

- [ ] **2.3** Enable site
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ln -s /etc/nginx/sites-available/glitchtip.adminai.tech /etc/nginx/sites-enabled/"
  ```
  - Effort: S
  - Depends on: 2.2
  - Result: Symlink created

- [ ] **2.4** Reload Nginx
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl reload nginx"
  ```
  - Effort: S
  - Depends on: 2.3
  - Result: Nginx reloaded

- [ ] **2.5** Test HTTP access
  ```bash
  curl -I http://glitchtip.adminai.tech
  ```
  - Effort: S
  - Depends on: 2.4
  - Result: HTTP 200 response

- [ ] **2.6** Verify proxy works - Test in browser
  - Open http://glitchtip.adminai.tech
  - Login page loads
  - Assets load correctly
  - No console errors
  - Effort: M
  - Depends on: 2.5
  - Result: Full functionality

**Acceptance Criteria:**
- ✅ Config created and enabled
- ✅ HTTP access works
- ✅ All pages load correctly
- ✅ No 502/504 errors

---

## Phase 3: SSL Certificate (15 min)

**Status:** ⬜ Not Started
**Goal:** Add Let's Encrypt SSL certificate

### Tasks

- [ ] **3.1** Obtain SSL certificate
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "certbot --nginx -d glitchtip.adminai.tech"
  ```
  - Effort: S
  - Depends on: 1.3, 2.6
  - Result: Certificate obtained

- [ ] **3.2** Verify SSL configuration
  ```bash
  curl -I https://glitchtip.adminai.tech
  ```
  - Effort: S
  - Depends on: 3.1
  - Result: HTTPS 200 response

- [ ] **3.3** Test HTTP→HTTPS redirect
  ```bash
  curl -I http://glitchtip.adminai.tech
  ```
  - Effort: S
  - Depends on: 3.1
  - Result: 301 redirect to HTTPS

- [ ] **3.4** Check SSL Labs grade
  - Visit: https://www.ssllabs.com/ssltest/
  - Enter: glitchtip.adminai.tech
  - Effort: M
  - Depends on: 3.2
  - Result: Grade A or A+

- [ ] **3.5** Test auto-renewal
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "certbot renew --dry-run"
  ```
  - Effort: S
  - Depends on: 3.1
  - Result: Dry-run successful

- [ ] **3.6** Verify renewal timer
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl status certbot.timer"
  ```
  - Effort: S
  - Depends on: 3.1
  - Result: Timer active

**Acceptance Criteria:**
- ✅ HTTPS works without warnings
- ✅ HTTP redirects to HTTPS
- ✅ SSL Labs grade A or A+
- ✅ Auto-renewal configured

---

## Phase 4: Basic Auth (Optional, 10 min)

**Status:** ⬜ Skipped (Optional)
**Goal:** Add username/password protection

### Tasks

- [ ] **4.1** Install apache2-utils (if needed)
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "apt-get install -y apache2-utils"
  ```
  - Effort: S
  - Depends on: None
  - Result: Package installed

- [ ] **4.2** Create password file
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "htpasswd -c /etc/nginx/.htpasswd glitchtip_admin"
  ```
  - Effort: S
  - Depends on: 4.1
  - Result: Password file created

- [ ] **4.3** Set file permissions
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "chmod 640 /etc/nginx/.htpasswd && chown root:www-data /etc/nginx/.htpasswd"
  ```
  - Effort: S
  - Depends on: 4.2
  - Result: Permissions set

- [ ] **4.4** Update Nginx config
  - Add auth_basic directives
  - Add auth_basic_user_file directive
  - Effort: S
  - Depends on: 4.3
  - Result: Config updated

- [ ] **4.5** Test config and reload
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "nginx -t && systemctl reload nginx"
  ```
  - Effort: S
  - Depends on: 4.4
  - Result: Nginx reloaded

- [ ] **4.6** Test Basic Auth
  ```bash
  # Should fail
  curl -I https://glitchtip.adminai.tech

  # Should succeed
  curl -I -u glitchtip_admin:password https://glitchtip.adminai.tech
  ```
  - Effort: S
  - Depends on: 4.5
  - Result: Auth works

- [ ] **4.7** Test in browser
  - Browser prompts for credentials
  - Login works with correct credentials
  - Effort: S
  - Depends on: 4.6
  - Result: Browser auth works

**Acceptance Criteria:**
- ✅ 401 without credentials
- ✅ 200 with valid credentials
- ✅ Browser prompt works
- ✅ Login successful

---

## Phase 5: Optimization (10 min)

**Status:** ⬜ Not Started
**Goal:** Add production-ready optimizations

### Tasks

- [ ] **5.1** Add security headers
  - X-Frame-Options
  - X-Content-Type-Options
  - X-XSS-Protection
  - Referrer-Policy
  - Effort: S
  - Depends on: 3.2
  - Result: Headers added

- [ ] **5.2** Verify security headers
  ```bash
  curl -I https://glitchtip.adminai.tech | grep -E "(X-Frame|X-Content|X-XSS)"
  ```
  - Effort: S
  - Depends on: 5.1
  - Result: Headers present

- [ ] **5.3** Configure logging
  - Separate access/error logs
  - Proper log levels
  - Effort: S
  - Depends on: None
  - Result: Logging configured

- [ ] **5.4** Verify logs working
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "ls -lh /var/log/nginx/glitchtip-*"
  ```
  - Effort: S
  - Depends on: 5.3
  - Result: Logs being written

- [ ] **5.5** Add rate limiting (optional)
  - Define rate limit zone
  - Apply to location blocks
  - Effort: S
  - Depends on: None
  - Result: Rate limiting active

- [ ] **5.6** Enable HTTP/2
  - Update listen directive: `listen 443 ssl http2;`
  - Effort: S
  - Depends on: 3.1
  - Result: HTTP/2 enabled

**Acceptance Criteria:**
- ✅ Security headers present
- ✅ Logs being written correctly
- ✅ HTTP/2 enabled
- ✅ Rate limiting (if enabled)

---

## Phase 6: Testing & Validation (10 min)

**Status:** ⬜ Not Started
**Goal:** Comprehensive testing

### Tasks

- [ ] **6.1** Functional testing
  - [ ] Homepage loads via HTTPS
  - [ ] Login works
  - [ ] Issues list loads
  - [ ] Webhook endpoint accessible
  - [ ] API calls work
  - [ ] Static assets load
  - [ ] No console errors
  - Effort: M
  - Depends on: 3.2
  - Result: All features work

- [ ] **6.2** Performance testing
  ```bash
  time curl -s https://glitchtip.adminai.tech > /dev/null
  ```
  - Effort: S
  - Depends on: 3.2
  - Result: Response < 500ms

- [ ] **6.3** Security scan
  ```bash
  curl https://glitchtip.adminai.tech --verbose 2>&1 | grep SSL
  ```
  - Effort: S
  - Depends on: 3.2
  - Result: TLS 1.2+, strong ciphers

- [ ] **6.4** Test from different networks
  - Desktop browser
  - Mobile browser
  - Different ISP
  - Effort: M
  - Depends on: 3.2
  - Result: Works everywhere

- [ ] **6.5** Verify GlitchTip functionality
  - Create test issue
  - Add comment
  - Resolve issue
  - Check webhooks
  - Effort: M
  - Depends on: 6.1
  - Result: Full functionality

**Acceptance Criteria:**
- ✅ All functional tests pass
- ✅ Performance acceptable
- ✅ Security standards met
- ✅ Works across networks

---

## Phase 7: Documentation & Cleanup (10 min)

**Status:** ⬜ Not Started
**Goal:** Document and finalize

### Tasks

- [ ] **7.1** Create access documentation
  - Create `docs/GLITCHTIP_ACCESS.md`
  - Document URL, credentials
  - Document Basic Auth (if enabled)
  - Effort: S
  - Depends on: 6.1
  - Result: Doc created

- [ ] **7.2** Update CLAUDE.md
  - Add GlitchTip URL
  - Remove tunnel instructions
  - Effort: S
  - Depends on: 7.1
  - Result: CLAUDE.md updated

- [ ] **7.3** Update FINAL_SUMMARY.md
  - Add GlitchTip access info
  - Update Production section
  - Effort: S
  - Depends on: 7.1
  - Result: FINAL_SUMMARY updated

- [ ] **7.4** Update webhook URLs (if needed)
  - Check GlitchTip webhook config
  - Update if pointing to localhost
  - Effort: M
  - Depends on: 6.5
  - Result: Webhooks correct

- [ ] **7.5** Kill SSH tunnels
  ```bash
  pkill -f "ssh.*9090:localhost:8080"
  ```
  - Effort: S
  - Depends on: 6.1
  - Result: No active tunnels

- [ ] **7.6** Remove tunnel aliases/scripts
  - Check ~/.zshrc or ~/.bashrc
  - Remove tunnel commands
  - Effort: S
  - Depends on: 7.5
  - Result: Scripts removed

- [ ] **7.7** Share with team
  - Send new URL to team
  - Share credentials (if Basic Auth)
  - Effort: S
  - Depends on: 7.1
  - Result: Team notified

**Acceptance Criteria:**
- ✅ Documentation complete
- ✅ URLs updated everywhere
- ✅ Tunnels removed
- ✅ Team informed

---

## Post-Implementation Checklist

**Immediate (Day 1):**
- [ ] Verify HTTPS works from multiple locations
- [ ] Test login from different accounts
- [ ] Check error logs for issues
- [ ] Verify webhooks still work
- [ ] Update bookmarks

**Week 1:**
- [ ] Daily error log checks
- [ ] Collect team feedback
- [ ] Monitor response times
- [ ] Verify auto-renewal scheduled

**Week 2-4:**
- [ ] Weekly SSL expiry check
- [ ] Review access logs
- [ ] Test dry-run renewal
- [ ] Fine-tune if needed

**Monthly:**
- [ ] Review security headers
- [ ] Check for Nginx updates
- [ ] Verify backups exist
- [ ] Audit access if Basic Auth

---

## Rollback Procedure (If Needed)

**Complete Rollback Steps:**

- [ ] **R.1** Remove Nginx config
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "rm /etc/nginx/sites-enabled/glitchtip.adminai.tech && rm /etc/nginx/sites-available/glitchtip.adminai.tech"
  ```
  - Result: Config removed

- [ ] **R.2** Remove password file (if created)
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "rm /etc/nginx/.htpasswd"
  ```
  - Result: Password file deleted

- [ ] **R.3** Reload Nginx
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl reload nginx"
  ```
  - Result: Nginx reloaded

- [ ] **R.4** Restore SSH tunnel
  ```bash
  ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219
  ```
  - Result: Tunnel active

- [ ] **R.5** Verify tunnel works
  ```bash
  curl -I http://localhost:9090
  ```
  - Result: HTTP 200

- [ ] **R.6** Remove DNS record (optional)
  - Via DNS provider interface
  - Result: DNS record deleted

**Rollback Complete:** Back to original state

---

## Progress Tracking

### Overall Progress

- **Phase 0:** ⬜ 0/5 tasks (0%)
- **Phase 1:** ⬜ 0/3 tasks (0%)
- **Phase 2:** ⬜ 0/6 tasks (0%)
- **Phase 3:** ⬜ 0/6 tasks (0%)
- **Phase 4:** ⬜ 0/7 tasks (Skipped - Optional)
- **Phase 5:** ⬜ 0/6 tasks (0%)
- **Phase 6:** ⬜ 0/5 tasks (0%)
- **Phase 7:** ⬜ 0/7 tasks (0%)

**Total:** 0/45 tasks complete (0%)

**Estimated Time Remaining:** 90 minutes

---

## Notes & Issues

### Session 1 Notes:
- *Will be filled during implementation*

### Blockers:
- *None yet*

### Questions:
- *None yet*

### Changes from Plan:
- *None yet*

---

**Last Updated:** 2025-11-24
**Next Action:** Begin Phase 0 - Prerequisites & Validation
**Status:** ⬜ Ready to Start
