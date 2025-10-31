# Universal Prompts Documentation

## Overview

All AI Admin v2 prompts have been made business-agnostic, removing hardcoded references to specific business types, services, and terminology.

## Changes Implemented

### 1. Removed Business-Specific Terms

**Before:**
- "барбершоп" (barbershop)
- "мастер" (master/specialist)
- Specific services: "стрижки, укладки, бороды"
- Hardcoded examples with specific staff names

**After:**
- Generic "компания" (company)
- Direct use of staff names without titles
- Dynamic service references from context
- Placeholder examples: [услуга], [имя сотрудника]

### 2. Proper Case Handling (Падежи)

Implemented consistent declension rules across all prompts:

| Context | Case | Example |
|---------|------|---------|
| Service booking | Винительный (Accusative) | записал НА стрижку |
| Staff assignment | Дательный (Dative) | записал К Анне |
| Service unavailable | Родительный (Genitive) | занято для стрижки |
| Staff name in message | Именительный (Nominative) | Сергей работает |

### 3. Dynamic Context Usage

All prompts now pull information from context:

```javascript
// Instead of hardcoded:
"У нас барбершоп - делаем стрижки, бороды"

// Now dynamic:
"[список услуг из контекста компании]"
```

### 4. Files Modified

1. **`two-stage-response-prompt.js`**
   - Removed "мастер" references
   - Added declension rules section
   - Made examples generic with placeholders

2. **`two-stage-command-prompt.js`**
   - Removed barbershop-specific validation
   - Made service validation generic

3. **`improved-prompt-v2.js`**
   - Updated to use "сотрудник" instead of "мастер"
   - Removed service-specific examples

## Implementation Guidelines

### When Adding New Prompts

1. **Never hardcode:**
   - Business types
   - Service names
   - Staff titles
   - Company addresses

2. **Always use:**
   - Context variables
   - Declension services for proper cases
   - Generic placeholders in examples

3. **Test with different business types:**
   - Beauty salon
   - Medical clinic
   - Auto service
   - Educational center

### Example: Creating a Booking Message

**Wrong:**
```javascript
`${name}, записал вас на стрижку завтра в 15:00 к мастеру Бари.`
```

**Correct:**
```javascript
`${clientName}, записал вас на ${service.declensions.accusative} ${date} в ${time} к ${staff.declensions.dative}.`
```

## Benefits

1. **Scalability:** One codebase works for any business type
2. **Maintainability:** No need to update prompts for each business
3. **Consistency:** Same behavior across all industries
4. **Localization-ready:** Proper grammar handling for Russian

## Testing Checklist

- [ ] Test with beauty salon context
- [ ] Test with medical clinic context
- [ ] Test with auto service context
- [ ] Verify proper declensions in all messages
- [ ] Confirm no hardcoded terms appear
- [ ] Check staff names appear without "мастер"

## Related Documentation

- [DECLENSION_SYSTEM.md](./DECLENSION_SYSTEM.md) - Declension implementation details
- [SEARCH_SLOTS_IMPROVEMENT.md](./SEARCH_SLOTS_IMPROVEMENT.md) - Service detection logic