# NADRZĘDNA INSTRUKCJA DLA AI 🤖

> **WAŻNE**: Wszystkie komponenty i funkcjonalności są już zaimplementowane w kodzie bazowym. 
> Twoim zadaniem jest WYŁĄCZNIE:
> 1. Odnalezienie istniejących implementacji w kodzie
> 2. Prawidłowe połączenie ich ze sobą
> 3. Wykorzystanie gotowych funkcji i komponentów
> 4. NIE twórz nowych implementacji, jeśli podobna funkcjonalność już istnieje
> 5. Aktualizuj ten TODO po każdym wykonanym zadaniu
> 6. **ZAWSZE** sugeruj się rozwiązaniami zaimplementowanymi w @Kamila-64f591d795861948ec44ff4897d162f1adb7c4ac
> 7. **ZAWSZE** pracuj z tym plikiem TODO i czyść go po zakończeniu aktualnych prac przechodząc do następnych

# PLAN PRZYWRÓCENIA FUNKCJONALNOŚCI 🎯

## Progress
```text
[████░░░░░░░░░░░░░░░░] 18%
```

## TODO List - Kamila Extension

### 1. Progress Bar System [PRIORYTET: KRYTYCZNY] ⚡

## 0. Progress Bar System [PRIORYTET: KRYTYCZNY] ⚡ - details for 1 ? :)
- [ ] Progress Container Integration
  - [ ] Implementacja w `OperationProgressManager` (na bazie services/core/ProgressManager.js)
    - [ ] Metoda `show(status)` - pokazywanie paska z tekstem statusu
      ```js
      if (this.#hideTimeout) {
          clearTimeout(this.#hideTimeout);
          this.#hideTimeout = null;
      }
      if (this.#progressContainer) {
          this.#progressContainer.classList.remove('d-none');
          if (status) {
              this.setStatus(status);
          }
      }
      ```
    - [ ] Metoda `setProgress(percentage, status)` - aktualizacja procentu i statusu
      ```js
      if (this.#progressBar) {
          const value = Math.min(100, Math.max(0, percentage));
          this.#progressBar.style.width = `${value}%`;
          this.#progressBar.setAttribute('aria-valuenow', value);
          if (status !== null) {
              this.setStatus(status);
          }
      }
      ```
    - [ ] Metoda `setSuccess(message)` - sukces (zielony)
      ```js
      if (this.#progressBar) {
          this.#progressBar.classList.remove('bg-danger', 'bg-warning');
          this.#progressBar.classList.add('bg-success');
          this.setStatus(message);
      }
      ```
    - [ ] Metoda `setError(message)` - błąd (czerwony)
      ```js
      if (this.#progressBar) {
          this.#progressBar.classList.remove('bg-success', 'bg-warning');
          this.#progressBar.classList.add('bg-danger');
          this.setStatus(message);
      }
      ```
    - [ ] Metoda `hide()` - ukrywanie paska
      ```js
      if (this.#progressContainer) {
          this.#progressContainer.classList.add('d-none');
          this.setProgress(0);
          this.setStatus('');
      }
      this.#isVisible = false;
      this.#currentTask = null;
      this.#hideTimeout = null;
      ```
  - [ ] Integracja z `InitialLoadingManager` (na bazie services/core/LoadingManager.js)
    - [ ] Synchronizacja stanów ładowania
      ```js
      #minLoadingTime = 1500; // Minimum loading screen display time
      #startTime = performance.now();
      ```
    - [ ] Obsługa minimum loading time
      ```js
      const currentTime = performance.now();
      const elapsedTime = currentTime - this.#startTime;
      if (elapsedTime < this.#minLoadingTime) {
          const waitTime = this.#minLoadingTime - elapsedTime;
          await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      ```
    - [ ] Animacje przejść
      ```js
      this.#container.classList.add('fade-out');
      await new Promise(resolve => {
          const onTransitionEnd = () => {
              this.#container.style.display = 'none';
              this.#isVisible = false;
              resolve();
          };
          this.#container.addEventListener('transitionend', onTransitionEnd, { once: true });
          setTimeout(() => {
              this.#container.removeEventListener('transitionend', onTransitionEnd);
              resolve();
          }, 500);
      });
      ```
  - [ ] Integracja z UI (na bazie popup.html i styles.css)
    - [ ] HTML struktura
      ```html
      <div class="progress-container hidden">
          <div class="progress-wrapper">
              <div class="progress">
                  <div class="progress-bar" role="progressbar" style="width: 0%" 
                       aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                  </div>
              </div>
              <div class="progress-status">Ładowanie...</div>
              <div class="progress-percentage">0%</div>
          </div>
      </div>
      ```
    - [ ] Style CSS
      ```css
      .progress-container {
          width: 100%;
          background: transparent;
          padding: 8px;
          transition: all 0.3s ease;
      }
      .progress-container .progress {
          height: 5px;
          background: var(--gray-200);
          border-radius: var(--radius-sm);
          overflow: hidden;
      }
      .progress-container .progress-bar {
          background: var(--primary);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      ```

