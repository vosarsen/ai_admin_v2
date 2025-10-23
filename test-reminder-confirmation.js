// Тест подтверждения напоминания
const reminderResponseHandler = require('./src/services/reminder/reminder-response-handler');
const reminderContextTracker = require('./src/services/reminder/reminder-context-tracker');

async function test() {
  console.log('=== Testing Reminder Confirmation ===\n');

  const testPhone = '79686484488';
  const testRecordId = 1363409568;

  // 1. Создаём контекст напоминания
  console.log('1. Creating reminder context...');
  await reminderContextTracker.setReminderContext(testPhone, {
    type: 'day_before',
    sentAt: new Date().toISOString(),
    booking: {
      recordId: testRecordId,
      datetime: '2025-10-23T14:00:00+03:00',
      serviceName: 'МУЖСКАЯ СТРИЖКА',
      staffName: 'Бари'
    }
  });
  console.log('✅ Context created\n');

  // 2. Проверяем контекст
  console.log('2. Checking context...');
  const context = await reminderContextTracker.getReminderContext(testPhone);
  console.log('Context:', JSON.stringify(context, null, 2));
  console.log('');

  // 3. Симулируем подтверждение
  console.log('3. Simulating confirmation message: "Да, приду!"');
  const result = await reminderResponseHandler.handleResponse(
    testPhone,
    'Да, приду!',
    'test-message-id'
  );

  console.log('\n=== Result ===');
  console.log('Handled:', result.handled);
  console.log('Confirmed:', result.confirmed);
  console.log('RecordId:', result.recordId);
  console.log('Error:', result.error || 'none');

  if (result.confirmed) {
    console.log('\n✅ SUCCESS! Booking confirmed!');
  } else {
    console.log('\n❌ FAILED!');
    if (result.error) {
      console.log('Error:', result.error);
    }
  }

  process.exit(result.confirmed ? 0 : 1);
}

test().catch(err => {
  console.error('\n❌ Test failed with exception:', err);
  process.exit(1);
});
