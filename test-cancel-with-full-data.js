const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function cancelRecordWithFullData(companyId, recordId) {
  console.log('🔄 Testing cancel record via PUT with full data');
  console.log('Company ID:', companyId);
  console.log('Record ID:', recordId);
  
  // Сначала получаем данные записи
  console.log('\n1. Getting record details first...');
  const getUrl = `${config.baseUrl}/record/${companyId}/${recordId}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'User-Agent': 'AI-Admin-Enterprise/1.0.0',
    'X-Partner-Id': '8444'
  };
  
  try {
    const getResponse = await axios({
      method: 'GET',
      url: getUrl,
      headers: headers,
      validateStatus: () => true
    });
    
    if (getResponse.status !== 200 || !getResponse.data.success) {
      console.log('❌ Failed to get record details');
      return;
    }
    
    const record = getResponse.data.data;
    console.log('✅ Got record details');
    
    // Подготавливаем данные для обновления
    const updateData = {
      id: record.id, // Добавляем ID записи
      staff_id: record.staff_id,
      services: record.services.map(s => s.id),
      client: {
        phone: record.client.phone,
        name: record.client.name,
        email: record.client.email
      },
      datetime: record.datetime,
      seance_length: record.seance_length,
      attendance: -1, // Ключевое изменение - отмена записи
      comment: record.comment + ' | Отменено клиентом через WhatsApp бота'
    };
    
    console.log('\n2. Sending PUT request to cancel...');
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    
    const putUrl = `${config.baseUrl}/record/${companyId}/${recordId}`;
    
    const putResponse = await axios({
      method: 'PUT',
      url: putUrl,
      headers: headers,
      data: updateData,
      validateStatus: () => true
    });
    
    console.log('\n📥 Response:');
    console.log('Status:', putResponse.status, putResponse.statusText);
    console.log('Data:', JSON.stringify(putResponse.data, null, 2));
    
    if (putResponse.status === 200 || putResponse.status === 201) {
      console.log('\n✅ Success! Record marked as cancelled');
      if (putResponse.data.data) {
        console.log('  New attendance:', putResponse.data.data.attendance);
        console.log('  New comment:', putResponse.data.data.comment);
      }
    } else {
      console.log('\n❌ Failed to cancel record');
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Test with command line arguments
const companyId = process.argv[2] || '962302';
const recordId = process.argv[3] || '1211143436';

console.log('YClients Cancel Record with Full Data Test');
console.log('==========================================\n');

cancelRecordWithFullData(companyId, recordId).catch(console.error);