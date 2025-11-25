# Nginx GlitchTip Proxy - Context & Decisions

**Project:** nginx-glitchtip-proxy
**Status:** Planning Complete - Ready for Implementation
**Last Updated:** 2025-11-24

---

## Current State Summary

### What Works Now
- ✅ GlitchTip running in Docker on localhost:8080
- ✅ SSH tunnel provides access (manual, requires terminal)
- ✅ Nginx already installed and configured (ai-admin.app)
- ✅ Certbot installed and working
- ✅ GlitchTip API integration complete (webhooks, commands, runbooks)

### What Doesn't Work
- ❌ No permanent URL for GlitchTip
- ❌ SSH tunnel required for every access
- ❌ Can't share access with team easily
- ❌ Mobile access difficult
- ❌ No SSL for local development

---

## Key Files & Locations

### Server Files (46.149.70.219)

**Nginx:**
- Config directory: `/etc/nginx/`
- Sites available: `/etc/nginx/sites-available/`
- Sites enabled: `/etc/nginx/sites-enabled/`
- Existing config: `/etc/nginx/sites-available/ai-admin`
- Logs: `/var/log/nginx/`

**GlitchTip:**
- Docker: `/opt/glitchtip/docker-compose.yml`
- Port: `127.0.0.1:8080->8080/tcp`
- Data: `/opt/glitchtip/data/`

**SSL Certificates:**
- Let's Encrypt: `/etc/letsencrypt/live/`
- Existing: `ai-admin.app` certificate
- New (will create): `glitchtip.adminai.tech`

### Local Files

**Documentation:**
- This context: `dev/active/nginx-glitchtip-proxy/nginx-glitchtip-proxy-context.md`
- Plan: `dev/active/nginx-glitchtip-proxy/nginx-glitchtip-proxy-plan.md`
- Tasks: `dev/active/nginx-glitchtip-proxy/nginx-glitchtip-proxy-tasks.md`

**SSH Access:**
- Key: `~/.ssh/id_ed25519_ai_admin`
- Server: `root@46.149.70.219`

---

## Architecture Decisions

### Decision 1: Nginx Reverse Proxy vs Cloudflare Tunnel

**Chosen:** Nginx Reverse Proxy

**Rationale:**
- ✅ Already have Nginx running
- ✅ Familiar technology stack
- ✅ More control over configuration
- ✅ No external dependencies (Cloudflare agent)
- ✅ Can add custom security layers
- ✅ Better performance (no extra hop)

**Alternatives Considered:**
- Cloudflare Tunnel: Requires agent, less control
- Direct port exposure: Security risk
- VPN: Overkill for simple access

### Decision 2: Subdomain Structure

**Chosen:** `glitchtip.adminai.tech`

**Rationale:**
- ✅ Clear purpose from URL
- ✅ Separate SSL certificate
- ✅ Independent from main app
- ✅ Professional appearance
- ✅ Easy to remember

**Alternatives Considered:**
- `errors.adminai.tech`: Less specific
- `monitor.adminai.tech`: Too generic
- `/glitchtip` path on main domain: Complex routing

### Decision 3: Basic Auth - Optional

**Chosen:** Make it optional, document how to enable

**Rationale:**
- ✅ GlitchTip already has authentication
- ✅ SSL provides encryption
- ✅ Can enable later if needed
- ✅ Reduces complexity for initial setup
- ⚠️ Additional layer for paranoid security

**When to Enable:**
- If exposing to public internet
- If team access is too broad
- If compliance requires it
- If seeing suspicious access attempts

### Decision 4: HTTP/2 Support

**Chosen:** Enable HTTP/2

**Rationale:**
- ✅ Nginx 1.24.0 supports it
- ✅ Better performance (multiplexing)
- ✅ No downside for modern browsers
- ✅ Required for optimal SSL Labs grade

**Implementation:**
```nginx
listen 443 ssl http2;
```

### Decision 5: Rate Limiting

**Chosen:** Optional, documented but not enforced initially

