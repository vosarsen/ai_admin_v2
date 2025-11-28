#!/usr/bin/env node
/**
 * Create Tax Comparison Sheet v4 - Clean Implementation
 * Простая структура с правильными ссылками
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

  console.log('🔧 Создаём Tax_Comparison v4...\n');

  // Удалим старый лист если есть
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Tax_Comparison');

  if (existingSheet) {
    console.log('🗑️  Удаляем старый лист...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteSheet: { sheetId: existingSheet.properties.sheetId }
        }]
      }
    });
  }

  // Создаём новый лист
  console.log('📄 Создаём новый лист...');
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

  // Данные - простая структура
  // Все формулы используют точные номера строк
  const data = [
    // === ЗАГОЛОВОК ===
    // Row 1
    ['СРАВНЕНИЕ НАЛОГОВЫХ РЕЖИМОВ 2025-2026'],
    // Row 2
    ['Обновлено: 27.11.2025', '', '', 'Регион: Московская область'],
    // Row 3
    [''],

    // === ВХОДНЫЕ ДАННЫЕ ===
    // Row 4
    ['ВХОДНЫЕ ДАННЫЕ', '', '', '', '', ''],
    // Row 5
    ['Параметр', 'Значение', '', '', '', ''],
    // Row 6: Салонов
    ['Количество салонов', '=Parameters!B4'],
    // Row 7: MRR
    ['MRR (в месяц)', '=Scaling!B3'],
    // Row 8: Выручка год = MRR * 12
    ['Выручка в год', '=B7*12'],
    // Row 9: Расходы год
    ['Расходы в год', '=(Scaling!H3+Scaling!I3)*12'],
    // Row 10
    [''],

    // === ИЗМЕНЕНИЯ 2026 ===
    // Row 11
    ['ИЗМЕНЕНИЯ 2026', '', '', '', '', ''],
    // Row 12
    ['Параметр', '2025', '2026', 'Изменение', '', ''],
    // Row 13
    ['НДС порог УСН', '60 млн', '20 млн', 'При >20М платим НДС 5%'],
    // Row 14
    ['Взносы ИП фикс', '53 658', '57 390', "'+7%"],
    // Row 15
    ['Взносы ИП макс', '300 888', '321 818', "'+7%"],
    // Row 16
    ['IT страх. взносы', '7,6%', '15%', "'+97%"],
    // Row 17
    [''],

    // === РАСЧЁТ 2025 ===
    // Row 18
    ['РАСЧЁТ 2025 (без НДС)', '', '', '', '', ''],
    // Row 19: Заголовки
    ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
    // Row 20: Выручка
    ['Выручка', '=B8', '=B20', '=B20', '=B20', '=B20'],
    // Row 21: Расходы
    ['Расходы', '=B9', '=B21', '=B21', '=B21', '=B21'],
    // Row 22: Налог базовый
    ['Налог базовый', '=B20*0,06', '=MAX((C20-C21)*0,15;C20*0,01)', '=D20*0,06', '=E20*0,01', '=(F20-F21)*0,2'],
    // Row 23: Взносы ИП (фикс 53658 + 1% с превышения 300К, макс 300888)
    ['Взносы ИП', '=MIN(53658+MAX(0;(B20-300000)*0,01);300888)', '=B23', '0', '0', '0'],
    // Row 24: Вычет (до 50% налога для ИП УСН 6%)
    ['Вычет взносов', '=MIN(B22;B23*0,5)', '0', '0', '0', '0'],
    // Row 25: Налог к уплате
    ['Налог к уплате', '=B22-B24', '=C22', '=D22', '=E22', '=F22'],
    // Row 26: Прибыль до НДФЛ
    ['Прибыль до НДФЛ', '=B20-B21-B25-B23', '=C20-C21-C25-C23', '=D20-D21-D25', '=E20-E21-E25', '=F20-F21-F25'],
    // Row 27: НДФЛ (только ООО)
    ['НДФЛ 13%', '0', '0', '=D26*0,13', '=E26*0,13', '=F26*0,13'],
    // Row 28: Бухгалтер
    ['Бухгалтер/год', '0', '12000', '80000', '80000', '150000'],
    // Row 29: Итого нагрузка
    ['ИТОГО нагрузка', '=B25+B23+B27+B28', '=C25+C23+C27+C28', '=D25+D27+D28', '=E25+E27+E28', '=F25+F27+F28'],
    // Row 30: На руки
    ['НА РУКИ', '=B20-B29', '=C20-C29', '=D20-D29', '=E20-E29', '=F20-F29'],
    // Row 31: % нагрузки
    ['% нагрузки', '=B29/B20', '=C29/C20', '=D29/D20', '=E29/E20', '=F29/F20'],
    // Row 32
    [''],

    // === РАСЧЁТ 2026 ===
    // Row 33
    ['РАСЧЁТ 2026 (НДС 5% при >20М)', '', '', '', '', ''],
    // Row 34: Заголовки
    ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
    // Row 35: Выручка (та же что в 2025)
    ['Выручка', '=B8', '=B35', '=B35', '=B35', '=B35'],
    // Row 36: Расходы
    ['Расходы', '=B9', '=B36', '=B36', '=B36', '=B36'],
    // Row 37: Налог базовый
    ['Налог базовый', '=B35*0,06', '=MAX((C35-C36)*0,15;C35*0,01)', '=D35*0,06', '=E35*0,01', '=(F35-F36)*0,2'],
    // Row 38: Взносы ИП 2026 (фикс 57390, макс 321818)
    ['Взносы ИП', '=MIN(57390+MAX(0;(B35-300000)*0,01);321818)', '=B38', '0', '0', '0'],
    // Row 39: Вычет
    ['Вычет взносов', '=MIN(B37;B38*0,5)', '0', '0', '0', '0'],
    // Row 40: Налог к уплате
    ['Налог к уплате', '=B37-B39', '=C37', '=D37', '=E37', '=F37'],
    // Row 41: НДС 5% (только если выручка > 20М)
    ['НДС 5%', '=IF(B35>20000000;B35*0,05;0)', '=IF(C35>20000000;C35*0,05;0)', '=IF(D35>20000000;D35*0,05;0)', '=IF(E35>20000000;E35*0,05;0)', '=F35*0,22'],
    // Row 42: Прибыль до НДФЛ
    ['Прибыль до НДФЛ', '=B35-B36-B40-B38-B41', '=C35-C36-C40-C38-C41', '=D35-D36-D40-D41', '=E35-E36-E40-E41', '=F35-F36-F40-F41'],
    // Row 43: НДФЛ (с прогрессией - 15% если >2.4М)
    ['НДФЛ', '0', '0', '=IF(D42>2400000;D42*0,15;D42*0,13)', '=IF(E42>2400000;E42*0,15;E42*0,13)', '=IF(F42>2400000;F42*0,15;F42*0,13)'],
    // Row 44: Бухгалтер
    ['Бухгалтер/год', '0', '12000', '80000', '80000', '150000'],
    // Row 45: Итого нагрузка
    ['ИТОГО нагрузка', '=B40+B38+B41+B43+B44', '=C40+C38+C41+C43+C44', '=D40+D41+D43+D44', '=E40+E41+E43+E44', '=F40+F41+F43+F44'],
    // Row 46: На руки
    ['НА РУКИ', '=B35-B45', '=C35-C45', '=D35-D45', '=E35-E45', '=F35-F45'],
    // Row 47: % нагрузки
    ['% нагрузки', '=B45/B35', '=C45/C35', '=D45/D35', '=E45/E35', '=F45/F35'],
    // Row 48
    [''],

    // === СРАВНЕНИЕ ===
    // Row 49
    ['СРАВНЕНИЕ 2025 vs 2026', '', '', '', '', ''],
    // Row 50
    ['Показатель', 'ИП УСН 6%', 'ИП УСН 15%', 'ООО УСН 6%', 'ООО IT 1%', 'ООО ОСНО'],
    // Row 51: % нагрузки 2025
    ['% нагрузки 2025', '=B31', '=C31', '=D31', '=E31', '=F31'],
    // Row 52: % нагрузки 2026
    ['% нагрузки 2026', '=B47', '=C47', '=D47', '=E47', '=F47'],
    // Row 53: Разница
    ['Изменение', '=B52-B51', '=C52-C51', '=D52-D51', '=E52-E51', '=F52-F51'],
    // Row 54
    [''],
    // Row 55: Лучший 2025
    ['Лучший 2025', '=IF(B30=MAX($B30:$F30);"ЛУЧШИЙ";"")', '=IF(C30=MAX($B30:$F30);"ЛУЧШИЙ";"")', '=IF(D30=MAX($B30:$F30);"ЛУЧШИЙ";"")', '=IF(E30=MAX($B30:$F30);"ЛУЧШИЙ";"")', '=IF(F30=MAX($B30:$F30);"ЛУЧШИЙ";"")'],
    // Row 56: Лучший 2026
    ['Лучший 2026', '=IF(B46=MAX($B46:$F46);"ЛУЧШИЙ";"")', '=IF(C46=MAX($B46:$F46);"ЛУЧШИЙ";"")', '=IF(D46=MAX($B46:$F46);"ЛУЧШИЙ";"")', '=IF(E46=MAX($B46:$F46);"ЛУЧШИЙ";"")', '=IF(F46=MAX($B46:$F46);"ЛУЧШИЙ";"")'],
    // Row 57
    [''],

    // === СЦЕНАРИИ ===
    // Row 58
    ['СЦЕНАРИИ ПО КОЛИЧЕСТВУ САЛОНОВ (2026)', '', '', '', '', ''],
    // Row 59
    ['Салонов', 'Выручка/год', 'НДС 5%?', 'УСН 6%', 'Взносы ИП', '% нагрузки'],
    // Row 60
    ['5', '3 000 000', 'Нет', '180 000', '84 390', '8,8%'],
    // Row 61
    ['20', '12 000 000', 'Нет', '720 000', '174 390', '7,5%'],
    // Row 62
    ['30', '18 000 000', 'Нет', '1 080 000', '234 390', '7,3%'],
    // Row 63
    ['33', '19 800 000', 'Нет', '1 188 000', '252 390', '7,3%'],
    // Row 64
    ['34 (порог!)', '20 400 000', 'ДА +1 020 000', '1 224 000', '258 390', '12,3%'],
    // Row 65
    ['50', '30 000 000', 'ДА +1 500 000', '1 800 000', '321 818', '12,1%'],
    // Row 66
    ['100', '60 000 000', 'ДА +3 000 000', '3 600 000', '321 818', '11,5%'],
    // Row 67
    [''],
    // Row 68
    ['ВНИМАНИЕ: После 33 салонов (20М выручки) добавляется НДС 5%!'],
    // Row 69
    [''],

    // === РЕКОМЕНДАЦИИ ===
    // Row 70
    ['РЕКОМЕНДАЦИИ', '', '', '', '', ''],
    // Row 71
    ['Этап', 'Выручка', 'Режим', '% нагрузки', 'НДС', 'Комментарий'],
    // Row 72
    ['MVP 2025', '<20М', 'ИП УСН 6%', '7-8%', 'Нет', 'Оптимально'],
    // Row 73
    ['Рост 2026', '20-60М', 'ИП УСН 6%', '~12%', 'Да 5%', 'Заложить в цены'],
    // Row 74
    ['Масштаб', '>60М', 'ИП УСН 6%', '11-12%', 'Да 5%', 'Стабильно'],
    // Row 75
    ['Партнёр', 'Любая', 'ООО IT 1%', '~14%', 'Да 5%', 'Если нужны доли'],
  ];

  // Записываем данные
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Tax_Comparison!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: data },
  });

  console.log(`✅ Записано ${data.length} строк`);

  // Получаем ID нового листа для форматирования
  const newSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const newSheet = newSpreadsheet.data.sheets.find(s => s.properties.title === 'Tax_Comparison');
  const sheetId = newSheet.properties.sheetId;

  // Форматирование
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
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 6 },
          properties: { pixelSize: 130 }, fields: 'pixelSize'
        }},
        // Заморозить первую колонку
        { updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenColumnCount: 1 }},
          fields: 'gridProperties.frozenColumnCount'
        }},
        // Форматирование процентов - Row 31 (% нагрузки 2025) - index 30
        { repeatCell: {
          range: { sheetId, startRowIndex: 30, endRowIndex: 31, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0,0%' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Row 47 (% нагрузки 2026) - index 46
        { repeatCell: {
          range: { sheetId, startRowIndex: 46, endRowIndex: 47, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0,0%' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Rows 51-53 (сравнение %) - index 50-52
        { repeatCell: {
          range: { sheetId, startRowIndex: 50, endRowIndex: 53, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0,0%' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Форматирование валюты - множество строк с числами
        { repeatCell: {
          range: { sheetId, startRowIndex: 19, endRowIndex: 30, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '# ##0' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 34, endRowIndex: 46, startColumnIndex: 1, endColumnIndex: 6 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '# ##0' }}},
          fields: 'userEnteredFormat.numberFormat'
        }},
        // Жирные заголовки секций
        { repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 17, endRowIndex: 18, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }}},
          fields: 'userEnteredFormat.textFormat'
        }},
        { repeatCell: {
          range: { sheetId, startRowIndex: 32, endRowIndex: 33, startColumnIndex: 0, endColumnIndex: 1 },
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
  console.error(err.stack);
  process.exit(1);
});
