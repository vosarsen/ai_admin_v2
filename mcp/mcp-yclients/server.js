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

// Analytics tools
server.registerTool("get_overall_analytics",
  {
    title: "Get Overall Analytics",
    description: "Get overall company analytics for a period",
    inputSchema: {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .describe('Staff ID for filtering'),
      position_id: z.number()
        .optional()
        .describe('Position ID for filtering'),
      user_id: z.number()
        .optional()
        .describe('User ID for filtering')
    }
  },
  async ({ date_from, date_to, company_id, staff_id, position_id, user_id }) => {
    const params = new URLSearchParams({
      date_from,
      date_to
    });
    
    if (staff_id) params.append('staff_id', staff_id.toString());
    if (position_id) params.append('position_id', position_id.toString());
    if (user_id) params.append('user_id', user_id.toString());

    const result = await makeYClientsRequest(`/company/${company_id}/analytics/overall?${params}`);
    
    const data = result.data;
    return {
      content: [{
        type: "text",
        text: `📊 Аналитика за период ${date_from} - ${date_to}:

💰 ВЫРУЧКА:
- Общая: ${data.income_total_stats.current_sum} ₽ (${data.income_total_stats.change_percent > 0 ? '+' : ''}${data.income_total_stats.change_percent}%)
- Услуги: ${data.income_services_stats.current_sum} ₽ (${data.income_services_stats.change_percent > 0 ? '+' : ''}${data.income_services_stats.change_percent}%)
- Товары: ${data.income_goods_stats.current_sum} ₽ (${data.income_goods_stats.change_percent > 0 ? '+' : ''}${data.income_goods_stats.change_percent}%)
- Средний чек: ${data.income_average_stats.current_sum} ₽ (${data.income_average_stats.change_percent > 0 ? '+' : ''}${data.income_average_stats.change_percent}%)

📈 ЗАПИСИ:
- Всего: ${data.record_stats.current_total_count} (${data.record_stats.change_percent > 0 ? '+' : ''}${data.record_stats.change_percent}%)
- Выполнено: ${data.record_stats.current_completed_count} (${data.record_stats.current_completed_percent}%)
- Ожидается: ${data.record_stats.current_pending_count} (${data.record_stats.current_pending_percent}%)
- Отменено: ${data.record_stats.current_canceled_count} (${data.record_stats.current_canceled_percent}%)

👥 КЛИЕНТЫ:
- Всего: ${data.client_stats.total_count}
- Новых: ${data.client_stats.new_count} (${data.client_stats.new_percent}%)
- Постоянных: ${data.client_stats.return_count} (${data.client_stats.return_percent}%)
- Активных: ${data.client_stats.active_count}
- Потерянных: ${data.client_stats.lost_count} (${data.client_stats.lost_percent}%)

📊 ЗАГРУЖЕННОСТЬ:
- Текущий период: ${data.fullness_stats.current_percent}%
- Предыдущий период: ${data.fullness_stats.previous_percent}%
- Изменение: ${data.fullness_stats.change_percent > 0 ? '+' : ''}${data.fullness_stats.change_percent}%`
      }]
    };
  }
);

server.registerTool("get_income_daily",
  {
    title: "Get Daily Income",
    description: "Get income data by days",
    inputSchema: {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .describe('Staff ID for filtering')
    }
  },
  async ({ date_from, date_to, company_id, staff_id }) => {
    const params = new URLSearchParams({
      date_from,
      date_to
    });
    
    if (staff_id) params.append('staff_id', staff_id.toString());

    const result = await makeYClientsRequest(`/company/${company_id}/analytics/overall/charts/income_daily?${params}`);
    
    const incomeData = result[0]?.data || [];
    const formattedData = incomeData.map(([timestamp, amount]) => {
      const date = new Date(timestamp);
      return `${date.toISOString().split('T')[0]}: ${amount} ₽`;
    });

    return {
      content: [{
        type: "text",
        text: `💰 Выручка по дням (${date_from} - ${date_to}):\n\n${formattedData.join('\n')}`
      }]
    };
  }
);

