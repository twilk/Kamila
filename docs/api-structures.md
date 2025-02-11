# DARWINA.PL API Data Structures Documentation

## 1. Order Data Structures

### 1.1 Raw API Response
```javascript
/**
 * @typedef {Object} ApiResponse
 * @property {Order[]} orders - Lista zamówień
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
    orders: [
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

/**
 * Nazwy statusów do wyświetlenia
 * @constant {Object}
 */
const ORDER_STATUS_NAMES = {
    [ORDER_STATUSES.NEW]: 'Nowe',
    [ORDER_STATUSES.CONFIRMED]: 'Potwierdzone telefonicznie przez sklep',
    [ORDER_STATUSES.ACCEPTED]: 'Przyjęte do realizacji',
    [ORDER_STATUSES.READY_FOR_PICKUP]: 'Gotowe do odbioru'
};

/**
 * Klucze liczników statusów
 * @constant {Object}
 */
const COUNTER_KEYS = {
    NEW: '1',
    CONFIRMED: '2',
    ACCEPTED: '3',
    READY: 'READY',
    OVERDUE: 'OVERDUE'
};
```

## 3. Cache System

### 3.1 Cache Schema
```javascript
/**
 * @typedef {Object} CacheSchema
 * @property {Object} counts - Liczniki zamówień dla różnych statusów
 * @property {number} counts.1 - Liczba nowych zamówień
 * @property {number} counts.2 - Liczba potwierdzonych zamówień
 * @property {number} counts.3 - Liczba przyjętych zamówień
 * @property {number} counts.READY - Liczba zamówień gotowych do odbioru
 * @property {number} counts.OVERDUE - Liczba przeterminowanych zamówień
 * @property {number} timestamp - Timestamp ostatniej aktualizacji
 * @property {string} storeId - ID sklepu
 * @property {Object} metadata - Metadane cache
 * @property {string} metadata.store - Nazwa sklepu
 * @property {number} metadata.total - Całkowita liczba zamówień
 * @property {number} metadata.processedAt - Timestamp przetworzenia
 * @property {boolean} metadata.forceRefresh - Czy wymusić odświeżenie
 * @property {Object} metadata.originalFormat - Oryginalna struktura danych
 */

const CACHE_SCHEMA = {
    counts: {
        [COUNTER_KEYS.NEW]: 'number',
        [COUNTER_KEYS.CONFIRMED]: 'number',
        [COUNTER_KEYS.ACCEPTED]: 'number',
        [COUNTER_KEYS.READY]: 'number',
        [COUNTER_KEYS.OVERDUE]: 'number'
    },
    timestamp: 'number',
    storeId: 'string',
    metadata: {
        store: 'string',
        total: 'number',
        processedAt: 'number',
        forceRefresh: 'boolean',
        originalFormat: 'object'
    }
};
```

### 3.2 Cache Configuration
```javascript
/**
 * Konfiguracja timeoutów cache
 * @constant {Object}
 */
const CACHE_CONFIG = {
    // Główny timeout cache
    CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minut
    
    // Timeout świeżości danych
    DATA_FRESHNESS_TIMEOUT: 5 * 60 * 1000, // 5 minut
    
    // Timeout przy zmianie sklepu
    STORE_CHANGE_TIMEOUT: 30 * 60 * 1000, // 30 minut
    
    // Klucze cache
    KEYS: {
        ORDER_COUNTS: 'orderCounts',
        LAST_UPDATE: 'lastUpdate',
        STORE_PREFIX: 'store_'
    }
};

/**
 * Warunki wymuszające odświeżenie cache
 * @constant {Object}
 */
const FORCE_REFRESH_CONDITIONS = {
    MANUAL_REQUEST: 'manual',    // Ręczne żądanie odświeżenia
    CACHE_EXPIRED: 'expired',    // Cache wygasł
    STORE_CHANGED: 'store_changed', // Zmiana sklepu
    ERROR_RECOVERY: 'error'      // Odzyskiwanie po błędzie
};
```

