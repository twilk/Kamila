## Nowe statusy
- 🔔 Nieruszone (status_id = 1,2)
- 📞 Obdzwonione (status_id = 3,4)
- 📦 Gotowe (status_id = 5,8,13)
- 🆘 Zaległe (status_id = 1,2,3,4,5,8,13 ; utworzone między 3 a 7 dni temu)
- 💩 Dramat (status_id = 1,2,3,4,5,8,13 ; utworzone ponad 7 dni temu)


### 12. Caching i Delta Updates

#### Cache Structure
```typescript
type CacheEntry = {
  timestamp: number;
  data: {
    orders: {
      [orderId: string]: {
        id: string;
        status_id: string;
        date: string;
        ready_date?: string;
        // other order fields...
        lastModified: string; // from API
      }
    };
    counts: {
      untouched: number;
      called: number;
      ready: number;
      overdue: number;
      critical: number;
    };
    metadata: {
      lastFullSync: number;
      lastDeltaSync: number;
      version: string;
    }
  }
}
```

#### Nowe metody w OrderService
```typescript
class OrderService {
  // Istniejące metody...

  private async #performFullSync(storeId: string): Promise<CacheEntry>;
  private async #performDeltaSync(storeId: string, lastSync: number): Promise<boolean>;
  private async #mergeOrderUpdates(cached: CacheEntry, updates: Order[]): Promise<void>;
  private async #recalculateCounts(orders: {[id: string]: Order}): Promise<Counts>;
  private async #pruneOldOrders(cache: CacheEntry): Promise<void>;
}
```

#### Flow aktualizacji
```typescript
async getOrderStatuses(storeId) {
  const cache = await this.#checkCache(storeId);
  
  if (!cache) {
    // Brak cache - pełna synchronizacja
    return this.#performFullSync(storeId);
  }

  // Sprawdź czy potrzebna pełna synchronizacja (> 1 godziny)
  if (Date.now() - cache.metadata.lastFullSync > 60 * 60 * 1000) {
    return this.#performFullSync(storeId);
  }

  // Próba delta sync
  const hasChanges = await this.#performDeltaSync(
    storeId, 
    cache.metadata.lastDeltaSync
  );

  if (hasChanges) {
    // Przelicz liczniki tylko jeśli były zmiany
    cache.counts = await this.#recalculateCounts(cache.orders);
  }

  return cache;
}
```

#### Optymalizacje

1. Zarządzanie Cache:
   - Okresowe czyszczenie starych zamówień (> 30 dni)
   - Wersjonowanie cache dla migracji schematu
   - Limity rozmiaru cache
   - Odzyskiwanie po błędach (fallback do pełnej synchronizacji)

2. Wydajność:
   - Użycie IndexedDB zamiast localStorage dla większego cache
   - Synchronizacja w tle z ServiceWorker
   - Debouncing/throttling requestów
   - Grupowanie aktualizacji statusów

3. Obsługa błędów:
   - Graceful degradation przy problemach z siecią
   - Retry logic z exponential backoff
   - Walidacja cache
   - Odzyskiwanie po uszkodzeniu cache

#### Implementacja

1. Migracja do IndexedDB:
```javascript
class CacheStore {
    async init() {
        this.db = await openDB('orders-cache', 1, {
            upgrade(db) {
                db.createObjectStore('orders', { keyPath: 'id' });
                db.createObjectStore('metadata');
            }
        });
    }

    async set(key, value) {
        await this.db.put('orders', value);
    }

    async get(key) {
        return this.db.get('orders', key);
    }
}
```

2. ServiceWorker dla synchronizacji:
```javascript
// sw.js
self.addEventListener('sync', event => {
    if (event.tag === 'order-sync') {
        event.waitUntil(syncOrders());
    }
});
```

3. Retry logic:
```javascript
async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetch(url, options);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }
}
```

4. Cache validation:
```javascript
function validateCache(cache) {
    if (!cache.version || cache.version !== CACHE_VERSION) {
        throw new CacheValidationError('Invalid cache version');
    }
    // More validation...
}
```

