# TODO List - Manager Refactoring

## 🚀 Phase 1: Core Restructuring
- [ ] Integrate with Existing OrderManager
  - [ ] Remove dynamic import from DataManager
  - [ ] Use proper getter from managers.js
  - [ ] Update imports in dependent files

- [ ] Fix Circular Dependencies
  - [ ] Remove dynamic import from DataManager
  - [ ] Update StatusManager dependencies
  - [ ] Refactor manager registration order

## 🏗️ Phase 2: Architecture Updates
- [ ] Manager Layers
  - [ ] Core Layer
    - [ ] ErrorHandler
    - [ ] LogManager
    - [ ] EventManager
    - [ ] StorageManager
  - [ ] Service Layer
    - [ ] OrderManager
    - [ ] DataManager
    - [ ] CacheManager
  - [ ] UI Layer
    - [ ] UIManager
    - [ ] StatusManager
    - [ ] ThemeManager

- [ ] State Management
  - [ ] Add BaseManager state
    ```javascript
    #state = {
        initialized: false,
        ready: false,
        error: null
    }
    ```
  - [ ] Implement state checks
  - [ ] Add state events

## 🔄 Phase 3: Event System
- [ ] Core Events
  - [ ] Define event catalog
  - [ ] Implement event validation
  - [ ] Add event logging

- [ ] Event Types
  - [ ] Order Events
    - [ ] orders:needed
    - [ ] orders:available
    - [ ] orders:updated
  - [ ] Data Events
    - [ ] data:ready
    - [ ] data:error
  - [ ] UI Events
    - [ ] ui:ready
    - [ ] ui:error

## 🛠️ Phase 4: Implementation
- [ ] Update Each Manager
  - [ ] ErrorHandler
  - [ ] EventManager
  - [ ] LogManager
  - [ ] OrderManager
  - [ ] DataManager
  - [ ] StatusManager
  - [ ] UIManager
  - [ ] ThemeManager

- [ ] Add Health Checks
  - [ ] Implement isHealthy()
  - [ ] Add getDiagnostics()
  - [ ] Setup recovery system

## 📝 Phase 5: Documentation
- [ ] Update API Docs
  - [ ] Manager methods
  - [ ] Event catalog
  - [ ] State transitions

- [ ] Create Diagrams
  - [ ] Dependency graph
  - [ ] Event flow
  - [ ] State machine

## ✅ Testing & Validation
- [ ] Core Tests
  - [ ] Manager initialization
  - [ ] Event handling
  - [ ] State management

- [ ] Integration Tests
  - [ ] Cross-manager communication
  - [ ] Event propagation
  - [ ] Error handling

## 📊 Monitoring
- [ ] Setup Metrics
  - [ ] Initialization time
  - [ ] Event latency
  - [ ] Error rates

- [ ] Health Checks
  - [ ] Manager status
  - [ ] Dependency status
  - [ ] System diagnostics

## Progress Tracking
```
[█░░░░░░░░░] Phase 1: 10%
[░░░░░░░░░░] Phase 2: 0%
[░░░░░░░░░░] Phase 3: 0%
[░░░░░░░░░░] Phase 4: 0%
[░░░░░░░░░░] Phase 5: 0%
[░░░░░░░░░░] Testing: 0%
[░░░░░░░░░░] Monitoring: 0%
```

## Daily Updates
### YYYY-MM-DD
- Started Phase 1
- Moved OrderManager structure
- Created TODO list

# TODO List


## 🔒 Zasady Rozwoju

> Note: @OLDER_WORKING_SOLUTION refers to @Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042

### 0. Analiza Istniejących Rozwiązań
- **ZAWSZE** sprawdzać działającą implementację w @OLDER_WORKING_SOLUTION
- Analizować flow i logikę działającego kodu przed wprowadzeniem zmian
- Zachować kompatybilność z istniejącymi wzorcami i konwencjami
- Nie wprowadzać niepotrzebnych zmian w działającym przepływie danych
- Dostosować nowe rozwiązania do sprawdzonego flow
- Dokumentować różnice między starą a nową implementacją

