#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from 'redis';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load from local .env first to override parent values
loadEnv({ path: path.join(__dirname, '.env'), override: true });

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const DEFAULT_COMPANY_ID = parseInt(process.env.DEFAULT_COMPANY_ID || '962302');

// Redis client will be created on first use
let redis = null;

// Function to get or create Redis connection
async function getRedisClient() {
  if (redis && redis.isOpen) {
    return redis;
  }

  console.error(`Connecting to Redis at ${REDIS_URL}`);
  
  // Create Redis client with password if provided
  const redisConfig = { url: REDIS_URL };
  if (REDIS_PASSWORD && !REDIS_URL.includes('@')) {
    // If password is provided separately and not in URL
    const url = new URL(REDIS_URL);
    url.password = REDIS_PASSWORD;
    redisConfig.url = url.toString();
  }

  redis = createClient({
    ...redisConfig,
    socket: {
      connectTimeout: 5000,
      commandTimeout: 5000,
      reconnectStrategy: (times) => {
        if (times > 3) return false;
        return Math.min(times * 100, 3000);
      }
    }
  });
  
  redis.on('error', err => console.error('Redis Client Error', err));
  redis.on('connect', () => console.error('Redis connecting...'));
  redis.on('ready', () => console.error('Redis ready'));
  
  try {
    await redis.connect();
    console.error('Redis connected successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    redis = null;
    throw error;
  }
  
  return redis;
}

// Create MCP server
const server = new McpServer({
  name: 'redis-mcp',
  version: '1.0.0',
  description: 'MCP Server for Redis context management'
});

// Register tools
server.registerTool("get_context",
  {
    title: "Get Context",
    description: "Get conversation context for a phone number",
    inputSchema: {
      phone: z.string().describe('Phone number (e.g., 79001234567)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, company_id }) => {
    const redis = await getRedisClient();
    const contextKey = `context:${company_id}:${phone}`;
    const conversationKey = `conversation:${company_id}:${phone}`;
    const preferencesKey = `preferences:${company_id}:${phone}`;
    
    // Get all data in parallel
    const [context, conversation, preferences] = await Promise.all([
      redis.hGetAll(contextKey),
      redis.lRange(conversationKey, 0, -1),
      redis.hGetAll(preferencesKey)
    ]);

    const result = {
      context: Object.keys(context).length > 0 ? context : null,
      conversation: conversation.map(msg => JSON.parse(msg)),
      preferences: preferences || {},
      exists: Object.keys(context).length > 0
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);

server.registerTool("clear_context",
  {
    title: "Clear Context",
    description: "Clear conversation context (reset dialog)",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, company_id }) => {
    console.error(`Clearing context for ${phone} in company ${company_id}`);
    
    try {
      const redis = await getRedisClient();
      const keys = [
        `context:${company_id}:${phone}`,
        `conversation:${company_id}:${phone}`,
        `preferences:${company_id}:${phone}`,
        `booking:${company_id}:${phone}`
      ];

      console.error(`Deleting keys: ${keys.join(', ')}`);
      const startTime = Date.now();
      
      // Delete keys with timeout
      const results = await Promise.all(
        keys.map(key => 
          redis.del(key).catch(err => {
            console.error(`Failed to delete ${key}:`, err);
            return 0;
          })
        )
      );
      
      const duration = Date.now() - startTime;
      const deletedCount = results.reduce((sum, count) => sum + count, 0);
      console.error(`Deleted ${deletedCount} keys in ${duration}ms`);

      return {
        content: [{
          type: "text",
          text: `✅ Context cleared for ${phone} in company ${company_id}\n📊 Deleted ${deletedCount} keys in ${duration}ms`
        }]
      };
    } catch (error) {
      console.error('Error clearing context:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Failed to clear context: ${error.message}`
        }]
      };
    }
  }
);

server.registerTool("set_booking_stage",
  {
    title: "Set Booking Stage",
    description: "Set specific booking stage for testing",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      stage: z.enum(['initial', 'selecting_service', 'selecting_date', 'selecting_time', 'confirming'])
        .describe('Booking stage'),
      data: z.record(z.any())
        .optional()
        .describe('Stage-specific data'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, stage, data = {}, company_id }) => {
    const redis = await getRedisClient();
    const bookingKey = `booking:${company_id}:${phone}`;
    
    const bookingData = {
      stage,
      data,
      updated_at: new Date().toISOString()
    };

    await redis.set(bookingKey, JSON.stringify(bookingData), {
      EX: 3600 // 1 hour
    });

    return {
      content: [{
        type: "text",
        text: `Booking stage set to "${stage}" for ${phone}\nData: ${JSON.stringify(data, null, 2)}`
      }]
    };
  }
);

server.registerTool("list_active_contexts",
  {
    title: "List Active Contexts",
    description: "List all active conversation contexts",
    inputSchema: {
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      limit: z.number()
        .optional()
        .default(20)
        .describe('Maximum number of contexts to return')
    }
  },
  async ({ company_id, limit }) => {
    const redis = await getRedisClient();
    // Get all context keys for the company
    const pattern = `context:${company_id}:*`;
    const keys = await redis.keys(pattern);
    
    const contexts = [];
    for (const key of keys.slice(0, limit)) {
      const phone = key.split(':')[2];
      const context = await redis.get(key);
      const ttl = await redis.ttl(key);
      
      contexts.push({
        phone,
        context: context ? JSON.parse(context) : null,
        ttl_seconds: ttl,
        last_activity: context ? JSON.parse(context).last_activity : null
      });
    }

    // Sort by last activity
    contexts.sort((a, b) => {
      const timeA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const timeB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
      return timeB - timeA;
    });

    return {
      content: [{
        type: "text",
        text: `Active contexts for company ${company_id}:\n\n${contexts.map(c => 
          `Phone: ${c.phone}\nLast activity: ${c.last_activity || 'Unknown'}\nTTL: ${c.ttl_seconds}s\n---`
        ).join('\n')}`
      }]
    };
  }
);

server.registerTool("set_client_preferences",
  {
    title: "Set Client Preferences",
    description: "Set client preferences for testing",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      preferences: z.object({
        favorite_service: z.string().optional().describe('Favorite service name'),
        favorite_staff: z.string().optional().describe('Favorite staff member'),
        preferred_time: z.string().optional().describe('Preferred time (morning/afternoon/evening)')
      }).describe('Client preferences'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, preferences, company_id }) => {
    const redis = await getRedisClient();
    const preferencesKey = `preferences:${company_id}:${phone}`;
    
    // Save preferences
    for (const [key, value] of Object.entries(preferences)) {
      if (value) {
        await redis.hSet(preferencesKey, key, value);
      }
    }

    // Update context
    const contextKey = `context:${company_id}:${phone}`;
    const context = await redis.get(contextKey);
    
    if (context) {
      const contextData = JSON.parse(context);
      contextData.preferences = preferences;
      contextData.last_activity = new Date().toISOString();
      await redis.set(contextKey, JSON.stringify(contextData));
    }

    return {
      content: [{
        type: "text",
        text: `Preferences set for ${phone}:\n${JSON.stringify(preferences, null, 2)}`
      }]
    };
  }
);

server.registerTool("simulate_returning_client",
  {
    title: "Simulate Returning Client",
    description: "Make client appear as returning with history",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      visits: z.number()
        .optional()
        .default(5)
        .describe('Number of previous visits'),
      last_services: z.array(z.string())
        .optional()
        .default([])
        .describe('Last services used'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, visits, last_services, company_id }) => {
    const redis = await getRedisClient();
    const contextKey = `context:${company_id}:${phone}`;
    const preferencesKey = `preferences:${company_id}:${phone}`;
    
    // Create returning client context
    const clientContext = {
      client_type: 'returning',
      total_visits: visits,
      last_visit: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
      favorite_services: last_services,
      loyalty_level: visits > 10 ? 'gold' : visits > 5 ? 'silver' : 'bronze',
      last_activity: new Date().toISOString()
    };

    await redis.set(contextKey, JSON.stringify(clientContext), {
      EX: 86400 // 24 hours
    });

    // Set preferences
    if (last_services.length > 0) {
      await redis.hSet(preferencesKey, 'favorite_service', last_services[0]);
    }

    return {
      content: [{
        type: "text",
        text: `Client ${phone} now appears as returning client:\n- Visits: ${visits}\n- Loyalty: ${clientContext.loyalty_level}\n- Favorite services: ${last_services.join(', ')}\n- Last visit: 1 week ago`
      }]
    };
  }
);

server.registerTool("get_all_keys",
  {
    title: "Get All Keys",
    description: "Get all Redis keys matching a pattern",
    inputSchema: {
      pattern: z.string()
        .optional()
        .default('*')
        .describe('Key pattern (e.g., context:*, booking:79*)'),
      limit: z.number()
        .optional()
        .default(100)
        .describe('Maximum number of keys to return')
    }
  },
  async ({ pattern, limit }) => {
    const redis = await getRedisClient();
    const keys = await redis.keys(pattern);
    const limitedKeys = keys.slice(0, limit);
    
    const keyInfo = [];
    for (const key of limitedKeys) {
      const type = await redis.type(key);
      const ttl = await redis.ttl(key);
      
      keyInfo.push({
        key,
        type,
        ttl: ttl > 0 ? `${ttl}s` : 'no expiry'
      });
    }

    return {
      content: [{
        type: "text",
        text: `Found ${keys.length} keys (showing ${limitedKeys.length}):\n\n${keyInfo.map(k => 
          `${k.key} (${k.type}, ttl: ${k.ttl})`
        ).join('\n')}`
      }]
    };
  }
);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (redis && redis.isOpen) {
    await redis.quit();
  }
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Redis MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});