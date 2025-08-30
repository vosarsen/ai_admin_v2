#!/usr/bin/env node

/**
 * Быстрое восстановление склонений для имен мастеров
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const logger = require('../src/utils/logger').child({ module: 'fix-staff-declensions' });

// Функция для генерации простых склонений по правилам русского языка
function generateSimpleDeclensions(staffName) {
  const name = staffName.trim();
  
  // Несклоняемые имена (заканчиваются на -и, -о, -е, -у и восточные имена)
  const indeclinable = ['Али', 'Бари', 'Рами', 'Нури', 'Ари'];
  if (indeclinable.includes(name) || /[иоеуюэ]$/i.test(name)) {
    return {
      original: name,
      nominative: name,
      genitive: name,
      dative: name,
      accusative: name,
      instrumental: name,
      prepositional: name,
      prepositional_u: `у ${name}`
    };
  }
  
  // Женские имена на -а
  if (/а$/i.test(name)) {
    const stem = name.slice(0, -1);
    return {
      original: name,
      nominative: name,
      genitive: stem + 'ы',
      dative: stem + 'е',
      accusative: stem + 'у',
      instrumental: stem + 'ой',
      prepositional: stem + 'е',
      prepositional_u: `у ${stem + 'ы'}`
    };
  }
  
  // Женские имена на -я (не после шипящих)
  if (/я$/i.test(name) && !/[жшчщ]я$/i.test(name)) {
    const stem = name.slice(0, -1);
    return {
      original: name,
      nominative: name,
      genitive: stem + 'и',
      dative: stem + 'е',
      accusative: stem + 'ю',
      instrumental: stem + 'ей',
      prepositional: stem + 'е',
      prepositional_u: `у ${stem + 'и'}`
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
  
  // Мужские имена на -ь
  if (/ь$/i.test(name)) {
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
  return {
    original: name,
    nominative: name,
    genitive: name,
    dative: name,
    accusative: name,
    instrumental: name,
    prepositional: name,
    prepositional_u: `у ${name}`
  };
}

// Специальные правила для конкретных имен
const specialDeclensions = {
  'Сергей': {
    original: 'Сергей',
    nominative: 'Сергей',
    genitive: 'Сергея',
    dative: 'Сергею',
    accusative: 'Сергея',
    instrumental: 'Сергеем',
    prepositional: 'Сергее',
    prepositional_u: 'у Сергея'
  },
  'Алексей': {
    original: 'Алексей',
    nominative: 'Алексей',
    genitive: 'Алексея',
    dative: 'Алексею',
    accusative: 'Алексея',
    instrumental: 'Алексеем',
    prepositional: 'Алексее',
    prepositional_u: 'у Алексея'
  },
  'Дарья': {
    original: 'Дарья',
    nominative: 'Дарья',
    genitive: 'Дарьи',
    dative: 'Дарье',
    accusative: 'Дарью',
    instrumental: 'Дарьей',
    prepositional: 'Дарье',
    prepositional_u: 'у Дарьи'
  },
  'Илья': {
    original: 'Илья',
    nominative: 'Илья',
    genitive: 'Ильи',
    dative: 'Илье',
    accusative: 'Илью',
    instrumental: 'Ильёй',
    prepositional: 'Илье',
    prepositional_u: 'у Ильи'
  }
};

async function main() {
  try {
    logger.info('🚀 Starting quick staff declensions fix...');
    
    // Получаем всех мастеров
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, yclients_id, name')
      .eq('company_id', 962302);
    
    if (error) {
      throw error;
    }
    
    if (!staff || staff.length === 0) {
      logger.info('No staff found');
      return;
    }
    
    logger.info(`📋 Found ${staff.length} staff members`);
    
    let updated = 0;
    let errors = 0;
    
    // Обновляем склонения для каждого мастера
    for (const member of staff) {
      if (!member.name) continue;
      
      try {
        // Используем специальные правила или генерируем автоматически
        const declensions = specialDeclensions[member.name] || generateSimpleDeclensions(member.name);
        
        // Сохраняем в БД
        const { error: updateError } = await supabase
          .from('staff')
          .update({ declensions })
          .eq('id', member.id);
        
        if (updateError) {
          logger.error(`Failed to update staff ${member.id}:`, updateError);
          errors++;
        } else {
          updated++;
          logger.info(`✅ Updated: "${member.name}"`);
          console.log(`  Родительный: ${declensions.genitive}`);
          console.log(`  У кого: ${declensions.prepositional_u}`);
        }
        
      } catch (error) {
        logger.error(`Error processing staff ${member.id}:`, error);
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