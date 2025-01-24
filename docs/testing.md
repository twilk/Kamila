# Testing Documentation 🧪

## Overview

This document describes testing procedures and guidelines for the DARWINA.PL Chrome Extension.

## Test Structure 📁

```
tests/
├── unit/                 # Unit tests for individual managers
│   ├── messageManager.test.js
│   ├── storeManager.test.js
│   ├── statusManager.test.js
│   ├── dataManager.test.js
│   └── initializationManager.test.js
├── integration/          # Integration tests
│   └── managerSystem.test.js
└── helpers/             # Test helpers and utilities
    └── testUtils.js
```

## Running Tests 🏃‍♂️

### Prerequisites

1. Node.js 14+ installed
2. All dependencies installed (`npm install`)
3. Chrome browser installed

### Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Testing Guidelines 📋

### 1. Unit Tests

Each manager should have comprehensive unit tests covering:

- Initialization
- Core functionality
- Error handling
- Event handling
- Cleanup/disposal

Example unit test structure:

```javascript
describe('SomeManager', () => {
    let manager;
    
    beforeEach(() => {
        // Setup
    });
    
    afterEach(() => {
        // Cleanup
    });
    
    describe('initialization', () => {
        it('should initialize successfully', async () => {
            // Test
        });
        
        it('should handle initialization errors', async () => {
            // Test
        });
    });
    
    describe('core functionality', () => {
        // Core function tests
    });
    
    describe('error handling', () => {
        // Error handling tests
    });
    
    describe('cleanup', () => {
        // Cleanup tests
    });
});
```

### 2. Integration Tests

Integration tests should verify:

- Manager interactions
- System initialization order
- Error propagation
- Event communication
- System stability
- Recovery scenarios

Example integration test structure:

```javascript
describe('Manager System Integration', () => {
    describe('System Initialization', () => {
        // Test initialization order
    });
    
    describe('Inter-Manager Communication', () => {
        // Test manager interactions
    });
    
    describe('Error Recovery', () => {
        // Test system stability
    });
});
```

### 3. Mocking Guidelines 🎭

1. Always mock external dependencies:
   ```javascript
   jest.mock('chrome.storage.local', () => ({
       get: jest.fn(),
       set: jest.fn()
   }));
   ```

2. Mock fetch requests:
   ```javascript
   const mockFetch = jest.fn();
   global.fetch = mockFetch;
   ```

3. Mock manager dependencies:
   ```javascript
   jest.mock('../../services/core/UIManager.js');
   ```

### 4. Test Coverage Requirements 📊

Minimum coverage requirements:

- Statements: 85%
- Branches: 80%
- Functions: 90%
- Lines: 85%

## Common Testing Patterns 🔄

### 1. Testing Async Operations

```javascript
it('should handle async operation', async () => {
    const result = await manager.someAsyncOperation();
    expect(result).toBe(true);
});
```

### 2. Testing Error Handling

```javascript
it('should handle errors', async () => {
    const mockError = new Error('Test error');
    jest.spyOn(someService, 'method')
        .mockRejectedValueOnce(mockError);
        
    await manager.operation();
    expect(errorHandler.handle).toHaveBeenCalledWith(
        mockError,
        expect.any(String),
        expect.any(String),
        expect.any(Object)
    );
});
```

### 3. Testing Events

```javascript
it('should emit events', async () => {
    const eventSpy = jest.spyOn(window, 'dispatchEvent');
    await manager.operation();
    expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
            type: 'event:name'
        })
    );
});
```

## Troubleshooting Tests 🔧

### Common Issues

1. **Async Test Timeouts**
   - Increase timeout: `jest.setTimeout(10000);`
   - Check for unresolved promises

2. **Mock Issues**
   - Clear mocks between tests: `jest.clearAllMocks();`
   - Reset modules: `jest.resetModules();`

3. **Event Testing**
   - Clean up event listeners
   - Use `jest.useFakeTimers()` for timeouts

### Debug Tips

1. Use `console.log` with `--verbose` flag
2. Use Jest's `debug()` function
3. Check test isolation
4. Verify mock implementations

## Best Practices ✨

1. **Test Organization**
   - Group related tests
   - Use descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Mock Usage**
   - Mock at the lowest level possible
   - Verify mock calls
   - Clean up mocks after tests

3. **Assertions**
   - Use specific assertions
   - Check both positive and negative cases
   - Verify side effects

4. **Error Testing**
   - Test error conditions
   - Verify error handling
   - Check recovery scenarios

## CI/CD Integration 🔄

Tests are run automatically on:
- Pull requests
- Merge to main branch
- Release builds

### Pipeline Configuration

```yaml
test:
  script:
    - npm install
    - npm run test:coverage
  coverage:
    report:
      - junit
      - cobertura
  artifacts:
    reports:
      coverage: coverage/
``` 