#### Metryki i monitoring

1. Śledzenie wydajności:
   - Czas synchronizacji
   - Rozmiar cache
   - Liczba delta updates
   - Hit rate cache

2. Alerty:
   - Błędy synchronizacji
   - Przekroczenie limitu cache
   - Problemy z wydajnością

3. Logi:
   - Szczegóły synchronizacji
   - Błędy i wyjątki
   - Zmiany statusów

#### Plan wdrożenia

1. Faza 1 - Podstawowa implementacja:
   - Struktura cache
   - Podstawowe metody sync
   - Obsługa błędów

2. Faza 2 - Optymalizacje:
   - Migracja do IndexedDB
   - Implementacja delta updates
   - ServiceWorker

3. Faza 3 - Monitoring:
   - Metryki
   - Alerty
   - Dashboardy

4. Faza 4 - Testy i QA:
   - Testy wydajności
   - Testy obciążeniowe
   - Scenariusze błędów 

### 13. Integracja z istniejącym codebase

#### Nowe pliki
```
services/
├── core/
│   ├── CacheManager.js       # Zarządzanie cache z użyciem IndexedDB
│   └── SyncManager.js        # Koordynacja synchronizacji
├── api/
│   └── OrderSyncService.js   # Obsługa delta sync z API
└── workers/
    └── sync.worker.js        # Background sync
```

#### Integracja z istniejącymi serwisami

1. Cache.js (services/cache.js):
```javascript
// Migracja z obecnego cache.js do nowego CacheManager
class CacheManager extends BaseManager {
    constructor() {
        super();
        this.legacyCache = require('../cache.js');
        this.store = new IndexedDBStore();
    }

    async migrateFromLegacy() {
        const oldData = await this.legacyCache.getAll();
        await this.store.migrateData(oldData);
    }
}
```

2. API (services/api.js, services/darwinApi.js):
```javascript
// Rozszerzenie obecnego API o wsparcie dla delta sync
class OrderSyncService {
    constructor(api, darwinApi) {
        this.api = api;
        this.darwinApi = darwinApi;
    }

    async getModifiedOrders(since) {
        return this.api.get('/orders/modified', {
            params: { since: since.toISOString() }
        });
    }
}
```

3. Logi (services/logs/):
```javascript
// Dodanie nowych typów logów
const LOG_TYPES = {
    ...existingTypes,
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_FAILED: 'sync:failed',
    CACHE_MIGRATED: 'cache:migrated',
    CACHE_ERROR: 'cache:error'
};
```

#### Zmiany w istniejących managerach

1. OrderService:
```javascript
class OrderService {
    constructor() {
        this.syncManager = new SyncManager();
        this.cacheManager = new CacheManager();
    }

    async initialize() {
        await this.cacheManager.migrateFromLegacy();
        await this.syncManager.initialize();
    }
}
```

2. EventManager:
```javascript
// Dodanie nowych eventów
const SYNC_EVENTS = {
    SYNC_STARTED: 'sync:started',
    SYNC_PROGRESS: 'sync:progress',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_FAILED: 'sync:failed'
};
```

3. UIManager:
```javascript
// Dodanie wsparcia dla indykatorów synchronizacji
class UIManager {
    showSyncProgress(progress) {
        this.updateElement('sync-indicator', {
            progress,
            visible: true
        });
    }
}
```

#### Aktualizacja manifestu

```json
{
  "permissions": [
    "storage",
    "background",
    "alarms"
  ],
  "background": {
    "service_worker": "workers/sync.worker.js"
  }
}
```

#### Plan migracji danych

1. Faza przygotowawcza:
   - Backup obecnego cache
   - Walidacja istniejących danych
   - Przygotowanie skryptów rollback

2. Migracja:
   - Inicjalizacja IndexedDB
   - Migracja danych z localStorage
   - Weryfikacja spójności

