const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN
};

async function testDeleteRecord(companyId, recordId) {
  console.log('🔍 Testing DELETE record with debugging');
  console.log('Company ID:', companyId, 'Type:', typeof companyId);
  console.log('Record ID:', recordId, 'Type:', typeof recordId);
  
  // Ensure IDs are numbers
  const numCompanyId = parseInt(companyId);
  const numRecordId = parseInt(recordId);
  
  console.log('Parsed Company ID:', numCompanyId, 'Type:', typeof numCompanyId);
  console.log('Parsed Record ID:', numRecordId, 'Type:', typeof numRecordId);
  
  const url = `${config.baseUrl}/record/${numCompanyId}/${numRecordId}`;
  console.log('\nFull URL:', url);
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'User-Agent': 'AI-Admin-Enterprise/1.0.0'
  };
  
  console.log('\nHeaders:', JSON.stringify(headers, null, 2));
  
  const queryParams = {
    include_consumables: 0,
    include_finance_transactions: 0
  };
  
  console.log('\nQuery params:', queryParams);
  
  try {
    console.log('\n📤 Sending DELETE request...');
    const response = await axios({
      method: 'DELETE',
      url: url,
      headers: headers,
      params: queryParams,
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log('\n📥 Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 204) {
      console.log('\n✅ Success! Record deleted.');
    } else if (response.status === 400) {
      console.log('\n❌ Bad Request (400) - Invalid request format');
      console.log('Possible issues:');
      console.log('1. Record ID format is invalid');
      console.log('2. Record does not exist');
      console.log('3. Record cannot be deleted due to business rules');
    } else if (response.status === 403) {
      console.log('\n❌ Forbidden (403) - Access denied');
      console.log('API key may not have permission to delete records');
    } else if (response.status === 404) {
      console.log('\n❌ Not Found (404) - Record or endpoint not found');
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
  }
}

// Test with a sample record ID
const companyId = process.argv[2] || '962302';
const recordId = process.argv[3] || '1199516451';

console.log('YClients Delete Record Debug Test');
console.log('=================================\n');

testDeleteRecord(companyId, recordId).catch(console.error);