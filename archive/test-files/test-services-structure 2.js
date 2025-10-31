require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function test() {
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('company_id', 962302)
    .eq('is_active', true)
    .limit(3);
  
  console.log('Sample services:');
  data.forEach(s => {
    console.log({
      title: s.title,
      category_title: s.category_title, 
      category_id: s.category_id,
      price: s.price_min
    });
  });
}

test();
