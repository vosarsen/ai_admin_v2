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

// YClients API configuration
const YCLIENTS_API_BASE = 'https://api.yclients.com/api/v1';
const YCLIENTS_API_KEY = process.env.YCLIENTS_API_KEY;
const YCLIENTS_USER_TOKEN = process.env.YCLIENTS_USER_TOKEN || '';
const DEFAULT_COMPANY_ID = parseInt(process.env.DEFAULT_COMPANY_ID || '962302');

// Verify API key
if (!YCLIENTS_API_KEY) {
  console.error('Missing YCLIENTS_API_KEY in environment');
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: 'yclients-mcp',
  version: '1.0.0',
  description: 'MCP Server for YClients API integration'
});

// Helper function for YClients API requests
async function makeYClientsRequest(endpoint, options = {}) {
  const response = await fetch(`${YCLIENTS_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${YCLIENTS_API_KEY}, User ${YCLIENTS_USER_TOKEN}`,
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YClients API error: ${response.statusText} - ${error}`);
  }

  return await response.json();
}

// Register tools
server.registerTool("get_services",
  {
    title: "Get Services",
    description: "Get list of company services",
    inputSchema: {
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .describe('Filter by staff member (optional)')
    }
  },
  async ({ company_id, staff_id }) => {
    let endpoint = `/services/${company_id}`;
    if (staff_id) {
      endpoint += `?staff_id=${staff_id}`;
    }

    const result = await makeYClientsRequest(endpoint);
    
    // Format for readability
    const services = result.data.filter(s => s.active).map(service => ({
      id: service.id,
      title: service.title,
      price_min: service.price_min,
      price_max: service.price_max,
      duration: service.duration,
      category: service.category?.title || 'Без категории'
    }));

    return {
      content: [{
        type: "text",
        text: `Найдено ${services.length} услуг:\n\n${services.map(s => 
          `📌 ${s.title}\n   ID: ${s.id}\n   Цена: ${s.price_min}-${s.price_max} ₽\n   Длительность: ${s.duration} мин\n   Категория: ${s.category}`
        ).join('\n\n')}`
      }]
    };
  }
);

server.registerTool("get_available_slots",
  {
    title: "Get Available Slots",
    description: "Get available booking slots",
    inputSchema: {
      date: z.string().describe('Date in YYYY-MM-DD format'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .default(0)
        .describe('Staff ID (0 for any)'),
      service_ids: z.array(z.number())
        .optional()
        .default([])
        .describe('Service IDs to check')
    }
  },
  async ({ date, company_id, staff_id, service_ids }) => {
    const endpoint = `/book_times/${company_id}/${staff_id}/${date}`;
    const params = new URLSearchParams();
    
    if (service_ids.length > 0) {
      service_ids.forEach(id => params.append('service_ids[]', id.toString()));
    }

    const url = params.toString() ? `${endpoint}?${params}` : endpoint;
    const result = await makeYClientsRequest(url);

    // Group by time
    const slotsByTime = {};
    result.data.forEach(slot => {
      const time = slot.time;
      if (!slotsByTime[time]) {
        slotsByTime[time] = [];
      }
      slotsByTime[time].push({
        staff_id: slot.staff_id,
        staff_name: slot.staff_name,
        seance_length: slot.seance_length
      });
    });

    const formattedSlots = Object.entries(slotsByTime).map(([time, slots]) => 
      `⏰ ${time} - Доступно ${slots.length} мастер(ов): ${slots.map(s => s.staff_name).join(', ')}`
    );

    return {
      content: [{
        type: "text",
        text: `Доступные слоты на ${date}:\n\n${formattedSlots.join('\n')}`
      }]
    };
  }
);

server.registerTool("create_test_booking",
  {
    title: "Create Test Booking",
    description: "Create a test booking",
    inputSchema: {
      phone: z.string().describe('Client phone number'),
      appointments: z.array(z.object({
        id: z.number().optional(),
        services: z.array(z.number()),
        staff_id: z.number(),
        datetime: z.string()
      })).describe('Booking appointments'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      fullname: z.string()
        .optional()
        .default('Test Client')
        .describe('Client full name'),
      email: z.string()
        .optional()
        .default('test@example.com')
        .describe('Client email'),
      comment: z.string()
        .optional()
        .default('Test booking via MCP')
        .describe('Booking comment')
    }
  },
  async ({ phone, appointments, company_id, fullname, email, comment }) => {
    const bookingData = {
      phone,
      fullname,
      email,
      appointments,
      comment
    };

    const result = await makeYClientsRequest(`/book_record/${company_id}`, {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `✅ Запись создана успешно!\nID записи: ${result.data[0].id}\nДетали: ${JSON.stringify(result.data[0], null, 2)}`
        }]
      };
    } else {
      throw new Error(`Failed to create booking: ${JSON.stringify(result)}`);
    }
  }
);

server.registerTool("get_booking",
  {
    title: "Get Booking",
    description: "Get booking details",
    inputSchema: {
      booking_id: z.number().describe('Booking ID'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ booking_id, company_id }) => {
    const result = await makeYClientsRequest(`/record/${company_id}/${booking_id}`);
    
    const booking = result.data;
    return {
      content: [{
        type: "text",
        text: `📋 Информация о записи #${booking_id}:

Клиент: ${booking.client.name} (${booking.client.phone})
Услуга: ${booking.services.map(s => s.title).join(', ')}
Мастер: ${booking.staff.name}
Дата/время: ${booking.date} ${booking.time}
Статус: ${booking.visit_attendance === 1 ? 'Подтверждена' : booking.visit_attendance === -1 ? 'Отменена' : 'Ожидает'}
Комментарий: ${booking.comment || 'Нет'}`
      }]
    };
  }
);

server.registerTool("cancel_booking",
  {
    title: "Cancel Booking",
    description: "Cancel a booking",
    inputSchema: {
      record_id: z.number().describe('Record ID to cancel'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ record_id, company_id }) => {
    const result = await makeYClientsRequest(`/record/${company_id}/${record_id}`, {
      method: 'DELETE'
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `❌ Запись #${record_id} успешно отменена`
        }]
      };
    } else {
      throw new Error(`Failed to cancel booking: ${JSON.stringify(result)}`);
    }
  }
);

