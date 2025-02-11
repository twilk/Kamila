# CHANGELOG
- Renamed `ProgressManager.js` to `OperationProgressManager.js` for better clarity and consistency
- Updated all imports to reflect the new file name
- Updated documentation to use the new name

# NADRZĘDNA INSTRUKCJA DLA AI 🤖

> **WAŻNE**: Wszystkie komponenty i funkcjonalności są już zaimplementowane w kodzie bazowym. 
> Twoim zadaniem jest WYŁĄCZNIE:
> 1. Odnalezienie istniejących implementacji w kodzie
> 2. Prawidłowe połączenie ich ze sobą
> 3. Wykorzystanie gotowych funkcji i komponentów
> 4. NIE twórz nowych implementacji, jeśli podobna funkcjonalność już istnieje
> 5. Aktualizuj ten TODO po każdym wykonanym zadaniu
> 6. **ZAWSZE** sugeruj się rozwiązaniami zaimplementowanymi w @OLDER_WORKING_SOLUTION
> 7. **ZAWSZE** pracuj z tym plikiem TODO i czyść go po zakończeniu aktualnych prac przechodząc do następnych
> 8. **ZAWSZE** gdy otrzymasz logi błędów:
>    - Zapisz je w odpowiedniej sekcji TODO
>    - Przeanalizuj przyczynę i kontekst błędu
>    - Zaproponuj najbardziej efektywne rozwiązanie
>    - Uwzględnij istniejące komponenty i funkcjonalności
>    - Nie twórz nowych implementacji, jeśli można użyć istniejących
>    - Aktualizuj status zadań związanych z błędem
>    - Dodaj informację o rozwiązaniu w CHANGELOG.md

## Sekcja Błędów i Rozwiązań 🐛

### Aktywne Błędy

1. **[CRITICAL] Błąd Inicjalizacji Managerów**
```typescript
const error: ErrorEntry = {
    timestamp: "2025-02-01T09:05:48.039Z",
    context: "InitializationManager.initialize",
    error: "TypeError: progressManager.getInstance is not a function",
    status: "RESOLVED",
    resolution: "Renamed ProgressManager to OperationProgressManager and fixed imports",
    relatedTasks: [
        "Inicjalizacja Managerów",
        "Progress Bar System"
    ]
};
```

**Analiza:**
- Błąd występuje podczas inicjalizacji managerów
- Główna przyczyna: Nieprawidłowa implementacja OperationProgressManager
- Lokalizacja: services/core/OperationProgressManager.js
- Problem: OperationProgressManager.getInstance nie jest funkcją
- Status: ROZWIĄZANY poprzez zmianę nazwy pliku i poprawę importów

**Proponowane rozwiązanie:**
1. Sprawdzić implementację OperationProgressManager w services/core/managers.js:

Było:
```javascript
export const progressManager = new OperationProgressManager();
```

Jest:
```javascript
export const progressManager = OperationProgressManager.getInstance();
```

2. Zweryfikować kolejność inicjalizacji:
```typescript
const INITIALIZATION_ORDER = [
    'ErrorHandler',
    'EventManager',
    'InitialLoadingManager',
    'OperationProgressManager', // Dodać jeśli brakuje
    // ... pozostałe managery
];
```

2. **[HIGH] Błąd Komunikacji z Popup**
```typescript
const error: ErrorEntry = {
    timestamp: "2025-02-01T09:40:11 - 10:05:15",
    context: "background.js message handling",
    error: "Message sending failed (popup might be closed)",
    status: "NEW",
    relatedTasks: [
        "API Integration",
        "Cache Management"
    ]
};
```

**Analiza:**
- Błąd występuje podczas próby wysłania wiadomości do zamkniętego popup
- Nie jest to krytyczny błąd, ale wymaga lepszej obsługi
- Wpływa na synchronizację danych między background a popup

**Proponowane rozwiązanie:**
1. Dodać sprawdzanie stanu popup przed wysłaniem wiadomości:
```typescript
async function sendMessageToPopup(message) {
    try {
        const views = chrome.extension.getViews({ type: 'popup' });
        if (views.length === 0) {
            // Popup zamknięty - zapisz wiadomość do cache
            await cacheManager.set('pending_messages', message);
            return;
        }
        // Wyślij wiadomość
        await chrome.runtime.sendMessage(message);
    } catch (error) {
        errorHandler.handle(error);
    }
}
```

### Zadania Priorytetowe (na podstawie błędów)

1. [CRITICAL] Naprawa Inicjalizacji Managerów
   - [ ] Poprawić implementację progressManager
   - [ ] Zweryfikować kolejność inicjalizacji
   - [ ] Dodać lepsze logowanie błędów inicjalizacji

2. [HIGH] Ulepszenie Komunikacji Background-Popup
   - [ ] Implementacja kolejki wiadomości
   - [ ] Obsługa scenariusza zamkniętego popup
   - [ ] Mechanizm ponownego próbowania wysłania

# Kamila - Intelligent Assistant DARWINA.PL 🚀

## Progress
```text
[████████░░░░░░░░░░░░] 35% // TODO - adjust to real value in first check
```

## Critical Tasks

### 1. Counter System Optimization 🔄
- [ ] Fix status counting logic in MenuManager:

  ```javascript
  // Should be:
  const status = order.status_id?.toString();
  if (!status) return;
  
  if (status === '5') {
      const dateToCheck = order.ready_date || order.modified_at || order.created_at;
      const orderDate = new Date(dateToCheck);
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      if (orderDate < twoWeeksAgo) {
          counts.OVERDUE++;
      } else {
          counts.READY++;
      }
  } else if (status in ['1', '2', '3']) {
      counts[status]++;
  }
  ```
