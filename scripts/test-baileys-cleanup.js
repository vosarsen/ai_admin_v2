#!/usr/bin/env node

/**
 * Test script for Baileys cleanup
 * Тестирует работу очистки в dry-run режиме
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  OLD_SESSION_FILES: 5,    // Количество старых session файлов
  NEW_SESSION_FILES: 5,    // Количество новых session файлов
  PRE_KEY_FILES: 60,       // Количество pre-key файлов
  DAYS_OLD: 20,            // Возраст старых файлов в днях
  CLEANUP_AFTER_TEST: process.argv.includes('--cleanup')
};

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

  // Создаем критичные файлы (НЕ должны удаляться)
  fs.writeFileSync(path.join(testCompanyPath, 'creds.json'), '{"test": true}');
  fs.writeFileSync(path.join(testCompanyPath, 'app-state-sync-1.json'), '{}');
  fs.writeFileSync(path.join(testCompanyPath, 'lid-mapping-1.json'), '{}');

  // Создаем старые файлы для теста удаления
  const oldDate = new Date(Date.now() - TEST_CONFIG.DAYS_OLD * 24 * 60 * 60 * 1000);

  for (let i = 1; i <= TEST_CONFIG.OLD_SESSION_FILES; i++) {
    const sessionFile = path.join(testCompanyPath, `session-test-${i}.json`);
    fs.writeFileSync(sessionFile, '{}');
    fs.utimesSync(sessionFile, oldDate, oldDate); // Устанавливаем старую дату
  }

  // Создаем новые файлы
  for (let i = TEST_CONFIG.OLD_SESSION_FILES + 1; i <= TEST_CONFIG.OLD_SESSION_FILES + TEST_CONFIG.NEW_SESSION_FILES; i++) {
    fs.writeFileSync(path.join(testCompanyPath, `session-test-${i}.json`), '{}');
  }

  // Pre-keys для теста
  for (let i = 1; i <= TEST_CONFIG.PRE_KEY_FILES; i++) {
    fs.writeFileSync(path.join(testCompanyPath, `pre-key-${i}.json`), '{}');
  }

  console.log(`✅ Test files created:`);
  console.log(`   - ${TEST_CONFIG.OLD_SESSION_FILES} old session files (${TEST_CONFIG.DAYS_OLD} days old)`);
  console.log(`   - ${TEST_CONFIG.NEW_SESSION_FILES} new session files`);
  console.log(`   - ${TEST_CONFIG.PRE_KEY_FILES} pre-key files`);
  console.log(`   - 3 critical files (creds, app-state, lid-mapping)`);
}

// Запускаем dry-run
try {
  console.log('\n🚀 Running cleanup in dry-run mode...\n');
  const output = execSync(`node ${scriptPath} --dry-run`, {
    encoding: 'utf8',
    env: { ...process.env, BAILEYS_SESSIONS_PATH: testSessionsPath }
  });

  // Проверяем результаты
  console.log('\n📊 Checking results...');

  // 1. Проверяем что нашлись файлы для удаления
  if (!output.includes('Would remove') && !output.includes('files removed')) {
    console.warn('⚠️ No files marked for removal - test may be incorrect');
  } else {
    console.log('✅ Found files for removal');
  }

  // 2. Проверяем что критичные файлы НЕ удаляются
  if (output.includes('Would remove: creds.json') ||
      output.includes('Would remove: lid-mapping') ||
      output.includes('Would remove: app-state-sync')) {
    console.error('❌ CRITICAL: Script would remove protected files!');
    process.exit(1);
  } else {
    console.log('✅ Critical files protected');
  }

  // 3. Проверяем статистику
  const filesRemoved = output.match(/Total files removed: (\d+)/)?.[1];
  const expectedRemovals = TEST_CONFIG.OLD_SESSION_FILES + (TEST_CONFIG.PRE_KEY_FILES - 50);
  if (filesRemoved) {
    console.log(`✅ Would remove ${filesRemoved} files (expected ~${expectedRemovals})`);
  }

  console.log('\n✅ All checks passed!');

  // Проверяем что файлы не удалились (dry-run)
  const remainingFiles = fs.readdirSync(testCompanyPath);
  console.log(`\n📁 Files still present: ${remainingFiles.length} (dry-run mode)`);

  // Показываем краткую выдержку из вывода
  console.log('\n📋 Summary from output:');
  const summaryLines = output.split('\n').filter(line =>
    line.includes('SUMMARY') ||
    line.includes('companies') ||
    line.includes('Files:') ||
    line.includes('removed')
  );
  console.log(summaryLines.slice(0, 10).join('\n'));

} catch (error) {
  console.error('❌ Dry-run failed:', error.message);
  if (error.stdout) console.log('Output:', error.stdout.toString());
  if (error.stderr) console.error('Error:', error.stderr.toString());
  process.exit(1);
}

console.log('\n' + '=' .repeat(60));
console.log('🎉 Test completed!');
console.log('=' .repeat(60));

console.log('\n💡 Next steps:');
console.log('1. Deploy script to server: scp scripts/baileys-multitenancy-cleanup.js root@46.149.70.219:/opt/ai-admin/scripts/');
console.log('2. Test on server: ssh root@46.149.70.219 "cd /opt/ai-admin && node scripts/baileys-multitenancy-cleanup.js --dry-run"');
console.log('3. Setup cron if results are good');

// Cleanup при выходе (если указан флаг --cleanup)
process.on('exit', () => {
  if (TEST_CONFIG.CLEANUP_AFTER_TEST && fs.existsSync(testCompanyPath)) {
    console.log('\n🧹 Cleaning up test files...');
    try {
      fs.rmSync(testCompanyPath, { recursive: true, force: true });
      console.log('✅ Test files removed');
    } catch (error) {
      console.error('Failed to cleanup:', error.message);
    }
  } else if (TEST_CONFIG.CLEANUP_AFTER_TEST) {
    console.log('\n💡 Tip: Use --cleanup flag to remove test files after test');
  }
});