require('dotenv').config();
const axios = require('axios');

async function testTransactions() {
  const headers = {
    'Authorization': `Bearer ${process.env.YCLIENTS_API_KEY}, User ${process.env.YCLIENTS_USER_TOKEN}`,
    'Accept': 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json'
  };

  const companyId = 962302;
  
  try {
    console.log('=== TESTING FINANCIAL TRANSACTIONS API ===\n');
    
    // 1. Попробуем получить все транзакции компании
    console.log('1. Getting all transactions for company...');
    const transactionsUrl = `https://api.yclients.com/api/v1/transactions/${companyId}`;
    
    try {
      // Добавим параметры для фильтрации
      const params = {
        count: 100,
        page: 1,
        start_date: '2024-01-01',
        end_date: '2025-12-31'
      };
      
      const transResponse = await axios.get(transactionsUrl, { 
        headers,
        params 
      });
      
      if (transResponse.data?.data) {
        const transactions = transResponse.data.data;
        console.log(`Found ${transactions.length} transactions`);
        
        // Анализируем типы транзакций
        const expenseTypes = {};
        const targetTypes = {};
        let goodsTransactions = [];
        
        transactions.forEach(t => {
          // Группируем по expense_id
          const expenseTitle = t.expense?.title || `expense_${t.expense_id}`;
          expenseTypes[expenseTitle] = (expenseTypes[expenseTitle] || 0) + 1;
          
          // Группируем по target_type_id
          targetTypes[t.target_type_id] = (targetTypes[t.target_type_id] || 0) + 1;
          
          // Ищем транзакции товаров
          // expense_id: 7 = "Продажа товаров" 
          // или goods_transaction_id > 0
          if (t.expense_id === 7 || t.goods_transaction_id > 0 || (t.expense && t.expense.title && t.expense.title.includes('товар'))) {
            goodsTransactions.push(t);
          }
        });
        
        console.log('\nExpense types distribution:');
        Object.entries(expenseTypes).forEach(([type, count]) => {
          console.log(`  - ${type}: ${count}`);
        });
        
        console.log('\nTarget types distribution:');
        Object.entries(targetTypes).forEach(([type, count]) => {
          console.log(`  - Type ${type}: ${count}`);
        });
        
        if (goodsTransactions.length > 0) {
          console.log(`\n🛍️ Found ${goodsTransactions.length} goods transactions!`);
          
          // Анализируем товарные транзакции
          const clientGoods = {};
          goodsTransactions.forEach(gt => {
            const clientName = gt.client?.name || 'Unknown';
            const clientId = gt.client_id;
            if (!clientGoods[clientId]) {
              clientGoods[clientId] = {
                name: clientName,
                total: 0,
                transactions: []
              };
            }
            clientGoods[clientId].total += gt.amount || 0;
            clientGoods[clientId].transactions.push({
              date: gt.date,
              amount: gt.amount,
              comment: gt.comment,
              document_id: gt.document_id
            });
          });
          
          console.log('\nGoods transactions by client:');
          Object.entries(clientGoods).forEach(([clientId, data]) => {
            console.log(`\n  Client: ${data.name} (ID: ${clientId})`);
            console.log(`  Total goods purchased: ${data.total} руб`);
            console.log(`  Transactions:`);
            data.transactions.forEach(t => {
              console.log(`    - ${t.date}: ${t.amount} руб (doc: ${t.document_id})`);
            });
          });
          
          console.log('\nFirst full goods transaction:');
          console.log(JSON.stringify(goodsTransactions[0], null, 2));
        }
      }
    } catch (error) {
      console.log('Transactions endpoint failed:', error.message);
    }
    
    // 2. Попробуем получить транзакции для конкретного клиента
    console.log('\n2. Testing transactions search with client filter...');
    const clientId = 207712153; // Леонид
    
    try {
      const searchUrl = `https://api.yclients.com/api/v1/transactions/${companyId}`;
      const searchParams = {
        client_id: clientId,
        count: 100,
        page: 1
      };
      
      const searchResponse = await axios.get(searchUrl, {
        headers,
        params: searchParams
      });
      
      if (searchResponse.data?.data) {
        const clientTransactions = searchResponse.data.data;
        console.log(`Found ${clientTransactions.length} transactions for client`);
        
        // Анализируем транзакции клиента
        let totalServices = 0;
        let totalGoods = 0;
        
        clientTransactions.forEach(t => {
          if (t.expense_id === 5) { // Оказание услуг
            totalServices += t.amount || 0;
          } else if (t.expense_id === 7) { // Продажа товаров
            totalGoods += t.amount || 0;
          }
        });
        
        console.log(`\nClient transactions summary:`);
        console.log(`  - Services: ${totalServices} руб`);
        console.log(`  - Goods: ${totalGoods} руб`);
        console.log(`  - Total: ${totalServices + totalGoods} руб`);
      }
    } catch (error) {
      console.log('Client transactions search failed:', error.message);
    }
    
    // 3. Попробуем найти документы складских операций
    console.log('\n3. Testing storage operations documents...');
    
    try {
      // Сначала попробуем создать тестовый документ
      const docUrl = `https://api.yclients.com/api/v1/storage_operations/documents/${companyId}`;
      
      // Попробуем получить существующий документ (предполагаем что есть)
      const testDocId = 22256643; // ID из примера в документации
      const getDocUrl = `https://api.yclients.com/api/v1/storage_operations/documents/${companyId}/${testDocId}`;
      
      try {
        const docResponse = await axios.get(getDocUrl, { headers });
        console.log('Document found:', docResponse.data);
      } catch (e) {
        console.log('Document not found, trying different approach...');
      }
    } catch (error) {
      console.log('Storage operations failed:', error.message);
    }
    
    // 4. Попробуем получить транзакции через timetable endpoint
    console.log('\n4. Testing timetable transactions...');
    
    try {
      const timetableUrl = `https://api.yclients.com/api/v1/timetable/transactions/${companyId}`;
      const timetableParams = {
        start_date: '2024-01-01',
        end_date: '2025-12-31'
      };
      
      const timetableResponse = await axios.get(timetableUrl, {
        headers,
        params: timetableParams
      });
      
      console.log('Timetable transactions response:', timetableResponse.data);
    } catch (error) {
      console.log('Timetable transactions failed:', error.message);
    }
    
  } catch (error) {
    console.error('General error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testTransactions();