3. Czyszczenie:
   - Usunięcie starych danych po potwierdzeniu
   - Aktualizacja referencji w kodzie
   - Usunięcie nieużywanego kodu

#### Testy integracyjne

1. Scenariusze testowe:
```javascript
describe('Cache Migration', () => {
    it('should migrate existing data', async () => {
        const manager = new CacheManager();
        await manager.migrateFromLegacy();
        const migrated = await manager.store.getAll();
        expect(migrated).toMatchSnapshot();
    });
});

describe('Sync Integration', () => {
    it('should handle concurrent updates', async () => {
        const sync = new SyncManager();
        const results = await Promise.all([
            sync.performSync(),
            sync.performSync()
        ]);
        expect(results[0].conflicted).toBe(false);
    });
});
```

2. Monitoring:
   - Dodanie metryk migracji
   - Śledzenie wydajności nowego cache
   - Monitorowanie konfliktów synchronizacji 

### 14. Struktura zarządzania stanem aplikacji

#### Timestamps i Last Open
```typescript
type AppState = {
    lastOpen: {
        popup: number;      // Timestamp ostatniego otwarcia popup
        options: number;    // Timestamp ostatniego otwarcia opcji
        drwn: number;      // Timestamp ostatniego otwarcia DRWN
    };
    lastSync: {
        orders: number;     // Timestamp ostatniej synchronizacji zamówień
        status: number;     // Timestamp ostatniej aktualizacji statusów
    };
    notifications: {
        enabled: boolean;   // Czy powiadomienia są włączone
        sound: boolean;     // Czy dźwięk jest włączony
        lastShown: number;  // Timestamp ostatniego powiadomienia
    }
}
```

#### Nowe metody w StatusManager
```typescript
class StatusManager {
    // Istniejące metody...

    private async #updateTimestamp(key: string): Promise<void>;
    private async #checkNotificationCooldown(): Promise<boolean>;
    private async #shouldShowNotification(type: string): Promise<boolean>;
    private async #playNotificationSound(): Promise<void>;
}
```

#### Background Sync
```typescript
// sync.worker.js
self.addEventListener('sync', async (event) => {
    if (event.tag === 'orders-sync') {
        const state = await getAppState();
        
        // Sprawdź czy minęło wystarczająco czasu od ostatniej synchronizacji
        if (Date.now() - state.lastSync.orders > 5 * 60 * 1000) {
            await syncOrders();
            await updateLastSync('orders');
        }
    }
});
```

#### Integracja z NotificationManager
```typescript
class NotificationManager {
    async show(title: string, message: string, options: NotificationOptions) {
        const state = await getAppState();
        
        // Sprawdź cooldown i preferencje
        if (!state.notifications.enabled) return;
        if (!await this.#checkCooldown()) return;
        
        // Pokaż powiadomienie
        const notification = await this.#createNotification(title, message, options);
        
        // Aktualizuj stan
        await this.#updateLastShown();
        
        // Odtwórz dźwięk jeśli włączony
        if (state.notifications.sound) {
            await this.#playSound();
        }
        
        return notification;
    }
}
```

#### Persystencja stanu
```typescript
class StateManager {
    private async #saveState(state: AppState): Promise<void> {
        await chrome.storage.local.set({ appState: state });
    }
    
    private async #loadState(): Promise<AppState> {
        const { appState } = await chrome.storage.local.get('appState');
        return appState || this.#getDefaultState();
    }
    
    private #getDefaultState(): AppState {
        return {
            lastOpen: {
                popup: 0,
                options: 0,
                drwn: 0
            },
            lastSync: {
                orders: 0,
                status: 0
            },
            notifications: {
                enabled: true,
                sound: true,
                lastShown: 0
            }
        };
    }
}
```

