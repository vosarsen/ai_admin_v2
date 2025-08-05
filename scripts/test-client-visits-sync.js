#!/usr/bin/env node

/**
 * Тестовый скрипт для синхронизации истории визитов клиента
 * Использование: node scripts/test-client-visits-sync.js [phone]
 */

require('dotenv').config();
const { ClientVisitsSync } = require('../src/sync/client-visits-sync');

async function testSync(phone) {
  console.log('🔄 Testing client visits sync...');
  console.log('=' .repeat(60));
  
  const sync = new ClientVisitsSync();
  
  try {
    if (phone) {
      // Синхронизация для конкретного клиента
      console.log(`📱 Syncing visits for phone: ${phone}`);
      const result = await sync.syncClientVisitsByPhone(phone);
      
      console.log('\n✅ Sync completed:');
      console.log(`Client: ${result.client}`);
      console.log(`Total visits: ${result.visitsCount}`);
      
      if (result.visits && result.visits.length > 0) {
        console.log('\n📅 Visit history:');
        result.visits.forEach((visit, index) => {
          console.log(`\n${index + 1}. ${visit.date || visit.datetime}`);
          if (visit.services && visit.services.length > 0) {
            console.log(`   Services: ${visit.services.map(s => s.title || s.name).join(', ')}`);
          }
          if (visit.staff) {
            console.log(`   Staff: ${visit.staff.name || 'Not specified'}`);
          }
          console.log(`   Cost: ${visit.cost || 0} руб.`);
          console.log(`   Status: ${visit.status || 'unknown'}`);
        });
      }
    } else {
      // Синхронизация для всех клиентов
      console.log('🌐 Syncing visits for ALL clients...');
      console.log('⚠️  This may take a while and use many API requests!');
      console.log('Press Ctrl+C to cancel\n');
      
      // Даем время отменить
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await sync.syncAllClientsVisits();
      
      console.log('\n✅ Full sync completed:');
      console.log(`Processed clients: ${result.processed}`);
      console.log(`Total visits synced: ${result.totalVisits}`);
      console.log(`Errors: ${result.errors}`);
      console.log(`Duration: ${result.duration} seconds`);
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Запуск
const phone = process.argv[2];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/test-client-visits-sync.js [phone]');
  console.log('\nExamples:');
  console.log('  node scripts/test-client-visits-sync.js +79686484488  # Sync specific client');
  console.log('  node scripts/test-client-visits-sync.js               # Sync ALL clients (careful!)');
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