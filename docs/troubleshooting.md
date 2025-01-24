# Troubleshooting Guide 🔧

## Common Issues and Solutions

### 1. Initialization Issues 🚀

#### Problem: Extension fails to initialize
```
Error: Failed to initialize manager: [manager name]
```

**Solutions:**
1. Check browser console for detailed error messages
2. Verify all required managers are registered
3. Check initialization order in `InitializationManager`
4. Verify Chrome storage permissions

#### Problem: Managers initialize in wrong order
```
Error: Required dependency not initialized: [dependency name]
```

**Solutions:**
1. Check `MANAGER_INIT_ORDER` in `InitializationManager`
2. Verify manager dependencies are correctly defined
3. Check for circular dependencies

### 2. Data Loading Issues 📊

#### Problem: Data not refreshing
```
Error: Failed to fetch data from API
```

**Solutions:**
1. Check internet connection
2. Verify API token is valid
3. Clear extension cache
4. Check API endpoint status
5. Verify CORS settings

#### Problem: Cache not working
```
Error: Failed to load from cache
```

**Solutions:**
1. Check Chrome storage quota
2. Verify cache version matches
3. Clear and reinitialize cache
4. Check storage permissions

### 3. UI Issues 🎨

#### Problem: UI elements not updating
```
Error: Failed to update element: [selector]
```

**Solutions:**
1. Verify element selector exists
2. Check UI manager initialization
3. Verify event listeners are attached
4. Clear and rebuild UI elements

#### Problem: Theme not applying
```
Error: Failed to apply theme
```

**Solutions:**
1. Check localStorage permissions
2. Verify theme CSS is loaded
3. Clear theme cache
4. Reinitialize UI manager

### 4. Store Selection Issues 🏪

#### Problem: Store list empty
```
Error: No stores available
```

**Solutions:**
1. Check API connection
2. Verify store data format
3. Clear store cache
4. Check offline mode settings

#### Problem: Store change not persisting
```
Error: Failed to save store selection
```

**Solutions:**
1. Check storage permissions
2. Verify store ID format
3. Clear store selection cache
4. Check event propagation

### 5. Message Display Issues 💬

#### Problem: Messages not showing
```
Error: Failed to show message
```

**Solutions:**
1. Check message container exists
2. Verify message manager initialization
3. Check i18n integration
4. Verify DOM manipulation permissions

#### Problem: Messages not auto-hiding
```
Error: Message timeout failed
```

**Solutions:**
1. Check timer functionality
2. Verify animation classes
3. Clear message queue
4. Check event listener cleanup

### 6. Performance Issues ⚡

#### Problem: Slow initialization
```
Warning: Initialization taking longer than expected
```

**Solutions:**
1. Check manager dependencies
2. Optimize cache usage
3. Reduce initial data load
4. Use parallel initialization where possible

#### Problem: High memory usage
```
Warning: Extension using excessive memory
```

**Solutions:**
1. Clear unused caches
2. Optimize data structures
3. Implement data pagination
4. Reduce event listener count

### 7. Event Handling Issues 📡

#### Problem: Events not triggering
```
Error: Event handler not called
```

**Solutions:**
1. Check event registration
2. Verify event names match
3. Check event bubbling
4. Verify listener cleanup

#### Problem: Event handlers leaking
```
Warning: Multiple event handlers attached
```

**Solutions:**
1. Clean up listeners on dispose
2. Use event delegation
3. Implement handler tracking
4. Verify cleanup in tests

### 8. Error Handling Issues ❌

#### Problem: Errors not caught
```
Uncaught Error: [error message]
```

**Solutions:**
1. Add try-catch blocks
2. Verify error handler initialization
3. Check error propagation
4. Add error boundaries

#### Problem: Error messages not helpful
```
Error: Unknown error occurred
```

**Solutions:**
1. Add context to errors
2. Implement error categorization
3. Add error logging
4. Improve error messages

## Debugging Tools 🛠️

### 1. Chrome DevTools
- Use Elements tab for UI issues
- Use Console for error messages
- Use Network tab for API issues
- Use Application tab for storage issues

### 2. Extension Debugging
```javascript
// Enable debug mode
localStorage.setItem('debug', 'true');

// Check manager state
console.log(managerInstance.getState());

// Monitor events
window.addEventListener('manager:event', console.log);
```

### 3. Testing Tools
```bash
# Run specific test file
npm test -- path/to/test.js

# Debug tests
npm run test:debug

# Check test coverage
npm run test:coverage
```

## Prevention Tips 🛡️

1. **Regular Maintenance**
   - Clear caches periodically
   - Check for memory leaks
   - Monitor error logs
   - Update dependencies

2. **Code Quality**
   - Use TypeScript
   - Add error boundaries
   - Implement logging
   - Write comprehensive tests

3. **Performance**
   - Optimize initialization
   - Use lazy loading
   - Implement caching
   - Monitor resource usage

4. **Security**
   - Validate input data
   - Sanitize output
   - Use content security policy
   - Implement rate limiting

## Support Resources 📚

1. **Documentation**
   - API Reference
   - Testing Guide
   - Architecture Overview
   - Best Practices

2. **Tools**
   - Chrome DevTools
   - Jest Testing Framework
   - TypeScript Compiler
   - ESLint/Prettier

3. **Community**
   - GitHub Issues
   - Stack Overflow
   - Chrome Extensions Forum
   - Developer Discord 