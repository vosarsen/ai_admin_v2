const axios = require('axios');
const config = require('./src/config');

async function getRecordsAnalysis() {
  try {
    const headers = {
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.yclients.apiKey}, User ${config.yclients.userToken}`
    };

    console.log('Получаем записи за май-август 2025...');
    
    // Получаем записи
    const response = await axios.get(
      'https://api.yclients.com/api/v1/records/962302',
      {
        headers,
        params: {
          start_date: '2025-05-01',
          end_date: '2025-08-08',
          count: 500,
          page: 1,
          include_finance_transactions: 0
        }
      }
    );

    if (!response.data.success) {
      console.error('Ошибка:', response.data.meta?.message);
      return;
    }

    const records = response.data.data || [];
    console.log('Всего записей найдено:', records.length);

    // Анализируем клиентов
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
          services: new Set(),
          masters: new Set(),
          cancelCount: 0,
          completedCount: 0
        };
      }
      
      const visitDate = new Date(record.date);
      const cost = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
      
      clientStats[clientId].visits.push({
        date: visitDate,
        cost: cost,
        status: record.attendance === 1 ? 'completed' : (record.attendance === -1 ? 'canceled' : 'pending'),
        services: record.services?.map(s => s.title).join(', '),
        master: record.staff?.name
      });
      
      if (record.attendance === 1) {
        clientStats[clientId].totalSpent += cost;
        clientStats[clientId].completedCount++;
      } else if (record.attendance === -1) {
        clientStats[clientId].cancelCount++;
      }
      
      record.services?.forEach(s => clientStats[clientId].services.add(s.title));
      if (record.staff?.name) clientStats[clientId].masters.add(record.staff.name);
    });

    // Преобразуем в массив и сортируем по количеству визитов
    const clientsArray = Object.values(clientStats)
      .map(client => ({
        ...client,
        visitCount: client.visits.length,
        avgCheck: client.completedCount > 0 ? client.totalSpent / client.completedCount : 0,
        services: Array.from(client.services),
        masters: Array.from(client.masters),
        lastVisit: client.visits[client.visits.length - 1]?.date,
        daysSinceLastVisit: Math.floor((new Date() - new Date(client.visits[client.visits.length - 1]?.date)) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.visitCount - a.visitCount);

    console.log('\n=== ТОП-30 КЛИЕНТОВ ПО ЧАСТОТЕ ВИЗИТОВ (май-август 2025) ===\n');
    
    clientsArray.slice(0, 30).forEach((client, i) => {
      console.log(`${i + 1}. ${client.name} (${client.phone})`);
      console.log(`   Визитов: ${client.visitCount} (завершено: ${client.completedCount}, отменено: ${client.cancelCount})`);
      console.log(`   Потрачено: ${Math.round(client.totalSpent)}₽ | Средний чек: ${Math.round(client.avgCheck)}₽`);
      console.log(`   Последний визит: ${client.daysSinceLastVisit} дней назад`);
      console.log(`   Любимые услуги: ${client.services.slice(0, 3).join(', ')}`);
      console.log(`   Мастера: ${client.masters.join(', ')}`);
      console.log('');
    });

    // Сегментация
    const segments = {
      vip: clientsArray.filter(c => c.visitCount >= 5),
      regular: clientsArray.filter(c => c.visitCount >= 3 && c.visitCount < 5),
      growing: clientsArray.filter(c => c.visitCount === 2),
      single: clientsArray.filter(c => c.visitCount === 1),
      highValue: clientsArray.filter(c => c.avgCheck >= 3000),
      frequent: clientsArray.filter(c => c.daysSinceLastVisit <= 30 && c.visitCount >= 2),
      atRisk: clientsArray.filter(c => c.daysSinceLastVisit > 30 && c.daysSinceLastVisit <= 60 && c.visitCount >= 3),
      lost: clientsArray.filter(c => c.daysSinceLastVisit > 60 && c.visitCount >= 3)
    };

    console.log('\n=== СЕГМЕНТАЦИЯ КЛИЕНТОВ ===\n');
    console.log(`VIP (5+ визитов): ${segments.vip.length} клиентов`);
    console.log(`Постоянные (3-4 визита): ${segments.regular.length} клиентов`);
    console.log(`Растущие (2 визита): ${segments.growing.length} клиентов`);
    console.log(`Разовые (1 визит): ${segments.single.length} клиентов`);
    console.log(`\nВысокий чек (3000₽+): ${segments.highValue.length} клиентов`);
    console.log(`Частые (визит за последние 30 дней): ${segments.frequent.length} клиентов`);
    console.log(`В зоне риска (не были 30-60 дней): ${segments.atRisk.length} клиентов`);
    console.log(`Потерянные (не были >60 дней): ${segments.lost.length} клиентов`);

    // Паттерны посещений для VIP клиентов
    console.log('\n=== ПАТТЕРНЫ ПОСЕЩЕНИЙ VIP КЛИЕНТОВ ===\n');
    
    const patterns = {
      weekly: [],
      biweekly: [],
      monthly: [],
      irregular: []
    };

    segments.vip.forEach(client => {
      if (client.visits.length < 2) return;
      
      const intervals = [];
      for (let i = 1; i < client.visits.length; i++) {
        const days = Math.floor((client.visits[i].date - client.visits[i-1].date) / (1000 * 60 * 60 * 24));
        if (days > 0) intervals.push(days);
      }
      
      if (intervals.length === 0) return;
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      if (avgInterval <= 10) patterns.weekly.push(client);
      else if (avgInterval <= 20) patterns.biweekly.push(client);
      else if (avgInterval <= 35) patterns.monthly.push(client);
      else patterns.irregular.push(client);
    });

    console.log(`Еженедельные визиты (каждые 7-10 дней): ${patterns.weekly.length} клиентов`);
    patterns.weekly.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}: ${c.visitCount} визитов, средний чек ${Math.round(c.avgCheck)}₽`);
    });

    console.log(`\nКаждые 2 недели (11-20 дней): ${patterns.biweekly.length} клиентов`);
    patterns.biweekly.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}: ${c.visitCount} визитов, средний чек ${Math.round(c.avgCheck)}₽`);
    });

    console.log(`\nЕжемесячные (21-35 дней): ${patterns.monthly.length} клиентов`);
    patterns.monthly.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}: ${c.visitCount} визитов, средний чек ${Math.round(c.avgCheck)}₽`);
    });

    console.log(`\nНерегулярные (>35 дней): ${patterns.irregular.length} клиентов`);

    // Анализ услуг
    console.log('\n=== ПОПУЛЯРНЫЕ КОМБИНАЦИИ УСЛУГ ===\n');
    
    const serviceCombos = {};
    clientsArray.forEach(client => {
      client.visits.forEach(visit => {
        if (visit.services) {
          const combo = visit.services;
          serviceCombos[combo] = (serviceCombos[combo] || 0) + 1;
        }
      });
    });

    const topCombos = Object.entries(serviceCombos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    topCombos.forEach(([combo, count]) => {
      console.log(`${count}x - ${combo}`);
    });

    // Рекомендации для офферов
    console.log('\n=== РЕКОМЕНДАЦИИ ДЛЯ GRAND SLAM OFFERS ===\n');
    
    console.log('1. ДЛЯ VIP КЛИЕНТОВ (еженедельные визиты):');
    console.log('   - Безлимитный абонемент на месяц');
    console.log('   - Персональный мастер + приоритетная запись');
    console.log(`   - Таких клиентов: ${patterns.weekly.length}`);
    
    console.log('\n2. ДЛЯ РЕГУЛЯРНЫХ (каждые 2 недели):');
    console.log('   - Пакет "2 стрижки в месяц" со скидкой 25%');
    console.log('   - Включить бонусную услугу (борода/укладка)');
    console.log(`   - Таких клиентов: ${patterns.biweekly.length}`);
    
    console.log('\n3. ДЛЯ ЕЖЕМЕСЯЧНЫХ:');
    console.log('   - Подписка с фиксированной ценой');
    console.log('   - Накопительная скидка за регулярность');
    console.log(`   - Таких клиентов: ${patterns.monthly.length}`);
    
    console.log('\n4. ДЛЯ КЛИЕНТОВ В ЗОНЕ РИСКА:');
    console.log('   - "Возвращайся" - скидка 40% на первый визит');
    console.log('   - Персональное приглашение от мастера');
    console.log(`   - Таких клиентов: ${segments.atRisk.length}`);

    console.log('\n5. ДЛЯ ВЫСОКОГО ЧЕКА:');
    console.log('   - VIP пакеты с премиум услугами');
    console.log('   - Эксклюзивное время записи');
    console.log(`   - Таких клиентов: ${segments.highValue.length}`);

  } catch (error) {
    console.error('Ошибка:', error.response?.data || error.message);
  }
}

getRecordsAnalysis();