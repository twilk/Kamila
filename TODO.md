# Plan przywrócenia zmian po rollbacku

## 1. Przygotowanie
- [x] Wykonać rollback do ostatniej działającej wersji
- [x] Utworzyć nowy branch `feature/storage-refactor`
- [x] Zweryfikować działanie aplikacji po rollbacku

## 2. Etap 1: Przygotowanie Chrome Storage
- [x] Dodać stałe dla kluczy storage
- [x] Przetestować podstawowe operacje na chrome.storage.local
- [x] Dodać helper functions dla storage

## 3. Etap 2: Migracja Cache do Storage w background.js
- [x] Zmodyfikować fetchAndCacheData
- [x] Zaktualizować message handler
- [x] Uprościć processDataWithProgress

## 4. Etap 3: Czyszczenie Kodu
- [x] Usunąć pliki:
  - [x] services/cache.js - zawierał CacheService z metodami get/set
  - [x] services/errors.js - zawierał ApiError i HTTP_ERRORS
  - [x] services/retry.js - zawierał RetryStrategy
  - [x] services/validator.js - zawierał DataValidator

- [x] Usunąć importy i użycia:
  - [x] W popup.js usunięto import CacheService
  - [x] W users.js usunięto import i użycie getFromCache/saveToCache
  - [x] W sellyApi.js zastąpiono całą implementację placeholderem

## 5. Etap 4: Aktualizacja API
- [x] Uprościć services/sellyApi.js do:
  ```js
  export const sellyApi = null;
  ```
- [x] Zaktualizować services/users.js do bezpośredniego dostępu do plików
- [x] Zaktualizować services/dataManager.js

## 6. Testowanie
- [x] Przetestować pobieranie danych
  - [x] Testy dla storage.js
  - [x] Testy dla dataManager.js
  - [x] Testy dla users.js
- [x] Przetestować zapisywanie do storage
  - [x] Testy operacji CRUD na storage
  - [x] Testy obsługi błędów storage
- [x] Przetestować odczyt ze storage
  - [x] Testy dla różnych typów danych
  - [x] Testy dla nieistniejących kluczy
- [x] Sprawdzić obsługę błędów
  - [x] Testy dla błędów API
  - [x] Testy dla błędów storage
  - [x] Testy dla błędów walidacji
- [x] Zweryfikować wydajność
  - [x] Test dużych obiektów w storage
  - [x] Test częstych operacji odczytu/zapisu
- [x] Sprawdzić limity chrome.storage.local
  - [x] Test przekroczenia limitu 5MB
  - [x] Test obsługi błędów quota exceeded

## 7. Dokumentacja
- [ ] Zaktualizować komentarze w kodzie
- [ ] Zaktualizować README.md o zmiany w storage
- [ ] Dodać informacje o migracji z cache do storage
- [ ] Dodać informację o limitach storage (5MB)

## 8. Finalizacja
- [ ] Code review
- [ ] Testy końcowe
- [ ] Merge do głównego brancha

## 9. Panel Testów w UI
- [ ] Utworzyć nowy komponent TestPanel
  - [ ] Stworzyć podstawowy layout panelu
  - [ ] Dodać style dla wskaźników (zielony/czerwony)
  - [ ] Zaimplementować automatyczne wykrywanie testów
  - [ ] Dodać animacje dla statusów testów

- [ ] Zmodyfikować istniejące testy
  - [ ] Przenieść testy do formatu wykonywalnego w przeglądarce
  - [ ] Dodać metadane do testów (nazwa, opis, kategoria)
  - [ ] Dodać mechanizm raportowania wyników

- [ ] Integracja z UI
  - [ ] Dodać panel testów do zakładki About
  - [ ] Zaimplementować automatyczne odświeżanie wyników
  - [ ] Dodać możliwość ręcznego uruchomienia testów
  - [ ] Dodać szczegółowe raporty dla failujących testów

- [ ] System raportowania
  - [ ] Stworzyć format raportów testów
  - [ ] Dodać liczniki czasów wykonania
  - [ ] Dodać szczegółowe logi dla błędów
  - [ ] Zaimplementować eksport wyników

## Struktura TestPanel
```js
{
  name: string;           // Nazwa testu
  category: string;       // Kategoria (np. 'storage', 'performance')
  description: string;    // Krótki opis testu
  status: 'pass'|'fail'; // Status wykonania
  duration: number;      // Czas wykonania w ms
  error?: Error;        // Szczegóły błędu jeśli wystąpił
  timestamp: number;    // Kiedy test był wykonany
}
```

## Format metadanych testu
```js
@TestMetadata({
  name: 'Large Object Storage',
  category: 'Performance',
  description: 'Tests storage operations with 1MB+ objects'
})
```

## Uwagi implementacyjne
- Testy muszą być wykonywalne w kontekście przeglądarki
- Panel powinien być generatywny (automatycznie wykrywać nowe testy)
- Wyniki testów powinny być zapisywane w storage
- Dodać możliwość eksportu wyników do JSON
- Zachować możliwość uruchamiania testów z CLI dla CI/CD

## Uwagi
- Implementować zmiany małymi krokami
- Testować każdą zmianę przed przejściem dalej
- Zachować kopie zapasowe ważnych plików
- Utrzymywać spójność z TypeScript
- Pamiętać o limitach chrome.storage.local (5MB)
- Dodać obsługę błędów gdy storage jest pełny