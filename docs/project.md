# Projekt: Integracja Selly API i Generacja Plików Wymiany

## 1. Opis projektu

**Cel projektu:**  
Stworzenie aplikacji webowej, która:
- Pobiera nowe zamówienia oraz aktualne stany magazynowe z Selly REST API (adres: `darwina.pl/api`).
- Wyświetla listę próśb o spakowanie (dotyczy dwóch wybranych sklepów z 25) w prostej tabelce HTML.
- Na podstawie danych zamówienia (ilość i rodzaj produktów, informacja o wysyłce) dynamicznie buduje „requesty" – czyli dane, które później zostaną użyte do wypełnienia szablonu pliku wymiany.
- Po potwierdzeniu (poprzez kliknięcie checkboxa) generuje plik wymiany zgodnie z ustalonym szablonem i wysyła go na serwer FTP.

**Źródła danych i dokumentacja API:**
- Selly REST API – [dokumentacja Selly](https://www.selly.pl/rest-api/)
- Demo e-store API – [dokumentacja demo e-store](https://demo.e-store.pl/api/documentation)
- Adres używany w projekcie: `darwina.pl/api`

**Dane z zamówienia:**  
Zamówienie zawiera informacje o:
- Numerze zamówienia (ID),
- Sklepie (nazwa, identyfikator, np. `shopName`, `shopId`),
- Produktach (lista, gdzie każdy element zawiera: nazwa produktu, ilość, cena, EAN, identyfikator towaru, kategoria),
- Typie wysyłki (czy zamówienie dotyczy wysyłki).

**Dane o stanach magazynowych:**  
Choć dostępna była przykładowa kwerenda SQL, decydujemy się pobierać stan magazynowy z Selly API. Należy wykorzystać odpowiedni endpoint z dokumentacji Selly, który umożliwia pobranie aktualnych stanów produktów.

**Plik wymiany:**  
Plik, który ma być wysłany na FTP, posiada ustalony format – przykładowy szablon wygląda następująco:

```
"name": "RW_wydanie_{{17.properties_value.ID Grupy etykiet[].plain_text}}{{14.__IMTINDEX__}}", 
"content": "TypPolskichLiter:LA TypDok:RW NrDok:RW{{17.properties_value.ID Grupy etykiet[].plain_text}} Data:{{formatDate(now; "DD.MM.YYYY")}} Magazyn:{{17.properties_value.Ze sklepu - nazwa.string}} SposobPlatn:GOT TerminPlatn:0 IndeksCentralny:NIE NazwaWystawcy:Darwina.pl Retail Sp. z o.o AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa KodWystawcy:02-796 PocztaWystawcy: MiastoWystawcy:Warszawa UlicaWystawcy:W•wozowa 6/4B NrDomuWystawcy:6 NrLokaluWystawcy:4B NazwaUlicyWystawcy:W•wozowa GminaWystawcy:Warszawa PowiatWystawcy:Warszawa WojewodztwoWystawcy:mazowieckie KodKrajuWystawcy:PL NIPWystawcy:9512387656 BankWystawcy:mBank KontoWystawcy:50 1140 2004 0000 3102 7760 2647 TelefonWystawcy:+48 888 160 888 NrWystawcyWSieciSklepow:{{17.properties_value.MagId.array[].number}} WystawcaToCentralaSieci:0 NrWystawcyObcyWSieciSklepow: IloscLinii:1 Linia:Nazwa{{{29.Nazwa towaru}}}Kod{{{29.Kod EAN}}}Vat{23}Jm{szt}Asortyment{{{29.Nazwa asort}}}Sww{}PKWiU{}Ilosc{{{17.properties_value.Liczba szt.}}}Cena{n{{29.CenaEw}}}Wartosc{n{{formatNumber((17.properties_value.Liczba szt. * 29.CenaEw); 2; "."; emptystring)}}}IleWOpak{1}CenaSp{b{{formatNumber((17.properties_value.Liczba szt. * 29.CenaEw * 1.23); 2; "."; emptystring)}}}TowId{{{17.properties_value.ID Towaru.array[].number}}} Stawka:Vat{23}SumaNet{{{formatNumber((17.properties_value.Liczba szt. * 29.CenaEw); 2; "."; emptystring)}}}SumaVat{{{formatNumber((17.properties_value.Liczba szt. * 29.CenaEw * 1.23) - (17.properties_value.Liczba szt. * 29.CenaEw); 2; "."; emptystring)}}} DoZaplaty:{{formatNumber((17.properties_value.Liczba szt. * 29.CenaEw * 1.23); 2; "."; emptystring)}}"
```

Przykładowy gotowy plik:
- **Filename:** `RW_wydanie_HOK-OBR5954_1.txt`
- **Content:**
```
TypPolskichLiter:LA TypDok:RW NrDok:RW_HOK-OBR5954 Data:17.11.2024 Magazyn:HOK - Ursus SposobPlatn:GOT TerminPlatn:0 IndeksCentralny:NIE NazwaWystawcy:Darwina.pl Retail Sp. z o.o AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa KodWystawcy:02-796 PocztaWystawcy: MiastoWystawcy:Warszawa UlicaWystawcy:W•wozowa 6/4B NrDomuWystawcy:6 NrLokaluWystawcy:4B NazwaUlicyWystawcy:W•wozowa GminaWystawcy:Warszawa PowiatWystawcy:Warszawa WojewodztwoWystawcy:mazowieckie KodKrajuWystawcy:PL NIPWystawcy:9512387656 BankWystawcy:mBank KontoWystawcy:50 1140 2004 0000 3102 7760 2647 TelefonWystawcy:+48 888 160 888 NrWystawcyWSieciSklepow:25 WystawcaToCentralaSieci:0 NrWystawcyObcyWSieciSklepow: IloscLinii:1 Linia:Nazwa{Torba Zakupowa Foliowa 31x44}Kod{20005368}Vat{23}Jm{szt}Asortyment{OPAKOWANIA}Sww{}PKWiU{}Ilosc{1}Cena{n0.51}Wartosc{n0.51}IleWOpak{1}CenaSp{b0.63}TowId{8253} Stawka:Vat{23}SumaNet{0.51}SumaVat{0.12} DoZaplaty:0.63
```

## 2. Architektura rozwiązania

### A. Warstwa front-end (HTML + JavaScript)

1. **Widok (HTML):**
   - Prosty interfejs zawierający tabelę, gdzie każdy wiersz reprezentuje pojedynczą prośbę o spakowanie.
   - Kolumny: ID zamówienia, nazwa sklepu, lista produktów, informacja o wysyłce oraz checkbox do potwierdzenia pakowania.

2. **Logika w JavaScript:**
   - **Pobieranie danych:**  
     Przy starcie aplikacji (lub w cyklicznych odstępach czasu) wykonywane są zapytania do Selly API (np. `https://darwina.pl/api/orders` dla zamówień oraz endpoint dla stanów magazynowych).
   - **Generowanie dynamicznych requestów:**  
     Na podstawie danych z zamówienia (np. liczba produktów, typ wysyłki) budowany jest obiekt, który służy do wypełnienia szablonu pliku wymiany.
   - **Renderowanie tabeli:**  
     Dane pobrane z API są wykorzystywane do wypełnienia tabeli w HTML.
   - **Obsługa checkboxa:**  
     Po kliknięciu checkboxa:
     - Wywoływana jest funkcja generująca plik wymiany – szablon jest uzupełniany dynamicznymi danymi (data, numer zamówienia, dane sklepu, szczegóły linii zamówienia itp.).
     - Plik (nazwa i zawartość) jest przesyłany do backendu przy użyciu zapytania AJAX/fetch.

3. **Przykładowy kod front-endu:**

### HTML (index.html)
```html
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Prośby o pakowanie</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <h1>Lista próśb o pakowanie</h1>
  <table id="requestsTable">
    <thead>
      <tr>
        <th>ID zamówienia</th>
        <th>Sklep</th>
        <th>Produkty</th>
        <th>Wysyłka</th>
        <th>Spakowano</th>
      </tr>
    </thead>
    <tbody>
      <!-- Wiersze będą dynamicznie dodawane przez JavaScript -->
    </tbody>
  </table>
  
  <script src="app.js"></script>
</body>
</html>
```

### JavaScript (app.js)
```javascript
// Funkcja pobierająca zamówienia z API Selly
async function fetchOrders() {
  try {
    const response = await fetch('https://darwina.pl/api/orders');
    const orders = await response.json();
    return orders;
  } catch (error) {
    console.error('Błąd pobierania zamówień:', error);
    return [];
  }
}

// Funkcja pobierająca stan magazynowy dla danego produktu
async function fetchInventory(productId) {
  try {
    const response = await fetch(`https://darwina.pl/api/inventory/${productId}`);
    const inventory = await response.json();
    return inventory;
  } catch (error) {
    console.error('Błąd pobierania stanu magazynowego:', error);
    return null;
  }
}

