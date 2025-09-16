#!/usr/bin/env node

/**
 * Скрипт для добавления WhatsApp колонок в таблицу companies
 */

require('dotenv').config();
const { supabase } = require('../src/database/supabase');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

console.log(chalk.blue.bold('\n🔄 Применение миграции WhatsApp колонок\n'));

async function checkExistingColumns() {
  console.log(chalk.cyan('Проверка существующих колонок...'));

  try {
    // Пробуем выбрать одну запись с новыми колонками
    const { data, error } = await supabase
      .from('companies')
      .select('id, whatsapp_connected, whatsapp_phone, integration_status')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log(chalk.yellow('⚠️  Колонки WhatsApp отсутствуют'));
        return false;
      }
      throw error;
    }

    console.log(chalk.green('✅ Колонки WhatsApp уже существуют'));
    return true;
  } catch (error) {
    if (error.message?.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}

async function applyMigration() {
  console.log(chalk.cyan('\n📝 Применение миграции...\n'));

  // Читаем SQL файл
  const sqlPath = path.join(__dirname, 'database', 'add-whatsapp-columns.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  console.log(chalk.yellow('SQL миграция подготовлена:'));
  console.log(chalk.gray('----------------------------------------'));
  console.log(chalk.gray(sqlContent.substring(0, 500) + '...'));
  console.log(chalk.gray('----------------------------------------\n'));

  console.log(chalk.red.bold('⚠️  ВАЖНО: Миграцию нужно применить вручную!\n'));

  console.log(chalk.yellow('Инструкция по применению:\n'));
  console.log(chalk.white('1. Откройте Supabase Dashboard:'));
  console.log(chalk.cyan('   https://supabase.com/dashboard/project/yazteodihdglhoxgqunp/sql\n'));

  console.log(chalk.white('2. Скопируйте и выполните следующий SQL:'));
  console.log(chalk.gray('----------------------------------------'));
  console.log(chalk.green(`
-- Добавление колонок для WhatsApp интеграции
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
  `));
  console.log(chalk.gray('----------------------------------------\n'));

  console.log(chalk.white('3. Нажмите кнопку "Run" для выполнения\n'));

  console.log(chalk.yellow('Альтернативный вариант - через API (экспериментально):'));
  console.log(chalk.cyan('   Можно попробовать добавить колонки через обновление записей\n'));
}

async function testNewColumns() {
  console.log(chalk.cyan('Тестирование новых колонок...\n'));

  try {
    // Пробуем обновить тестовую запись
    const { data, error } = await supabase
      .from('companies')
      .update({
        whatsapp_connected: false,
        whatsapp_phone: null,
        integration_status: 'pending'
      })
      .eq('id', 1)
      .select();

    if (error) {
      console.log(chalk.red('❌ Ошибка при обновлении:'), error.message);
      return false;
    }

    console.log(chalk.green('✅ Колонки успешно работают!'));
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Ошибка:'), error.message);
    return false;
  }
}

async function showCurrentSchema() {
  console.log(chalk.cyan('\n📊 Текущая схема таблицы companies:\n'));

  try {
    // Получаем одну запись для анализа структуры
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(chalk.white('Существующие колонки:'));
      columns.forEach(col => {
        const value = data[0][col];
        const type = value === null ? 'NULL' : typeof value;
        console.log(chalk.gray(`  - ${col}: ${type}`));
      });

      // Проверяем наличие WhatsApp колонок
      const whatsappColumns = [
        'whatsapp_connected',
        'whatsapp_phone',
        'whatsapp_connected_at',
        'integration_status',
        'connected_at'
      ];

      console.log(chalk.cyan('\n🔍 Проверка WhatsApp колонок:'));
      whatsappColumns.forEach(col => {
        if (columns.includes(col)) {
          console.log(chalk.green(`  ✅ ${col} - существует`));
        } else {
          console.log(chalk.red(`  ❌ ${col} - отсутствует`));
        }
      });
    }
  } catch (error) {
    console.log(chalk.red('Ошибка получения схемы:'), error.message);
  }
}

// Главная функция
async function main() {
  try {
    // Показываем текущую схему
    await showCurrentSchema();

    // Проверяем существующие колонки
    const columnsExist = await checkExistingColumns();

    if (columnsExist) {
      console.log(chalk.green.bold('\n✅ Миграция не требуется - колонки уже существуют!\n'));

      // Тестируем работу
      await testNewColumns();
    } else {
      console.log(chalk.yellow.bold('\n⚠️  Требуется применить миграцию!\n'));

      // Показываем инструкции
      await applyMigration();
    }

    console.log(chalk.blue.bold('\n✨ Проверка завершена!\n'));

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Ошибка:'), error);
    process.exit(1);
  }
}

// Запуск
main();