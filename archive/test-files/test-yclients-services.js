require('dotenv').config();
const YClientsAPI = require('./src/integrations/yclients/api');

async function test() {
  const api = new YClientsAPI(process.env.YCLIENTS_API_KEY);
  
  // Получаем услуги из YClients
  const services = await api.getServices(962302);
  
  console.log('First 3 services from YClients:');
  services.slice(0, 3).forEach(s => {
    console.log({
      title: s.title,
      category_id: s.category_id,
      category: s.category,
      category_title: s.category?.title
    });
  });
}

test().catch(console.error);
