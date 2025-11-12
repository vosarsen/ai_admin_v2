# 📱 WhatsApp Web Connection Guide

> Complete guide for connecting WhatsApp to AI Admin system via web interface

## 📋 Table of Contents
- [Overview](#overview)
- [Connection Methods](#connection-methods)
- [Web Interface URLs](#web-interface-urls)
- [Pairing Code Method](#pairing-code-method)
- [QR Code Method](#qr-code-method)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)
- [API Documentation](#api-documentation)

## Overview

AI Admin v2 supports WhatsApp connection through two methods:
1. **Pairing Code** - Enter an 8-digit code on your phone (recommended)
2. **QR Code** - Scan a QR code with your phone camera

Both methods are available through web interfaces and support multi-tenant configuration.

## Connection Methods

### 🔑 Method 1: Pairing Code (Recommended)

**URL**: `http://46.149.70.219:3000/whatsapp-pairing.html?company=962302`

**Advantages:**
- ✅ Works when QR code is blocked
- ✅ Supports any phone number
- ✅ No camera needed
- ✅ More reliable connection

**Steps:**
1. Open the URL in your browser
2. Enter the WhatsApp phone number you want to connect
3. Click "Получить код подключения"
4. On your phone:
   - Open WhatsApp
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Choose "Link with phone number instead"
   - Enter the 8-digit code shown on the screen

### 📷 Method 2: QR Code

**URL**: `http://46.149.70.219:3000/whatsapp-qr.html?company=962302`

**Advantages:**
- ✅ Quick connection
- ✅ No typing required
- ✅ Visual confirmation

**Steps:**
1. Open the URL in your browser
2. On your phone:
   - Open WhatsApp
   - Go to Settings → Linked Devices
   - Tap "Link a Device"
   - Scan the QR code displayed on screen

## Web Interface URLs

### Production Server
- **Pairing Code**: `http://46.149.70.219:3000/whatsapp-pairing.html?company={companyId}`
- **QR Code**: `http://46.149.70.219:3000/whatsapp-qr.html?company={companyId}`

### Domain (when configured)
- **Pairing Code**: `https://ai-admin.app/whatsapp-pairing.html?company={companyId}`
- **QR Code**: `https://ai-admin.app/whatsapp-qr.html?company={companyId}`

### URL Parameters
- `company` - Required. The company ID for multi-tenant isolation (e.g., 962302)

## Pairing Code Method

### Features
- **Phone Number Input**: Enter any WhatsApp number to connect
- **Real-time Status**: Shows connection progress
- **Auto-refresh**: Gets new code if expired
- **Error Handling**: Clear error messages and alternatives

### Interface Components
```
┌─────────────────────────────────┐
│     📱 WhatsApp Connection      │
│                                 │
│  Company ID: 962302            │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Phone Number:          │   │
│  │ [___________________]  │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │    XXXX-XXXX           │   │
│  │    (60 sec remaining)   │   │
│  └─────────────────────────┘   │
│                                 │
│  [Get Connection Code]          │
│                                 │
│  📋 Instructions:               │
│  1. Open WhatsApp              │
│  2. Settings → Linked Devices  │
│  3. Link with phone number     │
│  4. Enter the code above       │
└─────────────────────────────────┘
```

### API Endpoint
```http
POST /api/whatsapp/sessions/{companyId}/pairing-code
Content-Type: application/json

{
  "phoneNumber": "79001234567"
}
```

**Response:**
```json
{
  "success": true,
  "code": "XXXX-XXXX",
  "companyId": "962302",
  "expiresIn": 60,
  "instructions": [...]
}
```

## QR Code Method

### Features
- **Auto-refresh**: New QR code every 60 seconds
- **Connection Status**: Real-time connection monitoring
- **Fallback Option**: Link to pairing code if QR fails

### Interface Components
```
┌─────────────────────────────────┐
│     📱 WhatsApp Connection      │
│                                 │
│  Company ID: 962302            │
│                                 │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │      [QR CODE]         │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  ⏱ Refreshing in 45 sec        │
│                                 │
│  📋 Instructions:               │
│  1. Open WhatsApp              │
│  2. Settings → Linked Devices  │
│  3. Scan QR Code               │
└─────────────────────────────────┘
```

### API Endpoint
```http
GET /api/whatsapp/sessions/{companyId}/qr
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qr": "data:image/png;base64,...",
    "timeout": 60000
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Connection Closed" Error
**Problem**: WhatsApp returns "Connection Closed" when requesting pairing code

**Causes:**
- WhatsApp rate limiting due to multiple attempts
- Temporary block on new device connections
- Network connectivity issues

**Solutions:**
1. Wait 2-4 hours before trying again
2. Try with a different phone number
3. Use QR code method as alternative
4. Check network connectivity

#### 2. "Failed to generate pairing code"
**Problem**: API returns error when requesting pairing code

**Solutions:**
1. Check if phone number format is correct (digits only, no + or spaces)
2. Verify the phone number has WhatsApp installed
3. Try QR code method instead
4. Check server logs for specific error

#### 3. "Linking new devices is not possible right now"
**Problem**: WhatsApp blocks new device connections

**Causes:**
- Too many QR code scan attempts
- Recent device unlinks
- WhatsApp security measures

**Solutions:**
1. Use pairing code method (it bypasses this restriction)
2. Wait 24 hours before trying again
3. Try with a different WhatsApp account

#### 4. QR Code Not Loading
**Problem**: QR code doesn't appear or shows error

**Solutions:**
1. Check if session pool is initialized (restart API if needed)
2. Clear browser cache and refresh
3. Check server connectivity
4. Use pairing code method as alternative

### Server-Side Troubleshooting

#### Check Logs
```bash
# API logs
pm2 logs ai-admin-api --lines 50

# Check for specific errors
pm2 logs ai-admin-api | grep -i "whatsapp\|pairing\|connection"

# Monitor real-time
pm2 monit
```

#### Check Session Files
```bash
# List session files
ls -la /opt/ai-admin/baileys_sessions/company_962302/

# Check if creds.json exists
cat /opt/ai-admin/baileys_sessions/company_962302/creds.json
```

#### Restart Services
```bash
# Restart API
pm2 restart ai-admin-api

# Clear session and retry
rm -rf /opt/ai-admin/baileys_sessions/company_962302/
pm2 restart ai-admin-api
```

## Technical Details

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│   API Server    │────▶│  Baileys Lib    │
│  (User Input)   │     │  (Express.js)   │     │  (WhatsApp)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                        │
         │                      │                        │
         ▼                      ▼                        ▼
   ┌──────────┐          ┌──────────┐            ┌──────────┐
   │   HTML   │          │  Routes  │            │ Session  │
   │   Form   │          │ Handler  │            │ Manager  │
   └──────────┘          └──────────┘            └──────────┘
```

### Key Components

#### 1. Web Interface Files
- `/public/whatsapp-pairing.html` - Pairing code interface
- `/public/whatsapp-qr.html` - QR code interface

#### 2. API Routes
- `/src/api/routes/whatsapp-sessions-improved.js` - Session management endpoints

#### 3. Scripts
- `/scripts/whatsapp-pairing-auth.js` - Core pairing authentication script
- `/scripts/get-pairing-code.js` - Helper script for pairing code
- `/scripts/pairing-code-api.js` - API-optimized pairing script

#### 4. Session Management
- `/src/integrations/whatsapp/session-pool.js` - Session pool manager
- `/src/integrations/whatsapp/baileys-provider.js` - Baileys integration

### Multi-Tenant Support

Each company has isolated WhatsApp sessions:
- Session files stored in `/baileys_sessions/company_{companyId}/`
- Complete isolation between companies
- No cross-company data access
- Individual rate limiting per company

### Security Considerations

1. **Phone Number Validation**
   - Only accepts valid phone number formats
   - Sanitizes input to prevent injection

2. **Rate Limiting**
   - 30 requests per minute per company
   - Automatic cooldown periods

3. **Session Security**
   - Sessions encrypted and stored locally
   - No credentials in code
   - Automatic session cleanup

4. **CORS Configuration**
   - Allows cross-origin requests for web interface
   - Can be restricted to specific domains in production

## API Documentation

### Endpoints

#### Get Pairing Code
```http
POST /api/whatsapp/sessions/{companyId}/pairing-code
Content-Type: application/json

{
  "phoneNumber": "79001234567"  // Optional, uses default if not provided
}
```

#### Get QR Code
```http
GET /api/whatsapp/sessions/{companyId}/qr
```

#### Check Connection Status
```http
GET /api/whatsapp/sessions/{companyId}/status
```

#### Reconnect Session
```http
POST /api/whatsapp/sessions/{companyId}/reconnect
```

#### Get Session Health
```http
GET /api/whatsapp/sessions/{companyId}/health
```

### Response Formats

#### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "ERROR_CODE"
}
```

### Error Codes
- `CONNECTION_CLOSED` - WhatsApp connection terminated
- `RATE_LIMITED` - Too many requests
- `INVALID_PHONE` - Invalid phone number format
- `SESSION_NOT_FOUND` - Session doesn't exist
- `INTERNAL_ERROR` - Server error

## Best Practices

1. **Always try pairing code first** - More reliable than QR
2. **Wait between attempts** - Avoid rate limiting
3. **Use correct phone format** - Digits only, no spaces or symbols
4. **Monitor connection status** - Check health endpoint regularly
5. **Handle errors gracefully** - Show user-friendly messages
6. **Keep sessions alive** - Implement heartbeat mechanism

## Maintenance

### Regular Tasks
1. Monitor session health daily
2. Clear old session files weekly
3. Check error logs for patterns
4. Update Baileys library monthly

### Backup Strategy
1. Backup session files before updates
2. Keep last 3 working configurations
3. Document working phone numbers
4. Test restore procedures regularly

## Support

For issues or questions:
1. Check troubleshooting section first
2. Review server logs for errors
3. Test with different phone numbers
4. Contact technical support with:
   - Company ID
   - Error messages
   - Time of occurrence
   - Steps to reproduce

---

*Last updated: September 19, 2025*
*Version: 2.0*
*Status: Production Ready*