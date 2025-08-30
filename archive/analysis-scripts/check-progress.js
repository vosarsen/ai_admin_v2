require('dotenv').config();
const { supabase } = require('./src/database/supabase');

async function check() {
  const { count: withSpent } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .gt('total_spent', 0);
    
  const { data: top } = await supabase
    .from('clients')
    .select('name, total_spent')
    .order('total_spent', { ascending: false })
    .limit(3);
    
  console.log(`Клиентов с покупками: ${withSpent}`);
  console.log('Топ-3:', top);
}

check();
