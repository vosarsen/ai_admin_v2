// Создание контекста напоминания для E2E теста
const reminderContextTracker = require('./src/services/reminder/reminder-context-tracker');

async function createContext() {
  const recordId = 1364140665; // Из логов
  const phone = '79686484488';

  console.log('Creating reminder context...');
  console.log('RecordId:', recordId);
  console.log('Phone:', phone);

  const result = await reminderContextTracker.saveReminderContext(phone, {
    record_id: recordId,
    datetime: '2025-10-24T14:00:00+03:00',
    service_name: 'МУЖСКАЯ СТРИЖКА',
    staff_name: 'Бари'
  }, 'day_before');

  if (result) {
    console.log('✅ Reminder context created successfully!');

    // Проверяем что контекст сохранился
    const context = await reminderContextTracker.getReminderContext(phone);
    console.log('\nSaved context:', JSON.stringify(context, null, 2));
  } else {
    console.error('❌ Failed to create context');
    process.exit(1);
  }

  process.exit(0);
}

createContext().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
