#!/usr/bin/env node

/**
 * Скрипт для создания индекса на raw_phone в таблице clients
 * Запуск: node scripts/database/apply-raw-phone-index.js
 */

const { supabase } = require('../../src/database/supabase');
const fs = require('fs').promises;
const path = require('path');

async function applyIndex() {
  console.log('🔧 Применение индекса на raw_phone...');
  
  try {
    // Читаем SQL скрипт
    const sqlPath = path.join(__dirname, 'create-index-raw-phone.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Выполняем SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sql 
    });
    
    if (error) {
      // Если RPC функция не существует, попробуем другой способ
      console.log('⚠️  RPC метод недоступен. Пожалуйста, выполните SQL вручную через Supabase Dashboard.');
      console.log('\n📋 SQL для выполнения:');
      console.log('-------------------');
      console.log(sql);
      console.log('-------------------');
      return;
    }
    
    console.log('✅ Индекс успешно создан!');
    console.log('📊 Результат:', data);
    
  } catch (error) {
    console.error('❌ Ошибка при создании индекса:', error.message);
    console.log('\n💡 Совет: Выполните SQL скрипт вручную через Supabase Dashboard');
  }
}

// Запускаем
applyIndex();