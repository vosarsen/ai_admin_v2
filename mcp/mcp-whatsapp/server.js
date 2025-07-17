#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import crypto from 'crypto';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.join(__dirname, '..', '.env') });

// Configuration
const API_BASE_URL = process.env.AI_ADMIN_API_URL || 'http://localhost:3000';
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key';
const DEFAULT_COMPANY_ID = parseInt(process.env.DEFAULT_COMPANY_ID || '962302');

// Create MCP server
const server = new McpServer({
  name: 'whatsapp-mcp',
  version: '1.0.0',
  description: 'MCP Server for WhatsApp testing and automation'
});

// In-memory storage for test sessions
const testSessions = new Map();

// Helper function to create HMAC signature
function createWebhookSignature(data) {
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
}

// Register tools
server.registerTool("send_message",
  {
    title: "Send WhatsApp Message",
    description: "Send a test message to WhatsApp bot",
    inputSchema: {
      phone: z.string().describe('Phone number (e.g., 79001234567)'),
      message: z.string().describe('Message text to send'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ phone, message, company_id }) => {
    // Create test session
    const sessionId = `test_${Date.now()}`;
    if (!testSessions.has(phone)) {
      testSessions.set(phone, {
        sessionId,
        messages: [],
        responses: [],
        startTime: Date.now()
      });
    }

    // Create webhook payload
    const webhookData = {
      event: 'message',
      instanceId: 'test-instance',
      data: {
        pushName: 'Test User',
        message: {
          id: `test_msg_${Date.now()}`,
          body: message,
          type: 'chat',
          t: Math.floor(Date.now() / 1000),
          from: `${phone}@c.us`,
          to: `${company_id}@c.us`,
          isGroupMsg: false
        }
      }
    };

    // Send webhook
    const response = await fetch(`${API_BASE_URL}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': createWebhookSignature(webhookData)
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${response.statusText} - ${error}`);
    }

    // Save sent message
    const session = testSessions.get(phone);
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    return {
      content: [{
        type: "text",
        text: `Message sent to ${phone}: "${message}"\nSession ID: ${sessionId}`
      }]
    };
  }
);

server.registerTool("get_last_response",
  {
    title: "Get Last Response",
    description: "Get the last bot response for a phone number",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      timeout: z.number()
        .optional()
        .default(5)
        .describe('Wait timeout in seconds')
    }
  },
  async ({ phone, timeout }) => {
    const session = testSessions.get(phone);
    if (!session) {
      throw new Error(`No test session found for ${phone}`);
    }

    // In a real implementation, this would subscribe to bot events
    // For now, this is a placeholder that simulates waiting
    const startTime = Date.now();
    while (Date.now() - startTime < timeout * 1000) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (session.responses.length > 0) {
        const lastResponse = session.responses[session.responses.length - 1];
        return {
          content: [{
            type: "text",
            text: `Last response:\n${lastResponse.content}\n\nReceived at: ${lastResponse.timestamp}`
          }]
        };
      }
    }

    return {
      content: [{
        type: "text",
        text: `No response received within ${timeout} seconds`
      }]
    };
  }
);

server.registerTool("get_conversation",
  {
    title: "Get Conversation",
    description: "Get full conversation history",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      last_messages: z.number()
        .optional()
        .default(10)
        .describe('Number of last messages to retrieve')
    }
  },
  async ({ phone, last_messages }) => {
    const session = testSessions.get(phone);
    if (!session) {
      throw new Error(`No test session found for ${phone}`);
    }

    const allMessages = [...session.messages, ...session.responses]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-last_messages);

    const conversation = allMessages.map(msg => 
      `[${msg.timestamp}] ${msg.role}: ${msg.content}`
    ).join('\n');

    return {
      content: [{
        type: "text",
        text: `Conversation history (last ${last_messages} messages):\n\n${conversation}`
      }]
    };
  }
);

server.registerTool("run_scenario",
  {
    title: "Run Test Scenario",
    description: "Run a predefined test scenario",
    inputSchema: {
      scenario: z.enum(['booking_flow', 'price_check', 'cancel_booking', 'reschedule'])
        .describe('Scenario to run'),
      phone: z.string().describe('Phone number for testing'),
      params: z.object({
        company_id: z.number().optional()
      }).optional().describe('Additional scenario parameters')
    }
  },
  async ({ scenario, phone, params = {} }) => {
    const scenarios = {
      booking_flow: [
        { message: "Привет", wait: 2 },
        { message: "Хочу записаться", wait: 2 },
        { message: "Стрижка", wait: 2 },
        { message: "Завтра в 15:00", wait: 2 },
        { message: "Да, подтверждаю", wait: 2 }
      ],
      price_check: [
        { message: "Привет", wait: 2 },
        { message: "Сколько стоит стрижка?", wait: 2 },
        { message: "А борода?", wait: 2 }
      ],
      cancel_booking: [
        { message: "Привет", wait: 2 },
        { message: "Хочу отменить запись", wait: 2 },
        { message: "Да, отменить", wait: 2 }
      ],
      reschedule: [
        { message: "Привет", wait: 2 },
        { message: "Хочу перенести запись", wait: 2 },
        { message: "На послезавтра в то же время", wait: 2 },
        { message: "Да", wait: 2 }
      ]
    };

    const steps = scenarios[scenario];
    const results = [];
    
    for (const step of steps) {
      // Send message
      const sendResult = await server.executeToolCall("send_message", {
        phone,
        message: step.message,
        company_id: params.company_id || DEFAULT_COMPANY_ID
      });
      
      // Wait specified time
      await new Promise(resolve => setTimeout(resolve, step.wait * 1000));
      
      // Get response
      const response = await server.executeToolCall("get_last_response", {
        phone,
        timeout: step.wait
      });
      
      results.push({
        sent: step.message,
        received: response.content[0].text
      });
    }

    return {
      content: [{
        type: "text",
        text: `Scenario "${scenario}" completed:\n\n${results.map((r, i) => 
          `Step ${i + 1}:\n→ Sent: ${r.sent}\n← Received: ${r.received}`
        ).join('\n\n')}`
      }]
    };
  }
);

server.registerTool("clear_test_data",
  {
    title: "Clear Test Data",
    description: "Clear all test data for a phone number",
    inputSchema: {
      phone: z.string().describe('Phone number')
    }
  },
  async ({ phone }) => {
    testSessions.delete(phone);
    
    // In a real implementation, this would also:
    // - Delete test bookings from database
    // - Clear Redis context
    // - Delete test messages
    
    return {
      content: [{
        type: "text",
        text: `Test data cleared for ${phone}`
      }]
    };
  }
);

server.registerTool("simulate_response",
  {
    title: "Simulate Bot Response",
    description: "Simulate a bot response (for testing purposes)",
    inputSchema: {
      phone: z.string().describe('Phone number'),
      response: z.string().describe('Response text to simulate')
    }
  },
  async ({ phone, response }) => {
    const session = testSessions.get(phone);
    if (!session) {
      throw new Error(`No test session found for ${phone}`);
    }

    // Add simulated response
    session.responses.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    return {
      content: [{
        type: "text",
        text: `Response simulated for ${phone}: "${response}"`
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WhatsApp MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});