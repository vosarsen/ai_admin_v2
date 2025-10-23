// Создание тестовой записи для проверки подтверждения напоминания
const { YclientsClient } = require('./src/integrations/yclients/client');
const config = require('./src/config');

async function createTestBooking() {
  console.log('=== Creating Test Booking ===\n');

  const client = new YclientsClient({
    companyId: config.yclients.companyId,
    bearerToken: config.yclients.bearerToken,
    userToken: config.yclients.userToken,
    partnerId: config.yclients.partnerId
  });

  // Данные для записи
  const bookingData = {
    phone: '79686484488',
    fullname: 'Тестовый Клиент',
    email: 'test@example.com',
    appointments: [{
      id: 18356010, // МУЖСКАЯ СТРИЖКА
      staff_id: 4503616, // Бари
      datetime: '2025-10-24T14:00:00+03:00',
      services: [18356010]
    }]
  };

  console.log('Booking data:', JSON.stringify(bookingData, null, 2));
  console.log('\nCreating booking...\n');

  try {
    const result = await client.createBooking(bookingData);

    if (result.success) {
      console.log('✅ SUCCESS! Booking created');
      console.log('\nRecord ID:', result.data.id);
      console.log('Record data:', JSON.stringify(result.data, null, 2));

      console.log('\n📝 Next steps:');
      console.log(`1. Copy this recordId: ${result.data.id}`);
      console.log('2. Create reminder context with this ID');
      console.log('3. Send confirmation message from WhatsApp');

      return result.data.id;
    } else {
      console.error('❌ FAILED!');
      console.error('Error:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Exception:', error);
    process.exit(1);
  }
}

createTestBooking().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
