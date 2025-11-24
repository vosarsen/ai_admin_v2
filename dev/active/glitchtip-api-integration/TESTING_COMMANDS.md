# GlitchTip Telegram Bot Commands - Testing Guide

**Бот:** [@AI_Admin_monitor_bot](https://t.me/AI_Admin_monitor_bot)
**Status:** Code deployed, ready for testing

---

## 🧪 Test Commands

### 1. Query Errors - `/errors`

**Test cases:**

```
/errors
```
**Expected:** All errors from last 24 hours

```
/errors 12
```
**Expected:** Errors from last 12 hours

```
/errors whatsapp
```
**Expected:** WhatsApp errors from last 24 hours

```
/errors whatsapp 6
```
**Expected:** WhatsApp errors from last 6 hours

**Output format:**
```
🔍 Ошибки за 24ч:

Найдено: 4 ошибки

1. 🔴 Expired session keys critical
   Счетчик: 5 | ID: `2`
2. 🔴 error: terminating connection...
   Счетчик: 2 | ID: `4`
...
```

---

### 2. Get Statistics - `/glitchtip_stats`

**Test cases:**

```
/glitchtip_stats
```
**Expected:** Stats for last 24 hours (default)

```
/glitchtip_stats 7d
```
**Expected:** Stats for last 7 days

```
/glitchtip_stats неделя
```
**Expected:** Stats for last week (Russian alias)

**Output format:**
```
📊 Статистика GlitchTip за 24h:

• Всего ошибок: 4
• Всего событий: 8

По компонентам:
• unknown: 4 (8 событий)
```

---

### 3. Resolve Issue - `/resolve`

**Test cases:**

```
/resolve
```
**Expected:** Error message with usage instructions

```
/resolve 999
```
**Expected:** Error "Ошибка с ID 999 не найдена"

```
/resolve 2
```
**Expected:** Success message "Ошибка закрыта!"

**Output format:**
```
✅ Ошибка закрыта!

Expired session keys critical
ID: `2`
```

---

### 4. Investigate Error - `/investigate`

**Test cases:**

```
/investigate
```
**Expected:** Error message with usage instructions

```
/investigate 999
```
**Expected:** Error "Ошибка с ID 999 не найдена"

```
/investigate 2
```
**Expected:**
1. "🔍 Запускаю расследование..." (immediate)
2. "✅ Расследование завершено!" (after ~5-10 sec)

**Output format:**
```
🔍 Запускаю расследование для ошибки 2...

Это может занять до 10 секунд.
```

Then:
```
✅ Расследование завершено!

Expired session keys critical
ID: `2`

Результаты добавлены в комментарии к ошибке в GlitchTip.
```

---

## ✅ Testing Checklist

**Phase 3 Commands:**
- [ ] `/errors` - Default (24h)
- [ ] `/errors 12` - Custom hours
- [ ] `/errors whatsapp` - Filter by component
- [ ] `/errors whatsapp 6` - Component + hours
- [ ] `/glitchtip_stats` - Default
- [ ] `/glitchtip_stats 7d` - Custom period
- [ ] `/resolve 2` - Resolve existing issue
- [ ] `/investigate 2` - Run investigation
- [ ] Error handling - Invalid arguments
- [ ] Error handling - Non-existent issue ID

**Expected Results:**
- ✅ All commands respond within 15 seconds
- ✅ Error messages are clear and helpful
- ✅ Russian interface works properly
- ✅ Markdown formatting displays correctly
- ✅ Emojis render correctly (🔴🟡🟢)
- ✅ Issue IDs are copyable (monospace)

---

## 🐛 Known Limitations

1. **No inline buttons** - Commands are text-only (future enhancement)
2. **No pagination** - Shows max 10 results (sufficient for now)
3. **No webhooks** - Manual commands only (Phase 5 will add)
4. **No similar issues** - Investigation script doesn't search similar (deferred Task 1.2)

---

## 📝 Notes

- All commands require `GLITCHTIP_TOKEN` environment variable
- Bot shows error message if token is missing
- Commands are case-sensitive (use lowercase)
- Issue IDs are numeric (e.g., `2`, not `#2`)

---

**Testing Status:** ⏳ Waiting for manual testing
**Last Updated:** 2025-11-24 20:45
**Next:** Complete testing, update tasks.md with results
