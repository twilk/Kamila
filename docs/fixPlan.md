<!-- INSTRUKCJA DLA AI:
Ten plik fixPlan.md służy jako centralny dokument podsumowujący plan naprawy błędów inicjalizacji i zależności.
WAŻNE: Za każdym razem, gdy nowe informacje, zmiany lub ustalenia pojawiają się w trakcie naszej dyskusji, uzupełniaj i aktualizuj ten plik tak, aby zawierał najnowszy stan projektu oraz proponowane modyfikacje.
Instrukcja ta jest stała i musi być zachowana na początku pliku. Nigdy jej nie usuwaj ani nie modyfikuj w sposób, który usuwa istotę tej wiadomości.
W razie potrzeby, rozwijaj i aktualizuj dalsze sekcje dotyczące inicjalizacji, synchronizacji, zarządzania stanem menedżerów oraz rozwiązywania problemów zależności.
-->

# Plan naprawy systemu menedżerów (Phase 1 - Critical)

## 1. Podstawowa implementacja ManagerRegistry

```javascript
class ManagerRegistry {
  #managers = new Map();
  #managerClasses = new Map();
  #initQueue = [];
  #isInitializing = false;
  #criticalManagers = ['error', 'log', 'store', 'event'];

  constructor() {
    this.#managers = new Map();
    this.#managerClasses = new Map();
    this.#initQueue = [];
  }

  register(name, ManagerClass) {
    if (this.#managerClasses.has(name)) {
      throw new Error(`Manager "${name}" already registered`);
    }
    this.#managerClasses.set(name, ManagerClass);
  }

  async get(name) {
    if (!this.#managers.has(name)) {
      const ManagerClass = this.#managerClasses.get(name);
      if (!ManagerClass) throw new Error(`Manager ${name} not found`);
      
      try {
        const instance = new ManagerClass(this);
        this.#managers.set(name, instance);
        
        // Inicjalizuj od razu jeśli to krytyczny menedżer
        if (this.#criticalManagers.includes(name)) {
          await instance.initialize();
        }
      } catch (error) {
        this.#managers.delete(name);
        throw error;
      }
    }
    return this.#managers.get(name);
  }

  async initializeAll() {
    if (this.#isInitializing) return;
    this.#isInitializing = true;

    try {
      // 1. Inicjalizuj krytyczne menedżery w określonej kolejności
      for (const name of this.#criticalManagers) {
        await this.get(name);
      }

      // 2. Inicjalizuj pozostałe menedżery
      for (const [name, manager] of this.#managers) {
        if (!manager.isInitialized() && !this.#criticalManagers.includes(name)) {
          this.#initQueue.push(name);
        }
      }

      while (this.#initQueue.length > 0) {
        const name = this.#initQueue.shift();
        const manager = await this.get(name);
        try {
          await manager.initialize();
        } catch (error) {
          console.error(`Failed to initialize ${name}:`, error);
          // Dodaj z powrotem do kolejki jeśli to nie ostatnia próba
          if (this.#initQueue.length > 0) {
            this.#initQueue.push(name);
          }
        }
      }
    } finally {
      this.#isInitializing = false;
    }
  }

  reset() {
    this.#managers.clear();
    this.#initQueue = [];
    this.#isInitializing = false;
  }
}
```

## 2. Podstawowy BaseManager

```javascript
class BaseManager {
  #initialized = false;
  #registry;
  #initError = null;
  #dependencies = new Set();

  constructor(registry) {
    this.#registry = registry;
  }

  isInitialized() {
    return this.#initialized;
  }

  getLastError() {
    return this.#initError;
  }

  async getManager(name) {
    return this.#registry.get(name);
  }

  addDependency(name) {
    this.#dependencies.add(name);
  }

  async initialize() {
    if (this.#initialized) return;

    try {
      // Inicjalizuj zależności najpierw
      for (const dep of this.#dependencies) {
        const manager = await this.getManager(dep);
        if (!manager.isInitialized()) {
          await manager.initialize();
        }
      }

      await this._initialize();
      this.#initialized = true;
      this.#initError = null;
    } catch (error) {
      this.#initError = error;
      this.#initialized = false;
      throw error;
    }
  }

  // Override in subclasses
  async _initialize() {}
}
```

