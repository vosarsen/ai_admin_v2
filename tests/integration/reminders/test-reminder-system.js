#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки системы напоминаний через booking-monitor
 *
 * Использование:
 * node test-reminder-system.js [check|simulate|status|logs]
 *
 * Команды:
 * - check: Проверить текущие записи и какие напоминания должны быть отправлены
 * - simulate: Симулировать отправку напоминания (создать тестовую запись)
 * - status: Проверить статус booking-monitor
 * - logs: Показать последние напоминания из БД
 */

require('dotenv').config();
const logger = require('./src/utils/logger');
const { supabase } = require('./src/database/supabase');
const { YclientsClient } = require('./src/integrations/yclients/client');
const config = require('./src/config');
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

const command = process.argv[2] || 'check';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const formatDate = (date) => {
  const d = new Date(date);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

async function checkCurrentBookings() {
  console.log(`${colors.bright}${colors.blue}🔍 Проверка текущих записей и напоминаний...${colors.reset}\n`);

  try {
    const yclientsClient = new YclientsClient();
    const companyId = config.yclients.companyId;

    // Получаем записи на сегодня и завтра
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDateForAPI = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    console.log(`📅 Дата проверки: ${formatDateForAPI(today)}`);
    console.log(`📅 Завтра: ${formatDateForAPI(tomorrow)}\n`);

    const result = await yclientsClient.getRecords(companyId, {
      start_date: formatDateForAPI(today),
      end_date: formatDateForAPI(tomorrow)
    });

    if (!result.success || !result.data || result.data.length === 0) {
      console.log(`${colors.yellow}⚠️ Записей не найдено${colors.reset}`);
      return;
    }

    console.log(`${colors.green}✅ Найдено записей: ${result.data.length}${colors.reset}\n`);

    const now = new Date();
    const currentHour = now.getHours();

    for (const record of result.data) {
      const recordDate = new Date(record.datetime);
      const hoursUntil = (recordDate - now) / (1000 * 60 * 60);
      const isToday = recordDate.toDateString() === now.toDateString();
      const isTomorrow = recordDate.toDateString() === tomorrow.toDateString();

      console.log(`${colors.bright}📌 Запись #${record.id}${colors.reset}`);
      console.log(`   Клиент: ${record.client?.name || 'Не указан'} (${record.client?.phone || 'нет телефона'})`);
      console.log(`   Дата/время: ${formatDate(recordDate)} ${formatTime(recordDate)}`);
      console.log(`   Услуги: ${record.services?.map(s => s.title).join(', ') || 'Не указано'}`);
      console.log(`   Мастер: ${record.staff?.name || 'Не указан'}`);
      console.log(`   Статус: ${record.attendance === -1 ? '❌ Отменена' : record.attendance === 1 ? '✅ Пришел' : '⏳ Ожидается'}`);

      // Проверяем условия для напоминаний
      if (record.attendance !== -1 && record.attendance !== 1 && record.client?.phone) {
        console.log(`   ${colors.cyan}Напоминания:${colors.reset}`);

        // Напоминание за день
        if (isTomorrow && currentHour >= 19 && currentHour <= 21) {
          console.log(`   ${colors.green}✉️ Должно быть отправлено напоминание за день (19-21ч)${colors.reset}`);
        } else if (isTomorrow) {
          console.log(`   ${colors.yellow}⏰ Напоминание за день будет в 19-21ч${colors.reset}`);
        }

        // Напоминание за 2 часа
        if (isToday && hoursUntil <= 2.5 && hoursUntil >= 1.5) {
          console.log(`   ${colors.green}✉️ Должно быть отправлено напоминание за 2 часа${colors.reset}`);
        } else if (isToday && hoursUntil > 2.5) {
          console.log(`   ${colors.yellow}⏰ Напоминание за 2 часа будет за ${Math.round(hoursUntil - 2)}ч${colors.reset}`);
        }

        // Проверяем отправленные напоминания
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const { data: sentReminders } = await supabase
          .from('booking_notifications')
          .select('notification_type, sent_at')
          .eq('yclients_record_id', record.id.toString())
          .in('notification_type', ['reminder_day_before', 'reminder_2hours'])
          .gte('sent_at', yesterday.toISOString());

        if (sentReminders && sentReminders.length > 0) {
          console.log(`   ${colors.magenta}📬 Отправленные:${colors.reset}`);
          for (const reminder of sentReminders) {
            const sentTime = new Date(reminder.sent_at);
            console.log(`      - ${reminder.notification_type}: ${sentTime.toLocaleString('ru-RU')}`);
          }
        }
      }

      console.log('');
    }

  } catch (error) {
    console.error(`${colors.red}❌ Ошибка при проверке записей:${colors.reset}`, error);
  }
}

async function simulateReminder() {
  console.log(`${colors.bright}${colors.blue}🧪 Симуляция отправки напоминания...${colors.reset}\n`);

  try {
    // Генерируем тестовые данные
    const testData = {
      name: 'Тест Клиент',
      service: 'мужскую стрижку',
      time: '15:00',
      staff: 'Сергей',
      price: 2000,
      address: 'ул. Культуры 15/11'
    };

    console.log(`${colors.cyan}📝 Тестовые данные:${colors.reset}`);
    console.log(`   Имя: ${testData.name}`);
    console.log(`   Услуга: ${testData.service}`);
    console.log(`   Время: ${testData.time}`);
    console.log(`   Мастер: ${testData.staff}\n`);

    // Генерируем напоминание за день
    const dayBeforeMessage = generateDayBeforeReminder(testData);
    console.log(`${colors.green}📨 Напоминание за день:${colors.reset}`);
    console.log(`${dayBeforeMessage}\n`);
    console.log('-'.repeat(50) + '\n');

    // Генерируем напоминание за 2 часа
    const twoHoursMessage = generateTwoHoursReminder(testData);
    console.log(`${colors.green}📨 Напоминание за 2 часа:${colors.reset}`);
    console.log(`${twoHoursMessage}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Ошибка при симуляции:${colors.reset}`, error);
  }
}

async function checkStatus() {
  console.log(`${colors.bright}${colors.blue}📊 Статус системы напоминаний${colors.reset}\n`);

  try {
    // Проверяем последние напоминания
    const { data: recentNotifications, error } = await supabase
      .from('booking_notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    console.log(`${colors.cyan}📬 Последние 10 напоминаний:${colors.reset}\n`);

    if (!recentNotifications || recentNotifications.length === 0) {
      console.log(`${colors.yellow}   Напоминаний пока не отправлялось${colors.reset}`);
    } else {
      for (const notification of recentNotifications) {
        const sentDate = new Date(notification.sent_at);
        const type = notification.notification_type === 'reminder_day_before' ?
          '📅 За день' :
          notification.notification_type === 'reminder_2hours' ?
          '⏰ За 2 часа' :
          '📨 ' + notification.notification_type;

        console.log(`${type} | ${sentDate.toLocaleString('ru-RU')}`);
        console.log(`   Телефон: ${notification.phone}`);
        console.log(`   ID записи: ${notification.yclients_record_id}`);
        if (notification.message) {
          console.log(`   Сообщение: ${notification.message.substring(0, 100)}...`);
        }
        console.log('');
      }
    }

    // Статистика
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayStats } = await supabase
      .from('booking_notifications')
      .select('notification_type')
      .gte('sent_at', today.toISOString())
      .in('notification_type', ['reminder_day_before', 'reminder_2hours']);

    const dayBeforeCount = todayStats?.filter(n => n.notification_type === 'reminder_day_before').length || 0;
    const twoHoursCount = todayStats?.filter(n => n.notification_type === 'reminder_2hours').length || 0;

    console.log(`${colors.bright}📊 Статистика за сегодня:${colors.reset}`);
    console.log(`   Напоминаний за день: ${dayBeforeCount}`);
    console.log(`   Напоминаний за 2 часа: ${twoHoursCount}`);
    console.log(`   Всего: ${dayBeforeCount + twoHoursCount}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ Ошибка при проверке статуса:${colors.reset}`, error);
  }
}

async function showLogs() {
  console.log(`${colors.bright}${colors.blue}📜 Последние логи напоминаний${colors.reset}\n`);

  try {
    const { data: logs, error } = await supabase
      .from('booking_notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    if (!logs || logs.length === 0) {
      console.log(`${colors.yellow}Логов напоминаний не найдено${colors.reset}`);
      return;
    }

    // Группируем по дням
    const logsByDate = {};
    logs.forEach(log => {
      const date = new Date(log.sent_at).toLocaleDateString('ru-RU');
      if (!logsByDate[date]) {
        logsByDate[date] = [];
      }
      logsByDate[date].push(log);
    });

    for (const [date, dateLogs] of Object.entries(logsByDate)) {
      console.log(`${colors.bright}📅 ${date}${colors.reset}`);

      for (const log of dateLogs) {
        const time = new Date(log.sent_at).toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const type = log.notification_type === 'reminder_day_before' ? '📅' : '⏰';

        console.log(`  ${time} ${type} → ${log.phone} (ID: ${log.yclients_record_id})`);
      }
      console.log('');
    }

  } catch (error) {
    console.error(`${colors.red}❌ Ошибка при получении логов:${colors.reset}`, error);
  }
}

// Главная функция
async function main() {
  console.log(`\n${colors.bright}${colors.magenta}========================================`);
  console.log(`     ТЕСТ СИСТЕМЫ НАПОМИНАНИЙ`);
  console.log(`========================================${colors.reset}\n`);

  switch (command) {
    case 'check':
      await checkCurrentBookings();
      break;
    case 'simulate':
      await simulateReminder();
      break;
    case 'status':
      await checkStatus();
      break;
    case 'logs':
      await showLogs();
      break;
    default:
      console.log(`${colors.yellow}Использование:${colors.reset}`);
      console.log('  node test-reminder-system.js [check|simulate|status|logs]\n');
      console.log('Команды:');
      console.log('  check    - Проверить текущие записи и напоминания');
      console.log('  simulate - Симулировать генерацию напоминаний');
      console.log('  status   - Проверить статус системы');
      console.log('  logs     - Показать последние логи\n');
  }

  process.exit(0);
}

// Запуск
main().catch(error => {
  console.error(`${colors.red}❌ Критическая ошибка:${colors.reset}`, error);
  process.exit(1);
});