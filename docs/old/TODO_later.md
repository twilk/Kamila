# URGENT TASK

# KRYTYCZNE BŁĘDY DO NATYCHMIASTOWEJ NAPRAWY

## wykonać research jak zadbać wewnątrz aplikacji, by nie przekroczyć limitów ustalonych przez użytkownika w ustawieniach oraz limitów bezpieczeństwa samej aplikacji żeby nie zalać użytkownika powiadomieniami.

## 1. Błędy walidacji zamówień [CRITICAL]
- [x] Naprawić błąd walidacji 1526 zamówień w `processDataWithProgress`
  > Problem: Funkcja oznacza prawidłowe zamówienia jako nieprawidłowe
  > Lokalizacja: background.js:741
  > Rozwiązanie:
  > - Dodano szczegółową walidację każdego pola zamówienia
  > - Dodano logowanie przyczyn odrzucenia zamówień
  > - Dodano walidację formatu daty dla statusu 5
  > - Dodano podsumowanie walidacji (liczba prawidłowych/nieprawidłowych)
  > - Dodano szczegółowe logowanie błędów
  > - Zaimplementowano kontynuację przetwarzania z prawidłowymi zamówieniami
  > - Dodano walidację liczników statusów
  > Status: ✅ FIXED

## 2. Błędy połączenia z popup [CRITICAL]
- [x] Naprawić błędy "Message sending failed (popup might be closed)"
  > Problem: Komunikacja między background a popup jest przerywana
  > Lokalizacja: background.js:467
  > Rozwiązanie:
  > - Dodano sprawdzanie istnienia popup przed wysyłaniem wiadomości
  > - Dodano mechanizm ponownych prób z exponential backoff
  > - Dodano timeout dla wiadomości
  > - Dodano szczegółowe logowanie błędów
  > - Zaimplementowano bezpieczne sprawdzanie statusu połączenia
  > Status: ✅ FIXED (Bezpieczniejsza implementacja)

## 3. Błędy ładowania zasobów [CRITICAL]
- [x] Naprawić błąd "Failed to load resource: net::ERR_FILE_NOT_FOUND"
  > Problem: Nie można załadować DataManager.js
  > Lokalizacja: DataManager.js:1
  > Rozwiązanie:
  > - Sprawdzono ścieżki importów
  > - Zweryfikowano strukturę katalogów
  > - Naprawiono referencje do plików
  > - Dodano funkcję updateLeadCounts w background.js
  > Status: ✅ FIXED

## 4. Błędy inicjalizacji [CRITICAL]
- [ ] Naprawić błędy podczas instalacji rozszerzenia
  > Problem: Instalacja kończy się błędem po 3 próbach
  > Lokalizacja: background.js:63
  > Rozwiązanie:
  > - Dodać lepszą obsługę błędów inicjalizacji
  > - Zaimplementować fallback dla krytycznych operacji
  > - Poprawić sekwencję inicjalizacji

sprawdź implementację czy faktycznie działa tak jak powinna. czyli:
- przy pierwszym uruchomieniu aplikacji pobiera ona z darwina.pl/api wszystkie zamówienia (orders) do pamięci 
- gdy aplikacja zostaje uruchomiona każdy kolejny raz, dane ładują się natychmiast z pamięci, a w tle wykonywane jest ograniczone zaptanie o zamówienia zmienione od ostatniej aktualizacji i one również są dodawane/aktualizowane.
- używamy czterech statusów (1,2,3,5), ale wyświetlamy pięć ze względu na to, że 5 dzielimy na status READY i OVERDUE (który jest ready, ale mającym już ponad 2 tygodnie)
- przycisk odśwież dane ma zaimplementowane usunięcie z pamięci wszystkich zamówień i pobranie ich ponownie
- wyświetlane są dane w zależności od wybranego sklepu 
//NOTES do aktualnej pracy

# Wyniki analizy implementacji

## 1. Pierwsze uruchomienie aplikacji ✅
- Zaimplementowane w `background.js` (linie 518-576)
- Przy pierwszym uruchomieniu (`isFirstRun = true`) pobierane są wszystkie zamówienia z API
- Wykorzystuje `fetchFullData()` do pobrania kompletnych danych

## 2. Kolejne uruchomienia ✅
- Dane ładują się natychmiast z pamięci podręcznej (cache)
  - Implementacja w `services/api.js` (linie 53-57)
- W tle wykonywane są ograniczone zapytania o zmiany
  - Inkrementalne aktualizacje w `background.js` (linie 603-625)

## 3. Obsługa statusów ✅
- Wykorzystywane są 4 podstawowe statusy (1,2,3,5)
  - Zdefiniowane w `background.js` (linie 580-581)
