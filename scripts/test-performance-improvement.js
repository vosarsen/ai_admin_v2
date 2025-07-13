#!/usr/bin/env node
// Тестирование улучшения производительности после индексов

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testPerformance() {
  console.log('🚀 Тестирование производительности AI Admin v2\n');
  
  const companyId = process.env.YCLIENTS_COMPANY_ID || 962302;
  const testPhone = '79001234567';
  
  // Тест 1: Загрузка услуг
  console.log('1️⃣ Тест загрузки услуг компании...');
  const servicesStart = Date.now();
  
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('weight', { ascending: false })
    .limit(20);
    
  const servicesTime = Date.now() - servicesStart;
  console.log(`✅ Загружено ${services?.length || 0} услуг за ${servicesTime}ms\n`);
  
  // Тест 2: Поиск клиента
  console.log('2️⃣ Тест поиска клиента по телефону...');
  const clientStart = Date.now();
  
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', testPhone)
    .eq('company_id', companyId)
    .single();
    
  const clientTime = Date.now() - clientStart;
  console.log(`✅ Клиент ${client ? 'найден' : 'не найден'} за ${clientTime}ms\n`);
  
  // Тест 3: Загрузка мастеров
  console.log('3️⃣ Тест загрузки активных мастеров...');
  const staffStart = Date.now();
  
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(10);
    
  const staffTime = Date.now() - staffStart;
  console.log(`✅ Загружено ${staff?.length || 0} мастеров за ${staffTime}ms\n`);
  
  // Тест 4: Загрузка расписания
  console.log('4️⃣ Тест загрузки расписания на сегодня...');
  const scheduleStart = Date.now();
  
  const today = new Date().toISOString().split('T')[0];
  const { data: schedules, error: scheduleError } = await supabase
    .from('staff_schedules')
    .select('*')
    .eq('date', today)
    .eq('is_working', true);
    
  const scheduleTime = Date.now() - scheduleStart;
  console.log(`✅ Загружено ${schedules?.length || 0} расписаний за ${scheduleTime}ms\n`);
  
  // Тест 5: Полная загрузка контекста
  console.log('5️⃣ Тест полной загрузки контекста (все данные параллельно)...');
  const contextStart = Date.now();
  
  const [companyData, clientData, servicesData, staffData, schedulesData] = await Promise.all([
    supabase.from('companies').select('*').eq('company_id', companyId).single(),
    supabase.from('clients').select('*').eq('phone', testPhone).eq('company_id', companyId).single(),
    supabase.from('services').select('*').eq('company_id', companyId).eq('is_active', true).order('weight', { ascending: false }).limit(20),
    supabase.from('staff').select('*').eq('company_id', companyId).eq('is_active', true).order('rating', { ascending: false }).limit(10),
    supabase.from('staff_schedules').select('*').eq('date', today).eq('is_working', true)
  ]);
  
  const contextTime = Date.now() - contextStart;
  console.log(`✅ Полный контекст загружен за ${contextTime}ms\n`);
  
  // Итоговая статистика
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('─'.repeat(40));
  console.log(`Услуги:            ${servicesTime}ms`);
  console.log(`Поиск клиента:     ${clientTime}ms`);
  console.log(`Мастера:           ${staffTime}ms`);
  console.log(`Расписание:        ${scheduleTime}ms`);
  console.log(`Полный контекст:   ${contextTime}ms`);
  console.log('─'.repeat(40));
  
  const totalSequential = servicesTime + clientTime + staffTime + scheduleTime;
  const improvement = Math.round((totalSequential - contextTime) / totalSequential * 100);
  
  console.log(`\n✨ Параллельная загрузка быстрее на ${improvement}%`);
  
  // Ожидаемые результаты
  console.log('\n📈 Ожидаемые результаты после индексов:');
  console.log('- Каждый запрос: < 50ms (было 100-500ms)');
  console.log('- Полный контекст: < 200ms (было 500-1500ms)');
  console.log('- С Redis кэшем: < 10ms на повторные запросы');
}

// Запуск тестов
testPerformance().catch(console.error);