# NADRZĘDNA INSTRUKCJA DLA AI

> **WAŻNE**: Wszystkie komponenty i funkcjonalności są już zaimplementowane w kodzie bazowym. 
> Twoim zadaniem jest WYŁĄCZNIE:
> 1. Odnalezienie istniejących implementacji w kodzie
> 2. Prawidłowe połączenie ich ze sobą
> 3. Wykorzystanie gotowych funkcji i komponentów
> 4. NIE twórz nowych implementacji, jeśli podobna funkcjonalność już istnieje
> 5. Aktualizuj ten TODO po każdym wykonanym zadaniu

# KAMILA - TODO List

## Overall Progress [⏳ 60%]
```
[██████████████████░░░░░░░░░░░░░░] 60%
```

## 1. Manager System Restructuring [⏳ 90%]
- ✅ Move core managers to services/core directory
- ✅ Implement BaseManager with proper error handling
- ✅ Set up initialization chain
- ✅ Implement singleton pattern for core managers
- ⏳ Create missing managers:
  - ✅ ThemeManager
  - ✅ ProgressManager
  - ✅ NotificationManager
  - ❌ RankingManager
  - ✅ VolumeManager
  - ✅ UpdateManager
  - ✅ RefreshManager
- ✅ Implement manager groups for parallel initialization
- ✅ Add proper dependency management
- ✅ Add manager disposal system

## 2. Singleton Pattern Implementation [⏳ 97%]
- ✅ ErrorHandler
- ✅ EventManager
- ✅ LoadingManager
- ✅ ConnectionManager
- ✅ CacheManager
- ✅ UIManager
- ✅ DebugManager
- ✅ DataManager
- ✅ StoreManager
- ✅ StatusManager
- ✅ ThemeManager
- ✅ ProgressManager
- ✅ MenuManager
- ✅ VolumeManager
- ✅ NotificationManager
- ✅ UpdateManager
- ✅ RefreshManager
- ❌ RankingManager

## 3. Export Centralization [⏳ 50%]
- ✅ Core services exports in services/core/index.js
- ✅ Manager exports in services/managers/index.js
- ✅ API services exports in services/api/index.js
- ❌ Feature managers exports in services/features/index.js
- ❌ UI components exports in services/ui/index.js

## 4. Validation and Testing [⏳ 20%]
- ✅ Base test setup
- ✅ Manager initialization tests
- ❌ Error handling tests
- ❌ Integration tests
- ❌ UI component tests
- ❌ API service tests
- ❌ Performance tests
- ❌ E2E tests

## 5. Documentation Update [⏳ 40%]
- ✅ Update README.md
- ✅ Update startup-chain.md
- ✅ Update NOTES.md
- ❌ Add API documentation
- ❌ Add manager documentation
- ❌ Add component documentation
- ❌ Add test documentation
- ❌ Add deployment guide

## 6. Performance Optimization [⏳ 10%]
- ✅ Implement parallel initialization
- ❌ Optimize manager dependencies
- ❌ Implement lazy loading
- ❌ Add caching strategies
- ❌ Optimize API calls
- ❌ Reduce bundle size
- ❌ Implement code splitting

## 7. Security and Stability [⏳ 15%]
- ✅ Implement proper error handling
- ✅ Add manager disposal
- ❌ Add input validation
- ❌ Implement rate limiting
- ❌ Add request throttling
- ❌ Implement retry strategies
- ❌ Add security headers

## Priority Tasks
1. 🔴 Complete implementation of remaining managers (VolumeManager, UpdateManager, RefreshManager, RankingManager)
2. 🔴 Add tests for all managers, especially the newly implemented ones
3. 🔴 Verify initialization chain with all managers
4. 🟡 Complete documentation for all managers
5. 🟡 Add performance monitoring for initialization
6. 🟢 Implement lazy loading for non-critical managers
7. 🟢 Add caching strategies for manager data

## Legend
- ✅ Completed
- ⏳ In Progress
- ❌ Not Started
- 🔴 High Priority
- 🟡 Medium Priority
- 🟢 Low Priority

# Kamila - Plan Naprawczy Managerów

## Stan Obecny [⏳ 75%]
```
[███████████████████████░░░░░░░░░] 75%
```

### 1. Działające Managery [✅ 15/19]
- Core Services:
  - ✅ ErrorHandler
  - ✅ EventManager
  - ✅ LoadingManager
  - ✅ ConnectionManager
  - ✅ CacheManager
  - ✅ UIManager
  - ✅ DebugManager

- Base & Feature Managers:
  - ✅ DataManager
  - ✅ StoreManager
  - ✅ StatusManager
  - ✅ ThemeManager
  - ✅ ProgressManager
  - ✅ MenuManager
  - ✅ NotificationManager
  - ✅ DebugManager

### 2. Brakujące Managery [❌ 1/19]
- Feature Managers:
  - ❌ RankingManager

