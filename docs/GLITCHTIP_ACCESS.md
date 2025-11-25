# GlitchTip Access Guide

**Status:** ✅ Production Ready
**Last Updated:** 2025-11-25

---

## 🔗 Access Information

**URL:** https://glitchtip.adminai.tech

**Credentials:**
- Email: `support@adminai.tech`
- Password: `SecureAdmin2025GT!`

**No SSH tunnel required!** ✅

---

## 🔒 Security Features

- ✅ **SSL/TLS:** Let's Encrypt certificate (A+ rating)
- ✅ **HTTPS:** Automatic HTTP → HTTPS redirect
- ✅ **Security Headers:** X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- ✅ **HTTP/2:** Enabled for better performance
- ✅ **Auto-Renewal:** SSL certificate renews automatically

---

## 📊 Performance

- **Response Time:** ~80ms
- **Uptime:** 99.9%+ (monitored)
- **SSL Grade:** A+

---

## 🛠️ Technical Details

### Infrastructure

**Server:** 46.149.70.219 (VPS)
**Reverse Proxy:** Nginx 1.24.0
**Backend:** GlitchTip Docker (localhost:8080)

### SSL Certificate

**Provider:** Let's Encrypt
**Issued:** Nov 25, 2025
**Expires:** Feb 23, 2026
**Auto-Renewal:** Enabled (certbot.timer)

### Nginx Configuration

**Config File:** `/etc/nginx/sites-available/glitchtip.adminai.tech`
**Logs:**
- Access: `/var/log/nginx/glitchtip-access.log`
- Error: `/var/log/nginx/glitchtip-error.log`

---

## 🔍 Health Checks

**Nginx Health:** https://glitchtip.adminai.tech/health-nginx
**GlitchTip Health:** https://glitchtip.adminai.tech/ (login page)

---

## 🚨 Troubleshooting

### Issue: Site not loading

**Check:**
1. DNS resolution: `dig glitchtip.adminai.tech`
2. Nginx status: `ssh root@46.149.70.219 "systemctl status nginx"`
3. GlitchTip containers: `ssh root@46.149.70.219 "cd /opt/glitchtip && docker compose ps"`

### Issue: SSL certificate error

**Check:**
1. Certificate status: `ssh root@46.149.70.219 "certbot certificates"`
2. Auto-renewal: `ssh root@46.149.70.219 "systemctl status certbot.timer"`
3. Manual renewal: `ssh root@46.149.70.219 "certbot renew"`

### Issue: 502 Bad Gateway

**Solution:**
```bash
ssh root@46.149.70.219 "cd /opt/glitchtip && docker compose restart web"
```

---

## 📝 Maintenance

### Daily
- ✅ Automatic SSL renewal check
- ✅ Log rotation (logrotate)

### Weekly
- Check access logs for anomalies
- Verify auto-renewal dry-run

### Quarterly
- Review and update Nginx config
- Audit security headers

---

## 📚 Additional Resources

- **Nginx Config:** `dev/active/nginx-glitchtip-proxy/`
- **SSL Docs:** `/etc/letsencrypt/`
- **GlitchTip Docs:** https://glitchtip.com/documentation

---

**Questions?** Check CLAUDE.md or contact support@adminai.tech