#### Migracja danych
```typescript
async function migrateAppState(oldState: any): Promise<AppState> {
    // Konwersja starego formatu do nowego
    const newState = getDefaultState();
    
    if (oldState) {
        // Zachowaj kompatybilność wsteczną
        newState.notifications.enabled = oldState.notificationsEnabled ?? true;
        newState.notifications.sound = oldState.soundEnabled ?? true;
        
        // Przenieś timestampy jeśli istnieją
        if (oldState.lastSync) {
            newState.lastSync = {
                ...newState.lastSync,
                ...oldState.lastSync
            };
        }
    }
    
    return newState;
}
```

#### Testy
```typescript
describe('StateManager', () => {
    let stateManager: StateManager;
    
    beforeEach(() => {
        stateManager = new StateManager();
    });
    
    test('should load default state when no state exists', async () => {
        const state = await stateManager.loadState();
        expect(state).toEqual(getDefaultState());
    });
    
    test('should migrate old state format', async () => {
        const oldState = {
            notificationsEnabled: false,
            soundEnabled: true
        };
        
        const migratedState = await migrateAppState(oldState);
        expect(migratedState.notifications.enabled).toBe(false);
        expect(migratedState.notifications.sound).toBe(true);
    });
});
```

### 15. Konfiguracja powiadomień i synchronizacji

#### Struktura konfiguracji
```typescript
type SyncConfig = {
  checkInterval: '5m' | '3m' | '2m' | '1m' | '30s' | 'OFF';
  notificationDelay: '60m' | '30m' | '15m' | '5m' | '0m' | 'OFF';
  refreshInterval: '24h' | '12h' | '6h' | '3h' | '1h' | 'OFF';
  freshness: '60m' | '30m' | '15m' | '5m' | '1m' | 'OFF';
}

type NotificationPreferences = {
  enabled: boolean;
  sound: boolean;
  soundUrl?: string;
  minDiff: number; // minimalna różnica dla notyfikacji
  grouping: boolean; // grupowanie podobnych notyfikacji
  criticalOnly: boolean; // tylko krytyczne zmiany
}
```

#### UI Komponent (settings/SyncSettings.tsx)
```typescript
const INTERVALS = {
  checking: [
    { label: 'OFF', value: 'OFF' },
    { label: '5 min', value: '5m' },
    { label: '3 min', value: '3m' },
    { label: '2 min', value: '2m' },
    { label: '1 min', value: '1m' },
    { label: '30 sec', value: '30s' }
  ],
  notifications: [
    { label: 'OFF', value: 'OFF' },
    { label: '60 min', value: '60m' },
    { label: '30 min', value: '30m' },
    { label: '15 min', value: '15m' },
    { label: '5 min', value: '5m' },
    { label: 'Natychmiast', value: '0m' }
  ],
  refresh: [
    { label: 'OFF', value: 'OFF' },
    { label: '24h', value: '24h' },
    { label: '12h', value: '12h' },
    { label: '6h', value: '6h' },
    { label: '3h', value: '3h' },
    { label: '1h', value: '1h' }
  ],
  freshness: [
    { label: 'OFF', value: 'OFF' },
    { label: '60 min', value: '60m' },
    { label: '30 min', value: '30m' },
    { label: '15 min', value: '15m' },
    { label: '5 min', value: '5m' },
    { label: '1 min', value: '1m' }
  ]
};

class SyncSettingsManager extends BaseManager {
  #config: SyncConfig;
  #notificationPrefs: NotificationPreferences;

  constructor() {
    super();
    this.addDependency('storage');
    this.addDependency('notification');
  }

  async loadSettings() {
    const storage = await this.getDependency('storage');
    this.#config = await storage.get('sync_config') || this.#getDefaultConfig();
    this.#notificationPrefs = await storage.get('notification_prefs') || this.#getDefaultNotificationPrefs();
    return {
      config: this.#config,
      notificationPrefs: this.#notificationPrefs
    };
  }

  async updateSettings(newConfig: Partial<SyncConfig>, newPrefs: Partial<NotificationPreferences>) {
    // Aktualizuj ustawienia
    this.#config = { ...this.#config, ...newConfig };
    this.#notificationPrefs = { ...this.#notificationPrefs, ...newPrefs };

    // Zapisz w storage
    const storage = await this.getDependency('storage');
    await storage.set('sync_config', this.#config);
    await storage.set('notification_prefs', this.#notificationPrefs);

    // Zaktualizuj harmonogram synchronizacji
    await this.#updateSyncSchedule();

    // Zaktualizuj ustawienia notyfikacji
    await this.#updateNotificationSettings();
  }

  #getDefaultConfig(): SyncConfig {
    return {
      checkInterval: '5m',
      notificationDelay: '15m',
      refreshInterval: '6h',
      freshness: '15m'
    };
  }

  #getDefaultNotificationPrefs(): NotificationPreferences {
    return {
      enabled: true,
      sound: false,
      minDiff: 1,
      grouping: true,
      criticalOnly: false
    };
  }

  async #updateSyncSchedule() {
    if (this.#config.checkInterval === 'OFF') {
      await chrome.alarms.clear('order-sync');
      return;
    }

    const minutes = parseInt(this.#config.checkInterval);
    await chrome.alarms.create('order-sync', {
      periodInMinutes: minutes
    });
  }

  async #updateNotificationSettings() {
    const notification = await this.getDependency('notification');
    await notification.updateConfig(this.#notificationPrefs);
  }
}
```