**Rationale:**
- ✅ GlitchTip is internal tool, not public API
- ✅ Can add later if abuse detected
- ✅ Simpler initial setup
- ⚠️ Good practice for defense in depth

**When to Enable:**
- If seeing automated attacks
- If bandwidth becomes issue
- If DDoS concerns arise

---

## Dependencies

### External Services

**DNS Provider (Required):**
- Need access to adminai.tech DNS management
- Must create A record: `glitchtip.adminai.tech → 46.149.70.219`
- Propagation time: 5-60 minutes

**Let's Encrypt (Required):**
- Automatic via certbot
- Port 80 must be accessible
- Domain must resolve correctly

### System Requirements

**Already Met:**
- ✅ Nginx 1.24.0 installed
- ✅ Certbot 2.9.0 installed
- ✅ Docker Compose with GlitchTip
- ✅ Port 80/443 available
- ✅ Root SSH access

**To Verify:**
- [ ] DNS provider credentials available
- [ ] GlitchTip environment variables correct
- [ ] Firewall allows port 80/443

---

## Risk Mitigation Strategies

### Risk 1: DNS Propagation Delay
**Mitigation:**
- Start with DNS first, wait before proceeding
- Use `dig @8.8.8.8` to check propagation
- Test HTTP before SSL to isolate issues

### Risk 2: GlitchTip ALLOWED_HOSTS
**Mitigation:**
- Check docker-compose.yml before starting
- May need to add GLITCHTIP_DOMAIN env var
- Test HTTP proxy first to catch this early

