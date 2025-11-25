# Nginx Reverse Proxy for GlitchTip - Implementation Plan

**Project:** Setup permanent HTTPS access to GlitchTip without SSH tunnels
**Priority:** Medium
**Estimated Effort:** 1-2 hours
**Target:** glitchtip.adminai.tech with SSL + optional Basic Auth

**Last Updated:** 2025-11-24

---

## Executive Summary

Setup Nginx reverse proxy to provide permanent HTTPS access to GlitchTip error tracking system. Currently GlitchTip runs in Docker on `localhost:8080` and requires SSH tunnel for access. The goal is to make it accessible via `https://glitchtip.adminai.tech` with automatic SSL certificate renewal and optional Basic Auth for extra security.

**Key Benefits:**
- ✅ No more SSH tunnels required
- ✅ Access from anywhere (browser, mobile, team members)
- ✅ Automatic SSL certificate (Let's Encrypt)
- ✅ Optional Basic Auth for additional security layer
- ✅ Professional subdomain URL

**Success Criteria:**
- GlitchTip accessible at https://glitchtip.adminai.tech
- Valid SSL certificate (A+ rating)
- Optional Basic Auth working
- HTTP → HTTPS redirect configured
- SSL auto-renewal configured
- Zero downtime for existing services

---

## Current State Analysis

### Infrastructure

**Server:** VPS at 46.149.70.219
- OS: Ubuntu (latest)
- Nginx: 1.24.0 ✅ Installed
- Certbot: 2.9.0 ✅ Installed
- Existing site: ai-admin.app (already SSL configured)

**GlitchTip Status:**
```
Service: Docker Compose
Port: 127.0.0.1:8080 (localhost only)
Status: Running (Up 19 hours)
Containers:
  - glitchtip-web-1 (port 8080)
  - glitchtip-postgres-1
  - glitchtip-redis-1
  - glitchtip-worker-1
```

**Current Access Method:**
```bash
# SSH tunnel required
ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 root@46.149.70.219
# Then: http://localhost:9090
```

**Existing Nginx Config:**
- `/etc/nginx/sites-available/ai-admin` - Main app config
- SSL certificate: `/etc/letsencrypt/live/ai-admin.app/`
- Pattern: HTTP redirect + HTTPS with SSL

### DNS Requirements

**Needed:** A record for `glitchtip.adminai.tech`
```
glitchtip.adminai.tech A 46.149.70.219
```

**Status:** ⚠️ Needs to be created (will check during implementation)

---

## Proposed Future State

### Architecture

```
User Browser
    ↓ HTTPS (443)
https://glitchtip.adminai.tech
    ↓
Nginx Reverse Proxy (with SSL + Basic Auth)
    ↓ HTTP (localhost)
localhost:8080
    ↓
GlitchTip Docker Container
```

### Security Layers

1. **SSL/TLS** - Let's Encrypt certificate
2. **Basic Auth** (optional) - Username/password prompt
3. **Internal binding** - GlitchTip stays on localhost:8080
4. **Rate limiting** - Nginx limit_req (optional)

### Configuration Files

**New files to create:**
- `/etc/nginx/sites-available/glitchtip.adminai.tech`
- `/etc/nginx/.htpasswd` (if Basic Auth enabled)
- SSL cert: `/etc/letsencrypt/live/glitchtip.adminai.tech/`

---

## Implementation Phases

### Phase 0: Prerequisites & Validation (15 min)

**Goal:** Verify all requirements are met before starting

**Tasks:**
1. Verify DNS A record exists for glitchtip.adminai.tech
2. Confirm GlitchTip is running on localhost:8080
3. Test Nginx config syntax
4. Backup existing Nginx configs
5. Verify port 80/443 are available

**Acceptance Criteria:**
- DNS resolves to correct IP
- GlitchTip responds on localhost:8080
- Nginx config test passes
- Backup created

**Risk Level:** LOW

---

### Phase 1: DNS Configuration (5 min)

**Goal:** Setup DNS A record for subdomain

**Tasks:**

#### Task 1.1: Create DNS A Record (2 min)
```
Type: A
Host: glitchtip
Domain: adminai.tech
Value: 46.149.70.219
TTL: 3600 (1 hour)
```

**Acceptance Criteria:**
- `dig glitchtip.adminai.tech` returns 46.149.70.219
- `nslookup glitchtip.adminai.tech` resolves correctly

**Dependencies:** Access to DNS provider (Cloudflare/other)

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 2: Nginx Configuration (20 min)

**Goal:** Create reverse proxy configuration without SSL first

**Tasks:**

#### Task 2.1: Create Initial HTTP Config (10 min)

Create `/etc/nginx/sites-available/glitchtip.adminai.tech`:

```nginx
# Initial HTTP-only config for testing
server {
    listen 80;
    server_name glitchtip.adminai.tech;

    # Logging
    access_log /var/log/nginx/glitchtip-access.log;
    error_log /var/log/nginx/glitchtip-error.log;

    # Reverse proxy to GlitchTip
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Acceptance Criteria:**
- Config file created
- Nginx config test passes: `nginx -t`
- No syntax errors

**Effort:** M (Medium)

**Risk Level:** LOW

---

#### Task 2.2: Enable Site & Test HTTP (5 min)

```bash
# Create symlink
ln -s /etc/nginx/sites-available/glitchtip.adminai.tech \
      /etc/nginx/sites-enabled/

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx

# Test HTTP access
curl -I http://glitchtip.adminai.tech
```

**Acceptance Criteria:**
- Symlink created
- Nginx reloads successfully
- HTTP 200 response from curl
- Can access in browser via http://glitchtip.adminai.tech

**Effort:** S (Small)

**Risk Level:** LOW

**Rollback Plan:**
```bash
rm /etc/nginx/sites-enabled/glitchtip.adminai.tech
systemctl reload nginx
```

---

#### Task 2.3: Verify Proxy Works (5 min)

**Test checklist:**
- [ ] Homepage loads
- [ ] CSS/JS assets load
- [ ] Login page works
- [ ] Admin panel accessible
- [ ] Issues page loads

**Acceptance Criteria:**
- All pages load correctly
- No 502/503/504 errors
- Assets load without CORS issues
- GlitchTip functionality intact

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 3: SSL Certificate (15 min)

**Goal:** Add Let's Encrypt SSL certificate with auto-renewal

**Tasks:**

#### Task 3.1: Obtain SSL Certificate (5 min)

```bash
# Run certbot for new certificate
certbot --nginx -d glitchtip.adminai.tech

# Certbot will:
# 1. Verify domain ownership
# 2. Obtain certificate
# 3. Auto-configure Nginx SSL
# 4. Setup auto-renewal
```

**Acceptance Criteria:**
- Certificate obtained successfully
- Stored in `/etc/letsencrypt/live/glitchtip.adminai.tech/`
- Nginx config auto-updated with SSL directives
- Auto-renewal cron job created

**Effort:** S (Small)

**Risk Level:** LOW

**Dependencies:**
- DNS must be propagated
- Port 80 accessible for validation

---

#### Task 3.2: Verify SSL Configuration (5 min)

```bash
# Test HTTPS
curl -I https://glitchtip.adminai.tech

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

**Acceptance Criteria:**
- HTTPS works without certificate warnings
- HTTP redirects to HTTPS
- SSL Labs grade: A or A+
- Valid certificate chain

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 3.3: Test Auto-Renewal (5 min)

```bash
# Dry-run renewal
certbot renew --dry-run

# Check renewal timer
systemctl status certbot.timer
```

**Acceptance Criteria:**
- Dry-run succeeds
- Timer is active and enabled
- Next renewal date is set

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 4: Basic Auth (Optional, 10 min)

**Goal:** Add username/password protection for extra security

**Tasks:**

#### Task 4.1: Create Password File (3 min)

```bash
# Install apache2-utils if not present
apt-get install -y apache2-utils

# Create password file
htpasswd -c /etc/nginx/.htpasswd glitchtip_admin

# Enter password when prompted
# Recommended: Use strong random password
```

**Acceptance Criteria:**
- Password file created
- Contains hashed password
- Permissions set to 640: `chmod 640 /etc/nginx/.htpasswd`

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 4.2: Add Auth to Nginx Config (5 min)

Update `/etc/nginx/sites-available/glitchtip.adminai.tech`:

```nginx
server {
    listen 443 ssl;
    server_name glitchtip.adminai.tech;

    # ... existing SSL config ...

    # Basic Auth
    auth_basic "GlitchTip Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Reverse proxy config
    location / {
        # ... existing proxy config ...
    }
}
```

**Acceptance Criteria:**
- Config updated
- Nginx test passes
- Reload successful

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 4.3: Test Basic Auth (2 min)

```bash
# Test without credentials (should fail)
curl -I https://glitchtip.adminai.tech
# Expected: 401 Unauthorized

# Test with credentials (should work)
curl -I -u glitchtip_admin:password https://glitchtip.adminai.tech
# Expected: 200 OK
```

**Acceptance Criteria:**
- 401 without credentials
- 200 with valid credentials
- Browser prompts for username/password
- Login works in browser

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 5: Final Configuration & Optimization (10 min)

**Goal:** Add production-ready optimizations

**Tasks:**

#### Task 5.1: Add Security Headers (5 min)

Add to Nginx config:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;

# HSTS (optional - enables after testing)
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**Acceptance Criteria:**
- Headers present in responses
- Security scan shows improvements

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 5.2: Configure Logging (3 min)

Ensure proper logging:

```nginx
# Separate log files for debugging
access_log /var/log/nginx/glitchtip-access.log combined;
error_log /var/log/nginx/glitchtip-error.log warn;

# Log rotation (usually handled by logrotate)
```

**Acceptance Criteria:**
- Logs being written
- Log rotation configured
- Logs readable and parseable

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 5.3: Add Rate Limiting (Optional, 2 min)

```nginx
# In http block (global)
limit_req_zone $binary_remote_addr zone=glitchtip:10m rate=10r/s;

# In server block
location / {
    limit_req zone=glitchtip burst=20 nodelay;
    # ... rest of proxy config ...
}
```

**Acceptance Criteria:**
- Rate limiting active
- Legitimate traffic not affected
- Excessive requests get 429 response

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 6: Testing & Validation (10 min)

**Goal:** Comprehensive testing of all functionality

**Tasks:**

#### Task 6.1: Functional Testing (5 min)

**Test Matrix:**
```
✓ Homepage loads via HTTPS
✓ Login works
✓ Issues list loads
✓ Webhook endpoint accessible
✓ API calls work
✓ Static assets load
✓ WebSocket connections (if used)
✓ Basic Auth prompts (if enabled)
✓ HTTP→HTTPS redirect works
✓ SSL certificate valid
```

**Acceptance Criteria:**
- All tests pass
- No console errors
- All features functional

**Effort:** M (Medium)

**Risk Level:** LOW

---

#### Task 6.2: Performance Testing (3 min)

```bash
# Test response time
time curl -s https://glitchtip.adminai.tech > /dev/null

# Load test (optional)
ab -n 100 -c 10 https://glitchtip.adminai.tech/
```

**Acceptance Criteria:**
- Response time < 500ms
- No 502/504 errors under load
- Comparable to direct access

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 6.3: Security Scan (2 min)

```bash
# SSL test
curl https://glitchtip.adminai.tech --verbose 2>&1 | grep SSL

# Check headers
curl -I https://glitchtip.adminai.tech | grep -E "(X-Frame|X-Content|X-XSS)"
```

**Acceptance Criteria:**
- TLS 1.2+ only
- Strong cipher suites
- Security headers present

**Effort:** S (Small)

**Risk Level:** LOW

---

### Phase 7: Documentation & Cleanup (10 min)

**Goal:** Document setup and clean up temporary resources

**Tasks:**

#### Task 7.1: Update Documentation (5 min)

Create/update files:
- `docs/GLITCHTIP_ACCESS.md` - How to access GlitchTip
- Update CLAUDE.md with new URL
- Update FINAL_SUMMARY.md with access info

**Content:**
```markdown
## GlitchTip Access

**URL:** https://glitchtip.adminai.tech

**Credentials:**
- Email: support@adminai.tech
- Password: SecureAdmin2025GT!

**Basic Auth (if enabled):**
- Username: glitchtip_admin
- Password: [stored securely]

**No SSH tunnel required!**
```

**Acceptance Criteria:**
- Documentation complete
- Access instructions clear
- Credentials documented securely

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 7.2: Update Webhooks (3 min)

Update GlitchTip webhook configuration:

**Old:** `http://localhost:8080` (via tunnel)
**New:** `https://ai-admin.app/api/webhooks/glitchtip`

**Note:** External webhook stays as is (pointing to main API)

**Acceptance Criteria:**
- Webhook URLs verified
- Test webhook works
- Alerts still being sent

**Effort:** S (Small)

**Risk Level:** LOW

---

#### Task 7.3: Remove SSH Tunnel Scripts (2 min)

```bash
# Kill any running tunnels
pkill -f "ssh.*9090:localhost:8080"

# Remove tunnel aliases (if any)
# Edit ~/.zshrc or ~/.bashrc
```

**Acceptance Criteria:**
- No active tunnels
- Scripts/aliases removed
- Documentation updated

**Effort:** S (Small)

**Risk Level:** LOW

---

## Risk Assessment & Mitigation

### Identified Risks

#### Risk 1: DNS Propagation Delay
**Impact:** HIGH
**Probability:** MEDIUM
**Description:** DNS changes may take time to propagate, delaying SSL certificate

**Mitigation:**
- Start with DNS setup, wait 10-15 minutes
- Use `dig` to verify propagation before certbot
- Have backup: complete HTTP setup first, SSL later

**Rollback:** N/A (just wait for DNS)

---

#### Risk 2: Port Conflicts
**Impact:** MEDIUM
**Probability:** LOW
**Description:** Port 80/443 might be in use by other services

**Mitigation:**
- Check before starting: `netstat -tlnp | grep :80`
- Existing ai-admin.app uses 443, but should coexist
- Test Nginx config before reload

**Rollback:**
```bash
rm /etc/nginx/sites-enabled/glitchtip.adminai.tech
systemctl reload nginx
```

---

#### Risk 3: GlitchTip ALLOWED_HOSTS
**Impact:** MEDIUM
**Probability:** MEDIUM
**Description:** GlitchTip might reject requests from new domain

**Mitigation:**
- Check GlitchTip environment: `GLITCHTIP_DOMAIN`
- May need to add to docker-compose.yml
- Test HTTP access first before SSL

**Fix if needed:**
```yaml
# /opt/glitchtip/docker-compose.yml
environment:
  - GLITCHTIP_DOMAIN=glitchtip.adminai.tech
```

**Rollback:** Revert docker-compose.yml, restart container

---

#### Risk 4: SSL Certificate Failure
**Impact:** HIGH
**Probability:** LOW
**Description:** Certbot might fail to obtain certificate

**Mitigation:**
- Ensure port 80 accessible
- Verify DNS resolves correctly
- Check certbot logs: `/var/log/letsencrypt/`
- Use `--dry-run` first to test

**Rollback:**
- Can continue with HTTP-only
- Fix issue, retry certbot later

---

#### Risk 5: Breaking Existing Services
**Impact:** HIGH
**Probability:** VERY LOW
**Description:** Nginx changes might affect ai-admin.app

**Mitigation:**
- Separate config file (no changes to existing)
- Test config before reload: `nginx -t`
- Keep backup of all configs
- Independent symlink

**Rollback:**
```bash
rm /etc/nginx/sites-enabled/glitchtip.adminai.tech
systemctl reload nginx
```

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | 99.9%+ | Monitor with uptime check |
| **Response Time** | < 500ms | curl timing |
| **SSL Grade** | A or A+ | SSL Labs scan |
| **Zero Downtime** | 0 seconds | During implementation |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Setup Time** | < 2 hours | Actual vs estimated |
| **No SSH Tunnels** | 100% | User feedback |
| **Team Accessibility** | All team members | Access verification |
| **Auto-Renewal** | Working | Dry-run test |

### KPIs

- **Convenience:** Eliminate SSH tunnel requirement ✅
- **Security:** A+ SSL rating + optional Basic Auth ✅
- **Reliability:** No single point of failure ✅
- **Maintainability:** Auto-renewal, standard Nginx config ✅

---

## Required Resources & Dependencies

### Technical Resources

**Server Access:**
- SSH: `root@46.149.70.219`
- Key: `~/.ssh/id_ed25519_ai_admin`

**Software (already installed):**
- ✅ Nginx 1.24.0
- ✅ Certbot 2.9.0
- ✅ Docker Compose (GlitchTip)

**Network:**
- Port 80 (HTTP) - needed for certbot validation
- Port 443 (HTTPS) - main access
- Port 8080 (localhost) - GlitchTip Docker

### External Dependencies

**DNS Provider:**
- Access to adminai.tech DNS management
- Ability to create A records
- Propagation time: 5-60 minutes

**Let's Encrypt:**
- Internet connectivity from server
- Valid domain pointing to server
- Port 80 accessible

### Knowledge Requirements

**Skills needed:**
- Basic Nginx configuration
- SSL/TLS concepts
- DNS management
- Command line (SSH)

**Nice to have:**
- Docker basics (for troubleshooting)
- Certbot usage
- HTTP/HTTPS protocol knowledge

---

## Timeline Estimates

### Optimistic (Everything Goes Well): 45 minutes

```
Phase 0: Prerequisites     - 10 min
Phase 1: DNS               - 5 min
Phase 2: Nginx Config      - 15 min
Phase 3: SSL               - 10 min
Phase 4: Basic Auth (skip) - 0 min
Phase 5: Optimization      - 0 min (do later)
Phase 6: Testing           - 5 min
```

### Realistic (Normal Execution): 90 minutes

```
Phase 0: Prerequisites     - 15 min
Phase 1: DNS               - 5 min (+ 15 min wait)
Phase 2: Nginx Config      - 20 min
Phase 3: SSL               - 15 min
Phase 4: Basic Auth        - 10 min
Phase 5: Optimization      - 10 min
Phase 6: Testing           - 10 min
Phase 7: Documentation     - 10 min
```

### Pessimistic (Issues Encountered): 2.5 hours

```
Phase 0: Prerequisites     - 20 min
Phase 1: DNS               - 10 min (+ 30 min wait)
Phase 2: Nginx Config      - 30 min (debugging)
Phase 3: SSL               - 30 min (troubleshooting)
Phase 4: Basic Auth        - 15 min
Phase 5: Optimization      - 10 min
Phase 6: Testing           - 20 min
Phase 7: Documentation     - 10 min
```

**Recommended:** Block 2 hours for comfortable implementation

---

## Post-Implementation

### Monitoring

**Daily:**
- Check SSL expiry: `certbot certificates`
- Review error logs: `tail -f /var/log/nginx/glitchtip-error.log`

**Weekly:**
- Verify auto-renewal: `certbot renew --dry-run`
- Check access logs for anomalies

**Monthly:**
- Review security headers
- Update documentation if needed

### Maintenance

**Quarterly:**
- Review and update Nginx config
- Check for Nginx updates: `apt update && apt list --upgradable`
- Audit Basic Auth users

**Annually:**
- Renew awareness of access procedures
- Update documentation
- Review security posture

---

## Rollback Plan

### Complete Rollback

If anything goes wrong and you need to revert entirely:

```bash
# 1. Remove Nginx config
rm /etc/nginx/sites-enabled/glitchtip.adminai.tech
rm /etc/nginx/sites-available/glitchtip.adminai.tech

# 2. Remove password file (if created)
rm /etc/nginx/.htpasswd

# 3. Reload Nginx
systemctl reload nginx

# 4. Restore SSH tunnel access
ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219

# 5. Remove DNS record (optional)
# Via DNS provider interface
```

**Result:** Back to original SSH tunnel setup, no permanent changes

---

## Next Steps After Completion

### Immediate (Day 1)
- [ ] Share new URL with team
- [ ] Update bookmarks
- [ ] Test from different networks
- [ ] Verify Telegram webhooks still work

### Short-term (Week 1)
- [ ] Monitor error logs daily
- [ ] Collect team feedback
- [ ] Fine-tune if needed
- [ ] Update any hardcoded URLs

### Long-term (Month 1+)
- [ ] Consider adding monitoring (UptimeRobot)
- [ ] Evaluate adding CDN (Cloudflare)
- [ ] Review access patterns
- [ ] Optimize based on usage

---

## References

**Nginx Documentation:**
- Reverse Proxy: https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/
- SSL Configuration: https://nginx.org/en/docs/http/configuring_https_servers.html

**Let's Encrypt:**
- Getting Started: https://letsencrypt.org/getting-started/
- Certbot Nginx: https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal

**GlitchTip:**
- Configuration: https://glitchtip.com/documentation/install#configuration

**Security:**
- SSL Labs: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/

---

## Appendix A: Complete Nginx Configuration Example

### Final Config: `/etc/nginx/sites-available/glitchtip.adminai.tech`

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name glitchtip.adminai.tech;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name glitchtip.adminai.tech;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/glitchtip.adminai.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/glitchtip.adminai.tech/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # HSTS (uncomment after testing)
    # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/glitchtip-access.log combined;
    error_log /var/log/nginx/glitchtip-error.log warn;

    # Basic Auth (optional - uncomment to enable)
    # auth_basic "GlitchTip Access";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    # Client body size (for file uploads)
    client_max_body_size 10M;

    # Main location - proxy to GlitchTip
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
    }

    # Health check endpoint
    location /health-nginx {
        access_log off;
        return 200 "nginx healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## Appendix B: Troubleshooting Guide

### Issue: DNS not resolving

**Symptoms:** `dig glitchtip.adminai.tech` returns NXDOMAIN

**Solutions:**
1. Wait 10-15 minutes for DNS propagation
2. Check DNS provider settings
3. Verify A record created correctly
4. Try different DNS server: `dig @8.8.8.8 glitchtip.adminai.tech`

---

### Issue: 502 Bad Gateway

**Symptoms:** Nginx returns 502 error

**Causes & Solutions:**
1. **GlitchTip not running**
   ```bash
   cd /opt/glitchtip && docker compose ps
   docker compose up -d  # If down
   ```

2. **Wrong port in proxy_pass**
   ```bash
   # Verify GlitchTip port
   docker compose ps | grep web
   # Should show 127.0.0.1:8080->8080/tcp
   ```

3. **Firewall blocking localhost**
   ```bash
   # Test direct access
   curl http://localhost:8080
   ```

---

### Issue: SSL certificate fails

**Symptoms:** Certbot returns error

**Common causes:**
1. **Port 80 not accessible**
   ```bash
   # Check firewall
   ufw status
   # Allow if needed
   ufw allow 80/tcp
   ```

2. **DNS not propagated**
   ```bash
   # Verify DNS
   dig glitchtip.adminai.tech
   # Wait and retry
   ```

3. **Rate limit hit**
   ```bash
   # Check certbot logs
   cat /var/log/letsencrypt/letsencrypt.log
   # Use staging: certbot --staging
   ```

---

### Issue: Basic Auth not working

**Symptoms:** No password prompt or 401 error

**Solutions:**
1. **Check password file**
   ```bash
   cat /etc/nginx/.htpasswd
   # Should contain username:hashed_password
   ```

2. **Verify file permissions**
   ```bash
   chmod 640 /etc/nginx/.htpasswd
   chown root:www-data /etc/nginx/.htpasswd
   ```

3. **Check Nginx config syntax**
   ```bash
   nginx -t
   ```

---

### Issue: Assets not loading (404)

**Symptoms:** CSS/JS return 404, page looks broken

**Solutions:**
1. **Check proxy_pass trailing slash**
   ```nginx
   # Correct:
   proxy_pass http://localhost:8080;

   # Wrong:
   proxy_pass http://localhost:8080/;
   ```

2. **Verify Host header**
   ```nginx
   proxy_set_header Host $host;
   ```

3. **Check GlitchTip ALLOWED_HOSTS**
   ```bash
   # In docker-compose.yml
   GLITCHTIP_DOMAIN=glitchtip.adminai.tech
   ```

---

## Appendix C: Quick Reference Commands

### Nginx Commands
```bash
# Test configuration
nginx -t

# Reload configuration
systemctl reload nginx

# Restart Nginx
systemctl restart nginx

# View error logs
tail -f /var/log/nginx/glitchtip-error.log

# View access logs
tail -f /var/log/nginx/glitchtip-access.log
```

### Certbot Commands
```bash
# Obtain certificate
certbot --nginx -d glitchtip.adminai.tech

# Renew certificates
certbot renew

# Dry-run renewal
certbot renew --dry-run

# List certificates
certbot certificates

# Revoke certificate (if needed)
certbot revoke --cert-path /etc/letsencrypt/live/glitchtip.adminai.tech/fullchain.pem
```

### Docker Commands
```bash
# Check GlitchTip status
cd /opt/glitchtip && docker compose ps

# Restart GlitchTip
docker compose restart web

# View GlitchTip logs
docker compose logs -f web

# Stop GlitchTip
docker compose down

# Start GlitchTip
docker compose up -d
```

### Testing Commands
```bash
# Test HTTP
curl -I http://glitchtip.adminai.tech

# Test HTTPS
curl -I https://glitchtip.adminai.tech

# Test with Basic Auth
curl -I -u username:password https://glitchtip.adminai.tech

# Check SSL certificate
echo | openssl s_client -servername glitchtip.adminai.tech -connect glitchtip.adminai.tech:443 2>/dev/null | openssl x509 -noout -dates

# DNS lookup
dig glitchtip.adminai.tech
nslookup glitchtip.adminai.tech
```

---

**End of Plan**

**Last Updated:** 2025-11-24
**Status:** Ready for Implementation
**Estimated Total Time:** 1-2 hours
