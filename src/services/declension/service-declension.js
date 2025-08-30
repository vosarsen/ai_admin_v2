/**
 * Генерация склонений для названий услуг с использованием AI
 * Генерирует склонения один раз при синхронизации и сохраняет в БД
 */

const AIAdminV2 = require('../ai-admin-v2');
const logger = require('../../utils/logger').child({ module: 'service-declension' });
const providerFactory = require('../ai/provider-factory');

class ServiceDeclension {
  constructor() {
    this.aiProvider = null; // Будем инициализировать при первом использовании
    this.cache = new Map();
  }

  /**
   * Получить AI провайдера
   */
  async getAIProvider() {
    if (!this.aiProvider) {
      this.aiProvider = await providerFactory.getProvider();
    }
    return this.aiProvider;
  }

  /**
   * Генерировать склонения для названия услуги
   * @param {string} serviceName - Название услуги в именительном падеже
   * @returns {Promise<Object>} Объект со склонениями
   */
  async generateDeclensions(serviceName) {
    try {
      // Проверяем кэш
      if (this.cache.has(serviceName)) {
        return this.cache.get(serviceName);
      }

      const prompt = `
Сгенерируй склонения для названия услуги "${serviceName}" в русском языке.
Верни ТОЛЬКО JSON объект без дополнительного текста в формате:
{
  "nominative": "${serviceName}",
  "genitive": "родительный падеж (кого? чего?)",
  "dative": "дательный падеж (кому? чему?)",
  "accusative": "винительный падеж (кого? что?)",
  "instrumental": "творительный падеж (кем? чем?)",
  "prepositional": "предложный падеж (о ком? о чём?)",
  "prepositional_na": "предложный падеж с предлогом НА (на ком? на чём?)"
}

Примеры:
- "Мужская стрижка" -> accusative: "мужскую стрижку", prepositional_na: "мужской стрижке"
- "Маникюр с покрытием" -> accusative: "маникюр с покрытием", prepositional_na: "маникюре с покрытием"
- "Окрашивание волос" -> accusative: "окрашивание волос", prepositional_na: "окрашивании волос"

Важно: 
- Сохраняй регистр как в оригинале
- Для составных названий склоняй все части правильно
- prepositional_na используется после предлога "на" (записаться НА что?)
`;

      const aiProvider = await this.getAIProvider();
      const result = await aiProvider.call(prompt, {});
      const response = result.text;
      
      // Пытаемся извлечь JSON из ответа
      let declensions;
      try {
        // Ищем JSON в ответе
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          declensions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('JSON not found in response');
        }
      } catch (parseError) {
        logger.error('Failed to parse AI response:', parseError);
        // Возвращаем безопасный fallback
        declensions = this.getFallbackDeclensions(serviceName);
      }

      // Сохраняем в кэш
      this.cache.set(serviceName, declensions);
      
      return declensions;
    } catch (error) {
      logger.error('Error generating declensions:', error);
      return this.getFallbackDeclensions(serviceName);
    }
  }

  /**
   * Генерировать склонения для массива услуг
   * @param {Array<Object>} services - Массив услуг
   * @returns {Promise<Map>} Map с склонениями для каждой услуги
   */
  async generateBatchDeclensions(services) {
    const results = new Map();
    
    // Группируем по 5 услуг для оптимизации
    const chunks = [];
    for (let i = 0; i < services.length; i += 5) {
      chunks.push(services.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const serviceNames = chunk.map(s => s.title).filter(Boolean);
      
      if (serviceNames.length === 0) continue;

      try {
        const prompt = `
Сгенерируй склонения для следующих названий услуг в русском языке.
Верни ТОЛЬКО JSON массив без дополнительного текста.

Услуги:
${serviceNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')}

Формат ответа - JSON массив:
[
  {
    "original": "название услуги",
    "nominative": "именительный",
    "genitive": "родительный",
    "dative": "дательный",
    "accusative": "винительный",
    "instrumental": "творительный",
    "prepositional": "предложный",
    "prepositional_na": "предложный с НА"
  }
]

Важно: prepositional_na - это форма после предлога "на" (записаться НА что?)
`;

        const aiProvider = await this.getAIProvider();
      const result = await aiProvider.call(prompt, {});
      const response = result.text;
        
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const declensionsArray = JSON.parse(jsonMatch[0]);
            
            // Сохраняем результаты
            for (const item of declensionsArray) {
              const service = chunk.find(s => s.title === item.original);
              if (service) {
                results.set(service.id, item);  // Используем service.id вместо yclients_id
                this.cache.set(item.original, item);
              }
            }
          }
        } catch (parseError) {
          logger.error('Failed to parse batch response:', parseError);
          // Fallback для каждой услуги
          for (const service of chunk) {
            results.set(service.id, this.getFallbackDeclensions(service.title));
          }
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error('Error in batch generation:', error);
        // Fallback для всех услуг в chunk
        for (const service of chunk) {
          results.set(service.id, this.getFallbackDeclensions(service.title));
        }
      }
    }

    return results;
  }

  /**
   * Fallback склонения (без изменений)
   */
  getFallbackDeclensions(serviceName) {
    return {
      original: serviceName,
      nominative: serviceName,
      genitive: serviceName,
      dative: serviceName,
      accusative: serviceName,
      instrumental: serviceName,
      prepositional: serviceName,
      prepositional_na: serviceName
    };
  }

  /**
   * Получить нужное склонение для использования в шаблоне
   * @param {Object} service - Объект услуги из БД
   * @param {string} caseType - Тип падежа
   * @returns {string} Склоненное название
   */
  getDeclinedName(service, caseType = 'nominative') {
    // Если есть сохраненные склонения
    if (service.declensions && service.declensions[caseType]) {
      return service.declensions[caseType];
    }
    
    // Иначе возвращаем оригинальное название
    return service.title || service.name || 'услуга';
  }
}

module.exports = new ServiceDeclension();