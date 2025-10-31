#!/bin/bash

echo "=== Тестирование MCP серверов ==="

# 1. Redis
echo -e "\n1. Тестирование Redis MCP:"
echo '{"jsonrpc":"2.0","method":"get_all_keys","params":{"pattern":"test:*"},"id":1}' | node mcp/mcp-redis/server.js 2>&1 | head -10

# 2. Supabase
echo -e "\n2. Тестирование Supabase MCP:"
echo '{"jsonrpc":"2.0","method":"list_tables","params":{},"id":1}' | node mcp/mcp-supabase/server.js 2>&1 | head -10

# 3. WhatsApp
echo -e "\n3. Тестирование WhatsApp MCP:"
echo '{"jsonrpc":"2.0","method":"check_status","params":{},"id":1}' | node mcp/mcp-whatsapp/server.js 2>&1 | head -10

# 4. YClients
echo -e "\n4. Тестирование YClients MCP:"
echo '{"jsonrpc":"2.0","method":"check_auth","params":{},"id":1}' | node mcp/mcp-yclients/server.js 2>&1 | head -10

# 5. Logs
echo -e "\n5. Тестирование Logs MCP:"
echo '{"jsonrpc":"2.0","method":"tail_logs","params":{"service":"api","lines":5},"id":1}' | node mcp/mcp-logs/server.js 2>&1 | head -10