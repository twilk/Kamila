# Plan zmian statusów zamówień

## Nowe statusy
- 🔔 Nieruszone (status_id = 1,2)
- 📞 Obdzwonione (status_id = 3,4)
- 📦 Gotowe (status_id = 5,8,13)
- 🆘 Zaległe (status_id = 1,2,3,4,5,8,13 ; utworzone między 3 a 7 dni temu)
- 💩 Dramat (status_id = 1,2,3,4,5,8,13 ; utworzone ponad 7 dni temu)

## Plan implementacji

### 1. Stałe i konfiguracja
```javascript
// constants.js
export const ORDER_STATUSES = {
    UNTOUCHED: ['1', '2'],
    CALLED: ['3', '4'],
    READY: ['5', '8', '13'],
    OVERDUE: {
        STATUSES: ['1', '2', '3', '4', '5', '8', '13'],
        MIN_DAYS: 3,
        MAX_DAYS: 7
    },
    CRITICAL: {
        STATUSES: ['1', '2', '3', '4', '5', '8', '13'],
        MIN_DAYS: 7
    }
};

export const STATUS_DISPLAY = {
    UNTOUCHED: { 
        icon: '🔔', 
        label: 'Nieruszone',
        tooltip: 'Zamówienia, które nie zostały jeszcze obsłużone'
    },
    CALLED: { 
        icon: '📞', 
        label: 'Obdzwonione',
        tooltip: 'Zamówienia po kontakcie telefonicznym'
    },
    READY: { 
        icon: '📦', 
        label: 'Gotowe',
        tooltip: 'Zamówienia gotowe do odbioru'
    },
    OVERDUE: { 
        icon: '🆘', 
        label: 'Zaległe',
        tooltip: 'Zamówienia oczekujące 3-7 dni'
    },
    CRITICAL: { 
        icon: '💩', 
        label: 'Dramat',
        tooltip: 'Zamówienia oczekujące ponad 7 dni'
    }
};

// Stałe dla cache'a
export const CACHE_CONFIG = {
    VERSION: '2.0.0',
    TTL: 5 * 60 * 1000, // 5 minut
    KEYS: {
        COUNTERS: 'counters_v2_',
        LAST_VERSION: 'last_cache_version'
    }
};

// Konfiguracja dat
export const DATE_CONFIG = {
    FORMAT: 'YYYY-MM-DD',
    TIMEZONE: 'Europe/Warsaw'
};
```

### 2. Zmiany w UI

#### HTML (popup.html)
```html
<div class="lead-counters">
    <div class="lead-status" data-status="untouched" data-tooltip="Zamówienia, które nie zostały jeszcze obsłużone">
        🔔 <span class="lead-count" id="count-untouched">
            <span class="count-value">-</span>
            <span class="count-loader"></span>
            <span class="count-error"></span>
        </span>
    </div>
    <div class="lead-status" data-status="called" data-tooltip="Zamówienia po kontakcie telefonicznym">
        📞 <span class="lead-count" id="count-called">
            <span class="count-value">-</span>
            <span class="count-loader"></span>
            <span class="count-error"></span>
        </span>
    </div>
    <div class="lead-status" data-status="ready" data-tooltip="Zamówienia gotowe do odbioru">
        📦 <span class="lead-count" id="count-ready">
            <span class="count-value">-</span>
            <span class="count-loader"></span>
            <span class="count-error"></span>
        </span>
    </div>
    <div class="lead-status" data-status="overdue" data-tooltip="Zamówienia oczekujące 3-7 dni">
        🆘 <span class="lead-count" id="count-overdue">
            <span class="count-value">-</span>
            <span class="count-loader"></span>
            <span class="count-error"></span>
        </span>
    </div>
    <div class="lead-status" data-status="critical" data-tooltip="Zamówienia oczekujące ponad 7 dni">
        💩 <span class="lead-count" id="count-critical">
            <span class="count-value">-</span>
            <span class="count-loader"></span>
            <span class="count-error"></span>
        </span>
    </div>
    <div class="last-update">
        Ostatnie odświeżenie: <time id="last-update-time">-</time>
        <button id="refresh-counters" class="btn-icon">🔄</button>
    </div>
</div>
```