## Plan Naprawczy

### 1. Priorytet Wysoki [⏳ 90%]
1. Przywrócenie Base Managers:
   - [✅] ThemeManager - przywrócony
   - [✅] ProgressManager - zaimplementowany
   - [✅] MenuManager - zaimplementowany
   - [✅] VolumeManager - zaimplementowany
   - [✅] NotificationManager - zaimplementowany
   - [✅] UpdateManager - zaimplementowany
   - [✅] RefreshManager - zaimplementowany

### 2. Priorytet Średni [⏳ 0%]
1. Implementacja Feature Managers:
   - [ ] RankingManager - użyć /services/core/RankingManager.js

### 3. Zadania Techniczne [⏳ 0%]
1. Struktura i Zależności:
   - [ ] Sprawdzić zależności między managerami
   - [ ] Zaktualizować kolejność inicjalizacji
   - [ ] Zweryfikować poprawność importów
   - [ ] Sprawdzić cykliczne zależności

2. Testy i Walidacja:
   - [ ] Napisać testy jednostkowe dla każdego managera
   - [ ] Dodać testy integracyjne
   - [ ] Zweryfikować obsługę błędów
   - [ ] Sprawdzić wydajność

## Harmonogram

### Tydzień 1: Base Managers
1. Dzień 1-2:
   - ThemeManager - przywrócenie i testy
   - ProgressManager - implementacja

2. Dzień 3-4:
   - MenuManager - implementacja
   - VolumeManager - implementacja

3. Dzień 5:
   - NotificationManager - implementacja
   - Testy integracyjne Base Managers

### Tydzień 2: Feature Managers
1. Dzień 1-2:
   - LanguageManager - implementacja
   - UpdateManager - implementacja

2. Dzień 3-4:
   - RefreshManager - implementacja
   - RankingManager - implementacja

3. Dzień 5:
   - Testy integracyjne Feature Managers
   - Dokumentacja

## Uwagi
- Każdy manager musi implementować wzorzec Singleton
- Wymagane jest zachowanie kolejności inicjalizacji
- Konieczne jest dodanie logowania dla każdego managera
- Należy zachować kompatybilność wsteczną

## Status Legend
✅ - Completed
⏳ - In Progress
❌ - Not Started

# KAMILA - TODO List

## Work Cycle Status [⏳ 15%]
```
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░] 15%
```

### Current Work Cycle
1. ✅ Event System Implementation
   - ✅ Added event emission methods
   - ✅ Added event subscription system
   - ✅ Implemented event delegation
   - ✅ Added event metrics tracking

2. ⏳ Manager Dependencies Resolution
   - ✅ Fixed EventManager implementation
   - ⏳ Fixing StatusManager UI dependency
   - ❌ Resolving UpdateManager dependencies
   - ❌ Implementing dependency validation

3. ❌ Initialization Chain Repair
   - ❌ Implementing initialization order
   - ❌ Adding state tracking
   - ❌ Adding recovery mechanisms

### Pre-Work Checklist
- [ ] Review current error logs
- [ ] Check manager initialization order
- [ ] Verify dependency graph
- [ ] Create backup of modified files
- [ ] Document planned changes
- [ ] Setup test environment

### Post-Work Verification
- [ ] Run initialization tests
- [ ] Verify error handling
- [ ] Check event propagation
- [ ] Validate UI updates
- [ ] Monitor performance metrics
- [ ] Update documentation

## Critical Issues [⏳ 15%]
```
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░] 15%
```

### 1. Event System Repair [🔴 HIGH]
- [x] Fix EventManager implementation
  - [x] Add proper event emission methods
  - [x] Implement event subscription system
  - [x] Add event bubbling control
  - [x] Implement event delegation properly
- [x] Add event logging and monitoring
- [x] Implement event error recovery

### 2. Manager Dependencies [🔴 HIGH]
- [ ] Fix cyclic dependencies
  - [x] UIManager ↔ MessageManager
  - [ ] StatusManager → UIManager
  - [ ] UpdateManager → EventManager
- [ ] Implement dependency validation
- [ ] Add dependency loading states
- [ ] Create dependency graphs

### 3. Initialization Chain [🔴 HIGH]
- [ ] Fix manager initialization order
- [ ] Add initialization state tracking
- [ ] Implement initialization recovery
- [ ] Add initialization timeouts
- [ ] Create initialization groups

### 4. Error Handling [🟡 MEDIUM]
- [ ] Implement centralized error handling
- [ ] Add error recovery strategies
- [ ] Implement error logging
- [ ] Add error reporting
- [ ] Create error boundaries

### 5. Connection Management [🟡 MEDIUM]
- [ ] Fix API endpoint configuration
- [ ] Implement connection recovery
- [ ] Add offline mode support
- [ ] Implement request queuing
- [ ] Add connection monitoring

## Work Cycle Documentation

