#!/usr/bin/env node
// scripts/test-real-scenarios.js
// Тестирование AI Admin на реальных диалогах с оценкой успешности

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Импортируем AI Admin v2 и сервисы
const AIAdminService = require('../src/services/ai-admin-v2');
const { supabase } = require('../src/database/supabase');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class RealScenarioTester {
  constructor() {
    this.aiAdmin = AIAdminService;
    this.companyId = 962302;
    this.currentDialog = null;
    this.currentPhone = null;
    this.results = [];
    this.rl = null;
  }

  /**
   * Загрузка реальных диалогов из БД
   */
  async loadRealDialogs() {
    console.log(`${colors.cyan}📱 Загружаю реальные диалоги из базы данных...${colors.reset}\n`);
    
    const { data: contexts, error } = await supabase
      .from('dialog_contexts')
      .select('*')
      .order('message_count', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // Фильтруем и форматируем диалоги
    const dialogs = contexts
      .filter(ctx => ctx.messages && ctx.messages.length > 0)
      .map(ctx => {
        const phone = ctx.user_id.replace('@c.us', '');
        return {
          id: ctx.id,
          phone,
          messageCount: ctx.message_count || ctx.messages.length,
          lastActivity: ctx.last_activity,
          hasBooking: !!ctx.last_booking_id,
          messages: ctx.messages.map(msg => ({
            user: msg.userMessage,
            ai: msg.aiResponse,
            actions: msg.actions || [],
            timestamp: msg.timestamp,
            processingTime: msg.processingTime || msg.processingTimeMs
          }))
        };
      })
      .sort((a, b) => b.messageCount - a.messageCount);
    
    console.log(`✅ Загружено ${dialogs.length} диалогов\n`);
    return dialogs;
  }

  /**
   * Анализ диалога для определения цели
   */
  analyzeDialogIntent(messages) {
    const firstMessage = messages[0]?.user?.toLowerCase() || '';
    const allUserMessages = messages.map(m => m.user?.toLowerCase() || '').join(' ');
    
    // Определяем основную цель диалога
    if (allUserMessages.includes('запис') || allUserMessages.includes('запиш') || 
        allUserMessages.includes('можно') || allUserMessages.includes('свободн')) {
      return 'BOOKING';
    } else if (allUserMessages.includes('отмен') || allUserMessages.includes('перенес')) {
      return 'CANCEL_RESCHEDULE';
    } else if (allUserMessages.includes('цен') || allUserMessages.includes('стои') || 
               allUserMessages.includes('сколько')) {
      return 'PRICE_INFO';
    } else if (allUserMessages.includes('работа') || allUserMessages.includes('время') ||
               allUserMessages.includes('график')) {
      return 'SCHEDULE_INFO';
    } else {
      return 'GENERAL_INFO';
    }
  }

  /**
   * Оценка успешности диалога
   */
  evaluateDialogSuccess(messages, intent) {
    const lastAiResponse = messages[messages.length - 1]?.ai?.toLowerCase() || '';
    const allActions = messages.flatMap(m => m.actions || []);
    
    const criteria = {
      BOOKING: {
        success: ['записал', 'забронировал', 'ждем вас', 'подтвержд', 'успешно'],
        actions: ['CREATE_BOOKING', 'CONFIRM_BOOKING'],
        partial: ['выберите', 'укажите', 'уточните', 'доступн']
      },
      CANCEL_RESCHEDULE: {
        success: ['отменен', 'перенесен', 'измен'],
        actions: ['CANCEL_BOOKING', 'RESCHEDULE_BOOKING'],
        partial: ['найти запись', 'уточните']
      },
      PRICE_INFO: {
        success: ['стоимость', 'цена', 'руб', '₽'],
        actions: ['SHOW_PRICES'],
        partial: []
      },
      SCHEDULE_INFO: {
        success: ['работа', 'график', 'время', 'открыт'],
        actions: ['CHECK_STAFF_SCHEDULE', 'GET_INFO'],
        partial: []
      },
      GENERAL_INFO: {
        success: ['помочь', 'обращайтесь'],
        actions: ['GET_INFO'],
        partial: []
      }
    };
    
    const intentCriteria = criteria[intent] || criteria.GENERAL_INFO;
    
    // Проверяем успешность
    const hasSuccessWords = intentCriteria.success.some(word => lastAiResponse.includes(word));
    const hasSuccessActions = intentCriteria.actions.some(action => allActions.includes(action));
    const hasPartialSuccess = intentCriteria.partial.some(word => lastAiResponse.includes(word));
    
    if (hasSuccessWords || hasSuccessActions) {
      return { status: 'SUCCESS', confidence: 90 };
    } else if (hasPartialSuccess) {
      return { status: 'PARTIAL', confidence: 60 };
    } else if (lastAiResponse.includes('ошибк') || lastAiResponse.includes('не могу')) {
      return { status: 'FAILED', confidence: 90 };
    } else {
      return { status: 'UNCLEAR', confidence: 30 };
    }
  }

  /**
   * Воспроизведение диалога с новым AI
   */
  async replayDialog(dialog) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}📞 Тестирую диалог: ${dialog.phone}${colors.reset}`);
    console.log(`${colors.gray}Сообщений: ${dialog.messageCount}, Была запись: ${dialog.hasBooking ? 'Да' : 'Нет'}${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    // Определяем интент диалога
    const intent = this.analyzeDialogIntent(dialog.messages);
    console.log(`${colors.yellow}🎯 Цель диалога: ${intent}${colors.reset}\n`);
    
    // Создаем уникальный тестовый номер
    const testPhone = `7999${Date.now().toString().slice(-7)}`;
    
    // Очищаем контекст
    await this.clearContext(testPhone);
    
    const newMessages = [];
    let context = await this.aiAdmin.loadFullContext(testPhone, this.companyId);
    context.phone = testPhone;
    
    // Воспроизводим диалог
    for (let i = 0; i < dialog.messages.length; i++) {
      const msg = dialog.messages[i];
      
      if (!msg.user) continue;
      
      console.log(`${colors.blue}👤 Клиент:${colors.reset} ${msg.user}`);
      console.log(`${colors.gray}   (Оригинальный ответ: ${msg.ai?.substring(0, 80)}...)${colors.reset}`);
      
      try {
        // Убедимся что context имеет phone
        if (!context.phone) {
          context.phone = testPhone;
        }
        
        const startTime = Date.now();
        const result = await this.aiAdmin.processMessage(msg.user, context);
        const processingTime = Date.now() - startTime;
        
        console.log(`${colors.green}🤖 AI Admin:${colors.reset} ${result.response}`);
        
        if (result.executedCommands && result.executedCommands.length > 0) {
          const commands = result.executedCommands.map(c => c.command || c.action).join(', ');
          console.log(`${colors.magenta}   ⚙️ Команды: ${commands}${colors.reset}`);
        }
        
        console.log(`${colors.gray}   ⏱️ Время: ${processingTime}ms${colors.reset}\n`);
        
        newMessages.push({
          user: msg.user,
          ai: result.response,
          actions: result.executedCommands || [],
          processingTime
        });
        
        // Обновляем контекст для следующего сообщения
        context = await this.aiAdmin.loadFullContext(testPhone, this.companyId);
        context.phone = testPhone;
        
      } catch (error) {
        console.log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}\n`);
        newMessages.push({
          user: msg.user,
          ai: `Ошибка: ${error.message}`,
          error: true
        });
      }
    }
    
    // Оцениваем результат
    const originalSuccess = this.evaluateDialogSuccess(dialog.messages, intent);
    const newSuccess = this.evaluateDialogSuccess(newMessages, intent);
    
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}📊 РЕЗУЛЬТАТЫ ТЕСТА${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Оригинальный диалог:${colors.reset}`);
    console.log(`  • Статус: ${this.getStatusEmoji(originalSuccess.status)} ${originalSuccess.status}`);
    console.log(`  • Уверенность: ${originalSuccess.confidence}%`);
    
    console.log(`\n${colors.green}Новый диалог (AI Admin):${colors.reset}`);
    console.log(`  • Статус: ${this.getStatusEmoji(newSuccess.status)} ${newSuccess.status}`);
    console.log(`  • Уверенность: ${newSuccess.confidence}%`);
    
    // Сохраняем результат
    const result = {
      dialogId: dialog.id,
      phone: dialog.phone,
      intent,
      originalSuccess,
      newSuccess,
      improved: newSuccess.confidence > originalSuccess.confidence,
      messages: {
        original: dialog.messages,
        new: newMessages
      }
    };
    
    this.results.push(result);
    
    return result;
  }

  /**
   * Интерактивный режим просмотра
   */
  async interactiveMode(dialogs) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n${colors.bright}🎮 ИНТЕРАКТИВНЫЙ РЕЖИМ${colors.reset}`);
    console.log(`${colors.gray}Команды: [n]ext, [p]revious, [r]eplay, [q]uit, [1-9] выбор диалога${colors.reset}\n`);
    
    let currentIndex = 0;
    
    while (true) {
      const dialog = dialogs[currentIndex];
      
      // Показываем список диалогов
      console.log(`\n${colors.cyan}Доступные диалоги:${colors.reset}`);
      for (let i = 0; i < Math.min(10, dialogs.length); i++) {
        const d = dialogs[i];
        const marker = i === currentIndex ? '👉' : '  ';
        console.log(`${marker} ${i + 1}. ${d.phone} (${d.messageCount} сообщений)`);
      }
      
      // Показываем текущий диалог
      console.log(`\n${colors.yellow}Выбран диалог ${currentIndex + 1}:${colors.reset}`);
      this.showDialogPreview(dialog);
      
      // Ждем команду
      const command = await this.prompt('\nКоманда: ');
      
      if (command === 'q' || command === 'quit') {
        break;
      } else if (command === 'n' || command === 'next') {
        currentIndex = (currentIndex + 1) % dialogs.length;
      } else if (command === 'p' || command === 'previous') {
        currentIndex = (currentIndex - 1 + dialogs.length) % dialogs.length;
      } else if (command === 'r' || command === 'replay') {
        await this.replayDialog(dialog);
        await this.prompt('\nНажмите Enter для продолжения...');
      } else if (/^\d+$/.test(command)) {
        const num = parseInt(command) - 1;
        if (num >= 0 && num < dialogs.length) {
          currentIndex = num;
        }
      }
    }
    
    this.rl.close();
  }

  /**
   * Показ превью диалога
   */
  showDialogPreview(dialog) {
    const intent = this.analyzeDialogIntent(dialog.messages);
    const success = this.evaluateDialogSuccess(dialog.messages, intent);
    
    console.log(`${colors.gray}Телефон: ${dialog.phone}`);
    console.log(`Сообщений: ${dialog.messageCount}`);
    console.log(`Цель: ${intent}`);
    console.log(`Результат: ${this.getStatusEmoji(success.status)} ${success.status} (${success.confidence}%)${colors.reset}`);
    
    console.log(`\n${colors.cyan}Первые сообщения:${colors.reset}`);
    for (let i = 0; i < Math.min(3, dialog.messages.length); i++) {
      const msg = dialog.messages[i];
      console.log(`${colors.blue}Клиент:${colors.reset} ${msg.user?.substring(0, 60)}...`);
      console.log(`${colors.green}AI:${colors.reset} ${msg.ai?.substring(0, 60)}...`);
      if (i < 2) console.log('');
    }
  }

  /**
   * Вспомогательные методы
   */
  async clearContext(phone) {
    try {
      const redis = require('../src/database/redis-factory').getClient('context');
      const key = `context:${phone}:${this.companyId}`;
      await redis.del(key);
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  }

  getStatusEmoji(status) {
    const emojis = {
      SUCCESS: '✅',
      PARTIAL: '⚠️',
      FAILED: '❌',
      UNCLEAR: '❓'
    };
    return emojis[status] || '❓';
  }

  prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * Автоматический режим тестирования
   */
  async autoMode(dialogs, limit = 5) {
    console.log(`\n${colors.bright}🤖 АВТОМАТИЧЕСКОЕ ТЕСТИРОВАНИЕ${colors.reset}`);
    console.log(`Будет протестировано ${limit} диалогов\n`);
    
    const testDialogs = dialogs.slice(0, limit);
    
    for (let i = 0; i < testDialogs.length; i++) {
      console.log(`\n${colors.bright}[${i + 1}/${limit}]${colors.reset}`);
      await this.replayDialog(testDialogs[i]);
      
      // Пауза между тестами
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Показываем итоговую статистику
    this.showSummary();
  }

  /**
   * Итоговая статистика
   */
  showSummary() {
    console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}📈 ИТОГОВАЯ СТАТИСТИКА${colors.reset}`);
    console.log(`${colors.bright}${'='.repeat(60)}${colors.reset}\n`);
    
    const stats = {
      total: this.results.length,
      improved: this.results.filter(r => r.improved).length,
      byIntent: {},
      byStatus: {
        SUCCESS: 0,
        PARTIAL: 0,
        FAILED: 0,
        UNCLEAR: 0
      }
    };
    
    // Собираем статистику
    for (const result of this.results) {
      // По интентам
      if (!stats.byIntent[result.intent]) {
        stats.byIntent[result.intent] = {
          total: 0,
          success: 0
        };
      }
      stats.byIntent[result.intent].total++;
      if (result.newSuccess.status === 'SUCCESS') {
        stats.byIntent[result.intent].success++;
      }
      
      // По статусам
      stats.byStatus[result.newSuccess.status]++;
    }
    
    console.log(`${colors.cyan}Общая статистика:${colors.reset}`);
    console.log(`  • Протестировано диалогов: ${stats.total}`);
    console.log(`  • Улучшено: ${stats.improved} (${Math.round(stats.improved/stats.total*100)}%)`);
    
    console.log(`\n${colors.cyan}По результатам:${colors.reset}`);
    for (const [status, count] of Object.entries(stats.byStatus)) {
      const percent = Math.round(count / stats.total * 100);
      console.log(`  ${this.getStatusEmoji(status)} ${status}: ${count} (${percent}%)`);
    }
    
    console.log(`\n${colors.cyan}По целям диалогов:${colors.reset}`);
    for (const [intent, data] of Object.entries(stats.byIntent)) {
      const successRate = Math.round(data.success / data.total * 100);
      console.log(`  • ${intent}: ${data.success}/${data.total} успешно (${successRate}%)`);
    }
    
    // Сохраняем результаты
    this.saveResults();
  }

  /**
   * Сохранение результатов
   */
  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(__dirname, '../test-data/scenario-results');
    await fs.mkdir(dir, { recursive: true });
    
    const filename = path.join(dir, `test-results-${timestamp}.json`);
    await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
    
    console.log(`\n${colors.green}✅ Результаты сохранены: ${filename}${colors.reset}`);
  }
}

// CLI
async function main() {
  const tester = new RealScenarioTester();
  
  const args = process.argv.slice(2);
  const mode = args[0] || 'auto';
  const limit = parseInt(args[1]) || 5;
  
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Real Scenario Tester для AI Admin

Использование:
  node test-real-scenarios.js [mode] [limit]

Режимы:
  auto [N]        - Автоматическое тестирование N диалогов (по умолчанию 5)
  interactive     - Интерактивный режим с выбором диалогов
  
Примеры:
  node test-real-scenarios.js                # Авто-тест 5 диалогов
  node test-real-scenarios.js auto 10        # Авто-тест 10 диалогов  
  node test-real-scenarios.js interactive    # Интерактивный режим
    `);
    process.exit(0);
  }
  
  try {
    // Загружаем диалоги
    const dialogs = await tester.loadRealDialogs();
    
    if (mode === 'interactive') {
      await tester.interactiveMode(dialogs);
    } else {
      await tester.autoMode(dialogs, limit);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
    console.error(error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { RealScenarioTester };