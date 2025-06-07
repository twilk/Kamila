# Kamila – Unified Action Plan (Szczegółowy)

## Zasady Rozwoju

- **Zawsze** sprawdzaj działającą implementację w `OLDER_WORKING_SOLUTION` przed zmianami.
- Analizuj flow i logikę działającego kodu przed refaktorem.
- Zachowuj kompatybilność z istniejącymi wzorcami.
- Nie zmieniaj rzeczy "przy okazji".
- Każda zmiana musi mieć jasne uzasadnienie i być opisana w TODO.
- Aktualizuj TODO.md na bieżąco, oznaczaj postęp ([x] zrobione, [o] w trakcie, [ ] do zrobienia).
- Dokumentuj różnice między starą a nową implementacją.
- Jeśli coś działa i nie jest częścią zadania – nie ruszaj.

---

## Sprint 1: Counter System Overhaul

### Zadania szczegółowe
- [ ] Analiza implementacji w `OLDER_WORKING_SOLUTION`
- [ ] Implementacja nowej struktury:
  ```typescript
  interface CounterCache {
      counts: {
          '1': number; '2': number; '3': number;
          'READY': number; 'OVERDUE': number;
      };
      metadata: { initialFetch: boolean; lastUpdate: number; storeId: string; };
  }
  ```
- [ ] Poprawa logiki zliczania statusów (READY/OVERDUE)
  ```typescript
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
  } else if (['1', '2', '3'].includes(status)) {
      counts[status]++;
  }
  ```
- [ ] Nowa struktura cache z metadanymi, walidacja, invalidacja przy zmianie sklepu, czyszczenie starych danych
- [ ] Integracja z API: optymalizacja modified_from, paginacja, obsługa błędów, logowanie odpowiedzi
- [ ] UI: loading states, tooltips, animacje, wskaźniki błędów
- [ ] Testy: jednostkowe, integracyjne, wydajnościowe, UI

### Metryki sukcesu
- Aktualizacja liczników < 100ms
- Użycie cache < 5MB
- UI < 16ms (60 FPS)
- 100% zgodność z rzeczywistością
- 0% błędów READY/OVERDUE
- Spójność widoków
- Wskaźnik błędów < 0.1%
- Dostępność > 99.9%
- Automatyczne recovery

---

## Sprint 2: API Optimization

### Zadania szczegółowe
- [ ] TTL dla endpointów:
  ```typescript
  const EndpointTTL = {
    '/orders': 5 * 60 * 1000,
    '/auth/access_token': 55 * 60 * 1000,
    default: 15 * 60 * 1000
  };
  ```
- [ ] Rate limiting: kolejka, retry, circuit breaker
  ```javascript
  const RateLimits = {
    perSecond: 10,
    perMinute: 60,
    perHour: 1000,
    burstSize: 20
  };
  ```
- [ ] Caching: stale-while-revalidate, invalidacja, warming
  ```javascript
  const CacheTTL = {
    short: 60 * 1000,
    medium: 5 * 60 * 1000,
    long: 15 * 60 * 1000
  };
  ```
- [ ] Retry policy:
  ```javascript
  const RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
  };
  ```
- [ ] Testy: jednostkowe, integracyjne, monitoring wydajności
- [ ] Monitoring wykorzystania cache:
  ```javascript
  const CacheMetrics = {
    totalSize: 0,
    endpointSizes: new Map(),
    hitRate: 0,
    missRate: 0
  };
  ```
- [ ] Limity cache:
  ```javascript
  const CacheLimits = {
    memory: 20 * 1024 * 1024,
    perEndpoint: 5 * 1024 * 1024
  };
  ```

---

## Sprint 3: Memory Management

### Zadania szczegółowe
- [ ] CacheManager: limity, LRU, kompresja
- [ ] StorageManager: batch ops, wersjonowanie, cleanup
- [ ] Monitoring: metryki, alerty, automatyczne cleanupy
- [ ] Batch Processing:
  ```javascript
  const BatchConfig = {
    maxSize: 10,
    interval: 1000,
    maxRetries: 3
  };
  ```
- [ ] Priorytety aktualizacji:
  ```javascript
  const UpdatePriority = {
    HIGH: ['orders'],
    MEDIUM: ['users', 'stores'],
    LOW: ['metrics', 'reports']
  };
  ```

---

## Backlog (po sprintach)

- Optymalizacja renderowania UI (popup.js)
- Rate limiting w background.js
- Motywy użytkownika (ThemeManager)
- System animacji (UIManager)
- Masowe operacje (OrderService)
- Walidacja danych (DataManager)
- Rotacja logów (config/storage.js)
- Recovery po błędach (InitializationManager)
- Rozszerzenie raportowania błędów (ErrorHandler)
- Aktualizacja manifestu do najnowszych standardów

---

## Monitoring & Ryzyka

### Ryzyka
- Migracja Counter System: spójność danych, wydajność, UX
- Zmiany API: kompatybilność, rate limiting, obsługa błędów
- Zarządzanie pamięcią: utrata danych, wydajność, invalidacja cache
- UI: kompatybilność przeglądarek, wydajność, UX

### Monitoring
- Performance: czasy odpowiedzi, użycie pamięci, cache hit rate
- Errors: wskaźnik błędów, typy, recovery time
- Usage: aktywni użytkownicy, użycie funkcji, wywołania API

### Alerty
- Krytyczne: error rate > 1%, memory > 80%, response > 1s
- Warning: error rate > 0.1%, memory > 60%, response > 500ms

---

## Rozwiązane błędy (historycznie)

1. OrderService Credentials Error ✓
2. Connection Error ✓
3. StoreManager DataManager Error ✓
4. Chrome API Error ✓

Szczegóły rozwiązań i analizy w TODO.md.new (sekcja 🐛 Aktualne Błędy).

---

## Następne Kroki

1. Optymalizacja wydajności
   - [ ] Analiza wykorzystania pamięci
   - [ ] Optymalizacja cache'owania
   - [ ] Redukcja liczby zapytań API
2. Testy i monitoring
   - [ ] Dodanie testów jednostkowych
   - [ ] Implementacja monitoringu błędów
   - [ ] Analiza wydajności
3. Dokumentacja
   - [ ] Aktualizacja dokumentacji technicznej
   - [ ] Dodanie przykładów użycia
   - [ ] Opis rozwiązanych problemów 