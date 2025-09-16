const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function analyzeKultura() {
  console.log('=== АНАЛИЗ БАРБЕРШОПА KULTURA ===\n');

  // 1. Получаем мастеров
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('company_id', 962302);

  if (staffError) {
    console.error('Ошибка получения мастеров:', staffError);
  } else {
    console.log('📊 МАСТЕРА:');
    const activeStaff = staff.filter(m => !m.is_fired && !m.hidden);
    console.log(`Всего в базе: ${staff.length}, активных: ${activeStaff.length}\n`);
    activeStaff.forEach(master => {
      console.log(`- ${master.name} (ID: ${master.id})`);
      console.log(`  Специализация: ${master.specialization || 'не указана'}`);
      console.log(`  Рейтинг: ${master.rating || 0} (${master.comments_count || 0} отзывов)`);
    });
  }

  // 2. Анализ клиентской базы
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .eq('company_id', 962302);

  if (clientsError) {
    console.error('Ошибка получения клиентов:', clientsError);
  } else {
    console.log('\n📊 КЛИЕНТСКАЯ БАЗА:');
    console.log(`Всего клиентов: ${clients.length}`);

    const activeClients = clients.filter(c => c.visits_count > 0);
    const regularClients = clients.filter(c => c.visits_count >= 3);
    const vipClients = clients.filter(c => c.visits_count >= 10);
    const sleepingClients = clients.filter(c => {
      if (!c.last_change_date || c.visits_count === 0) return false;
      const lastVisit = new Date(c.last_change_date);
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 2);
      return lastVisit < monthsAgo;
    });

    console.log(`Активных (хотя бы 1 визит): ${activeClients.length}`);
    console.log(`Постоянных (3+ визита): ${regularClients.length}`);
    console.log(`VIP (10+ визитов): ${vipClients.length}`);
    console.log(`Спящих (не было 2+ месяца): ${sleepingClients.length}`);

    // Средние показатели
    const avgVisits = activeClients.reduce((acc, c) => acc + c.visits_count, 0) / activeClients.length;
    const avgSpent = activeClients.reduce((acc, c) => acc + (c.spent || 0), 0) / activeClients.length;

    console.log(`\nСредние показатели активных клиентов:`);
    console.log(`- Среднее кол-во визитов: ${avgVisits.toFixed(1)}`);
    console.log(`- Средняя сумма трат: ${Math.round(avgSpent)} руб`);

    // Топ клиенты
    const topClients = clients
      .filter(c => c.visits_count > 0)
      .sort((a, b) => b.visits_count - a.visits_count)
      .slice(0, 10);

    console.log('\n🏆 ТОП-10 КЛИЕНТОВ:');
    topClients.forEach((client, i) => {
      console.log(`${i+1}. ${client.name || 'Без имени'} - ${client.visits_count} визитов, потратил ${client.spent || 0} руб`);
    });
  }

  // 3. Анализ услуг
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .eq('company_id', 962302)
    .eq('is_active', true);

  if (servicesError) {
    console.error('Ошибка получения услуг:', servicesError);
  } else {
    console.log('\n📊 УСЛУГИ:');
    console.log(`Всего активных услуг: ${services.length}`);

    // Группировка по категориям
    const categories = {};
    services.forEach(service => {
      const cat = service.category_title || 'Без категории';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(service);
    });

    console.log('\nПо категориям:');
    Object.entries(categories).forEach(([cat, servs]) => {
      const avgPrice = servs.reduce((acc, s) => acc + s.price_min, 0) / servs.length;
      console.log(`- ${cat}: ${servs.length} услуг, средняя цена ${Math.round(avgPrice)} руб`);
    });

    // Топ услуги по цене
    const topServices = services
      .sort((a, b) => b.price_min - a.price_min)
      .slice(0, 5);

    console.log('\n💰 ТОП-5 ДОРОГИХ УСЛУГ:');
    topServices.forEach((service, i) => {
      console.log(`${i+1}. ${service.title} - ${service.price_min} руб`);
    });

    // Средний чек
    const avgPrice = services.reduce((acc, s) => acc + s.price_min, 0) / services.length;
    console.log(`\n💵 Средняя цена услуги: ${Math.round(avgPrice)} руб`);
  }

  // 4. Анализ записей (если есть)
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .eq('company_id', 962302)
    .gte('datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (!bookingsError && bookings && bookings.length > 0) {
    console.log('\n📊 ЗАПИСИ ЗА ПОСЛЕДНИЙ МЕСЯЦ:');
    console.log(`Всего записей: ${bookings.length}`);

    const confirmedBookings = bookings.filter(b => b.attendance === 1);
    const cancelledBookings = bookings.filter(b => b.attendance === -1);

    console.log(`Подтвержденных: ${confirmedBookings.length}`);
    console.log(`Отмененных: ${cancelledBookings.length}`);
  }

  console.log('\n=== КОНЕЦ АНАЛИЗА ===');
}

analyzeKultura().catch(console.error);