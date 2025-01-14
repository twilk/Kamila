# DARWINA.PL Chrome Extension Notes

## Directory Structure
```
services/
├── core/               # Core services and managers
│   ├── BaseManager.js
│   ├── ErrorTypes.js
│   ├── ErrorHandler.js
│   ├── InitLogger.js
│   ├── MetricsManager.js
│   ├── EventManager.js
│   ├── UIManager.js
│   ├── DebugManager.js
│   ├── ConnectionManager.js
│   ├── CacheManager.js
│   └── LoadingManager.js
├── api/                # API related services
│   ├── api.js         # Base API functionality
│   ├── darwinApi.js   # DARWINA API implementation
│   └── userCard.js    # User card service
└── managers/          # Feature managers
    ├── dataManager.js
    ├── menuManager.js
    ├── progressManager.js
    └── ...
```

## Initialization Order
1. Core Services (must be initialized first):
   - InitLogger
   - MetricsManager
   - ErrorHandler
   - UIManager
   - DebugManager
   - EventManager
   - ConnectionManager
   - CacheManager

2. Base Managers:
   - LoadingManager (requires EventManager)
   - ProgressManager (requires EventManager)
   - MenuManager (requires EventManager)
   - VolumeManager (requires EventManager)

3. Feature Managers:
   - DataManager (requires UIManager, CacheManager, ConnectionManager)
   - StatusManager (requires EventManager)
   - UserManager (requires UIManager)
   - InterfaceManager (requires UIManager, EventManager, DebugManager)
   - UpdateManager (requires EventManager)
   - LanguageManager (requires EventManager)
   - RefreshManager (requires DataManager)

## API Structure
- Base API class in api.js exports named API class
- DarwinApi extends base API
- All API services should be in services/api/ directory

## Data Loading Sequences
1. Initial Load (Popup Open):
   ```
   DataManager
   ├── API Configuration
   ├── Credentials
   ├── Cache Check
   │   ├── Valid: Incremental Update
   │   └── Invalid: Full Data Fetch
   └── Store Selection
   ```

2. Order Status Loading:
   ```
   StatusManager
   ├── SUBMITTED Orders (5min)
   ├── CONFIRMED Orders (5min)
   ├── ACCEPTED Orders (15min)
   ├── READY Orders (15min)
   └── Overdue Check (>14 days)
   ```

3. User Data Loading:
   ```
   UserManager
   ├── Profile
   ├── Permissions
   ├── Preferences
   └── Activity History
   ```

4. Store Data Loading:
   ```
   StoreManager
   ├── Available Stores List
   ├── Selected Store Details
   ├── Store Statistics
   └── Store Configuration
   ```

5. Background Updates:
   ```
   RefreshManager
   ├── New Orders Check (1min)
   ├── Counter Updates (5min)
   ├── Status Changes (5min)
   ├── Cache Updates (5min)
   └── Data Validation (15min)
   ```

6. On-Demand Loading:
   ```
   EventManager
   ├── Store Change
   ├── Filter Change
   ├── Manual Refresh
   └── User Actions
   ```

7. Error Handling:
   ```
   ErrorHandler
   ├── Retry Logic (max 3)
   ├── Cache Fallback
   ├── Graceful Degradation
   └── Critical Error Notifications
   ```

## Common Issues
1. Initialization Chain:
   - Always initialize core services first
   - Check dependencies before initializing managers
   - Use proper error handling during initialization

2. Error Handling:
   - Use ErrorType and ErrorSeverity from ErrorTypes.js
   - Always set error handler for managers
   - Log errors through DebugManager

3. Connection Management:
   - Check connection before API calls
   - Use cached data when offline
   - Handle reconnection gracefully

4. Cache Management:
   - Clear cache for previous store before changes
   - Validate data before caching
   - Use proper TTL for cached data

## Current Status
1. Completed:
   - Core services structure
   - Basic error handling
   - Cache management
   - Loading indicators

2. In Progress:
   - API service reorganization
   - Connection management improvements
   - Error recovery strategies

3. Planned:
   - Enhanced offline support
   - Better data validation
   - Performance optimizations