# Selly API Notes

## Kluczowe Informacje

### Autoryzacja
- Wszystkie endpointy wymagają autoryzacji OAUTH2 client_credentials
- Token dostępu musi być przekazywany w nagłówku Authorization

### Paginacja
Wspólne parametry dla endpointów z paginacją:
- `page` - numer strony (integer)
- `limit` - ilość rekordów na stronę (integer)

### Zamówienia
Endpoint: `/api/orders`

#### Parametry filtrowania:
- `status_id` - filtrowanie po statusach (string, np. "1,2,3,5")
- `limit` - ilość zamówień na stronę
- `page` - numer strony

#### Format odpowiedzi:
```json
{
  "data": [...],  // tablica zamówień
  "__metadata": {
    "page": 1,
    "per_page": 50,
    "page_count": 5,  // całkowita liczba stron
    "total_count": 240  // całkowita liczba zamówień
  }
}
```

### Statusy Zamówień
Endpoint: `/api/orders/statuses`

Standardowe statusy:
- 1 - Nowe
- 2 - Potwierdzone
- 3 - Przyjęte
- 5 - Gotowe do odbioru

### Ważne Uwagi
1. API zawsze zwraca dane w formacie:
   ```json
   {
     "data": [],  // właściwe dane
     "__metadata": {}  // metadane, paginacja
   }
   ```

2. Błędy zwracane są w formacie:
   ```json
   {
     "error": {
       "code": "...",
       "message": "..."
     }
   }
   ```

3. Kody odpowiedzi:
   - 200 - Sukces
   - 400 - Błędne zapytanie
   - 401 - Błąd autoryzacji
   - 500 - Błąd serwera

## Rekomendacje
1. Zawsze używać paginacji (limit + page)
2. Sprawdzać metadane odpowiedzi dla total_count i page_count
3. Obsługiwać potencjalne błędy autoryzacji (401)
4. Używać filtrowania po status_id dla optymalizacji 