# NooblyJS Core - Refactoring Quick Reference

## At a Glance

- **Total Files to Refactor**: 133 core files (in src/)
- **High-Priority Files**: ~100 files
- **Estimated Effort**: 60-80 hours
- **Timeline**: 2-5 weeks (depending on team size)
- **Test Suite**: 89 tests ready to verify changes

## The 3 Main Issues

### 1. Promise Chains → async/await (23 files)
Convert `.then().catch()` to `async/await` with `try/catch`

**Impact**: HIGH | **Effort**: 25-30 hours | **Risk**: LOW

Files: All `/routes/index.js` files + promise-heavy providers

### 2. console.log → Event Emitters (68 files)
Replace console statements with service-based logging

**Impact**: HIGH | **Effort**: 20-25 hours | **Risk**: VERY LOW

Files: Spread across all services (often 1-2 statements per file)

### 3. var → let/const (15 files)
Replace `var` with modern scoping

**Impact**: LOW | **Effort**: 2-3 hours | **Risk**: NEGLIGIBLE

Files: Auth providers, AI providers, caching providers, logging

## Files by Priority

### TIER 1: Routes (Do These First - 14 files)
These are high-impact and follow identical patterns

```
src/caching/routes/index.js
src/logging/routes/index.js
src/queueing/routes/index.js
src/scheduling/routes/index.js
src/notifying/routes/index.js
src/workflow/routes/index.js
src/filing/routes/index.js
src/dataservice/routes/index.js
src/authservice/routes/index.js
src/measuring/routes/index.js
src/requesting/routes/index.js
src/fetching/routes/index.js
src/working/routes/index.js
src/searching/routes/index.js
src/aiservice/routes/index.js
```

### TIER 2: Key Providers (40+ files)
Focus on files with multiple occurrences:

**Auth Providers** (6 files)
- authBase.js, authFile.js, authMemory.js, authGoogle.js, authPassport.js, authApi.js

**Caching Providers** (4 files)
- cachingRedis.js, cachingMemcached.js, cachingFile.js, cachingApi.js

**Queueing Providers** (3 files)
- queueingRedis.js, queueingRabbitMQ.js, queueingApi.js

**Filing Providers** (6+ files)
- filingGit.js, filingS3.js, filingGCP.js, filingLocal.js, filingFtp.js, filingApi.js

**Other** (20+ files)
- AI providers, logging providers, workflow, dataservice, etc.

### TIER 3: Script Libraries & Utils (10+ files)
Lower complexity, isolated from core logic

```
src/queueing/scriptlibrary/client.js
src/logging/scriptlibrary/client.js
src/caching/scriptlibrary/index.js
src/views/js/navigation.js
src/views/modules/monitoring.js
```

## Pattern Quick Guide

### Promise Chain (Before)
```javascript
cache.put(key, value)
  .then(() => res.status(200).send('OK'))
  .catch((err) => res.status(500).send(err.message));
```

### Promise Chain (After)
```javascript
try {
  await cache.put(key, value);
  res.status(200).send('OK');
} catch (err) {
  res.status(500).send(err.message);
}
```

---

### console.log (Before)
```javascript
console.log('Setting changed to:', newValue);
console.error('Error:', error.message);
```

### console.log (After)
```javascript
// Option 1: Use logger service
logger.info(`Setting changed to: ${newValue}`);
logger.error('Error:', error.message);

// Option 2: Use event emitter
this.eventEmitter_.emit('log', { level: 'info', message: '...' });
```

---

### var Declaration (Before)
```javascript
for (var i = 0; i < arr.length; i++) { ... }
```

### var Declaration (After)
```javascript
for (let i = 0; i < arr.length; i++) { ... }
// or
const items = arr.map((item, index) => { ... });
```

## Execution Order

### Week 1-2: Phase 1 - Routes
1. Convert all 14-15 route files
2. Use consistent async/await patterns
3. Run tests after each service's routes are done

### Week 3: Phase 2 - Console Removal
1. Replace all console statements (68 files)
2. Can work in parallel on different services
3. Consider whether to use logger service or event emitters

### Week 4: Phase 3 - var to let/const
1. Systematic find-replace (15 files)
2. Can automate with eslint --fix
3. Low risk, verify tests pass

### Week 5: Phase 4 - Polish
1. Function declaration styles (optional)
2. Code review and final testing
3. Documentation updates

## Testing Checklist

After each refactored file:

```
[ ] ESLint passes (no var, no console in src)
[ ] Syntax is correct (no typos)
[ ] Logic is preserved (same behavior)
[ ] Tests pass (npm test)
[ ] Load tests pass (npm run test-load)
[ ] Error handling improved
[ ] No performance degradation
```

## Reference Files (Already Good)

These show the modern patterns you're aiming for:

- `/src/caching/index.js` - Modern factory with async/await
- `/src/logging/index.js` - Clean async patterns
- `/src/dataservice/index.js` - Well-structured
- `/src/aiservice/index.js` - Good async patterns
- `/src/workflow/index.js` - Complex async done well
- `/src/authservice/index.js` - Modern patterns
- `/src/appservice/` - Good base classes

Study these before starting refactoring to understand the target style.

## Key Tools

- **Testing**: `npm test` (unit tests)
- **Load Testing**: `npm run test-load` (performance)
- **Linting**: ESLint (verify no console, no var)
- **Automation**: `eslint --fix` (can auto-fix var → let)

## Success Criteria

- All 133 src files comply with modern patterns
- 89 tests still pass
- No console.log/error/warn in src/
- No var declarations in src/
- All promise chains converted to async/await
- Code style consistent across all services

## Common Pitfalls to Avoid

1. **Don't break error handling** - Ensure .catch() behavior preserved in try/catch
2. **Don't remove intentional console** - Some might be error reporting
3. **Don't change function signatures** - Keep promises/async consistent
4. **Don't forget nested promises** - Some files have chains 3+ levels deep
5. **Don't skip testing** - Each file should pass tests after refactoring

## Timeline Variants

- **With 1 developer**: 4-5 weeks (sequential work)
- **With 2 developers**: 2-3 weeks (parallel routes + console)
- **With 3 developers**: 1-2 weeks (full parallel coverage)
- **With eslint --fix automation**: Can reduce by 15-20%

## Questions?

Refer to `/REFACTORING_ASSESSMENT.md` for:
- Detailed file-by-file breakdown
- Pattern examples with code
- Service-specific refactoring guides
- Risk assessment per category
- Architecture notes

---

**Last Updated**: 2025-11-04
**Assessment Type**: Complete scope analysis
**Confidence Level**: High (automated pattern detection + manual sampling)
