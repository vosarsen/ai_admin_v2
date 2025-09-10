# WhatsApp Session Pool Architecture

## Overview

The WhatsApp Session Pool is a centralized management system for WhatsApp Business API connections using the Baileys library. It provides a robust, scalable solution for handling multiple WhatsApp sessions with automatic recovery, monitoring, and rate limiting.

## Architecture Components

### 1. WhatsAppSessionPool (`src/integrations/whatsapp/session-pool-improved.js`)

The core component that manages all WhatsApp sessions.

**Key Features:**
- **Singleton Pattern**: Ensures only one instance manages all sessions
- **Automatic Reconnection**: Exponential backoff strategy (5s, 10s, 20s, 40s...)
- **Health Monitoring**: Checks session health every 30 seconds
- **Rate Limiting**: 30 messages/minute per company
- **Event-Driven**: Uses EventEmitter for real-time notifications
- **Metrics Collection**: Tracks messages, errors, reconnections

**Methods:**
```javascript
// Create a new session
await sessionPool.createSession(companyId)

// Get session status
const status = sessionPool.getSessionStatus(companyId)

// Send a message
await sessionPool.sendMessage(companyId, to, message)

// Disconnect a session
await sessionPool.disconnect(companyId)

// Get all active sessions
const sessions = sessionPool.getActiveSessions()

// Get metrics
const metrics = sessionPool.getMetrics()
```

**Events:**
- `qr`: QR code generated for authentication
- `connected`: Session connected successfully
- `message`: Incoming message received
- `error`: Error occurred
- `logout`: Session logged out
- `reconnect_failed`: Reconnection attempts exhausted
- `health_check_failed`: Health check failed

### 2. RateLimiter (`src/utils/rate-limiter.js`)

Prevents spam and abuse by limiting message frequency.

**Features:**
- Redis-backed with in-memory fallback
- Sliding window algorithm
- Configurable limits per company-phone combination
- Default: 30 messages per minute

### 3. REST API Routes (`src/api/routes/whatsapp-sessions-improved.js`)

Provides HTTP endpoints for session management.

**Endpoints:**

#### List All Sessions
```http
GET /api/whatsapp/sessions
```
Response:
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "companyId": "962302",
      "status": "connected",
      "connectedAt": "2025-09-10T10:00:00.000Z",
      "phoneNumber": "+79686484488"
    }
  ],
  "metrics": {
    "totalSessions": 2,
    "activeConnections": 2,
    "messagesSent": 150,
    "messagesReceived": 200
  }
}
```

#### Get Session Status
```http
GET /api/whatsapp/sessions/:companyId
```

#### Create Session
```http
POST /api/whatsapp/sessions
Content-Type: application/json

{
  "companyId": "962302"
}
```
Response includes QR code for authentication if needed.

#### Delete Session
```http
DELETE /api/whatsapp/sessions/:companyId
```

#### Send Message
```http
POST /api/whatsapp/sessions/:companyId/messages
Content-Type: application/json

{
  "to": "79001234567",
  "message": "Hello from WhatsApp Business!"
}
```

#### Get Metrics
```http
GET /api/whatsapp/metrics
```

## Configuration

### Environment Variables
```bash
# WhatsApp Provider
WHATSAPP_PROVIDER=baileys

# Session Storage
WHATSAPP_SESSION_PATH=/opt/ai-admin/whatsapp_sessions

# Rate Limiting
WHATSAPP_RATE_LIMIT_WINDOW=60000  # 1 minute
WHATSAPP_RATE_LIMIT_MAX=30        # 30 messages

# Health Check
WHATSAPP_HEALTH_CHECK_INTERVAL=30000  # 30 seconds

# Reconnection
WHATSAPP_MAX_RECONNECT_ATTEMPTS=10
WHATSAPP_RECONNECT_BASE_DELAY=5000
```

### Directory Structure
```
/opt/ai-admin/whatsapp_sessions/
├── 962302/                    # Company-specific directory
│   ├── auth_info/             # Baileys authentication data
│   │   ├── creds.json
│   │   ├── app-state-sync-key-*.json
│   │   └── app-state-sync-version-*.json
│   └── session.lock          # Prevents concurrent access
├── 962303/
└── ...
```

## Usage Examples

### JavaScript/Node.js

#### Creating a Session
```javascript
const axios = require('axios');

async function createWhatsAppSession(companyId) {
  try {
    const response = await axios.post('http://localhost:3000/api/whatsapp/sessions', {
      companyId: companyId
    });
    
    if (response.data.qrCode) {
      console.log('Scan this QR code:', response.data.qrCode);
    } else {
      console.log('Session created:', response.data);
    }
  } catch (error) {
    console.error('Failed to create session:', error.response.data);
  }
}
```

#### Sending a Message
```javascript
async function sendWhatsAppMessage(companyId, phoneNumber, message) {
  try {
    const response = await axios.post(
      `http://localhost:3000/api/whatsapp/sessions/${companyId}/messages`,
      {
        to: phoneNumber,
        message: message
      }
    );
    
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Failed to send message:', error.response.data);
  }
}
```

#### Monitoring Session Health
```javascript
async function monitorSessions() {
  try {
    const response = await axios.get('http://localhost:3000/api/whatsapp/sessions');
    
    response.data.sessions.forEach(session => {
      console.log(`Company ${session.companyId}: ${session.status}`);
      if (session.lastError) {
        console.log(`  Last error: ${session.lastError}`);
      }
    });
  } catch (error) {
    console.error('Failed to get sessions:', error);
  }
}
```

### Using with PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ai-admin-api',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      WHATSAPP_PROVIDER: 'baileys',
      // ... other environment variables
    }
  }]
};
```

