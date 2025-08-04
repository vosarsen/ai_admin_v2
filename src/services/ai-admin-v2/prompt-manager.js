const logger = require('../../utils/logger').child({ module: 'prompt-manager' });
const fs = require('fs').promises;
const path = require('path');

/**
 * Менеджер промптов для A/B тестирования
 */
class PromptManager {
  constructor() {
    this.prompts = new Map();
    this.activePrompt = process.env.AI_PROMPT_VERSION || 'optimized-prompt';
    this.stats = new Map();
    this.promptsDir = path.join(__dirname, 'prompts');
  }

  /**
   * Загрузить все доступные промпты
   */
  async loadPrompts() {
    try {
      const files = await fs.readdir(this.promptsDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const promptName = file.replace('.js', '');
          try {
            const prompt = require(path.join(this.promptsDir, file));
            this.prompts.set(promptName, prompt);
            this.stats.set(promptName, {
              used: 0,
              success: 0,
              commandsExecuted: 0,
              errors: 0,
              avgResponseTime: 0
            });
            logger.info(`✅ Loaded prompt: ${promptName} v${prompt.version}`);
          } catch (error) {
            logger.error(`Failed to load prompt ${file}:`, error);
          }
        }
      }
      
      logger.info(`Loaded ${this.prompts.size} prompts, active: ${this.activePrompt}`);
    } catch (error) {
      logger.error('Failed to load prompts:', error);
    }
  }

  /**
   * Получить активный промпт
   */
  getActivePrompt(context) {
    const prompt = this.prompts.get(this.activePrompt);
    
    if (!prompt) {
      logger.warn(`Prompt ${this.activePrompt} not found, using base-prompt`);
      return this.prompts.get('base-prompt')?.getPrompt(context) || this.getDefaultPrompt(context);
    }
    
    return prompt.getPrompt(context);
  }

  /**
   * Получить промпт для A/B тестирования
   */
  getPromptForABTest(context, testGroup = null) {
    // Если указана конкретная группа
    if (testGroup) {
      const prompt = this.prompts.get(testGroup);
      if (prompt) {
        return {
          name: testGroup,
          version: prompt.version,
          text: prompt.getPrompt(context)
        };
      }
    }
    
    // Случайный выбор для A/B теста
    const promptNames = Array.from(this.prompts.keys());
    const randomIndex = Math.floor(Math.random() * promptNames.length);
    const selectedName = promptNames[randomIndex];
    const selectedPrompt = this.prompts.get(selectedName);
    
    return {
      name: selectedName,
      version: selectedPrompt.version,
      text: selectedPrompt.getPrompt(context)
    };
  }

  /**
   * Записать результат использования промпта
   */
  recordUsage(promptName, result) {
    const stats = this.stats.get(promptName);
    if (!stats) return;
    
    stats.used++;
    
    if (result.success) {
      stats.success++;
    } else {
      stats.errors++;
    }
    
    if (result.commandsExecuted) {
      stats.commandsExecuted += result.commandsExecuted;
    }
    
    // Обновляем среднее время ответа
    if (result.responseTime) {
      const totalTime = stats.avgResponseTime * (stats.used - 1) + result.responseTime;
      stats.avgResponseTime = totalTime / stats.used;
    }
  }

  /**
   * Получить статистику по промптам
   */
  getStats() {
    const result = {};
    
    for (const [name, stats] of this.stats.entries()) {
      result[name] = {
        ...stats,
        successRate: stats.used > 0 ? (stats.success / stats.used * 100).toFixed(1) + '%' : '0%',
        avgCommandsPerUse: stats.used > 0 ? (stats.commandsExecuted / stats.used).toFixed(2) : '0',
        avgResponseTime: Math.round(stats.avgResponseTime) + 'ms'
      };
    }
    
    return result;
  }

  /**
   * Установить активный промпт
   */
  setActivePrompt(promptName) {
    if (this.prompts.has(promptName)) {
      this.activePrompt = promptName;
      logger.info(`Active prompt changed to: ${promptName}`);
      return true;
    }
    
    logger.warn(`Prompt ${promptName} not found`);
    return false;
  }

  /**
   * Промпт по умолчанию
   */
  getDefaultPrompt(context) {
    return `Ты AI администратор. Помогай клиентам с записью.
    
Доступные команды:
[SEARCH_SLOTS] - поиск времени
[CREATE_BOOKING] - создать запись
[SHOW_PRICES] - показать цены

Сообщение: {message}`;
  }

  /**
   * Получить список доступных промптов
   */
  getAvailablePrompts() {
    return Array.from(this.prompts.entries()).map(([name, prompt]) => ({
      name,
      version: prompt.version,
      active: name === this.activePrompt
    }));
  }
}

// Экспортируем singleton
const promptManager = new PromptManager();

// Загружаем промпты при инициализации
promptManager.loadPrompts().catch(error => {
  logger.error('Failed to initialize prompt manager:', error);
});

module.exports = promptManager;