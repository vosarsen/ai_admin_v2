#!/bin/bash

# Script to update MCP Supabase configuration to use service_role key

echo "📝 Updating MCP Supabase configuration to use service_role key..."

# Service role key for our project
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI5NTQ3NywiZXhwIjoyMDU5ODcxNDc3fQ.43Hq1KlOaTnkhddnybWZWgKlbHGK0FCuhytXVTUBhgY"
SUPABASE_URL="https://yazteodihddglhoxgqunp.supabase.co"

echo ""
echo "To update MCP Supabase configuration, you need to:"
echo ""
echo "1. Remove the old MCP server:"
echo "   claude mcp remove supabase"
echo ""
echo "2. Add it again with service_role key:"
echo "   claude mcp add supabase npx -y @modelcontextprotocol/server-supabase $SUPABASE_URL $SERVICE_ROLE_KEY"
echo ""
echo "3. Restart Claude Code to apply changes"
echo ""
echo "After this, MCP Supabase will use the service_role key and have full access to the database."
echo ""
echo "⚠️ Note: The service_role key has full access to your database."
echo "Keep it secure and never expose it in client-side code!"