#### CSS (styles/counters.css)
```css
.lead-status {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
}

/* Kolory statusów */
.lead-status[data-status="untouched"] {
    --status-color: var(--blue-500);
}

.lead-status[data-status="called"] {
    --status-color: var(--green-500);
}

.lead-status[data-status="ready"] {
    --status-color: var(--purple-500);
}

.lead-status[data-status="overdue"] {
    --status-color: var(--orange-500);
}

.lead-status[data-status="critical"] {
    --status-color: var(--red-500);
}

/* Animacje liczników */
@keyframes countChange {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}

.count-changed {
    animation: countChange 0.3s ease-out;
}

/* Stany ładowania i błędów */
.count-loader {
    display: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--status-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.count-error {
    display: none;
    color: var(--color-danger);
}

.is-loading .count-loader { display: inline-block; }
.has-error .count-error { display: inline-block; }

/* Tooltips */
.lead-status::after {
    content: attr(data-tooltip);
    position: absolute;
    /* ... style dla tooltipa ... */
}
```

### 3. Internacjonalizacja

#### Tłumaczenia (locales/polish.json)
```json
{
    "orderStatuses": {
        "untouched": {
            "label": "Nieruszone",
            "tooltip": "Zamówienia, które nie zostały jeszcze obsłużone"
        },
        "called": {
            "label": "Obdzwonione",
            "tooltip": "Zamówienia po kontakcie telefonicznym"
        },
        "ready": {
            "label": "Gotowe",
            "tooltip": "Zamówienia gotowe do odbioru"
        },
        "overdue": {
            "label": "Zaległe",
            "tooltip": "Zamówienia oczekujące 3-7 dni"
        },
        "critical": {
            "label": "Dramat",
            "tooltip": "Zamówienia oczekujące ponad 7 dni"
        }
    }
}
```

#### Tłumaczenia (locales/english.json)
```json
{
    "orderStatuses": {
        "untouched": {
            "label": "Untouched",
            "tooltip": "Orders that haven't been processed yet"
        },
        "called": {
            "label": "Called",
            "tooltip": "Orders after phone contact"
        },
        "ready": {
            "label": "Ready",
            "tooltip": "Orders ready for pickup"
        },
        "overdue": {
            "label": "Overdue",
            "tooltip": "Orders waiting 3-7 days"
        },
        "critical": {
            "label": "Critical",
            "tooltip": "Orders waiting over 7 days"
        }
    }
}
```

#### Tłumaczenia (locales/ukrainian.json)
```json
{
    "orderStatuses": {
        "untouched": {
            "label": "Необроблені",
            "tooltip": "Замовлення, які ще не були оброблені"
        },
        "called": {
            "label": "Обдзвонені",
            "tooltip": "Замовлення після телефонного контакту"
        },
        "ready": {
            "label": "Готові",
            "tooltip": "Замовлення готові до видачі"
        },
        "overdue": {
            "label": "Прострочені",
            "tooltip": "Замовлення, що очікують 3-7 днів"
        },
        "critical": {
            "label": "Критичні",
            "tooltip": "Замовлення, що очікують понад 7 днів"
        }
    }
}
```

### 4. Zmiany w API (OrderService.js)

#### Modyfikacja pobierania danych
```javascript
async getOrderStatuses(storeId, options = {}) {
    // ... poprzedni kod ...

    try {
        // 1. Sprawdź cache z uwzględnieniem wersji
        await this.#checkCacheVersion();
        
        // 2. Pobierz zamówienia
        const allOrders = await this.#fetchAllOrders(storeId);

        // 3. Oblicz daty z uwzględnieniem strefy czasowej
        const dates = this.#calculateDates();

        // 4. Zlicz zamówienia
        const counts = this.#countOrders(allOrders, dates);

        // 5. Cache i zwróć wyniki
        return this.#saveCounts(storeId, counts);
    } catch (error) {
        // Fallback do cache'a w przypadku błędu API
        const cachedData = await this.#getFallbackData(storeId);
        if (cachedData) {
            return {
                ...cachedData,
                fromCache: true,
                error: error.message
            };
        }
        throw error;
    }
}

#calculateDates() {
    const now = luxon.DateTime.now().setZone(DATE_CONFIG.TIMEZONE);
    return {
        threeDaysAgo: now.minus({ days: 3 }).startOf('day'),
        sevenDaysAgo: now.minus({ days: 7 }).startOf('day')
    };
}

#validateOrderDate(order) {
    const date = order.date ? 
        luxon.DateTime.fromISO(order.date).setZone(DATE_CONFIG.TIMEZONE) :
        null;
    return date?.isValid ? date : null;
}
```

### 5. Zmiany w CounterManager

