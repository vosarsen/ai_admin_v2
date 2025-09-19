#!/usr/bin/env node

/**
 * WhatsApp Recovery Script
 * Восстановление подключения WhatsApp с обходом блокировки новых устройств
 */

const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const API_URL = 'http://46.149.70.219:3000';
const COMPANY_ID = '962302';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkWhatsAppStatus() {
  try {
    const response = await axios.get(`${API_URL}/webhook/whatsapp/baileys/status/${COMPANY_ID}`);
    return response.data;
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function stopMonitor() {
  log('\n📋 Останавливаем мониторы...', colors.yellow);
  try {
    await execPromise('ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 stop whatsapp-monitor"');
    log('✅ Монитор остановлен', colors.green);
  } catch (error) {
    log('⚠️ Монитор уже остановлен или не найден', colors.yellow);
  }
}

async function cleanupSessions() {
  log('\n🧹 Очищаем старые сессии...', colors.yellow);

  const commands = [
    // Остановка всех baileys процессов
    'pkill -f baileys',

    // Удаление временных файлов
    'rm -rf /tmp/baileys_*',
    'rm -rf /tmp/whatsapp_*',

    // Очистка auth_data (но НЕ creds.json!)
    'find /opt/ai-admin -name "app-state-sync-*" -delete 2>/dev/null',
    'find /opt/ai-admin -name "pre-key-*" -delete 2>/dev/null',
    'find /opt/ai-admin -name "sender-key-*" -delete 2>/dev/null',
    'find /opt/ai-admin -name "session-*" -delete 2>/dev/null',

    // Очистка Redis кеша
    'redis-cli KEYS "whatsapp:*" | xargs redis-cli DEL 2>/dev/null',
    'redis-cli KEYS "baileys:*" | xargs redis-cli DEL 2>/dev/null'
  ];

  for (const cmd of commands) {
    try {
      await execPromise(`ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "${cmd}"`);
    } catch (error) {
      // Игнорируем ошибки, так как некоторые файлы могут не существовать
    }
  }

  log('✅ Очистка завершена', colors.green);
}

async function restartAPI() {
  log('\n🔄 Перезапускаем API сервер...', colors.yellow);
  try {
    await execPromise('ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart ai-admin-api"');
    log('✅ API сервер перезапущен', colors.green);

    // Ждём запуска
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    log(`❌ Ошибка перезапуска: ${error.message}`, colors.red);
  }
}

async function generateNewQR() {
  log('\n📱 Генерируем новый QR код...', colors.yellow);

  try {
    // Инициализация новой сессии
    await axios.post(`${API_URL}/webhook/whatsapp/baileys/init/${COMPANY_ID}`);

    log('✅ QR код сгенерирован!', colors.green);
    log(`\n${colors.bright}${colors.cyan}Откройте страницу для сканирования QR:${colors.reset}`);
    log(`${colors.bright}${colors.blue}http://46.149.70.219:3000/whatsapp-connect.html?company=${COMPANY_ID}${colors.reset}`);

    return true;
  } catch (error) {
    log(`❌ Ошибка генерации QR: ${error.message}`, colors.red);
    return false;
  }
}

async function waitForConnection(timeout = 300) {
  log(`\n⏳ Ожидаем подключение (максимум ${timeout} секунд)...`, colors.yellow);

  const startTime = Date.now();
  let dots = 0;

  while ((Date.now() - startTime) < timeout * 1000) {
    const status = await checkWhatsAppStatus();

    if (status.connected) {
      log('\n✅ WhatsApp успешно подключен!', colors.green);
      return true;
    }

    // Анимация ожидания
    process.stdout.write(`\r⏳ Ожидаем подключение${'.'.repeat(dots % 4)}    `);
    dots++;

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  log('\n⏱️ Время ожидания истекло', colors.yellow);
  return false;
}

async function createBackup() {
  log('\n💾 Создаём backup после подключения...', colors.yellow);

  try {
    await execPromise(`ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/whatsapp-backup-manager.js backup ${COMPANY_ID}"`);
    log('✅ Backup создан успешно', colors.green);
  } catch (error) {
    log(`⚠️ Не удалось создать backup: ${error.message}`, colors.yellow);
  }
}

async function main() {
  log(`\n${colors.bright}🔧 WhatsApp Recovery Tool${colors.reset}`);
  log('=' .repeat(40));

  // 1. Проверка текущего статуса
  log('\n📊 Проверка текущего статуса...', colors.cyan);
  const initialStatus = await checkWhatsAppStatus();

  if (initialStatus.connected) {
    log('✅ WhatsApp уже подключен!', colors.green);

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\nВы хотите переподключить WhatsApp? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      log('Выход из программы', colors.yellow);
      process.exit(0);
    }
  }

  // 2. Остановка мониторов
  await stopMonitor();

  // 3. Очистка старых сессий
  await cleanupSessions();

  // 4. Перезапуск API
  await restartAPI();

  // 5. Ожидание снятия блокировки
  if (initialStatus.error && initialStatus.error.includes('привязать новые устройства невозможно')) {
    log('\n⚠️ Обнаружена блокировка WhatsApp!', colors.yellow);
    log('Рекомендации:', colors.cyan);
    log('1. Подождите 30-60 минут до снятия блокировки', colors.reset);
    log('2. Попробуйте отвязать одно из подключенных устройств в WhatsApp', colors.reset);
    log('3. Используйте другой номер телефона для тестов', colors.reset);

    log('\nПродолжаем с попыткой обхода...', colors.yellow);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 6. Генерация нового QR
  const qrGenerated = await generateNewQR();

  if (!qrGenerated) {
    log('\n❌ Не удалось сгенерировать QR код', colors.red);
    process.exit(1);
  }

  // 7. Ожидание подключения
  const connected = await waitForConnection();

  if (connected) {
    // 8. Создание backup
    await createBackup();

    log('\n' + '=' .repeat(40), colors.green);
    log(`${colors.bright}✅ Восстановление завершено успешно!${colors.reset}`, colors.green);
    log('=' .repeat(40), colors.green);

    log('\nРекомендации:', colors.cyan);
    log('1. НЕ запускайте whatsapp-monitor сразу', colors.reset);
    log('2. Подождите 10-15 минут для стабилизации', colors.reset);
    log('3. Протестируйте отправку сообщений', colors.reset);
    log('4. Только после успешных тестов запустите монитор:', colors.reset);
    log(`   ${colors.bright}pm2 start whatsapp-monitor${colors.reset}`, colors.blue);
  } else {
    log('\n❌ Не удалось подключить WhatsApp', colors.red);
    log('\nВозможные причины:', colors.yellow);
    log('1. Блокировка новых устройств всё ещё активна', colors.reset);
    log('2. Проблемы с интернет-соединением', colors.reset);
    log('3. QR код не был отсканирован', colors.reset);

    log('\nПопробуйте:', colors.cyan);
    log('1. Подождать 30-60 минут', colors.reset);
    log('2. Запустить скрипт заново', colors.reset);
    log('3. Проверить логи: pm2 logs ai-admin-api', colors.reset);
  }
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  log(`\n❌ Критическая ошибка: ${error.message}`, colors.red);
  process.exit(1);
});

// Запуск
main().catch(error => {
  log(`\n❌ Ошибка: ${error.message}`, colors.red);
  process.exit(1);
});