# Kamila - Intelligent Assistant DARWINA.PL - Project Structure

## 1. Aktualny Stan Projektu

### 1.1 Zaimplementowane Komponenty
- [x] Podstawowy interfejs użytkownika (popup.html)
- [x] Style i motywy (style.css, theme.css)
- [x] Podstawowa komunikacja z API
- [x] System powiadomień Chrome
- [x] Obsługa wielu języków
- [x] Selektor sklepów

### 1.2 Komponenty w Trakcie Implementacji
- [ ] Pełna autoryzacja
- [ ] System cachowania
- [ ] Obsługa błędów
- [ ] Metryki wydajności

### 1.3 Planowane Komponenty
- [ ] System pluginów
- [ ] Zaawansowana diagnostyka
- [ ] Testy automatyczne
- [ ] CI/CD pipeline

## 2. Struktura Kodu

### 2.1 Główne Pliki
```
popup.html          - Główny interfejs użytkownika
popup.js           - Logika interfejsu
background.js      - Service worker i komunikacja z API
manifest.json      - Konfiguracja rozszerzenia
```

### 2.2 Style
```
style.css          - Podstawowe style
styles/theme.css   - Motywy i kolory
styles/hud.css     - Style dla HUD
styles/animations.css - Animacje
```

### 2.3 Serwisy (Aktualnie Zaimplementowane)
```javascript
UIComponentService:
- initialize()        // Inicjalizacja komponentów UI
- updateTables()      // Aktualizacja tabel z danymi
- showUIElements()    // Zarządzanie widocznością elementów

DarwinaService:
- getStores()        // Pobieranie listy sklepów
- checkAuthorization() // Sprawdzanie autoryzacji
- fetchData()        // Pobieranie danych z API

CacheService:
- get()             // Pobieranie z cache
- set()             // Zapisywanie do cache
- clear()           // Czyszczenie cache
```

## 3. Przepływ Danych (Stan Aktualny)

### 3.1 Inicjalizacja
1. Ładowanie popup.html
2. Inicjalizacja UIComponentService
3. Sprawdzenie autoryzacji
4. Ładowanie danych z cache lub API

### 3.2 Aktualizacja Danych
1. Kliknięcie przycisku odświeżania
2. Pobranie nowych danych z API
3. Aktualizacja UI
4. Zapisanie do cache

## 4. Known Issues

### 4.1 Błędy Krytyczne
- Problem z autoryzacją po wygaśnięciu tokena
- Niespójność danych przy braku połączenia
- Problemy z synchronizacją cache

### 4.2 Ograniczenia
- Brak obsługi wielu sesji
- Ograniczona obsługa błędów sieciowych
- Brak mechanizmu retry

## 5. Następne Kroki (Priorytetyzacja)

### 5.1 Krytyczne (Do Natychmiastowej Implementacji)
1. Naprawa autoryzacji
2. Implementacja obsługi błędów
3. Dokończenie systemu cache
4. Podstawowe testy

### 5.2 Ważne (Następna Iteracja)
1. Dokumentacja API
2. Rozszerzenie testów
3. Monitoring wydajności
4. Usprawnienie UX

### 5.3 Dodatkowe (Future Scope)
1. System pluginów
2. Zaawansowana diagnostyka
3. CI/CD pipeline
4. Metryki i analityka

## 6. Zależności (Aktualnie Używane)

### 6.1 Zewnętrzne
- Bootstrap 5.x (UI framework)
- Chrome Extension API
- DARWINA.PL API

### 6.2 Wewnętrzne
- Własny system eventów
- System cachowania
- System powiadomień

## 7. Dokumentacja (Do Uzupełnienia)

### 7.1 Dla Developerów
- [ ] API endpoints
- [ ] Struktura danych
- [ ] Flow autoryzacji
- [ ] Obsługa błędów

### 7.2 Dla Użytkowników
- [ ] Instrukcja instalacji
- [ ] Przewodnik użytkownika
- [ ] FAQ
- [ ] Troubleshooting

## 8. Monitoring i Diagnostyka

