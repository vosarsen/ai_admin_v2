#!/usr/bin/env node
/**
 * Update Scaling sheet with VAT 2026 rules
 * НДС 5% при выручке > 20М (годовой)
 * Месячный порог: 20М / 12 = 1 666 667 руб MRR
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

  console.log('🔧 Обновляем Scaling с НДС 2026...\n');

  // Очищаем лист
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Scaling!A:Z',
  });

  // Новая структура с НДС
  // Порог НДС: 20М годовых = 1 666 667 MRR
  const headers = [
    'Салоны',
    'MRR (₽)',
    'Выручка год',
    'Rev Share (₽)',
    'LLM Cost (₽)',
    'Эквайринг (₽)',
    'НДС 5% (2026)',
    'Перемен. затраты',
    'Инфраструктура',
    'Прибыль до налога',
    'Налог УСН (1%)',
    'Чистая прибыль',
    'Маржа %',
    'На учредителя',
  ];

  const scenarios = [1, 5, 10, 15, 20, 33, 34, 50, 100, 200];

  const dataRows = scenarios.map((salons, idx) => {
    const rowNum = idx + 2;
    return [
      salons,
      `=A${rowNum}*Parameters!B5`,                    // B: MRR
      `=B${rowNum}*12`,                               // C: Выручка год
      `=B${rowNum}*0,2`,                              // D: Rev Share 20%
      `=A${rowNum}*LLM_Models!D3`,                    // E: LLM cost
      `=B${rowNum}*0,033`,                            // F: Эквайринг 3.3%
      `=IF(C${rowNum}>20000000;B${rowNum}*0,05;0)`,   // G: НДС 5% если год > 20М
      `=D${rowNum}+E${rowNum}+F${rowNum}+G${rowNum}`, // H: Переменные (с НДС!)
      `=IF(A${rowNum}<=5;Infrastructure!E2;IF(A${rowNum}<=15;Infrastructure!E3;IF(A${rowNum}<=50;Infrastructure!E4;Infrastructure!E5)))`,
      `=B${rowNum}-H${rowNum}-I${rowNum}`,            // J: Прибыль до налога
      `=J${rowNum}*0,01`,                             // K: Налог 1%
      `=J${rowNum}-K${rowNum}`,                       // L: Чистая прибыль
      `=L${rowNum}/B${rowNum}`,                       // M: Маржа %
      `=L${rowNum}/2`,                                // N: На учредителя
    ];
  });

  // Добавляем пустую строку и пояснения
  const notes = [
    [''],
    ['ПРАВИЛА НДС 2026:'],
    ['• Порог: 20 млн руб/год (было 60 млн)'],
    ['• Ставка: 5% (упрощённая для УСН)'],
    ['• Порог в салонах: ~33 (при цене 50К)'],
    ['• После порога нагрузка +5%'],
    [''],
    ['ПОРОГ НДС', '=20000000/12/Parameters!B5', 'салонов'],
  ];

  const data = [headers, ...dataRows, ...notes];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Scaling!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: data },
  });

  console.log(`✅ Записано ${data.length} строк`);

  // Форматирование
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const scalingSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Scaling');
  const sheetId = scalingSheet.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        // Ширина колонок
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 70 }, fields: 'pixelSize'
        }},
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 14 },
          properties: { pixelSize: 110 }, fields: 'pixelSize'
        }},
        // Формат чисел (B-L)
        { repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 12, startColumnIndex: 1, endColumnIndex: 12 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '# ##0' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Формат процентов (M)
        { repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 12, startColumnIndex: 12, endColumnIndex: 13 },
          cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0,0%' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Жирный заголовок
        { repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        // Заморозить заголовок
        { updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 }},
          fields: 'gridProperties.frozenRowCount'
        }},
      ]
    },
  });

  console.log('✅ Форматирование применено');
  console.log('\n🔗 https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=' + sheetId);

  // Показываем расчёт
  console.log('\n📊 Пример расчёта НДС:');
  console.log('   33 салона = 19.8М/год → НДС: 0 (ниже порога)');
  console.log('   34 салона = 20.4М/год → НДС: 5% = 85К/мес');
  console.log('   50 салонов = 30М/год → НДС: 5% = 125К/мес');
  console.log('   100 салонов = 60М/год → НДС: 5% = 250К/мес');
}

main().catch(err => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