// Funkcja generująca szablon pliku wymiany na podstawie zamówienia
function generateExchangeFile(order) {
  const data = new Date();
  const formattedDate = data.toLocaleDateString('pl-PL'); // Format: DD.MM.YYYY
  
  // Nazwa pliku generowana dynamicznie
  const filename = `RW_wydanie_${order.labelGroup}_${order.index}.txt`;
  
  // Treść pliku – uzupełnij dynamiczne dane na podstawie obiektu 'order'
  const content = `
TypPolskichLiter:LA
TypDok:RW
NrDok:RW_${order.labelGroup}
Data:${formattedDate}
Magazyn:${order.shopName}
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:W•wozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:W•wozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:W•wozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:${order.shopId}
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:${order.lines.length}
${order.lines.map(line => {
  const wartosc = (line.quantity * line.price).toFixed(2);
  const cenaSp = (line.quantity * line.price * 1.23).toFixed(2);
  return `Linia:Nazwa{${line.productName}}Kod{${line.ean}}Vat{23}Jm{szt}Asortyment{${line.category}}Sww{}PKWiU{}Ilosc{${line.quantity}}Cena{n${line.price}}Wartosc{n${wartosc}}IleWOpak{1}CenaSp{b${cenaSp}}TowId{${line.productId}}`;
}).join('\n')}
  `;
  
  return { filename, content };
}