- Status 5 jest dzielony na dwa podtypy:
  - READY: standardowe zamówienia gotowe do odbioru
  - OVERDUE: zamówienia gotowe starsze niż 2 tygodnie

## 4. Przycisk odświeżania ✅
- Implementacja w klasie `RefreshManager` (`services/refreshManager.js`, linie 4-195)
- Proces odświeżania:
  1. Czyszczenie cache i timestampów (linie 357-362 w `background.js`)
  2. Wymuszenie pełnego odświeżenia danych (linie 364-366)
  3. Aktualizacja UI i storage (linie 369-373)

## 5. Filtrowanie po sklepie ✅
- Dane filtrowane według wybranego sklepu (linie 632-638 w `background.js`)
- UI aktualizowany na podstawie wyboru sklepu (linie 326-329 w `popup.js`)
- Osobne cache dla każdego sklepu (linie 108-109 w `services/dataManager.js`)

//END NOTES do aktualnej pracy

# URGENT PLAN NAPRAWY - TYLKO KRYTYCZNE NAPRAWY

## 1. Krytyczne naprawy [CRITICAL]

### 1.1. Stabilizacja pobierania danych
- [x] Naprawić potencjalne problemy z pierwszym pobraniem danych (timeout, brak połączenia)
  > Problem: Brak obsługi timeout w `fetchFullData` i brak retry mechanism
  > Rozwiązanie: Dodać timeout i retry z exponential backoff w `fetchAndCacheData`
  > Implementacja:
  > - Dodano MAX_RETRIES (3 próby)
  > - Dodano INITIAL_TIMEOUT (30s) i MAX_TIMEOUT (2min)
  > - Dodano AbortController dla timeout
  > - Dodano exponential backoff między próbami
  > - Dodano szczegółowe logowanie prób

- [x] Naprawić błędy przy aktualizacji inkrementalnej (niespójność danych)
  > Problem: W `fetchIncrementalData` brak walidacji spójności danych przed zapisem
  > Rozwiązanie: Dodać walidację w `processDataWithProgress`
  > Implementacja:
  > - Dodano walidację wejściowych danych (format tablicy)
  > - Dodano walidację każdego zamówienia (id, status_id)
  > - Dodano walidację danych w storage
  > - Dodano wykrywanie rzeczywistych zmian w zamówieniach
  > - Dodano walidację liczników statusów
  > - Dodano szczegółowe logowanie zmian
  > - Dodano obsługę błędów z informacją diagnostyczną

- [x] Naprawić problemy z cache przy zmianie sklepu
  > Problem: W `DataManager.refreshData` cache nie jest prawidłowo czyszczony przy zmianie sklepu
  > Rozwiązanie: Poprawić mechanizm czyszczenia cache w `refreshData`
  > Implementacja:
  > - Dodano śledzenie poprzedniego sklepu w storage
  > - Dodano wykrywanie zmiany sklepu
  > - Dodano czyszczenie cache poprzedniego sklepu
  > - Dodano osobne klucze cache dla każdego sklepu
  > - Dodano weryfikację sklepu w backup danych
  > - Dodano szczegółowe logowanie operacji na cache
  > - Dodano informację o sklepie w emitowanych eventach

### 1.2. Naprawa błędów w UI [CRITICAL]

- [x] Błędy przy przełączaniu sklepów [FIXED]
  - Problem: Brak walidacji, obsługi błędów i stanu ładowania przy zmianie sklepu
  - Lokalizacja: `services/uiManager.js`
  - Rozwiązanie:
    - Dodano walidację ID sklepu
    - Dodano mechanizm retry dla operacji ładowania danych
    - Dodano obsługę stanu ładowania w UI
    - Dodano czyszczenie cache przy zmianie sklepu
    - Dodano przywracanie poprzedniego sklepu w przypadku błędu
    - Dodano pełną aktualizację UI po zmianie sklepu
    - Dodano metryki dla operacji zmiany sklepu
  - Status: FIXED

### 1.3. Naprawa obsługi błędów
- [ ] Naprawić nieobsługiwane wyjątki w API
- [ ] Naprawić problemy z fallback do cache przy błędach
- [ ] Naprawić obsługę błędów przy braku połączenia

### 1.4. Naprawa duplikacji
- [ ] Usunąć stare implementacje z src_backup
- [ ] Naprawić zduplikowane managery
- [ ] Naprawić niespójności w obsłudze statusów

## 2. Testy krytycznych napraw
- [ ] Testy pobierania danych (pierwsze uruchomienie, aktualizacje)
- [ ] Testy synchronizacji cache (zmiana sklepu, odświeżanie)
- [ ] Testy obsługi błędów (brak połączenia, timeout)

