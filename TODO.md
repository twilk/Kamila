# Sprawdzenie i naprawa importów

TODO:
1. [🔄] Sprawdzenie importów w popup.js
2. [✅] Sprawdzenie importów w services/core/*
3. [✅] Sprawdzenie importów w services/index.js
4. [✅] Sprawdzenie importów w services/*.js (managery)
5. [ ] Sprawdzenie importów w tests/*

DETAILS:

1. Sprawdzenie importów w popup.js
   - ✅ Przeanalizować wszystkie importy
   - ✅ Sprawdzić czy pliki istnieją
   - ✅ Sprawdzić czy ścieżki są poprawne
   - ✅ Sprawdzić czy nie ma duplikatów
   - ⚠️ Znalezione problemy:
     1. Duplikaty importów managerów (z index.js i bezpośrednio)
     2. ErrorHandler importowany bezpośrednio z core zamiast przez index.js
   - 🔄 Do naprawy:
     1. Usunąć duplikaty importów
     2. Poprawić import ErrorHandler
   - ⏳ Sprawdzić czy wszystkie importowane elementy są używane

2. Sprawdzenie importów w services/core/*
   - ✅ Sprawdzić BaseManager.js
     - Poprawne importy: ErrorTypes.js, IInitializable.js, InitLogger.js, MetricsManager.js
   - ✅ Sprawdzić InitLogger.js
     - Brak importów - OK
   - ✅ Sprawdzić MetricsManager.js
     - Poprawny import: BaseManager.js
   - ✅ Sprawdzić ErrorHandler.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js
   - ✅ Sprawdzić ErrorTypes.js
     - Brak importów - OK
   - ✅ Sprawdzić UIManager.js
     - Poprawne importy: ErrorTypes.js, BaseManager.js
   - ✅ Wszystkie zależności są poprawne
   - ✅ Brak problemów z importami w core

3. Sprawdzenie importów w services/index.js
   - ✅ Sprawdzić eksporty core services
     - Wszystkie core moduły są eksportowane
   - ✅ Sprawdzić eksporty feature managers
     - Wszystkie managery są eksportowane
   - ✅ Sprawdzić eksporty services
     - Wszystkie serwisy są eksportowane
   - ✅ Sprawdzić ścieżki
     - Wszystkie ścieżki są poprawne
   - ✅ Brak brakujących eksportów
   - ✅ Brak nieużywanych eksportów
   - ✅ Brak problemów z importami w index.js

4. Sprawdzenie importów w services/*.js (managery)
   - ✅ Sprawdzić CacheManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js
   - ✅ Sprawdzić DataManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js, API_BASE_URL
   - ✅ Sprawdzić MenuManager.js
     - Poprawne importy: UIManager.js, i18n.js
   - ✅ Sprawdzić LoadingManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js
   - ✅ Sprawdzić ProgressManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js
   - ✅ Sprawdzić UpdateManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js, i18n.js
   - ✅ Sprawdzić InterfaceManager.js
     - Poprawne importy: UIManager.js, ErrorTypes.js, i18n.js, themeService
   - ✅ Sprawdzić StatusManager.js
     - Poprawne importy: BaseManager.js, ErrorTypes.js
   - ⚠️ Znalezione problemy:
     1. DataManager używa własnej implementacji cache zamiast CacheManager
     2. MenuManager powinien importować i18n przez index.js
     3. UpdateManager powinien importować i18n przez index.js
     4. InterfaceManager powinien importować i18n i themeService przez index.js
   - 🔄 Do naprawy:
     1. Zintegrować CacheManager z DataManager
     2. Poprawić importy i18n i themeService we wszystkich managerach

5. Sprawdzenie importów w tests/*
   - Sprawdzić czy ścieżki do testowanych modułów są poprawne
   - Sprawdzić czy wszystkie mocki są poprawnie zaimportowane
   - Sprawdzić czy importy testów integracyjnych są poprawne

# Plan rozwoju i optymalizacji

## 1. Systemy w trakcie implementacji

### 1.1. System obsługi błędów [PRIORYTET WYSOKI]
- [ ] Utworzenie ErrorHandler
  - [ ] Centralne zarządzanie błędami
  - [ ] Integracja z MetricsManager
  - [ ] System raportowania błędów
  - [ ] Strategie recovery

### 1.2. System komunikacji [PRIORYTET WYSOKI]
- [ ] Implementacja MessageHandler
  - [ ] Obsługa chrome.runtime.onMessage
  - [ ] Routing wiadomości
  - [ ] Kolejkowanie i retry
  - [ ] Monitoring wydajności

### 1.3. Zarządzanie interwałami [PRIORYTET ŚREDNI]
- [ ] Utworzenie IntervalManager
  - [ ] Centralne zarządzanie timerami
  - [ ] Optymalizacja zużycia zasobów
  - [ ] Synchronizacja z alarmami Chrome

## 2. Integracja systemów

### 2.1. Integracja CacheManager [PRIORYTET WYSOKI]
- [ ] Integracja z DataManager
  - [ ] Strategie cachowania
  - [ ] Invalidacja cache
  - [ ] Monitoring wydajności
- [ ] Integracja z UIManager
  - [ ] Cache komponentów UI
  - [ ] Optymalizacja renderowania
- [ ] Integracja z MessageHandler
  - [ ] Cache wiadomości
  - [ ] Synchronizacja stanu

### 2.2. Integracja ErrorHandler [PRIORYTET WYSOKI]
- [ ] Integracja z DataManager
- [ ] Integracja z UIManager
- [ ] Integracja z MessageHandler
- [ ] Integracja z CacheManager

## 3. Testy i monitoring

### 3.1. Testy integracyjne [PRIORYTET WYSOKI]
- [ ] Setup środowiska testowego
- [ ] Testy komunikacji między managerami
- [ ] Testy przepływu danych
- [ ] Testy obsługi błędów

### 3.2. Monitoring wydajności [PRIORYTET ŚREDNI]
- [ ] Implementacja metryk
  - [ ] Czas odpowiedzi
  - [ ] Zużycie pamięci
  - [ ] Cache hit ratio
  - [ ] Liczba błędów
- [ ] Dashboard monitoringu
- [ ] Alerty wydajnościowe

## 4. Optymalizacja

### 4.1. Optymalizacja pamięci [PRIORYTET WYSOKI]
- [ ] Analiza wykorzystania pamięci
- [ ] Implementacja strategii czyszczenia
- [ ] Monitoring zużycia
- [ ] Optymalizacja cache

### 4.2. Optymalizacja wydajności [PRIORYTET ŚREDNI]
- [ ] Profilowanie operacji
- [ ] Optymalizacja wąskich gardeł
- [ ] Redukcja liczby operacji DOM
- [ ] Optymalizacja komunikacji

## 5. Dokumentacja

### 5.1. Dokumentacja techniczna [PRIORYTET NISKI]
- [ ] Architektura systemu
- [ ] Przepływy danych
- [ ] API managerów
- [ ] Strategie obsługi błędów

### 5.2. Dokumentacja użytkowa [PRIORYTET NISKI]
- [ ] Instrukcje konfiguracji
- [ ] Przewodnik rozwiązywania problemów
- [ ] FAQ

## Kolejność implementacji:

1. ErrorHandler + testy
2. MessageHandler + testy
3. Integracja CacheManager
4. Integracja ErrorHandler
5. IntervalManager
6. Monitoring wydajności
7. Optymalizacja pamięci
8. Dokumentacja

## Metryki sukcesu:
- [ ] Zero nieobsłużonych błędów
- [ ] Cache hit ratio > 85%
- [ ] Czas odpowiedzi < 100ms
- [ ] Zużycie pamięci < 50MB
- [ ] Pokrycie testami > 80%

# Plan optymalizacji inicjalizacji

## 1. Analiza obecnego stanu
### 1.1. Zidentyfikowane problemy:
- ✅ Nieoptymalna kolejność inicjalizacji
- ✅ Zduplikowane funkcje inicjalizujące
- ✅ Nieużywane inicjalizacje
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

✅ Naprawione:
- initializeMenu() - zintegrowane z MenuManager
- initializeVolumeControl() - usunięte
- initializeTestProgress() - zintegrowane z ProgressManager
- initializeUserSelector() - zrefaktoryzowane

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
✅ Zdefiniowana i zaimplementowana:
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
- ✅ Dodanie logowania inicjalizacji
- ✅ Przygotowanie testów

### 3.2. Refaktoryzacja [DZIEŃ 3-5]
- ✅ Core Services
  - ✅ Implementacja IInitializable
  - ✅ Dodanie dispose
  - ✅ Obsługa błędów
  - ✅ Logowanie stanu

- ✅ Base Managers
  - ✅ Migracja do nowej struktury
  - ✅ Implementacja zależności
  - ✅ Dodanie walidacji
  - ✅ Testy jednostkowe

- ✅ UI Managers
  - ✅ Uporządkowanie kolejności
  - ✅ Usunięcie duplikatów
  - ✅ Optymalizacja wydajności
  - [ ] Testy integracyjne

### 3.3. Optymalizacja [DZIEŃ 6-7]
- ✅ System metryk
  - ✅ Czas inicjalizacji
  - ✅ Zużycie pamięci
  - ✅ Kolejność operacji
  - ✅ Błędy inicjalizacji

### 3.4. Integracja [DZIEŃ 8-10]
- [ ] Migracja istniejącego kodu
- [ ] Testy end-to-end
- [ ] Dokumentacja
- [ ] Code review

## 4. Następne kroki:
1. Przeprowadzenie testów integracyjnych
2. Migracja pozostałego kodu
3. Przygotowanie dokumentacji
4. Code review
5. Monitoring wydajności
6. Optymalizacja pamięci

# Plan optymalizacji systemu cache'owania

## 1. Analiza obecnego stanu
### 1.1. Zidentyfikowane systemy cache:
- ✅ CacheManager (services/cacheManager.js)
- ✅ Cache (services/cache.js)
- ✅ Storage (services/storage.js)
- ✅ Lokalne cache przeglądarki
- ✅ Cache API responses

### 1.2. Problemy do rozwiązania:
- ✅ Duplikacja funkcjonalności
- ✅ Brak hierarchii cache'owania
- ✅ Nieoptymalny czas życia danych
- ✅ Brak strategii invalidacji
- ✅ Nieefektywne wykorzystanie pamięci

## 2. Plan refaktoryzacji

### 2.1. Nowa struktura cache'owania:
✅ Zaimplementowane:
```javascript
class CacheManager extends BaseManager {
    // Hierarchical caching system
    // Memory and storage cache layers
    // Priority-based caching
    // Compression for large data
    // Automatic cleanup
}
```

### 2.2. Hierarchia cache'owania:
✅ Zaimplementowane:
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
- ✅ Utworzenie nowego CacheManager
- ✅ Implementacja podstawowych interfejsów
- ✅ Dodanie systemu logowania operacji cache
- ✅ Konfiguracja TTL dla różnych typów danych

### 3.2. Implementacja [TYDZIEŃ 2]
- ✅ Memory Cache
  - ✅ Implementacja Map z TTL
  - ✅ System priorytetów
  - ✅ Automatyczne czyszczenie
  - ✅ Kompresja danych

- ✅ Storage Cache
  - ✅ Integracja z chrome.storage
  - ✅ Obsługa limitów pamięci
  - ✅ Mechanizm synchronizacji
  - ✅ Backup krytycznych danych

- ✅ Browser Cache
  - ✅ Integracja z Cache API
  - ✅ Strategie cache'owania
  - ✅ Obsługa wersjonowania
  - ✅ Garbage collection

### 3.3. Optymalizacja [TYDZIEŃ 3]
- ✅ System metryk i monitoringu
  - ✅ Czas dostępu
  - ✅ Współczynnik trafień
  - ✅ Wykorzystanie pamięci
  - ✅ Częstotliwość czyszczenia

- ✅ Strategie invalidacji
  - ✅ Time-based
  - ✅ Version-based
  - ✅ Event-based
  - ✅ Manual

### 3.4. Integracja [TYDZIEŃ 4]
- [ ] Migracja istniejących systemów
- [ ] Testy wydajnościowe
- [ ] Dokumentacja
- [ ] Code review

## 4. Następne kroki:
1. [ ] Integracja z DataManager
2. [ ] Integracja z UIManager
3. [ ] Integracja z MenuManager
4. [ ] Integracja z LoadingManager
5. [ ] Testy end-to-end
6. [ ] Monitoring wydajności
7. [ ] Optymalizacja pamięci

## 5. Metryki sukcesu:
- [ ] Redukcja czasu ładowania o 50%
- [ ] Zmniejszenie użycia pamięci o 30%
- [ ] Zwiększenie hit ratio do 85%
- [ ] Zmniejszenie liczby zapytań API o 40%

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