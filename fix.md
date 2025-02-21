<!-- INSTRUKCJA DLA AI:
Ten plik fix.md służy jako centralny dokument podsumowujący plan naprawy błędów inicjalizacji i zależności.
WAŻNE: Za każdym razem, gdy nowe informacje, zmiany lub ustalenia pojawiają się w trakcie naszej dyskusji, uzupełniaj i aktualizuj ten plik tak, aby zawierał najnowszy stan projektu oraz proponowane modyfikacje.
Instrukcja ta jest stała i musi być zachowana na początku pliku. Nigdy jej nie usuwaj ani nie modyfikuj w sposób, który usuwa istotę tej wiadomości.
W razie potrzeby, rozwijaj i aktualizuj dalsze sekcje dotyczące inicjalizacji, synchronizacji, zarządzania stanem menedżerów oraz rozwiązywania problemów zależności.
-->

## Plan naprawy błędów inicjalizacji i zależności 

Wprowadziłem podejście oparte o ManagerRegistry, które:

1. Umożliwia rejestrację oraz asynchroniczną inicjalizację menedżerów.
2. Usuwa bezpośrednie użycie statycznych singletonów (np. w ErrorHandler) i pozwala na lazy-loading zależności.
3. Rozwiązuje problemy z kolejnością inicjalizacji i circular dependencies.

### 1. Utworzenie ManagerRegistry

Plik: services/core/ManagerRegistry.js

```javascript
class ManagerRegistry {
  constructor() {
    this._managerClasses = new Map();
    this._instances = new Map();
  }

  register(name, ManagerClass) {
    this._managerClasses.set(name, ManagerClass);
  }

  async get(name) {
    if (this._instances.has(name)) return this._instances.get(name);
    if (!this._managerClasses.has(name)) {
      throw new Error(`Menedżer "${name}" nie został zarejestrowany`);
    }
    const ManagerClass = this._managerClasses.get(name);
    const instance = new ManagerClass(this);
    if (typeof instance.initialize === 'function') {
      await instance.initialize();
    }
    this._instances.set(name, instance);
    return instance;
  }

  async initializeAll() {
    for (const name of this._managerClasses.keys()) {
      await this.get(name);
    }
  }
}

export const managerRegistry = new ManagerRegistry();
```

### 2. Rejestracja menedżerów

Plik: services/core/managers.js

Zamiast korzystać z Proxy, rejestrujemy menedżery:

```javascript
import { managerRegistry } from './ManagerRegistry.js';
import { DataManager } from '../DataManager.js';
import { OrderService } from '../../api/OrderService.js';
// ... inne importy

// Rejestracja menedżerów
managerRegistry.register('DataManager', DataManager);
managerRegistry.register('OrderService', OrderService);
// ... rejestracja pozostałych menedżerów

export { managerRegistry };
```

### 3. Modyfikacja menedżerów (np. ErrorHandler)

Przykład zmiany dla ErrorHandler:

```javascript
// Poprzednia wersja (z singletonem):
// class ErrorHandler extends BaseManager {
//   static #instance = null;
//   constructor() {
//     super('ErrorHandler');
//     if (ErrorHandler.#instance) return ErrorHandler.#instance;
//     ErrorHandler.#instance = this;
//   }
//   // ...
// }

// Nowa wersja: bez singletona, inicjalizacja odbywa się asynchronicznie
import { BaseManager } from './BaseManager.js';
export class ErrorHandler extends BaseManager {
  async initialize() {
    // Asynchroniczna inicjalizacja, np. pobranie zależności:
    // const someDep = await managerRegistry.get('SomeDependency');
  }
  // ... dalsza logika
}
```

### 4. Użycie menedżerów

Klient powinien uzyskiwać menedżery przy użyciu:

```javascript
import { managerRegistry } from './services/core/managers.js';

(async () => {
  const errorHandler = await managerRegistry.get('ErrorHandler');
  // dalsze użycie errorHandler
})();
```

### 5. Dalsze wnioski i przyszłe kroki

Jako senior developer śledczy, po ponownej analizie codebase'u zauważyłem następujące problemy i rozłączone funkcjonalności:

- Istnieją znaczące problemy z kolejnością inicjalizacji menedżerów, zwłaszcza w różnych kontekstach (background, popup, alarmy). Zdarzenia (np. chrome.alarms) często wywołują metody przed pełnym zakończeniem inicjalizacji, co prowadzi do błędów.
- Brak centralnego kontrolera stanu menedżerów. Konieczne jest wprowadzenie mechanizmu kolejkowania oraz state machine, która monitoruje stan postępu inicjalizacji i synchronizuje dostęp między różnymi kontekstami.
- Zauważono występowanie race conditions i dynamicznych zależności, co skutkuje rozłączonym działaniem niektórych funkcjonalności oraz duplikacją logiki w różnych częściach aplikacji.
- Obecne podejście oparte wyłącznie na ManagerRegistry rozwiązuje część problemów, ale wymaga uzupełnienia o globalny system synchronizacji stanów. Można rozważyć implementację komunikacji między kontekstami (np. za pomocą komunikatów lub wspólnego kontrolera stanu), aby upewnić się, że każdy fragment aplikacji korzysta z poprawnie zainicjalizowanych menedżerów.
- Dodatkowo, brakuje mechanizmów odzyskiwania po błędach (retry logic) oraz dynamicznej weryfikacji zależności, co zwiększa podatność na błędy podczas inicjalizacji.