// Funkcja wysyłająca wygenerowany plik na backend (który następnie umie uploadować na FTP)
async function uploadExchangeFile(fileData) {
  try {
    const response = await fetch('https://darwina.pl/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fileData)
    });
    return response.ok;
  } catch (error) {
    console.error('Błąd przesyłania pliku:', error);
    return false;
  }
}

// Funkcja renderująca zamówienia w tabeli
async function renderOrders() {
  const orders = await fetchOrders();
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = '';

  orders.forEach(order => {
    const tr = document.createElement('tr');
    
    // Komórka z ID zamówienia
    const tdId = document.createElement('td');
    tdId.textContent = order.id;
    
    // Komórka z nazwą sklepu
    const tdShop = document.createElement('td');
    tdShop.textContent = order.shopName;
    
    // Komórka z listą produktów
    const tdProducts = document.createElement('td');
    tdProducts.textContent = order.lines.map(line => `${line.productName} (x${line.quantity})`).join(', ');
    
    // Komórka z informacją o wysyłce
    const tdShipping = document.createElement('td');
    tdShipping.textContent = order.isShipping ? 'Tak' : 'Nie';
    
    // Komórka z checkboxem do potwierdzenia spakowania
    const tdPacked = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', async (e) => {
      if (e.target.checked) {
        // Generujemy plik wymiany i wysyłamy go na FTP
        const fileData = generateExchangeFile(order);
        const success = await uploadExchangeFile(fileData);
        if (success) {
          alert(`Plik ${fileData.filename} został przesłany na FTP.`);
        } else {
          alert('Wystąpił błąd podczas wysyłki pliku.');
        }
      }
    });
    tdPacked.appendChild(checkbox);
    
    tr.append(tdId, tdShop, tdProducts, tdShipping, tdPacked);
    tbody.appendChild(tr);
  });
}

// Inicjalizacja – po załadowaniu strony renderujemy zamówienia
document.addEventListener('DOMContentLoaded', () => {
  renderOrders();
});
```

### B. Warstwa back-end

Główne zadania backendu:

1. **Endpoint do uploadu:**
   - Utworzyć endpoint (np. `/api/upload`), który przyjmie przesłany z front-endu obiekt zawierający nazwę i zawartość pliku.

2. **Upload na FTP:**
   - Po otrzymaniu danych z front-endu, backend łączy się z serwerem FTP i przesyła plik.
   - Wybór technologii (Node.js, PHP, Python, itp.) zależy od Twoich preferencji.

3. **Opcjonalnie - Proxy do API Selly:**
   - Możesz stworzyć endpoint, który pośredniczy w wywołaniach do Selly API, aby ukryć klucze API oraz poprawić obsługę błędów.

Przykładowy szkic backendu (Node.js z Express i pakietem ftp):

```javascript
// Przykładowy endpoint upload w Node.js z Express
const express = require('express');
const bodyParser = require('body-parser');
const ftp = require('ftp');

