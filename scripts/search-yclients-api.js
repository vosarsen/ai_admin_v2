#!/usr/bin/env node

/**
 * Утилита для быстрого поиска в YClients API документации
 * Использование:
 * node scripts/search-yclients-api.js "book_record"
 * node scripts/search-yclients-api.js --endpoint "POST /api/v1/book_record"
 * node scripts/search-yclients-api.js --section "Онлайн-запись"
 */

const fs = require('fs');
const path = require('path');

const API_FILE = path.join(__dirname, '..', 'YCLIENTS_API.md');

// Проверяем существование файла
if (!fs.existsSync(API_FILE)) {
  console.error(`Файл не найден: ${API_FILE}`);
  process.exit(1);
}

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function searchAPI(query, options = {}) {
  const content = fs.readFileSync(API_FILE, 'utf8');
  const lines = content.split('\n');
  
  console.log(`${colors.cyan}Поиск: "${query}"${colors.reset}\n`);
  
  let results = [];
  let currentSection = '';
  let inCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Отслеживаем текущую секцию
    if (line.startsWith('## ')) {
      currentSection = line;
    }
    
    // Отслеживаем блоки кода
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    
    // Поиск
    if (line.toLowerCase().includes(query.toLowerCase())) {
      // Собираем контекст (5 строк до и после)
      const contextStart = Math.max(0, i - 5);
      const contextEnd = Math.min(lines.length - 1, i + 5);
      
      results.push({
        section: currentSection,
        lineNumber: i + 1,
        match: line,
        context: lines.slice(contextStart, contextEnd + 1),
        contextStart: contextStart + 1,
        inCodeBlock
      });
    }
  }
  
  // Выводим результаты
  if (results.length === 0) {
    console.log(`${colors.yellow}Ничего не найдено${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}Найдено результатов: ${results.length}${colors.reset}\n`);
  
  // Группируем по секциям
  const bySection = {};
  results.forEach(result => {
    const section = result.section || 'Без секции';
    if (!bySection[section]) {
      bySection[section] = [];
    }
    bySection[section].push(result);
  });
  
  // Выводим результаты по секциям
  Object.entries(bySection).forEach(([section, sectionResults]) => {
    console.log(`${colors.bright}${colors.blue}${section}${colors.reset}`);
    
    sectionResults.forEach((result, index) => {
      console.log(`\n  ${colors.yellow}Строка ${result.lineNumber}:${colors.reset}`);
      
      // Выводим контекст с подсветкой найденной строки
      result.context.forEach((contextLine, idx) => {
        const lineNum = result.contextStart + idx;
        const prefix = lineNum === result.lineNumber ? 
          `${colors.green}→ ` : '  ';
        
        console.log(`  ${prefix}${lineNum}: ${contextLine}${colors.reset}`);
      });
    });
    
    console.log('\n' + '-'.repeat(80) + '\n');
  });
}

// Специальный поиск endpoints
function searchEndpoints(method) {
  const content = fs.readFileSync(API_FILE, 'utf8');
  const lines = content.split('\n');
  
  console.log(`${colors.cyan}Поиск ${method || 'всех'} endpoints:${colors.reset}\n`);
  
  const endpoints = [];
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('## ')) {
      currentSection = line;
    }
    
    // Ищем паттерны endpoints
    const patterns = [
      /^(get|post|put|patch|delete)\/(.+)$/i,
      /^(GET|POST|PUT|PATCH|DELETE)\s+\/api\/v\d+\/(.+)$/i
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && (!method || match[1].toUpperCase() === method.toUpperCase())) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2] || match[0],
          section: currentSection,
          lineNumber: i + 1
        });
      }
    }
  }
  
  // Выводим найденные endpoints
  console.log(`${colors.green}Найдено endpoints: ${endpoints.length}${colors.reset}\n`);
  
  endpoints.forEach(ep => {
    console.log(`${colors.yellow}${ep.method}${colors.reset} /${ep.path}`);
    console.log(`  Секция: ${ep.section}`);
    console.log(`  Строка: ${ep.lineNumber}\n`);
  });
}

// Парсинг аргументов
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Использование:
  node scripts/search-yclients-api.js <поисковый запрос>
  node scripts/search-yclients-api.js --endpoints [METHOD]
  node scripts/search-yclients-api.js --help

Примеры:
  node scripts/search-yclients-api.js "book_record"
  node scripts/search-yclients-api.js "Создать запись"
  node scripts/search-yclients-api.js --endpoints
  node scripts/search-yclients-api.js --endpoints POST
  `);
  process.exit(0);
}

if (args[0] === '--endpoints') {
  searchEndpoints(args[1]);
} else if (args[0] === '--help') {
  console.log(`
YClients API Search Tool

Эта утилита помогает быстро найти информацию в большом файле YCLIENTS_API.md

Возможности:
- Полнотекстовый поиск с контекстом
- Поиск по HTTP методам (GET, POST, etc.)
- Группировка результатов по секциям
- Подсветка найденных строк

Поддерживаемые команды:
  <query>           - Поиск текста в документации
  --endpoints       - Показать все API endpoints
  --endpoints POST  - Показать только POST endpoints
  --help           - Показать эту справку
  `);
} else {
  searchAPI(args.join(' '));
}