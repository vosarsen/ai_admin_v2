/**
 * GlitchTip Commands Module for Telegram Bot
 *
 * Provides Telegram bot commands for interacting with GlitchTip API:
 * - /errors [component] [hours] - Query errors
 * - /resolve <issue_id> - Resolve issue
 * - /investigate <issue_id> - Run investigation
 * - /glitchtip_stats [period] - Get statistics
 *
 * Usage:
 *   const GlitchTipCommands = require('./lib/glitchtip-commands');
 *   const gtCommands = new GlitchTipCommands(glitchtipUrl, apiToken);
 *   await gtCommands.handleErrorsCommand(chatId, args, sendMessage);
 */

const GlitchTipAPI = require('./glitchtip-api');
const { validateIssueId, validateHours, validateComponent } = require('./validation');
const { execSync } = require('child_process');
const path = require('path');

class GlitchTipCommands {
  constructor(glitchtipUrl, apiToken, orgSlug = 'admin-ai') {
    this.client = new GlitchTipAPI(glitchtipUrl, apiToken);
    this.orgSlug = orgSlug;
  }

  /**
   * Handle /errors [component] [hours] command
   * Query errors from last N hours, optionally filtered by component
   */
  async handleErrorsCommand(args, sendMessage) {
    try {
      // Parse arguments: /errors [component] [hours]
      let component = null;
      let hours = 24; // default

      if (args.length > 0) {
        // First arg could be component or hours
        if (!isNaN(args[0])) {
          hours = parseInt(args[0]);
        } else {
          component = args[0];
          if (args.length > 1 && !isNaN(args[1])) {
            hours = parseInt(args[1]);
          }
        }
      }

      // Fetch issues
      const issues = await this.client.getIssues(this.orgSlug, {
        query: 'is:unresolved',
        limit: 100
      });

      // Filter by time and component
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      let filteredIssues = issues.filter(issue => {
        const lastSeen = new Date(issue.lastSeen);
        return lastSeen >= cutoffTime;
      });

      if (component) {
        filteredIssues = filteredIssues.filter(issue => {
          const componentTag = issue.tags?.find(t => t.key === 'component')?.value;
          return componentTag === component;
        });
      }

      // Format response
      if (filteredIssues.length === 0) {
        const filter = component ? ` в компоненте "${component}"` : '';
        await sendMessage(`✅ Ошибок не найдено за последние ${hours}ч${filter}`);
        return;
      }

      // Sort by count (descending)
      filteredIssues.sort((a, b) => (b.count || 0) - (a.count || 0));

      // Build message
      const filter = component ? ` (${component})` : '';
      let message = `🔍 *Ошибки за ${hours}ч${filter}:*\n\n`;
      message += `Найдено: *${filteredIssues.length}* ${this._plural(filteredIssues.length, 'ошибка', 'ошибки', 'ошибок')}\n\n`;

      // Show top 10
      const topIssues = filteredIssues.slice(0, 10);
      for (let i = 0; i < topIssues.length; i++) {
        const issue = topIssues[i];
        const emoji = this._getLevelEmoji(issue.level);
        const title = this._truncate(issue.title, 50);

        message += `${i + 1}. ${emoji} ${title}\n`;
        message += `   Счетчик: ${issue.count} | ID: \`${issue.id}\`\n`;
      }

      if (filteredIssues.length > 10) {
        message += `\n...и ещё ${filteredIssues.length - 10} ${this._plural(filteredIssues.length - 10, 'ошибка', 'ошибки', 'ошибок')}`;
      }

      await sendMessage(message);

    } catch (error) {
      await sendMessage(`❌ Ошибка при получении данных: ${error.message}`);
    }
  }

  /**
   * Handle /resolve <issue_id> command
   * Resolve an issue by ID
   */
  async handleResolveCommand(args, sendMessage) {
    try {
      if (args.length === 0) {
        await sendMessage('❌ Использование: `/resolve <issue_id>`\nПример: `/resolve 123`');
        return;
      }

      const issueId = args[0];

      // Get issue first to verify it exists
      const issue = await this.client.getIssue(this.orgSlug, issueId);

      if (!issue) {
        await sendMessage(`❌ Ошибка с ID ${issueId} не найдена`);
        return;
      }

      // Resolve it
      await this.client.resolveIssue(this.orgSlug, issueId);

      const title = this._truncate(issue.title, 50);
      await sendMessage(`✅ Ошибка закрыта!\n\n*${title}*\nID: \`${issueId}\``);

    } catch (error) {
      await sendMessage(`❌ Ошибка при закрытии: ${error.message}`);
    }
  }

