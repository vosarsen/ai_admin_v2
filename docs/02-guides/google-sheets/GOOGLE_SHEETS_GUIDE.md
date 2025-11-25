# Google Sheets Integration Guide

Руководство по работе с Google Sheets API в проекте AI Admin v2.

## Quick Start

### Credentials

```bash
# Service Account файл
config/google-service-account.json

# Service Account Email (для шаринга таблиц)
ai-admin-financial-sync@gen-lang-client-0505009940.iam.gserviceaccount.com

# Google Cloud Project
gen-lang-client-0505009940
```

### Финансовая модель

```bash
# Spreadsheet ID
1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg

# URL
https://docs.google.com/spreadsheets/d/1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg
```

### Скрипты

| Скрипт | Назначение |
|--------|------------|
| `scripts/notion/read-sheets-data.js` | Чтение всех листов |
| `scripts/notion/fix-scaling-sheet.js` | Исправление листа Scaling |
| `scripts/notion/setup-financial-sheets.js` | Инициализация структуры |
| `scripts/notion/update-scaling-extended.js` | Расширение сценариев |

---

## Важные особенности (Lessons Learned)

### 1. Русская локаль Google Sheets

**КРИТИЧЕСКИ ВАЖНО:** Таблица использует русскую локаль!

```javascript
// ❌ НЕПРАВИЛЬНО - английская локаль
`=B2*0.2`           // точка как десятичный разделитель
`=IF(A2>5,B2,C2)`   // запятая как разделитель аргументов

// ✅ ПРАВИЛЬНО - русская локаль
`=B2*0,2`           // запятая как десятичный разделитель
`=IF(A2>5;B2;C2)`   // точка с запятой как разделитель аргументов
```

### 2. Форматирование ячеек

Форматирование наследуется от ячеек-источников формул. Если формула ссылается на ячейку с форматом `$`, результат тоже будет в `$`.

```javascript
// Очистка форматирования перед применением нового
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  resource: {
    requests: [{
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 100,
          startColumnIndex: 0,
          endColumnIndex: 20
        },
        fields: 'userEnteredFormat'  // очищает только формат, не данные
      }
    }]
  }
});
```

### 3. valueInputOption

```javascript
// USER_ENTERED - интерпретирует формулы и форматирование
valueInputOption: 'USER_ENTERED'

// RAW - вставляет как текст
valueInputOption: 'RAW'
```

### 4. valueRenderOption (для чтения)

```javascript
// FORMATTED_VALUE - как показывается пользователю (с форматом)
valueRenderOption: 'FORMATTED_VALUE'

// UNFORMATTED_VALUE - сырые числа без форматирования
valueRenderOption: 'UNFORMATTED_VALUE'

// FORMULA - показывает формулы вместо значений
valueRenderOption: 'FORMULA'
```

---

## Базовые операции

### Инициализация API

```javascript
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}
```

### Чтение данных

```javascript
async function readData() {
  const sheets = await getSheets();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Scaling!A1:P14',
    valueRenderOption: 'UNFORMATTED_VALUE',  // сырые числа
  });

  return result.data.values;
}
```

### Запись данных

```javascript
async function writeData(data) {
  const sheets = await getSheets();

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Scaling!A1',
    valueInputOption: 'USER_ENTERED',  // парсит формулы
    resource: {
      values: data,
    },
  });
}
```

### Очистка диапазона

```javascript
async function clearRange() {
  const sheets = await getSheets();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Scaling!A:Z',
  });
}
```

### Применение форматирования

```javascript
async function applyFormatting() {
  const sheets = await getSheets();

  // Получить ID листа
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const scalingSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Scaling');
  const sheetId = scalingSheet.properties.sheetId;

  const requests = [
    // Формат рублей для колонки B (строки 2-14)
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,      // 0-indexed, пропускаем header
          endRowIndex: 14,
          startColumnIndex: 1,  // B = 1 (0-indexed)
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER',
              pattern: '#,##0 ₽'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    },
    // Формат процентов
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 1,
          endRowIndex: 14,
          startColumnIndex: 13,  // N = 13
          endColumnIndex: 14
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'PERCENT',
              pattern: '0.0%'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    }
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests }
  });
}
```

---

## Структура финансовой модели

### Листы

| Лист | Назначение |
|------|------------|
| Dashboard | Сводная панель с ключевыми метриками |
| Parameters | Входные параметры (цена, курс, налоги) |
| LLM_Models | Сравнение LLM моделей |
| Infrastructure | Тарифы инфраструктуры по уровням |
| Scaling | Сценарии масштабирования 1-10K салонов |
| Unit_Economics | Юнит-экономика на 1 салон |
| Sensitivity | Анализ чувствительности |
| Pilot_Program | Пилотная программа 30 компаний |
| Pilot_Comparison | Сравнение вариантов пилота |

### Лист Scaling (основной)

