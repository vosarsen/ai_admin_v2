const axios = require('axios');
require('dotenv').config();

const config = {
  baseUrl: 'https://api.yclients.com/api/v1',
  bearerToken: process.env.YCLIENTS_API_KEY,
  userToken: process.env.YCLIENTS_USER_TOKEN,
  companyId: '962302'
};

async function getRecords() {
  console.log('📋 Getting records from YClients');
  console.log('Company ID:', config.companyId);
  
  const url = `${config.baseUrl}/records/${config.companyId}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.yclients.v2+json',
    'Authorization': `Bearer ${config.bearerToken}${config.userToken ? `, User ${config.userToken}` : ''}`,
    'User-Agent': 'AI-Admin-Enterprise/1.0.0'
  };
  
  const params = {
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ahead
    page: 1,
    count: 10
  };
  
  console.log('\nRequest params:', params);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      headers: headers,
      params: params,
      validateStatus: () => true
    });
    
    console.log('\nResponse status:', response.status);
    
    if (response.status === 200 && response.data.success) {
      const records = response.data.data;
      console.log(`\nFound ${records.length} records:\n`);
      
      records.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`  ID: ${record.id} (type: ${typeof record.id})`);
        console.log(`  Visit ID: ${record.visit_id} (type: ${typeof record.visit_id})`);
        console.log(`  Client: ${record.client?.name || 'Unknown'} (${record.client?.phone || 'No phone'})`);
        console.log(`  Date: ${record.date}`);
        console.log(`  Services: ${record.services?.map(s => s.title).join(', ') || 'None'}`);
        console.log(`  Staff: ${record.staff?.name || 'Unknown'}`);
        console.log(`  Attendance: ${record.attendance} (${getAttendanceStatus(record.attendance)})`);
        console.log(`  Deleted: ${record.deleted}`);
        console.log('---');
      });
      
      // Try to find a test record we can delete
      const testRecord = records.find(r => 
        !r.deleted && 
        r.attendance === 0 && 
        new Date(r.date) > new Date()
      );
      
      if (testRecord) {
        console.log(`\n✅ Found a test record that can be deleted:`);
        console.log(`   ID: ${testRecord.id}`);
        console.log(`   Client: ${testRecord.client?.name}`);
        console.log(`   Date: ${testRecord.date}`);
        console.log(`\nTo test deletion, run:`);
        console.log(`node test-delete-record-debug.js ${config.companyId} ${testRecord.id}`);
      } else {
        console.log('\n⚠️  No suitable test record found for deletion');
      }
      
    } else {
      console.log('Failed to get records:', response.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

function getAttendanceStatus(attendance) {
  switch(attendance) {
    case 2: return 'Confirmed';
    case 1: return 'Visited';
    case 0: return 'Waiting';
    case -1: return 'No show';
    default: return 'Unknown';
  }
}

getRecords().catch(console.error);