# NADRZĘDNA INSTRUKCJA DLA AI 🤖

> **WAŻNE**: Wszystkie komponenty i funkcjonalności będą porównane z działającym rozwiązaniem.
> Plan działania:
> 1. Analiza działającego kodu z lokalizacji: C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042
> 2. Porównanie z aktualną implementacją
> 3. Naprawa i synchronizacja funkcjonalności
> 5. Aktualizacja tego pliku po każdej naprawie

# OGRANICZENIA API 🔒

## 1. Filtry Statusów
```javascript
// Dozwolone statusy zamówień
const statusIds = [
    '1',  // SUBMITTED
    '2',  // CONFIRMED
    '3',  // ACCEPTED
    '5'   // READY
].join(',');
```

## 2. Filtry Sklepów
```javascript
// Wymagane parametry dla sklepu
if (store?.id && store.id !== 'ALL') {
    if (store.deliveryId) {
        params.append('delivery_id', store.deliveryId);
    }
}
```

## 3. Paginacja
```javascript
// Stałe wartości
per_page: '100',  // Maksymalna ilość na stronę
```

# NARZĘDZIA DO ANALIZY 🔧

## 1. Analiza Kodu (PowerShell)
```powershell
# Wyszukiwanie plików
Get-ChildItem -Path . -Recurse -Filter "*.js" | Select-Object FullName
Get-ChildItem -Path . -Recurse -Filter "*.md" | Select-Object FullName

# Porównanie zawartości
Compare-Object -ReferenceObject (Get-Content "old/file.js") -DifferenceObject (Get-Content "new/file.js")

# Wyszukiwanie w plikach
Select-String -Path "*.js" -Pattern "searchPattern"

# Kopiowanie plików
Copy-Item -Path "source" -Destination "target" -Recurse
```

## 2. Lokalizacje Do Sprawdzenia
```text
1. Stare rozwiązanie:
   C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042

2. Nowe rozwiązanie:
   Aktualna lokalizacja workspace
```

# PLAN NAPRAWY 🎯

## 1. Analiza Struktury
- [ ] Porównanie struktury katalogów
- [ ] Identyfikacja kluczowych plików
- [ ] Mapowanie różnic w implementacji

## 2. Komponenty Do Sprawdzenia
- [ ] OrderService
- [ ] StatusManager
- [ ] API Integration
- [ ] Store Management
- [ ] Caching System
- [ ] Error Handling

## 3. Funkcjonalności Do Naprawy
- [ ] Token Refresh
- [ ] Status Tracking
- [ ] Store Filtering
- [ ] Data Caching
- [ ] Error Management
- [ ] API Communication

## 4. Testy Do Wykonania
- [ ] Unit Tests
- [ ] Integration Tests
- [ ] API Tests
- [ ] UI Tests

## Progress
```text
[░░░░░░░░░░░░░░░░░░░░] 0%
```

# NASTĘPNE KROKI 📋

1. Rozpoczęcie od analizy `OrderService.js`
2. Porównanie implementacji statusów
3. Weryfikacja mechanizmów cachowania
4. Sprawdzenie obsługi błędów
5. Testy integracyjne

> **Uwaga**: Ten plik będzie aktualizowany w miarę postępu prac naprawczych

# Counter System Repair Plan

## 1. API Request Fixes

### 1.1 Parameter Handling ⚠️ HIGH PRIORITY
- [ ] Fix `modified_from` parameter logic:
  - Should be omitted on first request
  - Should use last update timestamp for subsequent requests
- [ ] Correct `delivery_id` handling:
  - Only include when store is not "ALL"
  - Ensure proper store ID to delivery_id mapping

### 1.2 Response Processing 🔴 CRITICAL
- [ ] Implement proper pagination handling
- [ ] Ensure all pages are collected before processing
- [ ] Add proper error handling for failed page requests
- [ ] Add logging for API response data structure

## 2. Data Processing Fixes

### 2.1 Order Status Counting 🔴 CRITICAL
- [ ] Fix status classification logic:
  ```javascript
  // Verify this structure matches API response
  order.status_id?.toString()
  order.ready_date || order.status_change_date || order.modified_at
  ```
- [ ] Correct date handling for READY/OVERDUE classification
- [ ] Add validation for missing or invalid dates

### 2.2 Cache Management ⚠️ HIGH PRIORITY
- [ ] Implement proper cache structure:
  ```javascript
  {
      'orderCounts': {
          data: counts,
          timestamp: now,
          storeId: store.id,
          metadata: response.metadata,
          orders: response.orders
      },
      'lastUpdate': now
  }
  ```
