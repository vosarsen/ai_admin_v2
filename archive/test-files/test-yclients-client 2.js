require('dotenv').config();
const axios = require('axios');

async function testClient() {
  const headers = {
    'Authorization': `Bearer ${process.env.YCLIENTS_BEARER_TOKEN}, User ${process.env.YCLIENTS_USER_TOKEN}`,
    'Accept': 'application/vnd.api.v2+json',
    'Content-Type': 'application/json'
  };

  // Ищем конкретного клиента - Леонид с телефоном 79035059524
  const response = await axios.post(
    'https://api.yclients.com/api/v1/company/962302/clients/search',
    {
      page: 1,
      page_size: 10,
      filters: [
        {
          type: "quick_search",
          state: { value: "79035059524" }
        }
      ],
      fields: [
        "id", "name", "phone", "email", 
        "sold_amount", "spent", "visits_count",
        "paid_amount", "balance"
      ]
    },
    { headers }
  );

  console.log('Response:', JSON.stringify(response.data, null, 2));
  
  if (response.data?.data?.length > 0) {
    const client = response.data.data[0];
    console.log('\nКлиент найден:');
    console.log('Имя:', client.name);
    console.log('Телефон:', client.phone);
    console.log('sold_amount:', client.sold_amount);
    console.log('spent:', client.spent);
    console.log('paid_amount:', client.paid_amount);
    console.log('visits_count:', client.visits_count);
    console.log('\nВсе поля клиента:', Object.keys(client));
  }
}

testClient().catch(console.error);
