const { YclientsClient } = require('./src/integrations/yclients/client');
const config = require('./src/config');

async function updateRecordStatus() {
  const client = new YclientsClient();
  const recordId = 1199065365; // ID записи из логов
  const companyId = config.yclients.companyId;
  
  console.log(`\n🔄 Attempting to update record ${recordId} status to "не пришел"...`);
  
  // Меняем статус на -1 (пользователь не пришел на визит)
  const result = await client.updateRecord(companyId, recordId, {
    attendance: -1
  });
  
  if (result.success) {
    console.log('✅ Record status updated successfully!');
    console.log('Result:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Failed to update record status');
    console.log('Error:', result.error);
    
    // Если нет прав, попробуем другой подход
    if (result.error.includes('403') || result.error.includes('Forbidden')) {
      console.log('\n⚠️  API key doesn\'t have permission to update records');
      console.log('You need to update the status manually in YClients interface');
    }
  }
}

// Запускаем тест
updateRecordStatus().catch(console.error);