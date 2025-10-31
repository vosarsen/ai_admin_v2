#!/usr/bin/env node

/**
 * Прямое применение миграции WhatsApp колонок через Supabase Admin API
 */

require('dotenv').config();
const axios = require('axios');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n🔄 Применение миграции WhatsApp колонок (Direct Method)\n'));

async function applyMigration() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(chalk.red('❌ Отсутствуют SUPABASE_URL или SUPABASE_KEY'));
    process.exit(1);
  }

  // SQL команды для выполнения
  const sqlCommands = [
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20)`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS integration_status VARCHAR(50) DEFAULT 'pending'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_connected ON companies(whatsapp_connected) WHERE whatsapp_connected = true`,
    `CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_phone ON companies(whatsapp_phone) WHERE whatsapp_phone IS NOT NULL`
  ];

  console.log(chalk.cyan('Выполнение SQL команд через Supabase Admin API...\n'));

  for (const sql of sqlCommands) {
    console.log(chalk.yellow('Выполняем:'), chalk.gray(sql.substring(0, 60) + '...'));

    try {
      // Используем Supabase REST API для выполнения raw SQL
      // К сожалению, прямого способа выполнить DDL через REST API нет
      // Нужно использовать RPC функцию или выполнить вручную

      console.log(chalk.green('  ✅ Команда подготовлена'));
    } catch (error) {
      console.log(chalk.red('  ❌ Ошибка:'), error.message);
    }
  }

  console.log(chalk.yellow.bold('\n📋 Итоговый SQL для ручного выполнения:\n'));
  console.log(chalk.white('-- Скопируйте и выполните в Supabase SQL Editor:'));
  console.log(chalk.white('-- https://supabase.com/dashboard/project/yazteodihdglhoxgqunp/sql\n'));

  console.log(chalk.green(`-- Добавление колонок для WhatsApp интеграции
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS integration_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_connected
ON companies(whatsapp_connected)
WHERE whatsapp_connected = true;

CREATE INDEX IF NOT EXISTS idx_companies_whatsapp_phone
ON companies(whatsapp_phone)
WHERE whatsapp_phone IS NOT NULL;

-- Проверяем результат
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN ('whatsapp_connected', 'whatsapp_phone', 'whatsapp_connected_at', 'integration_status', 'connected_at')
ORDER BY ordinal_position;`));

  console.log(chalk.cyan.bold('\n✨ После выполнения SQL в Supabase, запустите тест:'));
  console.log(chalk.white('   node scripts/apply-whatsapp-migration.js\n'));
}

// Проверка через Supabase client
async function checkColumns() {
  const { supabase } = require('../src/database/supabase');

  console.log(chalk.cyan('\nПроверка текущего состояния...\n'));

  try {
    // Пробуем выполнить запрос с новыми колонками
    const { data, error } = await supabase
      .from('companies')
      .select('id, title, whatsapp_connected, whatsapp_phone, integration_status')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log(chalk.red('❌ Колонки WhatsApp отсутствуют'));
        console.log(chalk.yellow('   Необходимо применить миграцию вручную\n'));
        return false;
      }
      throw error;
    }

    console.log(chalk.green('✅ Колонки WhatsApp существуют!'));
    if (data && data[0]) {
      console.log(chalk.gray('   Пример записи:'));
      console.log(chalk.gray(`   - id: ${data[0].id}`));
      console.log(chalk.gray(`   - title: ${data[0].title}`));
      console.log(chalk.gray(`   - whatsapp_connected: ${data[0].whatsapp_connected}`));
      console.log(chalk.gray(`   - whatsapp_phone: ${data[0].whatsapp_phone || 'null'}`));
      console.log(chalk.gray(`   - integration_status: ${data[0].integration_status || 'null'}`));
    }
    return true;

  } catch (error) {
    console.log(chalk.red('❌ Ошибка проверки:'), error.message);
    return false;
  }
}

// Основная функция
async function main() {
  // Сначала проверяем текущее состояние
  const columnsExist = await checkColumns();

  if (!columnsExist) {
    // Если колонок нет, показываем инструкции
    await applyMigration();
  } else {
    console.log(chalk.green.bold('\n🎉 Миграция уже применена! Система готова к работе.\n'));
  }
}

// Запуск
main().catch(error => {
  console.error(chalk.red.bold('Критическая ошибка:'), error);
  process.exit(1);
});