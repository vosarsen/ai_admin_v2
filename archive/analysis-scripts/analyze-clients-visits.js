const { YclientsClient } = require('./src/integrations/yclients/client');

async function analyzeClientVisits() {
  try {
    const yclient = new YclientsClient();
    
    console.log('Получаем записи клиентов за май-август 2025...\n');
    
    // Получаем записи за период
    const records = await yclient.getRecords({
      start_date: '2025-05-01',
      end_date: '2025-08-08',
      count: 500
    });

    if (!records || records.length === 0) {
      console.log('Записи не найдены');
      return;
    }

    console.log(`Найдено записей: ${records.length}\n`);

    // Анализируем данные по клиентам
    const clientStats = {};
    
    records.forEach(record => {
      if (!record.client || !record.client.id) return;
      
      const clientId = record.client.id;
      const clientName = record.client.name || 'Без имени';
      const clientPhone = record.client.phone || '';
      
      if (!clientStats[clientId]) {
        clientStats[clientId] = {
          id: clientId,
          name: clientName,
          phone: clientPhone,
          visits: [],
          totalSpent: 0,
          services: {},
          masters: {},
          cancelCount: 0,
          completedCount: 0
        };
      }
      
      const visitDate = new Date(record.date);
      const cost = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
      const services = record.services?.map(s => s.title) || [];
      const master = record.staff?.name;
      
      clientStats[clientId].visits.push({
        date: visitDate,
        cost: cost,
        status: record.attendance === 1 ? 'completed' : (record.attendance === -1 ? 'canceled' : 'pending'),
        services: services.join(', '),
        master: master
      });
      
      // Подсчитываем статистику
      if (record.attendance === 1) {
        clientStats[clientId].totalSpent += cost;
        clientStats[clientId].completedCount++;
      } else if (record.attendance === -1) {
        clientStats[clientId].cancelCount++;
      }
      
      // Учитываем услуги и мастеров
      services.forEach(service => {
        clientStats[clientId].services[service] = (clientStats[clientId].services[service] || 0) + 1;
      });
      
      if (master) {
        clientStats[clientId].masters[master] = (clientStats[clientId].masters[master] || 0) + 1;
      }
    });

    // Преобразуем в массив и сортируем
    const clientsArray = Object.values(clientStats)
      .map(client => {
        // Находим любимую услугу
        const favoriteService = Object.entries(client.services)
          .sort((a, b) => b[1] - a[1])[0];
        
        // Находим любимого мастера
        const favoriteMaster = Object.entries(client.masters)
          .sort((a, b) => b[1] - a[1])[0];
        
        // Считаем среднюю частоту визитов
        const visitDates = client.visits
          .filter(v => v.status === 'completed')
          .map(v => v.date)
          .sort((a, b) => a - b);
        
        let avgDaysBetweenVisits = 0;
        if (visitDates.length > 1) {
          const intervals = [];
          for (let i = 1; i < visitDates.length; i++) {
            const days = Math.floor((visitDates[i] - visitDates[i-1]) / (1000 * 60 * 60 * 24));
            if (days > 0) intervals.push(days);
          }
          avgDaysBetweenVisits = intervals.length > 0 
            ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
            : 0;
        }
        
        return {
          ...client,
          visitCount: client.visits.length,
          avgCheck: client.completedCount > 0 ? Math.round(client.totalSpent / client.completedCount) : 0,
          favoriteService: favoriteService ? favoriteService[0] : null,
          favoriteServiceCount: favoriteService ? favoriteService[1] : 0,
          favoriteMaster: favoriteMaster ? favoriteMaster[0] : null,
          favoriteMasterCount: favoriteMaster ? favoriteMaster[1] : 0,
          lastVisit: client.visits[client.visits.length - 1]?.date,
          daysSinceLastVisit: Math.floor((new Date() - new Date(client.visits[client.visits.length - 1]?.date)) / (1000 * 60 * 60 * 24)),
          avgDaysBetweenVisits,
          cancelRate: client.visitCount > 0 ? Math.round((client.cancelCount / client.visitCount) * 100) : 0
        };
      })
      .sort((a, b) => b.visitCount - a.visitCount);

    // Выводим ТОП-100 клиентов
    console.log('=== ТОП-100 КЛИЕНТОВ ПО ЧАСТОТЕ ВИЗИТОВ (МАЙ-АВГУСТ 2025) ===\n');
    
    const top100 = clientsArray.slice(0, 100);
    
    // Разбиваем на группы по частоте
    const groups = {
      superVip: top100.filter(c => c.visitCount >= 8),
      vip: top100.filter(c => c.visitCount >= 5 && c.visitCount < 8),
      regular: top100.filter(c => c.visitCount >= 3 && c.visitCount < 5),
      growing: top100.filter(c => c.visitCount === 2),
      single: top100.filter(c => c.visitCount === 1)
    };

    console.log('📊 СЕГМЕНТАЦИЯ ТОП-100:\n');
    console.log(`SUPER VIP (8+ визитов): ${groups.superVip.length} клиентов`);
    console.log(`VIP (5-7 визитов): ${groups.vip.length} клиентов`);
    console.log(`Постоянные (3-4 визита): ${groups.regular.length} клиентов`);
    console.log(`Растущие (2 визита): ${groups.growing.length} клиентов`);
    console.log(`Разовые (1 визит): ${groups.single.length} клиентов\n`);

    // Детальный анализ каждой группы
    console.log('=== SUPER VIP КЛИЕНТЫ (8+ визитов) ===\n');
    groups.superVip.forEach((client, i) => {
      console.log(`${i + 1}. ${client.name} (${client.phone})`);
      console.log(`   📊 ${client.visitCount} визитов за 3 месяца (каждые ${client.avgDaysBetweenVisits} дней)`);
      console.log(`   💰 Потратил: ${client.totalSpent}₽ | Средний чек: ${client.avgCheck}₽`);
      console.log(`   ⭐ Любимая услуга: ${client.favoriteService} (${client.favoriteServiceCount} раз)`);
      console.log(`   👨 Любимый мастер: ${client.favoriteMaster} (${client.favoriteMasterCount} раз)`);
      console.log(`   📅 Последний визит: ${client.daysSinceLastVisit} дней назад`);
      console.log(`   ❌ Отмены: ${client.cancelRate}%\n`);
    });

    console.log('=== VIP КЛИЕНТЫ (5-7 визитов) ===\n');
    groups.vip.slice(0, 10).forEach((client, i) => {
      console.log(`${i + 1}. ${client.name} - ${client.visitCount} визитов, средний чек ${client.avgCheck}₽`);
      console.log(`   Частота: каждые ${client.avgDaysBetweenVisits} дней | Услуга: ${client.favoriteService}`);
    });

    console.log('\n=== ПАТТЕРНЫ ПОВЕДЕНИЯ ===\n');
    
    // Анализируем паттерны
    const patterns = {
      weekly: top100.filter(c => c.avgDaysBetweenVisits > 0 && c.avgDaysBetweenVisits <= 10),
      biweekly: top100.filter(c => c.avgDaysBetweenVisits > 10 && c.avgDaysBetweenVisits <= 20),
      monthly: top100.filter(c => c.avgDaysBetweenVisits > 20 && c.avgDaysBetweenVisits <= 35),
      rare: top100.filter(c => c.avgDaysBetweenVisits > 35)
    };

    console.log(`📅 Еженедельные (раз в 7-10 дней): ${patterns.weekly.length} клиентов`);
    console.log(`📅 Каждые 2 недели (11-20 дней): ${patterns.biweekly.length} клиентов`);
    console.log(`📅 Ежемесячные (21-35 дней): ${patterns.monthly.length} клиентов`);
    console.log(`📅 Редкие (реже раза в месяц): ${patterns.rare.length} клиентов\n`);

    // Анализ по услугам
    console.log('=== АНАЛИЗ ПРЕДПОЧТЕНИЙ ===\n');
    
    const allServices = {};
    const allMasters = {};
    
    top100.forEach(client => {
      Object.entries(client.services).forEach(([service, count]) => {
        allServices[service] = (allServices[service] || 0) + count;
      });
      Object.entries(client.masters).forEach(([master, count]) => {
        allMasters[master] = (allMasters[master] || 0) + count;
      });
    });

    const topServices = Object.entries(allServices)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('ТОП-10 УСЛУГ:');
    topServices.forEach(([service, count], i) => {
      console.log(`${i + 1}. ${service} - ${count} раз`);
    });

    console.log('\nРАСПРЕДЕЛЕНИЕ ПО МАСТЕРАМ:');
    Object.entries(allMasters)
      .sort((a, b) => b[1] - a[1])
      .forEach(([master, count]) => {
        console.log(`${master}: ${count} визитов`);
      });

    // Рекомендации для Grand Slam Offers
    console.log('\n\n🎯 GRAND SLAM OFFERS НА ОСНОВЕ ДАННЫХ:\n');
    
    console.log('1️⃣ "БЕЗЛИМИТ ЭЛИТ" для SUPER VIP (8+ визитов):');
    console.log(`   Целевая аудитория: ${groups.superVip.length} человек`);
    console.log(`   Средний чек: ${Math.round(groups.superVip.reduce((sum, c) => sum + c.avgCheck, 0) / groups.superVip.length)}₽`);
    console.log(`   Частота: каждые ${Math.round(groups.superVip.reduce((sum, c) => sum + c.avgDaysBetweenVisits, 0) / groups.superVip.length)} дней`);
    console.log('   ОФФЕР: Безлимит на месяц за 9,900₽ (экономия до 50%)');
    console.log('   + Личный WhatsApp мастера');
    console.log('   + Приоритетная запись\n');

    console.log('2️⃣ "ПОДПИСКА VIP" для клиентов с 5-7 визитами:');
    console.log(`   Целевая аудитория: ${groups.vip.length} человек`);
    console.log('   ОФФЕР: 2 визита в месяц за 3,500₽ (вместо 4,000₽)');
    console.log('   + Бонусная услуга каждый 3-й визит\n');

    console.log('3️⃣ "ПАКЕТ СТАБИЛЬНОСТЬ" для постоянных (3-4 визита):');
    console.log(`   Целевая аудитория: ${groups.regular.length} человек`);
    console.log('   ОФФЕР: Купи 3 стрижки = 4-я в подарок');
    console.log('   Цена пакета: 5,400₽ (1,800₽ за стрижку)\n');

    console.log('4️⃣ "УТРЕННИЙ КЛУБ" (на основе паттернов):');
    console.log('   Для всех сегментов - заполнение утренних часов');
    console.log('   ОФФЕР: -40% на услуги с 10:00 до 14:00');
    console.log('   Пакет из 5 утренних визитов: 6,000₽\n');

    console.log('5️⃣ "МАСТЕР & КЛИЕНТ" (персонализация):');
    const masterPreferences = {};
    top100.forEach(c => {
      if (c.favoriteMaster && c.favoriteMasterCount >= 3) {
        if (!masterPreferences[c.favoriteMaster]) {
          masterPreferences[c.favoriteMaster] = [];
        }
        masterPreferences[c.favoriteMaster].push(c.name);
      }
    });
    
    Object.entries(masterPreferences).forEach(([master, clients]) => {
      if (clients.length >= 5) {
        console.log(`   Для клиентов ${master} (${clients.length} лояльных):`);
        console.log(`   Персональная скидка 20% на все услуги у своего мастера`);
      }
    });

  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.response) {
      console.error('Детали:', error.response.data);
    }
  }
}

analyzeClientVisits();