### 1. Praca z TODO
- Aktualizować plik TODO.md na bieżąco
- Oznaczać postęp zadań ([x] - zrobione, [o] - w trakcie, [ ] - do zrobienia)
- Dodawać nowe zadania w odpowiednich sekcjach
- Aktualizować status i priorytety zadań

### 2. Zakres Zmian
- Wykonywać dokładnie to, o co poproszono
- Nie wprowadzać zmian "przy okazji"
- Jeśli coś działa i nie jest częścią zadania - nie zmieniać tego
- Każda zmiana musi mieć jasne uzasadnienie

### 3. Obsługa Błędów
- **ZAWSZE** gdy otrzymasz logi błędów:
  - Zapisz je w odpowiedniej sekcji TODO
  - Przeanalizuj przyczynę i kontekst błędu uwzględniając dostęp do poprzedniej i działającej wersji
  - Zaproponuj najbardziej efektywne rozwiązanie
  - Uwzględnij istniejące komponenty i funkcjonalności
  - Nie twórz nowych implementacji, jeśli można użyć istniejących
  - Aktualizuj status zadań związanych z błędem


## 🚨 PRIORYTET: System Liczników

### [o] Flow do Zachowania z @OLDER_WORKING_SOLUTION
- [ ] Inicjalizacja systemu:
  ```js
  // 1. Ładowanie credentials
  await darwinApi.initialize();
  
  // 2. Pobieranie tokenu
  const tokenData = await getDarwinaCredentials();
  
  // 3. Ustawienie interwałów odświeżania
  - checkOrders: co 2 minuty
  - fetchData: co 5 minut
  ```

- [ ] Pobieranie danych:
  ```js
  // 1. Sprawdzenie cache
  const cached = await this.#cache.get(CACHE_KEYS.ORDERS);
  if (cached && !forceRefresh) return cached;
  
  // 2. Pobranie zamówień
  const orders = await this.fetchOrders();
  
  // 3. Przetworzenie i zliczenie
  const counts = this.processOrders(orders);
  
  // 4. Zapis do cache
  await this.#cache.set(CACHE_KEYS.ORDERS, counts);
  ```

- [ ] Obsługa statusów:
  ```js
  // Prawidłowa definicja z @OLDER_WORKING_SOLUTION
  export const STATUS_GROUPS = {
      STORE_PICKUP: [
          API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED,      // 1
          API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED,      // 2
          API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_STORE, // 3
          API_CONFIG.DARWINA.STATUS_CODES.READY,         // 5
          API_CONFIG.DARWINA.STATUS_CODES.PICKED_UP      // 9
      ],
      SHIPPING: [
          API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED_SHIPPING,  // 4
          API_CONFIG.DARWINA.STATUS_CODES.AWAITING_PAYMENT,   // 13
          API_CONFIG.DARWINA.STATUS_CODES.AWAITING_COURIER,   // 8
          API_CONFIG.DARWINA.STATUS_CODES.HANDED_TO_COURIER,  // 6
          API_CONFIG.DARWINA.STATUS_CODES.DELIVERED          // 7
      ],
      SPECIAL: [
          API_CONFIG.DARWINA.STATUS_CODES.ADDITIONAL_CORR,   // 12
          API_CONFIG.DARWINA.STATUS_CODES.REFUND_REQUESTED,  // 11
          API_CONFIG.DARWINA.STATUS_CODES.CANCELLED         // 14
      ]
  };
  
  // Logika filtrowania zamówień
  const filterOrders = (orders, deliveryMethod) => {
      const isPickup = deliveryMethod === DELIVERY_METHODS.PICKUP;
      const relevantStatuses = isPickup ? STATUS_GROUPS.STORE_PICKUP : STATUS_GROUPS.SHIPPING;
      
      return orders.filter(order => {
          const hasValidStatus = relevantStatuses.includes(order.status);
          const hasValidDelivery = isPickup ? 
              order.delivery_method === DELIVERY_METHODS.PICKUP :
              order.delivery_method !== DELIVERY_METHODS.PICKUP;
          
          return hasValidStatus && hasValidDelivery;
      });
  };
  ```

