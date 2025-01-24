# TODOloaders

## Priorytety
- P0: Krytyczne - blokujące funkcjonalność
- P1: Wysokie - wymagane do wydania
- P2: Średnie - ważne, ale nie blokujące
- P3: Niskie - nice to have

## 1. Truck Loader (loaderTruck) [P1]
- [ ] Implementacja nowej wersji ciężarówki z @uiverse.io/vinodjangid07/popular-owl-27
  - Wymiary: 200px × 100px
  - Animacja: 1s linear infinite
  - Responsywność: skalowanie przy różnych rozdzielczościach
- [ ] Aktualizacja animacji drogi i kół
  - Koła: rotacja 360° w 0.6s
  - Droga: przesuw w lewo, nieskończona pętla
- [ ] Poprawne skalowanie SVG
  - Zachowanie proporcji
  - Minimalna szerokość: 130px
- [ ] Dostosowanie kolorystyki do motywu
  - Light mode: #282828 (podstawowy), #F83D3D (czerwony), #DFDFDF (jasny)
  - Dark mode: #1a1a1a (podstawowy), #D63030 (czerwony), #2a2a2a (ciemny)

## 2. Progress Bar (loaderBar) [P0]
- [ ] Implementacja nowego paska postępu z @uiverse.io/alexruix/big-octopus-60
  - Szerokość: 80% kontenera
  - Wysokość: 8px
  - Zaokrąglenie: 4px
- [ ] Dodanie podziałki na ilość managerów
  - Dynamiczne generowanie punktów
  - Równe odstępy między punktami
  - Animacja wypełnienia przy przejściu
- [ ] Integracja z licznikiem czasu ładowania
  - Format: XX.XXms
  - Aktualizacja w czasie rzeczywistym
  - Precyzja: 2 miejsca po przecinku
- [ ] Animacja wypełniania paska
  - Płynne przejście: transition 0.3s ease
  - Kolor wypełnienia: #299fff
  - Kolor tła: #D1C2FF

## 3. Words Loader (loaderWords) [P1]
- [ ] Implementacja animowanego tekstu z @uiverse.io/Chriskoziol/bright-ladybug-86
  - Font: Poppins, sans-serif
  - Rozmiar: 25px
  - Wysokość: 40px
- [ ] Aktualizacja listy słów na polskie odpowiedniki
  - "Inicjalizacja"
  - "Konfiguracja"
  - "Połączenie"
  - "Synchronizacja"
- [ ] Poprawne ustawienie timingu animacji
  - Cykl: 5s infinite
  - Płynne przejścia między słowami
  - Brak przerw w animacji
- [ ] Dostosowanie czcionek i kolorów
  - Tekst: #4a4a4a (light), #ffffff (dark)
  - Akcent: #299fff

## 4. Style Management [P0]
- [ ] Przeniesienie wszystkich styli do loading.css
  - Organizacja sekcji
  - Komentarze dla każdej sekcji
  - Optymalizacja CSS
- [ ] Poprawne nazwanie klas dla każdego loadera:
  - [ ] .loaderTruck dla ciężarówki i jej komponentów
  - [ ] .loaderBar dla paska postępu i podziałki
  - [ ] .loaderWords dla animowanego tekstu
- [ ] Usunięcie duplikacji styli
  - Wspólne zmienne CSS
  - Reużywalne animacje
  - Współdzielone kolory
- [ ] Dodanie wsparcia dla dark mode
  - CSS variables dla kolorów
  - Media queries dla prefers-color-scheme
  - Płynne przejścia między trybami

## 5. Integration [P0]
- [ ] Aktualizacja manifest.json
  - Dodanie loading.css do web_accessible_resources
  - Konfiguracja content_scripts
  - Ustawienie permissions
- [ ] Poprawne ładowanie loading.css
  - Sprawdzenie kolejności ładowania
  - Obsługa błędów ładowania
  - Fallback styles