### 8.1 System Logowania
```javascript
LogService:
- info()
- warn()
- error()
- debug()
- trace()
```

### 8.2 Performance Monitoring
```javascript
PerformanceMonitorService:
- trackMetric()
- trackEvent()
- trackError()
- getMetrics()
```

### 8.3 Debug Panel
- Performance metrics
- Error logs
- Network status
- Cache status

## 9. Testy

### 9.1 Testy Jednostkowe
- Services
- Utils
- Components
- Helpers

### 9.2 Testy Integracyjne
- API communication
- Service communication
- Data flow
- Error handling

### 9.3 Testy E2E
- User flows
- UI interactions
- Data persistence
- Error scenarios

## 10. Deployment i CI/CD

### 10.1 Build Process
- Webpack configuration
- Asset optimization
- Code minification
- Source maps

### 10.2 Deployment Pipeline
- Code review
- Automated testing
- Version control
- Release management

## 11. Rozszerzalność

### 11.1 Plugin System
- Plugin architecture
- Plugin API
- Plugin lifecycle
- Plugin management

### 11.2 Customization
- Theme customization
- Layout customization
- Feature toggles
- User preferences 

## 12. Szczegółowa Struktura Plików

### 12.1 Pliki Główne
```
├── manifest.json           # Konfiguracja rozszerzenia Chrome
├── popup.html             # Główny interfejs użytkownika
├── popup.js              # Logika interfejsu
├── popup.css             # Style specyficzne dla popup
├── background.js         # Service worker i komunikacja z API
├── service-worker.js     # Worker dla background tasks
├── style.css            # Główne style aplikacji
├── offline.html         # Strona offline
├── .env                 # Zmienne środowiskowe
└── version.json         # Informacje o wersji
```

### 12.2 Katalogi Główne
```
├── assets/              # Zasoby statyczne
│   ├── default-avatar.jpg
│   └── icons/          # Ikony rozszerzenia
│
├── components/         # Komponenty UI
│   ├── Counter.js     # Liczniki statusów
│   ├── HUD.js         # Panel debugowania
│   ├── UserCard.js    # Karta użytkownika
│   └── [inne].js      # Pozostałe komponenty
│
├── config/            # Pliki konfiguracyjne
│   ├── api.js        # Konfiguracja API
│   ├── stores.js     # Konfiguracja sklepów
│   └── i18n.js       # Konfiguracja języków
│
├── services/          # Serwisy aplikacji
│   ├── api/          # Implementacje API
│   ├── DarwinaService.js
│   ├── UIComponentService.js
│   └── [inne].js     # Pozostałe serwisy
│
├── styles/           # Style modułowe
│   ├── animations.css
│   ├── theme.css
│   ├── hud.css
│   └── styles.css
│
├── locales/          # Tłumaczenia
│   ├── english.json
│   ├── polish.json
│   └── ukrainian.json
│
├── tests/            # Testy
│   ├── unit/        # Testy jednostkowe
│   └── integration/ # Testy integracyjne
│
└── users/           # Dane użytkowników
    └── [id].json    # Pliki JSON użytkowników
```

### 12.3 Serwisy (Szczegółowo)
```
services/
├── DarwinaService.js         # Główna logika biznesowa
│   ├── initialize()          # Inicjalizacja serwisu
│   ├── setupApiConfig()      # Konfiguracja API
│   ├── loadUsers()          # Ładowanie użytkowników
│   └── getStores()          # Pobieranie listy sklepów
│
├── UIComponentService.js     # Zarządzanie UI
│   ├── initialize()         # Inicjalizacja komponentów
│   ├── showUIElements()     # Zarządzanie widocznością
│   ├── initializeComponents() # Inicjalizacja elementów UI
│   └── updateTables()       # Aktualizacja tabel danych
│
├── ApiService.js            # Komunikacja z API
│   ├── get()               # GET requests
│   ├── post()              # POST requests
│   └── handleResponse()    # Obsługa odpowiedzi
│
├── CacheService.js         # Zarządzanie cache
│   ├── get()              # Pobieranie z cache
│   ├── set()              # Zapisywanie do cache
│   └── clear()            # Czyszczenie cache
│
├── LogService.js           # System logowania
│   ├── info()             # Logi informacyjne
│   ├── warn()             # Ostrzeżenia
│   ├── error()            # Błędy
│   └── debug()            # Logi debugowania
│
├── I18nService.js          # Internacjonalizacja
│   ├── initialize()        # Inicjalizacja języków
│   ├── translate()         # Tłumaczenie tekstów
│   └── setLanguage()      # Zmiana języka
│
└── [Pozostałe serwisy]     # Serwisy w trakcie implementacji
    ├── ErrorService.js     # Obsługa błędów
    ├── LoadingService.js   # Stany ładowania
    ├── NotificationService.js # Powiadomienia
    └── StatusCheckerService.js # Sprawdzanie statusów
```

