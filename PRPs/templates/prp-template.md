# PRP: [Feature Name]

## Purpose
[1-2 sentences describing why this feature is being built]

## Goal
[The specific end result we want to achieve]

## Success Criteria
- [ ] [Specific, measurable criterion 1]
- [ ] [Specific, measurable criterion 2]
- [ ] [etc.]

## Proposed Codebase Structure

```
src/
├── services/
│   └── [new-service]/
│       ├── index.js
│       └── [other-files].js
├── workers/
│   └── [updates-if-needed].js
└── tests/
    └── [new-service].test.js
```

## Implementation Blueprint

### Phase 1: [Initial Setup]
```javascript
// Pseudocode or key code structure
```

### Phase 2: [Core Implementation]
```javascript
// Main logic
```

### Phase 3: [Integration]
```javascript
// How it connects to existing system
```

## Data Models

### Input Models
```javascript
const InputSchema = {
  // Define expected input structure
};
```

### Output Models
```javascript
const OutputSchema = {
  // Define expected output structure
};
```

### Database Changes
```sql
-- Any new tables or columns needed
```

## AI Prompt Engineering

### Command Definition
```
[NEW_COMMAND:param1,param2]
```

### Prompt Addition
```
When user wants to [action], you should:
1. Use [NEW_COMMAND] to [do something]
2. Format the response as [format]
```

## Validation Loop

### Unit Tests
- [ ] Test [functionality 1]
- [ ] Test [error case 1]
- [ ] Test [edge case 1]

### Integration Tests
- [ ] Test with real YClients API
- [ ] Test with database
- [ ] Test error handling

### Manual Testing
- [ ] Send test message via WhatsApp
- [ ] Verify response format
- [ ] Check logs for errors

## Anti-Patterns to Avoid

1. **Don't**: [Common mistake 1]
   **Do**: [Correct approach 1]

2. **Don't**: [Common mistake 2]
   **Do**: [Correct approach 2]

## Dependencies

### External APIs
- [ ] YClients endpoints: [list specific endpoints]
- [ ] Required permissions: [list permissions]

### Internal Services
- [ ] Depends on: [service names]
- [ ] Updates needed in: [service names]

## Performance Considerations

- Expected load: [requests/minute]
- Cache strategy: [what to cache, TTL]
- Database queries: [number and complexity]

## Security Considerations

- [ ] Input validation for [fields]
- [ ] Authorization checks for [operations]
- [ ] Sensitive data handling for [data types]

## Rollback Plan

If this feature causes issues:
1. [Step 1 to disable/rollback]
2. [Step 2 to restore previous state]
3. [How to identify if rollback is needed]

## Confidence Score: X/10

### High Confidence Areas
- [Area 1]: [Why confident]

### Low Confidence Areas
- [Area 1]: [What's uncertain]

## Questions for Clarification

1. [Question about requirement]
2. [Question about edge case]