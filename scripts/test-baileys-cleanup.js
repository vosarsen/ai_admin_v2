#!/usr/bin/env node

/**
 * Test script for Baileys cleanup
 * Тестирует работу очистки в dry-run режиме
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=' .repeat(60));
console.log('🧪 Testing Baileys Cleanup Script');
console.log('=' .repeat(60));

// Проверяем существование скрипта
const scriptPath = path.join(__dirname, 'baileys-multitenancy-cleanup.js');
if (!fs.existsSync(scriptPath)) {
  console.error('❌ Cleanup script not found at:', scriptPath);
  process.exit(1);
}

console.log('✅ Script found at:', scriptPath);

// Тестируем help
console.log('\n📖 Testing --help flag:');
console.log('-'.repeat(40));
try {
  const helpOutput = execSync(`node ${scriptPath} --help`, { encoding: 'utf8' });
  console.log(helpOutput);
} catch (error) {
  console.error('❌ Failed to run help:', error.message);
}

// Тестируем dry-run локально
console.log('\n🔍 Testing --dry-run mode locally:');
console.log('-'.repeat(40));

// Создаем тестовую структуру папок если не существует
const testSessionsPath = path.join(__dirname, '../baileys_sessions');
const testCompanyPath = path.join(testSessionsPath, 'company_test');

if (!fs.existsSync(testCompanyPath)) {
  console.log('📁 Creating test directory structure...');
  fs.mkdirSync(testSessionsPath, { recursive: true });
  fs.mkdirSync(testCompanyPath, { recursive: true });

  // Создаем тестовые файлы
  fs.writeFileSync(path.join(testCompanyPath, 'creds.json'), '{"test": true}');
  fs.writeFileSync(path.join(testCompanyPath, 'app-state-sync-1.json'), '{}');
  fs.writeFileSync(path.join(testCompanyPath, 'lid-mapping-1.json'), '{}');

  // Создаем старые файлы для теста удаления
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 дней назад

  for (let i = 1; i <= 5; i++) {
    const sessionFile = path.join(testCompanyPath, `session-test-${i}.json`);
    fs.writeFileSync(sessionFile, '{}');
    fs.utimesSync(sessionFile, oldDate, oldDate); // Устанавливаем старую дату
  }

  // Создаем новые файлы
  for (let i = 6; i <= 10; i++) {
    fs.writeFileSync(path.join(testCompanyPath, `session-test-${i}.json`), '{}');
  }

  // Pre-keys для теста
  for (let i = 1; i <= 60; i++) {
    fs.writeFileSync(path.join(testCompanyPath, `pre-key-${i}.json`), '{}');
  }

  console.log('✅ Test files created');
}

// Запускаем dry-run
try {
  console.log('\n🚀 Running cleanup in dry-run mode...\n');
  const output = execSync(`node ${scriptPath} --dry-run --verbose`, {
    encoding: 'utf8',
    env: { ...process.env, BAILEYS_SESSIONS_PATH: testSessionsPath }
  });
  console.log(output);

  console.log('\n✅ Dry-run completed successfully!');

  // Проверяем что файлы не удалились
  const remainingFiles = fs.readdirSync(testCompanyPath);
  console.log(`\n📁 Files still present: ${remainingFiles.length}`);

} catch (error) {
  console.error('❌ Dry-run failed:', error.message);
  if (error.stdout) console.log('Output:', error.stdout.toString());
  if (error.stderr) console.error('Error:', error.stderr.toString());
}

console.log('\n' + '=' .repeat(60));
console.log('🎉 Test completed!');
console.log('=' .repeat(60));

console.log('\n💡 Next steps:');
console.log('1. Deploy script to server: scp scripts/baileys-multitenancy-cleanup.js root@46.149.70.219:/opt/ai-admin/scripts/');
console.log('2. Test on server: ssh root@46.149.70.219 "cd /opt/ai-admin && node scripts/baileys-multitenancy-cleanup.js --dry-run"');
console.log('3. Setup cron if results are good');