### 12.4 Komponenty (Szczegółowo)
```
components/
├── Counter.js               # Liczniki statusów
├── HUD.js                  # Panel debugowania
├── Notification.js         # Komponent powiadomień
├── PerformanceHUD.js       # Monitor wydajności
├── ProgressiveLoader.js    # Loader progresywny
├── TableSkeleton.js        # Szkielet tabeli
├── Transition.js           # Efekty przejścia
├── UIComponents.js         # Podstawowe komponenty
├── UserCard.js             # Karta użytkownika
└── VirtualList.js          # Lista wirtualna
```

### 12.5 Testy (Szczegółowo)
```
tests/
├── setup.js           # Konfiguracja środowiska testowego
│   ├── chrome API mock
│   ├── localStorage mock
│   ├── fetch mock
│   └── Bootstrap components mock
│
├── startup.test.js    # Testy startowe aplikacji
│
├── integration/       # Testy integracyjne
│   ├── api.test.js   # Testy integracji z API
│   │   ├── Autoryzacja
│   │   ├── Pobieranie danych
│   │   └── Obsługa błędów
│   │
│   └── api.extended.test.js
│       └── Scenariusze zaawansowane
│
└── unit/             # Testy jednostkowe
    ├── api.test.js   # Testy API Service
    │   ├── Inicjalizacja
    │   └── Pobieranie zamówień
    │
    ├── cache.test.js # Testy Cache Service
    │   ├── Zapisywanie
    │   ├── Odczytywanie
    │   └── Czyszczenie
    │
    ├── i18n.test.js  # Testy internacjonalizacji
    │   ├── Zmiana języka
    │   └── Tłumaczenia
    │
    ├── popup.test.js # Testy interfejsu
    │   ├── Renderowanie
    │   └── Interakcje
    │
    └── [inne].test.js
```

### 12.6 Konfiguracja (Szczegółowo)
```
config/
├── api.js                # Konfiguracja API
│   ├── API_CONFIG       # Główna konfiguracja
│   │   └── DARWINA     # Konfiguracja DARWINA API
│   │       ├── BASE_URL
│   │       ├── ENDPOINTS
│   │       └── STATUS_CODES
│   │
│   ├── sendLogToPopup()  # Wysyłanie logów do popup
│   ├── loadCredentials() # Ładowanie credentials
│   ├── filterOrders()    # Filtrowanie zamówień
│   └── getStatusName()   # Nazwy statusów
│
├── stores.js            # Konfiguracja sklepów
│   ├── stores          # Lista sklepów
│   └── getStoreById()  # Pobieranie sklepu po ID
│
├── delivery.js         # Konfiguracja dostaw
│   └── DELIVERY_IDS    # ID metod dostawy
│
├── i18n.js            # Konfiguracja języków
│   ├── DEFAULT_LANG   # Domyślny język
│   └── SUPPORTED_LANGS # Wspierane języki
│
└── credentials.json    # Dane uwierzytelniające (git-ignored)
```

