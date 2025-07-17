#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from 'ssh2';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import fs from 'fs/promises';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '..', '.env') });

// SSH Configuration
const SSH_CONFIG = {
  host: process.env.SERVER_HOST || '46.149.70.219',
  port: parseInt(process.env.SERVER_PORT || '22'),
  username: process.env.SERVER_USER || 'root',
  privateKey: process.env.SSH_PRIVATE_KEY ? 
    await fs.readFile(process.env.SSH_PRIVATE_KEY) : undefined,
  password: process.env.SERVER_PASSWORD
};

// Verify SSH configuration
if (!SSH_CONFIG.privateKey && !SSH_CONFIG.password) {
  console.error('Missing SSH authentication: provide either SSH_PRIVATE_KEY or SERVER_PASSWORD in environment');
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: 'logs-mcp',
  version: '1.0.0',
  description: 'MCP Server for accessing AI Admin logs via SSH'
});

// Helper function to execute SSH commands
async function executeSSHCommand(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('close', () => {
          conn.end();
          resolve(output);
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', (data) => {
          output += data.toString();
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect(SSH_CONFIG);
  });
}

// Register tools
server.registerTool("logs_tail",
  {
    title: "Get Tail Logs",
    description: "Get last N lines from PM2 logs",
    inputSchema: {
      service: z.string()
        .optional()
        .default('ai-admin-worker-v2')
        .describe('Service name (e.g., ai-admin-worker-v2)'),
      lines: z.number()
        .optional()
        .default(50)
        .describe('Number of lines to retrieve')
    }
  },
  async ({ service, lines }) => {
    const command = `pm2 logs ${service} --lines ${lines} --nostream`;
    const logs = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: `Last ${lines} lines from ${service}:\n\n${logs}`
      }]
    };
  }
);

server.registerTool("logs_search",
  {
    title: "Search Logs",
    description: "Search for pattern in logs",
    inputSchema: {
      pattern: z.string()
        .describe('Search pattern'),
      service: z.string()
        .optional()
        .default('ai-admin-worker-v2')
        .describe('Service name'),
      lines: z.number()
        .optional()
        .default(5)
        .describe('Context lines around matches')
    }
  },
  async ({ pattern, service, lines }) => {
    const command = `pm2 logs ${service} --lines 1000 --nostream | grep -B${lines} -A${lines} "${pattern}"`;
    const results = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: results || `No matches found for pattern: ${pattern}`
      }]
    };
  }
);

server.registerTool("logs_errors",
  {
    title: "Get Recent Errors",
    description: "Get recent errors from logs",
    inputSchema: {
      service: z.string()
        .optional()
        .default('ai-admin-worker-v2')
        .describe('Service name'),
      minutes: z.number()
        .optional()
        .default(30)
        .describe('Look back N minutes')
    }
  },
  async ({ service, minutes }) => {
    const command = `pm2 logs ${service} --lines 1000 --nostream | grep -i "error\\|exception\\|failed" | tail -50`;
    const errors = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: errors || 'No recent errors found'
      }]
    };
  }
);

server.registerTool("pm2_status",
  {
    title: "PM2 Status",
    description: "Get PM2 process status",
    inputSchema: {}
  },
  async () => {
    const command = 'pm2 status';
    const status = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: status
      }]
    };
  }
);

server.registerTool("pm2_restart",
  {
    title: "Restart Service",
    description: "Restart PM2 service",
    inputSchema: {
      service: z.string()
        .optional()
        .default('ai-admin-worker-v2')
        .describe('Service to restart')
    }
  },
  async ({ service }) => {
    const command = `pm2 restart ${service}`;
    const result = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: `Service ${service} restarted:\n${result}`
      }]
    };
  }
);

server.registerTool("logs_live",
  {
    title: "Live Logs Stream",
    description: "Get live logs for the last N seconds",
    inputSchema: {
      service: z.string()
        .optional()
        .default('ai-admin-worker-v2')
        .describe('Service name'),
      seconds: z.number()
        .optional()
        .default(10)
        .describe('Duration in seconds')
    }
  },
  async ({ service, seconds }) => {
    const command = `timeout ${seconds}s pm2 logs ${service} --raw 2>&1 || true`;
    const logs = await executeSSHCommand(command);
    
    return {
      content: [{
        type: "text",
        text: `Live logs from ${service} for ${seconds} seconds:\n\n${logs}`
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Logs MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});