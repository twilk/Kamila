# Plan optymalizacji inicjalizacji

## 1. Analiza obecnego stanu
### 1.1. Zidentyfikowane problemy:
- ✅ Nieoptymalna kolejność inicjalizacji
- ✅ Zduplikowane funkcje inicjalizujące
- Nieużywane inicjalizacje
- ✅ Brak spójnego systemu inicjalizacji
- ✅ Nieprawidłowe zależności między komponentami

### 1.2. Funkcje do refaktoryzacji:
✅ Poprawnie użyte:
- initializeManagers()
- initializeUIComponents()
- initializeTooltips()
- initializeDebugPanel()
- initializeDebugSwitch()
- initializeUpdateButton()
- initializeStoreSelect()
- initializeTabs()
- initializeLanguageSwitcher()
- initializeThemeSwitcher()
- initializeStatusButtons()
- initializeLeadStatusLinks()
- initializeStatusElements()

❌ Do naprawy:
- initializeMenu() - brak wywołania
- initializeVolumeControl() - do usunięcia
- initializeTestProgress() - brak integracji
- initializeUserSelector() - duplikacja

## 2. Plan refaktoryzacji

### 2.1. Nowa struktura inicjalizacji:
✅ Zaimplementowane:
```typescript
interface IInitializable {
    initialize(): Promise<boolean>;
    dispose(): Promise<boolean>;
    isInitialized(): boolean;
    getDependencies(): Array<string>;
}

class BaseManager implements IInitializable {
    protected initialized: boolean = false;
    protected dependencies: Array<IInitializable>;
    
    async initialize(): Promise<boolean>;
    async dispose(): Promise<boolean>;
    protected async doInitialize(): Promise<void>;
    protected async doDispose(): Promise<void>;
}
```

### 2.2. Kolejność inicjalizacji:
✅ Zdefiniowana:
1. Core Services:
   - i18n
   - Storage
   - API
   - EventBus

2. Base Managers:
   - ProgressManager
   - LoadingManager
   - ErrorManager
   - DebugManager

3. UI Managers:
   - UIManager
   - InterfaceManager
   - MenuManager
   - ThemeManager

4. Feature Managers:
   - UserManager
   - DataManager
   - StatusManager
   - UpdateManager

## 3. Zadania do wykonania [w kolejności]:

### 3.1. Przygotowanie [DZIEŃ 1-2]
- ✅ Utworzenie interfejsów i klas bazowych
- ✅ Implementacja systemu zależności
- [ ] Dodanie logowania inicjalizacji
- [ ] Przygotowanie testów

### 3.2. Refaktoryzacja [DZIEŃ 3-5]
- [ ] Core Services
  - ✅ Implementacja IInitializable
  - ✅ Dodanie dispose
  - [ ] Obsługa błędów
  - [ ] Logowanie stanu

- [ ] Base Managers
  - ✅ Migracja do nowej struktury
  - ✅ Implementacja zależności
  - [ ] Dodanie walidacji
  - [ ] Testy jednostkowe

- [ ] UI Managers
  - [ ] Uporządkowanie kolejności
  - [ ] Usunięcie duplikatów
  - [ ] Optymalizacja wydajności
  - [ ] Testy integracyjne

### 3.3. Optymalizacja [DZIEŃ 6-7]
- [ ] System metryk
  - [ ] Czas inicjalizacji
  - [ ] Zużycie pamięci
  - [ ] Kolejność operacji
  - [ ] Błędy inicjalizacji

### 3.4. Integracja [DZIEŃ 8-10]
- [ ] Migracja istniejącego kodu
- [ ] Testy end-to-end
- [ ] Dokumentacja
- [ ] Code review

# Plan optymalizacji systemu cache'owania

## 1. Analiza obecnego stanu
### 1.1. Zidentyfikowane systemy cache:
- CacheManager (services/cacheManager.js)
- Cache (services/cache.js)
- Storage (services/storage.js)
- Lokalne cache przeglądarki
- Cache API responses

