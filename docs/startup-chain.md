# Łańcuch startowy aplikacji Kamila

## 1. Inicjalizacja podstawowa
1. Załadowanie popup.html
2. Załadowanie wszystkich plików CSS (bootstrap, icons, style.css, theme.css, test.css)
3. Załadowanie popup.js jako moduł

## 2. Import i inicjalizacja menedżerów
1. Import wszystkich serwisów i menedżerów z services/index.js
2. Import konfiguracji API i funkcji pomocniczych
3. Import testRunnera i testów integracyjnych
4. Import serwisu motywów

## 3. Inicjalizacja statyczna
1. Inicjalizacja statycznych pól BaseManager:
   - Utworzenie InitLogger
   - Utworzenie MetricsManager
   - Utworzenie EventManager

## 4. Inicjalizacja menedżerów podstawowych (Core Services)
1. Inicjalizacja MetricsManager
2. Utworzenie i inicjalizacja ErrorHandler (obsługa błędów)
3. Utworzenie i inicjalizacja UIManager (zarządzanie interfejsem)
4. Utworzenie i inicjalizacja DebugManager (zarządzanie debugowaniem)
5. Utworzenie i inicjalizacja EventManager (zarządzanie zdarzeniami)
6. Utworzenie i inicjalizacja ConnectionManager (zarządzanie połączeniami)
7. Utworzenie i inicjalizacja CacheManager (zarządzanie cache)

## 5. Inicjalizacja menedżerów bazowych (Base Managers)
1. Utworzenie i inicjalizacja InitialLoadingManager (ekran ładowania podczas inicjalizacji)
2. Utworzenie i inicjalizacja OperationProgressManager (postęp operacji w trakcie działania)
3. Utworzenie i inicjalizacja MenuManager (zarządzanie menu)
4. Utworzenie i inicjalizacja VolumeManager (zarządzanie dźwiękiem)

## 6. Inicjalizacja menedżerów funkcjonalnych (Feature Managers)
1. Utworzenie i inicjalizacja DataManager (zarządzanie danymi)
   - Dodanie zależności: UIManager, CacheManager, ConnectionManager
2. Utworzenie i inicjalizacja StatusManager (zarządzanie statusami)
   - Dodanie zależności: EventManager
3. Utworzenie i inicjalizacja UserManager (zarządzanie użytkownikami)
   - Dodanie zależności: UIManager
4. Utworzenie i inicjalizacja InterfaceManager (zarządzanie interfejsem)
   - Dodanie zależności: UIManager, EventManager, DebugManager
5. Utworzenie i inicjalizacja UpdateManager (zarządzanie aktualizacjami)
   - Dodanie zależności: EventManager
6. Utworzenie i inicjalizacja LanguageManager (zarządzanie językami)
   - Dodanie zależności: EventManager
7. Utworzenie i inicjalizacja RefreshManager (zarządzanie odświeżaniem)
   - Dodanie zależności: DataManager

## 7. Inicjalizacja interfejsu
1. Aktualizacja tłumaczeń interfejsu
2. Aktualizacja interfejsu z tłumaczeniami
3. Inicjalizacja karty użytkownika
4. Inicjalizacja panelu debugowania
5. Inicjalizacja przycisku aktualizacji
6. Pierwsze pobranie danych (notifyPopupOpened)
7. Inicjalizacja ustawień interwałów

## 8. Inicjalizacja komponentów UI
1. Inicjalizacja przycisku debugowania
2. Inicjalizacja przycisku odświeżania
<!-- 3. Inicjalizacja przycisków sprawdzania zamówień -->
4. Inicjalizacja przycisków czyszczenia logów
5. Inicjalizacja uploadera tapet
6. Inicjalizacja przycisków instrukcji
7. Inicjalizacja pola zapytań
8. Inicjalizacja selektora sklepów
9. Inicjalizacja zakładek
10. Inicjalizacja przełącznika języka
11. Inicjalizacja przełącznika motywu
12. Inicjalizacja selektora użytkowników
13. Inicjalizacja przycisków statusu

## 9. Inicjalizacja statusów i liczników
1. Pierwsze sprawdzenie statusów
2. Aktualizacja wszystkich statusów
3. Inicjalizacja elementów statusów
4. Inicjalizacja linków statusów
5. Reset stanu trybu debugowania

## 10. Nasłuchiwanie zdarzeń
1. Nasłuchiwanie wiadomości od background script
2. Nasłuchiwanie zmian w zakładkach
3. Nasłuchiwanie zmian w debugowaniu
4. Nasłuchiwanie zmian w selektorze sklepów
5. Nasłuchiwanie zmian w selektorze użytkowników

## 11. Automatyczne odświeżanie
1. Uruchomienie interwału odświeżania (co 5 minut)
2. Sprawdzanie nowych zamówień
3. Aktualizacja liczników
4. Aktualizacja statusów

## 12. Czyszczenie przy zamknięciu
1. Wywołanie disposeManagers przy zamknięciu popup
2. Sekwencyjne czyszczenie wszystkich menedżerów
3. Czyszczenie referencji
4. Finalne czyszczenie ErrorHandler 

## 13. Sekwencja ładowania danych
1. Pierwsze ładowanie (przy otwarciu popup):
   - Pobranie konfiguracji API
   - Pobranie credentiali
   - Sprawdzenie cache'u dla wybranego sklepu
   - Jeśli cache nieaktualny: pełne pobranie danych
   - Jeśli cache aktualny: inkrementalna aktualizacja

2. Ładowanie statusów zamówień:
   - Pobranie zamówień ze statusem SUBMITTED (co 5 minut)
   - Pobranie zamówień ze statusem CONFIRMED (co 5 minut)
   - Pobranie zamówień ze statusem ACCEPTED (co 15 minut)
   - Pobranie zamówień ze statusem READY (co 15 minut)
   - Sprawdzenie zamówień przeterminowanych (>14 dni)

3. Ładowanie danych użytkownika:
   - Pobranie profilu użytkownika
   - Pobranie uprawnień
   - Pobranie preferencji
   - Pobranie historii aktywności

4. Ładowanie danych sklepu:
   - Pobranie listy dostępnych sklepów
   - Pobranie szczegółów wybranego sklepu
   - Pobranie statystyk sklepu
   - Pobranie konfiguracji sklepu

5. Aktualizacje w tle:
   - Sprawdzanie nowych zamówień (co 1 minutę)
   - Odświeżanie liczników (co 5 minut)
   - Sprawdzanie zmian statusów (co 5 minut)
   - Aktualizacja cache'u (co 5 minut)
   - Walidacja danych (co 15 minut)

6. Ładowanie na żądanie:
   - Przy zmianie sklepu
   - Przy zmianie filtrów
   - Przy ręcznym odświeżeniu
   - Przy akcjach użytkownika

7. Obsługa błędów ładowania:
   - Retry dla nieudanych pobrań (max 3 próby)
   - Fallback do cache'u przy błędach
   - Graceful degradation przy braku połączenia
   - Powiadomienia o błędach krytycznych 