- [ ] Add cache validation checks
- [ ] Implement cache cleanup for old data

## 3. UI Updates

### 3.1 Counter Display 🟡 MEDIUM PRIORITY
- [ ] Ensure counters update immediately after data fetch
- [ ] Add loading state during updates
- [ ] Implement error state display
- [ ] Add tooltips with status descriptions

### 3.2 Click Handlers ⚠️ HIGH PRIORITY
- [ ] Fix URL generation for each status
- [ ] Ensure proper store ID is passed
- [ ] Add date range parameters for READY/OVERDUE
- [ ] Implement proper window opening behavior

## 4. Store Selection

### 4.1 Store Change Handling 🟡 MEDIUM PRIORITY
- [ ] Clear cache on store change
- [ ] Trigger immediate data refresh
- [ ] Update UI to reflect loading state
- [ ] Handle errors during store change

### 4.2 Store-Specific Features ⚠️ HIGH PRIORITY
- [ ] Implement proper ALL stores handling
- [ ] Fix delivery_id filtering
- [ ] Add store validation
- [ ] Update URL parameters correctly

## 5. Testing Plan

### 5.1 API Integration Tests 🔴 CRITICAL
- [ ] Test first-time data load
- [ ] Test subsequent updates
- [ ] Test pagination
- [ ] Test error scenarios

### 5.2 Cache Tests ⚠️ HIGH PRIORITY
- [ ] Test cache storage
- [ ] Test cache retrieval
- [ ] Test cache invalidation
- [ ] Test force refresh

### 5.3 UI Tests 🟡 MEDIUM PRIORITY
- [ ] Test counter updates
- [ ] Test click handlers
- [ ] Test store selection
- [ ] Test error displays

## Priority Legend
- 🔴 CRITICAL: Must be fixed immediately
- ⚠️ HIGH: Should be fixed in next release
- 🟡 MEDIUM: Important but not urgent
- 🟢 LOW: Nice to have

# IMPLEMENTACJA CACHE 🔄

## 1. Struktura Cache
```javascript
// Format danych w cache
{
    [key: string]: {
        value: any,
        expires: number,  // timestamp
        updated: number   // timestamp
    }
}

// Specjalne klucze
{
    'leadCounts': Object,           // Kompatybilność wsteczna
    'lastUpdate': number,           // Timestamp ostatniej aktualizacji
    'currentStore': string,         // Aktualny sklep
    'orderCounts_{storeId}': {     // Liczniki per sklep
        data: {
            '1': number,  // SUBMITTED
            '2': number,  // CONFIRMED
            '3': number,  // ACCEPTED
            'READY': number,
            'OVERDUE': number
        },
        timestamp: number
    }
}
```

## 2. Główne Operacje

### 2.1 Sprawdzanie Dostępności
```javascript
// Test dostępności cache
async isAvailable() {
    const testKey = '_cache_test_' + Date.now();
    // Test zapisu i odczytu
    return result !== null;
}
```

### 2.2 Operacje CRUD
- [ ] Zapis z TTL (domyślnie 5 minut)
- [ ] Odczyt z walidacją wygaśnięcia
- [ ] Czyszczenie po wzorcu lub całości
- [ ] Automatyczna obsługa wygasłych danych

### 2.3 Kompatybilność
- [ ] Zachowanie starych kluczy (leadCounts)
- [ ] Migracja do nowego formatu
- [ ] Obsługa błędów storage
- [ ] Logowanie błędów cache

## 3. Zasady Cachowania

### 3.1 Invalidacja Cache
- [ ] Automatyczna po TTL (5 minut)
- [ ] Manualna przy zmianie sklepu
- [ ] Selektywna po wzorcu
- [ ] Pełna przy wylogowaniu

### 3.2 Bezpieczeństwo
- [ ] Separacja danych per sklep
- [ ] Walidacja danych przed zapisem
- [ ] Obsługa przepełnienia storage
- [ ] Czyszczenie wygasłych danych

### 3.3 Wydajność
- [ ] Minimalizacja operacji storage
- [ ] Buforowanie częstych odczytów
- [ ] Batch updates dla liczników
- [ ] Optymalizacja rozmiaru danych