1. Integracja kontenera progress bar
   ```javascript
   - Implementacja HTML/CSS dla paska postępu
   - Dodanie klas dla różnych stanów (.success, .error, .warning)
   - Obsługa animacji fade-in/fade-out
   ```

2. Implementacja OperationProgressManager
   ```javascript
   - show(status) - wyświetlanie paska z komunikatem
   - setProgress(percentage, status) - aktualizacja postępu
   - setSuccess(message) - oznaczenie sukcesu
   - setError(message) - oznaczenie błędu
   - hide() - ukrycie paska
   ```

3. Integracja z InitialLoadingManager
   ```javascript
   - Synchronizacja stanów ładowania
   - Obsługa minimalnego czasu ładowania (1500ms)
   - Animacje przejść (500ms fade-out)
   ```

### 1. Inicjalizacja Managerów [PRIORYTET: WYSOKI] 🚀
1. Optymalizacja kolejności inicjalizacji
   ```javascript
   - Implementacja zależności zgodnie z diagramem
   - Lazy loading dla niekrytycznych managerów
   - Pomiary wydajności inicjalizacji
   ```

2. System obsługi błędów
   ```javascript
   - Implementacja poziomów błędów (LOW -> CRITICAL)
   - Strategie retry z exponential backoff
   - Centralne logowanie przez ErrorHandler
   ```

3. Czyszczenie zasobów
   ```javascript
   - Implementacja dispose() dla każdego managera
   - Sekwencja zamykania aplikacji
   - Zachowanie krytycznych danych
   ```

### 2. Integracja API [PRIORYTET: WYSOKI] 🌐
1. Implementacja OrderService
   ```javascript
   - Obsługa autoryzacji
   - Zarządzanie tokenami
   - Retry logic dla requestów
   ```

2. Cache System
   ```javascript
   - Cache dla odpowiedzi API
   - TTL per store (5 minut)
   - Fallback na cache przy błędach
   ```

3. Monitoring
   ```javascript
   - Śledzenie czasów odpowiedzi
   - Logowanie błędów API
   - Metryki użycia cache
   ```

### 3. UI/UX Enhancements [PRIORYTET: ŚREDNI] 💅
1. Responsywność
   ```javascript
   - Optymalizacja dla różnych rozdzielczości
   - Dostosowanie layoutu popup
   - Obsługa dark/light mode
   ```

2. Animacje
   ```javascript
   - Płynne przejścia między stanami
   - Wskaźniki ładowania
   - Feedback dla akcji użytkownika
   ```

3. Dostępność
   ```javascript
   - ARIA labels
   - Keyboard navigation
   - Screen reader support
   ```

### 4. Optymalizacje [PRIORYTET: NISKI] 🔧
1. Performance
   ```javascript
   - Batch DOM updates
   - Event delegation
   - Memoizacja heavy computations
   ```

2. Memory Management
   ```javascript
   - Czyszczenie event listeners
   - Optymalizacja cache size
   - Garbage collection hints
   ```

3. Monitoring
   ```javascript
   - Performance marks
   - Memory usage tracking
   - Error rate monitoring
   ```

### 5. Security [PRIORYTET: WYSOKI] 🔒
1. Data Protection
   ```javascript
   - Szyfrowanie danych wrażliwych
   - Secure storage access
   - Czyszczenie przy wylogowaniu
   ```