server.registerTool("get_records_daily",
  {
    title: "Get Daily Records",
    description: "Get records count by days",
    inputSchema: {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .describe('Staff ID for filtering')
    }
  },
  async ({ date_from, date_to, company_id, staff_id }) => {
    const params = new URLSearchParams({
      date_from,
      date_to
    });
    
    if (staff_id) params.append('staff_id', staff_id.toString());

    const result = await makeYClientsRequest(`/company/${company_id}/analytics/overall/charts/records_daily?${params}`);
    
    const recordsData = result[0]?.data || [];
    const formattedData = recordsData.map(([timestamp, count]) => {
      const date = new Date(timestamp);
      return `${date.toISOString().split('T')[0]}: ${count} записей`;
    });

    return {
      content: [{
        type: "text",
        text: `📅 Записи по дням (${date_from} - ${date_to}):\n\n${formattedData.join('\n')}`
      }]
    };
  }
);

server.registerTool("get_record_sources",
  {
    title: "Get Record Sources",
    description: "Get booking sources breakdown",
    inputSchema: {
      date_from: z.string().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().describe('End date (YYYY-MM-DD)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID')
    }
  },
  async ({ date_from, date_to, company_id }) => {
    const params = new URLSearchParams({
      date_from,
      date_to
    });

    const result = await makeYClientsRequest(`/company/${company_id}/analytics/overall/charts/record_source?${params}`);
    
    const sources = result.map(item => `${item.label}: ${item.data} записей`);

    return {
      content: [{
        type: "text",
        text: `📱 Источники записей (${date_from} - ${date_to}):\n\n${sources.join('\n')}`
      }]
    };
  }
);

server.registerTool("get_z_report",
  {
    title: "Get Z-Report",
    description: "Get Z-report for a date",
    inputSchema: {
      date: z.string().describe('Report date (YYYY-MM-DD)'),
      company_id: z.number()
        .optional()
        .default(DEFAULT_COMPANY_ID)
        .describe('Company ID'),
      staff_id: z.number()
        .optional()
        .describe('Staff ID for filtering')
    }
  },
  async ({ date, company_id, staff_id }) => {
    const params = staff_id ? `?staff_id=${staff_id}` : '';
    const result = await makeYClientsRequest(`/company/${company_id}/z_report/by_day/${date}${params}`);
    
    const report = result.data;
    const stats = report.stats;
    const paids = report.paids;

    return {
      content: [{
        type: "text",
        text: `📊 Z-отчет за ${date}:

📈 ОБЩАЯ СТАТИСТИКА:
- Клиентов: ${stats.clients}
- Средний чек: ${stats.clients_average} ${report.currency}
- Записей: ${stats.records} (средний чек: ${stats.records_average} ${report.currency})
- С клиентами: ${stats.visit_records} (средний чек: ${stats.visit_records_average} ${report.currency})
- Без клиентов: ${stats.non_visit_records}

💰 ДОХОДЫ:
- Услуги: ${stats.targets} шт. на ${stats.targets_paid} ${report.currency}
- Товары: ${stats.goods} шт. на ${stats.goods_paid} ${report.currency}
- Сертификаты: ${stats.certificates} шт. на ${stats.certificates_paid} ${report.currency}
- Абонементы: ${stats.abonement} шт. на ${stats.abonement_paid} ${report.currency}

💳 ОПЛАТЫ:
${paids.accounts.map(acc => `- ${acc.title}: ${acc.amount} ${report.currency}`).join('\n')}

📊 ИТОГО: ${paids.total.amount} ${report.currency}`
      }]
    };
  }
);

// =====================
// MARKETPLACE API TOOLS (Phase 6)
// Base URL: https://api.yclients.com/marketplace
// =====================