### 12.7 Lokalizacja (Szczegółowo)
```
locales/
├── english.json       # Tłumaczenia angielskie
│   ├── welcome       # Tekst powitalny
│   ├── navigation    # Menu i nawigacja
│   │   ├── chat
│   │   ├── settings
│   │   ├── about
│   │   └── status
│   │
│   ├── ui           # Elementy interfejsu
│   │   ├── queryLabel
│   │   ├── send
│   │   └── theme
│   │
│   ├── settings     # Ustawienia
│   │   ├── theme
│   │   ├── background
│   │   └── debugMode
│   │
│   └── status       # Statusy i komunikaty
│       ├── workingProperly
│       ├── hasIssues
│       └── serviceStatus
│
├── polish.json      # Tłumaczenia polskie
│   ├── welcome      # "KAMILA - Inteligentny Asystent DARWINA.PL"
│   ├── navigation   # Menu i nawigacja
│   ├── ui          # Elementy interfejsu
│   ├── settings    # Ustawienia
│   └── status      # Statusy i komunikaty
│
└── ukrainian.json   # Tłumaczenia ukraińskie
    ├── welcome     # Tekst powitalny
    ├── navigation  # Menu i nawigacja
    ├── ui         # Elementy interfejsu
    ├── settings   # Ustawienia
    └── status     # Statusy i komunikaty
```

### 12.8 Zasoby Statyczne
```
assets/
├── icons/          # Ikony rozszerzenia
│   ├── icon-16.png  # Ikona w pasku narzędzi
│   ├── icon-48.png  # Ikona w menu
│   └── icon-128.png # Ikona w zarządzaniu
│
└── default-avatar.jpg # Domyślny avatar użytkownika

qrcodes/           # Kody QR użytkowników
└── [id].png       # Kody QR według ID

users/             # Dane użytkowników
└── [id].json      # Dane według ID
```

### 12.9 Testy (Szczegółowo)
```
tests/
├── setup.js           # Konfiguracja środowiska testowego
│   ├── chrome API mock
│   ├── localStorage mock
│   ├── fetch mock
│   └── Bootstrap components mock
│
├── startup.test.js    # Testy startowe aplikacji
│
├── integration/       # Testy integracyjne
│   ├── api.test.js   # Testy integracji z API
│   │   ├── Autoryzacja
│   │   ├── Pobieranie danych
│   │   └── Obsługa błędów
│   │
│   └── api.extended.test.js
│       └── Scenariusze zaawansowane
│
└── unit/             # Testy jednostkowe
    ├── api.test.js   # Testy API Service
    │   ├── Inicjalizacja
    │   └── Pobieranie zamówień
    │
    ├── cache.test.js # Testy Cache Service
    │   ├── Zapisywanie
    │   ├── Odczytywanie
    │   └── Czyszczenie
    │
    ├── i18n.test.js  # Testy internacjonalizacji
    │   ├── Zmiana języka
    │   └── Tłumaczenia
    │
    ├── popup.test.js # Testy interfejsu
    │   ├── Renderowanie
    │   └── Interakcje
    │
    └── [inne].test.js
```

### 12.10 Narzędzia Deweloperskie
```
scripts/
└── build.js         # Skrypt budowania

build.sh            # Shell script dla CI/CD

jest.config.js      # Konfiguracja testów
├── testEnvironment: 'jsdom'
├── moduleNameMapper
├── setupFiles
└── collectCoverageFrom
    ├── services/**/*.js
    ├── utils/**/*.js
    ├── components/**/*.js
    └── config/**/*.js

package.json        # Zależności i skrypty
├── dependencies
├── devDependencies
└── scripts
    ├── test
    ├── build
    └── watch

version.json        # Informacje o wersji
├── version
├── buildDate
└── environment
```

### 12.11 Pliki Konfiguracyjne
```
.env               # Zmienne środowiskowe
├── API_KEY
├── API_URL
└── DEBUG_MODE

.gitignore         # Ignorowane pliki
├── node_modules/
├── coverage/
├── .env
└── credentials.json

connections.json   # Konfiguracja połączeń
├── endpoints
├── timeouts
└── retryPolicy

manifest.json      # Manifest rozszerzenia Chrome
├── permissions
├── background
├── content_scripts
└── browser_action
``` 