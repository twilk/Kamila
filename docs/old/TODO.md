# Zadanie: Implementacja zakładki MM (Magazyn-Magazyn)

## Cel
Stworzenie systemu automatycznego zarządzania przepływem towarów między sklepami w oparciu o zamówienia z Selly.

## Struktura zakładki
1. Sekcja "Wydania"
   - Lista tasków do spakowania towaru dla innych sklepów
   - Każdy task zawiera:
     - Kod produktu
     - Nazwę produktu
     - Sklep docelowy
     - Checkbox do oznaczenia wykonania
   - Przycisk do oznaczenia wykonania (na początku tylko mock z alertem)

2. Sekcja "Przyjęcia" (do zaimplementowania w przyszłości)
   - Lista oczekiwanych dostaw z innych sklepów

## Flow działania
1. Monitorowanie nowych zamówień
   - Endpoint: `/api/orders`
   - Częstotliwość sprawdzania: co 5 minut
   - Filtrowanie tylko nowych zamówień

2. Weryfikacja dostępności
   - Sprawdzenie stanu w sklepie docelowym
     - Endpoint: `/api/products/{id}/warehouses/{warehouse_id}`
   - Jeśli brak wystarczającej ilości:
     - Sprawdzenie innych sklepów
     - Endpoint: `/api/products/{id}/warehouses`
     - Wybór sklepu z największą dostępnością danego produktu

3. Generowanie tasków
   - Utworzenie zadania w sekcji "Wydania" dla sklepu źródłowego
   - Format taska:
     ```typescript
     interface MMTask {
       id: string;
       productCode: string;
       productName: string;
       quantity: number;
       sourceStore: string;
       targetStore: string;
       status: 'pending' | 'completed';
       createdAt: Date;
     }
     ```

## Pierwsza iteracja
1. Implementacja podstawowego UI
   - Zakładka MM z dwiema sekcjami
   - Lista tasków w sekcji "Wydania"
   - Podstawowa stylizacja zgodna z istniejącym designem

2. Integracja z API
   - Implementacja klienta API dla endpointów Selly
   - Obsługa autoryzacji
   - Proper error handling

3. Logika biznesowa
   - Implementacja algorytmu wyboru sklepu źródłowego
   - System kolejkowania tasków
   - Podstawowa obsługa statusów

4. Mock funkcjonalności
   - Alert "Tworzę plik" przy oznaczaniu taska jako wykonany
   - Przygotowanie struktury pod przyszłe rozszerzenia

## Kolejne kroki (do zaimplementowania później)
1. Pełna implementacja sekcji "Przyjęcia"
2. System powiadomień
3. Historia operacji
4. Raporty i statystyki
5. Integracja z systemem transportowym

## Uwagi techniczne
- Wykorzystać TypeScript strict mode
- Implementować proper error handling
- Dodać system cachowania odpowiedzi API
- Uwzględnić limity rate limitingu API
- Przygotować testy jednostkowe
- Dokumentować kod zgodnie z JSDoc

## Endpointy API
Base URL: `darwina.pl/api`

### Zamówienia
- GET `/api/orders` - lista zamówień
  - Parametry: status, date_from, date_to
  - Response: Lista zamówień z produktami

### Produkty
- GET `/api/products/{id}/warehouses` - stany magazynowe we wszystkich sklepach
- GET `/api/products/{id}/warehouses/{warehouse_id}` - stan w konkretnym sklepie

## Bezpieczeństwo
- Implementować proper CSP headers
- Zabezpieczyć komunikację z API
- Walidować wszystkie inputy
- Implementować system logowania błędów 