const MARKETPLACE_BASE = 'https://api.yclients.com/marketplace';
const YCLIENTS_PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;
const YCLIENTS_APP_ID = parseInt(process.env.YCLIENTS_APP_ID || '18289');

// Helper function for Marketplace API requests
async function makeMarketplaceRequest(endpoint, options = {}) {
  const response = await fetch(`${MARKETPLACE_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${YCLIENTS_PARTNER_TOKEN}`,
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Marketplace API error: ${response.status} ${response.statusText} - ${error}`);
  }

  return await response.json();
}

server.registerTool("marketplace_get_salons",
  {
    title: "Get Connected Salons",
    description: "Get list of salons connected to our marketplace app",
    inputSchema: {
      page: z.number()
        .optional()
        .default(1)
        .describe('Page number'),
      count: z.number()
        .optional()
        .default(100)
        .describe('Items per page (max 1000)')
    }
  },
  async ({ page, count }) => {
    const safeCount = Math.min(count, 1000);
    const params = new URLSearchParams({
      page: page.toString(),
      count: safeCount.toString()
    });

    const result = await makeMarketplaceRequest(`/application/${YCLIENTS_APP_ID}/salons?${params}`);

    const salons = result.data || [];
    return {
      content: [{
        type: "text",
        text: `📊 Подключенные салоны (страница ${page}):\n\n${salons.length > 0
          ? salons.map(s => `${s.title || s.id}\n   ID: ${s.salon_id || s.id}\n   Статус: ${s.status || 'active'}`).join('\n\n')
          : 'Нет подключенных салонов'}\n\nВсего: ${result.meta?.total_count || salons.length}`
      }]
    };
  }
);

server.registerTool("marketplace_get_status",
  {
    title: "Get Salon Integration Status",
    description: "Check integration status for a specific salon",
    inputSchema: {
      salon_id: z.number().describe('YClients salon ID')
    }
  },
  async ({ salon_id }) => {
    const result = await makeMarketplaceRequest(`/salon/${salon_id}/application/${YCLIENTS_APP_ID}`);

    return {
      content: [{
        type: "text",
        text: `📋 Статус интеграции салона #${salon_id}:

Статус: ${result.data?.connection_status || 'unknown'}
Логи: ${result.data?.logs?.length || 0} записей
Платежи: ${result.data?.payments?.length || 0} записей

Детали: ${JSON.stringify(result.data, null, 2)}`
      }]
    };
  }
);

server.registerTool("marketplace_get_tariffs",
  {
    title: "Get App Tariffs",
    description: "Get available tariffs for the marketplace application",
    inputSchema: {}
  },
  async () => {
    const result = await makeMarketplaceRequest(`/application/${YCLIENTS_APP_ID}/tariffs`);

    const tariffs = result.data || [];
    return {
      content: [{
        type: "text",
        text: `💰 Тарифы приложения:\n\n${tariffs.length > 0
          ? tariffs.map(t => `${t.title || t.name}\n   Цена: ${t.price} ${t.currency || 'RUB'}\n   Период: ${t.period || 'месяц'}`).join('\n\n')
          : JSON.stringify(result, null, 2)}`
      }]
    };
  }
);

server.registerTool("marketplace_get_payment_link",
  {
    title: "Generate Payment Link",
    description: "Generate payment link for a salon",
    inputSchema: {
      salon_id: z.number().describe('YClients salon ID'),
      discount: z.number()
        .optional()
        .describe('Discount percentage (optional)')
    }
  },
  async ({ salon_id, discount }) => {
    const params = new URLSearchParams({
      salon_id: salon_id.toString(),
      application_id: YCLIENTS_APP_ID.toString()
    });

    if (discount) {
      params.append('discount', discount.toString());
    }

    try {
      const result = await makeMarketplaceRequest(`/application/payment_link?${params}`);

      return {
        content: [{
          type: "text",
          text: `🔗 Ссылка на оплату для салона #${salon_id}:

URL: ${result.data?.url || result.url || 'Не получена'}
${discount ? `Скидка: ${discount}%` : ''}

Детали: ${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      // Handle 404 - likely no tariffs configured
      if (error.message.includes('404')) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Невозможно сгенерировать ссылку на оплату для салона #${salon_id}

Причина: Для приложения не настроены тарифы (tariffs)

Решение:
1. Проверьте тарифы: @yclients marketplace_get_tariffs
2. Если приложение бесплатное - ссылка не нужна
3. Если требуется настройка тарифов - обратитесь в поддержку YClients

Техническая ошибка: ${error.message}`
          }]
        };
      }
      throw error;
    }
  }
);

server.registerTool("marketplace_uninstall",
  {
    title: "Uninstall from Salon",
    description: "Disconnect the application from a salon (DANGEROUS!)",
    inputSchema: {
      salon_id: z.number().describe('YClients salon ID'),
      confirm: z.boolean().describe('Must be true to confirm uninstall')
    }
  },
  async ({ salon_id, confirm }) => {
    if (!confirm) {
      return {
        content: [{
          type: "text",
          text: `⚠️ ВНИМАНИЕ: Отключение приложения необратимо!

🔴 Это действие:
- Отключит салон от нашего приложения
- Прекратит синхронизацию данных
- Удалит WhatsApp сессию
- Клиенту придется переподключаться заново

Для подтверждения вызовите: marketplace_uninstall(salon_id=${salon_id}, confirm=true)`
        }]
      };
    }

    if (salon_id <= 0) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: Некорректный salon_id: ${salon_id}`
        }]
      };
    }

    try {
      const result = await makeMarketplaceRequest(
        `/salon/${salon_id}/application/${YCLIENTS_APP_ID}/uninstall`,
        { method: 'POST', body: JSON.stringify({ application_id: YCLIENTS_APP_ID }) }
      );

      return {
        content: [{
          type: "text",
          text: `🗑️ Салон #${salon_id} отключен от приложения\n\nРезультат: ${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка при отключении салона: ${error.message}\n\nПроверьте:\n- Существует ли салон #${salon_id}\n- Подключен ли салон к приложению`
        }]
      };
    }
  }
);