### 1.2. Problemy do rozwiązania:
- Duplikacja funkcjonalności
- Brak hierarchii cache'owania
- Nieoptymalny czas życia danych
- Brak strategii invalidacji
- Nieefektywne wykorzystanie pamięci

## 2. Plan refaktoryzacji

### 2.1. Nowa struktura cache'owania:
```typescript
interface ICacheProvider {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
    clear(pattern?: string): Promise<void>;
    has(key: string): Promise<boolean>;
}

interface CacheOptions {
    ttl?: number;          // Czas życia w ms
    priority?: number;     // Priorytet (1-5)
    persistent?: boolean;  // Czy ma przetrwać restart
    compression?: boolean; // Czy kompresować dane
}

class CacheManager implements ICacheProvider {
    private memoryCache: Map<string, CacheEntry>;
    private storageCache: Storage;
    private browserCache: Cache;
    
    // Implementacja metod...
}
```

### 2.2. Hierarchia cache'owania:
1. Memory Cache (najszybszy, krótki TTL)
   - Dane często używane
   - Małe objętości danych
   - Automatyczne czyszczenie

2. Storage Cache (średni, persystentny)
   - Dane konfiguracyjne
   - Ustawienia użytkownika
   - Dane wymagające przetrwania restartu

3. Browser Cache (długi TTL)
   - Odpowiedzi API
   - Zasoby statyczne
   - Duże objętości danych

## 3. Zadania do wykonania [w kolejności]:

### 3.1. Przygotowanie [TYDZIEŃ 1]
- [ ] Utworzenie nowego CacheManager
- [ ] Implementacja podstawowych interfejsów
- [ ] Dodanie systemu logowania operacji cache
- [ ] Konfiguracja TTL dla różnych typów danych

### 3.2. Implementacja [TYDZIEŃ 2]
- [ ] Memory Cache
  - [ ] Implementacja Map z TTL
  - [ ] System priorytetów
  - [ ] Automatyczne czyszczenie
  - [ ] Kompresja danych

- [ ] Storage Cache
  - [ ] Integracja z chrome.storage
  - [ ] Obsługa limitów pamięci
  - [ ] Mechanizm synchronizacji
  - [ ] Backup krytycznych danych

- [ ] Browser Cache
  - [ ] Integracja z Cache API
  - [ ] Strategie cache'owania
  - [ ] Obsługa wersjonowania
  - [ ] Garbage collection

### 3.3. Optymalizacja [TYDZIEŃ 3]
- [ ] System metryk i monitoringu
  - [ ] Czas dostępu
  - [ ] Współczynnik trafień
  - [ ] Wykorzystanie pamięci
  - [ ] Częstotliwość czyszczenia

- [ ] Strategie invalidacji
  - [ ] Time-based
  - [ ] Version-based
  - [ ] Event-based
  - [ ] Manual

### 3.4. Integracja [TYDZIEŃ 4]
- [ ] Migracja istniejących systemów
- [ ] Testy wydajnościowe
- [ ] Dokumentacja
- [ ] Code review

## 4. Priorytety cache'owania:

### 4.1. Wysoki priorytet (Memory Cache)
- Aktywny sklep
- Status użytkownika
- Liczniki
- Bieżące filtry

### 4.2. Średni priorytet (Storage Cache)
- Ustawienia użytkownika
- Konfiguracja aplikacji
- Historia operacji
- Ostatnie wyniki

### 4.3. Niski priorytet (Browser Cache)
- Historyczne dane
- Rzadko używane zasoby
- Backup danych
- Logi debugowania

## 5. Metryki sukcesu:
- Redukcja czasu ładowania o 50%
- Zmniejszenie użycia pamięci o 30%
- Zwiększenie hit ratio do 85%
- Zmniejszenie liczby zapytań API o 40%

# TODO: Refaktoryzacja serwisów

