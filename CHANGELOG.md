# Changelog

All notable changes to AI Admin v2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🎉 Added
- **Notion MCP Server Integration** - Official Notion integration for task management
  - Added `@notion` MCP server with full Notion API access
  - Support for creating/updating pages and databases
  - Query database functionality for task tracking
  - Integration with development workflow via `.mcp.json`
  - Comprehensive setup documentation in `docs/NOTION_MCP_SETUP.md`

### 🔧 Changed
- **MCP Configuration Centralized** - All 5 MCP servers now in single `.mcp.json`
  - Consolidated custom MCP servers (whatsapp, redis, supabase, yclients)
  - Added official Notion MCP server via npx
  - Updated `.claude/settings.json` to enable all servers
  - Created `.mcp.json.example` template
  - Updated `mcp/README.md` with complete 5-server setup guide

### 📚 Documentation
- Added `docs/NOTION_MCP_SETUP.md` - Complete Notion integration guide
- Updated `CLAUDE.md` - MCP servers table with all 5 servers
- Updated `mcp/README.md` - Installation and usage for all servers
- Created `dev/active/notion-mcp-integration/` - Integration docs and code review

### 🔒 Security
- Added `.mcp.json` to `.gitignore` to prevent credential leaks
- Created `.mcp.json.example` for safe documentation

## [1.1.0] - 2025-01-16

### 🎉 Added
- **YClients Marketplace Integration** - Full integration with YClients marketplace platform
  - QR-code based WhatsApp connection interface
  - Real-time WebSocket updates during connection process
  - Automatic company registration from YClients
  - OAuth/API callback handling
  - Multi-tenant support for unlimited salons

- **Security Enhancements**
  - JWT authentication for all marketplace endpoints
  - Advanced rate limiting (5 connections/60sec per IP)
  - Origin validation for WebSocket connections
  - Complete input validation and sanitization utilities
  - Protection against SQL injection, XSS, CSRF attacks

- **New API Endpoints**
  - `POST /marketplace/register` - Register company from YClients
  - `GET /marketplace/connect` - WhatsApp connection page
  - `GET /marketplace/qr/:token` - Generate QR code
  - `GET /marketplace/status/:companyId` - Check connection status
  - `POST /marketplace/callback` - YClients callback handler
  - `POST /marketplace/webhook/:companyId` - YClients webhooks
  - `GET /marketplace/companies` - Connection statistics (admin only)

- **Documentation**
  - Complete implementation guide (MARKETPLACE_IMPLEMENTATION.md)
  - Security best practices guide (MARKETPLACE_SECURITY.md)
  - Code review report (MARKETPLACE_CODE_REVIEW.md)
  - API reference with examples
  - Integration guide for YClients developers

### 🔧 Fixed
- **Critical Security Issues**
  - Removed hardcoded JWT_SECRET default value
  - Fixed SQL injection vulnerabilities through parameterized queries
  - Fixed memory leaks in WebSocket connections
  - Proper cleanup of Baileys sessions and event listeners

### 🚀 Improved
- **WebSocket Security**
  - Token now transmitted via Authorization header instead of query params
  - Added connection cleanup on disconnect
  - Implemented periodic rate limiter cleanup
  - Added suspicious activity detection and blacklisting

- **Data Validation**
  - Created comprehensive validators.js with all validation functions
  - Phone number normalization and validation
  - Email format validation with injection protection
  - String sanitization with XSS protection
  - Safe ID validation to prevent integer overflow

### 📦 Dependencies
- Added `jsonwebtoken` for JWT handling
- Added `qrcode` for QR generation
- Updated `@whiskeysockets/baileys` to latest version

## [1.0.0] - 2025-01-10

### 🎯 Initial Production Release

#### Core Features
- **AI-First Architecture** with single unified AI service
- **Smart Context System** with multi-level caching
- **WhatsApp Integration** via Venom Bot and Baileys
- **Booking Management** with YClients CRM integration
- **Multi-tenant Support** scalable to 10,000+ companies
- **Automatic Reminders** with two-tier notification system
- **Client Personalization** based on visit history

#### AI Commands
- `[SEARCH_SLOTS]` - Intelligent slot search
- `[CREATE_BOOKING]` - Direct booking creation
- `[SHOW_PRICES]` - Dynamic price lists
- `[SAVE_CLIENT_NAME]` - Client name recognition
- `[CANCEL_BOOKING]` - Booking cancellation
- `[RESCHEDULE_BOOKING]` - Booking rescheduling
- `[CHECK_STAFF_SCHEDULE]` - Staff availability

#### Performance
- Response time: 2-5 seconds average
- Throughput: 100-200 messages/minute
- Cache hit rate: >70%
- Memory usage: <150MB per worker

## [0.9.0] - 2024-12-15

### 🚧 Beta Release

#### Added
- Redis-based message batching for rapid-fire protection
- Context preservation across messages
- Automatic business type detection
- Loyalty program with VIP recognition

#### Fixed
- WhatsApp connection stability issues
- Message duplication problems
- Context memory leaks
- Incorrect phone number extraction

## [0.8.0] - 2024-11-01

### 🔬 Alpha Release

#### Initial Implementation
- Basic booking functionality
- YClients API integration
- Simple context management
- WhatsApp message handling

---

## Upgrade Instructions

### From 1.0.0 to 1.1.0

1. **Update environment variables:**
   ```bash
   JWT_SECRET=your_secure_random_string_min_32_chars
   ```

2. **Install new dependencies:**
   ```bash
   npm install
   ```

3. **Run database migrations:**
   ```bash
   npm run migrate
   ```

4. **Update PM2 configuration:**
   ```bash
   pm2 restart ecosystem.config.js
   ```

5. **Verify marketplace endpoints:**
   ```bash
   curl https://your-domain/marketplace/test
   ```

### Breaking Changes in 1.1.0
- JWT_SECRET is now required (no default value)
- WebSocket tokens must be in headers, not query params
- All IDs must pass validation before database operations

## Support

For questions and support, please contact:
- Email: support@ai-admin.app
- GitHub Issues: https://github.com/vosarsen/ai_admin_v2/issues

---

*For more detailed information about each release, see the commit history.*