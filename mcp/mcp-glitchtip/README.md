# GlitchTip MCP Server

MCP server for GlitchTip error tracking integration with Claude Code.

## Features

- Query issues with filtering (status, level, search)
- View detailed error information with stack traces
- Manage issue status (resolve/ignore/unresolve)
- Project health overview

## Setup

1. Create API token in GlitchTip at `/profile/auth-tokens`
2. Copy `.env.example` to `.env` and fill in values
3. Add to `.mcp.json` (see example below)
4. Restart Claude Code

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| GLITCHTIP_URL | GlitchTip instance URL | Yes |
| GLITCHTIP_API_TOKEN | API token from profile | Yes |
| GLITCHTIP_ORG_SLUG | Organization slug | No (auto-detected) |

## .mcp.json Configuration

```json
{
  "glitchtip": {
    "command": "node",
    "args": ["mcp/mcp-glitchtip/server.js"],
    "env": {
      "GLITCHTIP_URL": "https://glitchtip.example.com",
      "GLITCHTIP_API_TOKEN": "your-token-here",
      "GLITCHTIP_ORG_SLUG": "your-org"
    }
  }
}
```

## Available Tools

### Read Operations

| Tool | Description |
|------|-------------|
| `health_check` | Test API connectivity |
| `get_organizations` | List organizations |
| `get_projects` | List projects |
| `get_issues` | List issues with filtering |
| `get_issue_details` | Get detailed error info |
| `get_issue_events` | List events for an issue |

### Write Operations

| Tool | Description |
|------|-------------|
| `resolve_issue` | Mark issue as resolved |
| `ignore_issue` | Mark issue as ignored |
| `unresolve_issue` | Reopen an issue |

### Statistics

| Tool | Description |
|------|-------------|
| `get_project_summary` | Project health overview |

## Usage Examples

```
# Check connectivity
@glitchtip health_check

# Get unresolved errors
@glitchtip get_issues status:unresolved level:error

# Get issue details
@glitchtip get_issue_details issue_id:123

# Resolve an issue
@glitchtip resolve_issue issue_id:123

# Get project health
@glitchtip get_project_summary
```

## Token Scopes

Required scopes for full functionality:
- `event:read` - Read issues and events
- `event:write` - Update issue status
- `project:read` - List projects
- `org:read` - List organizations
