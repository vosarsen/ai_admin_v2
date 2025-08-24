#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки ServiceMatcher
 * Проверяем, какие услуги возвращаются при разных запросах
 */

require('dotenv').config();

const { supabase } = require('./src/database/supabase');
const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');

async function testServiceMatcher() {
  try {
    console.log('🔍 Загружаем услуги из базы данных...\n');
    
    // Загружаем услуги
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('company_id', 962302)
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Ошибка загрузки услуг:', error);
      return;
    }
    
    console.log(`✅ Загружено ${services.length} услуг\n`);
    
    // Тестовые запросы
    const testQueries = [
      'стрижки',
      'какие стрижки',
      'стрижка',
      'модельная стрижка',
      'мужская стрижка'
    ];
    
    for (const query of testQueries) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 Запрос: "${query}"`);
      console.log(`${'='.repeat(60)}`);
      
      // Ищем топ-20 совпадений
      const matches = serviceMatcher.findTopMatches(query, services, 20);
      
      if (matches.length === 0) {
        console.log('❌ Ничего не найдено');
      } else {
        console.log(`✅ Найдено ${matches.length} услуг:\n`);
        
        // Показываем первые 10 с оценками
        matches.slice(0, 10).forEach((service, index) => {
          const priceStr = service.price_min === service.price_max 
            ? `${service.price_min}₽`
            : `${service.price_min}-${service.price_max}₽`;
          
          console.log(`${index + 1}. ${service.title}`);
          console.log(`   Цена: ${priceStr}`);
          console.log(`   Категория: ${service.category_title || 'не указана'}`);
          console.log(`   Оценка: ${service.score || service.final_score || 0}`);
          console.log();
        });
        
        if (matches.length > 10) {
          console.log(`... и еще ${matches.length - 10} услуг`);
        }
      }
    }
    
    // Дополнительный тест - показать все услуги со словом "стрижка"
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 ВСЕ УСЛУГИ СО СЛОВОМ "СТРИЖКА":');
    console.log(`${'='.repeat(60)}\n`);
    
    const haircuts = services.filter(s => 
      s.title.toLowerCase().includes('стриж')
    );
    
    haircuts.forEach(service => {
      const priceStr = service.price_min === service.price_max 
        ? `${service.price_min}₽`
        : `${service.price_min}-${service.price_max}₽`;
      
      console.log(`• ${service.title} - ${priceStr}`);
      console.log(`  Категория: ${service.category_title || 'не указана'}`);
    });
    
    console.log(`\nВсего найдено: ${haircuts.length} услуг со словом "стрижка"`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    process.exit(0);
  }
}

// Запускаем тест
testServiceMatcher();