## Lista serwisów do sprawdzenia i uporządkowania:

1. [✓] MenuManager - Zarządzanie menu i tooltipami
   - Zaimplementowany w `services/menuManager.js`
   - Funkcjonalność przeniesiona z `popup.js`

2. [✓] VolumeManager - Kontrola głośności
   - Zaimplementowany w `services/volumeManager.js`
   - Przeniesiono funkcjonalność z `initializeVolumeControl()`
   - Dodano obsługę zapisywania ustawień
   - Dodano czyszczenie zasobów

3. [✓] StatusManager - Zarządzanie statusami
   - Istnieje w `services/statusManager.js`
   - Sprawdzić i przenieść pozostałe funkcje związane ze statusami z `popup.js`

4. [ ] ErrorHandler - Obsługa błędów
   - Do utworzenia nowy serwis
   - Przenieść funkcje obsługi błędów

5. [✓] LoadingManager - Zarządzanie stanem ładowania
   - Zaimplementowany w `services/loadingManager.js`
   - Przeniesiono funkcje `showLoader()` i `hideLoader()`
   - Dodano zarządzanie wieloma loaderami
   - Dodano obsługę tekstu i rozmiarów
   - Dodano czyszczenie zasobów

6. [ ] MessageHandler - Obsługa komunikatów
   - Do utworzenia nowy serwis
   - Przenieść obsługę chrome.runtime.onMessage

7. [ ] IntervalManager - Zarządzanie interwałami
   - Do utworzenia nowy serwis
   - Przenieść funkcje związane z interwałami

8. [✓] UIManager - Zarządzanie interfejsem
   - Istnieje w `services/uiManager.js`
   - Sprawdzić i przenieść pozostałe funkcje UI z `popup.js`

9. [✓] DataManager - Zarządzanie danymi
   - Istnieje w `services/dataManager.js`
   - Sprawdzić i przenieść pozostałe funkcje związane z danymi

10. [✓] UserManager - Zarządzanie użytkownikami
    - Istnieje w `services/userManager.js`
    - Sprawdzić i przenieść pozostałe funkcje związane z użytkownikami

11. [✓] InterfaceManager - Zarządzanie interfejsem
    - Istnieje w `services/interfaceManager.js`
    - Sprawdzić i przenieść pozostałe funkcje związane z interfejsem

12. [✓] DebugManager - Zarządzanie debugowaniem
    - Istnieje w `services/debugManager.js`
    - Sprawdzić i przenieść pozostałe funkcje związane z debugowaniem

13. [✓] ProgressManager - Zarządzanie postępem
    - Istnieje w `services/progressManager.js`
    - Sprawdzić wykorzystanie w `popup.js`

14. [✓] UpdateManager - Zarządzanie aktualizacjami
    - Istnieje w `services/updateManager.js`
    - Sprawdzić i przenieść pozostałe funkcje związane z aktualizacjami

## Plan działania:
1. [✓] Sprawdzić każdy serwis czy już istnieje
2. [ ] Przeanalizować istniejące implementacje i ich zawartość
3. [ ] Utworzyć brakujące serwisy:
   - [✓] VolumeManager
   - [ ] ErrorHandler
   - [✓] LoadingManager
   - [ ] MessageHandler
   - [ ] IntervalManager
4. [ ] Przenieść odpowiednie funkcje z popup.js do istniejących serwisów
5. [ ] Zaktualizować importy i użycia w popup.js

## Kolejność implementacji:
1. [✓] VolumeManager (najprostszy do wydzielenia)
2. [✓] LoadingManager (często używany)
3. [ ] ErrorHandler (krytyczny dla działania)
4. [ ] MessageHandler (wymaga koordynacji z innymi serwisami)
5. [ ] IntervalManager (wymaga testów)

# Analiza i implementacja menu z tłumaczeniami

## 1. Analiza systemu i18n

