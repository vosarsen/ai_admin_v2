const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function updateAttendance(companyId, recordId) {
  console.log('🔄 Testing attendance update (set to -1 = не пришел)');
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
  
  // Отправляем только attendance и comment - согласно документации, все поля опциональные
  const data = {
    attendance: -1,
    comment: 'Отменено клиентом через WhatsApp бота'
  };
  
  console.log('\nRequest data:', JSON.stringify(data, null, 2));
  
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
    console.log('Headers:', response.headers);
    
    if (response.data) {
      console.log('Data:', JSON.stringify(response.data, null, 2));
    }
    
    if (response.status === 200 || response.status === 201) {
      console.log('\n✅ Success! Record attendance updated to -1 (не пришел)');
      
      if (response.data?.data) {
        const record = response.data.data;
        console.log('\nUpdated record details:');
        console.log('  ID:', record.id);
        console.log('  Attendance:', record.attendance);
        console.log('  Visit attendance:', record.visit_attendance);
        console.log('  Comment:', record.comment);
        console.log('  Status:', record.attendance === -1 ? 'Клиент не пришел' : 'Другой статус');
      }
    } else if (response.status === 422) {
      console.log('\n❌ Validation Error (422)');
      if (response.data?.meta?.errors) {
        console.log('Required fields:', JSON.stringify(response.data.meta.errors, null, 2));
      }
    } else if (response.status === 400) {
      console.log('\n❌ Bad Request (400)');
      console.log('Message:', response.data?.meta?.message);
    } else if (response.status === 403) {
      console.log('\n❌ Forbidden (403) - No permission');
    } else if (response.status === 404) {
      console.log('\n❌ Not Found (404) - Record not found');
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Сначала получаем список записей
async function getActiveRecords(companyId) {
  console.log('📋 Getting active records for testing...\n');
  
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  
  const params = {
    start_date: today.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    page: 1,
    count: 5
  };
  
  const headers = {
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'X-Partner-Id': '8444'
  };
  
  try {
    const response = await axios({
      method: 'GET',
      url: `${config.baseUrl}/records/${companyId}`,
      headers: headers,
      params: params
    });
    
    if (response.data?.data?.length > 0) {
      console.log('Found records:');
      response.data.data.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}, Client: ${record.client?.name}, Date: ${record.date}, Attendance: ${record.attendance}`);
      });
      
      return response.data.data[0].id; // Возвращаем ID первой записи
    } else {
      console.log('No records found');
      return null;
    }
  } catch (error) {
    console.error('Error getting records:', error.message);
    return null;
  }
}

// Главная функция
async function main() {
  const companyId = process.argv[2] || '962302';
  const recordId = process.argv[3];
  
  console.log('YClients Update Attendance Test');
  console.log('================================\n');
  
  if (!recordId) {
    // Если ID не указан, получаем список записей
    const foundRecordId = await getActiveRecords(companyId);
    if (foundRecordId) {
      console.log(`\nUsing record ID: ${foundRecordId}\n`);
      await updateAttendance(companyId, foundRecordId);
    } else {
      console.log('\nPlease provide record ID as second argument');
      console.log('Usage: node test-attendance-update.js [companyId] [recordId]');
    }
  } else {
    await updateAttendance(companyId, recordId);
  }
}

main().catch(console.error);