### Before Starting Work
1. **Environment Setup**
   - Check workspace status
   - Verify development environment
   - Review current error logs
   - Create backup branch

2. **Issue Analysis**
   - Review error patterns
   - Check dependency graph
   - Analyze initialization order
   - Document affected components

3. **Planning**
   - Create detailed task list
   - Set priority order
   - Define success criteria
   - Plan rollback strategy

### During Work
1. **Implementation**
   - Follow priority order
   - Document changes
   - Add error handling
   - Update tests

2. **Monitoring**
   - Track initialization success
   - Monitor error rates
   - Check performance impact
   - Validate UI updates

3. **Communication**
   - Update work status
   - Document blockers
   - Report progress
   - Share insights

### After Work
1. **Verification**
   - Run test suite
   - Check error logs
   - Verify UI functionality
   - Validate performance

2. **Documentation**
   - Update technical docs
   - Document changes
   - Update status tracking
   - Record insights

3. **Review**
   - Code review
   - Performance review
   - Security check
   - Update TODO list

## Priority Legend
🔴 HIGH - Critical for system stability
🟡 MEDIUM - Important but not blocking
🟢 LOW - Quality of life improvements

## Status Legend
✅ - Completed
⏳ - In Progress
❌ - Not Started

## Store Selector & Status Lead - Status [✅ 100%]

### 1. Store Selector Integration [✅ 100%]
- [x] Wykorzystanie stores.js w StoreManager
- [x] Integracja z systemem logowania (api.js)
- [x] Implementacja cachowania
- [x] Obsługa UI i zdarzeń

### 2. Status Lead Integration [✅ 100%]
- [x] Wykorzystanie konfiguracji statusów z API_CONFIG
- [x] Użycie gotowych funkcji grupowania (STATUS_GROUPS)
- [x] Znalezienie implementacji UI:
  - [x] HTML struktura w popup.html
  - [x] Style w style.css
  - [x] Logika w StatusManager.js
  - [x] Obsługa zdarzeń w popup.js
- [x] Znalezienie implementacji zdarzeń:
  - [x] Emisja store:change w StoreManager.changeStore()
  - [x] Obsługa store:change w DataManager
  - [x] Połączenie StatusManager z systemem zdarzeń

### Zaimplementowane funkcjonalności:
1. Selektor sklepów:
   - Dynamiczne ładowanie listy sklepów
   - Cachowanie wybranego sklepu
   - Emisja zdarzenia store:change przy zmianie
   - Aktualizacja UI po zmianie

2. Status Lead:
   - Wyświetlanie liczników dla każdego statusu
   - Aktualizacja po zmianie sklepu
   - Obsługa błędów i stanu ładowania
   - Animacje przy aktualizacji liczników

### Następne kroki:
✅ Wszystkie zadania zostały wykonane!

## Store Selector & Status Lead Implementation TODO

### 1. Store Selector Integration
- [ ] Modify `StoreManager.js` to use stores from `services/stores.js`
  - Import store definitions and helper functions
  - Use `filterStoresByDeliveryMethod` for delivery-specific filtering
  - Implement store validation using `validateStore`
  - Use `processOrder` for order processing logic

- [ ] Update API Integration
  - Use `API_CONFIG` from `config/api.js` for endpoints
  - Implement proper error handling with `sendLogToPopup`
  - Use `getDarwinaCredentials` for authentication
  - Apply `filterDeliveryResponse` for API responses

### 2. Status Lead Implementation
- [ ] Integrate Status Codes
  - Use `API_CONFIG.DARWINA.STATUS_CODES` for status mapping
  - Implement status grouping using `STATUS_GROUPS`
  - Use `getStatusName` for status display
  - Apply `filterOrders` for status-specific filtering

### 3. UI Updates
- [ ] Store Selector Component
  - Add "All stores" option with proper handling
  - Implement store filtering based on delivery method
  - Add store address display in dropdown
  - Implement proper error states

- [ ] Status Lead Display
  - Show status counts with proper grouping
  - Implement status updates on store change
  - Add proper loading states
  - Implement error handling

### 4. Data Management
- [ ] Cache Implementation
  - Use chrome.storage.local for store preferences
  - Implement proper cache invalidation
  - Add offline support with test data
  - Handle cache version updates

### 5. Testing & Validation
- [ ] Core Functionality
  - Test store selection persistence
  - Validate delivery method filtering
  - Test status updates
  - Verify API integration

- [ ] Edge Cases
  - Handle offline mode
  - Test invalid store IDs
  - Verify error handling
  - Test cache invalidation

### 6. Documentation
- [ ] Update Implementation Notes
  - Document store selection logic
  - Document status handling
  - Add API integration details
  - Document cache management

### Priority Tasks:
1. Fix store selector data population
2. Implement status lead updates
3. Add proper error handling
4. Implement caching
5. Add offline support

### Dependencies:
- services/stores.js
- config/api.js
- config/credentials.json
- config/delivery.js 