# Plan refaktoryzacji managerów

## Główne problemy do rozwiązania:
1. Bezpośrednie użycie `managers.managerName` zamiast `getDependency()`
2. Dodawanie zależności przez referencję zamiast przez string
3. Przechowywanie referencji do managerów w prywatnych polach
4. Nieprawidłowa implementacja wzorca singleton
5. Brak spójności w inicjalizacji i zarządzaniu zależnościami

## Kroki dla każdego managera:

### 1. managers.js
1. Usunąć bezpośrednie importy managerów
2. Zmienić implementację `registry` na prawidłowy singleton
3. Dodać metodę `setRegistry` do klasy `ManagerRegistry`
4. Zmienić gettery managerów na asynchroniczne
5. Usunąć eksport instancji managerów
6. Dodać walidację nazw managerów
7. Poprawić obsługę błędów w metodach get/register

### 2. BaseManager.js
1. Dodać statyczne pole `_registry`
2. Dodać metodę statyczną `setRegistry`
3. Zmienić `addDependency` na przyjmowanie stringów
4. Poprawić metodę `getDependency` na asynchroniczną
5. Dodać walidację nazw zależności
6. Dodać obsługę cykli w zależnościach
7. Poprawić mechanizm inicjalizacji

### 3. AlarmManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić `addDependency('event')` na string
5. Zmienić `addDependency('order')` na string
6. Usunąć bezpośrednie użycie `managers.eventManager`
7. Poprawić obsługę zależności w konstruktorze
8. Zaktualizować metodę `getInstance`

### 4. CacheManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie `managers.storageManager`
6. Usunąć bezpośrednie użycie `managers.eventManager`
7. Poprawić inicjalizację w konstruktorze
8. Zaktualizować metodę `getInstance`

### 5. CounterManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 6. DataManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 7. DebugManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 8. ErrorHandler.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 9. EventManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 10. InitializationManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 11. InterfaceManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 12. LanguageManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 13. LoadingManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 14. LogManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 15. MenuManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 16. MessageManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 17. MetricsManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 18. NotificationManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 19. OperationProgressManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 20. OrderManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 21. RefreshManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 22. SettingsManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 23. StatusManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 24. StorageManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 25. StoreManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 26. ThemeManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 27. UIManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 28. UpdateManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 29. UserManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

### 30. VolumeManager.js
1. Usunąć import `managers`
2. Dodać statyczne pole `_registry`
3. Zaimplementować `setRegistry`
4. Zmienić zależności na stringi
5. Usunąć bezpośrednie użycie managerów
6. Poprawić inicjalizację w konstruktorze
7. Zaktualizować metodę `getInstance`

## Kolejność refaktoryzacji:

1. BaseManager.js (jako podstawa dla wszystkich managerów)
2. managers.js (centralna klasa rejestru)
3. ErrorHandler.js (krytyczny dla obsługi błędów)
4. LogManager.js (krytyczny dla logowania)
5. EventManager.js (krytyczny dla komunikacji)
6. StorageManager.js (krytyczny dla persystencji)
7. Pozostałe managery w kolejności alfabetycznej

## Uwagi:
- Każdy manager powinien być testowany po zmianach
- Zmiany powinny być wprowadzane stopniowo
- Należy zachować kompatybilność wsteczną
- Należy zaktualizować dokumentację po zmianach
- Należy sprawdzić wpływ zmian na wydajność
- Należy zaktualizować testy jednostkowe 