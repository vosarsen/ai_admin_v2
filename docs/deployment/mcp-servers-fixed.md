# MCP Servers Fix Summary (July 17, 2024)

## What Was Fixed

### 1. Redis MCP Server
**Problem**: Connected to Redis immediately on startup, failing when tunnel wasn't running
**Fix**: Deferred connection to first tool use with `getRedisClient()` function

### 2. Supabase MCP Server  
**Problem**: Created Supabase client at top level during startup
**Fix**: Deferred client creation with `getSupabaseClient()` function

### 3. Logs MCP Server
**Problem**: Read SSH private key file at startup with `await fs.readFile()`
**Fix**: Deferred SSH config loading with `getSSHConfig()` function

### 4. Test-Simple Server
**Created**: New minimal test server to verify MCP is working

## Configuration Updates

All MCP servers are now configured in `~/.config/claude/mcp.json`:
- **test-simple** - Basic echo test
- **redis** - Redis cache management (requires SSH tunnel on port 6380)
- **supabase** - Database access
- **whatsapp** - WhatsApp testing
- **yclients** - YClients API
- **logs** - Server logs via SSH

## Key Principle

**MCP servers must start immediately without blocking operations**

Bad pattern:
```javascript
// ❌ Connects on startup
const client = await createConnection();
```

Good pattern:
```javascript
// ✅ Defers connection
let client = null;
async function getClient() {
  if (!client) {
    client = await createConnection();
  }
  return client;
}
```

## Testing After Restart

1. Restart Claude Code
2. Test each server:
   - `@test-simple echo "Hello"` - Should return "Echo: Hello"
   - `@redis get_all_keys "*"` - Should list Redis keys (start tunnel first)
   - `@supabase list_tables` - Should show database tables
   - `@whatsapp check_status` - Should check WhatsApp status
   - `@yclients get_services` - Should list services
   - `@logs logs_tail` - Should show recent logs

## If Servers Still Fail

1. Check the server starts without errors:
   ```bash
   node /path/to/server.js < /dev/null
   ```

2. Ensure Redis tunnel is running:
   ```bash
   ./scripts/maintain-redis-tunnel.sh start
   ```

3. Verify all environment variables in mcp.json are correct

4. Check Claude Code developer console for errors

5. See [docs/mcp-servers-guide.md](./mcp-servers-guide.md) for detailed troubleshooting