## 3.2 Zarządzanie Cache ✅
```javascript
// ZROBIONE: Implementacja validateCache z TTL
async #validateCache(storeId) {
    const cache = await this.#storage.get(key);
    if (!cache) return null;
    
    const now = Date.now();
    const cacheAge = now - cache.timestamp;
    const TTL = 5 * 60 * 1000; // 5 minut
    
    if (cacheAge > TTL) {
        await this.#storage.remove(key);
        return null;
    }
    
    return cache;
}

// ZROBIONE: Implementacja updateCache z separacją per sklep
async #updateCache(data, store) {
    const key = `orderCounts_${store?.id || 'ALL'}`;
    await this.#storage.set(key, {
        data: data.counts,
        timestamp: data.timestamp,
        storeId: data.storeId,
        metadata: data.metadata,
        orders: data.orders
    });
}

// ZROBIONE: Implementacja clearCache
async clearCache(storeId = null) {
    if (storeId) {
        await this.#storage.remove(`orderCounts_${storeId}`);
    } else {
        const keys = await this.#storage.keys();
        const orderCountKeys = keys.filter(key => key.startsWith('orderCounts_'));
        await Promise.all(orderCountKeys.map(key => this.#storage.remove(key)));
    }
}
```

## Progress
```text
[██████████░░░░░░░░░░] 50%
```

# NASTĘPNE KROKI 📋

1. ✅ Naprawa obsługi API response format
2. ✅ Implementacja paginacji
3. ✅ Dodanie filtrów API
4. ✅ Implementacja cache
5. ⏳ Testy jednostkowe
6. ⏳ Testy integracyjne

# DO ZROBIENIA TERAZ 📝

1. ✅ Implementacja validateCache z TTL
2. ✅ Dodanie automatycznego odświeżania cache
3. ✅ Implementacja czyszczenia cache przy zmianie sklepu
4. ⏳ Dodanie testów dla nowej implementacji

> **Uwaga**: Ten plik będzie aktualizowany w miarę postępu prac naprawczych

# PLAN NAPRAWY OrderService 🎯

## 1. Naprawa Parametrów API ✅

### 1.1 Parametr modified_from ✅
```javascript
// ZROBIONE: Poprawna implementacja z logowaniem
if (options.modified_from) {
    params.append('modified_from', options.modified_from);
    this.log(LogLevel.DEBUG, '🕒 Using modified_from filter', {
        modified_from: options.modified_from
    });
}
```

### 1.2 Obsługa delivery_id ✅
```javascript
// ZROBIONE: Poprawna implementacja z walidacją i logowaniem
if (store?.id && store.id !== 'ALL') {
    if (store.deliveryId) {
        params.append('delivery_id', store.deliveryId);
        this.log(LogLevel.DEBUG, '🏪 Using store filter', {
            storeId: store.id,
            deliveryId: store.deliveryId
        });
    } else {
        this.log(LogLevel.WARNING, '⚠️ Missing deliveryId for store', { 
            storeId: store.id,
            availableDeliveryIds: Object.keys(DELIVERY_IDS)
        });
    }
}
```

### 1.3 Filtry Statusów ✅
```javascript
// ZROBIONE: Dodano filtrowanie po statusach
const statusIds = [
    API_CONFIG.DARWINA.STATUS_CODES.SUBMITTED,
    API_CONFIG.DARWINA.STATUS_CODES.CONFIRMED,
    API_CONFIG.DARWINA.STATUS_CODES.ACCEPTED,
    API_CONFIG.DARWINA.STATUS_CODES.READY
].join(',');
params.append('status_id', statusIds);
```

## 2. Naprawa Paginacji 🔴 CRITICAL

### 2.1 Implementacja Paginacji ✅
```javascript
// ZROBIONE: Poprawna implementacja z metadata
const totalPages = data.__metadata?.page_count || 1;
hasMore = page < totalPages;
page++;

// ZROBIONE: Poprawna obsługa kolekcji danych
allOrders = allOrders.concat(data.data);
```

## 3. Implementacja Cache 🔄

### 3.1 Struktura Cache ✅
```javascript
// ZROBIONE: Poprawna struktura cache
{
    'orderCounts': {
        data: {
            '1': number,  // SUBMITTED
            '2': number,  // CONFIRMED
            '3': number,  // ACCEPTED
            'READY': number,
            'OVERDUE': number
        },
        timestamp: number,
        storeId: string,
        metadata: Object,
        orders: Array
    }
}
```

