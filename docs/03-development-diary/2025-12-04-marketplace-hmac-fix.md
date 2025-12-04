# YClients Marketplace HMAC Verification Fix

**Date:** 2025-12-04
**Author:** Claude Code
**Status:** RESOLVED

## Problem

При попытке модератора YClients подключить тестовый салон 997441 через маркетплейс возникала ошибка:

```
Ошибка безопасности
Неверная подпись данных. Пожалуйста, попробуйте подключиться заново из маркетплейса YClients.
```

## Root Cause

**Документация YClients противоречила реальному алгоритму подписи.**

### Что говорила документация:
```php
// user_data — это JSON, который кодируется алгоритмом base64
// user_data_sign формируется посредством шифрования алгоритмом SHA-256
// раскодированного JSON (user_data) вашим партнерским ключом
$isSignValid = $_GET['user_data_sign'] === hash_hmac('sha256', $userData, PARTNER_TOKEN);
```

Текст говорит "раскодированного JSON", но код показывает `$userData` = `$_GET['user_data']` (base64 строка).

### Что мы реализовали изначально:
```javascript
// НЕПРАВИЛЬНО: подписываем base64 строку
const expectedSign = crypto.createHmac('sha256', PARTNER_TOKEN).update(user_data).digest('hex');
```

### Что оказалось правильным (найдено через debug):
```javascript
// ПРАВИЛЬНО: подписываем декодированный JSON
const decodedUserData = Buffer.from(user_data, 'base64').toString('utf-8');
const expectedSign = crypto.createHmac('sha256', PARTNER_TOKEN).update(decodedUserData).digest('hex');
```

## Debug Process

1. Добавили debug логирование с разными вариантами HMAC:
```javascript
const testSignatures = {
  sha256_base64: crypto.createHmac('sha256', PARTNER_TOKEN).update(user_data).digest('hex'),
  sha256_decoded: crypto.createHmac('sha256', PARTNER_TOKEN).update(decodedUserData).digest('hex'),
  sha1_base64: crypto.createHmac('sha1', PARTNER_TOKEN).update(user_data).digest('hex'),
  sha1_decoded: crypto.createHmac('sha1', PARTNER_TOKEN).update(decodedUserData).digest('hex'),
  md5_concat: crypto.createHash('md5').update(user_data + PARTNER_TOKEN).digest('hex'),
};
```

2. Лог показал:
```json
{
  "match_sha256_base64": false,
  "match_sha256_decoded": true,  // <-- ЭТО СОВПАЛО!
  "match_sha1_base64": false,
  "match_sha1_decoded": false,
  "match_md5_concat": false
}
```

## Solution

**Commit:** `a8210af`

```javascript
// HMAC-SHA256 verification using DECODED JSON (not base64 string!)
// Confirmed via debug: YClients signs the decoded JSON, not the base64 string
// Algorithm: hash_hmac('sha256', base64_decode(user_data), PARTNER_TOKEN)
const decodedUserData = Buffer.from(user_data, 'base64').toString('utf-8');
const expectedSign = crypto.createHmac('sha256', PARTNER_TOKEN).update(decodedUserData).digest('hex');
```

## Files Changed

- `src/api/routes/yclients-marketplace.js` - строки 303-307

## Verification

После исправления:
- HMAC signature verified successfully
- Компания 997441 создана в БД
- Onboarding страница загружается

## Lessons Learned

1. **Документация может быть неточной** - всегда проверяйте реальное поведение API
2. **Debug logging critical** - добавление временного логирования с разными вариантами помогло найти правильный алгоритм за минуты
3. **PHP код != текстовое описание** - в документации YClients текст противоречил коду примера

## Correct Algorithm (Final)

```
YClients HMAC Algorithm:
1. user_data = base64_encoded_json_string (from URL parameter)
2. decoded_json = base64_decode(user_data)
3. signature = HMAC-SHA256(decoded_json, PARTNER_TOKEN)
4. Compare signature with user_data_sign parameter
```

## Related Issues

- Initial problem: `null value in column "company_id"` - fixed in commit `f7e01e9`
- HMAC was initially optional - made mandatory in commit `f32b8ff`
- HMAC algorithm incorrect - fixed in commit `a8210af`

## Timeline

| Time | Event |
|------|-------|
| 10:04 | First HMAC failure detected |
| 10:09 | Debug logging deployed |
| 10:09 | Correct algorithm identified (sha256_decoded) |
| 10:12 | Fix deployed |
| 10:18 | Salon 997441 successfully registered |
