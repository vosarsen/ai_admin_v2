#!/usr/bin/env node
// MCP Server for Supabase integration
// Provides database access and monitoring capabilities for AI Admin v2

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '..', '..', '.env') });

class SupabaseMCPServer {
  constructor() {
    this.server = new Server({
      name: 'supabase-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment');
      process.exit(1);
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'query_table',
          description: 'Query any table in Supabase with filters',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
              select: { type: 'string', description: 'Columns to select (default: *)' },
              filters: { 
                type: 'object', 
                description: 'Filter conditions as key-value pairs'
              },
              limit: { type: 'number', description: 'Maximum rows to return' },
              orderBy: { 
                type: 'object',
                properties: {
                  column: { type: 'string' },
                  ascending: { type: 'boolean' }
                }
              }
            },
            required: ['table']
          }
        },
        {
          name: 'get_table_schema',
          description: 'Get schema information for a table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' }
            },
            required: ['table']
          }
        },
        {
          name: 'list_tables',
          description: 'List all available tables',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'get_database_stats',
          description: 'Get database statistics and health metrics',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'search_bookings',
          description: 'Search bookings with complex filters',
          inputSchema: {
            type: 'object',
            properties: {
              companyId: { type: 'number' },
              clientPhone: { type: 'string' },
              dateFrom: { type: 'string', format: 'date-time' },
              dateTo: { type: 'string', format: 'date-time' },
              status: { type: 'string' }
            }
          }
        },
        {
          name: 'get_company_metrics',
          description: 'Get company performance metrics',
          inputSchema: {
            type: 'object',
            properties: {
              companyId: { type: 'number', description: 'Company ID' },
              period: { 
                type: 'string', 
                enum: ['day', 'week', 'month', 'year'],
                description: 'Time period for metrics'
              }
            },
            required: ['companyId']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'query_table':
            return await this.queryTable(args);
          
          case 'get_table_schema':
            return await this.getTableSchema(args);
          
          case 'list_tables':
            return await this.listTables();
          
          case 'get_database_stats':
            return await this.getDatabaseStats();
          
          case 'search_bookings':
            return await this.searchBookings(args);
          
          case 'get_company_metrics':
            return await this.getCompanyMetrics(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`MCP tool error (${name}):`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });

    // List available resources
    this.server.setRequestHandler('resources/list', async () => ({
      resources: [
        {
          uri: 'supabase://tables',
          name: 'Database Tables',
          description: 'List of all tables in the database',
          mimeType: 'application/json'
        },
        {
          uri: 'supabase://stats',
          name: 'Database Statistics',
          description: 'Current database statistics and health',
          mimeType: 'application/json'
        }
      ]
    }));

    // Read resources
    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      switch (uri) {
        case 'supabase://tables':
          const tables = await this.listTables();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(tables.content[0].text, null, 2)
              }
            ]
          };
        
        case 'supabase://stats':
          const stats = await this.getDatabaseStats();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(stats.content[0].text, null, 2)
              }
            ]
          };
        
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  async queryTable({ table, select = '*', filters = {}, limit = 100, orderBy }) {
    let query = this.supabase.from(table).select(select);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });
    
    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    
    // Apply limit
    query = query.limit(limit);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            table,
            rowCount: data.length,
            data
          }, null, 2)
        }
      ]
    };
  }

  async getTableSchema({ table }) {
    // Get a sample row to infer schema
    const { data, error } = await this.supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    const schema = {};
    if (data && data.length > 0) {
      Object.entries(data[0]).forEach(([key, value]) => {
        schema[key] = {
          type: typeof value,
          nullable: value === null
        };
      });
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            table,
            schema
          }, null, 2)
        }
      ]
    };
  }

  async listTables() {
    // Common tables in AI Admin v2
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
        const { count } = await this.supabase
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
      content: [
        {
          type: 'text',
          text: tableInfo
        }
      ]
    };
  }

  async getDatabaseStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    // Get stats for key tables
    const tables = ['companies', 'bookings', 'clients', 'messages'];
    
    for (const table of tables) {
      try {
        const { count } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        stats.tables[table] = {
          rowCount: count || 0
        };
        
        // Get recent activity for some tables
        if (table === 'bookings' || table === 'messages') {
          const { data: recent } = await this.supabase
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
      content: [
        {
          type: 'text',
          text: stats
        }
      ]
    };
  }

  async searchBookings({ companyId, clientPhone, dateFrom, dateTo, status }) {
    let query = this.supabase
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
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalFound: data.length,
            bookings: data
          }, null, 2)
        }
      ]
    };
  }

  async getCompanyMetrics({ companyId, period = 'month' }) {
    const now = new Date();
    let dateFrom;
    
    switch (period) {
      case 'day':
        dateFrom = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        dateFrom = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        dateFrom = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        dateFrom = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }
    
    // Get bookings stats
    const { data: bookings, error: bookingsError } = await this.supabase
      .from('bookings')
      .select('status, price')
      .eq('company_id', companyId)
      .gte('datetime', dateFrom.toISOString());
    
    if (bookingsError) throw bookingsError;
    
    // Get messages stats
    const { data: messages, error: messagesError } = await this.supabase
      .from('messages')
      .select('direction')
      .eq('company_id', companyId)
      .gte('created_at', dateFrom.toISOString());
    
    if (messagesError) throw messagesError;
    
    // Calculate metrics
    const metrics = {
      period,
      dateFrom: dateFrom.toISOString(),
      bookings: {
        total: bookings.length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        revenue: bookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + (b.price || 0), 0)
      },
      messages: {
        total: messages.length,
        incoming: messages.filter(m => m.direction === 'incoming').length,
        outgoing: messages.filter(m => m.direction === 'outgoing').length
      }
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(metrics, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Supabase MCP Server started');
  }
}

// Run the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SupabaseMCPServer();
  server.run().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export default SupabaseMCPServer;