- [ ] Synchronizacja animacji między loaderami
  - Start animacji po załadowaniu
  - Zatrzymanie przy ukryciu
  - Płynne przejścia stanów
- [ ] Testowanie wydajności animacji
  - FPS > 30
  - CPU usage < 10%
  - Brak memory leaks

## 6. Testing [P1]
- [ ] Unit Tests
  - Testy komponentów
  - Testy animacji
  - Testy stanów
- [ ] Integration Tests
  - Współpraca loaderów
  - Przejścia stanów
  - Obsługa błędów
- [ ] Performance Tests
  - Pomiary FPS
  - Memory usage
  - CPU usage
- [ ] Cross-browser Tests
  - Chrome (min. ver. 88)
  - Firefox (min. ver. 78)
  - Edge (min. ver. 88)

## 7. Accessibility [P2]
- [ ] ARIA labels
  - aria-label dla loaderów
  - aria-live dla statusów
  - role="progressbar" dla paska
- [ ] Reduced Motion
  - Obsługa prefers-reduced-motion
  - Alternatywne animacje
  - Statyczne stany
- [ ] Keyboard Navigation
  - Focusable elements
  - Proper tab order
  - Keyboard shortcuts

## 8. Documentation [P2]
- [ ] Aktualizacja komentarzy w kodzie
  - JSDoc dla klas i metod
  - Opis animacji i stanów
  - Przykłady użycia
- [ ] Opis implementacji w README
  - Architektura
  - Zależności
  - Konfiguracja
- [ ] Dokumentacja API
  - Metody publiczne
  - Eventy
  - Callbacks
- [ ] Przykłady użycia
  - Code snippets
  - Demo cases
  - Edge cases

## Implementation Status Report (2024-01-24)

### 1. Truck Loader (loaderTruck) [P1] - 80% Complete
✅ Podstawowa struktura zaimplementowana w loading.css
✅ Animacja drogi
✅ Responsywność i skalowanie
✅ Dark mode support
❌ Brak słupa oświetlenia w svg
❌ Brak animacji ciężarówki (1s linear infinite)
❌ Brak pełnej implementacji nowej wersji z @uiverse.io
❌ Brak rotacji kół 360° w 0.6s

### 2. Progress Bar (loaderBar) [P0] - 90% Complete
✅ Implementacja podstawowego paska postępu
✅ Integracja z licznikiem czasu
✅ Animacje wypełniania
✅ Kolory i przejścia
✅ Dark mode support
❌ Brak pełnej implementacji podziałki na managery

### 3. Words Loader (loaderWords) [P1] - 70% Complete
✅ Podstawowa struktura animacji
✅ Timing animacji (5s infinite)
✅ Płynne przejścia
❌ Brak połączenia słów z faktycznymi ładowanymi w danym momencie komponentami
❌ Brak polskich odpowiedników słów
❌ Niekompletne dostosowanie kolorów do motywów

### 4. Style Management [P0] - 85% Complete
✅ Wszystkie style w loading.css
✅ Organizacja sekcji z komentarzami
✅ Podstawowe wsparcie dla dark mode
✅ Poprawne nazewnictwo klas
❌ Częściowe duplikacje w stylach
❌ Niekompletne zmienne CSS

### 5. Integration [P0] - 75% Complete
✅ Podstawowa integracja w LoadingManager.js
✅ Synchronizacja animacji
✅ Obsługa stanów ładowania
❌ Brak pełnych testów wydajności
❌ Niekompletna konfiguracja w manifest.json

### 6. Testing [P1] - 20% Complete
✅ Podstawowa struktura testów
❌ Brak testów komponentów
❌ Brak testów wydajności
❌ Brak testów cross-browser

<!-- ### 7. Accessibility [P2] - 40% Complete -->
<!-- ✅ Podstawowe wsparcie dla reduced motion -->
<!-- ❌ Brak ARIA labels -->
<!-- ❌ Niekompletna obsługa klawiatury -->

