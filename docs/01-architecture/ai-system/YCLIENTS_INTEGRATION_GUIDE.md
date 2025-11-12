# 🔗 YClients Integration Guide for AI Admin

## Quick Start

AI Admin provides a WhatsApp bot integration for beauty salons through YClients marketplace.

## Integration Flow

### 1. Send User to AI Admin

Send a GET request with the salon ID:
```
https://ai-admin.app/marketplace/register?salon_id={SALON_ID}
```

### 2. Receive Connection Data

Our API returns JSON with connection details:

```json
{
  "success": true,
  "company": {
    "id": 15,
    "title": "Salon Name",
    "salon_id": "123456"
  },
  "connectUrl": "https://ai-admin.app/marketplace/connect.html?token=xxx",
  "token": "JWT_TOKEN",
  "wsUrl": "wss://ai-admin.app"
}
```

### 3. Connection Options

You have 3 options to proceed:

#### Option A: Redirect (Recommended)
```javascript
window.location.href = response.connectUrl;
```

#### Option B: Iframe Embed
```html
<iframe
  src="{connectUrl}"
  width="500"
  height="700"
  frameborder="0">
</iframe>
```

#### Option C: Custom UI
Use the token to create your own interface with our WebSocket API.

## API Reference

### Register Endpoint

**Request:**
```http
GET /marketplace/register?salon_id={SALON_ID}
```

**Response (Success):**
```json
{
  "success": true,
  "company": {
    "id": number,
    "title": string,
    "salon_id": string
  },
  "connectUrl": string,  // Full URL to connection page
  "token": string,        // JWT token for authentication
  "wsUrl": string         // WebSocket URL for real-time updates
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error description"
}
```

### WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
const socket = io(wsUrl + '/marketplace', {
  query: {
    token: token,
    companyId: company.id
  }
});

// QR code update
socket.on('qr-update', (data) => {
  console.log('New QR code:', data.qr);
  console.log('Expires in:', data.expires_in, 'seconds');
});

// WhatsApp connected successfully
socket.on('whatsapp-connected', (data) => {
  console.log('WhatsApp connected!');
  console.log('Phone:', data.phone);
  // You can now redirect user back to YClients
});

// Error occurred
socket.on('error', (error) => {
  console.error('Connection error:', error.message);
});
```

## Callback Notification

After successful WhatsApp connection, send a callback to your system:

**Our callback to YClients:**
```http
POST https://api.yclients.com/marketplace/callback

{
  "salon_id": "123456",
  "status": "connected",
  "phone": "+7900123456",
  "webhook_url": "https://ai-admin.app/webhook/yclients/15"
}
```

## Testing

### Test Salon IDs
- `962302` - Test barbershop (KULTURA)
- `test_salon` - Mock salon for development

### Test Environment
```
https://ai-admin.app/marketplace/register?salon_id=962302
```

## Error Handling

| Error Code | Description | Solution |
|------------|-------------|----------|
| 400 | Missing salon_id | Provide salon_id parameter |
| 404 | Salon not found | Check if salon exists in YClients |
| 500 | Server error | Retry after some time |

## Security

- All connections use HTTPS/WSS
- JWT tokens expire after 24 hours
- Each salon has isolated session
- HMAC signature for webhooks

## Requirements

- Valid YClients salon ID
- Administrator access to salon's WhatsApp
- Modern browser with JavaScript enabled

## Support

- **Technical issues**: dev@ai-admin.app
- **Integration help**: support@ai-admin.app
- **API Status**: https://status.ai-admin.app

## Sample Integration Code

```javascript
// YClients marketplace integration example
async function connectAIAdmin(salonId) {
  try {
    // 1. Get connection data
    const response = await fetch(
      `https://ai-admin.app/marketplace/register?salon_id=${salonId}`
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    // 2. Open connection page in new window
    const popup = window.open(
      data.connectUrl,
      'ai-admin-connect',
      'width=500,height=700'
    );

    // 3. Listen for completion (optional)
    window.addEventListener('message', (event) => {
      if (event.origin === 'https://ai-admin.app') {
        if (event.data.type === 'whatsapp-connected') {
          popup.close();
          alert('WhatsApp successfully connected!');
          // Refresh your UI or redirect
        }
      }
    });

  } catch (error) {
    console.error('Failed to connect AI Admin:', error);
  }
}
```

---

*API Version: 1.0.0*
*Last Updated: September 16, 2025*