- [ ] Aktualizacja UI:
  ```js
  // 1. Emisja eventu z nowymi danymi
  EventManager.emit('COUNTERS_UPDATED', counts);
  
  // 2. Aktualizacja tooltipów
  UIManager.updateTooltips(counts);
  
  // 3. Animacja zmian
  UIManager.animateCounters(oldCounts, newCounts);
  ```

### [o] Analiza Starego Rozwiązania (@OLDER_WORKING_SOLUTION)
- [ ] ⚠️ Korekta Struktury API i Endpointów:
  ```js
  const API_CONFIG = {
      DARWINA: {
          BASE_URL: 'https://darwina.pl/api',
          ENDPOINTS: {
              ORDERS: '/orders',        // Główny endpoint do pobierania zamówień
              TOKEN: '/auth/access_token'
          }
      }
  };
  ```
- [ ] Weryfikacja Pobierania Statusów:
  - [ ] Usunięcie referencji do nieistniejącego endpointu `/status`
  - [ ] Potwierdzenie, że statusy są częścią odpowiedzi `/orders`
  - [ ] Aktualizacja logiki zliczania bazując na danych z `/orders`

- [ ] Kody Statusów (potwierdzone):
  ```js
  STATUS_CODES: {
      SUBMITTED: 1,        // Złożone
      CONFIRMED: 2,        // Potwierdzone przez Klienta
      ACCEPTED_STORE: 3,   // Przyjęte do realizacji w sklepie
      READY: 5,           // Gotowe do odbioru w sklepie
      // ... inne statusy
  }
  ```
- [ ] Aktualizacja Logiki Zliczania:
  ```js
  async fetchLeadCounts() {
      const counts = {
          submitted: 0,
          confirmed: 0,
          accepted: 0,
          ready: 0
      };
      // Pobieranie wszystkich zamówień z /orders
      const orders = await this.fetchOrders();
      // Zliczanie na podstawie danych z orders
  }
  ```

### [o] Optymalizacja i Rozwój
- [ ] Optymalizacja wydajności cache'owania
  - [ ] Implementacja hierarchicznego cache'owania
  - [ ] Dodanie walidacji TTL per endpoint
  - [ ] System kompresji dla dużych odpowiedzi
- [ ] Rozszerzenie dokumentacji API
- [ ] Dodanie metryk wydajności
- [ ] Dodanie testów integracyjnych
- [ ] Dodanie testów wydajnościowych

### [o] Naprawa Systemu Liczników
- [ ] Implementacja nowej struktury CounterCache z uwzględnieniem:
  - [ ] Statusów z odpowiedzi `/orders`
  - [ ] Metadanych czasowych (ready_date, modified_at, created_at)
  - [ ] Grupowania statusów (STORE_PICKUP, SHIPPING, SPECIAL)
- [ ] Poprawienie logiki zliczania statusów:
  - [ ] Implementacja filtrów zamówień bezpośrednio na danych z `/orders`
  - [ ] Grupowanie według statusów z pojedynczej odpowiedzi
  - [ ] Generowanie podsumowań w locie

### [o] Powiązane Zadania Cache
- [ ] Implementacja nowej struktury cache z metadanymi:
  - [ ] Dodanie pola initialFetch
  - [ ] Dodanie lastUpdate
  - [ ] Dodanie storeId
- [ ] Dodanie walidacji danych w cache
- [ ] Mechanizm invalidacji cache przy zmianie sklepu
- [ ] System czyszczenia starych danych

