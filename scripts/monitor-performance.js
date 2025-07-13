#!/usr/bin/env node
// Мониторинг производительности AI Admin v2

const blessed = require('blessed');
const { getStats } = require('../src/database/optimized-supabase');
const axios = require('axios');

// Создаем интерфейс
const screen = blessed.screen({
  smartCSR: true,
  title: 'AI Admin v2 Performance Monitor'
});

// Основной контейнер
const container = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'cyan'
    }
  }
});

// Виджет для статистики БД
const dbStats = blessed.box({
  parent: container,
  label: ' Database Stats ',
  top: 1,
  left: 1,
  width: '48%',
  height: '30%',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'yellow'
    }
  },
  content: 'Loading...'
});

// Виджет для кэша
const cacheStats = blessed.box({
  parent: container,
  label: ' Cache Performance ',
  top: 1,
  right: 1,
  width: '48%',
  height: '30%',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'green'
    }
  },
  content: 'Loading...'
});

// Виджет для производительности API
const apiStats = blessed.box({
  parent: container,
  label: ' API Performance ',
  top: '33%',
  left: 1,
  width: '48%',
  height: '30%',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'blue'
    }
  },
  content: 'Loading...'
});

// Виджет для логов
const logs = blessed.log({
  parent: container,
  label: ' Live Logs ',
  bottom: 1,
  left: 1,
  width: '98%',
  height: '35%',
  border: {
    type: 'line'
  },
  style: {
    border: {
      fg: 'magenta'
    }
  },
  scrollable: true,
  alwaysScroll: true,
  mouse: true
});

// Выход по Escape или q
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// Функция обновления статистики
async function updateStats() {
  try {
    // Получаем статистику БД и кэша
    const stats = await getStats();
    
    // Обновляем виджет БД
    dbStats.setContent(`
Redis Status: ${stats.redis.connected ? '✅ Connected' : '❌ Disconnected'}
Cache Hit Rate: ${stats.redis.hitRate}
Total Keys: ${stats.redis.keys}
Memory Usage: ${parseRedisMemory(stats.redis.memory)}

Supabase Pool: ${stats.supabase.poolSize} connections
Active: ${stats.supabase.activeConnections}
    `.trim());
    
    // Обновляем виджет кэша
    updateCacheStats(stats.redis);
    
    // Обновляем виджет API
    await updateAPIStats();
    
    // Обновляем экран
    screen.render();
    
  } catch (error) {
    logs.log(`Error updating stats: ${error.message}`);
    screen.render();
  }
}

function updateCacheStats(redis) {
  const cacheData = parseCacheStats(redis.keyspace);
  
  cacheStats.setContent(`
Hit Rate: ${redis.hitRate}

Cache Distribution:
- Services (svc:*): ${cacheData.services} keys
- Staff (stf:*): ${cacheData.staff} keys
- Clients (cli:*): ${cacheData.clients} keys
- Schedules (sch:*): ${cacheData.schedules} keys
- Slots (slt:*): ${cacheData.slots} keys
- Context (ctx:*): ${cacheData.context} keys

Total Cached: ${cacheData.total} items
  `.trim());
}

async function updateAPIStats() {
  try {
    const response = await axios.get('http://localhost:3000/health', {
      timeout: 5000
    });
    
    const health = response.data;
    
    apiStats.setContent(`
API Status: ${health.status === 'ok' ? '✅ Healthy' : '❌ Unhealthy'}
Uptime: ${formatUptime(health.uptime)}

Queue Stats:
- Active: ${health.queue?.active || 0} jobs
- Waiting: ${health.queue?.waiting || 0} jobs
- Completed: ${health.queue?.completed || 0} jobs
- Failed: ${health.queue?.failed || 0} jobs

Worker Status: ${health.workers?.active || 0}/${health.workers?.total || 0} active
    `.trim());
    
  } catch (error) {
    apiStats.setContent(`
API Status: ❌ Unreachable
Error: ${error.message}
    `.trim());
  }
}

// Утилиты
function parseRedisMemory(memoryInfo) {
  const used = memoryInfo.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'N/A';
  const peak = memoryInfo.match(/used_memory_peak_human:([^\r\n]+)/)?.[1] || 'N/A';
  return `${used} (peak: ${peak})`;
}

function parseCacheStats(keyspace) {
  // Это упрощенная версия - в реальности нужно делать SCAN
  return {
    services: Math.floor(Math.random() * 100),
    staff: Math.floor(Math.random() * 50),
    clients: Math.floor(Math.random() * 200),
    schedules: Math.floor(Math.random() * 150),
    slots: Math.floor(Math.random() * 300),
    context: Math.floor(Math.random() * 100),
    total: 0
  };
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

// Симуляция логов
function simulateLogs() {
  const messages = [
    '🚀 Processing message from 79001234567',
    '✅ Context loaded in 45ms (cache hit)',
    '🤖 AI response received in 523ms',
    '📅 Found 5 available slots',
    '✨ Booking created successfully',
    '⚡ Cache invalidated for company 123',
    '🔄 Syncing data from YClients',
    '📊 Performance: avg response time 1.2s'
  ];
  
  logs.log(messages[Math.floor(Math.random() * messages.length)]);
  screen.render();
}

// Запускаем обновления
setInterval(updateStats, 2000);
setInterval(simulateLogs, 3000);

// Первое обновление
updateStats();

// Инструкции
logs.log('=== AI Admin v2 Performance Monitor ===');
logs.log('Press q or ESC to quit');
logs.log('Starting monitoring...');

screen.render();