#### Integracja z OrderService

```typescript
class OrderService {
  #settingsManager: SyncSettingsManager;
  
  async #shouldSync(): Promise<boolean> {
    const { config } = await this.#settingsManager.loadSettings();
    if (config.checkInterval === 'OFF') return false;
    
    const lastSync = await this.#getLastSyncTime();
    const minInterval = this.#parseInterval(config.checkInterval);
    return Date.now() - lastSync >= minInterval;
  }

  async #shouldNotify(newCounts: OrderCounts): Promise<boolean> {
    const { config, notificationPrefs } = await this.#settingsManager.loadSettings();
    if (!notificationPrefs.enabled || config.notificationDelay === 'OFF') return false;

    const lastNotification = await this.#getLastNotificationTime();
    const minDelay = this.#parseInterval(config.notificationDelay);
    if (Date.now() - lastNotification < minDelay) return false;

    // Sprawdź czy zmiana jest wystarczająco istotna
    const diff = Math.abs(newCounts.untouched - this.#lastKnownState.lastUntouchedCount);
    if (diff < notificationPrefs.minDiff) return false;

    // Sprawdź czy pokazywać tylko krytyczne
    if (notificationPrefs.criticalOnly && newCounts.critical === 0) return false;

    return true;
  }

  #parseInterval(interval: string): number {
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 0;
    }
  }
}
```

#### Aktualizacja UI

1. Dodanie komponentu ustawień:
```html
<div class="settings-section">
  <h3>Sprawdzanie</h3>
  <div class="interval-controls">
    <label>Sprawdzanie</label>
    <div class="btn-group">
      <button class="btn" data-interval="OFF">OFF</button>
      <button class="btn" data-interval="5m">5m</button>
      <button class="btn" data-interval="3m">3m</button>
      <button class="btn" data-interval="2m">2m</button>
      <button class="btn" data-interval="1m">1m</button>
      <button class="btn" data-interval="30s">30s</button>
    </div>
  </div>

  <div class="interval-controls">
    <label>Powiadomienia</label>
    <div class="btn-group">
      <button class="btn" data-notification="OFF">OFF</button>
      <button class="btn" data-notification="60m">60m</button>
      <button class="btn" data-notification="30m">30m</button>
      <button class="btn" data-notification="15m">15m</button>
      <button class="btn" data-notification="5m">5m</button>
      <button class="btn" data-notification="0m">0m</button>
    </div>
  </div>

  <div class="interval-controls">
    <label>Odświeżanie</label>
    <div class="btn-group">
      <button class="btn" data-refresh="OFF">OFF</button>
      <button class="btn" data-refresh="24h">24h</button>
      <button class="btn" data-refresh="12h">12h</button>
      <button class="btn" data-refresh="6h">6h</button>
      <button class="btn" data-refresh="3h">3h</button>
      <button class="btn" data-refresh="1h">1h</button>
    </div>
  </div>

  <div class="interval-controls">
    <label>Świeżość</label>
    <div class="btn-group">
      <button class="btn" data-freshness="OFF">OFF</button>
      <button class="btn" data-freshness="60m">60m</button>
      <button class="btn" data-freshness="30m">30m</button>
      <button class="btn" data-freshness="15m">15m</button>
      <button class="btn" data-freshness="5m">5m</button>
      <button class="btn" data-freshness="1m">1m</button>
    </div>
  </div>

  <div class="notification-options">
    <div class="form-group">
      <label>
        <input type="checkbox" id="notification-sound">
        Dźwięk powiadomień
      </label>
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" id="notification-grouping">
        Grupuj podobne powiadomienia
      </label>
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" id="notification-critical">
        Tylko krytyczne zmiany
      </label>
    </div>
  </div>
</div>
```

