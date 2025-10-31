#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPrepositionalNa() {
    console.log('Загружаю все услуги из базы данных...');

    const { data: services, error } = await supabase
        .from('services')
        .select('id, title, declensions')
        .not('declensions', 'is', null);

    if (error) {
        console.error('Ошибка при загрузке услуг:', error);
        process.exit(1);
    }

    console.log(`Найдено ${services.length} услуг с склонениями`);

    let fixed = 0;

    for (const service of services) {
        if (!service.declensions) continue;

        // prepositional_na должен содержать винительный падеж для предлога "на"
        // Проверяем, если prepositional_na совпадает с prepositional (предложный падеж)
        // то нужно заменить на accusative (винительный падеж)
        if (service.declensions.prepositional_na === service.declensions.prepositional ||
            service.declensions.prepositional_na === service.declensions.prepositional) {

            const oldValue = service.declensions.prepositional_na;
            service.declensions.prepositional_na = service.declensions.accusative;

            console.log(`Исправляю услугу "${service.title}":`);
            console.log(`  Было: "на ${oldValue}"`);
            console.log(`  Стало: "на ${service.declensions.accusative}"`);

            const { error: updateError } = await supabase
                .from('services')
                .update({ declensions: service.declensions })
                .eq('id', service.id);

            if (updateError) {
                console.error(`Ошибка при обновлении услуги ${service.id}:`, updateError);
            } else {
                fixed++;
            }
        }
    }

    console.log(`\nИсправлено услуг: ${fixed}`);
}

fixPrepositionalNa().catch(console.error);