require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function fixDeclension() {
  // Получаем текущие склонения
  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('id, title, declensions')
    .eq('title', 'СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)')
    .single();
    
  if (fetchError) {
    console.error('Error fetching service:', fetchError);
    return;
  }
  
  console.log('Current declensions:', service.declensions);
  
  // Исправляем prepositional_na на винительный падеж
  const updatedDeclensions = {
    ...service.declensions,
    prepositional_na: 'стрижку бороды и усов' // Винительный падеж для "на что?"
  };
  
  // Обновляем в базе
  const { error: updateError } = await supabase
    .from('services')
    .update({ declensions: updatedDeclensions })
    .eq('id', service.id);
    
  if (updateError) {
    console.error('Error updating declensions:', updateError);
  } else {
    console.log('✅ Successfully updated declensions for "СТРИЖКА БОРОДЫ И УСОВ"');
    console.log('New prepositional_na:', updatedDeclensions.prepositional_na);
  }
  
  process.exit(0);
}

fixDeclension();