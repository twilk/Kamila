# DARWINA.PL API Data Structures Documentation

## 1. Order Data Structures

### 1.1 Raw API Response
```javascript
/**
 * @typedef {Object} ApiResponse
 * @property {Order[]} data - Lista zamówień
 * @property {Object} metadata - Metadane odpowiedzi
 * @property {number} metadata.page_count - Liczba stron
 * @property {number} metadata.total - Całkowita liczba zamówień
 * @property {number} metadata.page - Aktualna strona
 * @property {string} [metadata.store_id] - ID sklepu
 * @property {number} [metadata.delivery_id] - ID punktu dostawy
 */

/**
 * @typedef {Object} Order
 * @property {number} order_id - ID zamówienia
 * @property {string} status_id - ID statusu
 * @property {string} created_at - Data utworzenia
 * @property {string} modified_at - Data modyfikacji
 * @property {string} [ready_date] - Data gotowości do odbioru
 * @property {number} delivery_id - ID punktu dostawy
 * @property {string} store_id - ID sklepu
 * @property {string} store_name - Nazwa sklepu
 * @property {string} store_address - Adres sklepu
 * @property {string} customer_name - Nazwa klienta
 * @property {string} customer_email - Email klienta
 * @property {OrderItem[]} [items] - Lista produktów
 * @property {number} total_amount - Całkowita kwota
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} product_name - Nazwa produktu
 * @property {number} quantity - Ilość
 * @property {number} price - Cena
 */

// Przykład odpowiedzi z API
const exampleApiResponse = {
    data: [
        {
            order_id: 123,
            status_id: "1",
            created_at: "2024-01-29T12:00:00Z",
            modified_at: "2024-01-29T12:30:00Z",
            delivery_id: 456,
            store_id: "FIL",
            store_name: "Filtry",
            store_address: "ul. Filtrowa 1",
            customer_name: "Jan Kowalski",
            customer_email: "jan@example.com",
            items: [
                {
                    product_name: "Produkt 1",
                    quantity: 2,
                    price: 99.99
                }
            ],
            total_amount: 199.98
        }
    ],
    metadata: {
        page_count: 1,
        total: 1,
        page: 1,
        store_id: "FIL",
        delivery_id: 456
    }
};
```

### 1.2 Transformed Order Data
```javascript
/**
 * @typedef {Object} TransformedOrder
 * @property {number} id - ID zamówienia
 * @property {string} status_id - ID statusu
 * @property {string} status_name - Nazwa statusu
 * @property {Object} customer - Dane klienta
 * @property {string} customer.name - Nazwa klienta
 * @property {string} customer.email - Email klienta
 * @property {Object[]} items - Lista produktów
 * @property {string} items[].name - Nazwa produktu
 * @property {number} items[].quantity - Ilość
 * @property {number} items[].price - Cena
 * @property {number} total - Całkowita kwota
 * @property {string} created_at - Data utworzenia
 * @property {string} modified_at - Data modyfikacji
 * @property {string} [ready_date] - Data gotowości do odbioru
 */

// Przykład przetworzonego zamówienia
const exampleTransformedOrder = {
    id: 123,
    status_id: "1",
    status_name: "Nowe",
    customer: {
        name: "Jan Kowalski",
        email: "jan@example.com"
    },
    items: [
        {
            name: "Produkt 1",
            quantity: 2,
            price: 99.99
        }
    ],
    total: 199.98,
    created_at: "2024-01-29T12:00:00Z",
    modified_at: "2024-01-29T12:30:00Z"
};
```

### 1.3 Order Counts Structure
```javascript
/**
 * @typedef {Object} OrderCounts
 * @property {number} '1' - Liczba nowych zamówień
 * @property {number} '2' - Liczba potwierdzonych zamówień
 * @property {number} '3' - Liczba przyjętych zamówień
 * @property {number} READY - Liczba zamówień gotowych do odbioru
 * @property {number} OVERDUE - Liczba przeterminowanych zamówień (>14 dni)
 */

// Przykład liczników zamówień
const exampleOrderCounts = {
    '1': 5,    // Nowe
    '2': 3,    // Potwierdzone
    '3': 2,    // Przyjęte
    'READY': 4,  // Gotowe do odbioru
    'OVERDUE': 1 // Przeterminowane
};
```

