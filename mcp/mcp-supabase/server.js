#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '..', '.env') });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Supabase client will be created on first use
let supabase = null;

// Function to get or create Supabase client
function getSupabaseClient() {
  if (supabase) {
    return supabase;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment');
  }

  console.error('Creating Supabase client...');
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  
  return supabase;
}

// Create MCP server
const server = new McpServer({
  name: 'supabase-mcp',
  version: '1.0.0',
  description: 'MCP Server for Supabase database access'
});

// Register tools
server.registerTool("query_table",
  {
    title: "Query Table",
    description: "Query any table in Supabase with filters",
    inputSchema: {
      table: z.string().describe("Table name"),
      select: z.string().optional().default("*").describe("Columns to select"),
      filters: z.record(z.any()).optional().describe("Filter conditions"),
      limit: z.number().optional().default(100).describe("Maximum rows to return"),
      orderBy: z.object({
        column: z.string(),
        ascending: z.boolean().optional().default(true)
      }).optional().describe("Order results")
    }
  },
  async ({ table, select, filters, limit, orderBy }) => {
    const supabase = getSupabaseClient();
    let query = supabase.from(table).select(select);
    
    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }
    
    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending });
    }
    
    // Apply limit
    query = query.limit(limit);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          table,
          rowCount: data.length,
          data
        }, null, 2)
      }]
    };
  }
);

server.registerTool("list_tables",
  {
    title: "List Tables",
    description: "List all available tables in the database",
    inputSchema: {}
  },
  async () => {
    const supabase = getSupabaseClient();
    const tables = [
      'companies',
      'bookings',
      'clients',
      'services',
      'staff',
      'staff_schedules',
      'messages',
      'actions',
      'dialog_contexts',
      'company_sync_status'
    ];
    
    const tableInfo = [];
    
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        tableInfo.push({
          name: table,
          rowCount: count || 0
        });
      } catch (error) {
        tableInfo.push({
          name: table,
          error: error.message
        });
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(tableInfo, null, 2)
      }]
    };
  }
);

server.registerTool("get_database_stats",
  {
    title: "Database Statistics",
    description: "Get database statistics and health metrics",
    inputSchema: {}
  },
  async () => {
    const supabase = getSupabaseClient();
    const stats = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    const tables = ['companies', 'bookings', 'clients', 'messages'];
    
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        stats.tables[table] = {
          rowCount: count || 0
        };
        
        if (table === 'bookings' || table === 'messages') {
          const { data: recent } = await supabase
            .from(table)
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (recent && recent.length > 0) {
            stats.tables[table].lastActivity = recent[0].created_at;
          }
        }
      } catch (error) {
        stats.tables[table] = {
          error: error.message
        };
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
);

server.registerTool("search_bookings",
  {
    title: "Search Bookings",
    description: "Search bookings with complex filters",
    inputSchema: {
      companyId: z.number().optional().describe("Company ID"),
      clientPhone: z.string().optional().describe("Client phone number"),
      dateFrom: z.string().optional().describe("Date from (ISO format)"),
      dateTo: z.string().optional().describe("Date to (ISO format)"),
      status: z.string().optional().describe("Booking status")
    }
  },
  async ({ companyId, clientPhone, dateFrom, dateTo, status }) => {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('bookings')
      .select(`
        *,
        clients (
          name,
          phone
        ),
        services (
          title,
          price
        ),
        staff (
          name
        )
      `);
    
    if (companyId) query = query.eq('company_id', companyId);
    if (clientPhone) query = query.eq('clients.phone', clientPhone);
    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('datetime', dateFrom);
    if (dateTo) query = query.lte('datetime', dateTo);
    
    const { data, error } = await query
      .order('datetime', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totalFound: data.length,
          bookings: data
        }, null, 2)
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Supabase MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});