## 3. Kolejność napraw:
1. Stabilizacja pobierania danych (1.1) ✅
2. Naprawa błędów w UI (1.2)
3. Naprawa obsługi błędów (1.3)
4. Naprawa duplikacji (1.4)
5. Testy napraw (2)

## 4. Kryteria sukcesu napraw:
- [x] Stabilne pierwsze ładowanie danych
- [x] Poprawne odświeżanie danych
- [ ] Zero nieobsługiwanych błędów
- [x] Spójne działanie cache

## 4. Błędy w systemie lead-count [CRITICAL]

### 4.1 Walidacja danych API [HIGH]
- [ ] Dodać szczegółową walidację pól w surowych danych API
  > Problem: Brak pełnej walidacji typów i wartości pól
  > Lokalizacja: services/api/drwn.js:44
  > Rozwiązanie:
  > - Dodać walidację typów dla każdego pola
  > - Sprawdzać poprawność formatów dat
  > - Dodać walidację wartości liczbowych
  > - Implementować obsługę częściowych danych
  > Status: 🔄 TODO

### 4.2 Zarządzanie storage [HIGH]
- [ ] Poprawić operacje na storage
  > Problem: Brak kontroli quota i race conditions
  > Lokalizacja: background.js:1405
  > Rozwiązanie:
  > - Dodać sprawdzanie quota przed zapisem
  > - Implementować mechanizm czyszczenia starych danych
  > - Dodać blokady dla operacji współbieżnych
  > - Walidować kontekst sklepu przed zapisem
  > Status: 🔄 TODO

### 4.3 Aktualizacje UI [MEDIUM]
- [ ] Usprawnić mechanizm aktualizacji UI
  > Problem: Race conditions i wycieki pamięci
  > Lokalizacja: services/statusManager.js:114
  > Rozwiązanie:
  > - Dodać obsługę błędów DOM
  > - Implementować cleanup dla animacji
  > - Zoptymalizować aktualizacje liczników
  > - Dodać mechanizm batch updates
  > Status: 🔄 TODO

### 4.4 Walidacja danych [HIGH]
- [ ] Rozszerzyć walidację danych
  > Problem: Niekompletna walidacja w validateCountsData
  > Lokalizacja: services/dataManager.js:237
  > Rozwiązanie:
  > - Dodać walidację typów numerycznych
  > - Sprawdzać wartości ujemne
  > - Implementować walidację statusów
  > - Dodać konwersję typów
  > Status: 🔄 TODO

### 4.5 Zarządzanie cache [MEDIUM]
- [ ] Poprawić system cache
  > Problem: Brak walidacji struktury i TTL
  > Lokalizacja: services/dataManager.js
  > Rozwiązanie:
  > - Dodać walidację struktury cache
  > - Implementować system TTL
  > - Dodać mechanizm czyszczenia cache
  > - Obsłużyć błędy cache
  > Status: 🔄 TODO

### 4.6 Obsługa eventów [HIGH]
- [ ] Usprawnić system eventów
  > Problem: Wycieki pamięci i race conditions
  > Lokalizacja: background.js
  > Rozwiązanie:
  > - Dodać error boundaries
  > - Implementować cleanup listenerów
  > - Dodać kolejkowanie eventów
  > - Obsłużyć timeout dla eventów
  > Status: 🔄 TODO

### 4.7 Aktualizacje w tle [MEDIUM]
- [ ] Poprawić mechanizm aktualizacji
  > Problem: Brak retry i timeout
  > Lokalizacja: background.js
  > Rozwiązanie:
  > - Dodać mechanizm retry
  > - Implementować timeout
  > - Dodać exponential backoff
  > - Obsłużyć błędy aktualizacji
  > Status: 🔄 TODO

### 4.8 Kontekst sklepu [HIGH]
- [ ] Usprawnić zarządzanie kontekstem
  > Problem: Race conditions przy zmianie sklepu
  > Lokalizacja: services/dataManager.js
  > Rozwiązanie:
  > - Dodać walidację zmiany sklepu
  > - Implementować cleanup danych
  > - Dodać blokady operacji
  > - Obsłużyć błędy zmiany kontekstu
  > Status: 🔄 TODO

### 4.9 Optymalizacja wydajności [LOW]
- [ ] Zoptymalizować operacje
  > Problem: Nadmierne operacje DOM i storage
  > Lokalizacja: services/uiManager.js
  > Rozwiązanie:
  > - Zaimplementować batch updates
  > - Zoptymalizować operacje storage
  > - Dodać debouncing dla UI
  > - Zoptymalizować animacje
  > Status: 🔄 TODO