### 3.3 Cache Operations
```javascript
/**
 * Przykład operacji na cache
 */
const CacheOperations = {
    /**
     * Sprawdź ważność cache
     * @param {string} storeId - ID sklepu
     * @returns {Promise<boolean>}
     */
    async isCacheValid(storeId) {
        const cacheKey = `${CACHE_CONFIG.KEYS.STORE_PREFIX}${storeId}`;
        const cache = await chrome.storage.local.get(cacheKey);
        
        if (!cache[cacheKey]) return false;
        
        const { timestamp } = cache[cacheKey];
        const age = Date.now() - timestamp;
        
        return age < CACHE_CONFIG.CACHE_TIMEOUT;
    },

    /**
     * Zapisz dane do cache
     * @param {string} storeId - ID sklepu
     * @param {Object} data - Dane do zapisania
     */
    async saveToCache(storeId, data) {
        const cacheKey = `${CACHE_CONFIG.KEYS.STORE_PREFIX}${storeId}`;
        await chrome.storage.local.set({
            [cacheKey]: {
                ...data,
                timestamp: Date.now()
            }
        });
    }
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

## 3. Error Handling

### 3.1 Error Types and Severity
```javascript
/**
 * Typy błędów
 * @enum {string}
 */
const ErrorType = {
    API: 'api_error',        // Błędy komunikacji z API
    AUTH: 'auth_error',      // Błędy autoryzacji
    CACHE: 'cache_error',    // Błędy cache
    DATA: 'data_error',      // Błędy danych
    STORAGE: 'storage_error', // Błędy storage
    UI: 'ui_error',          // Błędy interfejsu
    INITIALIZATION: 'init_error', // Błędy inicjalizacji
    DISPOSAL: 'disposal_error'    // Błędy czyszczenia
};

/**
 * Poziomy ważności błędów
 * @enum {string}
 */
const ErrorSeverity = {
    LOW: 'low',       // Niski priorytet
    MEDIUM: 'medium', // Średni priorytet
    HIGH: 'high'      // Wysoki priorytet
};

/**
 * Struktura błędu
 * @typedef {Object} ExtendedError
 * @property {string} code - Kod błędu
 * @property {string} message - Komunikat błędu
 * @property {ErrorType} type - Typ błędu
 * @property {ErrorSeverity} severity - Ważność błędu
 * @property {Object} [context] - Kontekst błędu
 * @property {number} timestamp - Timestamp wystąpienia
 * @property {string} [stackTrace] - Stack trace błędu
 */
```

### 3.2 Error Handling Example
```javascript
/**
 * Przykład obsługi błędów
 */
class ErrorHandler {
    /**
     * Obsłuż błąd
     * @param {Error} error - Obiekt błędu
     * @param {ErrorType} type - Typ błędu
     * @param {ErrorSeverity} severity - Ważność błędu
     * @param {Object} context - Kontekst błędu
     */
    static handleError(error, type, severity, context) {
        const extendedError = {
            code: `${type}_${Date.now()}`,
            message: error.message,
            type,
            severity,
            context,
            timestamp: Date.now(),
            stackTrace: error.stack
        };

        // Log błędu
        console.error('[ERROR]', extendedError);

        // Wysłanie do systemu monitoringu
        if (severity === ErrorSeverity.HIGH) {
            this.reportToMonitoring(extendedError);
        }

        // Powiadomienie użytkownika
        if (severity !== ErrorSeverity.LOW) {
            this.notifyUser(extendedError);
        }
    }
}
```

## 4. Notification System

### 4.1 Notification Configuration
```javascript
/**
 * Konfiguracja limitów powiadomień
 * @constant {Object}
 */
const NOTIFICATION_LIMITS = {
    PER_MINUTE: 10,    // Maksymalna liczba powiadomień na minutę
    PER_HOUR: 30,      // Maksymalna liczba powiadomień na godzinę
    PER_DAY: 100,      // Maksymalna liczba powiadomień na dzień
    COOLDOWN_MS: 3000  // Cooldown między powiadomieniami (3 sekundy)
};

