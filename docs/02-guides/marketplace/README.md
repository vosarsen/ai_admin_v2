# YClients Marketplace Integration

Complete documentation for YClients Marketplace integration and authorization.

## ⚠️ IMPORTANT: Authorization Simplified

**You DON'T need User Token for marketplace!** Only Partner Token required:

```javascript
headers = {
  'Authorization': `Bearer ${PARTNER_TOKEN}`,
  'Accept': 'application/vnd.yclients.v2+json'
}
```

## Essential Guides

### [AUTHORIZATION_QUICK_REFERENCE.md](AUTHORIZATION_QUICK_REFERENCE.md) ⚡
**Quick authorization reference** - Start here!
- Simplified auth flow (Partner Token only)
- API endpoint patterns
- Common operations examples
- Troubleshooting auth issues

### [MARKETPLACE_INTEGRATION.md](MARKETPLACE_INTEGRATION.md) 🏪
**Complete integration guide**
- Architecture overview
- Onboarding flow
- Webhook configuration
- Production deployment

### [MARKETPLACE_TROUBLESHOOTING.md](MARKETPLACE_TROUBLESHOOTING.md) 🔧
**Common issues and solutions**
- Authorization errors
- Webhook failures
- Sync problems
- Debug strategies

## Setup and Configuration

### Initial Setup
- [MARKETPLACE_SETUP.md](MARKETPLACE_SETUP.md) - Initial configuration
- [YCLIENTS_MARKETPLACE_SETUP.md](YCLIENTS_MARKETPLACE_SETUP.md) - YClients side setup
- [PAIRING_CODE_INTEGRATION.md](PAIRING_CODE_INTEGRATION.md) - WhatsApp pairing

### Activation Guides
- [YCLIENTS_ACTIVATION_GUIDE.md](YCLIENTS_ACTIVATION_GUIDE.md) - Full activation process
- [YCLIENTS_ACTIVATION_GUIDE_SHORT.md](YCLIENTS_ACTIVATION_GUIDE_SHORT.md) - Quick version

## Technical Documentation

### API and Authorization
- [MARKETPLACE_API.md](MARKETPLACE_API.md) - API endpoints reference
- [MARKETPLACE_AUTHORIZATION_FLOW.md](MARKETPLACE_AUTHORIZATION_FLOW.md) - Auth flow details
- [DETAILED_FLOW_ANALYSIS.md](DETAILED_FLOW_ANALYSIS.md) - Deep dive into flows

### Architecture
- [MARKETPLACE_TECHNICAL.md](MARKETPLACE_TECHNICAL.md) - Technical architecture
- [ONBOARDING_FLOW_DIAGRAM.md](ONBOARDING_FLOW_DIAGRAM.md) - Visual flow guide
- [YCLIENTS_MARKETPLACE_PAGE.md](YCLIENTS_MARKETPLACE_PAGE.md) - Marketplace UI

## Requirements and Reviews

### Critical Documents
- [CRITICAL_REQUIREMENTS.md](CRITICAL_REQUIREMENTS.md) - Must-have features
- [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md) - Pre-launch checklist

### Deployment History
- [DEPLOYMENT_SUCCESS_2025-10-03.md](DEPLOYMENT_SUCCESS_2025-10-03.md) - Launch report
- [CRITICAL_FIXES_2025-10-03.md](CRITICAL_FIXES_2025-10-03.md) - Post-launch fixes
- [FINAL_CODE_REVIEW_2025-10-03.md](FINAL_CODE_REVIEW_2025-10-03.md) - Code review

## Quick Start

### 1. Environment Variables
```bash
# Required for marketplace
YCLIENTS_PARTNER_TOKEN=your_partner_token
MARKETPLACE_WEBHOOK_URL=https://your-domain.com/api/webhooks/marketplace
```

### 2. Key Endpoints
```javascript
// All requests use salon_id from marketplace connection
GET /api/v1/records/{salon_id}      // Bookings
GET /api/v1/clients/{salon_id}      // Clients
GET /api/v1/services/{salon_id}     // Services
GET /api/v1/staff/{salon_id}        // Staff
```

### 3. Webhook Events
- `client_created` - New client registered
- `record_created` - New booking made
- `record_changed` - Booking modified
- `record_deleted` - Booking cancelled

## Common Issues

### Authorization Failed
```javascript
// Wrong ❌
headers = {
  'Authorization': `Bearer ${USER_TOKEN}, Bearer ${PARTNER_TOKEN}`
}

// Correct ✅
headers = {
  'Authorization': `Bearer ${PARTNER_TOKEN}`
}
```

### Webhook Not Receiving Events
1. Check webhook URL in YClients settings
2. Verify SSL certificate is valid
3. Ensure endpoint returns 200 OK
4. Check logs for incoming POST requests

## File Consolidation Notes

### Potential Duplicates
Several files appear to cover similar topics. Consider consolidating:
- Activation guides (2 versions)
- Setup guides (2 versions)
- Multiple technical docs that might overlap

### Recommended Reading Order
1. [AUTHORIZATION_QUICK_REFERENCE.md](AUTHORIZATION_QUICK_REFERENCE.md)
2. [MARKETPLACE_INTEGRATION.md](MARKETPLACE_INTEGRATION.md)
3. [MARKETPLACE_TROUBLESHOOTING.md](MARKETPLACE_TROUBLESHOOTING.md)
4. Technical docs as needed

## Integration Status

✅ **Production Ready** (Deployed Oct 3, 2025)
- Partner authorization working
- Webhooks configured
- Salon onboarding flow complete
- WhatsApp pairing integrated

---
*Total files: 19 | Consider consolidation | Last updated: 2025-11-17*