require('dotenv').config();
const axios = require('axios');

async function testClientHistory() {
  const headers = {
    'Authorization': 'Bearer ' + process.env.YCLIENTS_API_KEY + ', User ' + process.env.YCLIENTS_USER_TOKEN,
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json'
  };

  const clientId = 207712153; // Леонид
  const companyId = 962302;
  
  try {
    // 1. Попробуем получить детальную информацию о клиенте
    console.log('Getting client details...');
    const clientUrl = 'https://api.yclients.com/api/v1/client/' + companyId + '/' + clientId;
    const clientResponse = await axios.get(clientUrl, { headers });
    
    if (clientResponse.data) {
      console.log('Client info:');
      console.log('- Name:', clientResponse.data.data.name);
      console.log('- Spent:', clientResponse.data.data.spent);
      console.log('- Sold amount:', clientResponse.data.data.sold_amount);
      console.log('- Visits count:', clientResponse.data.data.visits_count);
      
      // Проверяем структуру
      const client = clientResponse.data.data;
      console.log('\nClient fields:', Object.keys(client));
      
      if (client.goods_transactions) {
        console.log('\nGoods transactions found:', client.goods_transactions);
      }
      
      if (client.finance_transactions) {
        console.log('\nFinance transactions found:', client.finance_transactions);
      }
    }
    
    // 2. Попробуем поискать транзакции
    console.log('\n\nSearching for transactions...');
    const searchUrl = 'https://api.yclients.com/api/v1/transactions_search/' + companyId;
    const searchData = {
      client_id: clientId,
      page: 1,
      count: 100
    };
    
    try {
      const searchResponse = await axios.post(searchUrl, searchData, { headers });
      console.log('Transactions search result:', searchResponse.data);
    } catch (e) {
      console.log('Transactions search failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testClientHistory();