2. Communication
   ```javascript
   - HTTPS enforcement
   - Request/Response validation
   - XSS prevention
   ```

3. Permissions
   ```javascript
   - Minimum required permissions
   - Content security policy
   - API scope limitations
   ```

## 0.5. Analiza Flow Danych Lead Status [PRIORYTET: KRYTYCZNY] 📊

### Zarządzanie sklepami
1. Struktura danych sklepu (services/stores.js)
   ```js
   // Format danych sklepu
   {
     id: string,           // Identyfikator sklepu (np. 'EKO', 'FIL')
     name: string,         // Nazwa wyświetlana
     address: string,      // Adres fizyczny
     deliveryId: number,   // ID punktu dostawy w API
     drwn: string         // Identyfikator w systemie DARWINA
   }

   // Przykład store ALL (specjalny przypadek)
   { 
     id: 'ALL', 
     name: 'Wszystkie sklepy', 
     deliveryId: null, 
     drwn: null 
   }
   ```

2. Zarządzanie stanem (services/core/StoreManager.js)
   ```js
   class StoreManager extends BaseManager {
     // Cache configuration
     static CACHE_CONFIG = {
       key: 'store_data',
       expiration: 24 * 60 * 60 * 1000, // 24h
       version: '1.0'
     };

     // Private fields
     _currentStore = null;
     _stores = new Map();
     _isLoading = false;

     // Inicjalizacja
     async onInitialize() {
       await this._loadStores();      // Ładowanie listy sklepów
       this._setupStoreSelector();     // Setup UI
       await this._loadLastStore();    // Przywrócenie ostatniego wyboru
     }
   }
   ```

3. Integracja z UI
   ```js
   // Setup selektora sklepów
   _setupStoreSelector() {
     this._uiManager.safeUpdateElement('#store-select', select => {
       // Dodanie opcji "Wszystkie sklepy"
       const allStores = stores.find(s => s.id === 'ALL');
       if (allStores) {
         const option = document.createElement('option');
         option.value = allStores.id;
         option.textContent = allStores.name;
         select.appendChild(option);
       }

       // Dodanie pozostałych sklepów
       Array.from(this._stores.values())
         .filter(store => store.id !== 'ALL')
         .sort((a, b) => a.name.localeCompare(b.name))
         .forEach(store => {
           const option = document.createElement('option');
           option.value = store.id;
           option.textContent = `${store.name} - ${store.address || ''}`;
           select.appendChild(option);
         });
     });
   }
   ```

### Flow danych
1. Źródło danych: `darwina.pl/api/orders`
   ```js
   // Parametry zapytania z uwzględnieniem sklepu
   {
     store: storeManager.getCurrentStore()?.id,  // ID aktualnego sklepu
     delivery_id: storeManager.getCurrentStore()?.deliveryId,
     modified_from: lastSyncTime,
     limit: 50
   }
   ```

2. Przetwarzanie odpowiedzi z filtrowaniem per sklep
   ```js
   // Filtrowanie zamówień dla sklepu
   const filteredOrders = orders.filter(order => {
     const store = storeManager.getCurrentStore();
     if (!store || store.id === 'ALL') return true;
     return order.store_id === store.id;
   });

   // Format odpowiedzi z API (rozszerzony)
   {
     data: [
       {
         id: number,
         status_id: 1|2|3,
         created_at: string,
         modified_at: string,
         delivery_id: number,
         store_id: string,           // ID sklepu (np. 'EKO', 'FIL')
         store_name: string,         // Nazwa sklepu
         store_address: string       // Adres sklepu
       }
     ],
     meta: {
       total: number,
       page: number,
       pages: number,
       store_id: string,            // ID aktualnego sklepu
       delivery_id: number          // ID punktu dostawy
     }
   }
   ```

