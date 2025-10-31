# ARCHIVED BAILEYS TEST FILES

## ⚠️ ВНИМАНИЕ: ЭТИ ФАЙЛЫ БОЛЬШЕ НЕ ИСПОЛЬЗУЮТСЯ

Данные файлы были перемещены в архив 20.09.2025, так как они создавали конфликты с основным baileys-whatsapp сервисом.

### Причина архивации:
- Множественные тестовые процессы создавали конфликт сессий WhatsApp
- Вызывали постоянные переподключения с ошибкой "conflict type: replaced"
- Мешали стабильной работе production сервиса

### Для тестирования WhatsApp используйте:
- MCP сервер `@whatsapp` через Claude Code
- Официальный API endpoint `/api/whatsapp/sessions/{companyId}/send`
- НЕ запускайте эти тестовые файлы напрямую!

### Архивированные файлы:
- test-baileys-connection.js
- test-baileys-direct.js
- test-baileys-official-pairing.js
- И другие test-baileys-*.js файлы