- [ ] Implement proper cache structure:
  ```javascript
  {
      counts: {
          '1': number,      // NEW
          '2': number,      // CONFIRMED
          '3': number,      // ACCEPTED
          'READY': number,  // Status 5 (< 2 weeks)
          'OVERDUE': number // Status 5 (>= 2 weeks)
      },
      metadata: {
          initialFetch: boolean,
          lastUpdate: number,
          storeId: string
      }
  }
  ```
- [ ] Fix first request issue:
  ```javascript
  if (!options.forceRefresh && this.#hasInitialData) {
      const lastUpdate = await this.#storage.load(CACHE_KEYS.LAST_UPDATE);
      if (lastUpdate) {
          params.modified_from = lastUpdate;
      }
  }
  ```

### 2. Store Selection Enhancement 🏪
- [ ] Improve store change event handling:
  - Clear cache on store change
  - Trigger immediate data refresh
  - Update UI to reflect loading state
- [ ] Fix delivery_id filtering:
  ```javascript
  if (store?.id && store.id !== 'ALL') {
      if (store.deliveryId) {
          params.append('delivery_id', store.deliveryId);
      }
  }
  ```
- [ ] Implement proper ALL stores handling
- [ ] Add store validation
- [ ] Update URL parameters correctly

### 3. API Integration 🔌
- [ ] Fix modified_from parameter logic:
  - Omit on first request
  - Use last update timestamp for subsequent requests
- [ ] Implement proper pagination handling:
  ```javascript
  // Constants
  per_page: '100',  // Maximum items per page
  
  // Status filters
  const statusIds = [
      '1',  // SUBMITTED
      '2',  // CONFIRMED
      '3',  // ACCEPTED
      '5'   // READY
  ].join(',');
  ```
- [ ] Add logging for API response data structure
- [ ] Optimize request flow for better performance
- [ ] Add retry mechanism for failed requests

### 4. Cache Management 💾
- [ ] Implement new cache structure with metadata:
  ```javascript
  {
      [key: string]: {
          value: any,
          expires: number,  // timestamp
          updated: number   // timestamp
      }
  }
  ```
- [ ] Add cache validation checks
- [ ] Implement cache cleanup for old data:
  ```javascript
  // Special keys
  {
      'leadCounts': Object,           // Backward compatibility
      'lastUpdate': number,           // Last update timestamp
      'currentStore': string,         // Current store
      'orderCounts_{storeId}': {     // Counters per store
          data: CounterData,
          timestamp: number
      }
  }
  ```
- [ ] Add cache status monitoring
- [ ] Optimize cache update frequency

### 5. UI/UX Improvements 🎨
- [ ] Add loading states during updates
- [ ] Implement error state displays
- [ ] Add tooltips with status descriptions
- [ ] Improve counter display updates
- [ ] Enhance click handler reliability

## Testing Requirements

### 1. API Integration Tests 🔴
- [ ] Test first-time data load
- [ ] Test subsequent updates
- [ ] Test pagination
- [ ] Test error scenarios

### 2. Cache Tests ⚠️
- [ ] Test cache storage
- [ ] Test cache retrieval
- [ ] Test cache invalidation
- [ ] Test force refresh

### 3. UI Tests 🟡
- [ ] Test counter updates
- [ ] Test click handlers
- [ ] Test store selection
- [ ] Test error displays

## Known Issues

### Counter System
- Incorrect counting for READY/OVERDUE status
- Cache invalidation issues
- Date handling inconsistencies
- Status mapping problems
- Data transformation errors

### Store Selection
- Event handler duplication
- Delivery ID filtering issues
- Store change cache problems
- URL parameter inconsistencies
- ALL stores handling bugs

### API Integration
- Modified_from parameter issues
- Pagination handling problems
- Response processing errors
- Request flow inefficiencies
- Error handling gaps

## Priority Legend
- 🔴 CRITICAL: Must be fixed immediately
- ⚠️ HIGH: Should be fixed in next release
- 🟡 MEDIUM: Important but not urgent
- 🟢 LOW: Nice to have

## Development Guidelines

### Code Structure
```typescript
// Standard cache structure
interface CacheData<T> {
    data: T;
    timestamp: number;
    metadata: {
        storeId: string;
        lastUpdate: number;
        initialFetch: boolean;
    };
}

// Counter structure
interface CounterData {
    '1': number;      // NEW
    '2': number;      // CONFIRMED
    '3': number;      // ACCEPTED
    'READY': number;  // Status 5 (< 2 weeks)
    'OVERDUE': number; // Status 5 (>= 2 weeks)
}
```

### API Guidelines
- Use background.js for API calls
- Implement proper error handling
- Cache responses (5-minute timeout)
- Follow rate limiting guidelines
- Add request/response logging

### Testing Requirements
- Unit tests for utilities
- Integration tests for API flows
- UI tests for components
- Performance tests for cache
- Error handling tests

## Next Steps

1. **Immediate Actions**
   - Fix counter system core issues
   - Resolve store selection bugs
   - Optimize API integration
   - Implement new cache structure
   - Add comprehensive logging

2. **Short-term Goals**
   - Improve error handling
   - Enhance UI/UX
   - Add performance monitoring
   - Update documentation
   - Implement automated tests

3. **Long-term Plans**
   - Add new features
   - Optimize performance
   - Enhance security
   - Improve scalability
   - Add analytics

## Documentation Updates
- Keep this TODO.md updated
- Document all major changes
- Update API documentation
- Maintain code comments
- Create user guides

## Performance Goals
- API response < 1s
- Cache hit ratio > 90%
- UI updates < 100ms
- Error rate < 1%
- Memory usage < 50MB