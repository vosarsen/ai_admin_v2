#!/usr/bin/env node
// scripts/replay-dialogs.js
// Воспроизведение реальных диалогов для тестирования AI Admin

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { createHash } = require('crypto');

// Импортируем AI Admin v2
const AIAdminService = require('../src/services/ai-admin-v2');
const contextService = require('../src/services/context');
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
  cyan: '\x1b[36m'
};

class DialogReplayTester {
  constructor() {
    this.results = [];
    this.aiAdmin = AIAdminService;
    this.testPhone = '79999999999'; // Тестовый номер для replay
    this.companyId = 962302;
  }

  /**
   * Загрузка диалога из файла
   */
  async loadDialog(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Загрузка всех диалогов
   */
  async loadAllDialogs() {
    const dialogDir = path.join(__dirname, '../test-data/dialog-contexts');
    const files = await fs.readdir(dialogDir);
    
    const dialogs = [];
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('all-dialogs') && !file.includes('statistics')) {
        const dialog = await this.loadDialog(path.join(dialogDir, file));
        dialogs.push({ filename: file, ...dialog });
      }
    }
    
    return dialogs;
  }

  /**
   * Очистка контекста перед тестом
   */
  async clearContext(phone) {
    try {
      // contextService не имеет метода clearContext, используем deleteContext
      if (contextService.deleteContext) {
        await contextService.deleteContext(phone, this.companyId);
      } else if (contextService.clearRedisContext) {
        await contextService.clearRedisContext(phone, this.companyId);
      } else {
        // Прямое удаление из Redis
        const redis = require('../src/database/redis-factory').getClient('context');
        const key = `context:${phone}:${this.companyId}`;
        await redis.del(key);
      }
    } catch (error) {
      console.warn('Could not clear context:', error.message);
    }
  }

  /**
   * Отправка сообщения в AI Admin
   */
  async sendMessage(message, phone) {
    const startTime = Date.now();
    
    try {
      // Загружаем полный контекст
      const context = await this.aiAdmin.loadFullContext(phone, this.companyId);
      
      // Добавляем phone в контекст, т.к. processMessage требует его
      context.phone = phone;
      
      // Обрабатываем сообщение
      const result = await this.aiAdmin.processMessage(message, context);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        aiResponse: result.response,
        actions: result.executedCommands || [],
        processingTime,
        rawResult: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Сравнение ответов AI
   */
  compareResponses(original, current) {
    if (!original || !current) return { similarity: 0, analysis: 'Missing response' };
    
    // Нормализуем текст
    const normalize = (text) => 
      text.toLowerCase()
        .replace(/[.,!?;:]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    const origNorm = normalize(original);
    const currNorm = normalize(current);
    
    // Точное совпадение
    if (origNorm === currNorm) {
      return { similarity: 100, analysis: 'Exact match' };
    }
    
    // Расчёт similarity на основе общих слов
    const origWords = new Set(origNorm.split(' '));
    const currWords = new Set(currNorm.split(' '));
    
    const intersection = new Set([...origWords].filter(x => currWords.has(x)));
    const union = new Set([...origWords, ...currWords]);
    
    const jaccard = (intersection.size / union.size) * 100;
    
    // Анализ различий
    let analysis = '';
    if (jaccard > 80) {
      analysis = 'Very similar';
    } else if (jaccard > 60) {
      analysis = 'Moderately similar';
    } else if (jaccard > 40) {
      analysis = 'Somewhat similar';
    } else {
      analysis = 'Very different';
    }
    
    // Проверка ключевых слов
    const keywords = ['записать', 'свободн', 'слот', 'время', 'мастер', 'услуг'];
    const hasKeywords = keywords.some(kw => currNorm.includes(kw));
    
    if (hasKeywords) {
      analysis += ' (contains key booking terms)';
    }
    
    return {
      similarity: Math.round(jaccard),
      analysis
    };
  }

  /**
   * Сравнение действий
   */
  compareActions(original, current) {
    // Нормализуем действия
    const normalize = (actions) => {
      if (!Array.isArray(actions)) return [];
      return actions.map(a => {
        if (typeof a === 'string') return a;
        return a.action || a.command || a.name || 'unknown';
      }).sort();
    };
    
    const origActions = normalize(original);
    const currActions = normalize(current);
    
    // Точное совпадение
    if (JSON.stringify(origActions) === JSON.stringify(currActions)) {
      return {
        match: true,
        similarity: 100,
        analysis: 'Actions match exactly'
      };
    }
    
    // Частичное совпадение
    const allActions = new Set([...origActions, ...currActions]);
    const commonActions = origActions.filter(a => currActions.includes(a));
    
    const similarity = allActions.size > 0 
      ? (commonActions.length / allActions.size) * 100
      : 0;
    
    return {
      match: false,
      similarity: Math.round(similarity),
      analysis: `Original: [${origActions.join(', ')}], Current: [${currActions.join(', ')}]`,
      missing: origActions.filter(a => !currActions.includes(a)),
      extra: currActions.filter(a => !origActions.includes(a))
    };
  }

  /**
   * Воспроизведение одного диалога
   */
  async replayDialog(dialog, options = {}) {
    const { verbose = false, testPhone = this.testPhone } = options;
    
    console.log(`\n${colors.cyan}📞 Replaying dialog: ${dialog.filename}${colors.reset}`);
    console.log(`   Messages: ${dialog.messagesCount}, Original phone: ${dialog.phone}`);
    
    // Очищаем контекст
    await this.clearContext(testPhone);
    
    const dialogResults = {
      filename: dialog.filename,
      phone: dialog.phone,
      messagesCount: dialog.messagesCount,
      tests: [],
      summary: {
        totalTests: 0,
        successfulResponses: 0,
        avgResponseSimilarity: 0,
        avgActionSimilarity: 0,
        avgProcessingTime: 0,
        failures: 0
      }
    };
    
    // Воспроизводим каждое сообщение
    for (let i = 0; i < dialog.messages.length; i++) {
      const msg = dialog.messages[i];
      
      if (!msg.userMessage) continue;
      
      if (verbose) {
        console.log(`\n  ${colors.blue}[${i+1}/${dialog.messages.length}] User:${colors.reset} ${msg.userMessage}`);
      }
      
      // Отправляем сообщение
      const result = await this.sendMessage(msg.userMessage, testPhone);
      
      // Сравниваем ответы
      const responseComparison = this.compareResponses(msg.aiResponse, result.aiResponse);
      const actionComparison = this.compareActions(msg.actions, result.actions);
      
      // Сохраняем результаты теста
      const testResult = {
        messageIndex: i,
        userMessage: msg.userMessage,
        original: {
          aiResponse: msg.aiResponse,
          actions: msg.actions,
          processingTime: msg.processingTimeMs
        },
        current: {
          aiResponse: result.aiResponse,
          actions: result.actions,
          processingTime: result.processingTime,
          success: result.success,
          error: result.error
        },
        comparison: {
          responseSimilarity: responseComparison.similarity,
          responseAnalysis: responseComparison.analysis,
          actionsSimilarity: actionComparison.similarity,
          actionsAnalysis: actionComparison.analysis,
          actionsMissing: actionComparison.missing,
          actionsExtra: actionComparison.extra,
          processingTimeDiff: result.processingTime - (msg.processingTimeMs || 0)
        }
      };
      
      dialogResults.tests.push(testResult);
      
      // Вывод результатов
      if (verbose) {
        console.log(`  ${colors.green}AI Original:${colors.reset} ${msg.aiResponse?.substring(0, 100)}...`);
        console.log(`  ${colors.yellow}AI Current:${colors.reset} ${result.aiResponse?.substring(0, 100)}...`);
        console.log(`  ${colors.magenta}Similarity:${colors.reset} Response: ${responseComparison.similarity}%, Actions: ${actionComparison.similarity}%`);
        
        if (!result.success) {
          console.log(`  ${colors.red}Error:${colors.reset} ${result.error}`);
        }
      }
    }
    
    // Рассчитываем статистику
    const validTests = dialogResults.tests.filter(t => t.current.success);
    dialogResults.summary.totalTests = dialogResults.tests.length;
    dialogResults.summary.successfulResponses = validTests.length;
    dialogResults.summary.failures = dialogResults.tests.length - validTests.length;
    
    if (validTests.length > 0) {
      dialogResults.summary.avgResponseSimilarity = Math.round(
        validTests.reduce((sum, t) => sum + t.comparison.responseSimilarity, 0) / validTests.length
      );
      dialogResults.summary.avgActionSimilarity = Math.round(
        validTests.reduce((sum, t) => sum + t.comparison.actionsSimilarity, 0) / validTests.length
      );
      dialogResults.summary.avgProcessingTime = Math.round(
        validTests.reduce((sum, t) => sum + t.current.processingTime, 0) / validTests.length
      );
    }
    
    // Итоговый вывод для диалога
    console.log(`\n  ${colors.bright}Summary:${colors.reset}`);
    console.log(`  - Success rate: ${dialogResults.summary.successfulResponses}/${dialogResults.summary.totalTests}`);
    console.log(`  - Avg response similarity: ${dialogResults.summary.avgResponseSimilarity}%`);
    console.log(`  - Avg actions similarity: ${dialogResults.summary.avgActionSimilarity}%`);
    console.log(`  - Avg processing time: ${dialogResults.summary.avgProcessingTime}ms`);
    
    return dialogResults;
  }

  /**
   * Запуск тестов на всех диалогах
   */
  async runAllTests(options = {}) {
    const { limit = null, verbose = false } = options;
    
    console.log(`\n${colors.bright}🚀 Starting Dialog Replay Testing${colors.reset}`);
    console.log(`AI Provider: ${process.env.AI_PROVIDER || 'deepseek'}`);
    console.log(`Model: ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}\n`);
    
    // Загружаем диалоги
    let dialogs = await this.loadAllDialogs();
    
    if (limit) {
      dialogs = dialogs.slice(0, limit);
    }
    
    console.log(`Found ${dialogs.length} dialogs to test\n`);
    
    // Тестируем каждый диалог
    for (const dialog of dialogs) {
      const result = await this.replayDialog(dialog, { verbose });
      this.results.push(result);
      
      // Небольшая пауза между диалогами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Генерируем отчёт
    await this.generateReport();
  }

  /**
   * Генерация отчёта
   */
  async generateReport() {
    const reportDir = path.join(__dirname, '../test-data/replay-results');
    await fs.mkdir(reportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Общая статистика
    const totalStats = {
      timestamp: new Date().toISOString(),
      aiProvider: process.env.AI_PROVIDER || 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      totalDialogs: this.results.length,
      totalMessages: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      avgResponseSimilarity: 0,
      avgActionSimilarity: 0,
      avgProcessingTime: 0,
      dialogsSummary: []
    };
    
    // Собираем статистику
    let sumResponseSim = 0;
    let sumActionSim = 0;
    let sumProcessingTime = 0;
    let countValidDialogs = 0;
    
    for (const dialog of this.results) {
      totalStats.totalMessages += dialog.summary.totalTests;
      totalStats.totalSuccesses += dialog.summary.successfulResponses;
      totalStats.totalFailures += dialog.summary.failures;
      
      if (dialog.summary.successfulResponses > 0) {
        sumResponseSim += dialog.summary.avgResponseSimilarity;
        sumActionSim += dialog.summary.avgActionSimilarity;
        sumProcessingTime += dialog.summary.avgProcessingTime;
        countValidDialogs++;
      }
      
      // Краткая сводка по диалогу
      totalStats.dialogsSummary.push({
        filename: dialog.filename,
        messagesCount: dialog.messagesCount,
        successRate: `${dialog.summary.successfulResponses}/${dialog.summary.totalTests}`,
        avgResponseSimilarity: dialog.summary.avgResponseSimilarity,
        avgActionSimilarity: dialog.summary.avgActionSimilarity
      });
    }
    
    if (countValidDialogs > 0) {
      totalStats.avgResponseSimilarity = Math.round(sumResponseSim / countValidDialogs);
      totalStats.avgActionSimilarity = Math.round(sumActionSim / countValidDialogs);
      totalStats.avgProcessingTime = Math.round(sumProcessingTime / countValidDialogs);
    }
    
    // Сохраняем детальные результаты
    await fs.writeFile(
      path.join(reportDir, `detailed-results-${timestamp}.json`),
      JSON.stringify(this.results, null, 2)
    );
    
    // Сохраняем сводку
    await fs.writeFile(
      path.join(reportDir, `summary-${timestamp}.json`),
      JSON.stringify(totalStats, null, 2)
    );
    
    // Выводим финальную статистику
    console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}📊 FINAL REPORT${colors.reset}`);
    console.log(`${'='.repeat(60)}\n`);
    
    console.log(`${colors.cyan}Test Configuration:${colors.reset}`);
    console.log(`  - AI Provider: ${totalStats.aiProvider}`);
    console.log(`  - Model: ${totalStats.model}`);
    console.log(`  - Timestamp: ${new Date().toLocaleString()}\n`);
    
    console.log(`${colors.cyan}Overall Statistics:${colors.reset}`);
    console.log(`  - Dialogs tested: ${totalStats.totalDialogs}`);
    console.log(`  - Messages tested: ${totalStats.totalMessages}`);
    console.log(`  - Successful responses: ${totalStats.totalSuccesses}/${totalStats.totalMessages} (${Math.round(totalStats.totalSuccesses/totalStats.totalMessages*100)}%)`);
    console.log(`  - Failed responses: ${totalStats.totalFailures}\n`);
    
    console.log(`${colors.cyan}Quality Metrics:${colors.reset}`);
    console.log(`  - Avg Response Similarity: ${totalStats.avgResponseSimilarity}%`);
    console.log(`  - Avg Actions Similarity: ${totalStats.avgActionSimilarity}%`);
    console.log(`  - Avg Processing Time: ${totalStats.avgProcessingTime}ms\n`);
    
    // Показываем топ и худшие диалоги
    const sortedByResponse = [...totalStats.dialogsSummary].sort((a, b) => b.avgResponseSimilarity - a.avgResponseSimilarity);
    
    console.log(`${colors.green}Top 3 Best Matching Dialogs:${colors.reset}`);
    sortedByResponse.slice(0, 3).forEach((d, i) => {
      console.log(`  ${i+1}. ${d.filename} - Response: ${d.avgResponseSimilarity}%, Actions: ${d.avgActionSimilarity}%`);
    });
    
    console.log(`\n${colors.red}Top 3 Worst Matching Dialogs:${colors.reset}`);
    sortedByResponse.slice(-3).forEach((d, i) => {
      console.log(`  ${i+1}. ${d.filename} - Response: ${d.avgResponseSimilarity}%, Actions: ${d.avgActionSimilarity}%`);
    });
    
    console.log(`\n${colors.bright}Reports saved to: ${reportDir}${colors.reset}\n`);
  }
}

// CLI интерфейс
async function main() {
  const tester = new DialogReplayTester();
  
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const limitIndex = args.findIndex(a => a === '-l' || a === '--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;
  const singleIndex = args.findIndex(a => a === '-f' || a === '--file');
  const singleFile = singleIndex !== -1 ? args[singleIndex + 1] : null;
  
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
Dialog Replay Tester

Usage:
  node replay-dialogs.js [options]

Options:
  -v, --verbose     Show detailed output for each message
  -l, --limit N     Test only first N dialogs
  -f, --file FILE   Test single dialog file
  -h, --help        Show this help

Examples:
  node replay-dialogs.js                    # Test all dialogs
  node replay-dialogs.js -v -l 3           # Test first 3 dialogs with verbose output
  node replay-dialogs.js -f dialog_3848.json  # Test specific dialog
    `);
    process.exit(0);
  }
  
  try {
    if (singleFile) {
      // Тест одного файла
      const dialogPath = path.join(__dirname, '../test-data/dialog-contexts', singleFile);
      const dialog = await tester.loadDialog(dialogPath);
      dialog.filename = singleFile;
      const result = await tester.replayDialog(dialog, { verbose: true });
      console.log('\nTest completed!');
    } else {
      // Тест всех диалогов
      await tester.runAllTests({ limit, verbose });
    }
  } catch (error) {
    console.error(`\n${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}

module.exports = { DialogReplayTester };