### Risk 3: Breaking Existing Site
**Mitigation:**
- Separate config file (don't touch ai-admin)
- Test nginx config before reload
- Keep backups of all configs
- Independent symlink structure

### Risk 4: SSL Certificate Issues
**Mitigation:**
- Ensure DNS propagated first
- Use --dry-run to test
- Port 80 open and accessible
- Check certbot logs if fails

### Risk 5: Webhook Integration
**Mitigation:**
- Webhooks currently point to localhost (via tunnel)
- May need to update webhook URLs
- Test after deployment
- Have rollback plan ready

---

## Implementation Notes

### Phase Order Rationale

**Why DNS First?**
- Propagation takes time (5-60 min)
- SSL certificate requires working DNS
- Parallel work during wait time

**Why HTTP Before HTTPS?**
- Isolate proxy configuration issues
- Verify GlitchTip integration works
- Certbot modifies config anyway

**Why Basic Auth Last?**
- Optional feature
- Can be added anytime
- Doesn't block other work

### Testing Strategy

**Progressive Testing:**
1. HTTP access (basic proxy working)
2. HTTPS access (SSL working)
3. All pages load (full functionality)
4. Webhooks work (integration intact)
5. Basic Auth (if enabled)

**Rollback Points:**
- After each phase
- Before SSL (can stay HTTP)
- Before Basic Auth (can skip)
- Complete rollback documented

---

## Team Communication

### Who Needs to Know

**When DNS Setup:**
- Team: "Setting up permanent GlitchTip access"
- ETA: 2 hours

**During Implementation:**
- Brief downtime possible (< 5 min)
- SSH tunnel will still work as backup

**After Completion:**
- Share new URL: https://glitchtip.adminai.tech
- Share credentials (if Basic Auth)
- Update bookmarks
- Can remove SSH tunnel

### Documentation Updates

**Files to Update:**
- CLAUDE.md - Add new GlitchTip URL
- README.md - Remove tunnel instructions
- GLITCHTIP_WEBHOOK_SETUP.md - Update URLs
- FINAL_SUMMARY.md - Add access info

---

## Success Criteria Checklist

**Must Have:**
- [ ] https://glitchtip.adminai.tech loads
- [ ] Valid SSL certificate (no warnings)
- [ ] Can login and access all features
- [ ] HTTP redirects to HTTPS
- [ ] No SSH tunnel needed

**Nice to Have:**
- [ ] SSL Labs grade A+
- [ ] Basic Auth configured (optional)
- [ ] Response time < 500ms
- [ ] All security headers present

**Documentation:**
- [ ] Access guide written
- [ ] CLAUDE.md updated
- [ ] Team notified
- [ ] Bookmarks updated

---

## Troubleshooting Quick Reference

### If DNS doesn't resolve
```bash
# Check DNS
dig glitchtip.adminai.tech

# Wait 10-15 minutes, try again
# Use different DNS: dig @8.8.8.8 glitchtip.adminai.tech
```

### If 502 Bad Gateway
```bash
# Check GlitchTip running
cd /opt/glitchtip && docker compose ps

# Check port binding
docker compose ps | grep web
# Should show: 127.0.0.1:8080->8080/tcp

# Test direct access
curl http://localhost:8080
```

### If SSL fails
```bash
# Check DNS first
dig glitchtip.adminai.tech

# Check port 80 open
netstat -tlnp | grep :80

# Check certbot logs
tail -f /var/log/letsencrypt/letsencrypt.log
```

### If Basic Auth doesn't work
```bash
# Check password file exists
ls -la /etc/nginx/.htpasswd

# Check file permissions
chmod 640 /etc/nginx/.htpasswd
chown root:www-data /etc/nginx/.htpasswd

# Test nginx config
nginx -t
```

### Complete Rollback
```bash
# Remove config
rm /etc/nginx/sites-enabled/glitchtip.adminai.tech
systemctl reload nginx

# Remove password file (if created)
rm /etc/nginx/.htpasswd

# Restore SSH tunnel
ssh -i ~/.ssh/id_ed25519_ai_admin -L 9090:localhost:8080 -N -f root@46.149.70.219
```

---

## Post-Implementation Monitoring

### Week 1 Checklist
- [ ] Daily: Check error logs
- [ ] Daily: Verify HTTPS works
- [ ] Daily: Test from different networks
- [ ] Collect team feedback

### Week 2-4 Checklist
- [ ] Weekly: Check SSL expiry date
- [ ] Weekly: Review access logs
- [ ] Weekly: Test auto-renewal dry-run
- [ ] Update docs if needed

### Monthly Checklist
- [ ] Review security headers
- [ ] Check for Nginx updates
- [ ] Verify backup configs exist
- [ ] Test complete access flow

---

## Known Issues & Workarounds

### Issue 1: GlitchTip Session Cookies
**Status:** Potential
**Description:** GlitchTip might set cookies for wrong domain
**Workaround:** Check GLITCHTIP_DOMAIN in docker-compose.yml
**Fix:** Add/update environment variable

### Issue 2: Webhook URLs
**Status:** Possible
**Description:** Webhooks may still reference localhost
**Workaround:** Update webhook config in GlitchTip UI
**Fix:** Point to https://ai-admin.app/api/webhooks/glitchtip

### Issue 3: CORS for API
**Status:** Unlikely
**Description:** API calls might fail due to CORS
**Workaround:** Add CORS headers in Nginx
**Fix:**
```nginx
add_header Access-Control-Allow-Origin "https://glitchtip.adminai.tech";
```

---

## Lessons Learned (Will update post-implementation)

### What Went Well
- TBD after implementation

### What Could Be Improved
- TBD after implementation

### Unexpected Issues
- TBD after implementation

### Time Estimates Accuracy
- TBD after implementation

---

## Next Steps After This Project

### Immediate Follow-ups
1. Update GlitchTip integration docs
2. Share access with team
3. Test from various locations
4. Verify webhooks work

### Future Enhancements
1. Consider CDN (Cloudflare)
2. Add monitoring (UptimeRobot)
3. Setup alerts for downtime
4. Evaluate rate limiting needs

### Related Projects
- GlitchTip auto-remediation (pending data collection)
- Monitoring dashboard consolidation
- Team access management

---

**Last Updated:** 2025-11-24
**Status:** Ready for Implementation
**Next Action:** Begin Phase 0 (Prerequisites & Validation)
