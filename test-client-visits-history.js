require('dotenv').config();
const axios = require('axios');

async function testClientVisitsHistory() {
  const headers = {
    'Authorization': `Bearer ${process.env.YCLIENTS_API_KEY}, User ${process.env.YCLIENTS_USER_TOKEN}`,
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json'
  };

  const clientId = 207712153; // Леонид (топовый клиент)
  const companyId = 962302;
  
  try {
    // Используем новый endpoint для истории посещений
    const url = `https://api.yclients.com/api/v1/company/${companyId}/clients/visits/search`;
    
    // Параметры запроса
    const requestData = {
      client_id: clientId,
      client_phone: null,
      from: null, // null = с начала
      to: null,   // null = до конца
      payment_statuses: [], // пустой массив = все статусы
      attendance: null // null = все статусы посещения
    };
    
    console.log('Fetching visits history for client Леонид...');
    console.log('Request URL:', url);
    console.log('Request data:', requestData);
    
    const response = await axios.post(url, requestData, { headers });
    
    if (response.data?.success) {
      console.log('\nResponse success!');
      const data = response.data.data;
      
      if (data) {
        console.log('\nData structure:', Object.keys(data));
        
        // Проверяем структуру ответа
        if (data.goods_transactions) {
          console.log('\n🛍️ GOODS TRANSACTIONS FOUND!');
          console.log('Count:', data.goods_transactions.length);
          
          if (data.goods_transactions.length > 0) {
            console.log('\nFirst goods transaction:', JSON.stringify(data.goods_transactions[0], null, 2));
          }
          
          // Считаем общую сумму товаров
          let totalGoods = 0;
          data.goods_transactions.forEach(gt => {
            if (gt.goods) {
              gt.goods.forEach(g => {
                totalGoods += g.cost_to_pay || g.cost || 0;
                console.log(`- ${g.title}: ${g.cost_to_pay || g.cost} руб`);
              });
            }
          });
          
          console.log(`\nTotal goods amount: ${totalGoods} руб`);
        }
        
        if (data.records) {
          console.log('\n📋 Records found:', data.records.length);
        }
        
        // Выводим полную структуру для анализа
        console.log('\n\nFull response data:');
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      console.log('Response not successful:', response.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testClientVisitsHistory();