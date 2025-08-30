require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteBooking() {
  const recordId = 1250886396;
  
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .eq('yclients_record_id', recordId);
    
  if (error) {
    console.error('Error deleting:', error);
  } else {
    console.log(`Successfully deleted booking ${recordId}`);
  }
  
  process.exit(0);
}

deleteBooking();