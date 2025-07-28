const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function softCancelRecord(companyId, recordId) {
  console.log('🔄 Testing soft cancel record (set attendance to -1)');
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
  
  // Only send attendance and comment
  const data = {
    attendance: -1,
    comment: 'Отменено клиентом через WhatsApp бота'
  };
  
  console.log('\nRequest data:', JSON.stringify(data, null, 2));
  console.log('\nHeaders:', JSON.stringify(headers, null, 2));
  
  try {
    console.log('\n📤 Sending PUT request to update attendance...');
    const response = await axios({
      method: 'PUT',
      url: url,
      headers: headers,
      data: data,
      validateStatus: () => true
    });
    
    console.log('\n📥 Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 201) {
      console.log('\n✅ Success! Record marked as cancelled (attendance = -1)');
      
      if (response.data.data) {
        const record = response.data.data;
        console.log('\nUpdated record details:');
        console.log('  ID:', record.id);
        console.log('  Attendance:', record.attendance, '(should be -1)');
        console.log('  Comment:', record.comment);
        console.log('  Visit attendance:', record.visit_attendance);
      }
    } else if (response.status === 422) {
      console.log('\n❌ Validation Error (422)');
      console.log('Missing required fields:', response.data.meta?.errors);
    } else if (response.status === 400) {
      console.log('\n❌ Bad Request (400)');
      console.log('Error:', response.data.meta?.message);
    } else if (response.status === 403) {
      console.log('\n❌ Forbidden (403) - No permission');
    } else if (response.status === 404) {
      console.log('\n❌ Not Found (404) - Record not found');
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
const recordId = process.argv[3] || '1211066184';

console.log('YClients Soft Cancel Record Test');
console.log('=================================\n');

softCancelRecord(companyId, recordId).catch(console.error);