### 3.2 Zarządzanie Cache ✅
```javascript
// ZROBIONE: Implementacja validateCache z TTL
async #validateCache(storeId) {
    const cache = await this.#storage.get(key);
    if (!cache) return null;
    
    const now = Date.now();
    const cacheAge = now - cache.timestamp;
    const TTL = 5 * 60 * 1000; // 5 minut
    
    if (cacheAge > TTL) {
        await this.#storage.remove(key);
        return null;
    }
    
    return cache;
}

// ZROBIONE: Implementacja updateCache z separacją per sklep
async #updateCache(data, store) {
    const key = `orderCounts_${store?.id || 'ALL'}`;
    await this.#storage.set(key, {
        data: data.counts,
        timestamp: data.timestamp,
        storeId: data.storeId,
        metadata: data.metadata,
        orders: data.orders
    });
}

// ZROBIONE: Implementacja clearCache
async clearCache(storeId = null) {
    if (storeId) {
        await this.#storage.remove(`orderCounts_${storeId}`);
    } else {
        const keys = await this.#storage.keys();
        const orderCountKeys = keys.filter(key => key.startsWith('orderCounts_'));
        await Promise.all(orderCountKeys.map(key => this.#storage.remove(key)));
    }
}
```

## 4. Obsługa Błędów ✅

### 4.1 Rozszerzona Obsługa
```javascript
// ZROBIONE: Poprawna implementacja logowania błędów
this.log(LogLevel.ERROR, '❌ Invalid API response format', {
    responseStructure: Object.keys(data || {}),
    page
});

// ZROBIONE: Obsługa błędów cache
this.handleError(error, ErrorType.CACHE, ErrorSeverity.MEDIUM, {
    method: '_updateCache',
    storeId: store?.id
});
```

## Progress
```text
[██████████░░░░░░░░░░] 50%
```

# NASTĘPNE KROKI 📋

1. ✅ Naprawa obsługi API response format
2. ✅ Implementacja paginacji
3. ✅ Dodanie filtrów API
4. ✅ Implementacja cache
5. ⏳ Testy jednostkowe
6. ⏳ Testy integracyjne

# DO ZROBIENIA TERAZ 📝

1. ✅ Implementacja validateCache z TTL
2. ✅ Dodanie automatycznego odświeżania cache
3. ✅ Implementacja czyszczenia cache przy zmianie sklepu
4. ⏳ Dodanie testów dla nowej implementacji

> **Uwaga**: Ten plik będzie aktualizowany w miarę postępu prac naprawczych

# ANALIZA PROCESÓW ZARZĄDZANIA DANYMI 🔄

## 1. Proces Transformacji Danych

### 1.1 Obecny Problem
```javascript
// Obecnie dane przechodzą przez kilka transformacji:
1. API Response -> data.data (surowe dane)
2. transformOrdersData() -> transformowane zamówienia
3. processOrders() -> liczniki i metadane
4. updateCache() -> cache w storage

// Problemy:
1. Utrata informacji o statusach podczas transformacji
2. Niespójne nazewnictwo między etapami
3. Brak walidacji danych między transformacjami
```

### 1.2 Rozwiązanie
```javascript
// Nowy proces transformacji:
1. API Response -> Walidacja surowych danych
2. Transformacja do jednolitego formatu
3. Obliczanie liczników
4. Cache z zachowaniem kompatybilności

// Implementacja:
class OrderTransformer {
    static validateApiResponse(data) {
        if (!data?.data || !Array.isArray(data.data)) {
            throw new Error('Invalid API response format');
        }
        return data.data;
    }

    static transformOrder(order) {
        return {
            id: order.order_id,
            status: {
                id: order.status_id,
                name: this.getStatusName(order.status_id),
                date: order.status_change_date || order.modified_at
            },
            dates: {
                created: order.created_at,
                modified: order.modified_at,
                ready: order.ready_date
            }
        };
    }

    static getStatusName(statusId) {
        const map = {
            '1': 'submitted',
            '2': 'confirmed',
            '3': 'accepted',
            '5': 'ready'
        };
        return map[statusId] || 'unknown';
    }
}
```

## 2. Proces Liczenia Statusów

### 2.1 Obecny Problem
```javascript
// Obecnie:
1. Brak jednolitego formatu liczników
2. Duplikacja logiki liczenia w różnych miejscach
3. Problemy z obsługą statusu READY/OVERDUE
```