## Error Handling

### Common Errors and Solutions

#### 1. Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 45000
}
```
**Solution**: Wait for the specified time before retrying.

#### 2. Session Not Found
```json
{
  "success": false,
  "error": "Session not found for company 962302"
}
```
**Solution**: Create a new session using POST `/api/whatsapp/sessions`.

#### 3. Authentication Required
```json
{
  "success": false,
  "error": "Authentication required",
  "qrCode": "data:image/png;base64,..."
}
```
**Solution**: Scan the QR code with WhatsApp.

#### 4. Connection Lost
The system automatically attempts to reconnect with exponential backoff.
Monitor reconnection attempts in logs:
```bash
pm2 logs ai-admin-api --lines 100 | grep "Reconnecting"
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Session Metrics
```bash
curl http://localhost:3000/api/whatsapp/metrics
```

### PM2 Monitoring
```bash
# View logs
pm2 logs ai-admin-api

# Monitor in real-time
pm2 monit

# View process info
pm2 info ai-admin-api
```

### Log Analysis
```bash
# View WhatsApp-specific logs
pm2 logs ai-admin-api | grep -E "WhatsApp|Session|Baileys"

# View errors
pm2 logs ai-admin-api --err

# View connection events
pm2 logs ai-admin-api | grep -E "connected|disconnected|reconnect"
```

## Security Considerations

1. **Authentication**: Currently no authentication on API endpoints. Implement API key or JWT authentication for production.

2. **Rate Limiting**: Prevents abuse but should be configured based on actual usage patterns.

3. **Directory Permissions**: Session directories created with 0o700 permissions (owner only).

4. **Input Validation**: All inputs validated using express-validator.

5. **Path Traversal Protection**: Company IDs sanitized to prevent directory traversal attacks.

## Troubleshooting

### Session Won't Connect
1. Check network connectivity
2. Verify WhatsApp account is not banned
3. Check session directory permissions
4. Review logs for specific errors

### Messages Not Sending
1. Verify session is connected: `GET /api/whatsapp/sessions/:companyId`
2. Check rate limits
3. Verify phone number format (no + or special characters)
4. Check recipient has WhatsApp

### High Memory Usage
1. Check for memory leaks in event listeners
2. Verify sessions are being properly cleaned up
3. Monitor with: `pm2 monit`

### Reconnection Loop
1. Check for authentication issues
2. Verify network stability
3. Check WhatsApp account status
4. Review exponential backoff settings

## Performance Optimization

### Recommended Settings
- **Max Sessions per Instance**: 50-100
- **Health Check Interval**: 30 seconds
- **Rate Limit**: 30 msg/min per company
- **Reconnect Attempts**: 10
- **Session Timeout**: 24 hours inactive

### Scaling Strategies
1. **Horizontal Scaling**: Run multiple API instances with PM2
2. **Session Sharding**: Distribute companies across instances
3. **Redis Clustering**: For high-volume deployments
4. **CDN for Media**: Offload media handling

## Migration Guide

### From Old Architecture
1. Stop all test scripts and background processes
2. Back up existing session data
3. Deploy new architecture
4. Recreate sessions through new API
5. Update webhook endpoints

### Database Schema
No database changes required. Session data stored in file system.

## Future Enhancements

### Planned Features
1. **WebSocket Support**: Real-time events for QR codes and messages
2. **Session Persistence**: Backup and restore sessions
3. **Multi-Device Support**: Handle multiple devices per company
4. **Message Templates**: Pre-defined message templates
5. **Media Handling**: Improved support for images, documents
6. **Analytics Dashboard**: Visual monitoring interface
7. **Webhook Management**: Dynamic webhook configuration
8. **Session Migration**: Move sessions between servers
9. **Load Balancing**: Distribute sessions across workers
10. **Automated Testing**: Integration test suite

## Support

### Logs Location
- API Logs: `/root/.pm2/logs/ai-admin-api-*.log`
- Error Logs: `/opt/ai-admin/logs/api-error-*.log`
- Session Logs: `/opt/ai-admin/whatsapp_sessions/*/debug.log`

### Common Commands
```bash
# Restart API
pm2 restart ai-admin-api

# View recent logs
pm2 logs ai-admin-api --lines 100

# Check session files
ls -la /opt/ai-admin/whatsapp_sessions/

# Monitor system
pm2 monit

# Clear old sessions
find /opt/ai-admin/whatsapp_sessions -type d -mtime +30 -exec rm -rf {} \;
```

### Getting Help
1. Check logs for specific error messages
2. Review this documentation
3. Check development diary entries in `docs/development-diary/`
4. Monitor system metrics with PM2

## License

This architecture is part of the AI Admin v2 project and follows the project's licensing terms.