const app = express();
app.use(bodyParser.json());

app.post('/api/upload', (req, res) => {
  const { filename, content } = req.body;
  
  // Konfiguracja połączenia FTP – uzupełnij odpowiednimi danymi
  const ftpClient = new ftp();
  ftpClient.on('ready', () => {
    ftpClient.put(Buffer.from(content), filename, (err) => {
      if (err) {
        console.error('Błąd przesyłania pliku na FTP:', err);
        res.status(500).json({ success: false });
      } else {
        res.json({ success: true });
      }
      ftpClient.end();
    });
  });
  
  // Połącz się z FTP – dane logowania należy umieścić w konfiguracji
  ftpClient.connect({
    host: 'ftp.twojadomena.pl',
    user: 'ftp_user',
    password: 'ftp_password'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Backend nasłuchuje na porcie ${port}`);
});
```

## 3. Harmonogram i kolejne kroki wdrożenia

### Krok 1: Przygotowanie projektu
1. **Dokumentacja i planowanie:**
   - Zbierz pełną dokumentację API Selly i demo e-store
   - Ustal endpointy (np. `/orders`, `/inventory/{id}`) oraz wymagania dotyczące autoryzacji
   - Stwórz repozytorium kodu (np. GitHub, GitLab) oraz przygotuj strukturę projektu (oddzielny folder dla front-endu, oddzielny dla backendu)

### Krok 2: Implementacja front-endu
1. **Tworzenie interfejsu:**
   - Utwórz stronę HTML z tabelą, korzystając z przykładowego kodu (index.html, app.js)
2. **Logika aplikacji:**
   - Zaimplementuj logikę pobierania zamówień z API
   - Generowanie dynamicznych requestów
   - Obsługa zdarzenia checkbox (potwierdzanie pakowania)
3. **Testowanie:**
   - Testuj wyświetlanie danych i generowanie dynamicznych szablonów plików

### Krok 3: Implementacja back-endu
1. **Endpoint upload:**
   - Stwórz endpoint do odbierania danych z front-endu (np. `/api/upload`)
2. **Upload na FTP:**
   - Zaimplementuj mechanizm przesyłania pliku na serwer FTP
   - Skonfiguruj połączenie FTP i przetestuj operację
3. **Opcjonalnie - Proxy API:**
   - Rozważ stworzenie endpointu pośredniczącego w wywołaniach do API Selly
   - Zabezpiecz klucze API
4. **Testowanie komunikacji:**
   - Przetestuj integrację między front-endem a back-endem

### Krok 4: Testowanie i wdrożenie
1. **Testy integracyjne:**
   - Przeprowadź testy integracyjne całego systemu:
     - Pobieranie zamówień
     - Generowanie plików
     - Upload na FTP
2. **Optymalizacja:**
   - Wprowadź niezbędne poprawki
   - Zabezpieczenia (walidacja danych, logowanie błędów)
   - Optymalizacja
3. **Wdrożenie:**
   - Wdróż rozwiązanie na środowisko produkcyjne

## 4. Podsumowanie

### Główna funkcjonalność:
Aplikacja webowa pobiera zamówienia oraz stany magazynowe z Selly API, wyświetla je w tabeli, a po potwierdzeniu pakowania generuje i wysyła na FTP plik wymiany zgodnie z ustalonym szablonem.

### Technologie:
- Front-end: HTML, JavaScript (fetch API)
- Back-end: Wybrana technologia (np. Node.js/Express) do uploadu na FTP oraz opcjonalnie proxy API

### Integracja z API:
- Wykorzystanie endpointów Selly API (zgodnie z dokumentacją) do pobierania zamówień oraz stanów magazynowych.

### Szablon pliku wymiany:
- Dynamiczne wstawianie danych (data, nazwa sklepu, dane produktów) do szablonu, który następnie jest przesyłany na FTP.

### Proces wdrożenia:
Planowanie → Implementacja front-endu → Implementacja back-endu → Testy integracyjne → Wdrożenie produkcyjne