server.registerTool("marketplace_update_channel",
  {
    title: "Update Notification Channel",
    description: "Enable or disable WhatsApp/SMS channel for a salon",
    inputSchema: {
      salon_id: z.number().describe('YClients salon ID'),
      channel: z.enum(['whatsapp', 'sms']).describe('Channel type'),
      enabled: z.boolean().describe('Enable (true) or disable (false)')
    }
  },
  async ({ salon_id, channel, enabled }) => {
    const result = await makeMarketplaceRequest(
      '/application/update_channel',
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: YCLIENTS_APP_ID,
          salon_id,
          channel_slug: channel,
          is_available: enabled
        })
      }
    );

    return {
      content: [{
        type: "text",
        text: `📱 Канал "${channel}" для салона #${salon_id}: ${enabled ? '✅ включен' : '❌ отключен'}\n\nРезультат: ${JSON.stringify(result, null, 2)}`
      }]
    };
  }
);

server.registerTool("marketplace_add_discount",
  {
    title: "Add Discount for Salons",
    description: "Add discount for multiple salons",
    inputSchema: {
      salon_ids: z.array(z.number()).describe('Array of salon IDs'),
      discount_percent: z.number().describe('Discount percentage (0-100)')
    }
  },
  async ({ salon_ids, discount_percent }) => {
    // Business logic validation
    if (!salon_ids || salon_ids.length === 0) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: salon_ids должен быть непустым массивом`
        }]
      };
    }

    if (discount_percent <= 0 || discount_percent > 100) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: discount_percent должен быть от 1 до 100 (получено: ${discount_percent})`
        }]
      };
    }

    try {
      const result = await makeMarketplaceRequest(
        '/application/add_discount',
        {
          method: 'POST',
          body: JSON.stringify({
            application_id: YCLIENTS_APP_ID,
            salon_ids,
            discount: discount_percent
          })
        }
      );

      return {
        content: [{
          type: "text",
          text: `💸 Скидка ${discount_percent}% установлена для ${salon_ids.length} салонов\n\nРезультат: ${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка при установке скидки: ${error.message}`
        }]
      };
    }
  }
);