## 3. Lista menedżerów do migracji

1. Krytyczne menedżery (w kolejności inicjalizacji):
   - ErrorHandler (PIERWSZY - obsługa błędów)
   - LogManager (DRUGI - logowanie)
   - StoreManager (TRZECI - storage/state)
   - EventManager (CZWARTY - eventy)
   - APIManager (PIĄTY - komunikacja)
   - DataManager (SZÓSTY - dane)
   - StatusManager (SIÓDMY - status)
   - InitializationManager (ÓSMY - kontrola inicjalizacji)

2. Pozostałe menedżery (kolejność nie jest krytyczna):
   - ThemeManager
   - LanguageManager
   - NotificationManager
   - CacheManager
   - CounterManager
   - VolumeManager
   - UserManager
   - AlarmManager
   - ConnectionManager
   - UpdateManager
   - WallpaperManager

## 4. Przykłady migracji krytycznych menedżerów

### 4.1 ErrorHandler
```javascript
class ErrorHandler extends BaseManager {
  #errors = [];
  
  constructor(registry) {
    super(registry);
  }

  async _initialize() {
    // ErrorHandler nie ma zależności - musi działać pierwszy
    this.setupErrorHandlers();
  }

  setupErrorHandlers() {
    window.onerror = (msg, url, line, col, error) => {
      this.handleError(error || new Error(msg));
    };
    
    window.onunhandledrejection = (event) => {
      this.handleError(event.reason);
    };
  }

  handleError(error) {
    this.#errors.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack
    });
    
    // Loguj tylko jeśli LogManager jest dostępny
    this.getManager('log').then(logManager => {
      if (logManager.isInitialized()) {
        logManager.error(error);
      }
    }).catch(() => {
      // LogManager niedostępny - zapisz do konsoli
      console.error(error);
    });
  }
}
```

### 4.2 LogManager
```javascript
class LogManager extends BaseManager {
  #logs = [];
  
  constructor(registry) {
    super(registry);
  }

  async _initialize() {
    // LogManager zależy tylko od ErrorHandler
    this.addDependency('error');
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };
    
    this.#logs.push(entry);
    
    // Wyślij do chrome.storage jeśli StoreManager jest dostępny
    this.getManager('store').then(storeManager => {
      if (storeManager.isInitialized()) {
        storeManager.append('logs', entry);
      }
    }).catch(() => {
      // StoreManager niedostępny - zapisz lokalnie
      console.log(entry);
    });
  }
}
```

## 5. Aktualizacja managers.js

```javascript
// managers.js
import { ManagerRegistry } from './ManagerRegistry';
import { ErrorHandler } from './ErrorHandler';
import { LogManager } from './LogManager';
import { StoreManager } from './StoreManager';
import { EventManager } from './EventManager';
import { APIManager } from './APIManager';
import { DataManager } from './DataManager';
import { StatusManager } from './StatusManager';
import { InitializationManager } from './InitializationManager';

const registry = new ManagerRegistry();

// Rejestracja krytycznych menedżerów (kolejność ma znaczenie!)
registry.register('error', ErrorHandler);
registry.register('log', LogManager);
registry.register('store', StoreManager);
registry.register('event', EventManager);
registry.register('api', APIManager);
registry.register('data', DataManager);
registry.register('status', StatusManager);
registry.register('init', InitializationManager);

// Rejestracja pozostałych menedżerów
import { ThemeManager } from './ThemeManager';
import { LanguageManager } from './LanguageManager';
// ... pozostałe importy

registry.register('theme', ThemeManager);
registry.register('lang', LanguageManager);
// ... rejestracja pozostałych

export { registry };
```

## 6. Aktualizacja entry points

