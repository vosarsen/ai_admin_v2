# MCP (Model Context Protocol) Configuration Guide

## Overview

MCP servers provide direct access to external services through Claude Code. This guide explains how to create, configure, and troubleshoot MCP servers for the AI Admin v2 project.

## MCP Architecture

MCP servers communicate with Claude using stdio (standard input/output). Claude launches each server as a separate process and communicates via JSON-RPC messages.

## Configuration Location

Claude reads MCP configuration from:
- **macOS/Linux**: `~/.config/claude/mcp.json`
- **Windows**: `%APPDATA%\claude\mcp.json`

**Important**: The `mcp.json` file in your project directory is NOT used by Claude. Only the file in the config directory is read.

## Configuration Structure

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/absolute/path/to/server.js"],
      "env": {
        "ENV_VAR": "value",
        "ANOTHER_VAR": "${SYSTEM_ENV_VAR}"
      }
    }
  }
}
```

## Environment Variables

### Two Approaches

1. **Hardcoded Values** (Simple but less secure):
```json
"env": {
  "API_KEY": "sk-actual-key-value",
  "API_URL": "http://example.com"
}
```

2. **System Variables** (More secure, but currently not working in Claude):
```json
"env": {
  "API_KEY": "${API_KEY}",
  "API_URL": "${API_URL}"
}
```

**Current Issue**: Claude does not expand `${VAR}` syntax from system environment variables. You must use hardcoded values.

## Creating an MCP Server

### 1. Project Structure
```
mcp-servicename/
├── server.js       # Main server file
├── package.json    # Dependencies
└── README.md       # Documentation
```

### 2. Basic Server Template

```javascript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '..', '.env') });

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Create MCP server
const server = new McpServer({
  name: 'servicename-mcp',
  version: '1.0.0',
  description: 'MCP Server for ServiceName'
});

// Register tools
server.registerTool("tool_name",
  {
    title: "Tool Title",
    description: "What this tool does",
    inputSchema: {
      param1: z.string().describe('Parameter description'),
      param2: z.number().optional().describe('Optional parameter')
    }
  },
  async ({ param1, param2 }) => {
    // Tool implementation
    try {
      // Your logic here
      return {
        content: [{
          type: "text",
          text: "Result of the operation"
        }]
      };
    } catch (error) {
      throw new Error(`Operation failed: ${error.message}`);
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ServiceName MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

### 3. Package.json

```json
{
  "name": "mcp-servicename",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.1.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  }
}
```

### 4. Install Dependencies

```bash
cd mcp-servicename
npm install
```

## Adding to Claude Configuration

1. Find Claude's config directory:
```bash
# macOS/Linux
ls ~/.config/claude/mcp.json

# Windows
dir %APPDATA%\claude\mcp.json
```

2. Edit the mcp.json file:
```json
{
  "mcpServers": {
    "existing-server": { ... },
    "your-new-server": {
      "command": "node",
      "args": ["/full/path/to/your/mcp-servicename/server.js"],
      "env": {
        "API_URL": "https://your-api.com",
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

3. Restart Claude Code for changes to take effect

## Testing MCP Servers

### 1. Manual Testing
```bash
cd mcp-servicename
node server.js
# Should output: "ServiceName MCP Server started successfully"
# Press Ctrl+C to stop
```

### 2. Check if Server is Running
```bash
ps aux | grep mcp-servicename
```

### 3. Using in Claude
- Type `/mcp` in Claude
- Select your server: `@servicename`
- Use available tools

## Common Issues and Solutions

### 1. Server Not Appearing in /mcp

**Problem**: Server not listed when typing `/mcp`

**Solutions**:
- Check mcp.json is in correct location (`~/.config/claude/`)
- Verify JSON syntax is valid
- Restart Claude Code
- Check server path is absolute, not relative

### 2. "Not connected" Error

**Problem**: Getting "Not connected" when trying to use MCP tools

**Solutions**:
- Server failed to start - check manual startup for errors
- Environment variables missing or incorrect
- Dependencies not installed (`npm install`)

### 3. "fetch failed" Error

**Problem**: Network requests failing from MCP server

**Solutions**:
- Check API URL is correct and accessible
- Verify authentication credentials
- Check if API is running

### 4. Environment Variables Not Working

**Problem**: `${VAR}` syntax not expanding in mcp.json

**Current Workaround**: Use hardcoded values instead of variable expansion
```json
// Instead of:
"API_KEY": "${API_KEY}"

// Use:
"API_KEY": "sk-actual-key-value"
```

## AI Admin v2 MCP Servers

### Currently Configured:

1. **Supabase** (`@supabase`)
   - Query database tables
   - Get statistics
   - Search bookings

2. **Redis** (`@redis`)
   - Manage conversation contexts
   - Set booking stages
   - Simulate client scenarios
   - Requires SSH tunnel to remote server

3. **YClients** (`@yclients`)
   - Get services and staff
   - Check available slots
   - Create test bookings
   - Search clients

4. **WhatsApp** (`@whatsapp`)
   - Send test messages
   - Run booking scenarios
   - Simulate bot responses

### Redis SSH Tunnel Setup

Redis MCP requires special setup due to remote server access:

```bash
# Quick setup
./setup-redis-tunnel.sh quick

# The tunnel runs on:
# localhost:6380 → 46.149.70.219:6379
```

## Best Practices

1. **Security**:
   - Never commit mcp.json with real credentials
   - Use environment variables where possible
   - Keep sensitive data out of logs

2. **Error Handling**:
   - Always wrap async operations in try-catch
   - Return meaningful error messages
   - Use `console.error` for debug info (goes to stderr)

3. **Tool Design**:
   - Make tool names descriptive
   - Provide good descriptions for parameters
   - Use Zod schemas for input validation
   - Return structured responses

4. **Development**:
   - Test servers manually before adding to Claude
   - Check logs when debugging issues
   - Keep servers stateless when possible

## Debugging

### Enable Debug Logging
```javascript
// In your server.js
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.error('Debug: Operation started', { params });
}
```

### View Claude Logs
Currently, Claude does not provide direct access to MCP server logs. Use manual testing to debug issues.

### Common Debug Commands
```bash
# Check if server is running
ps aux | grep mcp

# Test server manually
cd mcp-servicename && node server.js

# Check environment variables
env | grep API_URL
```

## References

- [Claude MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP SDK Repository](https://github.com/anthropics/model-context-protocol)
- [Environment Variable Expansion Issue](https://docs.anthropic.com/en/docs/claude-code/mcp#environment-variable-expansion-in-mcp-json)