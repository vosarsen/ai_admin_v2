#!/usr/bin/env node

/**
 * Скрипт для полной синхронизации клиентов с историей визитов
 * 
 * Использование:
 *   node scripts/sync-all-visits.js              # Синхронизировать всех клиентов с визитами
 *   node scripts/sync-all-visits.js --dry-run    # Проверить сколько клиентов будет обработано
 *   node scripts/sync-all-visits.js --limit 10   # Синхронизировать только первых 10 клиентов
 */

require('dotenv').config();
const { UniversalYclientsSync } = require('./universal-yclients-sync');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1]) : null;
  
  console.log('🔄 Full Client & Visit History Synchronization');
  console.log('=' .repeat(60));
  
  if (dryRun) {
    console.log('📋 DRY RUN MODE - No data will be synced\n');
  }
  
  if (limit) {
    console.log(`📊 LIMITED MODE - Will sync only ${limit} clients\n`);
  }
  
  // Включаем синхронизацию истории визитов
  process.env.SYNC_CLIENT_VISITS = 'true';
  
  const sync = new UniversalYclientsSync();
  
  try {
    if (dryRun) {
      // В режиме dry-run только показываем статистику
      const { supabase } = require('../src/database/supabase');
      
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', 962302);
      
      const { data: clientsWithVisits } = await supabase
        .from('clients')
        .select('visit_count')
        .eq('company_id', 962302)
        .gt('visit_count', 0);
      
      const clientsNeedingSync = clientsWithVisits?.length || 0;
      const totalVisits = clientsWithVisits?.reduce((sum, c) => sum + (c.visit_count || 0), 0) || 0;
      
      console.log('📊 Current database statistics:');
      console.log(`   Total clients: ${totalClients || 0}`);
      console.log(`   Clients with visits: ${clientsNeedingSync}`);
      console.log(`   Total visits to sync: ~${totalVisits}`);
      console.log(`\n⚠️  Estimated API calls: ${clientsNeedingSync + Math.ceil(clientsNeedingSync / 200) * 5}`);
      console.log(`   (${Math.ceil(clientsNeedingSync / 200)} pages + ${clientsNeedingSync} visit history requests)`);
      
      const estimatedTime = Math.round((clientsNeedingSync * 0.5) / 60); // ~0.5 sec per client
      console.log(`\n⏱️  Estimated time: ~${estimatedTime} minutes`);
      
      console.log('\n💡 To run the actual sync, remove --dry-run flag');
      
    } else {
      // Запускаем реальную синхронизацию
      console.log('⚠️  WARNING: This will sync ALL clients with their visit history!');
      console.log('   This may take a long time and use many API calls.');
      console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
      
      // Даем время отменить
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('🚀 Starting synchronization...\n');
      
      if (limit) {
        // В ограниченном режиме синхронизируем только часть клиентов
        const { supabase } = require('../src/database/supabase');
        const { ClientRecordsSync } = require('../src/sync/client-records-sync');
        const recordsSync = new ClientRecordsSync();
        
        const { data: clients } = await supabase
          .from('clients')
          .select('id, yclients_id, phone, name, visit_count')
          .eq('company_id', 962302)
          .gt('visit_count', 0)
          .limit(limit);
        
        console.log(`📋 Found ${clients?.length || 0} clients to sync (limited to ${limit})\n`);
        
        let synced = 0;
        for (const client of clients || []) {
          try {
            console.log(`${synced + 1}/${limit}: Syncing ${client.name}...`);
            const records = await recordsSync.getClientRecords(client.yclients_id, client.phone);
            
            if (records && records.length > 0) {
              await recordsSync.saveClientVisits(client.id, client.yclients_id, records);
              console.log(`   ✅ Synced ${records.length} visits`);
            } else {
              console.log(`   ⏭️  No visits found`);
            }
            
            synced++;
            
            // Задержка для rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
            
          } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
          }
        }
        
        console.log(`\n✅ Limited sync completed: ${synced}/${limit} clients processed`);
        
      } else {
        // Полная синхронизация через universal sync
        const result = await sync.syncClients();
        
        console.log('\n🎉 Full synchronization completed!');
        console.log(`   Total clients: ${result.total}`);
        console.log(`   Processed: ${result.processed}`);
        console.log(`   Visit history synced: ${result.visitsProcessed || 0}`);
        console.log(`   Errors: ${result.errors}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Обработка прерывания
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Sync interrupted by user');
  process.exit(0);
});

// Запуск
main().catch(console.error);