/**
 * Format powiadomienia
 * @typedef {Object} NotificationData
 * @property {string} type - Typ powiadomienia
 * @property {string} title - Tytuł powiadomienia
 * @property {string} message - Treść powiadomienia
 * @property {Object} [data] - Dodatkowe dane
 * @property {boolean} [requireInteraction] - Czy wymaga interakcji
 * @property {boolean} [silent] - Czy wyciszone
 */
```

### 4.2 Notification Manager
```javascript
/**
 * Manager powiadomień
 */
class NotificationManager {
    constructor() {
        this.notificationHistory = [];
        this.lastNotificationTime = 0;
    }

    /**
     * Sprawdź czy można pokazać powiadomienie
     * @returns {Promise<boolean>}
     */
    async canShowNotification() {
        const now = Date.now();
        
        // Usuń stare wpisy (starsze niż 24h)
        this.notificationHistory = this.notificationHistory.filter(
            time => now - time < 24 * 60 * 60 * 1000
        );

        // Sprawdź cooldown
        if (now - this.lastNotificationTime < NOTIFICATION_LIMITS.COOLDOWN_MS) {
            return false;
        }

        // Sprawdź limity
        const lastMinute = this.notificationHistory.filter(
            time => now - time < 60 * 1000
        ).length;
        if (lastMinute >= NOTIFICATION_LIMITS.PER_MINUTE) return false;

        const lastHour = this.notificationHistory.filter(
            time => now - time < 60 * 60 * 1000
        ).length;
        if (lastHour >= NOTIFICATION_LIMITS.PER_HOUR) return false;

        if (this.notificationHistory.length >= NOTIFICATION_LIMITS.PER_DAY) {
            return false;
        }

        return true;
    }

    /**
     * Śledź wyświetlone powiadomienie
     */
    async trackNotification() {
        const now = Date.now();
        this.notificationHistory.push(now);
        this.lastNotificationTime = now;
        
        // Zapisz historię do storage
        await chrome.storage.local.set({
            notifications: {
                history: this.notificationHistory,
                lastTime: this.lastNotificationTime
            }
        });
    }

    /**
     * Pobierz statystyki powiadomień
     */
    getStats() {
        const now = Date.now();
        return {
            lastMinute: this.notificationHistory.filter(
                time => now - time < 60 * 1000
            ).length,
            lastHour: this.notificationHistory.filter(
                time => now - time < 60 * 60 * 1000
            ).length,
            lastDay: this.notificationHistory.length,
            timeSinceLastNotification: now - this.lastNotificationTime
        };
    }
}
```

### 4.3 Example Notification
```javascript
/**
 * Przykład tworzenia powiadomienia
 */
async function createOrderNotification(order, status) {
    const notificationManager = NotificationManager.getInstance();
    
    // Sprawdź limity
    if (!await notificationManager.canShowNotification()) {
        return;
    }

    // Utwórz powiadomienie
    chrome.notifications.create(`order-${order.order_id}`, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Nowe zamówienie',
        message: `Zamówienie #${order.order_id} - ${status}`,
        buttons: [
            {
                title: 'Zobacz szczegóły'
            }
        ],
        requireInteraction: true,
        silent: false
    });

    // Śledź powiadomienie
    await notificationManager.trackNotification();
}

## 5. Alarm System and Data Refresh

### 5.1 Alarm Configuration
```javascript
/**
 * Konfiguracja interwałów
 * @constant {Object}
 */
const DEFAULT_INTERVALS = {
    fullRefresh: 5,      // Pełne odświeżenie co 5 minut
    dataFreshness: 15,   // Sprawdzanie świeżości co 15 minut
    backgroundCheck: 5    // Sprawdzanie w tle co 5 minut
};

/**
 * Typy alarmów
 * @constant {Object}
 */
const ALARM_TYPES = {
    FETCH_DATA: 'fetchData',           // Pobieranie danych
    CHECK_ORDERS: 'checkOrders',       // Sprawdzanie zamówień
    CHECK_NEW_ORDERS: 'checkNewOrders' // Sprawdzanie nowych zamówień
};
```

