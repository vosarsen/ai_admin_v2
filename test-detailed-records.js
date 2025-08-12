require('dotenv').config();
const axios = require('axios');

async function testDetailedRecords() {
  const headers = {
    'Authorization': 'Bearer ' + process.env.YCLIENTS_API_KEY + ', User ' + process.env.YCLIENTS_USER_TOKEN,
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json'
  };

  const clientId = 207712153; // Леонид  
  const companyId = 962302;
  
  try {
    // Получаем записи за последние 2 года
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    const endDate = new Date();
    
    const url = 'https://api.yclients.com/api/v1/records/' + companyId + 
                '?start_date=' + startDate.toISOString().split('T')[0] +
                '&end_date=' + endDate.toISOString().split('T')[0] +
                '&client_id=' + clientId +
                '&include_finance_transactions=1';
    
    console.log('Fetching all records for Леонид...');
    const response = await axios.get(url, { headers });
    
    if (response.data && response.data.data) {
      const records = response.data.data;
      console.log('Found ' + records.length + ' records total');
      
      let totalServices = 0;
      let totalGoods = 0;
      let goodsDetails = [];
      
      records.forEach(record => {
        // Считаем услуги
        if (record.services) {
          record.services.forEach(service => {
            totalServices += service.cost || 0;
          });
        }
        
        // Проверяем goods_transactions
        if (record.goods_transactions && record.goods_transactions.length > 0) {
          console.log('\nRecord ' + record.id + ' has goods_transactions:', record.goods_transactions);
          record.goods_transactions.forEach(gt => {
            if (gt.goods) {
              gt.goods.forEach(g => {
                totalGoods += g.cost_to_pay || 0;
                goodsDetails.push({
                  date: record.date,
                  title: g.title,
                  amount: g.amount,
                  cost: g.cost_to_pay
                });
              });
            }
          });
        }
        
        // Анализируем finance_transactions на предмет товаров
        if (record.finance_transactions) {
          record.finance_transactions.forEach(ft => {
            // type_id может указывать на тип транзакции
            // expense_id=5 обычно услуги, другие значения могут быть товары
            if (ft.expense_id && ft.expense_id !== 5) {
              console.log('\nFinance transaction with expense_id=' + ft.expense_id + ':', ft);
            }
            
            // goods_transaction_id указывает на товарную транзакцию
            if (ft.goods_transaction_id && ft.goods_transaction_id > 0) {
              console.log('\nFinance transaction linked to goods:', ft);
            }
          });
        }
      });
      
      console.log('\n\nSummary:');
      console.log('- Total from services: ' + totalServices);
      console.log('- Total from goods: ' + totalGoods);
      console.log('- Total: ' + (totalServices + totalGoods));
      
      if (goodsDetails.length > 0) {
        console.log('\nGoods purchased:');
        goodsDetails.forEach(g => {
          console.log('  - ' + g.date + ': ' + g.title + ' x' + g.amount + ' = ' + g.cost + ' руб');
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testDetailedRecords();
