# Analiza i Plan Naprawy Systemu Menu 🎯

## 1. Zidentyfikowane Problemy 🔍

### 1.1. Problem Podwójnej Inicjalizacji ⚠️
```javascript
// W popup.js - pierwsza inicjalizacja
setupEventListeners() {
    const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabElements.forEach(tab => {
        new bootstrap.Tab(tab);
    });
}

// W MenuManager.js - druga inicjalizacja
#initializeMenuItems() {
    const tabElements = document.querySelectorAll('.menu .link[data-bs-toggle="tab"]');
    tabElements.forEach(tab => {
        const tabInstance = new bootstrap.Tab(tab);
        this.#tabInstances.set(tab, tabInstance);
    });
}
```

### 1.2. Niespójne Selektory 🔀
```javascript
// Trzy różne selektory w kodzie:
'.nav-link'                           // W InterfaceManager.js
'.menu .link[data-bs-toggle="tab"]'  // W MenuManager.js
'[data-bs-toggle="tab"]'             // W popup.js
```

### 1.3. Niespójny System Zdarzeń 📡
```javascript
// Dwa różne systemy:
window.dispatchEvent(new CustomEvent('menu:tabChanged'));  // W MenuManager.js
eventManager.emit(EventType.TAB_CHANGED);                  // W InterfaceManager.js
```

### 1.4. Brak Persystencji Stanu 💾
- Nie zachowuje aktywnego tabu między sesjami
- Brak obsługi przywracania stanu po odświeżeniu
- Brak synchronizacji stanu między komponentami

## 2. Plan Naprawy 🛠️

### 2.1. Inicjalizacja [PRIORYTET: WYSOKI] ⚡
- [⏳] Usunąć duplikację inicjalizacji
  ```javascript
  // Zostawić tylko w MenuManager.js
  await MenuManager.getInstance().waitForReady();
  ```
- [⏳] Dodać proper error handling
- [⏳] Dodać retry logic dla Bootstrap loading

### 2.2. Selektory [PRIORYTET: ŚREDNI] 🎯
- [⏳] Ujednolicić selektory do jednego formatu
  ```javascript
  const TAB_SELECTOR = '.menu .link[data-bs-toggle="tab"]';
  const TAB_PANE_SELECTOR = '.tab-pane';
  ```
- [⏳] Dodać stałe dla wszystkich selektorów
- [⏳] Zaktualizować wszystkie komponenty

### 2.3. System Zdarzeń [PRIORYTET: WYSOKI] 📡
- [⏳] Ujednolicić do CustomEvent
  ```javascript
  const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready'
  };
  ```
- [⏳] Dodać most do eventManager
- [⏳] Zaktualizować wszystkie handlery

### 2.4. Persystencja Stanu [PRIORYTET: WYSOKI] 💾
- [⏳] Dodać zapisywanie stanu do chrome.storage.local
  ```javascript
  async function saveTabState(tabId) {
    await chrome.storage.local.set({ activeTab: tabId });
  }
  ```
- [⏳] Dodać przywracanie stanu przy starcie
- [⏳] Dodać obsługę błędów storage

### 2.5. Optymalizacja Wydajności [PRIORYTET: NISKI] ⚡
- [⏳] Dodać lazy loading dla zawartości tabów
- [⏳] Zoptymalizować event listeners
- [⏳] Dodać debouncing dla częstych zdarzeń

### 2.6. Dostępność [PRIORYTET: ŚREDNI] ♿
- [⏳] Dodać obsługę klawiatury
  ```javascript
  // Przykład implementacji
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextTab();
    if (e.key === 'ArrowLeft') previousTab();
  });
  ```
- [⏳] Dodać ARIA roles i labels
- [⏳] Poprawić focus management

## 3. Testy 🧪

### 3.1. Testy Funkcjonalne
- [⏳] Test inicjalizacji
- [⏳] Test przełączania tabów
- [⏳] Test persystencji stanu
- [⏳] Test obsługi błędów

### 3.2. Testy Wydajności
- [⏳] Test czasu inicjalizacji
- [⏳] Test memory leaks
- [⏳] Test event listeners

### 3.3. Testy Dostępności
- [⏳] Test nawigacji klawiaturą
- [⏳] Test ARIA atrybutów
- [⏳] Test focus management

## 4. Dokumentacja 📚

### 4.1. Aktualizacja API
```javascript
interface TabState {
  id: string;
  active: boolean;
  lastActive: number;
}

interface MenuManager {
  initialize(): Promise<void>;
  switchTab(tabId: string): Promise<void>;
  getCurrentTab(): TabState;
  dispose(): Promise<void>;
}
```

### 4.2. Przykłady Użycia
```javascript
// Inicjalizacja
await MenuManager.getInstance().initialize();

// Przełączanie tabu
await MenuManager.getInstance().switchTab('#settings');

// Pobieranie stanu
const currentTab = MenuManager.getInstance().getCurrentTab();
```

## 5. Monitorowanie 📊

### 5.1. Metryki
- Czas inicjalizacji
- Liczba przełączeń tabów
- Błędy przełączania
- Memory usage

### 5.2. Logi
- Inicjalizacja komponentów
- Zmiany stanu
- Błędy i wyjątki
- Performance issues

## 6. Następne Kroki 👣

1. [⏳] Usunąć duplikację inicjalizacji
2. [⏳] Ujednolicić selektory
3. [⏳] Zaimplementować persystencję stanu
4. [⏳] Dodać testy
5. [⏳] Zaktualizować dokumentację
``` 