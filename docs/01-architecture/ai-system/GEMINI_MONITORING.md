# 📊 Gemini Monitoring Quick Reference

**Status:** ✅ Production
**Provider:** Google Gemini 2.5 Flash
**VPN:** Xray VLESS/Reality via USA (us.cdn.stun.su)

## 🚀 Quick Health Check

```bash
# 1. Check VPN status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl status xray"

# 2. Test proxy connectivity
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "curl -x socks5://127.0.0.1:1080 -s https://ipinfo.io/json | grep country"
# Expected: "country": "US"

# 3. Check AI provider
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && cat .env | grep AI_PROVIDER"
# Expected: AI_PROVIDER=gemini-flash

# 4. Monitor response times
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "grep 'Two-Stage processing completed' /opt/ai-admin/logs/worker-v2-out-1.log | tail -5"
# Expected: ~9-10 seconds average
```

## 📈 Performance Metrics

### Target Metrics
- **Response Time:** < 12 seconds (average ~9-10s)
- **Success Rate:** > 98%
- **VPN Uptime:** > 99.9%
- **Cost:** ~$29/month

### Alert Thresholds
- ⚠️ **Warning:** Response time > 15 seconds
- 🔴 **Critical:** Response time > 20 seconds
- 🚨 **Emergency:** VPN down or geo-blocking errors

## 🔧 Common Issues & Fixes

### Issue 1: Slow Responses (>15s)

**Check:**
```bash
# Test VPN speed
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "time curl -x socks5://127.0.0.1:1080 -s https://www.google.com > /dev/null"
# Should be < 2 seconds
```

**Fix:**
```bash
# Restart Xray
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl restart xray"
```

### Issue 2: Geo-blocking Errors

**Symptom:** `User location is not supported for the API use`

**Check:**
```bash
# Verify VPN location
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "curl -x socks5://127.0.0.1:1080 -s https://ipinfo.io/json"
```

**Fix:** Should show US location. If showing RU, restart Xray or switch VPN server.

### Issue 3: VPN Connection Failed

**Check logs:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "journalctl -u xray -n 50 --no-pager"
```

**Fix:**
```bash
# Restart Xray service
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl restart xray && sleep 3 && systemctl status xray"
```

### Issue 4: Still Using DeepSeek

**Symptom:** Response times back to ~24 seconds

**Check:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && cat .env | grep AI_PROVIDER"
```

**Fix:**
```bash
# Ensure correct provider and restart with --update-env
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=gemini-flash/' .env && pm2 restart ai-admin-worker-v2 --update-env"
```

## 📊 Daily Monitoring Commands

```bash
# Morning health check
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "
  echo '=== VPN Status ===' &&
  systemctl status xray | head -3 &&
  echo '' &&
  echo '=== Proxy Test ===' &&
  curl -x socks5://127.0.0.1:1080 -s https://ipinfo.io/json | grep -E '(country|city)' &&
  echo '' &&
  echo '=== Response Times (last 5) ===' &&
  grep 'Two-Stage processing completed' /opt/ai-admin/logs/worker-v2-out-1.log | tail -5 | grep -oP '\d+ms' &&
  echo '' &&
  echo '=== PM2 Status ===' &&
  pm2 status | grep ai-admin-worker-v2
"
```

## 💰 Cost Tracking

**Monthly Budget:** $29 (Gemini 2.5 Flash)

**Track usage:**
- Google Cloud Console: https://console.cloud.google.com/
- Navigate to: APIs & Services → Gemini API → Quotas & Usage
- Monitor: Daily requests, costs, rate limits

**Expected:**
- ~10,000 requests/day
- ~$1/day = $29-30/month

## 🔄 VPN Server Switch (if needed)

If USA server becomes slow, switch to backup:

**Option 1: Germany (39ms latency)**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 'cat > /usr/local/etc/xray/config.json << '\''EOF'\''
{
  "log": {"loglevel": "warning"},
  "inbounds": [{
    "port": 1080,
    "listen": "127.0.0.1",
    "protocol": "socks",
    "settings": {"udp": true}
  }],
  "outbounds": [{
    "protocol": "vless",
    "settings": {
      "vnext": [{
        "address": "de.cdn.stun.su",
        "port": 443,
        "users": [{
          "id": "4e071a48-9fcb-4cd3-afb8-871bc2491c07",
          "encryption": "none",
          "flow": "xtls-rprx-vision"
        }]
      }]
    },
    "streamSettings": {
      "network": "tcp",
      "security": "reality",
      "realitySettings": {
        "serverName": "de.cdn.stun.su",
        "fingerprint": "chrome",
        "publicKey": "ca5sfJNcjkh3oNt51hRexXbGWgITAqCprGSU-YKCJBA",
        "shortId": "deefa428fff8c65c",
        "spiderX": "/"
      }
    }
  }]
}
EOF
' && ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl restart xray"
```

**Option 2: France (45ms latency)**
```bash
# Similar config with fr.cdn.stun.su
# See docs/GEMINI_INTEGRATION_GUIDE.md for full config
```

## 📞 Emergency Rollback to DeepSeek

If Gemini has issues:

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "
  cd /opt/ai-admin &&
  sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=deepseek/' .env &&
  pm2 restart ai-admin-worker-v2 --update-env &&
  echo 'Rolled back to DeepSeek'
"
```

**Note:** This will increase response time to ~24s and cost to $106/month.

## 📚 Related Documentation

- [Gemini Integration Guide](GEMINI_INTEGRATION_GUIDE.md) - Full setup
- [Development Diary Entry](development-diary/2025-10-19-gemini-integration-with-vpn.md) - Implementation story
- [AI Providers Guide](AI_PROVIDERS_GUIDE.md) - Provider comparison

---

**Last updated:** October 19, 2025
**Owner:** DevOps/AI Team
**Support:** Check logs first, then Telegram @vosarsen
