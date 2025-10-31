# MCP Servers Guide v2 - The Correct Way

## ⚠️ Important: Use CLI Commands, Not Manual JSON Editing!

This guide follows the official Claude Code documentation for setting up MCP servers.

## Quick Start

### 1. Run Setup Script
```bash
# Make sure you're in the project directory
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2

# Run the setup script
./docs/mcp-setup-commands.sh
```

### 2. Verify Installation
```bash
# List all configured servers
claude mcp list

# Check specific server
claude mcp get redis
```

### 3. Check Status in Claude Code
Use the `/mcp` command inside Claude Code to see server status and authenticate if needed.

## Manual Setup (If Script Doesn't Work)

### Basic Syntax
```bash
claude mcp add <name> [options] -- <command> [args...]
```

### Adding Each Server

#### 1. Test Simple Server
```bash
claude mcp add test-simple \
  /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/test-simple/server.js
```

#### 2. Redis Server
```bash
# First, ensure SSH tunnel is running
./scripts/maintain-redis-tunnel.sh start

# Add the server
claude mcp add redis \
  -e REDIS_URL=redis://localhost:6380 \
  -e REDIS_PASSWORD=70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg= \
  -e DEFAULT_COMPANY_ID=962302 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-redis/server.js
```

#### 3. Supabase Server
```bash
claude mcp add supabase \
  -e SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co \
  -e SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyOTU0NzcsImV4cCI6MjA1OTg3MTQ3N30.YWm7hXpWgbmQjN_s0CH_SsMcC7DFi-ZPNahY4rKl7a8 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-supabase/server.js
```

#### 4. WhatsApp Server
```bash
claude mcp add whatsapp \
  -e AI_ADMIN_API_URL=http://46.149.70.219:3000 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-whatsapp/server.js
```

#### 5. YClients Server
```bash
claude mcp add yclients \
  -e YCLIENTS_BEARER_TOKEN=cfjbs9dpuseefh8ed5cp \
  -e YCLIENTS_USER_TOKEN=16e0dffa0d71350dcb83381e03e7af29 \
  -e YCLIENTS_PARTNER_ID=8444 \
  -e YCLIENTS_COMPANY_ID=962302 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-yclients/server.js
```

#### 6. Logs Server
```bash
claude mcp add logs \
  -e SERVER_HOST=46.149.70.219 \
  -e SERVER_USER=root \
  -e SSH_PRIVATE_KEY=/Users/vosarsen/.ssh/id_ed25519_ai_admin \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-logs/server.js
```

## Managing Servers

### List All Servers
```bash
claude mcp list
```

### Get Server Details
```bash
claude mcp get <server-name>
```

### Remove a Server
```bash
claude mcp remove <server-name>
```

### Update a Server
Remove and re-add with new configuration:
```bash
claude mcp remove redis
claude mcp add redis [new options...]
```

## Scopes

By default, servers are added to `local` scope (current project only). You can specify different scopes:

- **local** (default): Only for current project
- **project**: Shared via `.mcp.json` in project root
- **user**: Available across all projects

```bash
# Add to user scope (available everywhere)
claude mcp add -s user my-server /path/to/server

# Add to project scope (shared with team)
claude mcp add -s project shared-server /path/to/server
```

## Using MCP Servers in Claude Code

### 1. Check Status
Type `/mcp` in Claude Code to see all servers and their status.

### 2. Reference Resources
Use `@` to reference MCP resources:
```
@redis get_context phone:79001234567
@supabase list_tables
@yclients get_services
```

### 3. Use MCP Tools
Servers expose tools that Claude can use automatically when needed.

## Troubleshooting

### Server Shows as "Failed"

1. **Check logs**: Look at Claude Code's developer console
2. **Test manually**: 
   ```bash
   node /path/to/server.js < /dev/null
   ```
3. **Verify environment variables**: Make sure all required vars are set with `-e`
4. **Check dependencies**: 
   ```bash
   cd /path/to/mcp-server && npm install
   ```

### "Command not found" Error

Always use absolute paths:
- ❌ `node server.js`
- ✅ `/usr/local/bin/node /full/path/to/server.js`

### Redis Connection Failed

Ensure SSH tunnel is running:
```bash
./scripts/maintain-redis-tunnel.sh start
```

### Can't See Servers

1. Check they're added: `claude mcp list`
2. Restart Claude Code
3. Use `/mcp` command to refresh

## Important Notes

1. **Never edit `~/.config/claude/mcp.json` manually** - use CLI commands
2. **Environment variables must be set with `-e` flag** - no ${VAR} expansion in basic setup
3. **Use absolute paths** for both command and script paths
4. **Servers must start immediately** - defer external connections (already fixed in our servers)
5. **Check `/mcp` command** in Claude Code for real-time status

## Project-Wide Configuration

To share servers with your team, use project scope:

```bash
# Add to project scope
claude mcp add -s project redis [options...]

# This creates .mcp.json in project root
# Team members will be prompted to approve servers
```

The `.mcp.json` file supports environment variable expansion:
```json
{
  "mcpServers": {
    "api-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${API_KEY:-default-key}"
      }
    }
  }
}
```

## Summary

The correct way to set up MCP servers:
1. Use `claude mcp add` command
2. Specify environment variables with `-e`
3. Use absolute paths
4. Check status with `/mcp` in Claude Code
5. Never manually edit configuration files

For quick setup, just run:
```bash
./docs/mcp-setup-commands.sh
```