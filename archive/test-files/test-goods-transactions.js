require('dotenv').config();
const axios = require('axios');

async function testGoodsTransactions() {
  const headers = {
    'Authorization': 'Bearer ' + process.env.YCLIENTS_API_KEY + ', User ' + process.env.YCLIENTS_USER_TOKEN,
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json'
  };

  // Тестовый клиент - Леонид (топовый)
  const clientId = 207712153;
  const companyId = 962302;
  
  try {
    // Запрос с include_finance_transactions
    const url = 'https://api.yclients.com/api/v1/records/' + companyId + '?client_id=' + clientId + '&include_finance_transactions=1';
    
    console.log('Fetching records for client Леонид...');
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.data) {
      const records = response.data.data;
      console.log('Found ' + records.length + ' records');
      
      // Проверяем первую запись
      if (records.length > 0) {
        const firstRecord = records[0];
        console.log('\nFirst record structure:');
        console.log('- ID:', firstRecord.id);
        console.log('- Date:', firstRecord.date);
        console.log('- Services:', firstRecord.services ? firstRecord.services.length : 0);
        console.log('- Has goods_transactions?', Boolean(firstRecord.goods_transactions));
        console.log('- Has finance_transactions?', Boolean(firstRecord.finance_transactions));
        
        if (firstRecord.goods_transactions) {
          console.log('\nGoods transactions:', JSON.stringify(firstRecord.goods_transactions, null, 2));
        }
        
        if (firstRecord.finance_transactions) {
          console.log('\nFinance transactions:', JSON.stringify(firstRecord.finance_transactions, null, 2));
        }
      }
      
      // Считаем товары
      let totalGoods = 0;
      records.forEach(record => {
        if (record.goods_transactions && record.goods_transactions.length > 0) {
          record.goods_transactions.forEach(gt => {
            if (gt.goods) {
              gt.goods.forEach(g => {
                totalGoods += g.cost_to_pay || 0;
              });
            }
          });
        }
      });
      
      console.log('\nTotal goods amount:', totalGoods);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testGoodsTransactions();
