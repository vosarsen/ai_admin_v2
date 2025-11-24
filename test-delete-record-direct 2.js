const { YclientsClient } = require('./src/integrations/yclients/client');
const config = require('./src/config');

async function testDeleteRecord() {
  const client = new YclientsClient();
  const recordId = 1199065365; // ID записи из логов
  const companyId = config.yclients.companyId;
  
  console.log(`\n🚫 Attempting to delete record ${recordId}...`);
  console.log(`Company ID: ${companyId}`);
  console.log(`API Token: ${config.yclients.bearerToken ? 'Present' : 'Missing'}`);
  
  const result = await client.deleteRecord(companyId, recordId);
  
  if (result.success) {
    console.log('\n✅ Record deleted successfully!');
    console.log('Result:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('\n❌ Failed to delete record');
    console.log('Error:', result.error);
    
    if (result.error && (result.error.includes('403') || result.error.includes('Forbidden'))) {
      console.log('\n⚠️  API key doesn\'t have permission to delete records');
      console.log('The record can only be deleted manually through YClients interface');
    }
  }
}

// Запускаем тест
testDeleteRecord().catch(console.error);