2. Style CSS:
```css
.interval-controls {
  margin-bottom: 1rem;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

.btn-group .btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
}

.btn-group .btn.active {
  background: #4CAF50;
  color: white;
  border-color: #388E3C;
}

.notification-options {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 0.5rem;
}

[data-theme="dark"] .btn-group .btn {
  background: #424242;
  border-color: #616161;
  color: #fff;
}

[data-theme="dark"] .btn-group .btn.active {
  background: #388E3C;
  border-color: #2E7D32;
}

[data-theme="dark"] .radio-label:hover {
  background: var(--hover-bg-dark);
}

[data-theme="dark"] .radio-input:checked + span {
  color: var(--primary-color-dark);
}

[data-theme="dark"] .radio-label:has(.radio-input:checked) {
  border-color: var(--primary-color-dark);
  background: var(--primary-bg-dark);
}
```

#### Persystencja ustawień

1. Storage schema:
```typescript
interface SyncSettings {
  version: string;
  lastUpdate: number;
  config: SyncConfig;
  notifications: NotificationPreferences;
}
```

2. Migracje:
```typescript
const migrations = {
  '1.0.0': (data: any) => ({
    version: '1.0.0',
    lastUpdate: Date.now(),
    config: {
      checkInterval: data?.checkInterval || '5m',
      notificationDelay: data?.notificationDelay || '15m',
      refreshInterval: data?.refreshInterval || '6h',
      freshness: data?.freshness || '15m'
    },
    notifications: {
      enabled: true,
      sound: false,
      minDiff: 1,
      grouping: true,
      criticalOnly: false
    }
  })
};
```

#### Integracja z EventManager

```typescript
const SETTINGS_EVENTS = {
  CONFIG_CHANGED: 'settings:config_changed',
  NOTIFICATIONS_CHANGED: 'settings:notifications_changed',
  SYNC_SCHEDULED: 'settings:sync_scheduled',
  SYNC_CANCELLED: 'settings:sync_cancelled'
};

// Emitowanie eventów przy zmianach
async #handleConfigChange(newConfig: SyncConfig) {
  await this.eventManager.emit(SETTINGS_EVENTS.CONFIG_CHANGED, {
    oldConfig: this.#config,
    newConfig
  });
}
```

#### Testy

```typescript
describe('SyncSettingsManager', () => {
  it('should load default settings if none exist', async () => {
    const manager = new SyncSettingsManager();
    const settings = await manager.loadSettings();
    expect(settings.config.checkInterval).toBe('5m');
  });

  it('should update sync schedule when interval changes', async () => {
    const manager = new SyncSettingsManager();
    await manager.updateSettings({ checkInterval: '1m' }, {});
    const alarm = await chrome.alarms.get('order-sync');
    expect(alarm.periodInMinutes).toBe(1);
  });

  it('should disable notifications when turned off', async () => {
    const manager = new SyncSettingsManager();
    await manager.updateSettings({}, { enabled: false });
    const service = new OrderService();
    const shouldNotify = await service['#shouldNotify']({ untouched: 10 });
    expect(shouldNotify).toBe(false);
  });
});
```