### background.js
```javascript
import { registry } from './managers';

let isInitialized = false;

async function initializeBackground() {
  if (isInitialized) return;
  
  try {
    // 1. Zainicjuj krytyczne menedżery
    await registry.initializeAll();
    isInitialized = true;

    // 2. Ustaw handlery dla chrome API
    chrome.runtime.onInstalled.addListener(handleInstalled);
    chrome.runtime.onStartup.addListener(handleStartup);
    chrome.alarms.onAlarm.addListener(handleAlarm);
    
    // 3. Powiadom popup o gotowości
    chrome.runtime.sendMessage({ type: 'BACKGROUND_READY' });
  } catch (error) {
    console.error('Failed to initialize background:', error);
    // Spróbuj ponownie za 5 sekund
    setTimeout(initializeBackground, 5000);
  }
}

// Wystartuj inicjalizację
initializeBackground();

// Obsługa komunikacji z popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isInitialized) {
    sendResponse({ error: 'Background not initialized' });
    return;
  }
  
  // Obsługa wiadomości
  handleMessage(message, sender).then(sendResponse);
  return true; // async response
});
```

### popup.js
```javascript
import { registry } from './managers';

let isInitialized = false;

async function initializePopup() {
  if (isInitialized) return;
  
  try {
    // 1. Sprawdź czy background jest gotowy
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_BACKGROUND' });
    if (response.error) {
      throw new Error(response.error);
    }
    
    // 2. Zainicjuj menedżery
    await registry.initializeAll();
    isInitialized = true;
    
    // 3. Zainicjuj UI
    initializeUI();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showError('Failed to initialize. Please try again.');
  }
}

// Inicjalizacja przy otwarciu
document.addEventListener('DOMContentLoaded', initializePopup);

// Obsługa zamknięcia
window.addEventListener('unload', () => {
  if (isInitialized) {
    registry.reset();
  }
});
```

## 7. Aktualizacja testów

```javascript
// __tests__/managers/registry.test.js
import { ManagerRegistry } from '../../services/core/ManagerRegistry';
import { BaseManager } from '../../services/core/BaseManager';

describe('ManagerRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ManagerRegistry();
  });

  afterEach(() => {
    registry.reset();
  });

  it('should register and initialize managers in correct order', async () => {
    const initOrder = [];
    
    class TestManager extends BaseManager {
      constructor(registry, name) {
        super(registry);
        this.name = name;
      }
      
      async _initialize() {
        initOrder.push(this.name);
      }
    }

    // Rejestruj menedżery
    registry.register('error', class extends TestManager {
      constructor(registry) { super(registry, 'error'); }
    });
    registry.register('log', class extends TestManager {
      constructor(registry) { super(registry, 'log'); }
    });
    
    await registry.initializeAll();
    
    expect(initOrder).toEqual(['error', 'log']);
  });

  it('should handle circular dependencies', async () => {
    class Manager1 extends BaseManager {
      async _initialize() {
        this.addDependency('manager2');
      }
    }
    
    class Manager2 extends BaseManager {
      async _initialize() {
        this.addDependency('manager1');
      }
    }

    registry.register('manager1', Manager1);
    registry.register('manager2', Manager2);
    
    await expect(registry.initializeAll()).rejects.toThrow('Circular dependency');
  });
});

// __tests__/managers/baseManager.test.js
describe('BaseManager', () => {
  let registry;
  let manager;

  beforeEach(() => {
    registry = new ManagerRegistry();
    manager = new BaseManager(registry);
  });

  it('should track initialization state', async () => {
    expect(manager.isInitialized()).toBe(false);
    await manager.initialize();
    expect(manager.isInitialized()).toBe(true);
  });

  it('should handle initialization errors', async () => {
    class ErrorManager extends BaseManager {
      async _initialize() {
        throw new Error('Test error');
      }
    }

    const errorManager = new ErrorManager(registry);
    await expect(errorManager.initialize()).rejects.toThrow('Test error');
    expect(errorManager.isInitialized()).toBe(false);
    expect(errorManager.getLastError()).toBeInstanceOf(Error);
  });
});
```

## 8. Kolejność wykonania

1. Utworzenie i testy ManagerRegistry i BaseManager
2. Migracja ErrorHandler
   - Usunięcie starego singletona
   - Implementacja nowej wersji
   - Testy jednostkowe
   - Testy integracyjne z chrome API

3. Migracja LogManager
   - Usunięcie starego singletona
   - Implementacja nowej wersji
   - Testy jednostkowe
   - Testy integracyjne z ErrorHandler