### 4.10 System recovery [HIGH]
- [ ] Usprawnić system recovery
  > Problem: Niekompletne przywracanie po błędach
  > Lokalizacja: services/errorHandler.js
  > Rozwiązanie:
  > - Dodać pełny system recovery
  > - Implementować fallback data
  > - Rozszerzyć logowanie błędów
  > - Dodać powiadomienia admina
  > Status: 🔄 TODO

---- LATER TASKS ----

# Przyszłe ulepszenia [LOW PRIORITY]

## 1. Optymalizacje
- [ ] Optymalizacja łańcucha wykonań
- [ ] Optymalizacja wydajności
- [ ] Optymalizacja pamięci
- [ ] Optymalizacja UI

## 2. Nowe funkcjonalności
- [ ] Monitoring i metryki
- [ ] System kolejkowania
- [ ] Zaawansowana obsługa błędów
- [ ] Rozszerzone testy

## 3. Dokumentacja
- [ ] Dokumentacja techniczna
- [ ] Diagramy przepływu
- [ ] Instrukcje debugowania
- [ ] Dokumentacja API

# Limity powiadomień [CRITICAL] ✅
- [x] Zaimplementować system zarządzania limitami powiadomień
  > Problem: Brak kontroli nad ilością wyświetlanych powiadomień
  > Lokalizacja: background.js
  > Rozwiązanie:
  > - Dodano klasę NotificationManager do zarządzania powiadomieniami
  > - Zaimplementowano limity: na minutę (10), godzinę (30), dzień (100)
  > - Dodano cooldown 3s między powiadomieniami
  > - Dodano persystencję historii powiadomień w storage
  > - Dodano możliwość konfiguracji limitów przez użytkownika
  > - Dodano system śledzenia i statystyk powiadomień
  > - Dodano mechanizm czyszczenia starych wpisów
  > Status: ✅ FIXED

# TODO List

## Storage System [IN PROGRESS]

### Completed ✅
1. Implemented new `StorageManager` class with:
   - Quota management
   - Race condition prevention with locks
   - Automatic cleanup of old data
   - Better error handling
   - Type safety improvements

2. Updated core components to use `StorageManager`:
   - `NotificationManager`
   - `CacheService`
   - `SettingsManager`
   - Background data fetching

### Remaining Tasks 🔄

#### High Priority
1. Storage Migration [CRITICAL]
   - Create migration script for existing data
   - Add version tracking for storage schema
   - Implement automatic migration on startup
   - Add rollback capability for failed migrations

2. Performance Optimization [HIGH]
   - Implement batch operations for multiple storage operations
   - Add compression for large datasets
   - Optimize cleanup strategies
   - Add performance monitoring

3. Error Recovery [HIGH]
   - Implement automatic recovery for corrupted data
   - Add data integrity checks
   - Create backup system for critical data
   - Improve error reporting

#### Medium Priority
4. Cache Management [MEDIUM]
   - Optimize cache invalidation strategy
   - Implement smarter cleanup based on usage patterns
   - Add cache statistics tracking
   - Improve cache hit ratio

5. Storage Analytics [MEDIUM]
   - Add detailed storage usage tracking
   - Implement storage usage alerts
   - Create storage usage dashboard
   - Add performance metrics collection

6. Testing Improvements [MEDIUM]
   - Add more unit tests for StorageManager
   - Create integration tests for storage operations
   - Add performance benchmarks
   - Implement stress testing

#### Low Priority
7. Documentation Updates [LOW]
   - Update API documentation
   - Add storage best practices guide
   - Create troubleshooting guide
   - Document recovery procedures

8. Developer Tools [LOW]
   - Add storage debugging tools
   - Create storage inspection UI
   - Implement storage cleanup tools
   - Add development mode features

## Future Considerations 🔮

1. Storage Optimization
   - Consider implementing IndexedDB for larger datasets
   - Evaluate WebStorage alternatives
   - Research compression algorithms
   - Investigate PWA storage options

2. Performance Enhancements
   - Research better caching strategies
   - Consider implementing worker-based storage
   - Evaluate streaming storage operations
   - Research better serialization methods

3. Security Improvements
   - Add encryption for sensitive data
   - Implement better access control
   - Add audit logging
   - Enhance security validation

## Notes 📝

### Storage Quota Management
- Current quota warning threshold: 80%
- Critical threshold: 90%
- Cleanup batch size: 50 items
- Lock timeout: 5 seconds

### Performance Targets
- Storage operations < 100ms
- Cache hit ratio > 80%
- Cleanup operations < 1s
- Migration time < 5s

### Error Handling Strategy
1. Retry failed operations up to 3 times
2. Use exponential backoff
3. Fall back to cache when possible
4. Log all critical errors

### Testing Requirements
1. Unit test coverage > 90%
2. Integration test coverage > 80%
3. Performance benchmark targets met
4. Stress test survival > 24h

//END TODO