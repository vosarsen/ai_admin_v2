require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function test() {
  const { data } = await supabase
    .from('services')
    .select('category_title')
    .eq('company_id', 962302)
    .eq('is_active', true)
    .limit(10);
  
  console.log('Services:', data);
  
  const categories = [...new Set(data.map(s => s.category_title).filter(Boolean))];
  console.log('Categories:', categories);
}

test();
