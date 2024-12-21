# KAMILA Functions Documentation

## Core Services

### API Service (services/api.js)
Zarządza komunikacją z API Darwina.

#### Core Methods:
- `request(endpoint, options)`: Wykonuje zapytanie do API
  - Input: endpoint (string), options (RequestOptions)
  - Output: Promise<Response>
  - Purpose: Ustandaryzowane zapytania do API z obsługą błędów i cachowania

- `backgroundRequest(options)`: Zapytania wykonywane w tle
  - Input: RequestOptions
  - Output: Promise<Response>
  - Purpose: Długotrwałe operacje bez blokowania UI

#### Helper Methods:
- `handleError(error)`: Standardowa obsługa błędów API
- `validateResponse(response)`: Walidacja odpowiedzi
- `cacheResponse(key, data)`: Cachowanie odpowiedzi

### Cache Service (services/cache.js)
Zarządza cachowaniem danych.

#### Methods:
- `set(key, data, timeout = 300000)`: Zapisuje dane w cache
  - Input: klucz (string), dane (any), timeout (number) w ms
  - Purpose: Optymalizacja wydajności przez cachowanie

- `get(key)`: Pobiera dane z cache
  - Input: klucz (string)
  - Output: Promise<cached data | null>
  - Purpose: Szybki dostęp do danych bez odpytywania API

- `invalidate(key)`: Usuwa dane z cache
  - Purpose: Wymuszenie odświeżenia danych

### I18n Service (services/i18n.js)
Zarządza internacjonalizacją.

#### Methods:
- `translate(key, params)`: Tłumaczy tekst
  - Input: klucz (string), parametry (object)
  - Output: przetłumaczony tekst (string)

- `setLanguage(lang)`: Zmienia język
  - Input: kod języka (string)
  - Purpose: Dynamiczna zmiana języka interfejsu

## UI Components

### Theme Panel (components/theme-panel.js)
Panel edycji motywu własnego.

#### Methods:
- `show()`: Pokazuje panel
  - Purpose: Wyświetlenie interfejsu edycji motywu
  - Side effects: Dodaje overlay, ustawia focus trap

- `hide()`: Ukrywa panel
  - Purpose: Zamknięcie interfejsu edycji
  - Side effects: Usuwa overlay, przywraca fokus

- `handleColorChange(color, type)`: Obsługuje zmianę koloru
  - Input: wartość koloru (string), typ (primary/secondary)
  - Purpose: Podgląd zmian w czasie rzeczywistym

### Debug Panel (components/debug-panel.js)
Panel debugowania aplikacji.

#### Methods:
- `logMessage(message, type)`: Dodaje log
  - Input: treść (string), typ (info/warning/error)
  - Purpose: Wyświetlanie informacji debugowych

- `clearLogs()`: Czyści logi
- `exportLogs()`: Eksportuje logi do pliku

## Background Services

### Background Worker (background.js)
Service worker aplikacji.

#### Core Functions:
- `handleInstall()`: Obsługa instalacji rozszerzenia
- `handleUpdate()`: Obsługa aktualizacji
- `setupAlarms()`: Konfiguracja okresowych zadań

#### Message Handlers:
- `handleAPIRequest(message)`: Obsługa zapytań API
- `handleCacheRequest(message)`: Obsługa cache
- `handleStateSync(message)`: Synchronizacja stanu

## Utility Functions

### Performance Utilities (utils/performance.js)
Narzędzia do optymalizacji wydajności.

#### Functions:
- `debounce(fn, delay)`: Ogranicza częstotliwość wywołań
- `throttle(fn, limit)`: Limituje wywołania w czasie
- `measureAsync(fn, name)`: Mierzy czas async operacji

### DOM Utilities (utils/dom.js)
Narzędzia do manipulacji DOM.

#### Functions:
- `createElement(tag, props)`: Tworzy element DOM
- `appendChildren(parent, children)`: Dodaje elementy
- `removeElement(element)`: Usuwa element

## Event System

### Event Bus (services/event-bus.js)
System komunikacji między komponentami.

#### Methods:
- `emit(event, data)`: Wysyła event
- `on(event, callback)`: Subskrybuje event
- `off(event, callback)`: Usuwa subskrypcję

## Error Handling

### Error Handler (services/error-handler.js)
Centralna obsługa błędów.