server.registerTool("get_staff",
  {
    title: "Get Staff",
    description: "Get staff members list",
    inputSchema: {
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ company_id }) => {
    const result = await makeYClientsRequest(`/company/${company_id}/staff`);
    
    const staff = result.data.filter(s => !s.fired).map(member => ({
      id: member.id,
      name: member.name,
      specialization: member.specialization,
      position: member.position?.title || 'Не указана',
      rating: member.rating
    }));

    return {
      content: [{
        type: "text",
        text: `👥 Сотрудники компании:\n\n${staff.map(s => 
          `${s.name}\n   ID: ${s.id}\n   Специализация: ${s.specialization || 'Не указана'}\n   Должность: ${s.position}\n   Рейтинг: ${s.rating || 'Нет'}`
        ).join('\n\n')}`
      }]
    };
  }
);

server.registerTool("get_staff_schedule",
  {
    title: "Get Staff Schedule",
    description: "Get staff member schedule",
    inputSchema: {
      staff_id: z.number().describe('Staff ID'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ staff_id, date, company_id }) => {
    const result = await makeYClientsRequest(`/staff/${company_id}/schedule/${staff_id}/${date}/${date}`);
    
    const schedule = result.data[date];
    if (!schedule) {
      return {
        content: [{
          type: "text",
          text: `Расписание на ${date} не найдено`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `📅 Расписание мастера на ${date}:\nРабочие часы: ${schedule.work_start} - ${schedule.work_end}\nПерерывы: ${schedule.breaks?.map(b => `${b.start} - ${b.end}`).join(', ') || 'Нет'}`
      }]
    };
  }
);

server.registerTool("search_clients",
  {
    title: "Search Clients",
    description: "Search clients by phone or name",
    inputSchema: {
      search: z.string().describe('Search query (phone or name)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ search, company_id }) => {
    const params = new URLSearchParams({ search });
    const result = await makeYClientsRequest(`/company/${company_id}/clients/search?${params}`);
    
    const clients = result.data.map(client => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      visits_count: client.visits_count,
      last_visit: client.last_visit_date
    }));

    return {
      content: [{
        type: "text",
        text: `🔍 Найдено ${clients.length} клиентов:\n\n${clients.map(c => 
          `${c.name}\n   ID: ${c.id}\n   Телефон: ${c.phone}\n   Визитов: ${c.visits_count}\n   Последний визит: ${c.last_visit || 'Не было'}`
        ).join('\n\n')}`
      }]
    };
  }
);

server.registerTool("get_client_visits",
  {
    title: "Get Client Visits",
    description: "Get client visit history",
    inputSchema: {
      client_id: z.number().describe('Client ID'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ client_id, company_id }) => {
    const result = await makeYClientsRequest(`/company/${company_id}/clients/${client_id}/visits`);
    
    const visits = result.data.slice(0, 10).map(visit => ({
      date: visit.date,
      services: visit.services.map(s => s.title).join(', '),
      staff: visit.staff.name,
      status: visit.attendance === 1 ? 'Был' : visit.attendance === -1 ? 'Не пришел' : 'Ожидается'
    }));

    return {
      content: [{
        type: "text",
        text: `📊 История визитов клиента (последние 10):\n\n${visits.map(v => 
          `${v.date} - ${v.status}\n   Услуги: ${v.services}\n   Мастер: ${v.staff}`
        ).join('\n\n')}`
      }]
    };
  }
);

server.registerTool("check_booking",
  {
    title: "Check Booking Availability",
    description: "Check if booking can be created",
    inputSchema: {
      appointments: z.array(z.object({
        id: z.number().optional(),
        services: z.array(z.number()),
        staff_id: z.number(),
        datetime: z.string()
      })).describe('Booking appointments to check'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ appointments, company_id }) => {
    const checkData = { appointments };

    const result = await makeYClientsRequest(`/book_check/${company_id}`, {
      method: 'POST',
      body: JSON.stringify(checkData)
    });

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `✅ Запись возможна!\nДетали проверки: ${JSON.stringify(result.data, null, 2)}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `❌ Запись невозможна:\n${result.meta?.message || 'Неизвестная ошибка'}`
        }]
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('YClients MCP Server started successfully');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});