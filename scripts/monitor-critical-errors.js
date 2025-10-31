#!/usr/bin/env node

// scripts/monitor-critical-errors.js
const fs = require('fs').promises;
const path = require('path');
const { format, subDays, isAfter } = require('date-fns');
const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * Скрипт для мониторинга и анализа критичных ошибок
 */
class CriticalErrorMonitor {
  constructor() {
    this.logDir = path.join(__dirname, '../logs/critical');
    this.errorStats = new Map();
    this.errorPatterns = new Map();
  }
  
  async run() {
    console.log(chalk.bold.blue('🔍 Critical Error Monitor\n'));
    
    try {
      // Читаем логи за последние дни
      const errors = await this.readRecentErrors(7); // 7 дней
      
      if (errors.length === 0) {
        console.log(chalk.green('✅ No critical errors found in the last 7 days!'));
        return;
      }
      
      // Анализируем ошибки
      this.analyzeErrors(errors);
      
      // Выводим статистику
      this.displayStats();
      this.displayTopErrors();
      this.displayErrorPatterns();
      this.displayRecentErrors(errors);
      
      // Проверяем критичные паттерны
      this.checkCriticalPatterns();
      
    } catch (error) {
      console.error(chalk.red('Error reading logs:'), error.message);
    }
  }
  
  async readRecentErrors(days) {
    const errors = [];
    const since = subDays(new Date(), days);
    
    try {
      const files = await fs.readdir(this.logDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filepath = path.join(this.logDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        
        // Парсим JSON записи из лога
        const lines = content.split('\n\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const error = JSON.parse(line);
            const errorDate = new Date(error.timestamp);
            
            if (isAfter(errorDate, since)) {
              errors.push(error);
            }
          } catch (e) {
            // Пропускаем невалидные строки
          }
        }
      }
    } catch (e) {
      // Если папки нет, значит ошибок не было
      if (e.code !== 'ENOENT') throw e;
    }
    
    // Сортируем по времени
    return errors.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }
  
  analyzeErrors(errors) {
    for (const error of errors) {
      // Собираем статистику по типам
      const type = error.type || 'unknown';
      const stats = this.errorStats.get(type) || {
        count: 0,
        severity: error.severity,
        lastSeen: null,
        examples: []
      };
      
      stats.count++;
      stats.lastSeen = error.timestamp;
      if (stats.examples.length < 3) {
        stats.examples.push(error);
      }
      
      this.errorStats.set(type, stats);
      
      // Анализируем паттерны
      if (error.pattern?.isPattern) {
        this.errorPatterns.set(type, error.pattern);
      }
    }
  }
  
  displayStats() {
    console.log(chalk.bold.yellow('\n📊 Error Statistics:'));
    
    const table = new Table({
      head: ['Type', 'Count', 'Severity', 'Last Seen'],
      colWidths: [30, 10, 15, 25]
    });
    
    const sortedStats = Array.from(this.errorStats.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    for (const [type, stats] of sortedStats) {
      const severity = this.getSeverityColor(stats.severity);
      table.push([
        type,
        stats.count,
        severity(stats.severity),
        format(new Date(stats.lastSeen), 'yyyy-MM-dd HH:mm:ss')
      ]);
    }
    
    console.log(table.toString());
  }
  
  displayTopErrors() {
    console.log(chalk.bold.yellow('\n🔝 Top 5 Most Frequent Errors:'));
    
    const topErrors = Array.from(this.errorStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    
    for (const [type, stats] of topErrors) {
      console.log(chalk.bold(`\n${type} (${stats.count} occurrences)`));
      
      if (stats.examples.length > 0) {
        const example = stats.examples[0];
        console.log(`  Message: ${example.error.message}`);
        console.log(`  Context: ${JSON.stringify(example.context, null, 2).split('\n').join('\n  ')}`);
      }
    }
  }
  
  displayErrorPatterns() {
    if (this.errorPatterns.size === 0) return;
    
    console.log(chalk.bold.yellow('\n🔄 Detected Error Patterns:'));
    
    const table = new Table({
      head: ['Type', 'Pattern', 'Frequency', 'First Seen'],
      colWidths: [25, 15, 15, 25]
    });
    
    for (const [type, pattern] of this.errorPatterns.entries()) {
      table.push([
        type,
        pattern.patternType,
        pattern.frequency,
        format(new Date(pattern.firstOccurrence), 'yyyy-MM-dd HH:mm:ss')
      ]);
    }
    
    console.log(table.toString());
  }
  
  displayRecentErrors(errors) {
    console.log(chalk.bold.yellow('\n🕐 Recent Critical Errors (last 5):'));
    
    const recent = errors.slice(0, 5);
    
    for (const error of recent) {
      const severity = this.getSeverityColor(error.severity);
      console.log(chalk.gray('\n' + '─'.repeat(60)));
      console.log(`${chalk.bold('ID:')} ${error.id}`);
      console.log(`${chalk.bold('Time:')} ${format(new Date(error.timestamp), 'yyyy-MM-dd HH:mm:ss')}`);
      console.log(`${chalk.bold('Type:')} ${error.type}`);
      console.log(`${chalk.bold('Severity:')} ${severity(error.severity)}`);
      console.log(`${chalk.bold('Message:')} ${error.error.message}`);
      
      if (error.context?.operation) {
        console.log(`${chalk.bold('Operation:')} ${error.context.operation}`);
      }
      
      if (error.context?.userId) {
        console.log(`${chalk.bold('User:')} ${error.context.userId}`);
      }
    }
  }
  
  checkCriticalPatterns() {
    console.log(chalk.bold.yellow('\n⚠️  Critical Pattern Analysis:'));
    
    const warnings = [];
    
    // Проверяем burst паттерны
    for (const [type, pattern] of this.errorPatterns.entries()) {
      if (pattern.patternType === 'burst') {
        warnings.push({
          level: 'critical',
          message: `Burst pattern detected for ${type} - ${pattern.frequency} errors in short time`
        });
      }
    }
    
    // Проверяем критичные типы ошибок
    const criticalTypes = [
      'database_connection_lost',
      'redis_connection_lost',
      'security_breach_attempt'
    ];
    
    for (const type of criticalTypes) {
      const stats = this.errorStats.get(type);
      if (stats && stats.count > 0) {
        warnings.push({
          level: 'critical',
          message: `Critical error type "${type}" occurred ${stats.count} times`
        });
      }
    }
    
    // Проверяем высокую частоту ошибок
    for (const [type, stats] of this.errorStats.entries()) {
      if (stats.count > 10) {
        warnings.push({
          level: 'warning',
          message: `High frequency of "${type}" errors: ${stats.count} occurrences`
        });
      }
    }
    
    // Выводим предупреждения
    if (warnings.length === 0) {
      console.log(chalk.green('  No critical patterns detected'));
    } else {
      for (const warning of warnings) {
        const icon = warning.level === 'critical' ? '🚨' : '⚠️';
        const color = warning.level === 'critical' ? chalk.red : chalk.yellow;
        console.log(`  ${icon} ${color(warning.message)}`);
      }
    }
  }
  
  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return chalk.red;
      case 'high': return chalk.yellow;
      case 'medium': return chalk.blue;
      default: return chalk.gray;
    }
  }
}

// Запуск монитора
if (require.main === module) {
  const monitor = new CriticalErrorMonitor();
  monitor.run();
}

module.exports = CriticalErrorMonitor;