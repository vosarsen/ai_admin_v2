#!/usr/bin/env node

/**
 * Тестирование синхронизации данных компании из YClients
 */

const companyInfoSync = require('./src/sync/company-info-sync');
const { supabase } = require('./src/database/supabase');

async function testCompanySync() {
  console.log('🔄 Testing company info sync from YClients...\n');

  const companyId = 962302; // ID тестовой компании

  try {
    // 1. Проверяем текущие данные в БД
    console.log('📊 Checking current data in database...');
    const { data: currentData, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (currentData) {
      console.log('✅ Found existing company data:');
      console.log(`   Title: ${currentData.title}`);
      console.log(`   Address: ${currentData.address}`);
      console.log(`   Phone: ${currentData.phone}`);
      console.log(`   Timezone: ${currentData.timezone}`);
      console.log(`   Updated: ${currentData.updated_at}\n`);
    } else {
      console.log('❌ No company data found in database\n');
    }

    // 2. Синхронизируем данные из YClients
    console.log('🔄 Syncing data from YClients API...');
    const syncedData = await companyInfoSync.syncCompanyInfo(companyId);

    console.log('\n✅ Successfully synced company data:');
    console.log(`   Title: ${syncedData.title}`);
    console.log(`   Address: ${syncedData.address}`);
    console.log(`   Phone: ${syncedData.phone}`);
    console.log(`   Timezone: ${syncedData.timezone}`);
    console.log(`   Business Type: ${syncedData.business_type}`);
    
    if (syncedData.working_hours) {
      console.log('\n📅 Working Hours:');
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        if (syncedData.working_hours[day]) {
          const hours = syncedData.working_hours[day];
          console.log(`   ${day}: ${hours.start} - ${hours.end}`);
        }
      });
    }

    if (syncedData.social_links) {
      console.log('\n🌐 Social Links:');
      Object.entries(syncedData.social_links).forEach(([platform, link]) => {
        if (link) {
          console.log(`   ${platform}: ${link}`);
        }
      });
    }

    // 3. Тестируем автозагрузку через data-loader
    console.log('\n\n🧪 Testing auto-sync through data-loader...');
    const dataLoader = require('./src/services/ai-admin-v2/modules/data-loader');
    
    // Удаляем данные чтобы протестировать автозагрузку
    console.log('🗑️  Temporarily deleting company data...');
    await supabase
      .from('companies')
      .delete()
      .eq('company_id', companyId);

    console.log('📥 Loading company through data-loader (should trigger sync)...');
    const loadedData = await dataLoader.loadCompany(companyId);

    console.log('✅ Data loaded successfully:');
    console.log(`   Title: ${loadedData.title}`);
    console.log(`   Auto-synced: ${loadedData.updated_at ? 'Yes' : 'No'}`);

    console.log('\n✨ Company sync test completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Запускаем тест
testCompanySync();