### [o] Integracja z API dla Liczników
- [ ] Optymalizacja pobierania danych z `/orders`:
  ```js
  async fetchOrders(params = {}) {
      // Dodanie parametrów filtrowania i paginacji
      const queryParams = new URLSearchParams({
          modified_from: params.lastUpdate || '',
          page: params.page || 1,
          per_page: params.perPage || 100
          // Inne parametry filtrowania
      });
      
      const response = await fetch(`${API_CONFIG.DARWINA.BASE_URL}/orders?${queryParams}`);
      return response.json();
  }
  ```
- [ ] Implementacja paginacji dla dużych zbiorów danych
- [ ] Obsługa błędów i ponownych prób
- [ ] Logowanie odpowiedzi API

### [o] UI dla Liczników
- [ ] Dodanie stanów ładowania podczas aktualizacji
- [ ] Implementacja tooltipów z informacjami o statusach
- [ ] Animacje przejść przy zmianie wartości
- [ ] Wskaźniki błędów i statusu aktualizacji

### [o] Testy Systemu Liczników
- [ ] Testy jednostkowe logiki zliczania:
  - [ ] Testy konstruktora i walidacji zależności
  - [ ] Testy liczenia zamówień według statusów
  - [ ] Testy obsługi zamówień przeterminowanych
  - [ ] Testy obsługi nieprawidłowych danych
  - [ ] Testy cache'owania i invalidacji
  - [ ] Testy zmiany aktywnego sklepu

## 📊 Wymagane Dane do Zadań

### 1. Optymalizacja Cache
- [ ] Zebranie aktualnych metryk wydajności:
  - [ ] Czasy odpowiedzi dla różnych operacji cache
  - [ ] Zużycie pamięci per endpoint
  - [ ] Częstotliwość invalidacji cache
- [ ] Analiza logów błędów cache
- [ ] Pomiary rozmiarów danych w cache
- [ ] Analiza wydajności CacheManager.js (16KB, 502 lines)
- [ ] Przegląd zależności z innymi managerami:
  - StorageManager.js
  - DataManager.js
  - StoreManager.js

### 2. Integracja API
- [ ] Zebranie statystyk użycia API:
  - [ ] Liczba zapytań w czasie (obecnie ~855-857 zamówień)
  - [ ] Rozkład typów zapytań
  - [ ] Częstotliwość błędów
- [ ] Analiza timeoutów i błędów:
  - [ ] "Message sending failed (popup might be closed)" - powtarzający się błąd
  - [ ] Problemy z Chrome alarms API
  - [ ] "Failed to load resource: net::ERR_FILE_NOT_FOUND"
- [ ] Przykłady dużych odpowiedzi API
- [ ] Analiza wydajności przetwarzania:
  - [ ] Czas przetwarzania ~855 zamówień (obecnie ~3s)
  - [ ] Opóźnienia między requestami (5min interwał)
  - [ ] Zużycie pamięci podczas przetwarzania
- [ ] Analiza cyklu odświeżania:
  - [ ] Interwały alarmów (fetchData, checkOrders)
  - [ ] Logika "Zbyt wcześnie na odświeżanie danych"
  - [ ] Obsługa równoległych requestów

### 3. UI/UX
- [ ] Pomiary wydajności interfejsu:
  - [ ] FPS w różnych widokach
  - [ ] Czasy renderowania komponentów (obecnie ~10.10ms dla UIManager)
  - [ ] Opóźnienia interakcji
- [ ] Dokumentacja problemów UX:
  - [ ] Problemy z zamykaniem popupu (częste błędy komunikacji)
  - [ ] Problemy z aktualizacją UI podczas przetwarzania
  - [ ] Synchronizacja stanu między popup a background
- [ ] Analiza feedbacku użytkowników
- [ ] Przegląd komponentów UI:
  - [ ] UIManager.js (21KB)
  - [ ] InterfaceManager.js (19KB)
  - [ ] MenuManager.js (19KB)