### 2.2 Rozwiązanie
```javascript
class OrderCounter {
    static countStatuses(orders) {
        const counts = {
            submitted: 0,
            confirmed: 0,
            accepted: 0,
            ready: 0,
            overdue: 0
        };

        const now = Date.now();
        const READY_THRESHOLD = 14 * 24 * 60 * 60 * 1000;

        orders.forEach(order => {
            const statusDate = order.status.date;
            const age = now - new Date(statusDate).getTime();

            if (order.status.id === '5') {
                if (age > READY_THRESHOLD) {
                    counts.overdue++;
                } else {
                    counts.ready++;
                }
            } else {
                counts[order.status.name]++;
            }
        });

        return counts;
    }

    static validateCounts(counts) {
        const required = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
        const missing = required.filter(key => !(key in counts));
        
        if (missing.length > 0) {
            throw new Error(`Missing required count keys: ${missing.join(', ')}`);
        }
        
        return counts;
    }
}
```

## 3. Proces Cachowania

### 3.1 Obecny Problem
```javascript
// Obecnie:
1. Niespójny format danych w cache
2. Brak walidacji przed zapisem
3. Problemy z kompatybilnością wsteczną
```

### 3.2 Rozwiązanie
```javascript
class OrderCache {
    static prepareForCache(data) {
        return {
            data: OrderCounter.validateCounts(data.counts),
            timestamp: Date.now(),
            storeId: data.storeId,
            metadata: {
                total: data.orders.length,
                processedAt: Date.now(),
                version: '2.0'
            }
        };
    }

    static validateCacheData(cache) {
        if (!cache?.data || !cache.timestamp || !cache.storeId) {
            throw new Error('Invalid cache structure');
        }
        return OrderCounter.validateCounts(cache.data);
    }
}
```

## Progress
```text
[███████████░░░░░░░░░] 55%
```

# NASTĘPNE KROKI 📋

1. ✅ Naprawa obsługi API response format
2. ✅ Implementacja paginacji
3. ✅ Dodanie filtrów API
4. ✅ Implementacja cache
5. ⚠️ Naprawa liczników zamówień
6. ⚠️ Implementacja nowych procesów zarządzania danymi
7. ⏳ Testy jednostkowe

# DO ZROBIENIA TERAZ 📝

1. Implementacja klasy OrderTransformer
2. Implementacja klasy OrderCounter
3. Implementacja klasy OrderCache
4. Integracja nowych klas z OrderService

> **Uwaga**: Ten plik będzie aktualizowany w miarę postępu prac naprawczych

# ANALIZA PROBLEMU LICZNIKÓW 🔢

## 1. Obecny Problem
```javascript
// Aktualne wyświetlanie
1, 1, 1, -, -

// Spodziewane wyświetlanie
submitted, confirmed, accepted, ready, overdue
```

## 2. Punkty Do Sprawdzenia

### 2.1 Mapowanie Statusów
- [ ] Sprawdzić mapowanie w starym kodzie (C:\Users\Wilk\Downloads\Kamila-c6236d28c98bc64b9658e68bbef34dc6b0133042)
- [ ] Porównać z obecną implementacją
- [ ] Zweryfikować format danych zwracanych przez API
- [ ] Sprawdzić transformację danych

### 2.2 Proces Liczenia
- [ ] Jak stary kod liczył statusy?
- [ ] Jak obsługiwał status READY (5)?
- [ ] Jak rozróżniał READY od OVERDUE?
- [ ] Jakie były progi czasowe?

### 2.3 Format Danych
- [ ] Jaki format danych oczekuje frontend?
- [ ] Jaki format zwraca backend?
- [ ] Gdzie następuje transformacja?
- [ ] Czy cache zachowuje właściwy format?

## 3. Hipotezy Problemu
1. Niepoprawne mapowanie statusów z API na nazwy
2. Błędna transformacja danych przed wyświetleniem
3. Problem z progiem czasowym dla READY/OVERDUE
4. Niekompatybilny format danych z frontendem

## 4. Plan Debugowania
1. [ ] Logowanie surowych danych z API
2. [ ] Logowanie po transformacji
3. [ ] Logowanie przed wyświetleniem
4. [ ] Sprawdzenie formatu w cache

## Progress
```text
[██████████░░░░░░░░░░] 50%
```

# DO ZROBIENIA TERAZ 📝

1. Analiza starego kodu - jak działało liczenie statusów
2. Dodanie logowania w kluczowych miejscach
3. Porównanie formatów danych
4. Naprawa mapowania statusów

> **Uwaga**: Zanim przejdziemy do implementacji nowych klas, musimy zrozumieć dlaczego stare rozwiązanie działało poprawnie. 