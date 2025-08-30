require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function check() {
  const { data } = await supabase
    .from('clients')
    .select('name, total_spent, visit_count')
    .eq('phone', '79035059524')
    .single();
    
  console.log('Леонид сейчас:', data);
}

check();