server.registerTool("marketplace_notify_payment",
  {
    title: "Notify Payment",
    description: "Notify YClients about a payment (OUTBOUND)",
    inputSchema: {
      salon_id: z.number().describe('YClients salon ID'),
      payment_sum: z.number().describe('Payment amount'),
      currency_iso: z.string()
        .optional()
        .default('RUB')
        .describe('Currency code'),
      payment_date: z.string().describe('Payment date (YYYY-MM-DD)'),
      period_from: z.string().describe('Subscription start date (YYYY-MM-DD)'),
      period_to: z.string().describe('Subscription end date (YYYY-MM-DD)')
    }
  },
  async ({ salon_id, payment_sum, currency_iso, payment_date, period_from, period_to }) => {
    // Business logic validation
    if (payment_sum <= 0) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: payment_sum должна быть положительной (получено: ${payment_sum})`
        }]
      };
    }

    // Date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(payment_date)) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: Неверный формат payment_date: ${payment_date}\nОжидается: YYYY-MM-DD`
        }]
      };
    }
    if (!dateRegex.test(period_from)) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: Неверный формат period_from: ${period_from}\nОжидается: YYYY-MM-DD`
        }]
      };
    }
    if (!dateRegex.test(period_to)) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: Неверный формат period_to: ${period_to}\nОжидается: YYYY-MM-DD`
        }]
      };
    }

    // Validate period_from < period_to
    if (new Date(period_from) >= new Date(period_to)) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка: period_from (${period_from}) должен быть раньше period_to (${period_to})`
        }]
      };
    }

    try {
      const result = await makeMarketplaceRequest(
        '/partner/payment',
        {
          method: 'POST',
          body: JSON.stringify({
            application_id: YCLIENTS_APP_ID,
            salon_id,
            payment_sum,
            currency_iso,
            payment_date,
            period_from,
            period_to
          })
        }
      );

      const paymentId = result.data?.id;
      return {
        content: [{
          type: "text",
          text: `💰 Платеж зарегистрирован для салона #${salon_id}

Payment ID: ${paymentId || 'не получен'}
⚠️ СОХРАНИТЕ payment_id для возможного возврата!

Сумма: ${payment_sum} ${currency_iso}
Период: ${period_from} — ${period_to}

Результат: ${JSON.stringify(result, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Ошибка при регистрации платежа: ${error.message}\n\nПроверьте:\n- Существует ли салон #${salon_id}\n- Подключен ли салон к приложению\n- Корректны ли даты`
        }]
      };
    }
  }
);

server.registerTool("marketplace_notify_refund",
  {
    title: "Notify Refund",
    description: "Notify YClients about a refund",
    inputSchema: {
      payment_id: z.number().describe('Payment ID from previous notify_payment')
    }
  },
  async ({ payment_id }) => {
    const result = await makeMarketplaceRequest(
      `/partner/payment/refund/${payment_id}`,
      {
        method: 'POST',
        body: JSON.stringify({ application_id: YCLIENTS_APP_ID })
      }
    );

    return {
      content: [{
        type: "text",
        text: `💸 Возврат зарегистрирован для платежа #${payment_id}\n\nРезультат: ${JSON.stringify(result, null, 2)}`
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('YClients MCP Server started successfully');
  console.error(`Marketplace tools enabled: APP_ID=${YCLIENTS_APP_ID}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});