### 16. Połączenie UI z logiką

#### Inicjalizacja UI
```javascript
class SettingsUI {
  #settingsManager;
  #soundPlayer;

  constructor() {
    this.#settingsManager = new SyncSettingsManager();
    this.#soundPlayer = new AudioPlayer();
    this.#initializeUI();
  }

  async #initializeUI() {
    // Załaduj zapisane ustawienia
    const { config, notificationPrefs } = await this.#settingsManager.loadSettings();
    
    // Ustaw radio buttony
    this.#setRadioValue('check_frequency', config.checkInterval);
    this.#setRadioValue('notification_interval', config.notificationDelay);
    this.#setRadioValue('full_refresh', config.refreshInterval);
    this.#setRadioValue('data_freshness', config.freshness);

    // Ustaw URL dźwięku
    const soundUrl = document.getElementById('sound-url');
    soundUrl.value = notificationPrefs.soundUrl || '';
    soundUrl.disabled = !notificationPrefs.sound;

    // Podłącz event listenery
    this.#setupEventListeners();
  }

  #setRadioValue(name, value) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  #setupEventListeners() {
    // Radio button groups
    const radioGroups = document.querySelectorAll('.custom-radio-group form');
    radioGroups.forEach(form => {
      form.addEventListener('change', async (e) => {
        const { name, value } = e.target;
        const configKey = this.#mapNameToConfigKey(name);
        if (configKey) {
          await this.#settingsManager.updateSettings({
            [configKey]: value
          }, {});
        }
      });
    });

    // Sound URL
    const soundUrl = document.getElementById('sound-url');
    const testSound = document.getElementById('test-sound');

    soundUrl.addEventListener('change', async (e) => {
      await this.#settingsManager.updateSettings({}, {
        soundUrl: e.target.value
      });
    });

    testSound.addEventListener('click', () => {
      const url = soundUrl.value;
      if (url) this.#soundPlayer.playTest(url);
    });

    // Tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
      new bootstrap.Tooltip(tooltip);
    });
  }

  #mapNameToConfigKey(name) {
    const mapping = {
      'check_frequency': 'checkInterval',
      'notification_interval': 'notificationDelay',
      'full_refresh': 'refreshInterval',
      'data_freshness': 'freshness'
    };
    return mapping[name];
  }
}

class AudioPlayer {
  #audio = null;

  async playTest(url) {
    try {
      if (this.#audio) {
        this.#audio.pause();
        this.#audio = null;
      }

      this.#audio = new Audio(url);
      await this.#audio.play();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }
}
```