## 2. Status Definitions

### 2.1 Status Codes
```javascript
/**
 * Kody statusów zamówień
 * @constant {Object}
 */
const ORDER_STATUSES = {
    NEW: '1',           // Nowe zamówienia
    CONFIRMED: '2',     // Potwierdzone przez sklep
    ACCEPTED: '3',      // Przyjęte do realizacji
    READY_FOR_PICKUP: '5' // Gotowe do odbioru
};
```

### 2.2 Status Display Names
```javascript
/**
 * Nazwy statusów do wyświetlenia
 * @constant {Object}
 */
const ORDER_STATUS_NAMES = {
    '1': 'Nowe',
    '2': 'Potwierdzone telefonicznie przez sklep',
    '3': 'Przyjęte do realizacji',
    '5': 'Gotowe do odbioru'
};
```

## 3. Cache Structure

### 3.1 Order Cache
```javascript
/**
 * @typedef {Object} OrderCache
 * @property {Object} counts - Liczniki zamówień
 * @property {number} counts.1 - Liczba nowych
 * @property {number} counts.2 - Liczba potwierdzonych
 * @property {number} counts.3 - Liczba przyjętych
 * @property {number} counts.READY - Liczba gotowych
 * @property {number} counts.OVERDUE - Liczba przeterminowanych
 * @property {number} timestamp - Timestamp ostatniej aktualizacji
 * @property {string} storeId - ID sklepu
 * @property {Object} metadata - Metadane cache
 */

// Przykład struktury cache
const exampleCache = {
    counts: {
        '1': 5,
        '2': 3,
        '3': 2,
        'READY': 4,
        'OVERDUE': 1
    },
    timestamp: Date.now(),
    storeId: 'FIL',
    metadata: {
        store: 'Filtry',
        total: 15,
        processedAt: Date.now(),
        forceRefresh: false,
        originalFormat: {}
    }
};
```

### 3.2 Cache Keys
```javascript
/**
 * Klucze używane w cache
 * @constant {Object}
 */
const CACHE_KEYS = {
    ORDER_COUNTS: 'orderCounts',
    LAST_UPDATE: 'lastUpdate',
    STORE_PREFIX: 'store_'
};
```

## 4. Data Lifecycle

### 4.1 Initial Data Load
```javascript
/**
 * Proces ładowania początkowego
 */
async function initialDataLoad() {
    // 1. Sprawdź cache
    const cache = await checkCache();
    
    if (!cache.valid || cache.forceRefresh) {
        // 2. Jeśli cache nieważny lub wymuszone odświeżenie
        const orders = await fetchAllOrders();
        const processed = processOrders(orders);
        const counters = updateCounters(processed);
        await saveToCache(counters);
    } else {
        // 3. Jeśli cache ważny
        const data = await loadFromCache();
        updateUI(data);
        scheduleBackgroundRefresh();
    }
}
```

### 4.2 Incremental Updates
```javascript
/**
 * Proces aktualizacji przyrostowej
 */
async function incrementalUpdate() {
    const lastUpdate = await getLastUpdateTimestamp();
    const newOrders = await fetchModifiedOrders(lastUpdate);
    const merged = await mergeWithExisting(newOrders);
    const counters = updateCounters(merged);
    await updateCacheAndUI(counters);
}
```

### 4.3 Cache Management
```javascript
/**
 * Stałe zarządzania cache
 */
const CACHE_CONFIG = {
    TTL: 5 * 60 * 1000,         // 5 minut
    REFRESH_INTERVAL: 60 * 1000, // 1 minuta
    FORCE_REFRESH_CONDITIONS: {
        MANUAL_REQUEST: 'manual',
        CACHE_EXPIRED: 'expired',
        STORE_CHANGED: 'store_changed',
        ERROR_RECOVERY: 'error'
    }
};
```

## 5. API Communication