### Priorytety do realizacji:
1. Dokończenie implementacji podziałki w Progress Bar [P0]
2. Aktualizacja manifest.json i integracja [P0]
3. Implementacja polskich tekstów w Words Loader [P1]
4. Optymalizacja animacji ciężarówki [P1]
5. Rozszerzenie testów [P1]

### Uwagi:
- Większość podstawowej funkcjonalności jest zaimplementowana
- Główne braki w testach i dostępności
- Potrzebna optymalizacja wydajności
- Konieczne dokończenie integracji z systemem motywów

## Plan Pracy (2024-01-24)

### Etap 1: Refaktoryzacja Loaderów [P0] (ETA: 2h)
1. Truck Loader
   - [ ] Rename klas zgodnie z konwencją (.loaderTruck)
   - [ ] Implementacja nowej animacji ciężarówki (1s linear)
   - [ ] Dodanie rotacji kół (360° w 0.6s)
   - [ ] Aktualizacja kolorów do motywów
   - [ ] Implementacja słupa oświetleniowego

2. Progress Bar
   - [ ] Rename klas (.loaderBar)
   - [ ] Implementacja podziałki managerów
   - [ ] Integracja z licznikiem czasu
   - [ ] Dostosowanie kolorów i animacji

3. Words Loader
   - [ ] Rename klas (.loaderWords)
   - [ ] Aktualizacja listy słów (PL)
   - [ ] Integracja z aktualnym stanem ładowania
   - [ ] Dostosowanie kolorów do motywów

### Etap 2: Integracja [P0] (ETA: 1.5h)
1. LoadingManager.js
   - [ ] Aktualizacja tworzenia elementów
   - [ ] Implementacja licznika managerów
   - [ ] Synchronizacja animacji
   - [ ] Obsługa stanów ładowania

2. Manifest & Resources
   - [ ] Dodanie loading.css do web_accessible_resources
   - [ ] Konfiguracja content_scripts
   - [ ] Ustawienie permissions
   - [ ] Fallback styles

### Etap 3: Optymalizacja [P1] (ETA: 1h)
1. Performance
   - [ ] Audyt animacji (FPS)
   - [ ] Optymalizacja CSS
   - [ ] Redukcja reflow/repaint
   - [ ] Memory usage monitoring

2. Accessibility
   - [ ] ARIA labels
   - [ ] Reduced motion
   - [ ] Keyboard support

### Etap 4: Testing [P1] (ETA: 2h)
1. Unit Tests
   - [ ] LoadingManager tests
   - [ ] Animation tests
   - [ ] State management tests

2. Integration Tests
   - [ ] Cross-browser testing
   - [ ] Performance metrics
   - [ ] Error scenarios

### Kolejność implementacji:

#### Dzień 1 (dziś):
1. ⏳ Refaktoryzacja loaderTruck (1h)
   - Implementacja nowej wersji z @loadersRequirements.md
   - Animacje i kolory
   - Dark mode support

2. ⏳ Progress Bar update (1h)
   - Podziałka managerów
   - Integracja z czasem
   - Animacje

3. ⏳ Words Loader (30min)
   - Polskie teksty
   - Integracja ze stanem

4. ⏳ Podstawowa integracja (30min)
   - LoadingManager.js update
   - Manifest.json

#### Dzień 2:
5. 📅 Testy (2h)
   - Unit tests
   - Integration tests
   - Performance tests

6. 📅 Optymalizacja (1h)
   - Performance
   - Accessibility
   - Cross-browser fixes

7. 📅 Dokumentacja (30min)
   - JSDoc
   - README update
   - API docs

### Rozpoczynam od:
1. Refaktoryzacja loaderTruck zgodnie z @loadersRequirements.md
2. Aktualizacja klas w loading.css
3. Implementacja nowych animacji

Czy mogę zacząć od tych zadań?