3. Mapowanie statusów (z uwzględnieniem sklepu)
   ```js
   const statusMap = {
     'submitted': { 
       id: 1, 
       label: 'Wysłane', 
       icon: '📤',
       tooltip: (store) => `Zamówienia wysłane do ${store?.name || 'wszystkich sklepów'}`
     },
     'confirmed': { 
       id: 2, 
       label: 'Potwierdzone', 
       icon: '✅',
       tooltip: (store) => `Zamówienia potwierdzone przez ${store?.name || 'wszystkie sklepy'}`
     },
     'accepted': { 
       id: 3, 
       label: 'Zaakceptowane', 
       icon: '📦',
       tooltip: (store) => `Zamówienia zaakceptowane w ${store?.name || 'wszystkich sklepach'}`
     },
     'ready': { 
       label: 'Gotowe', 
       icon: '📬',
       tooltip: (store) => `Zamówienia gotowe do odbioru w ${store?.name || 'wszystkich sklepach'}`
     },
     'overdue': { 
       label: 'Zaległe', 
       icon: '⏳',
       tooltip: (store) => `Zaległe zamówienia w ${store?.name || 'wszystkich sklepach'}`
     }
   };
   ```

4. Przechowywanie w pamięci (z integracją StoreManager)
   ```js
   class OrderStore {
     #orders = new Map();              // Mapa wszystkich zamówień
     #ordersByStore = new Map();       // Mapa zamówień per sklep
     #counts = new Map();              // Liczniki per sklep

     constructor() {
       // Subskrypcja na zmiany sklepu
       window.addEventListener('store:change', async ({ detail }) => {
         const { storeId } = detail;
         await this.updateStore(storeId);
       });
     }
     
     // Aktualizacja przy zmianie sklepu
     async updateStore(storeId) {
       const store = storeManager.getCurrentStore();
       if (!store) return;

       // Pobierz/odśwież dane dla sklepu
       if (!this.#ordersByStore.has(storeId)) {
         const orders = await this.fetchOrdersForStore(storeId);
         this.#ordersByStore.set(storeId, orders);
       }

       // Aktualizuj liczniki dla aktualnego sklepu
       this.#updateCountsForStore(storeId);
     }

     // Aktualizacja liczników per sklep
     #updateCountsForStore(storeId) {
       const orders = this.#ordersByStore.get(storeId) || [];
       const counts = {
         submitted: 0,
         confirmed: 0,
         accepted: 0,
         ready: 0,
         overdue: 0
       };

       orders.forEach(order => {
         const status = this.#mapStatus(order.status_id);
         counts[status]++;
         
         if (status === 'accepted' && this.#isReady(order)) {
           counts.ready++;
         }
         
         if (this.#isOverdue(order)) {
           counts.overdue++;
         }
       });

       this.#counts.set(storeId, counts);
       this.#updateUI(counts);
     }
   }
   ```

5. Filtrowanie per sklep
   ```js
   class OrderStore {
     // Metoda filtrowania zamówień dla sklepu
     getOrdersForStore(storeId) {
       // Jeśli ALL, zwróć wszystkie zamówienia
       if (storeId === 'ALL') {
         return Array.from(this.#orders.values()).flat();
       }
       return this.#ordersByStore.get(storeId) || [];
     }
     
     // Aktualizacja filtrów przy zmianie sklepu
     async updateStore(storeId) {
       const store = storeManager.getCurrentStore();
       if (!store) return;

       // Pobierz/odśwież dane dla sklepu
       if (!this.#ordersByStore.has(storeId)) {
         const orders = await this.fetchOrdersForStore(storeId);
         this.#ordersByStore.set(storeId, orders);
       }

       // Aktualizuj liczniki
       this.#updateCountsForStore(storeId);
     }

     // Pobieranie zamówień dla sklepu
     async fetchOrdersForStore(storeId) {
       const store = storeManager.getCurrentStore();
       if (!store) return [];

       const params = {
         store: store.id,
         delivery_id: store.deliveryId,
         modified_from: this.#lastSyncTime
       };

       return await this.fetchOrders(params);
     }
   }
   ```

