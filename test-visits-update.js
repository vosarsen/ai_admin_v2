const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function getRecordDetails(companyId, recordId) {
  console.log('📋 Getting record details to find visit_id...\n');
  
  const headers = {
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'X-Partner-Id': '8444'
  };
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${config.baseUrl}/record/${companyId}/${recordId}`,
      headers: headers
    });
    
    if (response.data?.success && response.data?.data) {
      const record = response.data.data;
      console.log('✅ Found record details:');
      console.log('  Record ID:', record.id);
      console.log('  Visit ID:', record.visit_id);
      console.log('  Client:', record.client?.name);
      console.log('  Current attendance:', record.attendance);
      console.log('');
      return record.visit_id;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting record details:', error.response?.data || error.message);
    return null;
  }
}

async function updateVisitAttendance(visitId, recordId) {
  console.log('🔄 Testing visit attendance update (set to -1 = не пришел)');
  console.log('Visit ID:', visitId);
  console.log('Record ID:', recordId);
  
  const url = `${config.baseUrl}/visits/${visitId}/${recordId}`;
  console.log('\nFull URL:', url);
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'User-Agent': 'AI-Admin-Enterprise/1.0.0',
    'X-Partner-Id': '8444'
  };
  
  // Для /visits attendance и comment обязательные
  const data = {
    attendance: -1,
    comment: 'Отменено клиентом через WhatsApp бота'
  };
  
  console.log('\nRequest data:', JSON.stringify(data, null, 2));
  
  try {
    console.log('\n📤 Sending PUT request to /visits endpoint...');
    const response = await axios({
      method: 'PUT',
      url: url,
      headers: headers,
      data: data,
      validateStatus: () => true
    });
    
    console.log('\n📥 Response:');
    console.log('Status:', response.status, response.statusText);
    
    if (response.data) {
      console.log('Data:', JSON.stringify(response.data, null, 2));
    }
    
    if (response.status === 200 || response.status === 201) {
      console.log('\n✅ Success! Visit attendance updated to -1 (не пришел)');
      
      if (response.data?.data) {
        const result = response.data.data;
        console.log('\nUpdated visit details:');
        console.log('  Visit ID:', result.id || visitId);
        console.log('  Attendance:', result.attendance);
        console.log('  Comment:', result.comment);
      }
    } else if (response.status === 204) {
      console.log('\n✅ Success! Visit attendance updated (204 No Content)');
    } else if (response.status === 422) {
      console.log('\n❌ Validation Error (422)');
      if (response.data?.meta?.errors) {
        console.log('Errors:', JSON.stringify(response.data.meta.errors, null, 2));
      }
    } else if (response.status === 400) {
      console.log('\n❌ Bad Request (400)');
      console.log('Message:', response.data?.meta?.message);
    } else if (response.status === 403) {
      console.log('\n❌ Forbidden (403) - No permission');
    } else if (response.status === 404) {
      console.log('\n❌ Not Found (404) - Visit or record not found');
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Главная функция
async function main() {
  const companyId = process.argv[2] || '962302';
  const recordId = process.argv[3] || '1207774503';
  
  console.log('YClients Update Visit Attendance Test');
  console.log('=====================================\n');
  
  // Сначала получаем visit_id
  const visitId = await getRecordDetails(companyId, recordId);
  
  if (visitId) {
    await updateVisitAttendance(visitId, recordId);
  } else {
    console.log('❌ Could not find visit ID for record');
  }
}

main().catch(console.error);