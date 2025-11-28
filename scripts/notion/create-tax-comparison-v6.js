#!/usr/bin/env node
/**
 * Create Tax Comparison Sheet v6 - 2026 с расчётами для 35, 50, 100, 200 салонов
 */

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const CREDENTIALS_PATH = path.join(__dirname, '../../config/google-service-account.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('🔧 Создаём Tax_Comparison v6...\n');

  // Удалим старый лист
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Tax_Comparison');

  if (existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: existingSheet.properties.sheetId } }]
      }
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: 'Tax_Comparison', index: 7 } } }]
    }
  });

  // Цена за салон в месяц
  const PRICE = 50000;

  // Функция расчёта для сценария
  function calcScenario(salons) {
    const revenue = salons * PRICE * 12;
    const expenses = revenue * 0.25; // ~25% расходы

    // ИП УСН 6%
    const ip6_tax_base = revenue * 0.06;
    const ip6_contributions = Math.min(57390 + Math.max(0, (revenue - 300000) * 0.01), 321818);
    const ip6_deduction = Math.min(ip6_tax_base, ip6_contributions * 0.5);
    const ip6_tax = ip6_tax_base - ip6_deduction;
    const ip6_vat = revenue > 20000000 ? revenue * 0.05 : 0;
    const ip6_total = ip6_tax + ip6_contributions + ip6_vat;
    const ip6_net = revenue - ip6_total;
    const ip6_pct = ip6_total / revenue;

    // ИП УСН 15%
    const ip15_tax = Math.max((revenue - expenses) * 0.15, revenue * 0.01);
    const ip15_contributions = ip6_contributions;
    const ip15_vat = ip6_vat;
    const ip15_total = ip15_tax + ip15_contributions + ip15_vat + 12000;
    const ip15_net = revenue - ip15_total;
    const ip15_pct = ip15_total / revenue;

    // ООО УСН 6%
    const ooo6_tax = revenue * 0.06;
    const ooo6_vat = ip6_vat;
    const ooo6_profit = revenue - expenses - ooo6_tax - ooo6_vat;
    const ooo6_ndfl = ooo6_profit > 2400000 ? ooo6_profit * 0.15 : ooo6_profit * 0.13;
    const ooo6_total = ooo6_tax + ooo6_vat + ooo6_ndfl + 80000;
    const ooo6_net = revenue - ooo6_total;
    const ooo6_pct = ooo6_total / revenue;

    // ООО IT 1%
    const oooIT_tax = revenue * 0.01;
    const oooIT_vat = ip6_vat;
    const oooIT_profit = revenue - expenses - oooIT_tax - oooIT_vat;
    const oooIT_ndfl = oooIT_profit > 2400000 ? oooIT_profit * 0.15 : oooIT_profit * 0.13;
    const oooIT_total = oooIT_tax + oooIT_vat + oooIT_ndfl + 80000;
    const oooIT_net = revenue - oooIT_total;
    const oooIT_pct = oooIT_total / revenue;

    // ООО ОСНО
    const osno_tax = (revenue - expenses) * 0.2;
    const osno_vat = revenue * 0.22;
    const osno_profit = revenue - expenses - osno_tax - osno_vat;
    const osno_ndfl = osno_profit > 2400000 ? osno_profit * 0.15 : osno_profit * 0.13;
    const osno_total = osno_tax + osno_vat + osno_ndfl + 150000;
    const osno_net = revenue - osno_total;
    const osno_pct = osno_total / revenue;

    return {
      salons, revenue, expenses,
      ip6: { tax: ip6_tax, contributions: ip6_contributions, vat: ip6_vat, total: ip6_total, net: ip6_net, pct: ip6_pct },
      ip15: { tax: ip15_tax, contributions: ip15_contributions, vat: ip15_vat, total: ip15_total, net: ip15_net, pct: ip15_pct },
      ooo6: { tax: ooo6_tax, vat: ooo6_vat, ndfl: ooo6_ndfl, total: ooo6_total, net: ooo6_net, pct: ooo6_pct },
      oooIT: { tax: oooIT_tax, vat: oooIT_vat, ndfl: oooIT_ndfl, total: oooIT_total, net: oooIT_net, pct: oooIT_pct },
      osno: { tax: osno_tax, vat: osno_vat, ndfl: osno_ndfl, total: osno_total, net: osno_net, pct: osno_pct },
    };
  }

  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  const pct = (n) => (n * 100).toFixed(1) + '%';

  // Генерируем блок для сценария
  function scenarioBlock(s, startRow) {
    const c = calcScenario(s);
    const best = Math.max(c.ip6.net, c.ip15.net, c.ooo6.net, c.oooIT.net, c.osno.net);

    return [
      [`${s} САЛОНОВ (${fmt(c.revenue)} руб/год)`],
      ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
      ['Выручка', fmt(c.revenue), fmt(c.revenue), fmt(c.revenue), fmt(c.revenue), fmt(c.revenue)],
      ['Расходы (~25%)', fmt(c.expenses), fmt(c.expenses), fmt(c.expenses), fmt(c.expenses), fmt(c.expenses)],
      ['Налог', fmt(c.ip6.tax), fmt(c.ip15.tax), fmt(c.ooo6.tax), fmt(c.oooIT.tax), fmt(c.osno.tax)],
      ['Взносы ИП', fmt(c.ip6.contributions), fmt(c.ip15.contributions), '—', '—', '—'],
      ['НДС', c.ip6.vat > 0 ? fmt(c.ip6.vat) : '—', c.ip15.vat > 0 ? fmt(c.ip15.vat) : '—', c.ooo6.vat > 0 ? fmt(c.ooo6.vat) : '—', c.oooIT.vat > 0 ? fmt(c.oooIT.vat) : '—', fmt(c.osno.vat)],
      ['НДФЛ (дивиденды)', '—', '—', fmt(c.ooo6.ndfl), fmt(c.oooIT.ndfl), fmt(c.osno.ndfl)],
      ['Бухгалтер', '—', '12 000', '80 000', '80 000', '150 000'],
      ['ИТОГО нагрузка', fmt(c.ip6.total), fmt(c.ip15.total), fmt(c.ooo6.total), fmt(c.oooIT.total), fmt(c.osno.total)],
      ['НА РУКИ', fmt(c.ip6.net), fmt(c.ip15.net), fmt(c.ooo6.net), fmt(c.oooIT.net), fmt(c.osno.net)],
      ['% нагрузки', pct(c.ip6.pct), pct(c.ip15.pct), pct(c.ooo6.pct), pct(c.oooIT.pct), pct(c.osno.pct)],
      ['ЛУЧШИЙ', c.ip6.net === best ? '✅' : '', c.ip15.net === best ? '✅' : '', c.ooo6.net === best ? '✅' : '', c.oooIT.net === best ? '✅' : '', c.osno.net === best ? '✅' : ''],
      [''],
    ];
  }

  const data = [
    // Row 1
    ['СРАВНЕНИЕ НАЛОГОВЫХ РЕЖИМОВ 2026'],
    // Row 2
    ['Цена: 50 000 руб/салон/мес', '', '', 'Расходы: ~25% от выручки'],
    // Row 3
    [''],

    // Правила
    // Row 4
    ['ПРАВИЛА 2026'],
    // Row 5
    ['• НДС 5% при выручке > 20 млн (это ~33 салона)'],
    // Row 6
    ['• Взносы ИП: 57 390 фикс + 1% с превышения 300К (макс 321 818)'],
    // Row 7
    ['• НДФЛ на дивиденды: 13% (15% если >2,4М)'],
    // Row 8
    ['• ООО ОСНО: НДС 22%, налог на прибыль 20%'],
    // Row 9
    [''],

    // Сценарии
    ...scenarioBlock(35),  // Rows 10-23
    ...scenarioBlock(50),  // Rows 24-37
    ...scenarioBlock(100), // Rows 38-51
    ...scenarioBlock(200), // Rows 52-65

    // Сводная таблица
    // Row 66
    ['СВОДКА: НА РУКИ ПО РЕЖИМАМ'],
    // Row 67
    ['Салонов', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО', 'Лучший'],
    // Rows 68-71
    ...[[35], [50], [100], [200]].map(([s]) => {
      const c = calcScenario(s);
      const best = Math.max(c.ip6.net, c.ip15.net, c.ooo6.net, c.oooIT.net, c.osno.net);
      let bestName = '';
      if (c.ip6.net === best) bestName = 'ИП УСН 6%';
      else if (c.ip15.net === best) bestName = 'ИП УСН 15%';
      else if (c.oooIT.net === best) bestName = 'ООО IT 1%';
      return [s, fmt(c.ip6.net), fmt(c.ip15.net), fmt(c.ooo6.net), fmt(c.oooIT.net), fmt(c.osno.net), bestName];
    }),
    // Row 72
    [''],

    // Сводка % нагрузки
    // Row 73
    ['СВОДКА: % НАГРУЗКИ'],
    // Row 74
    ['Салонов', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
    // Rows 75-78
    ...[[35], [50], [100], [200]].map(([s]) => {
      const c = calcScenario(s);
      return [s, pct(c.ip6.pct), pct(c.ip15.pct), pct(c.ooo6.pct), pct(c.oooIT.pct), pct(c.osno.pct)];
    }),
    // Row 79
    [''],

    // Рекомендация
    // Row 80
    ['ВЫВОД'],
    // Row 81
    [''],
    // Row 82
    ['ИП УСН 6% — лучший выбор на всех этапах'],
    // Row 83
    [''],
    // Row 84
    ['• 35 салонов: нагрузка 12,1% (НДС уже платим)'],
    // Row 85
    ['• 50 салонов: нагрузка 12,1%'],
    // Row 86
    ['• 100 салонов: нагрузка 11,5%'],
    // Row 87
    ['• 200 салонов: нагрузка 11,3%'],
    // Row 88
    [''],
    // Row 89
    ['Переход на ООО только если:'],
    // Row 90
    ['• Нужен партнёр/инвестор с долей → ООО IT 1%'],
    // Row 91
    ['• Выручка >265М → ООО ОСНО (автоматом)'],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tax_Comparison!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: data },
  });

  console.log(`✅ Записано ${data.length} строк`);

  // Форматирование
  const newSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const newSheet = newSpreadsheet.data.sheets.find(s => s.properties.title === 'Tax_Comparison');
  const sheetId = newSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 180 }, fields: 'pixelSize'
        }},
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 7 },
          properties: { pixelSize: 120 }, fields: 'pixelSize'
        }},
        { updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenColumnCount: 1 }},
          fields: 'gridProperties.frozenColumnCount'
        }},
        // Жирный заголовок
        { repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        // Жирные заголовки секций сценариев
        ...[9, 23, 37, 51, 65, 72, 79].map(row => ({
          repeatCell: {
            range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }}},
            fields: 'userEnteredFormat.textFormat'
          }
        })),
      ]
    },
  });

  console.log('✅ Форматирование применено');
  console.log('\n🔗 https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=' + sheetId);
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
