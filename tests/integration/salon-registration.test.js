#!/usr/bin/env node
/**
 * Тест регистрации нового салона через маркетплейс
 *
 * Проверяет:
 * 1. Upsert компании с company_id
 * 2. Создание записи в БД
 * 3. Очистку тестовых данных
 *
 * Использование:
 *   node tests/manual/marketplace/test-salon-registration.js
 *   node tests/manual/marketplace/test-salon-registration.js --keep  # не удалять тестовые данные
 */

require('dotenv').config();

const TEST_SALON_ID = 999999; // Тестовый ID салона (не существует в YClients)

async function main() {
  const keepData = process.argv.includes('--keep');

  console.log('\n🧪 Тест регистрации салона через маркетплейс\n');
  console.log(`Тестовый salon_id: ${TEST_SALON_ID}`);
  console.log(`Режим: ${keepData ? 'сохранить данные' : 'очистить после теста'}\n`);

  // Инициализация
  const postgres = require('../../src/database/postgres');
  const { CompanyRepository, MarketplaceEventsRepository } = require('../../src/repositories');

  const companyRepository = new CompanyRepository(postgres);
  const marketplaceEventsRepository = new MarketplaceEventsRepository(postgres);

  try {
    // 1. Проверяем подключение к БД
    console.log('1️⃣  Проверка подключения к PostgreSQL...');
    await postgres.query('SELECT 1');
    console.log('   ✅ Подключение успешно\n');

    // 2. Проверяем что salon_id не занят
    console.log('2️⃣  Проверка что тестовый salon_id свободен...');
    const existing = await companyRepository.findByYclientsId(TEST_SALON_ID);
    if (existing) {
      console.log(`   ⚠️  Салон ${TEST_SALON_ID} уже существует (id=${existing.id})`);
      console.log('   Удаляем для чистого теста...');
      await postgres.query('DELETE FROM companies WHERE yclients_id = $1', [TEST_SALON_ID]);
      console.log('   ✅ Удалён\n');
    } else {
      console.log('   ✅ Свободен\n');
    }

    // 3. Тест upsertByYclientsId (ГЛАВНЫЙ ТЕСТ)
    console.log('3️⃣  Тест upsertByYclientsId с company_id...');

    const salonIdInt = TEST_SALON_ID;
    const testData = {
      yclients_id: salonIdInt,
      company_id: salonIdInt, // ВАЖНО: это исправление которое мы добавили
      title: `Тестовый салон ${TEST_SALON_ID}`,
      phone: '+79001234567',
      email: 'test@example.com',
      address: 'Тестовый адрес',
      timezone: 'Europe/Moscow',
      integration_status: 'pending_whatsapp',
      marketplace_user_id: 'test_user_123',
      marketplace_user_name: 'Тест Модератор',
      marketplace_user_phone: '+79001234567',
      marketplace_user_email: 'moderator@test.com',
      whatsapp_connected: false,
      connected_at: new Date().toISOString()
    };

    console.log('   Данные для upsert:', JSON.stringify(testData, null, 2));

    let company;
    try {
      company = await companyRepository.upsertByYclientsId(testData);
      console.log('\n   ✅ Upsert успешен!');
      console.log(`   Создана компания: id=${company.id}, yclients_id=${company.yclients_id}, company_id=${company.company_id}`);
    } catch (error) {
      console.log('\n   ❌ ОШИБКА upsert:', error.message);
      if (error.message.includes('company_id')) {
        console.log('\n   💡 Похоже company_id не передаётся или NULL');
        console.log('   Проверьте что исправление в yclients-marketplace.js задеплоено!');
      }
      throw error;
    }

    // 4. Проверяем запись
    console.log('\n4️⃣  Проверка созданной записи...');
    const saved = await companyRepository.findByYclientsId(TEST_SALON_ID);

    if (!saved) {
      throw new Error('Запись не найдена после upsert!');
    }

    const checks = [
      { field: 'yclients_id', expected: TEST_SALON_ID, actual: saved.yclients_id },
      { field: 'company_id', expected: TEST_SALON_ID, actual: saved.company_id },
      { field: 'title', expected: testData.title, actual: saved.title },
      { field: 'integration_status', expected: 'pending_whatsapp', actual: saved.integration_status },
    ];

    let allPassed = true;
    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`   ✅ ${check.field}: ${check.actual}`);
      } else {
        console.log(`   ❌ ${check.field}: ${check.actual} (ожидалось ${check.expected})`);
        allPassed = false;
      }
    }

    // 5. Тест обновления (upsert существующей записи)
    console.log('\n5️⃣  Тест обновления существующей записи...');
    const updateData = {
      ...testData,
      title: `Обновлённый салон ${TEST_SALON_ID}`,
      integration_status: 'active'
    };

    const updated = await companyRepository.upsertByYclientsId(updateData);

    if (updated.title === updateData.title && updated.integration_status === 'active') {
      console.log('   ✅ Обновление успешно');
      console.log(`   title: ${updated.title}`);
      console.log(`   integration_status: ${updated.integration_status}`);
    } else {
      console.log('   ❌ Обновление не применилось');
      allPassed = false;
    }

    // 6. Тест события маркетплейса
    console.log('\n6️⃣  Тест записи события маркетплейса...');
    const event = await marketplaceEventsRepository.insert({
      company_id: company.id,
      salon_id: TEST_SALON_ID,
      event_type: 'test_registration',
      event_data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    if (event && event.id) {
      console.log(`   ✅ Событие создано: id=${event.id}`);
    } else {
      console.log('   ❌ Событие не создано');
      allPassed = false;
    }

    // 7. Очистка (если не --keep)
    if (!keepData) {
      console.log('\n7️⃣  Очистка тестовых данных...');

      // Удаляем события (CASCADE должен сработать, но на всякий случай)
      await postgres.query('DELETE FROM marketplace_events WHERE salon_id = $1', [TEST_SALON_ID]);
      console.log('   ✅ События удалены');

      // Удаляем компанию
      await postgres.query('DELETE FROM companies WHERE yclients_id = $1', [TEST_SALON_ID]);
      console.log('   ✅ Компания удалена');
    } else {
      console.log('\n7️⃣  Данные сохранены (--keep режим)');
    }

    // Итог
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
      console.log('Регистрация салона через маркетплейс работает корректно.');
    } else {
      console.log('⚠️  НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ');
      process.exit(1);
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.error(error.stack);

    // Попытка очистки при ошибке
    if (!keepData) {
      try {
        console.log('\nПопытка очистки тестовых данных...');
        await postgres.query('DELETE FROM marketplace_events WHERE salon_id = $1', [TEST_SALON_ID]);
        await postgres.query('DELETE FROM companies WHERE yclients_id = $1', [TEST_SALON_ID]);
        console.log('Очистка выполнена');
      } catch (cleanupError) {
        console.log('Ошибка очистки:', cleanupError.message);
      }
    }

    process.exit(1);
  } finally {
    // Закрываем пул соединений
    await postgres.end();
  }
}

main();
