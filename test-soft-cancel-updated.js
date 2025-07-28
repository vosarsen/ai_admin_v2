require('dotenv').config();
const { YclientsClient } = require('./src/integrations/yclients/client');

async function testSoftCancel() {
  const client = new YclientsClient();
  const companyId = '962302';
  const recordId = process.argv[2] || '1207774503';
  
  console.log('Testing Soft Cancel via YclientsClient');
  console.log('======================================\n');
  console.log('Company ID:', companyId);
  console.log('Record ID:', recordId);
  console.log('');
  
  try {
    const result = await client.cancelRecordSoft(companyId, recordId);
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Successfully soft-cancelled record!');
      console.log('Visit ID used:', result.visitId);
      console.log('Record ID:', result.recordId);
    } else {
      console.log('\n❌ Failed to soft-cancel record');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testSoftCancel().catch(console.error);