  /**
   * Handle /investigate <issue_id> command
   * Run investigation script and return results
   */
  async handleInvestigateCommand(args, sendMessage) {
    try {
      if (args.length === 0) {
        await sendMessage('❌ Использование: `/investigate <issue_id>`\nПример: `/investigate 123`');
        return;
      }

      const issueId = args[0];

      // Verify issue exists
      const issue = await this.client.getIssue(this.orgSlug, issueId);

      if (!issue) {
        await sendMessage(`❌ Ошибка с ID ${issueId} не найдена`);
        return;
      }

      await sendMessage(`🔍 Запускаю расследование для ошибки ${issueId}...\n\nЭто может занять до 10 секунд.`);

      // Run investigation script
      const scriptPath = path.join(__dirname, '../investigate-error.js');
      const result = execSync(
        `export GLITCHTIP_TOKEN=${process.env.GLITCHTIP_TOKEN} && node ${scriptPath} ${issueId}`,
        {
          encoding: 'utf-8',
          timeout: 15000,
          cwd: path.join(__dirname, '../..')
        }
      );

      // Parse result (script exits with code 0 on success)
      const title = this._truncate(issue.title, 50);
      await sendMessage(`✅ Расследование завершено!\n\n*${title}*\nID: \`${issueId}\`\n\nРезультаты добавлены в комментарии к ошибке в GlitchTip.`);

    } catch (error) {
      if (error.code === 'ETIMEDOUT') {
        await sendMessage(`⏱️ Расследование заняло слишком много времени (>15 сек). Попробуйте позже.`);
      } else {
        await sendMessage(`❌ Ошибка при расследовании: ${error.message}`);
      }
    }
  }

  /**
   * Handle /glitchtip_stats [period] command
   * Get error statistics for a period
   */
  async handleStatsCommand(args, sendMessage) {
    try {
      // Parse period: 24h (default), 7d, 30d
      let period = '24h';
      let hours = 24;

      if (args.length > 0) {
        period = args[0].toLowerCase();

        if (period.endsWith('h')) {
          hours = parseInt(period);
        } else if (period.endsWith('d')) {
          const days = parseInt(period);
          hours = days * 24;
        } else if (period === 'week' || period === 'неделя') {
          hours = 7 * 24;
          period = '7d';
        } else if (period === 'month' || period === 'месяц') {
          hours = 30 * 24;
          period = '30d';
        }
      }

      // Fetch issues
      const issues = await this.client.getIssues(this.orgSlug, {
        query: 'is:unresolved',
        limit: 100
      });

      // Filter by time
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const recentIssues = issues.filter(issue => {
        const lastSeen = new Date(issue.lastSeen);
        return lastSeen >= cutoffTime;
      });

      // Group by component
      const byComponent = {};
      let totalEvents = 0;

      for (const issue of recentIssues) {
        const component = issue.tags?.find(t => t.key === 'component')?.value || 'unknown';

        if (!byComponent[component]) {
          byComponent[component] = { count: 0, events: 0 };
        }

        byComponent[component].count++;
        byComponent[component].events += parseInt(issue.count) || 0;
        totalEvents += parseInt(issue.count) || 0;
      }

      // Format response
      let message = `📊 *Статистика GlitchTip за ${period}:*\n\n`;
      message += `• Всего ошибок: *${recentIssues.length}*\n`;
      message += `• Всего событий: *${totalEvents}*\n\n`;

      if (Object.keys(byComponent).length > 0) {
        message += `*По компонентам:*\n`;

        const sortedComponents = Object.entries(byComponent)
          .sort(([, a], [, b]) => b.count - a.count);

        for (const [component, data] of sortedComponents) {
          message += `• ${component}: ${data.count} (${data.events} событий)\n`;
        }
      }

      await sendMessage(message);

    } catch (error) {
      await sendMessage(`❌ Ошибка при получении статистики: ${error.message}`);
    }
  }

  /**
   * Get emoji for error level
   */
  _getLevelEmoji(level) {
    const emojis = {
      error: '🔴',
      warning: '🟡',
      info: '🟢',
      fatal: '💀',
      debug: '🔵'
    };
    return emojis[level] || '⚠️';
  }

  /**
   * Truncate string to max length
   */
  _truncate(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Russian plural forms
   */
  _plural(n, form1, form2, form5) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return form5;
    if (n1 > 1 && n1 < 5) return form2;
    if (n1 === 1) return form1;
    return form5;
  }
}

module.exports = GlitchTipCommands;
