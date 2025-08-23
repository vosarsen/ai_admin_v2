#!/bin/bash
# MCP Servers Setup Commands for Claude Code
# Run these commands to properly configure MCP servers

echo "Setting up MCP servers for AI Admin v2..."

# 1. Test Simple Server
echo "Adding test-simple server..."
claude mcp add test-simple \
  /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/test-simple/server.js

# 2. Redis Server
echo "Adding Redis server..."
claude mcp add redis \
  -e REDIS_URL=redis://localhost:6380 \
  -e REDIS_PASSWORD=70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg= \
  -e DEFAULT_COMPANY_ID=962302 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-redis/server.js

# 3. Supabase Server (using service_role key for full access)
echo "Adding Supabase server..."
claude mcp add supabase \
  -e SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co \
  -e SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI5NTQ3NywiZXhwIjoyMDU5ODcxNDc3fQ.43Hq1KlOaTnkhddnybWZWgKlbHGK0FCuhytXVTUBhgY \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-supabase/server.js

# 4. WhatsApp Server
echo "Adding WhatsApp server..."
claude mcp add whatsapp \
  -e AI_ADMIN_API_URL=http://46.149.70.219:3000 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-whatsapp/server.js

# 5. YClients Server
echo "Adding YClients server..."
claude mcp add yclients \
  -e YCLIENTS_BEARER_TOKEN=cfjbs9dpuseefh8ed5cp \
  -e YCLIENTS_USER_TOKEN=16e0dffa0d71350dcb83381e03e7af29 \
  -e YCLIENTS_PARTNER_ID=8444 \
  -e YCLIENTS_COMPANY_ID=962302 \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-yclients/server.js

# 6. Logs Server
echo "Adding Logs server..."
claude mcp add logs \
  -e SERVER_HOST=46.149.70.219 \
  -e SERVER_USER=root \
  -e SSH_PRIVATE_KEY=/Users/vosarsen/.ssh/id_ed25519_ai_admin \
  -- /usr/local/bin/node \
  /Users/vosarsen/Documents/GitHub/ai_admin_v2/mcp/mcp-logs/server.js

echo "Done! Now you can:"
echo "1. List all servers: claude mcp list"
echo "2. Check server status in Claude Code: /mcp"
echo "3. Use servers: @test-simple, @redis, @supabase, @whatsapp, @yclients, @logs"