/**
 * Генерация склонений для имен мастеров с использованием AI
 * Генерирует склонения при синхронизации и сохраняет в БД
 */

const logger = require('../../utils/logger').child({ module: 'staff-declension' });
const providerFactory = require('../ai/provider-factory');

class StaffDeclension {
  constructor() {
    this.aiProvider = null;
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
   * Генерировать склонения для имени мастера
   * @param {string} staffName - Имя мастера в именительном падеже
   * @returns {Promise<Object>} Объект со склонениями
   */
  async generateDeclensions(staffName) {
    try {
      // Проверяем кэш
      if (this.cache.has(staffName)) {
        return this.cache.get(staffName);
      }

      const prompt = `
Сгенерируй склонения для имени мастера "${staffName}" в русском языке.
Верни ТОЛЬКО JSON объект без дополнительного текста в формате:
{
  "nominative": "${staffName}",
  "genitive": "родительный падеж (кого?)",
  "dative": "дательный падеж (кому?)",
  "accusative": "винительный падеж (кого?)",
  "instrumental": "творительный падеж (кем?)",
  "prepositional": "предложный падеж (о ком?)",
  "prepositional_u": "у кого? (у + родительный падеж)"
}

Примеры:
- "Сергей" -> genitive: "Сергея", dative: "Сергею", prepositional_u: "у Сергея"
- "Дарья" -> genitive: "Дарьи", dative: "Дарье", prepositional_u: "у Дарьи"
- "Бари" -> все падежи: "Бари", prepositional_u: "у Бари" (несклоняемое имя)
- "Али" -> все падежи: "Али", prepositional_u: "у Али" (несклоняемое имя)

Важно: 
- Иностранные и некоторые восточные имена могут быть несклоняемыми
- Для несклоняемых имен используй одну форму во всех падежах
- prepositional_u всегда начинается с "у "
`;

      const aiProvider = await this.getAIProvider();
      const result = await aiProvider.call(prompt, {});
      const response = result.text;
      
      // Пытаемся извлечь JSON из ответа
      let declensions;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          declensions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('JSON not found in response');
        }
      } catch (parseError) {
        logger.error('Failed to parse AI response:', parseError);
        // Возвращаем безопасный fallback
        declensions = this.getFallbackDeclensions(staffName);
      }

      // Сохраняем в кэш
      this.cache.set(staffName, declensions);
      
      return declensions;
    } catch (error) {
      logger.error('Error generating declensions:', error);
      return this.getFallbackDeclensions(staffName);
    }
  }

  /**
   * Генерировать склонения для массива мастеров
   * @param {Array<Object>} staffMembers - Массив мастеров
   * @returns {Promise<Map>} Map с склонениями для каждого мастера
   */
  async generateBatchDeclensions(staffMembers) {
    const results = new Map();
    
    // Группируем по 5 мастеров для оптимизации
    const chunks = [];
    for (let i = 0; i < staffMembers.length; i += 5) {
      chunks.push(staffMembers.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const staffNames = chunk.map(s => s.name).filter(Boolean);
      
      if (staffNames.length === 0) continue;

      try {
        const prompt = `
Сгенерируй склонения для следующих имен мастеров в русском языке.
Верни ТОЛЬКО JSON массив без дополнительного текста.

Имена:
${staffNames.map((name, i) => `${i + 1}. "${name}"`).join('\n')}

Формат ответа - JSON массив:
[
  {
    "original": "имя мастера",
    "nominative": "именительный",
    "genitive": "родительный",
    "dative": "дательный",
    "accusative": "винительный",
    "instrumental": "творительный",
    "prepositional": "предложный",
    "prepositional_u": "у + родительный падеж"
  }
]

Важно: 
- Несклоняемые имена (Али, Бари) оставь без изменений во всех падежах
- prepositional_u всегда начинается с "у " (например, "у Сергея", "у Али")
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
              const staff = chunk.find(s => s.name === item.original);
              if (staff) {
                results.set(staff.id, item);
                this.cache.set(item.original, item);
              }
            }
          }
        } catch (parseError) {
          logger.error('Failed to parse batch response:', parseError);
          // Fallback для каждого мастера
          for (const staff of chunk) {
            results.set(staff.id, this.getFallbackDeclensions(staff.name));
          }
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error('Error in batch generation:', error);
        // Fallback для всех мастеров в chunk
        for (const staff of chunk) {
          results.set(staff.id, this.getFallbackDeclensions(staff.name));
        }
      }
    }

    return results;
  }

  /**
   * Fallback склонения (без изменений)
   */
  getFallbackDeclensions(staffName) {
    return {
      original: staffName,
      nominative: staffName,
      genitive: staffName,
      dative: staffName,
      accusative: staffName,
      instrumental: staffName,
      prepositional: staffName,
      prepositional_u: `у ${staffName}`
    };
  }

  /**
   * Простая эвристика для определения склонений без AI
   * Используется как быстрый fallback
   */
  getSimpleDeclensions(staffName) {
    const name = staffName.trim();
    
    // Несклоняемые имена (заканчиваются на -и, -о, -е, -у и т.д.)
    if (/[иоеуюя]$/i.test(name) && !/(ий|ия|ей|ья)$/i.test(name)) {
      return this.getFallbackDeclensions(name);
    }
    
    // Женские имена на -а/-я
    if (/[ая]$/i.test(name) && !/(ий|ой|ый)$/i.test(name)) {
      const stem = name.slice(0, -1);
      const lastChar = name.slice(-1);
      const softSign = lastChar === 'я';
      
      return {
        original: name,
        nominative: name,
        genitive: stem + (softSign ? 'и' : 'ы'),
        dative: stem + 'е',
        accusative: stem + 'у',
        instrumental: stem + 'ой',
        prepositional: stem + 'е',
        prepositional_u: `у ${stem + (softSign ? 'и' : 'ы')}`
      };
    }
    
    // Мужские имена на согласную
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(name)) {
      return {
        original: name,
        nominative: name,
        genitive: name + 'а',
        dative: name + 'у',
        accusative: name + 'а',
        instrumental: name + 'ом',
        prepositional: name + 'е',
        prepositional_u: `у ${name + 'а'}`
      };
    }
    
    // Мужские имена на -й
    if (/й$/i.test(name)) {
      const stem = name.slice(0, -1);
      return {
        original: name,
        nominative: name,
        genitive: stem + 'я',
        dative: stem + 'ю',
        accusative: stem + 'я',
        instrumental: stem + 'ем',
        prepositional: stem + 'е',
        prepositional_u: `у ${stem + 'я'}`
      };
    }
    
    // По умолчанию - несклоняемое
    return this.getFallbackDeclensions(name);
  }
}

module.exports = new StaffDeclension();