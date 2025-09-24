#!/usr/bin/env node

/**
 * Генерация склонений для существующих услуг в БД
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const axios = require('axios');
const logger = require('../src/utils/logger').child({ module: 'generate-declensions' });

async function generateDeclensions(serviceName) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  const prompt = `
Сгенерируй склонения для названия услуги "${serviceName}" в русском языке.
Верни ТОЛЬКО JSON объект без дополнительного текста в формате:
{
  "original": "${serviceName}",
  "nominative": "именительный",
  "genitive": "родительный",
  "dative": "дательный",
  "accusative": "винительный",
  "instrumental": "творительный",
  "prepositional": "предложный",
  "prepositional_na": "винительный для НА"
}

Примеры:
- "Мужская стрижка" -> accusative: "мужскую стрижку", prepositional_na: "мужскую стрижку"
- "Маникюр с покрытием" -> accusative: "маникюр с покрытием", prepositional_na: "маникюр с покрытием"

Важно: prepositional_na - это ВИНИТЕЛЬНЫЙ падеж для предлога "на" (записаться НА что?)
`;

  try {
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const aiResponse = response.data.choices[0].message.content;
    
    // Извлекаем JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.error(`Failed to generate declensions for "${serviceName}":`, error.message);
  }
  
  // Fallback - возвращаем без изменений
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

async function main() {
  try {
    logger.info('🚀 Starting declension generation for existing services...');
    
    // Получаем все услуги без склонений
    const { data: services, error } = await supabase
      .from('services')
      .select('id, yclients_id, title, declensions')
      .is('declensions', null)
      .eq('company_id', process.env.YCLIENTS_COMPANY_ID || 962302);
    
    if (error) {
      throw error;
    }
    
    if (!services || services.length === 0) {
      logger.info('No services without declensions found');
      return;
    }
    
    logger.info(`📋 Found ${services.length} services without declensions`);
    
    let processed = 0;
    let errors = 0;
    
    // Обрабатываем по одной услуге с задержкой
    for (const service of services) {
      if (!service.title) continue;
      
      logger.info(`Processing: "${service.title}"`);
      
      try {
        // Генерируем склонения
        const declensions = await generateDeclensions(service.title);
        
        // Сохраняем в БД
        const { error: updateError } = await supabase
          .from('services')
          .update({ declensions })
          .eq('id', service.id);
        
        if (updateError) {
          logger.error(`Failed to update service ${service.id}:`, updateError);
          errors++;
        } else {
          processed++;
          logger.info(`✅ Updated: "${service.title}"`);
          
          // Показываем результат
          console.log(`  Винительный: ${declensions.accusative}`);
          console.log(`  Предложный с НА: ${declensions.prepositional_na}`);
        }
        
        // Задержка между запросами к AI
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`Error processing service ${service.id}:`, error);
        errors++;
      }
    }
    
    logger.info(`✅ Completed: ${processed} processed, ${errors} errors`);
    
  } catch (error) {
    logger.error('❌ Failed:', error);
    process.exit(1);
  }
}

main();