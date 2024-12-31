# TODO List

## Critical Tasks (High Priority)
- [ ] Fix import errors in test files:
  - [ ] Update imports in unit tests
  - [ ] Update imports in integration tests
  - [ ] Update imports in startup tests
- [x] Update component imports:
  - [x] PerformanceHUD.js
  - [x] ProgressiveLoader.js
  - [x] HUD.js
- [ ] Update service worker imports:
  - [ ] service-worker.js
  - [ ] background.js
  - [ ] popup.js
- [ ] Fix remaining service imports:
  - [ ] SyncService.js
  - [ ] ui-components.js
  - [ ] UIComponentService.js

## Service Refactoring
- [ ] Migrate old services to new format:
  - [x] PerformanceMonitor.js -> PerformanceMonitorService.js
  - [ ] i18n.js -> I18nService.js
  - [x] DrwnService.js/DarwinApiService.js -> DarwinaService.js
  - [ ] users.js -> UserService.js
  - [ ] userDataService.js -> UserService.js
  - [ ] updateManager.js -> UpdateManagerService.js
  - [x] sellyApi.js -> SellyService.js
- [ ] Verify all services use LogService instead of console.log
- [ ] Implement proper initialization in all services
- [ ] Add proper error handling across all services

## Testing & Validation
- [ ] Create test suite for new service structure
- [ ] Verify all services initialize correctly
- [ ] Test error handling in all services
- [ ] Validate service communication
- [ ] Test cache functionality
- [ ] Verify API integrations

## UI Components
- [ ] Update error boundaries in components
- [ ] Implement loading states
- [ ] Add proper error handling
- [ ] Update notification system
- [ ] Verify component lifecycle

## Documentation
- [ ] Document new service architecture
- [ ] Update API documentation
- [ ] Create service initialization guide
- [ ] Document error handling patterns
- [ ] Update setup instructions

## Technical Debt
- [ ] Remove deprecated files after migration:
  - [ ] DarwinApiService.js (after verifying DarwinaService.js)
  - [ ] DrwnService.js (after verifying DarwinaService.js)
  - [ ] darwinApi.js (after verifying DarwinaService.js)
  - [ ] sellyApi.js (after verifying SellyService.js)
  - [ ] SellyApiService.js (after verifying SellyService.js)
  - [ ] PerformanceMonitor.js (after verifying PerformanceMonitorService.js)
- [ ] Clean up unused imports
- [ ] Standardize error handling
- [ ] Optimize service initialization
- [ ] Implement proper TypeScript types

## Future Improvements
- [ ] Add performance monitoring
- [ ] Implement metrics collection
- [ ] Add automated testing
- [ ] Improve error reporting
- [ ] Enhance debugging tools

## Known Issues
- Import errors in multiple files
- Inconsistent service initialization
- Missing error handling in some services
- Outdated test files
- Multiple versions of same services 