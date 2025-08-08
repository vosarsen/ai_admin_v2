#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки синхронизации визитов
 */

require('dotenv').config();
const { supabase } = require('./src/database/supabase');
const VisitsSync = require('./src/sync/visits-sync');
const logger = require('./src/utils/logger').child({ module: 'test-visits-sync' });

async function checkTableExists() {
  try {
    // Пробуем выбрать одну запись
    const { data, error } = await supabase
      .from('visits')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      return false; // Таблица не существует
    }
    
    if (error) {
      logger.warn('Error checking table:', error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

async function getTopClients(limit = 5) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, yclients_id, name, phone, visit_count, total_spent, loyalty_level')
    .eq('company_id', 962302)
    .gt('visit_count', 5)
    .order('visit_count', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw error;
  }
  
  return data;
}

async function main() {
  try {
    console.log('🔍 Проверка готовности к синхронизации визитов\n');
    console.log('='.repeat(60));
    
    // 1. Проверяем наличие таблицы visits
    console.log('\n1️⃣  Проверка таблицы visits...');
    const tableExists = await checkTableExists();
    
    if (!tableExists) {
      console.log('❌ Таблица visits НЕ существует!');
      console.log('\n📝 Для создания таблицы:');
      console.log('   1. Откройте: https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new');
      console.log('   2. Скопируйте содержимое файла: scripts/database/create-visits-table-simple.sql');
      console.log('   3. Вставьте и нажмите "Run"');
      console.log('\n❗ После создания таблицы запустите этот скрипт снова.');
      process.exit(1);
    }
    
    console.log('✅ Таблица visits существует');
    
    // 2. Получаем текущую статистику
    console.log('\n2️⃣  Текущая статистика таблицы visits...');
    const { count: visitsCount } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Записей в таблице: ${visitsCount || 0}`);
    
    // 3. Получаем топ клиентов для тестирования
    console.log('\n3️⃣  Получение клиентов для тестовой синхронизации...');
    const topClients = await getTopClients(5);
    
    console.log(`\n   Найдено ${topClients.length} клиентов с 5+ визитами:`);
    console.log('   ' + '-'.repeat(55));
    
    topClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name.padEnd(20)} | Визитов: ${String(client.visit_count).padStart(2)} | ${client.loyalty_level.padEnd(6)} | ${client.phone}`);
    });
    
    // 4. Предложение запустить синхронизацию
    console.log('\n' + '='.repeat(60));
    console.log('\n🚀 Готово к синхронизации!');
    console.log('\nВарианты запуска:');
    console.log('\n1. Тестовая синхронизация (3 клиента):');
    console.log('   node scripts/sync-visits.js --limit 3\n');
    console.log('2. Синхронизация VIP клиентов:');
    console.log('   node scripts/sync-visits.js --vip\n');
    console.log('3. Синхронизация клиентов с 10+ визитами (первые 20):');
    console.log('   node scripts/sync-visits.js --limit 20 --min-visits 10\n');
    console.log('4. Полная синхронизация всех клиентов:');
    console.log('   node scripts/sync-visits.js\n');
    
    // 5. Запуск тестовой синхронизации
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('\n❓ Запустить тестовую синхронизацию 3 клиентов? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n🔄 Запуск тестовой синхронизации...\n');
        
        const visitsSync = new VisitsSync();
        const result = await visitsSync.syncAll({ limit: 3, minVisits: 5 });
        
        if (result.success) {
          console.log('\n✅ Тестовая синхронизация завершена!');
          console.log(`   Обработано клиентов: ${result.clientsProcessed}`);
          console.log(`   Синхронизировано визитов: ${result.visitsProcessed}`);
          console.log(`   Ошибок: ${result.errors}`);
          console.log(`   Время: ${Math.round(result.duration / 1000)} секунд`);
          
          // Проверяем что записи добавились
          const { count: newCount } = await supabase
            .from('visits')
            .select('*', { count: 'exact', head: true });
          
          console.log(`\n📊 Записей в таблице visits: ${newCount} (было ${visitsCount})`);
          
          // Показываем примеры визитов
          const { data: sampleVisits } = await supabase
            .from('visits')
            .select('client_name, visit_date, service_names, total_cost, staff_name')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (sampleVisits && sampleVisits.length > 0) {
            console.log('\n📋 Последние добавленные визиты:');
            console.log('   ' + '-'.repeat(70));
            sampleVisits.forEach(visit => {
              const services = visit.service_names?.join(', ') || 'Не указано';
              console.log(`   ${visit.visit_date} | ${visit.client_name.padEnd(15)} | ${services.substring(0, 30).padEnd(30)} | ${visit.total_cost}₽`);
            });
          }
        } else {
          console.log('\n❌ Ошибка синхронизации:', result.error);
        }
      } else {
        console.log('\n👋 Синхронизация отменена');
      }
      
      readline.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});