#### Aktualizacja obsługi liczników
```javascript
async handleDataUpdate(counts) {
    try {
        // 1. Pokaż stan ładowania
        this.#showLoading();

        // 2. Aktualizuj liczniki z animacją
        await this.#updateCountersWithAnimation(counts);

        // 3. Aktualizuj czas ostatniego odświeżenia
        this.#updateLastRefreshTime();

        // 4. Ukryj ładowanie
        this.#hideLoading();

    } catch (error) {
        // Pokaż błąd w UI
        this.#showError(error);
    }
}

#updateCountersWithAnimation(counts) {
    return Promise.all(
        Object.entries(counts).map(async ([status, count]) => {
            const element = document.querySelector(`#count-${status} .count-value`);
            if (!element) return;

            const oldValue = parseInt(element.textContent) || 0;
            if (oldValue !== count) {
                element.classList.add('count-changed');
                element.textContent = count;
                await new Promise(resolve => 
                    setTimeout(() => {
                        element.classList.remove('count-changed');
                        resolve();
                    }, 300)
                );
            }
        })
    );
}
```

### 6. Zmiany w InterfaceManager

#### Aktualizacja generowania URL
```javascript
generateDarwinaUrl(status, storeId) {
    const baseUrl = 'https://darwina.pl/adm/';
    const params = new URLSearchParams({
        'a': 'zamowienia',
        'daid': storeId || '0'
    });

    const dates = this.#calculateDates();

    switch (status) {
        case 'untouched':
            params.set('st[]', ORDER_STATUSES.UNTOUCHED.join(','));
            break;
        case 'called':
            params.set('st[]', ORDER_STATUSES.CALLED.join(','));
            break;
        case 'ready':
            params.set('st[]', ORDER_STATUSES.READY.join(','));
            break;
        case 'overdue': {
            params.set('st[]', ORDER_STATUSES.OVERDUE.STATUSES.join(','));
            params.set('dp', dates.sevenDaysAgo.toFormat(DATE_CONFIG.FORMAT));
            params.set('dk', dates.threeDaysAgo.toFormat(DATE_CONFIG.FORMAT));
            break;
        }
        case 'critical': {
            params.set('st[]', ORDER_STATUSES.CRITICAL.STATUSES.join(','));
            params.set('dk', dates.sevenDaysAgo.toFormat(DATE_CONFIG.FORMAT));
            break;
        }
    }

    return `${baseUrl}?${params.toString()}`;
}
```

### 7. Cache i migracja

1. Dodaj nową wersję cache'a
```javascript
const CACHE_VERSION = '2.0.0';

async #migrateCacheIfNeeded() {
    const lastVersion = await this.#storage.get(CACHE_CONFIG.KEYS.LAST_VERSION);
    
    if (lastVersion !== CACHE_VERSION) {
        await this.#clearOldCache();
        await this.#storage.set(CACHE_CONFIG.KEYS.LAST_VERSION, CACHE_VERSION);
    }
}

async #clearOldCache() {
    const keys = await this.#storage.getAllKeys();
    const oldCounterKeys = keys.filter(key => key.startsWith('counters_v1_'));
    await Promise.all(oldCounterKeys.map(key => this.#storage.remove(key)));
}
```

### 8. Testy

#### Jednostkowe
```javascript
describe('OrderService', () => {
    describe('date calculations', () => {
        it('should handle different timezones correctly', () => {
            // Test dla różnych stref czasowych
        });
        
        it('should handle month/year transitions', () => {
            // Test dla przełomu miesiąca/roku
        });
    });

    describe('performance', () => {
        it('should handle large number of orders efficiently', async () => {
            // Test wydajności
        });
    });
});
```

#### Integracyjne
- Sprawdzenie całego flow od API do UI
- Testy offline/fallback
- Testy cache'a i migracji

#### E2E
- Scenariusze użytkownika
- Testy wydajnościowe
- Testy kompatybilności

### 9. Monitorowanie

1. Dodaj metryki:
   - Czas odpowiedzi API
   - Liczba zamówień w każdym statusie
   - Czas odświeżania UI
   - Błędy i wyjątki

2. Logi:
   - Śledzenie zmian statusów
   - Błędy API i UI
   - Problemy z cache'm

3. Analityka:
   - Śledzenie używanych filtrów
   - Czas spędzony na każdym widoku
   - Najczęściej używane funkcje

### 10. Dokumentacja

1. Dokumentacja techniczna:
   - Opis nowej struktury statusów
   - Diagram przepływu danych
   - Specyfikacja API

2. Dokumentacja użytkownika:
   - Opis nowych funkcji
   - Instrukcja obsługi
   - FAQ

### 11. Plan awaryjny

1. Rollback:
   - Procedura przywracania poprzedniej wersji
   - Skrypty migracji danych wstecz
   - Punkty decyzyjne

2. Monitoring wdrożenia:
   - Metryki do śledzenia
   - Progi alarmowe
   - Procedury reagowania 