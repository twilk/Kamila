# Development Notes

## Architecture Overview

### Core Services Hierarchy
```
BaseManager
├── MetricsManager
├── DataManager
├── CacheManager (new)
├── UIManager
│   └── InterfaceManager
├── ErrorHandler (planned)
├── LoadingManager
├── MenuManager
├── StatusManager
└── MessageHandler (planned)
```

### Import Structure Issues

#### Duplicate Imports in popup.js
```javascript
// Duplicated managers from index.js:
- UpdateManager
- ProgressManager
- LanguageManager
- RankingManager
- MenuManager
- LoadingManager
- StatusManager
- InterfaceManager
```

#### Module Organization
```
services/
├── core/               # Core framework
│   ├── BaseManager.js
│   ├── InitLogger.js
│   ├── MetricsManager.js
│   ├── ErrorHandler.js
│   ├── ErrorTypes.js
│   └── UIManager.js
│
├── managers/          # Feature managers (should be moved here)
│   ├── CacheManager.js
│   ├── DataManager.js
│   ├── MenuManager.js
│   └── ...
│
└── services/         # Business services (should be moved here)
    ├── i18n.js
    ├── api.js
    ├── stores.js
    └── ...
```

### Import Path Issues
1. Direct core imports should be avoided:
   ```javascript
   // Bad
   import { ErrorHandler } from './services/core/ErrorHandler.js';
   
   // Good
   import { ErrorHandler } from './services/index.js';
   ```

2. Duplicate manager definitions:
   - Some managers are imported both from index.js and directly
   - Need to standardize import approach

3. Missing module organization:
   - Core modules in services/core/
   - Feature managers scattered in services/
   - Business services mixed with managers

### Required Changes
1. Reorganize directory structure:
   ```
   services/
   ├── core/      # Framework components
   ├── managers/  # Feature managers
   └── services/  # Business services
   ```

2. Update import paths in index.js:
   ```javascript
   // Core
   export * from './core/index.js';
   
   // Managers
   export * from './managers/index.js';
   
   // Services
   export * from './services/index.js';
   ```

3. Clean up duplicate imports in popup.js:
   - Remove direct imports of managers
   - Use only index.js imports
   - Group imports by type (core/managers/services)

### Service Dependencies
```
DataManager
├── CacheManager (data caching)
├── MetricsManager (performance tracking)
└── ErrorHandler (error handling)

UIManager
├── LoadingManager (loading states)
├── MenuManager (navigation)
└── InterfaceManager (UI components)

MessageHandler (planned)
├── ErrorHandler
└── MetricsManager
```

### Core Functionality Flow
1. **Initialization Chain**
   - BaseManager initialization
   - Dependencies resolution
   - Services startup
   - UI components mounting

2. **Data Flow**
   - API Request → CacheManager check
   - Cache hit/miss handling
   - Data processing
   - UI update

3. **Event System**
   - Chrome Extension messaging
   - Inter-service communication
   - UI event handling
   - Error propagation

### Performance Monitoring
- Operation timing tracking
- Memory usage monitoring
- Cache hit/miss ratio
- API call frequency
- UI render performance

### Current Status

#### Completed
- ✅ Basic manager framework
- ✅ Initialization system
- ✅ Cache system
- ✅ UI optimization
- ✅ Metrics collection

#### In Progress
- 🔄 Error handling system
- 🔄 Message handling
- 🔄 Integration tests
- 🔄 Performance optimization
- 🔄 Module organization

#### Planned
- ⏳ Memory optimization
- ⏳ Full test coverage
- ⏳ Documentation update
- ⏳ Performance benchmarks
- ⏳ Directory restructuring

### Next Development Focus
1. Directory restructuring and import cleanup
2. Error handling system implementation
3. Message handling system
4. Integration tests
5. Performance optimization 