### 5.1 Request Parameters
```javascript
/**
 * @typedef {Object} ApiRequestParams
 * @property {string} [status_id] - Lista ID statusów (po przecinku)
 * @property {number} [delivery_id] - ID punktu dostawy
 * @property {string} [modified_from] - Data modyfikacji (ISO)
 * @property {number} [page] - Numer strony
 * @property {number} [limit] - Limit wyników na stronę
 */

// Przykład parametrów zapytania
const exampleRequestParams = {
    status_id: '1,2,3,5',
    delivery_id: 456,
    modified_from: '2024-01-29T00:00:00Z',
    page: 1,
    limit: 50
};
```

### 5.2 Error Handling
```javascript
/**
 * @typedef {Object} ApiError
 * @property {string} code - Kod błędu
 * @property {string} message - Komunikat błędu
 * @property {*} [context] - Kontekst błędu
 * @property {number} timestamp - Timestamp błędu
 * @property {('LOW'|'MEDIUM'|'HIGH')} severity - Ważność błędu
 */

// Przykład obsługi błędów
class ApiError extends Error {
    constructor(code, message, severity = 'LOW', context = null) {
        super(message);
        this.code = code;
        this.context = context;
        this.timestamp = Date.now();
        this.severity = severity;
    }
}
```

## 6. Store-Specific Data

### 6.1 Store Configuration
```javascript
/**
 * @typedef {Object} Store
 * @property {string} id - Identyfikator sklepu
 * @property {string} name - Nazwa wyświetlana
 * @property {number} deliveryId - ID punktu dostawy
 * @property {string} address - Adres fizyczny
 */

// Przykład konfiguracji sklepu
const exampleStore = {
    id: 'FIL',
    name: 'Filtry',
    deliveryId: 456,
    address: 'ul. Filtrowa 1'
};
```

### 6.2 Store-Specific Cache
```javascript
/**
 * Zarządzanie cache dla sklepów
 */
const StoreCache = {
    /**
     * Pobierz dane dla konkretnego sklepu
     * @param {string} storeId - ID sklepu
     */
    async getStoreData(storeId) {
        const key = `${CACHE_KEYS.STORE_PREFIX}${storeId}`;
        return await chrome.storage.local.get(key);
    },

    /**
     * Zapisz dane dla konkretnego sklepu
     * @param {string} storeId - ID sklepu
     * @param {Object} data - Dane do zapisania
     */
    async setStoreData(storeId, data) {
        const key = `${CACHE_KEYS.STORE_PREFIX}${storeId}`;
        await chrome.storage.local.set({ [key]: data });
    }
};
```

## 7. Data Validation

### 7.1 Required Fields
```javascript
/**
 * Walidacja wymaganych pól
 */
const requiredFields = ['order_id', 'status_id', 'created_at', 'delivery_id'];

/**
 * Sprawdź czy obiekt ma wszystkie wymagane pola
 * @param {Object} order - Obiekt zamówienia
 * @returns {boolean} Czy wszystkie pola są obecne
 */
function validateRequiredFields(order) {
    return requiredFields.every(field => order.hasOwnProperty(field) && order[field] != null);
}
```

### 7.2 Validation Rules
```javascript
/**
 * Reguły walidacji
 */
const ValidationRules = {
    /**
     * Sprawdź czy status jest prawidłowy
     */
    validateStatus(status) {
        return Object.values(ORDER_STATUSES).includes(status);
    },

    /**
     * Sprawdź czy data jest prawidłowa
     */
    validateDate(dateStr) {
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    },

    /**
     * Sprawdź czy delivery ID pasuje do konfiguracji sklepu
     */
    validateDeliveryId(deliveryId, store) {
        return store.deliveryId === deliveryId;
    },

    /**
     * Sprawdź czy ID zamówienia jest unikalne
     */
    async validateOrderId(orderId) {
        const existingOrder = await findOrderById(orderId);
        return !existingOrder;
    },

    /**
     * Sprawdź czy kwoty są nieujemne
     */
    validateAmounts(order) {
        return order.total_amount >= 0 && 
               order.items?.every(item => item.price >= 0);
    }
};
``` 