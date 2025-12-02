# GlitchTip MCP Server - Implementation Plan

**Last Updated:** 2025-12-02
**Status:** COMPLETE
**Priority:** High
**Estimated Effort:** 6-8 hours
**Actual Effort:** ~2.5 hours (4x faster)

---

## Executive Summary

Create an MCP (Model Context Protocol) server for GlitchTip error tracking integration. This server will enable Claude Code to directly query, analyze, and manage errors from GlitchTip, significantly improving the debugging workflow by eliminating the need for manual browser access.

### Goals
1. Seamless integration with existing MCP infrastructure
2. Read/query issues with filtering capabilities
3. View detailed error information and stack traces
4. Manage issue status (resolve/ignore)
5. Project and organization statistics

---

## Current State Analysis

### Existing MCP Infrastructure

The project has 4 working MCP servers:
- **mcp-yclients** - YClients API integration (1150+ lines, most feature-rich)
- **mcp-redis** - Redis context management (430 lines)
- **mcp-whatsapp** - WhatsApp messaging
- **mcp-logs** - Server logs access

All use the same patterns:
- `@modelcontextprotocol/sdk` package
- `StdioServerTransport` for communication
- `zod` for input validation
- ESM modules with `.js` extension

### GlitchTip Configuration
- **URL:** https://glitchtip.adminai.tech
- **Credentials:** support@adminai.tech / SecureAdmin2025GT!
- **API Version:** Sentry-compatible (v0)
- **Auth Method:** Bearer token from `/profile/auth-tokens`

### GlitchTip API Endpoints (Sentry-compatible)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/0/organizations/` | GET | List organizations |
| `/api/0/projects/` | GET | List all projects |
| `/api/0/organizations/{org}/issues/` | GET | List issues with filtering |
| `/api/0/issues/{issue_id}/` | GET | Get issue details |
| `/api/0/issues/{issue_id}/events/` | GET | Get events for issue |
| `/api/0/issues/{issue_id}/` | PUT | Update issue (resolve/ignore) |
| `/api/0/organizations/{org}/stats/` | GET | Organization statistics |

### Query Parameters for Issues
- `query` - Search query (e.g., `is:unresolved level:error`)
- `project` - Filter by project ID
- `statsPeriod` - Time range (24h, 7d, 14d, 30d)
- `cursor` - Pagination cursor

---

## Proposed Architecture

### Directory Structure
```
mcp/mcp-glitchtip/
├── server.js        # Main MCP server
├── package.json     # Dependencies
├── .env.example     # Environment template
└── README.md        # Documentation
```

### Environment Variables
```bash
GLITCHTIP_URL=https://glitchtip.adminai.tech
GLITCHTIP_API_TOKEN=<token_from_profile>
GLITCHTIP_ORG_SLUG=<organization_slug>
```

### Authentication Flow
1. User creates API token in GlitchTip UI (`/profile/auth-tokens`)
2. Token stored in environment variable
3. MCP server uses Bearer authentication for all requests

---

## Implementation Phases

### Phase 1: Core Setup (1-2 hours)
**Goal:** Working MCP server with basic connectivity

1.1. Create directory structure
1.2. Initialize package.json with dependencies
1.3. Create server.js skeleton
1.4. Implement authentication helper
1.5. Add to .mcp.json configuration
1.6. Test basic connectivity

### Phase 2: Read Operations (2-3 hours)
**Goal:** Full read access to GlitchTip data

2.1. **get_organizations** - List available organizations
2.2. **get_projects** - List projects with stats
2.3. **get_issues** - List issues with filtering
     - Filter by status (unresolved/resolved/ignored)
     - Filter by level (error/warning/info)
     - Filter by project
     - Filter by time period
2.4. **get_issue_details** - Full issue info with stack trace
2.5. **get_issue_events** - List events for specific issue

### Phase 3: Write Operations (1-2 hours)
**Goal:** Ability to manage issues

3.1. **resolve_issue** - Mark issue as resolved
3.2. **ignore_issue** - Ignore issue
3.3. **unresolve_issue** - Reopen issue
3.4. **bulk_resolve** - Resolve multiple issues

### Phase 4: Statistics & Analytics (1 hour)
**Goal:** Overview and monitoring capabilities

4.1. **get_stats** - Error statistics over time
4.2. **get_project_summary** - Quick project health overview

### Phase 5: Documentation & Testing (1 hour)
**Goal:** Production-ready deliverable

5.1. Write README.md with usage examples
5.2. Create .env.example
5.3. End-to-end testing
5.4. Update CLAUDE.md with new MCP documentation

---

## Tool Specifications

### get_issues
```typescript
inputSchema: {
  query: z.string().optional().describe('Search query (e.g., is:unresolved level:error)'),
  project_id: z.number().optional().describe('Filter by project ID'),
  status: z.enum(['unresolved', 'resolved', 'ignored']).optional(),
  level: z.enum(['error', 'warning', 'info', 'debug']).optional(),
  stats_period: z.enum(['24h', '7d', '14d', '30d']).optional().default('24h'),
  limit: z.number().optional().default(25).describe('Max results')
}
```

### get_issue_details
```typescript
inputSchema: {
  issue_id: z.number().describe('Issue ID from get_issues')
}
```

Output: Full error message, stack trace, tags, first/last seen, event count

### resolve_issue
```typescript
inputSchema: {
  issue_id: z.number().describe('Issue ID'),
  status: z.enum(['resolved', 'ignored', 'unresolved']).default('resolved')
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API token expiration | Low | Medium | Document token refresh process |
| API rate limiting | Low | Low | Add retry logic with backoff |
| Breaking API changes | Low | Medium | Version pin, monitor GlitchTip updates |
| Network issues | Medium | Low | Timeout handling, clear error messages |

---

## Success Metrics

1. **Functional:** All 10+ tools working correctly
2. **Performance:** Response time < 3 seconds
3. **Reliability:** Graceful error handling
4. **Usability:** Clear, formatted output in Claude Code
5. **Documentation:** Complete README and CLAUDE.md updates

---

## Dependencies

### npm packages
- `@modelcontextprotocol/sdk` - MCP protocol
- `zod` - Input validation
- `dotenv` - Environment configuration

### External
- GlitchTip API token (manual creation required)
- Network access to glitchtip.adminai.tech

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 1-2h | Working server with auth |
| Phase 2 | 2-3h | All read operations |
| Phase 3 | 1-2h | Write operations |
| Phase 4 | 1h | Statistics tools |
| Phase 5 | 1h | Documentation |
| **Total** | **6-9h** | Production-ready MCP |

---

## Next Steps

1. Create API token in GlitchTip UI
2. Identify organization slug
3. Begin Phase 1 implementation
