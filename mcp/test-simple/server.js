#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';

// Create MCP server
const server = new McpServer({
  name: 'test-simple',
  version: '1.0.0',
  description: 'Simple test MCP server'
});

// Register a simple tool
server.registerTool("echo",
  {
    title: "Echo",
    description: "Echo back the input",
    inputSchema: {
      message: z.string().describe('Message to echo')
    }
  },
  async ({ message }) => {
    return {
      content: [{
        type: "text",
        text: `Echo: ${message}`
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});