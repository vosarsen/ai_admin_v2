#!/usr/bin/env node

/**
 * Скрипт для создания таблицы visits в Supabase
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createVisitsTable() {
  try {
    console.log('📋 Creating visits table in Supabase...\n');
    
    // Читаем SQL файл
    const sqlPath = path.join(__dirname, 'database', 'create-visits-table.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Разбиваем на отдельные команды (по точке с запятой)
    const commands = sqlContent
      .split(/;[\s\n]+/)
      .filter(cmd => cmd.trim().length > 0 && !cmd.trim().startsWith('--'))
      .map(cmd => cmd.trim() + ';');
    
    console.log(`Found ${commands.length} SQL commands to execute\n`);
    
    // Выполняем команды по одной
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Пропускаем комментарии и пустые строки
      if (command.startsWith('--') || command.trim().length === 0) {
        continue;
      }
      
      // Показываем что выполняем
      const cmdPreview = command.substring(0, 50).replace(/\n/g, ' ');
      console.log(`[${i+1}/${commands.length}] Executing: ${cmdPreview}...`);
      
      // Используем RPC для выполнения raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        query: command
      }).single();
      
      if (error) {
        // Если функция exec_sql не существует, пробуем альтернативный метод
        if (error.message?.includes('exec_sql')) {
          console.log('⚠️  exec_sql function not found, trying alternative method...');
          
          // Для простых запросов можем использовать Supabase API
          if (command.includes('CREATE TABLE')) {
            console.log('✅ Table creation command prepared');
            console.log('\n📝 Please execute this SQL manually in Supabase Dashboard:');
            console.log('   https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new');
            console.log('\n' + '='.repeat(60));
            console.log(command.substring(0, 500) + '...');
            console.log('='.repeat(60) + '\n');
          }
        } else {
          console.error(`❌ Error executing command ${i+1}:`, error.message);
        }
      } else {
        console.log(`✅ Command ${i+1} executed successfully`);
      }
    }
    
    // Проверяем что таблица создана
    console.log('\n🔍 Checking if visits table exists...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('visits')
      .select('id')
      .limit(1);
    
    if (tablesError && tablesError.code === '42P01') {
      console.log('\n❌ Table "visits" does not exist yet.');
      console.log('\n📝 Please create it manually via Supabase Dashboard:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new');
      console.log('   2. Copy content from: scripts/database/create-visits-table.sql');
      console.log('   3. Paste and click "Run"\n');
    } else if (tablesError) {
      console.log('⚠️  Could not verify table:', tablesError.message);
    } else {
      console.log('✅ Table "visits" exists!');
      
      // Получаем количество записей
      const { count } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Current records in visits table: ${count || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Альтернативный метод - вывод SQL для ручного выполнения
async function printSqlForManualExecution() {
  const sqlPath = path.join(__dirname, 'database', 'create-visits-table.sql');
  const sqlContent = await fs.readFile(sqlPath, 'utf8');
  
  console.log('\n' + '='.repeat(70));
  console.log('COPY THIS SQL TO SUPABASE DASHBOARD:');
  console.log('='.repeat(70) + '\n');
  console.log(sqlContent);
  console.log('\n' + '='.repeat(70));
  console.log('Go to: https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new');
  console.log('='.repeat(70) + '\n');
}

// Запуск
createVisitsTable().catch(async (error) => {
  console.error('Failed to create table automatically.');
  await printSqlForManualExecution();
});