### ✅ Zmodyfikowana implementacja
```javascript
// services/i18n.js - ZROBIONE
updateDataI18n() {
    // Najpierw menu - zapobiega migotaniu
    document.querySelectorAll('.link-title').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            const translation = this.translate(key);
            if (translation) {
                const textElement = element.querySelector('.menu-text');
                if (textElement) {
                    textElement.textContent = translation;
                }
            }
        }
    });

    // Pozostałe elementy
    document.querySelectorAll('[data-i18n]:not(.link-title)').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = this.translate(key);
        if (translation) {
            element.textContent = translation;
        }
    });
}
```

## 2. Następne kroki implementacji

### 2.1. Aktualizacja HTML
```html
<!-- TODO: Zaktualizować strukturę menu -->
<div class="menu">
    <a class="link active" data-target="#chat" role="tab">
        <span class="link-icon">
            <i class="bi bi-chat-heart"></i>
        </span>
        <div class="link-title">
            <span class="menu-text" data-i18n="chat">Chat</span>
        </div>
    </a>
</div>
```

### 2.2. Style CSS do dodania
```css
/* TODO: Dodać style */
.menu-text {
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
    transition: opacity 0.2s ease-in;
}

.link-title {
    position: absolute;
    width: 85px;
    left: 45px;
    display: flex;
    align-items: center;
    height: 100%;
}
```

## 3. Lista zadań

### 3.1. System i18n [✅]
- [x] Modyfikacja metody updateDataI18n
- [x] Dodanie obsługi menu-text
- [x] Separacja menu od innych elementów
- [x] Optymalizacja kolejności aktualizacji

### 3.2. HTML [NASTĘPNE]
- [ ] Aktualizacja struktury menu w popup.html:
  ```html
  <div class="menu">
      <!-- Zaktualizować każdy element menu -->
  </div>
  ```
- [ ] Dodanie klas menu-text
- [ ] Przeniesienie data-i18n na właściwe elementy
- [ ] Weryfikacja tooltipów

### 3.3. CSS [PÓŹNIEJ]
- [ ] Dodanie nowych styli dla menu-text
- [ ] Optymalizacja animacji
- [ ] Dostosowanie szerokości i odstępów
- [ ] Style dla dark mode

### 3.4. Testy
- [ ] Test zmiany języka:
  ```javascript
  // TODO: Dodać test
  it('should update menu text without breaking icons', () => {
      // ...
  });
  ```
- [ ] Test zachowania ikon
- [ ] Test animacji
- [ ] Test tooltipów

## 4. Znane problemy do rozwiązania
1. [ ] Opóźnienie ładowania ikon Bootstrap
2. [ ] Kolejność inicjalizacji i18n vs DOM
3. [ ] Zachowanie tooltipów przy zmianie języka
4. [ ] Wydajność selektorów CSS

## 5. Optymalizacje
1. [ ] Cachowanie selektorów DOM
2. [ ] Lazy loading tłumaczeń
3. [ ] Redukcja reflow/repaint
4. [ ] Batch updates dla DOM

## 6. Następne kroki (w kolejności)
1. [ ] Aktualizacja popup.html
2. [ ] Dodanie nowych styli CSS
3. [ ] Testy jednostkowe
4. [ ] Code review
5. [ ] Dokumentacja zmian

## 7. Pytania do rozwiązania
1. Czy potrzebujemy osobną obsługę dla tooltipów menu?
2. Jak obsłużyć dynamiczne zmiany języka?
3. Czy warto dodać transition dla tekstu?
4. Jak zoptymalizować kolejność ładowania?

## 8. Metryki do sprawdzenia
- [ ] Czas pierwszego renderowania
- [ ] Czas zmiany języka
- [ ] Płynność animacji
- [ ] Zużycie pamięci

## 9. Dokumentacja
- [ ] Aktualizacja README
- [ ] JSDoc dla nowych metod
- [ ] Przykłady użycia
- [ ] Changelog