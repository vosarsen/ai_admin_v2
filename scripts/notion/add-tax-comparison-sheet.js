#!/usr/bin/env node
/**
 * Add Tax Comparison Sheet to Google Sheets Financial Model
 * Based on docs/business/Tax_Regimes_Comparison_Table.md
 *
 * UPDATED v3:
 * - Removed ИП Патент (not suitable for SaaS)
 * - Fixed formula references (using semicolons for Russian locale)
 * - Added dynamic formulas linked to Scaling sheet
 */

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const CREDENTIALS_PATH = path.join(__dirname, '../../config/google-service-account.json');

async function main() {
  // Auth
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('🔧 Updating Tax Comparison sheet (v3 - fixed formulas)...\n');

  // Check if sheet exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

  if (existingSheets.includes('Tax_Comparison')) {
    console.log('⚠️  Sheet "Tax_Comparison" already exists. Clearing and updating...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Tax_Comparison!A:Z',
    });
  } else {
    console.log('📄 Creating new sheet "Tax_Comparison"...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: 'Tax_Comparison',
              index: 7,
            }
          }
        }]
      }
    });
  }

  // Data for the sheet - with formulas linked to Scaling
  // Note: Using semicolons as separators for Russian locale Google Sheets
  const data = [
    // Header
    ['📊 СРАВНЕНИЕ НАЛОГОВЫХ РЕЖИМОВ (v3)', '', '', '', '', '', ''],
    ['Дата актуализации:', '27.11.2025', '', 'Регион:', 'Московская область', '', ''],
    [''],

    // Section 1: Base Parameters (5 tax regimes, no Patent)
    ['═══ БАЗОВЫЕ ПАРАМЕТРЫ РЕЖИМОВ ═══', '', '', '', '', '', ''],
    ['Параметр', 'ИП УСН Доходы', 'ИП УСН Д-Р', 'ООО УСН 6%', 'ООО УСН IT 1%', 'ООО ОСНО', 'Примечания'],
    ['Ставка налога', '6%', '15%', '6%', '1% (МО)', '20%', 'IT 1% только в МО'],
    ['База налога', 'Доходы', 'Доходы - Расходы', 'Доходы', 'Доходы', 'Прибыль', ''],
    ['НДС', 'Нет*', 'Нет*', 'Нет*', 'Нет*', '20%', '*С 2025 НДС при >60M₽'],
    ['Страховые взносы', 'Фикс + 1%', 'Фикс + 1%', '30%', '7.6%', '30%', 'ИП фикс=53658₽ (2025)'],
    ['НДФЛ на вывод', '0%', '0%', '13%', '13%', '13%', 'Главное преимущество ИП!'],
    ['Лимит выручки', '265.8M₽', '265.8M₽', '265.8M₽', '265.8M₽', 'Без лимита', ''],
    ['Лимит сотрудников', '130', '130', '130', 'Без лимита', 'Без лимита', ''],
    ['Бухгалтер нужен', 'Нет', 'Желательно', 'Да', 'Да', 'Обязательно', ''],
    ['Сложность (1-5)', '1', '2', '3', '3', '5', ''],
    [''],

    // Section 2: Input parameters (linked to Parameters sheet)
    ['═══ ВХОДНЫЕ ДАННЫЕ ═══', '', '', '', '', '', ''],
    ['Кол-во салонов', '=Parameters!B4', '', '', '', '', 'Из Parameters'],
    ['Цена за салон/мес', '=Parameters!B5', '', '', '', '', 'Из Parameters'],
    ['Выручка год (расчёт)', '=B17*B18*12', '', '', '', '', 'Салоны × Цена × 12'],
    [''],

    // Section 3: Cost structure from Scaling
    ['═══ СТРУКТУРА РАСХОДОВ (из Scaling для 5 салонов) ═══', '', '', '', '', '', ''],
    ['Показатель', 'Значение', 'Годовое', '', '', '', 'Источник'],
    ['MRR (месяц)', '=Scaling!B3', '=B23*12', '', '', '', 'Scaling B3'],
    ['Variable Costs/мес', '=Scaling!H3', '=B24*12', '', '', '', 'Scaling H3'],
    ['Infrastructure/мес', '=Scaling!I3', '=B25*12', '', '', '', 'Scaling I3'],
    ['Расходы всего/год', '', '=C24+C25', '', '', '', 'Сумма'],
    [''],

    // Section 4: Tax calculations for each regime
    ['═══ РАСЧЁТ НАЛОГОВ ПО РЕЖИМАМ ═══', '', '', '', '', '', ''],
    ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО УСН IT 1%', 'ООО ОСНО', 'Формула'],
    [''],

    // Revenue (same for all) - direct from Scaling, multiplied by 12
    ['Выручка (год)', '=Scaling!B3*12', '=B31', '=B31', '=B31', '=B31', 'Scaling MRR × 12'],
    ['Расходы (год)', '=(Scaling!H3+Scaling!I3)*12', '=B32', '=B32', '=B32', '=B32', 'Variable + Infra × 12'],
    [''],

    // Tax calculation (row 34)
    ['Налог (до вычетов)', '=B31*0,06', '=MAX((C31-C32)*0,15;C31*0,01)', '=D31*0,06', '=E31*0,01', '=(F31-F32)*0,2', ''],

    // IP insurance: fixed 53658 + 1% of (income - 300000), capped at 300888 (row 35)
    ['Взносы ИП', '=MIN(53658+MAX(0;(B31-300000)*0,01);300888)', '=MIN(53658+MAX(0;(C31-300000)*0,01);300888)', '0', '0', '0', 'Фикс+1%, макс 300888'],

    // Tax deduction for IP УСН 6% (up to 50% of tax can be offset by contributions) (row 36)
    // B36 references B34 (налог) and B35 (взносы), takes minimum
    ['Вычет взносов', '=MIN(B34;B35*0,5)', '0', '0', '0', '0', 'До 50% налога (ИП 6%)'],

    // Final tax (row 37) = налог до вычетов - вычет
    ['Налог к уплате', '=B34-B36', '=C34', '=D34', '=E34', '=F34', ''],
    [''],

    // Profit calculation (row 39)
    // Прибыль = Выручка - Расходы - Налог к уплате - Взносы (для ИП)
    ['Прибыль до НДФЛ', '=B31-B32-B37-B35', '=C31-C32-C37-C35', '=D31-D32-D37', '=E31-E32-E37', '=F31-F32-F37', ''],
    // НДФЛ (row 40)
    ['НДФЛ (13%)', '0', '0', '=D39*0,13', '=E39*0,13', '=F39*0,13', 'Только ООО'],
    // Бухгалтерия (row 41)
    ['Бухгалтерия/год', '0', '12000', '80000', '80000', '150000', ''],
    [''],

    // Final results
    ['═══ ИТОГО ═══', '', '', '', '', '', ''],
    // Общая нагрузка (row 44) = Налог к уплате + Взносы + НДФЛ + Бухгалтерия
    ['Общая нагрузка', '=B37+B35+B40+B41', '=C37+C35+C40+C41', '=D37+D40+D41', '=E37+E40+E41', '=F37+F40+F41', 'Налог+Взносы+НДФЛ+Бух'],
    // НА РУКИ (row 45)
    ['НА РУКИ', '=B31-B44', '=C31-C44', '=D31-D44', '=E31-E44', '=F31-F44', 'Выручка - Нагрузка'],
    // % нагрузки (row 46)
    ['% нагрузки', '=B44/B31', '=C44/C31', '=D44/D31', '=E44/E31', '=F44/F31', ''],
    [''],
    // row 47
    ['🏆 ЛУЧШИЙ', '=IF(B45=MAX($B45:$F45);"✅";"")', '=IF(C45=MAX($B45:$F45);"✅";"")', '=IF(D45=MAX($B45:$F45);"✅";"")', '=IF(E45=MAX($B45:$F45);"✅";"")', '=IF(F45=MAX($B45:$F45);"✅";"")', 'Макс на руки'],
    [''],

    // Section 5: Comparison summary (starts row 49)
    ['═══ СРАВНЕНИЕ % НАГРУЗКИ ═══', '', '', '', '', '', ''],
    ['Режим', '% нагрузки', 'На руки %', 'Оценка', '', '', ''],
    ['ИП УСН 6%', '=B46', '=1-B46', '✅ ЛУЧШИЙ', '', '', ''],
    ['ИП УСН 15%', '=C46', '=1-C46', '', '', '', ''],
    ['ООО УСН 6%', '=D46', '=1-D46', '', '', '', ''],
    ['ООО УСН IT 1%', '=E46', '=1-E46', 'Для партнёров', '', '', ''],
    ['ООО ОСНО', '=F46', '=1-F46', '❌ Худший', '', '', ''],
    [''],

    // Visual bar chart (text-based)
    ['📊 Визуально:', '', '', '', '', '', ''],
    ['ИП УСН 6%', '████████░░░░░░░░░░░░░░░░░░░░░░', '~6-7%', '', '', '', ''],
    ['ИП УСН 15%', '████████████████░░░░░░░░░░░░░░', '~12-13%', '', '', '', ''],
    ['ООО IT 1%', '██████████████████░░░░░░░░░░░░', '~14-15%', '', '', '', ''],
    ['ООО УСН 6%', '████████████████████████░░░░░░', '~18-19%', '', '', '', ''],
    ['ООО ОСНО', '██████████████████████████████', '~25-27%', '', '', '', ''],
    [''],

    // Section 6: Transition triggers
    ['═══ ТРИГГЕРЫ ПЕРЕХОДОВ ═══', '', '', '', '', '', ''],
    ['Из режима', 'В режим', 'Триггер', 'Когда', '', '', ''],
    ['ИП УСН 6%', 'ИП УСН 15%', 'Расходы >60% выручки', 'Маловероятно для SaaS', '', '', ''],
    ['ИП УСН 6%', 'ООО УСН IT 1%', 'Партнёр/инвестор', 'За 2-3 мес до сделки', '', '', ''],
    ['ИП УСН 6%', 'ООО ОСНО', 'Выручка >265M₽', 'Прогноз >250M₽', '', '', ''],
    ['ООО УСН 6%', 'ООО IT 1%', 'IT аккредитация', 'После одобрения', '', '', ''],
    ['Любой УСН', 'ОСНО', 'Выручка >265.8M₽', 'Автоматически', '', '', ''],
    [''],

    // Section 7: Admin AI roadmap
    ['═══ ПЛАН ДЛЯ ADMIN AI ═══', '', '', '', '', '', ''],
    ['Этап', 'Выручка/год', 'Режим', '% нагрузки', 'На руки', '', ''],
    ['Сейчас', '=TEXT(C23,"# ##0 ₽")', 'ИП УСН 6%', '=TEXT(B46,"0.0%")', '=TEXT(B45,"# ##0 ₽")', '', ''],
    ['50 салонов', '=TEXT(Scaling!B7*12,"# ##0 ₽")', 'ИП УСН 6%', '~6%', '~94%', '', ''],
    ['100 салонов', '=TEXT(Scaling!B8*12,"# ##0 ₽")', 'ИП УСН 6%', '~6.5%', '~93.5%', '', ''],
    ['200 салонов', '=TEXT(Scaling!B9*12,"# ##0 ₽")', 'ИП УСН 6%', '~6.6%', '~93.4%', '', ''],
    ['При партнёре', 'Любая', 'ООО IT 1%', '~14%', '~86%', '', ''],
    ['При >265M₽', '>265M₽', 'ООО ОСНО', '~25%', '~75%', '', ''],
    [''],

    // Section 8: Key formulas
    ['═══ ФОРМУЛЫ ═══', '', '', '', '', '', ''],
    ['Показатель', 'Формула', 'Значение', '', '', '', ''],
    ['Взносы ИП фикс', '53658₽ (2025)', '53658', '', '', '', ''],
    ['Взносы ИП 1%', '(Доход-300K)×1%', '=MAX(0;(C23-300000)*0,01)', '', '', '', ''],
    ['Взносы ИП макс', '300888₽', '300888', '', '', '', ''],
    ['Точка безуб.', 'Расходы=60%×Выручка', 'Admin AI ~25%', '', '', '', ''],
    [''],

    // Section 9: Risks
    ['═══ РИСКИ ═══', '', '', '', '', '', ''],
    ['Режим', 'Риск', 'Вероятность', 'Митигация', '', '', ''],
    ['ИП УСН 6%', 'Личная ответственность', 'Низкая', 'Страхование', '', '', ''],
    ['ИП УСН 6%', 'НДС при >60M₽', 'Средняя', 'Заложить в цены', '', '', ''],
    ['ООО IT 1%', 'НДФЛ 13% на вывод', '100%', 'Учесть в модели', '', '', ''],
    ['ООО ОСНО', 'Высокие налоги', '100%', 'Только при >265M₽', '', '', ''],
  ];

  // Write data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tax_Comparison!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: data },
  });

  console.log(`✅ Added ${data.length} rows to Tax_Comparison sheet`);

  // Format the sheet
  const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const taxSheet = sheetInfo.data.sheets.find(s => s.properties.title === 'Tax_Comparison');
  const sheetId = taxSheet.properties.sheetId;

  const formatRequests = [
    // Set column widths
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 180 },
      fields: 'pixelSize'
    }},
    { updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 7 },
      properties: { pixelSize: 120 },
      fields: 'pixelSize'
    }},
    // Freeze first column
    { updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenColumnCount: 1 }},
      fields: 'gridProperties.frozenColumnCount'
    }},
    // Format percentage row (46 - % нагрузки)
    { repeatCell: {
      range: { sheetId, startRowIndex: 45, endRowIndex: 46, startColumnIndex: 1, endColumnIndex: 6 },
      cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.0%' }}},
      fields: 'userEnteredFormat.numberFormat'
    }},
    // Format currency rows (44 - общая нагрузка, 45 - на руки)
    { repeatCell: {
      range: { sheetId, startRowIndex: 43, endRowIndex: 45, startColumnIndex: 1, endColumnIndex: 6 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '# ##0 ₽' }}},
      fields: 'userEnteredFormat.numberFormat'
    }},
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: formatRequests },
  });

  console.log('✅ Formatting applied');
  console.log('\n🔗 View: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
  console.log('\n📌 Изменения:');
  console.log('   ❌ Удалён ИП Патент (не подходит для SaaS)');
  console.log('   🔗 Добавлены формулы, связанные с Scaling и Parameters');
  console.log('   📊 Автоматический пересчёт при изменении параметров');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
