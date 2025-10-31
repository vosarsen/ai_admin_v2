#!/usr/bin/env node

/**
 * WhatsApp Pairing Code Authentication
 * Использует код сопряжения вместо QR для обхода блокировки привязки устройств
 *
 * Основано на официальной документации Baileys:
 * https://github.com/WhiskeySockets/Baileys
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для чтения ввода пользователя
function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Конфигурация
const COMPANY_ID = process.argv[2] || '962302';
const USE_PAIRING_CODE = true; // Использовать код сопряжения вместо QR
const REMOTE_PATH = '/opt/ai-admin';
const LOCAL_PATH = process.cwd();

async function initializeWithPairingCode() {
  log(`\n${colors.bright}🔐 WhatsApp Pairing Code Authentication${colors.reset}`);
  log('=' .repeat(50));
  log(`Company ID: ${colors.cyan}${COMPANY_ID}${colors.reset}\n`);

  // Создаем папку для сессии
  const sessionPath = path.join(LOCAL_PATH, 'sessions', `company_${COMPANY_ID}`);
  await fs.mkdir(sessionPath, { recursive: true });

  // Загружаем состояние аутентификации
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  // Получаем последнюю версию Baileys
  const { version } = await fetchLatestBaileysVersion();
  log(`📦 Using Baileys version: ${colors.cyan}${version.join('.')}${colors.reset}`);

  // Создаем сокет
  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
    },
    browser: ['AI Admin Bot', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 10_000,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
  });

  // Сохраняем креды при обновлении
  sock.ev.on('creds.update', saveCreds);

  // Если не зарегистрирован и используем pairing code
  if (USE_PAIRING_CODE && !sock.authState.creds.registered) {
    log(`\n${colors.yellow}📱 Для подключения через код сопряжения:${colors.reset}`);
    log(`1. Откройте WhatsApp на телефоне`);
    log(`2. Перейдите в Настройки → Связанные устройства`);
    log(`3. Нажмите "Привязать устройство"`);
    log(`4. Выберите "Привязать с помощью номера телефона"`);
    log(`5. Введите полученный код\n`);

    // Запрашиваем номер телефона
    let phoneNumber = await question(`${colors.cyan}Введите номер телефона (например, 79686484488): ${colors.reset}`);

    // Форматируем номер
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber.startsWith('7') && phoneNumber.length === 10) {
      phoneNumber = '7' + phoneNumber;
    }

    log(`\n⏳ Запрашиваем код сопряжения для ${colors.bright}+${phoneNumber}${colors.reset}...`);

    try {
      // Запрашиваем pairing code
      const code = await sock.requestPairingCode(phoneNumber);

      // Форматируем код для удобства (XXXX-XXXX)
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

      log(`\n${colors.bright}${colors.green}✅ Код сопряжения получен!${colors.reset}`);
      log(`\n${colors.bright}${colors.magenta}📱 ВАШ КОД: ${formattedCode}${colors.reset}`);
      log(`\n${colors.yellow}Введите этот код в WhatsApp на телефоне${colors.reset}`);
      log(`${colors.yellow}У вас есть 60 секунд${colors.reset}\n`);

    } catch (error) {
      log(`${colors.red}❌ Ошибка получения кода: ${error.message}${colors.reset}`);

      if (error.message.includes('rate')) {
        log(`\n${colors.yellow}⚠️ Превышен лимит запросов кодов${colors.reset}`);
        log(`Подождите 30-60 минут перед повторной попыткой`);
      }

      process.exit(1);
    }
  }

  // Обработка обновлений подключения
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Если все же показывается QR (не должно при pairing code)
      log(`\n${colors.yellow}⚠️ Получен QR код (не ожидался при использовании pairing code)${colors.reset}`);
    }

    if (connection === 'close') {
      const disconnectReason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = (disconnectReason !== DisconnectReason.loggedOut);

      log(`\n${colors.red}🔌 Соединение закрыто${colors.reset}`);
      log(`Причина: ${disconnectReason}`);

      if (disconnectReason === DisconnectReason.loggedOut) {
        log(`${colors.red}❌ Сессия разлогинена${colors.reset}`);
        process.exit(0);
      } else if (shouldReconnect) {
        log(`${colors.yellow}🔄 Переподключение...${colors.reset}`);
        // Baileys автоматически переподключится
      }
    } else if (connection === 'open') {
      log(`\n${colors.bright}${colors.green}✅ WhatsApp успешно подключен!${colors.reset}`);
      log(`${colors.cyan}📱 Номер: ${sock.user?.id}${colors.reset}`);

      // Успешное подключение - копируем на сервер
      await syncToServer(sessionPath);

      // Тестовое сообщение
      const testPhone = await question(`\n${colors.cyan}Введите номер для тестового сообщения (или Enter для пропуска): ${colors.reset}`);

      if (testPhone) {
        try {
          const formattedPhone = formatPhoneForWhatsApp(testPhone);
          await sock.sendMessage(formattedPhone, { text: '✅ Тестовое сообщение от AI Admin Bot' });
          log(`${colors.green}✅ Тестовое сообщение отправлено!${colors.reset}`);
        } catch (error) {
          log(`${colors.red}❌ Ошибка отправки: ${error.message}${colors.reset}`);
        }
      }

      // Graceful shutdown
      setTimeout(() => {
        log(`\n${colors.yellow}Закрываем соединение...${colors.reset}`);
        sock.end();
        process.exit(0);
      }, 5000);
    } else if (connection === 'connecting') {
      log(`${colors.yellow}🔄 Подключение...${colors.reset}`);
    }
  });

  // Обработка сообщений (для теста)
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
      log(`\n${colors.cyan}📨 Получено сообщение от ${msg.key.remoteJid}${colors.reset}`);
    }
  });

  // Обработка ошибок
  sock.ev.on('error', (error) => {
    log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
  });
}

// Форматирование номера для WhatsApp
function formatPhoneForWhatsApp(phone) {
  let cleanPhone = phone.replace(/\D/g, '');

  if (!cleanPhone.startsWith('7') && cleanPhone.length === 10) {
    cleanPhone = '7' + cleanPhone;
  }

  return cleanPhone + '@s.whatsapp.net';
}

// Синхронизация сессии на сервер
async function syncToServer(sessionPath) {
  log(`\n${colors.yellow}📤 Синхронизация сессии на сервер...${colors.reset}`);

  try {
    // Создаем директорию на сервере
    await execPromise(`ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "mkdir -p ${REMOTE_PATH}/sessions/company_${COMPANY_ID}"`);

    // Копируем файлы сессии
    await execPromise(`scp -i ~/.ssh/id_ed25519_ai_admin -r ${sessionPath}/* root@46.149.70.219:${REMOTE_PATH}/sessions/company_${COMPANY_ID}/`);

    log(`${colors.green}✅ Сессия синхронизирована на сервер${colors.reset}`);

    // Перезапускаем API
    log(`${colors.yellow}🔄 Перезапускаем API сервер...${colors.reset}`);
    await execPromise(`ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart ai-admin-api"`);

    log(`${colors.green}✅ API сервер перезапущен${colors.reset}`);

  } catch (error) {
    log(`${colors.red}❌ Ошибка синхронизации: ${error.message}${colors.reset}`);
  }
}

// Главная функция
async function main() {
  try {
    log(`\n${colors.bright}${colors.cyan}WhatsApp Pairing Code Authentication Tool${colors.reset}`);
    log(`${colors.cyan}Решение проблемы "linking new devices is not possible"${colors.reset}\n`);

    log(`${colors.yellow}ℹ️ Этот метод использует код сопряжения вместо QR${colors.reset}`);
    log(`${colors.yellow}ℹ️ Он обходит блокировку привязки новых устройств${colors.reset}`);
    log(`${colors.yellow}ℹ️ Рекомендован официальной документацией Baileys${colors.reset}\n`);

    await initializeWithPairingCode();

  } catch (error) {
    log(`\n${colors.red}❌ Критическая ошибка: ${error.message}${colors.reset}`);
    console.error(error);
    process.exit(1);
  }
}

// Обработка сигналов
process.on('SIGINT', () => {
  log(`\n${colors.yellow}Получен сигнал прерывания${colors.reset}`);
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  log(`\n${colors.red}❌ Необработанная ошибка: ${error.message}${colors.reset}`);
  console.error(error);
  process.exit(1);
});

// Запуск
main();