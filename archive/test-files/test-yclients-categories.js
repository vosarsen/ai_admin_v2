require('dotenv').config();
const axios = require('axios');

async function test() {
  const config = {
    BASE_URL: 'https://api.yclients.com/api/v1',
    COMPANY_ID: 962302,
    API_KEY: process.env.YCLIENTS_API_KEY
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.API_KEY}`,
    'Accept': 'application/vnd.yclients.v2+json'
  };
  
  try {
    // Пробуем получить категории услуг
    console.log('Trying to fetch service categories...\n');
    
    // Попробуем разные endpoints
    const endpoints = [
      `/company/${config.COMPANY_ID}/service_categories`,
      `/company/${config.COMPANY_ID}/services/categories`,
      `/service_categories/${config.COMPANY_ID}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const url = config.BASE_URL + endpoint;
        console.log(`Testing: ${url}`);
        const response = await axios.get(url, { headers });
        console.log('✅ Success!');
        console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 500));
        return;
      } catch (err) {
        const status = err.response ? err.response.status : err.message;
        console.log(`❌ Failed: ${status}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();