#### Przyszłe kroki:
1. Implementacja mechanizmu kolejkowania inicjalizacji i globalnej synchronizacji stanów menedżerów, aby uniknąć wywoływania metod przed zakończeniem pełnej inicjalizacji.
2. Rozszerzenie testów jednostkowych i integracyjnych, szczególnie dla krytycznych ścieżek inicjalizacji i obsługi zdarzeń (np. alarms, popup).
3. Modyfikacja obsługi zdarzeń tak, aby każda akcja czekała na potwierdzenie pełnej inicjalizacji systemu (np. poprzez wywołanie managerRegistry.initializeAll()).
4. Wdrożenie mechanizmów odzyskiwania po błędach, w tym retry logic dla inicjalizacji menedżerów oraz dynamicznej weryfikacji zależności.

Te działania mają na celu ujednolicenie architektury inicjalizacji, wyeliminowanie race conditions oraz odzyskanie spójności i stabilności aplikacji.

### Podsumowanie

- Wywołaj "managerRegistry.initializeAll()" przy starcie aplikacji, aby upewnić się, że wszystkie menedżery są poprawnie zainicjalizowane.
- Podejście to eliminuje problem wczesnego dostępu do niezainicjalizowanych instancji oraz upraszcza zarządzanie zależnościami.

To rozwiązanie powinno znacząco poprawić działanie aplikacji. Jeśli potrzebujesz dalszych zmian krok po kroku, daj znać.

### 6. Nowa analiza codebase

Po przeprowadzeniu kolejnej, dogłębnej analizy codebase'u, zauważyłem dodatkowe aspekty i problemy do rozwiązania:

- Istnieje znaczące mieszanie kodu inicjalizacyjnego pomiędzy różnymi kontekstami (background, popup, alarmy, itp.), co powoduje, że niektóre moduły mogą być inicjalizowane wielokrotnie lub w niewłaściwej kolejności.
- Pomimo implementacji ManagerRegistry, nie wszystkie części systemu korzystają z centralnego rejestru, co skutkuje powstawaniem izolowanych instancji i duplikacją logiki inicjalizacyjnej.
- Występują resztki starego wzorca singleton, które mogą kolidować z nową architekturą, szczególnie w module ErrorHandler, a także potencjalnie w innych menedżerach.
- Dodatkowo, circular dependencies nadal mogą występować w komponentach, których nie zostały jeszcze odpowiednio zrefaktoryzowane, co może powodować problemy z ładowaniem modułów.
- W systemie event handlingu, szczególnie przy wywołaniach przez chrome.alarms oraz w popup, brakuje mechanizmów blokujących wykonywanie logiki do czasu zakończenia pełnej inicjalizacji systemu.
- W obecnej konfiguracji nie ma centralnego mechanizmu synchronizacji stanu, co powoduje race conditions podczas równoczesnego dostępu do menedżerów.

#### Rekomendacje:

1. Dokładne przejrzenie wszystkich miejsc wywołujących inicjalizację menedżerów i zapewnienie, że korzystają one z ManagerRegistry.
2. Rozważenie migracji pozostałych wzorców singleton na mechanizm lazy-loading za pośrednictwem ManagerRegistry.
3. Wdrożenie centralnego kontrolera stanu (StateController) dla wszystkich menedżerów – może to być rozszerzenie ManagerRegistry lub dedykowany moduł, który zapewni synchroniczne inicjalizowanie oraz globalną synchronizację.
4. Dodanie mechanizmów oczekiwania (wait-for-ready) oraz retry logic przy inicjalizacji, szczególnie na modułach krytycznych związanych z event handlingiem.
5. Rozbudowa testów integracyjnych i scenariuszy inicjalizacyjnych, aby wychwycić wszystkie ew. race conditions oraz błędy przy wielokrotnym ładowaniu zmiennych kontekstowych.

Implementacja tych zaleceń powinna znacząco poprawić stabilność i spójność działania aplikacji. 

### 6.1 Dodatkowe obserwacje
W systemie inicjalizacji widoczna jest tendencja, że moduły dostępne w różnych kontekstach (background, popup, alarmy) często tworzą własne instancje zamiast korzystać z centralnego ManagerRegistry – należy ujednolicić inicjalizację na poziomie całego systemu.
Dynamiczne zależności między menedżerami nie są w pełni kontrolowane. Część menedżerów nie weryfikuje, czy ich zależności (np. w formie innych menedżerów) są już w pełni zainicjalizowane, co może prowadzić do race conditions i błędów podczas wykonywania logiki.
Resztki starego wzorca singleton nadal mogą wpływać na stabilność, szczególnie w przypadkach, gdzie nie wszystkie moduły zostały już zmigrowane do podejścia opartego na lazy-loading przy użyciu ManagerRegistry.
Konfiguracja importów i zależności między modułami pozostawia potencjalne miejsca na pojawienie się circular dependencies, które trzeba przeglądnąć i ewentualnie usunąć.
System event handlingu (np. dla chrome.alarms czy w module popup) powinien zostać zmodyfikowany tak, aby każda akcja czekała na pełne zakończenie inicjalizacji krytycznych menedżerów – implementacja mechanizmu blokad (wait-for-ready) powinna być rozważona.
Mechanizmy logowania oraz testy jednostkowe/integracyjne muszą zostać rozbudowane i dostosowane do nowej architektury inicjalizacyjnej, aby upewnić się, że wszystkie scenariusze (wielokrotny dostęp, context switching) są odpowiednio pokryte.