### 4. Testy
- [ ] Analiza obecnego pokrycia testami
- [ ] Przegląd logów z testów
- [ ] Dokumentacja przypadków testowych z @OLDER_WORKING_SOLUTION
- [ ] Analiza istniejących managerów pod kątem testów:
  - [ ] ErrorHandler.js
  - [ ] InitializationManager.js
  - [ ] OperationProgressManager.js
  - [ ] EventManager.js

### 5. Metryki Wydajności
- [ ] Czasy inicjalizacji managerów:
  - [ ] CacheManager: 4.80ms
  - [ ] UIManager: 10.10ms
  - [ ] EventManager: 0.10ms
  - [ ] AlarmManager: 0.50ms
  - [ ] ConnectionManager: 0.20ms
- [ ] Zużycie pamięci przez główne komponenty:
  - [ ] CacheManager.js: 16KB
  - [ ] UIManager.js: 21KB
  - [ ] MenuManager.js: 19KB
  - [ ] DataManager.js: 13KB
- [ ] Opóźnienia w komunikacji:
  - [ ] Czas odpowiedzi API (obecnie ~1-2s)
  - [ ] Czas przetwarzania danych (~3s dla 855 zamówień)
  - [ ] Czas renderowania UI (~10ms)
- [ ] Częstotliwość odświeżania:
  - [ ] Interwał fetchData: 5 minut
  - [ ] Interwał checkOrders: 2 minuty
  - [ ] Czas pełnego cyklu aktualizacji: ~3-4s

## 🎯 Główne Priorytety

### Optymalizacja API (darwina.pl/api)
- [ ] Konfiguracja TTL dla endpointów
- [ ] Implementacja limitów pamięci per endpoint
- [ ] Automatyczne czyszczenie starych danych

### Optymalizacja Zarządzania Pamięcią
- [ ] Wykorzystanie CacheManager
  - [ ] Integracja z nowym systemem TTL w APIManager
  - [ ] Implementacja limitów pamięci per endpoint
  - [ ] Automatyczne czyszczenie starych danych

- [ ] Usprawnienie StorageManager
  - [ ] Optymalizacja zapisów/odczytów
  - [ ] Implementacja limitów per domena
  - [ ] Lepsze współdzielenie zasobów

### Wyświetlanie Leadów
- [ ] Wykorzystanie OrderService
  - [ ] Integracja z nowym APIManager
  - [ ] Optymalizacja odświeżania danych
  - [ ] Implementacja batch updates

## 📦 Backlog (Po Naprawie Liczników)
- `popup.js`: Optymalizacja renderowania UI
- `background.js`: Implementacja mechanizmu rate limiting dla API
- `services/core/ThemeManager.js`: Dodanie wsparcia dla motywów użytkownika
- `services/core/UIManager.js`: Implementacja systemu animacji
- `services/api/OrderService.js`: Dodanie wsparcia dla masowych operacji
- `services/core/DataManager.js`: Implementacja systemu walidacji danych
- `manifest.json`: Aktualizacja do najnowszych standardów bezpieczeństwa
- `services/core/InitializationManager.js`: Dodanie mechanizmu recovery po błędach
- `services/core/ErrorHandler.js`: Rozszerzenie systemu raportowania błędów
- `config/storage.js`: Implementacja systemu rotacji logów

## 🔍 Metryki Sukcesu dla Liczników

1. Wydajność:
   - Czas aktualizacji liczników < 100ms
   - Użycie pamięci cache < 5MB
   - Opóźnienie UI < 16ms (60 FPS)

2. Dokładność:
   - 100% zgodność z rzeczywistym stanem
   - 0% błędów w klasyfikacji READY/OVERDUE
   - Pełna spójność między widokami

3. Niezawodność:
   - Wskaźnik błędów < 0.1%
   - Dostępność systemu > 99.9%
   - Automatyczne recovery po błędach