| Колонка | Название | Формула |
|---------|----------|---------|
| A | Салоны | Число (1, 5, 10...) |
| B | MRR (₽) | `=A*Parameters!$B$5` |
| C | MRR (USD) | `=B/Parameters!$B$10` |
| D | Rev Share (₽) | `=B*0,2` |
| E | LLM Cost (₽) | `=A*LLM_Models!$D$3` |
| F | LLM Cost (USD) | `=E/Parameters!$B$10` |
| G | Эквайринг (₽) | `=B*0,033` |
| H | Variable Costs | `=D+E+G` |
| I | Infrastructure | `=IF(A<=5;...)` (tiered) |
| J | Profit Before Tax | `=B-H-I` |
| K | Tax (1%) | `=J*0,01` |
| L | Net Profit (₽) | `=J-K` |
| M | Net Profit (USD) | `=L/Parameters!$B$10` |
| N | Margin % | `=L/B` |
| O | Profit/Salon | `=L/A` |
| P | Profit/Founder | `=L/Parameters!$B$7` |

### Ссылки между листами

```javascript
// Parameters!$B$5 = Цена за салон (50,000₽)
// Parameters!$B$7 = Количество учредителей (2)
// Parameters!$B$10 = Курс USD/RUB (~80)
// LLM_Models!$D$3 = Стоимость модели на клиента (367₽)
// Infrastructure!$E$2-5 = Стоимость инфраструктуры по тирам
```

---

## Troubleshooting

### Ошибка `#ERROR!` в формулах

**Причина:** Неправильный разделитель (`.` вместо `,` или `,` вместо `;`)

```javascript
// Проверить формулы
const result = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: 'Scaling!A1:P3',
  valueRenderOption: 'FORMULA',
});
console.log(result.data.values);
```

### Ошибка `#REF!`

**Причина:** Ссылка на несуществующую ячейку или лист

```javascript
// Проверить существование листа
const spreadsheet = await sheets.spreadsheets.get({
  spreadsheetId: SPREADSHEET_ID,
});
console.log(spreadsheet.data.sheets.map(s => s.properties.title));
```

### Форматирование не применяется

**Решение:** Сначала очистить форматирование, потом применить новое

```javascript
// 1. Очистить
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  resource: {
    requests: [{
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 20 },
        fields: 'userEnteredFormat'
      }
    }]
  }
});

// 2. Применить новое
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  resource: { requests: formatRequests }
});
```

### Permission denied (403)

**Причина:** Service account не имеет доступа к таблице

**Решение:**
1. Открыть таблицу в браузере
2. Share → добавить email service account
3. Дать права Editor

```
ai-admin-financial-sync@gen-lang-client-0505009940.iam.gserviceaccount.com
```

### Credential file not found

**Причина:** Файл `config/google-service-account.json` отсутствует

**Решение:**
1. Google Cloud Console → IAM → Service Accounts
2. Найти `ai-admin-financial-sync`
3. Keys → Add Key → Create new key → JSON
4. Сохранить как `config/google-service-account.json`

---

## Паттерны форматирования

### Числа

```javascript
// Рубли
{ type: 'NUMBER', pattern: '#,##0 ₽' }        // 1 234 ₽
{ type: 'NUMBER', pattern: '#,##0.00 ₽' }     // 1 234.56 ₽

// Доллары
{ type: 'NUMBER', pattern: '$#,##0' }         // $1,234
{ type: 'CURRENCY', pattern: '"$"#,##0.00' }  // $1,234.56

// Проценты
{ type: 'PERCENT', pattern: '0%' }            // 75%
{ type: 'PERCENT', pattern: '0.0%' }          // 74.8%
{ type: 'PERCENT', pattern: '0.00%' }         // 74.77%
```

### Текст

```javascript
// Жирный заголовок
{
  repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 16 },
    cell: { userEnteredFormat: { textFormat: { bold: true } } },
    fields: 'userEnteredFormat.textFormat.bold'
  }
}
```

---

## Полезные команды

```bash
# Прочитать все листы
node scripts/notion/read-sheets-data.js

# Исправить лист Scaling
node scripts/notion/fix-scaling-sheet.js

# Инициализировать структуру (осторожно - перезапишет данные!)
node scripts/notion/setup-financial-sheets.js
```

---

## Security Notes

1. **НИКОГДА** не коммитить `config/google-service-account.json` в git
2. Файл должен быть в `.gitignore`
3. Для деплоя использовать environment variables или secrets manager
4. Service account имеет доступ только к конкретной таблице (не ко всему Google Drive)

---

## Ссылки

- [Google Sheets API Reference](https://developers.google.com/sheets/api/reference/rest)
- [googleapis npm](https://www.npmjs.com/package/googleapis)
- [Number Format Patterns](https://developers.google.com/sheets/api/guides/formats#number_format_patterns)

---

*Last updated: 2025-11-25*