6. Aktualizacja UI z uwzględnieniem sklepu
   ```js
   class OrderStore {
     // Aktualizacja UI
     #updateUI(counts) {
       const store = storeManager.getCurrentStore();
       
       // Aktualizacja liczników
       Object.entries(counts).forEach(([status, count]) => {
         const countElement = document.querySelector(`#count-${status}`);
         if (countElement) {
           countElement.textContent = count.toString();
         }
       });

       // Aktualizacja tooltipów
       document.querySelectorAll('[data-status]').forEach(element => {
         const status = element.dataset.status;
         const tooltip = statusMap[status]?.tooltip?.(store) || '';
         element.setAttribute('title', tooltip);
       });

       // Aktualizacja nagłówka
       const header = document.querySelector('#store-header');
       if (header) {
         header.textContent = store ? 
           `Zamówienia - ${store.name}` : 
           'Wszystkie zamówienia';
       }
     }
   }
   ```

### Kroki implementacji
1. [ ] Implementacja `OrderStore`
   - [ ] Struktura danych
     ```js
     class OrderStore {
       #orders = new Map();              // Wszystkie zamówienia
       #ordersByStore = new Map();       // Zamówienia per sklep
       #counts = new Map();              // Liczniki per sklep
       #lastSyncTime = null;             // Ostatnia synchronizacja
       #currentStore = null;             // Aktualny sklep
     }
     ```
   - [ ] Metody CRUD
     ```js
     // Create/Update
     async addOrUpdateOrder(order) {
       const { store_id } = order;
       if (!this.#orders.has(store_id)) {
         this.#orders.set(store_id, new Map());
       }
       this.#orders.get(store_id).set(order.id, order);
       await this.updateStore(store_id);
     }

     // Read
     getOrder(orderId, storeId) {
       return this.#orders.get(storeId)?.get(orderId);
     }

     // Delete
     async removeOrder(orderId, storeId) {
       this.#orders.get(storeId)?.delete(orderId);
       await this.updateStore(storeId);
     }
     ```
   - [ ] Logika liczników
     ```js
     #updateCountsForStore(storeId) {
       const orders = this.getOrdersForStore(storeId);
       const counts = this.#calculateCounts(orders);
       this.#counts.set(storeId, counts);
       this.#updateUI(counts);
     }
     ```
   - [ ] Filtrowanie per sklep
     ```js
     getFilteredOrders(filters = {}) {
       const orders = this.getOrdersForStore(this.#currentStore?.id);
       return orders.filter(order => {
         if (filters.status && order.status_id !== filters.status) return false;
         if (filters.delivery && order.delivery_id !== filters.delivery) return false;
         return true;
       });
     }
     ```

2. [ ] Integracja z API
   - [ ] Implementacja fetchOrders
     ```js
     async fetchOrders(params = {}) {
       const store = storeManager.getCurrentStore();
       if (!store) return [];

       const defaultParams = {
         store: store.id,
         delivery_id: store.deliveryId,
         modified_from: this.#lastSyncTime,
         limit: 50
       };

       return await this.fetchWithRetry('/api/orders', {
         ...defaultParams,
         ...params
       });
     }
     ```
   - [ ] Obsługa paginacji
     ```js
     async fetchAllOrders(params = {}) {
       let page = 1;
       let allOrders = [];
       let hasMore = true;

       while (hasMore) {
         const response = await this.fetchOrders({
           ...params,
           page
         });

         allOrders = [...allOrders, ...response.data];
         hasMore = page < response.meta.pages;
         page++;
       }

       return allOrders;
     }
     ```

## 1. Order Management System [PRIORYTET: WYSOKI] 📦
- [ ] API Integration (`darwina.pl/api/orders`)
  - [✅] Implementacja `OrderService.fetchOrders` [ZROBIONE ✅]
    - ✅ Parametry: store (optional), options (modified_from)
    - ✅ Obsługa filtrów: delivery_id, status_id
    - ✅ Paginacja (limit: 50)
    - ✅ Transformacja danych
  - [ ] Retry logic (max 3 próby) [NASTĘPNE ZADANIE 👉]
    - Implementacja w `BaseManager`
    - Obsługa timeoutów
    - Exponential backoff

- [ ] Store-based Filtering 🏪
  - [ ] Implementacja `StoreManager`
    - Metoda `changeStore`
    - Walidacja store.id i store.deliveryId
    - Cache per store
  - [ ] Integracja z UI
    - Dropdown wyboru sklepu
    - Aktualizacja widoku

- [ ] Status Tracking 📊
  - [ ] Implementacja `StatusManager`
    - Mapowanie statusów (1,2,3,READY)
    - Logika OVERDUE (>14 dni)
    - Liczniki per status
  - [ ] Aktualizacja w czasie rzeczywistym
    - Event handling
    - UI sync

- [ ] Auto-refresh System 🔄
  - [ ] Implementacja `RefreshManager`
    - Interwał: 5 minut
    - Smart refresh (tylko zmienione)
    - Obsługa błędów sieci

## 2. Cache & Storage System [PRIORYTET: WYSOKI] 💾
- [ ] Intelligent Caching
  - [ ] Implementacja `CacheManager`
    - Hierarchiczne cache'owanie
    - Kompresja danych (>50KB)
    - Priorytety (HIGH/MEDIUM/LOW)
  - [ ] Wersjonowanie cache'u
    - Struktura wersji w `CacheConfig`
    - Migracja danych
    - Walidacja wersji

- [ ] Store-specific Data
  - [ ] Implementacja w `StorageManager`
    - Quota management
    - Lock system (timeout: 5s)
    - Cleanup strategies

## 3. Error Handling System [PRIORYTET: WYSOKI] ⚠️
- [ ] Core Error Recovery
  - [ ] Implementacja `ErrorHandler`
    - Typy błędów (network, cache, api, etc.)
    - Poziomy błędów (LOW/MEDIUM/HIGH/CRITICAL)
    - Strategie recovery (retry, fallback, reset)
  - [ ] System powiadomień
    - UI notifications
    - Console logging
    - Error tracking

- [ ] Connection Management
  - [ ] Implementacja w `NetworkManager`
    - Online/offline detection
    - Connection quality monitoring
    - Automatic reconnection

## 4. UI Components [PRIORYTET: ŚREDNI] 🎨
- [ ] Counter System
  - [ ] Implementacja w `UIManager`
    - Animacje liczników
    - Status indicators
    - Loading states
  - [ ] Integracja z EventManager
    - Event handling
    - State synchronization

- [ ] Manual Controls
  - [ ] Implementacja kontrolek
    - Refresh button
    - Store selector
    - Status filters
  - [ ] Integracja z managerami
    - Event binding
    - State management

## 5. Performance Optimization [PRIORYTET: ŚREDNI] ⚡
- [ ] Response Times
  - [ ] Storage operations (<100ms)
    - Batch operations
    - Async processing
    - Queue management
  - [ ] Cache optimization
    - Hit ratio monitoring
    - Compression strategies
    - Priority management

- [ ] Resource Management
  - [ ] Implementacja w `MetricsManager`
    - Storage quota monitoring
    - Memory usage tracking
    - Performance metrics

## 6. Testing & Validation [PRIORYTET: NISKI] 🧪
- [ ] Core Testing
  - [ ] Unit tests dla managerów
  - [ ] Integration tests
  - [ ] Error handling tests

- [ ] Performance Testing
  - [ ] Response time benchmarks
  - [ ] Resource usage monitoring
  - [ ] Stress testing

# AKTUALNY STATUS 📊
- Order Management: 10% 🚀
- Cache System: 0% ⏳
- Error Handling: 0% ⏳
- UI Components: 0% ⏳
- Performance: 0% ⏳
- Testing: 0% ⏳

# NASTĘPNE KROKI 📝
1. ✅ Implementacja `OrderService.fetchOrders` [ZROBIONE]
2. ⏳ Implementacja retry logic [NASTĘPNE]
3. ⌛ Konfiguracja systemu cache
4. ⌛ Implementacja statusów zamówień
5. ⌛ Dodanie auto-refresh

### API i Paginacja

1. Struktura zapytania API
   ```js
   // Bazowe parametry zapytania
   const baseParams = {
     page: 1,
     limit: 50,
     status_id: [1, 2, 3, 5].join(','),  // Filtrowanie po statusach
     date_from: yesterday.toISOString().split('T')[0],
     date_to: now.toISOString().split('T')[0]
   };

   // Dodatkowe parametry dla sklepu
   if (store && store.id !== 'ALL') {
     baseParams.delivery_id = store.deliveryId;
   }

   // URL z parametrami
   const url = `${API_CONFIG.DARWINA.BASE_URL}${API_CONFIG.DARWINA.ENDPOINTS.ORDERS}?${new URLSearchParams(baseParams)}`;
   ```

2. Obsługa paginacji
   ```js
   async fetchAllOrders(params = {}) {
     let page = 1;
     let allOrders = [];
     let hasMore = true;

     while (hasMore) {
       // Pobierz stronę
       const response = await this.fetchOrders({
         ...params,
         page
       });

       // Dodaj zamówienia do listy
       if (response.data) {
         allOrders = [...allOrders, ...response.data];
       }

       // Sprawdź czy są kolejne strony
       const totalPages = response.meta.page_count || 1;
       hasMore = page < totalPages;
       page++;

       // Log postępu
       this.log(LogLevel.DEBUG, `📑 Fetched page ${page-1}/${totalPages}`);
     }

     return allOrders;
   }
   ```

3. Retry Logic
   ```js
   async fetchWithRetry(url, options = {}) {
     let attempts = 0;
     const maxRetries = 3;

     while (attempts < maxRetries) {
       try {
         const response = await fetch(url, {
           ...options,
           headers: {
             'Authorization': `Bearer ${this.#credentials.token}`,
             'Content-Type': 'application/json',
             ...options.headers
           }
         });

         if (!response.ok) {
           throw new Error(`API request failed: ${response.status}`);
         }

         return await response.json();
       } catch (error) {
         attempts++;
         this.log(LogLevel.ERROR, `❌ API request failed (attempt ${attempts}/${maxRetries})`, {
           error: error.message,
           url
         });

         if (attempts >= maxRetries) {
           throw error;
         }

         // Exponential backoff
         await new Promise(resolve => 
           setTimeout(resolve, Math.pow(2, attempts) * 1000)
         );
       }
     }
   }
   ```

4. Caching odpowiedzi
   ```js
   async fetchOrders(store = null, options = {}) {
     const cacheKey = `orders_${store?.id || 'ALL'}`;
     
     // Sprawdź cache
     const cachedData = await this.#cache.get(cacheKey);
     if (cachedData && !options.forceRefresh) {
       this.log(LogLevel.INFO, '📦 Using cached data', {
         store: store?.id || 'ALL',
         timestamp: new Date(cachedData.timestamp).toISOString()
       });
       return cachedData.data;
     }

     // Pobierz dane z API
     const data = await this.fetchAllOrders(store, options);
     
     // Zapisz w cache
     await this.#cache.set(cacheKey, {
       data,
       timestamp: Date.now()
     });

     return data;
   }
   ```

5. Transformacja danych
   ```js
   transformOrdersData(orders) {
     return orders.map(order => ({
       id: order.order_id,
       status_id: order.status_id,
       status_name: this.getStatusName(order.status_id),
       customer: {
         name: order.customer_name,
         email: order.customer_email
       },
       items: order.items?.map(item => ({
         name: item.product_name,
         quantity: item.quantity,
         price: item.price
       })) || [],
       total: order.total_amount,
       created_at: order.created_at,
       modified_at: order.modified_at,
       ready_date: order.ready_date
     }));
   }
   ```

6. Obsługa błędów
   ```js
   handleApiError(error, context) {
     this.log(LogLevel.ERROR, '❌ API Error', {
       context,
       message: error.message,
       stack: error.stack
     });

     // Wyświetl błąd w UI
     this.#uiManager.showError(
       `Błąd API: ${error.message}`,
       `Wystąpił błąd podczas ${context}`
     );

     // Zapisz w logach
     this.#errorHandler.handle(error, ErrorType.API, ErrorSeverity.HIGH, {
       context,
       timestamp: new Date().toISOString()
     });
   }
   ```

### Ważne uwagi dotyczące API
1. Limity i paginacja:
   - Domyślny limit: 50 rekordów per strona
   - Paginacja obsługiwana przez parametry `page` i `limit`
   - Metadane zawierają `total_pages` i `current_page`

2. Retry logic:
   - Maksymalnie 3 próby
   - Exponential backoff między próbami
   - Timeout: 30 sekund per request

3. Caching:
   - Cache per sklep
   - TTL: 5 minut (300000ms)
   - Force refresh dostępny przez opcje

4. Obsługa błędów:
   - Retry dla błędów sieciowych
   - Logowanie wszystkich błędów
   - Graceful degradation przy problemach z API