#### Integracja z popup.js
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Inicjalizacja UI ustawień
  const settingsUI = new SettingsUI();
  
  // Obsługa zmian zakładek
  const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
  tabs.forEach(tab => {
    tab.addEventListener('shown.bs.tab', async (e) => {
      if (e.target.getAttribute('href') === '#settings') {
        // Odśwież ustawienia przy wejściu w zakładkę
        await settingsUI.refreshSettings();
      }
    });
  });
});
```

#### Style dla radio groups
```css
.radio-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-group-label {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.custom-radio-group {
  display: flex;
  gap: 0.5rem;
}

.custom-radio-group form {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.radio-label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-label:hover {
  background: var(--hover-bg);
}

.radio-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.radio-input:checked + span {
  color: var(--primary-color);
  font-weight: 500;
}

.radio-label:has(.radio-input:checked) {
  border-color: var(--primary-color);
  background: var(--primary-bg);
}

/* Dark theme */
[data-theme="dark"] .radio-group-label {
  color: var(--text-primary-dark);
}

[data-theme="dark"] .radio-label {
  border-color: var(--border-color-dark);
  color: var(--text-primary-dark);
}

[data-theme="dark"] .radio-label:hover {
  background: var(--hover-bg-dark);
}

[data-theme="dark"] .radio-input:checked + span {
  color: var(--primary-color-dark);
}

[data-theme="dark"] .radio-label:has(.radio-input:checked) {
  border-color: var(--primary-color-dark);
  background: var(--primary-bg-dark);
}
```

#### Aktualizacja EventManager
```typescript
const SETTINGS_UI_EVENTS = {
  SETTINGS_LOADED: 'settings:loaded',
  SETTINGS_SAVED: 'settings:saved',
  SOUND_TESTED: 'settings:sound_tested',
  TAB_CHANGED: 'settings:tab_changed'
};

// W SettingsUI
async #emitSettingsChange(type, data) {
  const eventManager = await this.getDependency('event');
  await eventManager.emit(SETTINGS_UI_EVENTS.SETTINGS_SAVED, {
    type,
    data,
    timestamp: Date.now()
  });
}
```

#### Testy UI
```typescript
describe('SettingsUI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <!-- radio groups HTML -->
    `;
  });

  it('should initialize with saved settings', async () => {
    const settingsUI = new SettingsUI();
    await settingsUI.init();

    const checkedRadio = document.querySelector('input[name="check_frequency"]:checked');
    expect(checkedRadio.value).toBe('5m');
  });

  it('should update settings on radio change', async () => {
    const settingsUI = new SettingsUI();
    await settingsUI.init();

    const radio = document.querySelector('input[value="1m"]');
    radio.click();

    const settings = await settingsUI.getSettings();
    expect(settings.config.checkInterval).toBe('1m');
  });

  it('should handle sound test', async () => {
    const settingsUI = new SettingsUI();
    await settingsUI.init();

    const soundUrl = document.getElementById('sound-url');
    const testBtn = document.getElementById('test-sound');

    soundUrl.value = 'test.mp3';
    testBtn.click();

    // Should create Audio instance
    expect(window.Audio).toHaveBeenCalledWith('test.mp3');
  });
});
```

### 17. Optymalizacja cachowania

#### Struktura CacheManager
```typescript
class CacheManager extends BaseManager {
  #cache: Map<string, {
    value: any;
    timestamp: number;
    ttl: number;
  }>;

  #stats: {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
  };

  constructor() {
    super();
    this.#cache = new Map();
    this.#stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
  }

  async get(key: string, options?: { ttl?: number }): Promise<any>;
  async set(key: string, value: any, options?: { ttl?: number }): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(): Promise<void>;
  getStats(): CacheStats;
}
```

#### Konfiguracja cache
```typescript
const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_SIZE: 1000, // Maximum number of entries
  CLEANUP_INTERVAL: 60 * 1000, // 1 minute
  COMPRESSION_THRESHOLD: 1024 // 1KB
};
```

#### Metryki cache
```typescript
interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  evictionRate: number;
}
```

#### Przykład użycia
```typescript
const cacheManager = CacheManager.getInstance();

// Set value with custom TTL
await cacheManager.set('my-key', { data: 'value' }, {
  ttl: 60 * 1000 // 1 minute
});

// Get value
const value = await cacheManager.get('my-key');

// Check stats
const stats = cacheManager.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
```

✅ Zaimplementowano:
- Struktura CacheManager
  - Mapa cache z TTL
  - Statystyki użycia
  - Kompresja danych
  - Czyszczenie automatyczne
- Optymalizacje
  - Kompresja dużych obiektów
  - Eviction policy (LRU)
  - Okresowe czyszczenie
  - Limity rozmiaru
- Metryki
  - Hit/miss ratio
  - Eviction rate
  - Rozmiar cache
  - Statystyki kompresji

🔄 W trakcie:
- Testy wydajnościowe
- Monitorowanie zużycia pamięci
- Optymalizacja kompresji

⏭️ Następne kroki:
- Dodanie cache hierarchicznego
- Implementacja cache rozproszonego
- Dodanie cache preloadingu