#### Methods:
- `handleError(error, context)`: Obsługuje błąd
- `logError(error)`: Zapisuje błąd
- `showErrorNotification(error)`: Pokazuje powiadomienie

## Performance Monitoring

### PerformanceMonitor (services/performance.js)
Core class for monitoring application performance metrics.

#### Methods:
- `startMeasure(name)`: Rozpoczyna pomiar wydajności dla danej operacji
  - Input: nazwa operacji (string)
  - Output: boolean (success/failure)
  - Purpose: Śledzenie czasu wykonania operacji

- `endMeasure(name)`: Kończy pomiar i zapisuje wyniki
  - Input: nazwa operacji (string)
  - Output: duration (number) w milisekundach
  - Purpose: Obliczanie czasu trwania operacji

- `checkThresholds(metricName, value)`: Sprawdza czy metryki nie przekraczają progów
  - Input: nazwa metryki (string), wartość (number)
  - Purpose: Monitorowanie przekroczeń limitów wydajności

### Performance Handler (background/performance-handler.js)
Background service for managing performance data.

#### Methods:
- `handleMetric(metric)`: Przetwarza otrzymane metryki wydajności
- `handleViolation(violation)`: Obsługuje przekroczenia progów
- `sendAlert(metric, violations)`: Wysyła powiadomienia o problemach
- `generateSummary()`: Tworzy raport wydajności

## Theme Management

### ThemeManager (services/theme.manager.js)
Singleton zarządzający motywami aplikacji.

#### Core Methods:
- `toggleTheme(theme, shouldSync)`: Przełącza motyw aplikacji
  - Input: nazwa motywu (string), czy synchronizować (boolean)
  - Purpose: Zmiana motywu i aktualizacja UI

- `updateCustomColors(colors)`: Aktualizuje kolory motywu własnego
  - Input: obiekt z kolorami {primary, secondary}
  - Purpose: Dostosowanie kolorów w motywie własnym

- `applyThemeColors(themeName)`: Aplikuje predefiniowane kolory motywu
  - Input: nazwa motywu (string)
  - Purpose: Ustawienie kolorów dla motywów systemowych

#### Helper Methods:
- `getInitialTheme()`: Pobiera zapisany motyw
- `getInitialColors()`: Pobiera zapisane kolory własne
- `syncWithServer()`: Synchronizuje ustawienia z serwerem

## Accessibility Service

### AccessibilityService (services/accessibility.js)
Zarządza funkcjami dostępności aplikacji.

#### Methods:
- `announce(message)`: Ogłasza komunikaty dla czytników ekranu
- `createFocusTrap(container)`: Tworzy pułapkę fokusa dla modali
- `checkColorContrast(color1, color2)`: Sprawdza kontrast kolorów
- `checkReducedMotion()`: Sprawdza preferencje redukcji ruchu

## Debug Panel

### PerformancePanel (components/performance-panel.js)
Panel monitorowania wydajności w trybie debug.

#### Methods:
- `init()`: Inicjalizuje panel debugowania
- `updateMetrics()`: Aktualizuje wyświetlane metryki
- `renderViolations()`: Wyświetla przekroczenia progów
- `exportReport()`: Eksportuje raport wydajności

## Testing Functions (tests/e2e/performance.test.js)

### Performance Tests
Testy wydajności aplikacji.

#### Test Suites:
- Initial Load Performance: Testy czasu ładowania
- Theme System Performance: Testy wydajności motywów
- API Performance: Testy wydajności API
- Memory Management: Testy zarządzania pamięcią
- UI Responsiveness: Testy responsywności UI

## Integration Points

### Key Integration Functions:
- `sendLogToPopup(message, type, data)`: Wysyła logi do interfejsu
- `handleUserData(userData)`: Przetwarza dane użytkownika
- `fetchDarwinaData(config)`: Pobiera dane z API
- `processOrders(orders)`: Przetwarza dane zamówień

### Event Handlers:
- Theme change handlers
- Language switch handlers
- Debug mode toggles
- Performance violation handlers

## Environment Configuration
- DEBUG: Tryb debugowania
- NODE_ENV: Środowisko (development/production)
- API endpoints and credentials

## Performance Thresholds
- Initial load: < 2000ms
- Theme switch: < 50ms
- API response: < 500ms
- Memory usage: < 100MB
- Frame rate: 60fps target 