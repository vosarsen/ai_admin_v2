#!/usr/bin/env node

/**
 * Тест прямого вызова YClients API для получения данных компании
 */

const { YclientsClient } = require('./src/integrations/yclients/client');

async function testYclientsCompany() {
  console.log('🔍 Testing YClients Company API...\n');

  const client = new YclientsClient();
  const companyId = 962302;

  try {
    console.log(`📡 Fetching company ${companyId} from YClients...`);
    const response = await client.getCompanyInfo(companyId);
    
    console.log('\n📦 Raw API Response:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.success && response.data) {
      const company = response.data;
      console.log('\n✅ Company Details:');
      console.log(`   ID: ${company.id}`);
      console.log(`   Title: ${company.title}`);
      console.log(`   Short Description: ${company.short_descr}`);
      console.log(`   Address: ${company.address}`);
      console.log(`   Phone: ${company.phone}`);
      console.log(`   Schedule: ${company.schedule}`);
      console.log(`   Timezone: ${company.timezone_name}`);
      console.log(`   Business Type ID: ${company.business_type_id}`);
      
      if (company.social) {
        console.log('\n🌐 Social Links:');
        Object.entries(company.social).forEach(([platform, link]) => {
          if (link) {
            console.log(`   ${platform}: ${link}`);
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }

  process.exit(0);
}

testYclientsCompany();