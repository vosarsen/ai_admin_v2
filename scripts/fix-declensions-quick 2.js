#!/usr/bin/env node

/**
 * Быстрое восстановление склонений для основных услуг
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'fix-declensions' });

// Предопределенные склонения для самых частых услуг
const predefinedDeclensions = {
  "МУЖСКАЯ СТРИЖКА": {
    original: "МУЖСКАЯ СТРИЖКА",
    nominative: "мужская стрижка",
    genitive: "мужской стрижки",
    dative: "мужской стрижке",
    accusative: "мужскую стрижку",
    instrumental: "мужской стрижкой",
    prepositional: "мужской стрижке",
    prepositional_na: "мужской стрижке"
  },
  "ДЕТСКАЯ СТРИЖКА": {
    original: "ДЕТСКАЯ СТРИЖКА",
    nominative: "детская стрижка",
    genitive: "детской стрижки",
    dative: "детской стрижке",
    accusative: "детскую стрижку",
    instrumental: "детской стрижкой",
    prepositional: "детской стрижке",
    prepositional_na: "детской стрижке"
  },
  "СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)": {
    original: "СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)",
    nominative: "стрижка бороды и усов",
    genitive: "стрижки бороды и усов",
    dative: "стрижке бороды и усов",
    accusative: "стрижку бороды и усов",
    instrumental: "стрижкой бороды и усов",
    prepositional: "стрижке бороды и усов",
    prepositional_na: "стрижке бороды и усов"
  },
  "МОДЕЛИРОВАНИЕ БОРОДЫ": {
    original: "МОДЕЛИРОВАНИЕ БОРОДЫ",
    nominative: "моделирование бороды",
    genitive: "моделирования бороды",
    dative: "моделированию бороды",
    accusative: "моделирование бороды",
    instrumental: "моделированием бороды",
    prepositional: "моделировании бороды",
    prepositional_na: "моделировании бороды"
  },
  "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ": {
    original: "СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ",
    nominative: "стрижка и моделирование бороды",
    genitive: "стрижки и моделирования бороды",
    dative: "стрижке и моделированию бороды",
    accusative: "стрижку и моделирование бороды",
    instrumental: "стрижкой и моделированием бороды",
    prepositional: "стрижке и моделировании бороды",
    prepositional_na: "стрижке и моделировании бороды"
  },
  "СТРИЖКА МАШИНКОЙ | 1 НАСАДКА": {
    original: "СТРИЖКА МАШИНКОЙ | 1 НАСАДКА",
    nominative: "стрижка машинкой",
    genitive: "стрижки машинкой",
    dative: "стрижке машинкой",
    accusative: "стрижку машинкой",
    instrumental: "стрижкой машинкой",
    prepositional: "стрижке машинкой",
    prepositional_na: "стрижке машинкой"
  },
  "СТРИЖКА НОЖНИЦАМИ": {
    original: "СТРИЖКА НОЖНИЦАМИ",
    nominative: "стрижка ножницами",
    genitive: "стрижки ножницами",
    dative: "стрижке ножницами",
    accusative: "стрижку ножницами",
    instrumental: "стрижкой ножницами",
    prepositional: "стрижке ножницами",
    prepositional_na: "стрижке ножницами"
  },
  "БРИТЬЁ ГОЛОВЫ": {
    original: "БРИТЬЁ ГОЛОВЫ",
    nominative: "бритьё головы",
    genitive: "бритья головы",
    dative: "бритью головы",
    accusative: "бритьё головы",
    instrumental: "бритьём головы",
    prepositional: "бритье головы",
    prepositional_na: "бритье головы"
  },
  "КУЛЬТУРНОЕ БРИТЬЁ": {
    original: "КУЛЬТУРНОЕ БРИТЬЁ",
    nominative: "культурное бритьё",
    genitive: "культурного бритья",
    dative: "культурному бритью",
    accusative: "культурное бритьё",
    instrumental: "культурным бритьём",
    prepositional: "культурном бритье",
    prepositional_na: "культурном бритье"
  },
  "ВОСК": {
    original: "ВОСК",
    nominative: "воск",
    genitive: "воска",
    dative: "воску",
    accusative: "воск",
    instrumental: "воском",
    prepositional: "воске",
    prepositional_na: "воске"
  },
  "ВОСК КОМПЛЕКС": {
    original: "ВОСК КОМПЛЕКС",
    nominative: "воск комплекс",
    genitive: "воск комплекса",
    dative: "воск комплексу",
    accusative: "воск комплекс",
    instrumental: "воск комплексом",
    prepositional: "воск комплексе",
    prepositional_na: "воск комплексе"
  },
  "УКЛАДКА": {
    original: "УКЛАДКА",
    nominative: "укладка",
    genitive: "укладки",
    dative: "укладке",
    accusative: "укладку",
    instrumental: "укладкой",
    prepositional: "укладке",
    prepositional_na: "укладке"
  },
  "ОКАНТОВКА ГОЛОВЫ | БОРОДЫ": {
    original: "ОКАНТОВКА ГОЛОВЫ | БОРОДЫ",
    nominative: "окантовка головы или бороды",
    genitive: "окантовки головы или бороды",
    dative: "окантовке головы или бороды",
    accusative: "окантовку головы или бороды",
    instrumental: "окантовкой головы или бороды",
    prepositional: "окантовке головы или бороды",
    prepositional_na: "окантовке головы или бороды"
  }
};

// Функция для генерации простых склонений по шаблону
function generateSimpleDeclensions(title) {
  const lowerTitle = title.toLowerCase();
  
  // Для услуг со словом "стрижка"
  if (lowerTitle.includes('стрижка')) {
    const prefix = lowerTitle.replace(/стрижка.*/, '').trim();
    return {
      original: title,
      nominative: lowerTitle,
      genitive: lowerTitle.replace(/стрижка/, 'стрижки'),
      dative: lowerTitle.replace(/стрижка/, 'стрижке'),
      accusative: lowerTitle.replace(/стрижка/, 'стрижку').replace(/ая/, 'ую').replace(/яя/, 'юю'),
      instrumental: lowerTitle.replace(/стрижка/, 'стрижкой'),
      prepositional: lowerTitle.replace(/стрижка/, 'стрижке'),
      prepositional_na: lowerTitle.replace(/стрижка/, 'стрижке')
    };
  }
  
  // Для остальных - используем как есть
  return {
    original: title,
    nominative: lowerTitle,
    genitive: lowerTitle,
    dative: lowerTitle,
    accusative: lowerTitle,
    instrumental: lowerTitle,
    prepositional: lowerTitle,
    prepositional_na: lowerTitle
  };
}

