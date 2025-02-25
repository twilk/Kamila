# Analiza problemu z licznikami - Raport

## 1. Obecny stan (z logów)

### Inicjalizacja
- ✅ Wszystkie managery są poprawnie zainicjalizowane
- ✅ CounterManager jest zarejestrowany i zainicjalizowany
- ✅ DataManager jest zainicjalizowany i pobiera dane

### Flow danych
1. DataManager pobiera dane:
```log
🔄 Getting order statuses {manager: 'order', storeId: 'ALL', forceRefresh: true}
📥 Received page 1/1 {manager: 'order', pageSize: 16, totalSoFar: 16, totalCount: 16}
📊 Calculated counts {manager: 'order', counts: {...}, byStatus: {...}}
✅ Data refresh complete {manager: 'DataManager', storeId: 'ALL', counts: {...}}
```

### Problemy
1. Błędy UI po załadowaniu:
```log
TypeError: this.getDependency(...).show is not a function
TypeError: this.getDependency(...).hide is not a function
```

## 2. Analiza kodu

### Stare rozwiązanie (OLDER_WORKING_SOLUTION)
1. Struktura HTML:
```html
<div class="lead-status" data-status="1">
    📤 <span class="lead-count" id="count-1">-</span>
</div>
```

2. Aktualizacja liczników:
- Bezpośrednia aktualizacja DOM przez CounterManager
- Nasłuchiwanie na event 'counters:updated'
- Mapowanie statusów 1:1 z data-status

### Nowe rozwiązanie
1. React Component (OrdersList):
```javascript
useEffect(() => {
  if (counts) {
    const dataManager = DataManager.getInstance();
    dataManager.refreshData({
      storeId: 'ALL',
      forceRefresh: true,
      counts
    });
  }
}, [counts]);
```

2. DataManager:
- Próbuje odświeżyć dane z nowymi counts
- Ale nie emituje bezpośrednio eventu 'counters:updated'

## 3. Zidentyfikowane problemy

1. Pętla w przepływie danych:
   - useOrders zwraca counts
   - OrdersList przekazuje te counts do DataManager.refreshData
   - DataManager próbuje pobrać nowe dane
   - To powoduje nowe counts
   - I tak w kółko

2. Brak bezpośredniej emisji eventu:
   - Stare rozwiązanie: CounterManager nasłuchuje na 'counters:updated'
   - Nowe rozwiązanie: Próbujemy użyć DataManager.refreshData zamiast emitować event

3. Różnice w strukturze danych:
   - Stare: Proste mapowanie statusów (1 -> count-1)
   - Nowe: Możliwe różnice w formacie counts

## 4. Proponowane rozwiązanie

1. Przywrócić bezpośrednią emisję eventu:
```javascript
useEffect(() => {
  if (counts) {
    const eventManager = EventManager.getInstance();
    eventManager.emit('counters:updated', {
      '1': counts['1'] || 0,
      '2': counts['2'] || 0,
      '3': counts['3'] || 0,
      'READY': counts['5_READY'] || 0,
      'OVERDUE': counts['5_OVERDUE'] || 0
    });
  }
}, [counts]);
```

2. Usunąć wywołanie DataManager.refreshData które powoduje pętlę

3. Upewnić się że format counts odpowiada oczekiwanemu przez CounterManager

## 5. Następne kroki

1. Sprawdzić format counts zwracany przez useOrders
2. Zweryfikować mapowanie statusów w CounterManager
3. Dodać logowanie w CounterManager.handleDataUpdate
4. Przetestować czy liczniki reagują na event 