4. Aktualizacja managers.js
   - Rejestracja krytycznych menedżerów
   - Testy inicjalizacji

5. Migracja pozostałych krytycznych menedżerów w kolejności:
   - StoreManager
   - EventManager
   - APIManager
   - DataManager
   - StatusManager
   - InitializationManager

6. Aktualizacja entry points
   - background.js
   - popup.js
   - Testy integracyjne

7. Migracja pozostałych menedżerów
   - Według listy z sekcji 3
   - Testy dla każdego

## 9. Potencjalne problemy i rozwiązania

1. Circular dependencies
   - Wykrywanie w czasie inicjalizacji
   - Lazy loading zależności
   - Użycie eventów zamiast bezpośrednich zależności

2. Race conditions
   - Kolejkowanie operacji
   - Sprawdzanie stanu inicjalizacji
   - Retry logic dla failed operations

3. Niezainicjalizowane menedżery
   - Explicit dependencies
   - Kolejność inicjalizacji
   - Fallback behavior

4. Błędy inicjalizacji
   - Error handling
   - Recovery logic
   - Logging

## 10. Troubleshooting

1. Logi inicjalizacji
   ```javascript
   // Dodaj do ManagerRegistry:
   #logInitialization(name, status, error = null) {
     const entry = {
       timestamp: Date.now(),
       manager: name,
       status,
       error: error?.message
     };
     
     this.getManager('log')
       .then(logManager => logManager.debug('initialization', entry))
       .catch(() => console.log('Initialization:', entry));
   }
   ```

2. Stack traces
   ```javascript
   // Dodaj do BaseManager:
   #captureStack() {
     this.#initStack = new Error().stack;
   }
   
   getDebugInfo() {
     return {
       initialized: this.#initialized,
       error: this.#initError,
       stack: this.#initStack,
       dependencies: Array.from(this.#dependencies)
     };
   }
   ```

3. Status inicjalizacji
   ```javascript
   // Dodaj do ManagerRegistry:
   getStatus() {
     return {
       initialized: Array.from(this.#managers.entries())
         .filter(([_, m]) => m.isInitialized())
         .map(([name]) => name),
       pending: this.#initQueue,
       failed: Array.from(this.#managers.entries())
         .filter(([_, m]) => m.getLastError())
         .map(([name, m]) => ({
           name,
           error: m.getLastError().message
         }))
     };
   }
   ```

4. Kolejność inicjalizacji
   ```javascript
   // Dodaj do ManagerRegistry:
   #initOrder = [];
   
   logInitOrder(name) {
     this.#initOrder.push({
       name,
       timestamp: Date.now()
     });
   }
   
   getInitializationOrder() {
     return this.#initOrder;
   }
   ```

## 11. Definition of Done

- [ ] ManagerRegistry działa
  - [ ] Rejestracja menedżerów
  - [ ] Inicjalizacja w poprawnej kolejności
  - [ ] Obsługa błędów
  - [ ] Logging

- [ ] BaseManager działa
  - [ ] Zarządzanie stanem
  - [ ] Obsługa zależności
  - [ ] Error handling
  - [ ] Debug info

- [ ] Krytyczne menedżery zmigrowane
  - [ ] ErrorHandler
  - [ ] LogManager
  - [ ] StoreManager
  - [ ] EventManager
  - [ ] APIManager
  - [ ] DataManager
  - [ ] StatusManager
  - [ ] InitializationManager

- [ ] Entry points zaktualizowane
  - [ ] background.js
  - [ ] popup.js
  - [ ] Obsługa chrome API
  - [ ] Error handling

- [ ] Testy przechodzą
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Chrome API mocks
  - [ ] Error scenarios

- [ ] Brak circular dependencies
  - [ ] Dependency validation
  - [ ] Lazy loading
  - [ ] Event-based communication

- [ ] Stabilna inicjalizacja
  - [ ] Kolejność zachowana
  - [ ] Error recovery
  - [ ] State management
  - [ ] Context synchronization

- [ ] Brak memory leaks
  - [ ] Proper cleanup
  - [ ] Resource management
  - [ ] Event listener cleanup
  - [ ] Chrome API cleanup 