async function main() {
  try {
    logger.info('🚀 Starting quick declensions fix...');
    
    // Получаем все услуги
    const { data: services, error } = await supabase
      .from('services')
      .select('id, yclients_id, title')
      .eq('company_id', 962302);
    
    if (error) {
      throw error;
    }
    
    if (!services || services.length === 0) {
      logger.info('No services found');
      return;
    }
    
    logger.info(`📋 Found ${services.length} services`);
    
    let updated = 0;
    let errors = 0;
    
    // Обновляем склонения для каждой услуги
    for (const service of services) {
      if (!service.title) continue;
      
      try {
        // Используем предопределенные склонения или генерируем простые
        const declensions = predefinedDeclensions[service.title] || generateSimpleDeclensions(service.title);
        
        // Сохраняем в БД
        const { error: updateError } = await supabase
          .from('services')
          .update({ declensions })
          .eq('id', service.id);
        
        if (updateError) {
          logger.error(`Failed to update service ${service.id}:`, updateError);
          errors++;
        } else {
          updated++;
          logger.info(`✅ Updated: "${service.title}"`);
          if (declensions.accusative !== service.title.toLowerCase()) {
            console.log(`  Винительный: ${declensions.accusative}`);
            console.log(`  Предложный с НА: ${declensions.prepositional_na}`);
          }
        }
        
      } catch (error) {
        logger.error(`Error processing service ${service.id}:`, error);
        errors++;
      }
    }
    
    logger.info(`✅ Completed: ${updated} updated, ${errors} errors`);
    
  } catch (error) {
    logger.error('❌ Failed:', error);
    process.exit(1);
  }
}

main();