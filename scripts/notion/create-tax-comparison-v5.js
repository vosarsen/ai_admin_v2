#!/usr/bin/env node
/**
 * Create Tax Comparison Sheet v5 - Только 2026 год
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

  console.log('🔧 Создаём Tax_Comparison v5 (только 2026)...\n');

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

  // Создаём новый лист
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        addSheet: { properties: { title: 'Tax_Comparison', index: 7 } }
      }]
    }
  });

  const data = [
    // Row 1: Заголовок
    ['СРАВНЕНИЕ НАЛОГОВЫХ РЕЖИМОВ 2026'],
    // Row 2
    ['Правила с 1 января 2026 года', '', '', 'Регион: МО'],
    // Row 3
    [''],

    // === ВХОДНЫЕ ДАННЫЕ ===
    // Row 4
    ['ВХОДНЫЕ ДАННЫЕ'],
    // Row 5
    ['Количество салонов', '=Parameters!B4'],
    // Row 6
    ['MRR (в месяц)', '=Scaling!B3'],
    // Row 7
    ['Выручка в год', '=B6*12'],
    // Row 8
    ['Расходы в год', '=(Scaling!H3+Scaling!I3)*12'],
    // Row 9
    [''],

    // === КЛЮЧЕВЫЕ ПРАВИЛА 2026 ===
    // Row 10
    ['ПРАВИЛА 2026'],
    // Row 11
    ['Параметр', 'Значение'],
    // Row 12
    ['НДС порог УСН', '20 млн (было 60 млн)'],
    // Row 13
    ['Ставка НДС для УСН', '5% (упрощённая)'],
    // Row 14
    ['Взносы ИП фикс', '57 390'],
    // Row 15
    ['Взносы ИП макс', '321 818'],
    // Row 16
    ['НДФЛ прогрессия', '15% при дивидендах >2,4М'],
    // Row 17
    [''],

    // === РАСЧЁТ ПО РЕЖИМАМ ===
    // Row 18
    ['РАСЧЁТ НАЛОГОВ'],
    // Row 19
    ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
    // Row 20: Выручка
    ['Выручка', '=B7', '=B20', '=B20', '=B20', '=B20'],
    // Row 21: Расходы
    ['Расходы', '=B8', '=B21', '=B21', '=B21', '=B21'],
    // Row 22: Налог базовый
    ['Налог базовый', '=B20*0,06', '=MAX((C20-C21)*0,15;C20*0,01)', '=D20*0,06', '=E20*0,01', '=(F20-F21)*0,2'],
    // Row 23: Взносы ИП
    ['Взносы ИП', '=MIN(57390+MAX(0;(B20-300000)*0,01);321818)', '=B23', '0', '0', '0'],
    // Row 24: Вычет (до 50% налога)
    ['Вычет взносов', '=MIN(B22;B23*0,5)', '0', '0', '0', '0'],
    // Row 25: Налог к уплате
    ['Налог к уплате', '=B22-B24', '=C22', '=D22', '=E22', '=F22'],
    // Row 26: НДС 5% (если выручка > 20М)
    ['НДС 5%', '=IF(B20>20000000;B20*0,05;0)', '=IF(C20>20000000;C20*0,05;0)', '=IF(D20>20000000;D20*0,05;0)', '=IF(E20>20000000;E20*0,05;0)', '=F20*0,22'],
    // Row 27: Прибыль до НДФЛ
    ['Прибыль до НДФЛ', '=B20-B21-B25-B23-B26', '=C20-C21-C25-C23-C26', '=D20-D21-D25-D26', '=E20-E21-E25-E26', '=F20-F21-F25-F26'],
    // Row 28: НДФЛ
    ['НДФЛ', '0', '0', '=IF(D27>2400000;D27*0,15;D27*0,13)', '=IF(E27>2400000;E27*0,15;E27*0,13)', '=IF(F27>2400000;F27*0,15;F27*0,13)'],
    // Row 29: Бухгалтер
    ['Бухгалтер/год', '0', '12000', '80000', '80000', '150000'],
    // Row 30: Итого нагрузка
    ['ИТОГО нагрузка', '=B25+B23+B26+B28+B29', '=C25+C23+C26+C28+C29', '=D25+D26+D28+D29', '=E25+E26+E28+E29', '=F25+F26+F28+F29'],
    // Row 31: На руки
    ['НА РУКИ', '=B20-B30', '=C20-C30', '=D20-D30', '=E20-E30', '=F20-F30'],
    // Row 32: % нагрузки
    ['% нагрузки', '=B30/B20', '=C30/C20', '=D30/D20', '=E30/E20', '=F30/F20'],
    // Row 33
    [''],
    // Row 34: Лучший
    ['ЛУЧШИЙ', '=IF(B31=MAX($B31:$F31);"✅";"")', '=IF(C31=MAX($B31:$F31);"✅";"")', '=IF(D31=MAX($B31:$F31);"✅";"")', '=IF(E31=MAX($B31:$F31);"✅";"")', '=IF(F31=MAX($B31:$F31);"✅";"")'],
    // Row 35
    [''],

    // === СЦЕНАРИИ ===
    // Row 36
    ['СЦЕНАРИИ ПО САЛОНАМ'],
    // Row 37
    ['Салонов', 'Выручка', 'НДС 5%?', 'Налог 6%', 'Взносы', 'Нагрузка', '% нагр.'],
    // Row 38
    ['5', '3 000 000', 'нет', '180 000', '84 390', '264 390', '8,8%'],
    // Row 39
    ['10', '6 000 000', 'нет', '360 000', '114 390', '474 390', '7,9%'],
    // Row 40
    ['20', '12 000 000', 'нет', '720 000', '174 390', '894 390', '7,5%'],
    // Row 41
    ['33', '19 800 000', 'нет', '1 188 000', '252 390', '1 440 390', '7,3%'],
    // Row 42: Порог!
    ['34', '20 400 000', "'+ 1 020 000", '1 224 000', '258 390', '2 502 390', '12,3%'],
    // Row 43
    ['50', '30 000 000', "'+ 1 500 000", '1 800 000', '321 818', '3 621 818', '12,1%'],
    // Row 44
    ['100', '60 000 000', "'+ 3 000 000", '3 600 000', '321 818', '6 921 818', '11,5%'],
    // Row 45
    ['200', '120 000 000', "'+ 6 000 000", '7 200 000', '321 818', '13 521 818', '11,3%'],
    // Row 46
    [''],
    // Row 47
    ['ПОРОГ НДС: 33 салона (20М). После — платим +5% с выручки!'],
    // Row 48
    [''],

    // === РЕКОМЕНДАЦИЯ ===
    // Row 49
    ['РЕКОМЕНДАЦИЯ'],
    // Row 50
    [''],
    // Row 51
    ['ИП УСН 6% — оптимальный выбор для Admin AI'],
    // Row 52
    [''],
    // Row 53
    ['Преимущества:'],
    // Row 54
    ['• Минимальная нагрузка 7-12%'],
    // Row 55
    ['• Нет НДФЛ на вывод (экономия 13%)'],
    // Row 56
    ['• Простота: 1 декларация в год'],
    // Row 57
    ['• Не нужен бухгалтер'],
    // Row 58
    [''],
    // Row 59
    ['Когда менять режим:'],
    // Row 60
    ['• Появился партнёр → ООО IT 1%'],
    // Row 61
    ['• Нужен инвестор с долей → ООО IT 1%'],
    // Row 62
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
        // Ширина колонок
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 180 }, fields: 'pixelSize'
        }},
        { updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 7 },
          properties: { pixelSize: 120 }, fields: 'pixelSize'
        }},
        // Заморозить первую колонку
        { updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenColumnCount: 1 }},
          fields: 'gridProperties.frozenColumnCount'
        }},
        // Проценты - Row 32 (index 31)
        { repeatCell: {
          range: { sheetId, startRowIndex: 31, endRowIndex: 32, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0,0%' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Числа с разделителями - расчёт (rows 20-31, index 19-30)
        { repeatCell: {
          range: { sheetId, startRowIndex: 19, endRowIndex: 31, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '# ##0' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Жирный заголовок
        { repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        // Жирные секции
        { repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 17, endRowIndex: 18, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 35, endRowIndex: 36, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 48, endRowIndex: 49, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
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