### 5.2 Alarm Management
```javascript
/**
 * Zarządzanie alarmami
 */
async function updateAlarms(intervals) {
    // Usuń istniejące alarmy
    await chrome.alarms.clear(ALARM_TYPES.FETCH_DATA);
    await chrome.alarms.clear(ALARM_TYPES.CHECK_ORDERS);
    await chrome.alarms.clear(ALARM_TYPES.CHECK_NEW_ORDERS);
    
    // Utwórz nowe alarmy
    chrome.alarms.create(ALARM_TYPES.FETCH_DATA, {
        periodInMinutes: intervals.fullRefresh
    });
    
    chrome.alarms.create(ALARM_TYPES.CHECK_ORDERS, {
        periodInMinutes: intervals.dataFreshness
    });
    
    chrome.alarms.create(ALARM_TYPES.CHECK_NEW_ORDERS, {
        periodInMinutes: intervals.backgroundCheck
    });
}
```

### 5.3 Data Refresh Process
```javascript
/**
 * Proces odświeżania danych
 */
class DataRefreshProcess {
    /**
     * Pełne odświeżenie danych
     * @param {string} storeId - ID sklepu
     */
    async fullRefresh(storeId) {
        try {
            // 1. Pobierz dane z API
            const orders = await this.fetchAllOrders(storeId);
            
            // 2. Przetwórz dane
            const processedData = this.processOrders(orders);
            
            // 3. Zaktualizuj cache
            await this.updateCache(storeId, processedData);
            
            // 4. Zaktualizuj UI
            this.updateUI(processedData);
            
            // 5. Zaplanuj następne odświeżenie
            this.scheduleNextRefresh();
        } catch (error) {
            ErrorHandler.handleError(error, ErrorType.DATA, ErrorSeverity.HIGH, {
                method: 'fullRefresh',
                storeId
            });
        }
    }

    /**
     * Sprawdzanie nowych zamówień
     * @param {string} storeId - ID sklepu
     */
    async checkNewOrders(storeId) {
        try {
            // 1. Pobierz timestamp ostatniej aktualizacji
            const lastUpdate = await this.getLastUpdateTimestamp();
            
            // 2. Pobierz nowe zamówienia
            const newOrders = await this.fetchModifiedOrders(storeId, lastUpdate);
            
            // 3. Jeśli są nowe zamówienia
            if (newOrders.length > 0) {
                // 4. Zaktualizuj dane
                await this.processAndUpdateOrders(newOrders);
                
                // 5. Pokaż powiadomienia
                await this.showNotifications(newOrders);
            }
        } catch (error) {
            ErrorHandler.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'checkNewOrders',
                storeId
            });
        }
    }

    /**
     * Sprawdzanie świeżości danych
     * @param {string} storeId - ID sklepu
     */
    async checkDataFreshness(storeId) {
        try {
            // 1. Sprawdź cache
            const cache = await this.getCacheData(storeId);
            
            // 2. Sprawdź czy dane są aktualne
            const isFresh = this.isDataFresh(cache);
            
            // 3. Jeśli dane nie są aktualne
            if (!isFresh) {
                // 4. Wykonaj pełne odświeżenie
                await this.fullRefresh(storeId);
            }
        } catch (error) {
            ErrorHandler.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'checkDataFreshness',
                storeId
            });
        }
    }
}
```

### 5.4 Alarm Handlers
```javascript
/**
 * Obsługa alarmów
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        const refreshProcess = new DataRefreshProcess();
        const currentStore = await storeManager.getCurrentStore();
        
        switch (alarm.name) {
            case ALARM_TYPES.FETCH_DATA:
                await refreshProcess.fullRefresh(currentStore?.id);
                break;
                
            case ALARM_TYPES.CHECK_ORDERS:
                await refreshProcess.checkDataFreshness(currentStore?.id);
                break;
                
            case ALARM_TYPES.CHECK_NEW_ORDERS:
                await refreshProcess.checkNewOrders(currentStore?.id);
                break;
        }
    } catch (error) {
        ErrorHandler.handleError(error, ErrorType.ALARM, ErrorSeverity.HIGH, {
            alarmName: alarm.name
        });
    }
}); 