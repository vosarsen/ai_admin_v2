# MCP Servers Complete Guide

## Overview

MCP (Model Context Protocol) servers provide Claude Code with direct access to external services. This guide covers everything you need to know about creating, configuring, and troubleshooting MCP servers.

## Table of Contents

1. [How MCP Works](#how-mcp-works)
2. [Common Problems & Solutions](#common-problems--solutions)
3. [Creating MCP Servers](#creating-mcp-servers)
4. [Configuration](#configuration)
5. [Testing & Debugging](#testing--debugging)
6. [Available MCP Servers](#available-mcp-servers)
7. [Best Practices](#best-practices)

## How MCP Works

### Architecture
```
Claude Code <-> MCP Client <-> STDIO <-> MCP Server <-> External Service
```

1. Claude launches each MCP server as a separate process
2. Communication happens via STDIO using JSON-RPC protocol
3. Servers expose tools, resources, and prompts to Claude
4. Claude can invoke these tools during conversations

### Key Principles

1. **Immediate Startup**: Servers must start immediately without blocking
2. **Deferred Connections**: Connect to external services only when needed
3. **STDIO Communication**: All communication via standard input/output
4. **Stateless Operations**: Each tool invocation should be independent

## Common Problems & Solutions

### Problem 1: Server Shows as "Failed" in Claude

**Symptoms**: MCP server appears as failed or unavailable in Claude Code

**Common Causes**:
1. Server tries to connect to external service on startup
2. Missing dependencies
3. Syntax errors in server code
4. Wrong path in configuration

**Solution**:
```javascript
// ❌ WRONG - Connects on startup
const redis = createClient();
await redis.connect(); // This blocks startup!

// ✅ CORRECT - Defers connection
let redis = null;
async function getRedisClient() {
  if (!redis) {
    redis = createClient();
    await redis.connect();
  }
  return redis;
}
```

### Problem 2: Environment Variables Not Working

**Symptom**: `${ENV_VAR}` syntax doesn't expand in mcp.json

**Solution**: Use hardcoded values
```json
// ❌ WRONG
"env": {
  "API_KEY": "${API_KEY}"
}

// ✅ CORRECT
"env": {
  "API_KEY": "sk-actual-api-key-value"
}
```

### Problem 3: "Command not found" Error

**Solution**: Use absolute paths
```json
{
  "command": "/usr/local/bin/node",  // Full path
  "args": ["/absolute/path/to/server.js"]
}
```

## Creating MCP Servers

### Basic Server Template

```javascript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';

// Create server
const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
  description: 'My MCP Server'
});

// Register tools
server.registerTool("my_tool",
  {
    title: "My Tool",
    description: "What this tool does",
    inputSchema: {
      param: z.string().describe('Parameter description')
    }
  },
  async ({ param }) => {
    // Tool logic here
    return {
      content: [{
        type: "text",
        text: `Result: ${param}`
      }]
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### Project Structure
```
mcp-myservice/
├── server.js       # Main server file
├── package.json    # Dependencies
├── .env           # Local environment (optional)
└── README.md      # Documentation
```

### Package.json Template
```json
{
  "name": "mcp-myservice",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "zod": "^3.24.1"
  }
}
```

## Configuration

### Location
- **macOS/Linux**: `~/.config/claude/mcp.json`
- **Windows**: `%APPDATA%\claude\mcp.json`

### Configuration Structure
```json
{
  "mcpServers": {
    "server-name": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/server.js"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### Important Notes
1. Always use **absolute paths**
2. Environment variables must be **hardcoded** (no ${VAR} expansion)
3. The configuration file in your project is **NOT used** by Claude

## Testing & Debugging

### 1. Test Server Startup
```bash
# Run server with no input
node server.js < /dev/null

# Should exit cleanly without errors
```

### 2. Test with Sample Input
```bash
# Create test input
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{}}' | node server.js
```

### 3. Debug Output
Add debug logging to stderr (not stdout!):
```javascript
console.error('Debug:', message); // Goes to stderr
// Never use console.log() - it interferes with STDIO protocol
```

### 4. Check Claude Code Logs
Look for MCP-related errors in Claude Code's developer console

## Available MCP Servers

### 1. test-simple
**Purpose**: Basic test server to verify MCP is working
**Usage**: `@test-simple echo "Hello"`

### 2. mcp-redis
**Purpose**: Redis cache management for AI Admin
**Commands**:
- `@redis get_context phone:79001234567` - Get conversation context
- `@redis clear_context phone:79001234567` - Reset conversation
- `@redis list_active_contexts` - Show active conversations
- `@redis set_booking_stage` - Set booking stage for testing

**Required**: SSH tunnel on port 6380
```bash
./scripts/maintain-redis-tunnel.sh start
```

### 3. mcp-whatsapp
**Purpose**: WhatsApp testing integration
**Commands**:
- `@whatsapp send_test_message` - Send test message
- `@whatsapp check_status` - Check WhatsApp connection

### 4. mcp-yclients
**Purpose**: YClients API integration
**Commands**:
- `@yclients get_services` - List available services
- `@yclients get_staff` - List staff members
- `@yclients search_slots` - Find available time slots

### 5. mcp-supabase
**Purpose**: Direct database access
**Commands**:
- `@supabase list_tables` - Show all tables
- `@supabase query_table clients` - Query specific table
- `@supabase get_database_stats` - Database statistics

## Best Practices

### 1. Defer External Connections
```javascript
// Create connection function
let connection = null;
async function getConnection() {
  if (!connection) {
    connection = await createConnection();
  }
  return connection;
}

// Use in tool handlers
async ({ param }) => {
  const conn = await getConnection();
  // Use connection
}
```

### 2. Handle Errors Gracefully
```javascript
async ({ param }) => {
  try {
    const result = await doSomething(param);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error.message}`
      }]
    };
  }
}
```

### 3. Use Proper Input Validation
```javascript
server.registerTool("my_tool",
  {
    inputSchema: {
      phone: z.string().regex(/^7\d{10}$/).describe('Russian phone'),
      limit: z.number().min(1).max(100).optional().default(10)
    }
  },
  async (params) => {
    // params are validated automatically
  }
);
```

### 4. Return Structured Data
```javascript
return {
  content: [{
    type: "text",
    text: JSON.stringify(data, null, 2) // Pretty print
  }]
};
```

### 5. Clean Shutdown
```javascript
process.on('SIGINT', async () => {
  if (connection) {
    await connection.close();
  }
  process.exit(0);
});
```

## Troubleshooting Checklist

When MCP server fails:

1. **Check server startup**:
   ```bash
   node server.js < /dev/null
   ```

2. **Verify dependencies**:
   ```bash
   npm install
   ```

3. **Check configuration path**:
   ```bash
   cat ~/.config/claude/mcp.json
   ```

4. **Ensure absolute paths** in mcp.json

5. **Check for blocking operations** in server startup

6. **Verify external services** (Redis, databases) are accessible

7. **Look for syntax errors** in server.js

8. **Test with simple server** first (test-simple)

9. **Restart Claude Code** after configuration changes

10. **Check stderr output** for debug messages

## Configuration Examples

### Development Setup
```json
{
  "mcpServers": {
    "test-simple": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/username/project/mcp/test-simple/server.js"]
    },
    "redis": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/username/project/mcp/mcp-redis/server.js"],
      "env": {
        "REDIS_URL": "redis://localhost:6380",
        "REDIS_PASSWORD": "your-password"
      }
    }
  }
}
```

### Production Setup
```json
{
  "mcpServers": {
    "redis": {
      "command": "node",
      "args": ["/opt/ai-admin/mcp/mcp-redis/server.js"],
      "env": {
        "REDIS_URL": "redis://production-host:6379",
        "REDIS_PASSWORD": "production-password"
      }
    },
    "database": {
      "command": "node",
      "args": ["/opt/ai-admin/mcp/mcp-supabase/server.js"],
      "env": {
        "SUPABASE_URL": "https://project.supabase.co",
        "SUPABASE_KEY": "service-role-key"
      }
    }
  }
}
```

## Summary

Key points to remember:
1. MCP servers must start immediately without blocking
2. Defer external connections until needed
3. Use absolute paths in configuration
4. Environment variables must be hardcoded
5. Test servers individually before adding to Claude
6. Always restart Claude Code after config changes

For more help, check the official MCP documentation at https://modelcontextprotocol.io