#!/usr/bin/env node

/**
 * Альтернативный тест синхронизации записей клиента
 * Использует endpoint /records вместо /clients/visits/search
 */

require('dotenv').config();
const { ClientRecordsSync } = require('../src/sync/client-records-sync');

async function testSync(phone) {
  console.log('🔄 Testing client records sync (alternative method)...');
  console.log('=' .repeat(60));
  
  const sync = new ClientRecordsSync();
  
  try {
    console.log(`📱 Syncing records for phone: ${phone}`);
    const result = await sync.syncClientRecordsByPhone(phone);
    
    console.log('\n✅ Sync completed:');
    console.log(`Client: ${result.client}`);
    console.log(`Total records: ${result.recordsCount}`);
    
    if (result.records && result.records.length > 0) {
      console.log('\n📅 Visit history:');
      result.records.forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.date || record.datetime}`);
        if (record.services && record.services.length > 0) {
          console.log(`   Services:`);
          record.services.forEach(service => {
            console.log(`     - ${service.title} (${service.cost} руб.)`);
          });
        }
        if (record.staff) {
          console.log(`   Staff: ${record.staff.name || 'Not specified'}`);
        }
        console.log(`   Total cost: ${record.cost || 0} руб.`);
        console.log(`   Paid: ${record.paid || 0} руб.`);
        console.log(`   Status: ${record.status}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Запуск
const phone = process.argv[2];

if (!phone || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/test-client-records-sync.js <phone>');
  console.log('\nExample:');
  console.log('  node scripts/test-client-records-sync.js +79686484488');
  process.exit(0);
}

// Проверяем наличие необходимых переменных окружения
if (!process.env.YCLIENTS_BEARER_TOKEN || !process.env.YCLIENTS_USER_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   YCLIENTS_BEARER_TOKEN');
  console.error('   YCLIENTS_USER_TOKEN');
  console.error('\nPlease check your .env file');
  process.exit(1);
}

testSync(phone).catch(console.error);