const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function getRecordDetails(companyId, recordId) {
  console.log('📋 Getting single record details from YClients');
  console.log('Company ID:', companyId);
  console.log('Record ID:', recordId);
  
  const url = `${config.baseUrl}/record/${companyId}/${recordId}`;
  console.log('\nFull URL:', url);
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'User-Agent': 'AI-Admin-Enterprise/1.0.0',
    'X-Partner-Id': '8444'
  };
  
  try {
    console.log('\n📤 Sending GET request...');
    const response = await axios({
      method: 'GET',
      url: url,
      headers: headers,
      validateStatus: () => true
    });
    
    console.log('\n📥 Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      const record = response.data.data;
      console.log('\n✅ Record details:');
      console.log('  ID:', record.id);
      console.log('  Visit ID:', record.visit_id);
      console.log('  Client:', record.client?.name, `(${record.client?.phone})`);
      console.log('  Staff ID:', record.staff_id);
      console.log('  Datetime:', record.datetime);
      console.log('  Seance length:', record.seance_length);
      console.log('  Services:', record.services?.map(s => s.title).join(', '));
      console.log('  Attendance:', record.attendance);
      
      return record;
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Test with command line arguments
const companyId = process.argv[2] || '962302';
const recordId = process.argv[3] || '1211143436';

console.log('YClients Get Single Record Test');
console.log('================================\n');

getRecordDetails(companyId, recordId).catch(console.error);