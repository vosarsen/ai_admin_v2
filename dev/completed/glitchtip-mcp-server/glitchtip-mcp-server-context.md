# GlitchTip MCP Server - Context

**Last Updated:** 2025-12-02
**Session:** 1

---

## Key Information

### GlitchTip Instance
- **URL:** https://glitchtip.adminai.tech
- **Login:** support@adminai.tech
- **Password:** SecureAdmin2025GT!
- **API Base:** https://glitchtip.adminai.tech/api/0/

### API Authentication (VERIFIED!)
- **Method:** Bearer token
- **Token:** `59f4347216461350eebe7cb10e1220fb5d866c6eaffcee28b309bc5690b1a64a`
- **Header:** `Authorization: Bearer <token>`
- **Scopes:** 65535 (all permissions)

### Organization & Project (DISCOVERED)
- **Organization slug:** `admin-ai`
- **Project slug:** `admin-ai-production`
- **Project ID:** `1`

### Project Reference Files
- **MCP Config:** `.mcp.json` (root)
- **Reference MCP:** `mcp/mcp-yclients/server.js` (best example, 1150 lines)
- **Simpler Reference:** `mcp/mcp-redis/server.js` (430 lines)
- **Package pattern:** `mcp/mcp-yclients/package.json`

---

## GlitchTip API Reference

### Core Endpoints (Sentry-compatible v0)

```
GET  /api/0/organizations/                    - List organizations
GET  /api/0/projects/                         - List all projects
GET  /api/0/organizations/{org}/projects/     - Projects in organization
GET  /api/0/organizations/{org}/issues/       - List issues
GET  /api/0/issues/{issue_id}/                - Issue details
GET  /api/0/issues/{issue_id}/events/         - Issue events
PUT  /api/0/issues/{issue_id}/                - Update issue status
GET  /api/0/organizations/{org}/stats/        - Statistics
```

### Issue Query Parameters
- `query=is:unresolved` - Filter unresolved
- `query=level:error` - Filter by level
- `project=123` - Filter by project ID
- `statsPeriod=24h` - Time window (24h, 7d, 14d, 30d)
- `cursor=xxx` - Pagination

### Issue Status Values
- `resolved` - Fixed
- `unresolved` - Active problem
- `ignored` - Won't fix / known issue

---

## Technical Decisions

### Decision 1: Use mcp-yclients as template
**Reason:** Most comprehensive example with similar API patterns (REST, JSON, auth headers)

### Decision 2: ESM modules
**Reason:** All existing MCP servers use ESM (`import` not `require`)

### Decision 3: Formatted text output
**Reason:** Better readability in Claude Code terminal

---

## Session Notes

### Session 1 (2025-12-02)
- Created project structure
- Researched GlitchTip API
- Found API is Sentry-compatible (good documentation)
- Need to create API token before implementation

---

## Blockers & Dependencies

### Pre-implementation Required
1. **Create API token** - Must log into GlitchTip UI
2. **Get organization slug** - Need to check actual org name

### Technical Dependencies
- Node.js 18+
- npm packages: @modelcontextprotocol/sdk, zod, dotenv

---

## File Locations

### To Create
- `mcp/mcp-glitchtip/server.js`
- `mcp/mcp-glitchtip/package.json`
- `mcp/mcp-glitchtip/.env`
- `mcp/mcp-glitchtip/README.md`

### To Modify
- `.mcp.json` - Add glitchtip server config
- `CLAUDE.md` - Document new MCP tools

---

## API Response Examples

### Issues List Response (expected)
```json
{
  "data": [
    {
      "id": "123",
      "title": "TypeError: Cannot read property 'x'",
      "culprit": "src/services/booking.js",
      "level": "error",
      "status": "unresolved",
      "count": 42,
      "firstSeen": "2025-12-01T10:00:00Z",
      "lastSeen": "2025-12-02T15:30:00Z",
      "project": {
        "id": 1,
        "name": "ai-admin"
      }
    }
  ]
}
```

### Issue Details Response (expected)
```json
{
  "id": "123",
  "title": "TypeError: Cannot read property 'x'",
  "metadata": {
    "type": "TypeError",
    "value": "Cannot read property 'x' of undefined"
  },
  "culprit": "src/services/booking.js in getBooking",
  "entries": [
    {
      "type": "exception",
      "data": {
        "values": [{
          "type": "TypeError",
          "value": "...",
          "stacktrace": {...}
        }]
      }
    }
  ]
}
```

---

## Quick Commands

### Test API manually
```bash
# Get organizations
curl -H "Authorization: Bearer $TOKEN" \
  https://glitchtip.adminai.tech/api/0/organizations/

# Get issues
curl -H "Authorization: Bearer $TOKEN" \
  "https://glitchtip.adminai.tech/api/0/organizations/ORG/issues/?query=is:unresolved"
```

### Test MCP locally
```bash
cd mcp/mcp-glitchtip
node server.js
```
