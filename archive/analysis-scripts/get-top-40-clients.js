const axios = require('axios');
const config = require('./src/config');
const { supabase } = require('./src/database/supabase');

async function getTop40Clients() {
  try {
    console.log('🔍 Получаем топ-40 клиентов из базы данных...\n');
    
    // Получаем топ-40 клиентов по количеству визитов
    const { data: topClients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', 962302)
      .order('visit_count', { ascending: false })
      .limit(40);

    if (error) {
      console.error('Ошибка получения клиентов:', error);
      return;
    }

    console.log(`✅ Найдено клиентов: ${topClients.length}\n`);

    // Теперь получим историю их записей через YClients API
    const headers = {
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.yclients.apiKey}, User ${config.yclients.userToken}`
    };

    console.log('📊 АНАЛИЗ ТОП-40 КЛИЕНТОВ KULTURA BARBERSHOP\n');
    console.log('=' .repeat(80));

    const clientsWithHistory = [];

    for (let i = 0; i < Math.min(topClients.length, 40); i++) {
      const client = topClients[i];
      
      try {
        // Получаем записи клиента за последние 6 месяцев
        const response = await axios.get(
          `https://api.yclients.com/api/v1/records/962302`,
          {
            headers,
            params: {
              client_id: client.yclients_id,
              start_date: '2025-02-01',
              end_date: '2025-08-08',
              count: 50
            }
          }
        );

        const records = response.data.data || [];
        
        // Анализируем записи
        const services = {};
        const masters = {};
        const visitDates = [];
        let totalSpent = 0;
        let canceledCount = 0;
        let completedCount = 0;
        const visitTimes = [];

        records.forEach(record => {
          const visitDate = new Date(record.date);
          visitDates.push(visitDate);
          
          // Собираем время визитов для анализа предпочтений
          const hour = visitDate.getHours();
          visitTimes.push(hour);

          // Учитываем услуги
          if (record.services) {
            record.services.forEach(service => {
              services[service.title] = (services[service.title] || 0) + 1;
              if (record.attendance === 1) {
                totalSpent += service.cost || 0;
              }
            });
          }

          // Учитываем мастеров
          if (record.staff?.name) {
            masters[record.staff.name] = (masters[record.staff.name] || 0) + 1;
          }

          // Статус визита
          if (record.attendance === 1) completedCount++;
          else if (record.attendance === -1) canceledCount++;
        });

        // Вычисляем паттерны
        visitDates.sort((a, b) => a - b);
        const intervals = [];
        for (let j = 1; j < visitDates.length; j++) {
          const days = Math.floor((visitDates[j] - visitDates[j-1]) / (1000 * 60 * 60 * 24));
          if (days > 0 && days < 365) intervals.push(days);
        }
        
        const avgInterval = intervals.length > 0 
          ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
          : 0;

        // Определяем любимое время
        const avgHour = visitTimes.length > 0
          ? Math.round(visitTimes.reduce((a, b) => a + b, 0) / visitTimes.length)
          : 0;
        
        const timePreference = avgHour < 14 ? 'утро' : (avgHour < 18 ? 'день' : 'вечер');

        // Сортируем услуги и мастеров по популярности
        const topServices = Object.entries(services).sort((a, b) => b[1] - a[1]);
        const topMasters = Object.entries(masters).sort((a, b) => b[1] - a[1]);

        clientsWithHistory.push({
          rank: i + 1,
          id: client.id,
          yclients_id: client.yclients_id,
          name: client.name || 'Без имени',
          phone: client.phone,
          email: client.email,
          visitCount: client.visit_count || records.length,
          totalSpent: totalSpent,
          avgCheck: completedCount > 0 ? Math.round(totalSpent / completedCount) : 0,
          lastVisit: client.last_visit_date,
          daysSinceLastVisit: client.last_visit_date 
            ? Math.floor((new Date() - new Date(client.last_visit_date)) / (1000 * 60 * 60 * 24))
            : 999,
          avgDaysBetweenVisits: avgInterval,
          favoriteService: topServices[0] ? topServices[0][0] : null,
          favoriteServiceCount: topServices[0] ? topServices[0][1] : 0,
          allServices: topServices.map(s => s[0]),
          favoriteMaster: topMasters[0] ? topMasters[0][0] : null,
          favoriteMasterCount: topMasters[0] ? topMasters[0][1] : 0,
          timePreference: timePreference,
          cancelRate: Math.round((canceledCount / records.length) * 100) || 0,
          discount: client.discount || 0,
          notes: client.comment || ''
        });

        // Показываем прогресс
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Обработано ${i + 1} из ${topClients.length} клиентов...`);
        }

      } catch (err) {
        console.error(`Ошибка для клиента ${client.name}:`, err.message);
        clientsWithHistory.push({
          rank: i + 1,
          id: client.id,
          name: client.name || 'Без имени',
          phone: client.phone,
          visitCount: client.visit_count,
          error: true
        });
      }

      // Небольшая задержка чтобы не перегружать API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '=' .repeat(80));
    console.log('📋 ПЕРСОНАЛЬНЫЕ GRAND SLAM OFFERS ДЛЯ ТОП-40 КЛИЕНТОВ');
    console.log('=' .repeat(80) + '\n');

    // Создаем персональные офферы
    clientsWithHistory.forEach(client => {
      if (client.error) {
        console.log(`❌ ${client.rank}. ${client.name} - данные недоступны\n`);
        return;
      }

      console.log(`🎯 ${client.rank}. ${client.name} (${client.phone})`);
      console.log(`   📊 Статистика: ${client.visitCount} визитов | ${client.totalSpent}₽ потрачено | Средний чек: ${client.avgCheck}₽`);
      console.log(`   ⏰ Частота: каждые ${client.avgDaysBetweenVisits} дней | Последний визит: ${client.daysSinceLastVisit} дней назад`);
      console.log(`   ⭐ Любимая услуга: ${client.favoriteService} (${client.favoriteServiceCount} раз)`);
      console.log(`   👨 Любимый мастер: ${client.favoriteMaster} (${client.favoriteMasterCount} раз)`);
      console.log(`   🕐 Предпочитает: ${client.timePreference}`);
      
      // Генерируем персональный оффер
      console.log('\n   💎 ПЕРСОНАЛЬНЫЙ GRAND SLAM OFFER:');
      
      // Логика создания оффера на основе паттернов
      if (client.daysSinceLastVisit > 30) {
        // Возвращающий оффер
        console.log(`   📱 "ВОЗВРАЩЕНИЕ ЧЕМПИОНА"`);
        console.log(`   ✅ Скидка 50% на ${client.favoriteService}`);
        console.log(`   ✅ Гарантированное время у ${client.favoriteMaster}`);
        console.log(`   ✅ Подарок: премиальная процедура`);
        console.log(`   💰 Цена: ${Math.round(client.avgCheck * 0.5)}₽ (вместо ${client.avgCheck}₽)`);
        console.log(`   ⏳ Действует 7 дней!`);
        
      } else if (client.visitCount >= 8) {
        // VIP безлимит
        console.log(`   👑 "VIP БЕЗЛИМИТ"`);
        console.log(`   ✅ Безлимит на все услуги на месяц`);
        console.log(`   ✅ Личный WhatsApp ${client.favoriteMaster}`);
        console.log(`   ✅ Приоритетная запись в ${client.timePreference}`);
        console.log(`   💰 Цена: ${Math.round(client.avgCheck * 2.5)}₽/мес`);
        console.log(`   🎁 Экономия: до ${Math.round(client.avgCheck * client.avgDaysBetweenVisits / 30 * 4 - client.avgCheck * 2.5)}₽`);
        
      } else if (client.avgDaysBetweenVisits <= 20) {
        // Подписка для частых
        console.log(`   🔄 "ПОДПИСКА CHAMPION"`);
        console.log(`   ✅ 2 визита в месяц по фиксированной цене`);
        console.log(`   ✅ ${client.favoriteService} + бонусная услуга`);
        console.log(`   ✅ Всегда в ${client.timePreference} у ${client.favoriteMaster}`);
        console.log(`   💰 Цена: ${Math.round(client.avgCheck * 1.5)}₽/мес`);
        console.log(`   🎁 Экономия: ${Math.round(client.avgCheck * 2 - client.avgCheck * 1.5)}₽`);
        
      } else if (client.allServices.length >= 3) {
        // Пакет разнообразия
        console.log(`   🎨 "МАСТЕР СТИЛЯ"`);
        console.log(`   ✅ 3 разные услуги со скидкой 30%`);
        console.log(`   ✅ Можно пробовать: ${client.allServices.slice(0, 3).join(', ')}`);
        console.log(`   ✅ Действует 2 месяца`);
        console.log(`   💰 Пакет: ${Math.round(client.avgCheck * 3 * 0.7)}₽`);
        
      } else {
        // Стандартный выгодный пакет
        console.log(`   💼 "СМАРТ ПАКЕТ"`);
        console.log(`   ✅ 3 ${client.favoriteService} = цена 2х`);
        console.log(`   ✅ Фиксированная цена на 3 месяца`);
        console.log(`   ✅ Можно делиться с другом`);
        console.log(`   💰 Пакет: ${Math.round(client.avgCheck * 2)}₽ за 3 визита`);
      }

      // Добавляем триггеры срочности
      if (client.cancelRate > 20) {
        console.log(`   ⚡ БОНУС за пунктуальность: -10% если не отменяете`);
      }
      if (client.discount > 0) {
        console.log(`   🎁 Ваша скидка ${client.discount}% сохраняется!`);
      }

      console.log('\n' + '-'.repeat(80) + '\n');
    });

    // Сводная статистика
    console.log('=' .repeat(80));
    console.log('📊 СВОДНАЯ СТАТИСТИКА ПО ТОП-40:');
    console.log('=' .repeat(80));
    
    const stats = {
      totalRevenue: clientsWithHistory.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
      avgVisits: Math.round(clientsWithHistory.reduce((sum, c) => sum + (c.visitCount || 0), 0) / 40),
      avgCheck: Math.round(clientsWithHistory.reduce((sum, c) => sum + (c.avgCheck || 0), 0) / 40),
      needReturn: clientsWithHistory.filter(c => c.daysSinceLastVisit > 30).length,
      vipClients: clientsWithHistory.filter(c => c.visitCount >= 8).length,
      regularClients: clientsWithHistory.filter(c => c.visitCount >= 3 && c.visitCount < 8).length
    };

    console.log(`💰 Общая выручка с топ-40: ${stats.totalRevenue}₽`);
    console.log(`📈 Среднее количество визитов: ${stats.avgVisits}`);
    console.log(`💵 Средний чек: ${stats.avgCheck}₽`);
    console.log(`🔄 Нужно вернуть: ${stats.needReturn} клиентов`);
    console.log(`👑 VIP клиентов (8+ визитов): ${stats.vipClients}`);
    console.log(`⭐ Постоянных (3-7 визитов): ${stats.regularClients}`);

    console.log('\n🎯 ПОТЕНЦИАЛ ОФФЕРОВ:');
    console.log(`Если активируем 50% офферов:`);
    console.log(`- Дополнительная выручка: ~${Math.round(stats.avgCheck * stats.avgVisits * 20)}₽/мес`);
    console.log(`- Повышение LTV: x2-3`);
    console.log(`- Снижение оттока: -50%`);

  } catch (error) {
    console.error('Критическая ошибка:', error);
  }
}

getTop40Clients();