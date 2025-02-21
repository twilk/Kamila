# Projekt: Integracja Selly API i Generacja Plików Wymiany

## 1. Opis projektu

**Cel projektu:**  
Stworzenie aplikacji webowej, która:
- Pobiera nowe zamówienia oraz aktualne stany magazynowe z Selly REST API (adres: `darwina.pl/api`).
- Wyświetla listę próśb o spakowanie (dotyczy dwóch wybranych sklepów z 25) w prostej tabelce HTML.
- Na podstawie danych zamówienia (ilość i rodzaj produktów, informacja o wysyłce) dynamicznie buduje „requesty” – czyli dane, które później zostaną użyte do wypełnienia szablonu pliku wymiany.
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

**Format zawartości pliku:**
```
TypPolskichLiter:LA
TypDok:[RW/PW]
NrDok:[RW/PW]_[ID Grupy etykiet]
Data:[DD.MM.YYYY]
Magazyn:[Nazwa sklepu]
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:Wąwozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:Wąwozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:Wąwozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:9
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:1
Linia:Nazwa{Torba Zakupowa Foliowa 31x44}Kod{20005368}Vat{23}Jm{szt}Asortyment{OPAKOWANIA}Sww{}PKWiU{}Ilosc{1}Cena{n0.51}Wartosc{n0.51}IleWOpak{1}CenaSp{b0.63}TowId{8253}
Stawka:Vat{23}SumaNet{0.51}SumaVat{0.12}
DoZaplaty:0.63
```

**Przykład pliku przyjęcia (PW):**
```
TypPolskichLiter:LA
TypDok:PW
NrDok:PW_HOK-OBR5954
Data:17.11.2024
Magazyn:OBR - Obrzeżna 7A_U1
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:Wąwozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:Wąwozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:Wąwozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:9
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:1
Linia:Nazwa{Torba Zakupowa Foliowa 31x44}Kod{20005368}Vat{23}Jm{szt}Asortyment{OPAKOWANIA}Sww{}PKWiU{}Ilosc{1}Cena{n0.51}Wartosc{n0.51}IleWOpak{1}CenaSp{b0.63}TowId{8253}
Stawka:Vat{23}SumaNet{0.51}SumaVat{0.12}
DoZaplaty:0.63
```


---

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

<script>
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

// Funkcja generująca szablon pliku wymiany na podstawie zamówienia
async function generateFile(type, id) {
    const isWydanie = type === 'wydanie';
    const prefix = isWydanie ? 'RW' : 'PW';
    const operationType = isWydanie ? 'wydanie' : 'przyjecie';
    const data = await this.fetchData(`/api/${type}/${id}`);
    
    const fileName = `${prefix}_${operationType}_${data.labelGroupId}_${data.imtIndex}.txt`;
    const content = `TypPolskichLiter:LA
TypDok:${prefix}
NrDok:${prefix}_${data.labelGroupId}
Data:${data.formattedDate}
Magazyn:${data.shopName}
SposobPlatn:GOT
TerminPlatn:0
IndeksCentralny:NIE
NazwaWystawcy:Darwina.pl Retail Sp. z o.o
AdresWystawcy:Wąwozowa 6/4B, 02-796 Warszawa
KodWystawcy:02-796
PocztaWystawcy:
MiastoWystawcy:Warszawa
UlicaWystawcy:Wąwozowa 6/4B
NrDomuWystawcy:6
NrLokaluWystawcy:4B
NazwaUlicyWystawcy:Wąwozowa
GminaWystawcy:Warszawa
PowiatWystawcy:Warszawa
WojewodztwoWystawcy:mazowieckie
KodKrajuWystawcy:PL
NIPWystawcy:9512387656
BankWystawcy:mBank
KontoWystawcy:50 1140 2004 0000 3102 7760 2647
TelefonWystawcy:+48 888 160 888
NrWystawcyWSieciSklepow:${data.shopId}
WystawcaToCentralaSieci:0
NrWystawcyObcyWSieciSklepow:
IloscLinii:${data.lines.length}
${data.lines.map(line => {
  const wartosc = (line.quantity * line.price).toFixed(2);
  const cenaSp = (line.quantity * line.price * 1.23).toFixed(2);
  return `Linia:Nazwa{${line.productName}}Kod{${line.ean}}Vat{23}Jm{szt}Asortyment{${line.category}}Sww{}PKWiU{}Ilosc{${line.quantity}}Cena{n${line.price}}Wartosc{n${wartosc}}IleWOpak{1}CenaSp{b${cenaSp}}TowId{${line.productId}}`;
}).join('\n')}
  `;
  
  return { fileName, content };
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
        const fileData = await generateFile('wydanie', order.id);
        const success = await uploadExchangeFile(fileData);
        if (success) {
          alert(`Plik ${fileData.fileName} został przesłany na FTP.`);
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
</script>



B. Warstwa back-end
Główne zadania backendu:

**Endpoint do uploadu:**
- Utworzyć endpoint (np. /api/upload), który przyjmie przesłany z front-endu obiekt zawierający nazwę i zawartość pliku.

**Upload na FTP:**
- Po otrzymaniu danych z front-endu, backend łączy się z serwerem FTP i przesyła plik. Wybór technologii (Node.js, PHP, Python, itp.) zależy od Twoich preferencji.

**(Opcjonalnie) Proxy do API Selly:**
- Możesz stworzyć endpoint, który pośredniczy w wywołaniach do Selly API, aby ukryć klucze API oraz poprawić obsługę błędów.

**Przykładowy szkic backendu (Node.js z Express i pakietem ftp):**

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

3. Harmonogram i kolejne kroki wdrożenia

#### Krok 1: Przygotowanie projektu
**Dokumentacja i planowanie:**
- Zbierz pełną dokumentację API Selly i demo e-store, ustal endpointy (np. /orders, /inventory/{id}) oraz wymagania dotyczące autoryzacji.
- Stwórz repozytorium kodu (np. GitHub, GitLab) oraz przygotuj strukturę projektu (oddzielny folder dla front-endu, oddzielny dla backendu).

#### Krok 2: Implementacja front-endu
**Tworzenie interfejsu:**
- Utwórz stronę HTML z tabelą, korzystając z przykładowego kodu (index.html, app.js).

**Logika aplikacji:**
- Zaimplementuj logikę pobierania zamówień z API, generowania dynamicznych requestów oraz obsługi zdarzenia checkbox (potwierdzanie spakowania).

**Testowanie:**
- Testuj wyświetlanie danych i generowanie dynamicznych szablonów plików.

#### Krok 3: Implementacja back-endu
**Endpoint upload:**
- Stwórz endpoint do odbierania danych z front-endu (np. /api/upload).

**Upload na FTP:**
- Zaimplementuj mechanizm przesyłania pliku na serwer FTP. Skonfiguruj połączenie FTP i przetestuj operację.

**(Opcjonalnie) Proxy API:**
- Rozważ stworzenie endpointu pośredniczącego w wywołaniach do API Selly, aby zabezpieczyć klucze API.

**Testowanie komunikacji:**
- Przetestuj integrację między front-endem a back-endem.

#### Krok 4: Testowanie i wdrożenie
**Testy integracyjne:**
- Przeprowadź testy integracyjne całego systemu: pobieranie zamówień, generowanie plików, upload na FTP.

**Optymalizacja:**
- Wprowadź niezbędne poprawki, zabezpieczenia (walidacja danych, logowanie błędów) i optymalizację.

**Wdrożenie:**
- Wdróż rozwiązanie na środowisko produkcyjne.

### 4. Podsumowanie

**Główna funkcjonalność:**
- Aplikacja webowa pobiera zamówienia oraz stany magazynowe z Selly API, wyświetla je w tabeli, a po potwierdzeniu pakowania generuje i wysyła na FTP plik wymiany zgodnie z ustalonym szablonem.

**Technologie:**
- Front-end: HTML, JavaScript (fetch API)
- Back-end: Wybrana technologia (np. Node.js/Express) do uploadu na FTP oraz opcjonalnie proxy API

**Integracja z API:**
- Wykorzystanie endpointów Selly API (zgodnie z dokumentacją) do pobierania zamówień oraz stanów magazynowych.

**Szablon pliku wymiany:**
- Dynamiczne wstawianie danych (data, nazwa sklepu, dane produktów) do szablonu, który następnie jest przesyłany na FTP.

**Proces wdrożenia:**
- Planowanie → Implementacja front-endu → Implementacja back-endu → Testy integracyjne → Wdrożenie produkcyjne

## 5. Specyfikacja techniczna

### 5.1 Error Handling

**API Retry Policy:**
```javascript
const axiosRetry = require('axios-retry');
const axios = require('axios');

// Konfiguracja retry policy
axiosRetry(axios, { 
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // 1s, 2s, 3s
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) 
      || error.response?.status === 429; // rate limit
  }
});
```

**Circuit Breaker:**
```javascript
const CircuitBreaker = require('opossum');

const breaker = new CircuitBreaker(asyncFunctionToProtect, {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
});

breaker.fallback(() => ({ error: 'Service unavailable' }));
```

**Centralne logowanie:**
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

// Middleware dla Express
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### 5.2 Security

**JWT Auth:**
```javascript
const jwt = require('jsonwebtoken');

// Middleware autoryzacji
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuta
  max: 100 // limit requestów
});

app.use(limiter);
```

**Secrets Management:**
```javascript
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

const credential = new DefaultAzureCredential();
const vaultName = process.env.KEYVAULT_NAME;
const url = `https://${vaultName}.vault.azure.net`;

const client = new SecretClient(url, credential);

// Pobieranie secretów
async function getSecrets() {
  const ftpPassword = await client.getSecret('ftp-password');
  const apiKey = await client.getSecret('selly-api-key');
  return { ftpPassword, apiKey };
}
```

### 5.3 Monitoring

**Health Check:**
```javascript
const health = require('@cloudnative/health-connect');
const healthcheck = new health.HealthChecker();

// Dodanie checków
healthcheck.registerLivenessCheck(new health.LivenessCheck("basic"));
healthcheck.registerReadinessCheck(
  new health.MongoDBHealthCheck(mongoClient)
);

app.use('/live', health.LivenessEndpoint(healthcheck));
app.use('/ready', health.ReadinessEndpoint(healthcheck));
```

**Metrics:**
```javascript
const prometheus = require('prom-client');
const collectDefaultMetrics = prometheus.collectDefaultMetrics;

// Custom metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 500]
});

// Middleware dla metryk
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route.path, res.statusCode)
      .observe(duration);
  });
  next();
});
```

### 5.4 Data Validation

**Request Validation:**
```javascript
const Joi = require('joi');

const orderSchema = Joi.object({
  orderId: Joi.string().required(),
  shopId: Joi.string().required(),
  products: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      price: Joi.number().precision(2).positive().required()
    })
  ).min(1).required()
});

// Middleware walidacji
const validateOrder = (req, res, next) => {
  const { error } = orderSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
```

### 5.5 File Generation Idempotency

```javascript
const crypto = require('crypto');

// Generowanie unikalnego ID dla operacji
function generateOperationId(order) {
  return crypto
    .createHash('md5')
    .update(`${order.id}_${order.timestamp}`)
    .digest('hex');
}

// Cache już wygenerowanych plików
const fileCache = new Map();

async function generateFile(order) {
  const operationId = generateOperationId(order);
  
  if (fileCache.has(operationId)) {
    return fileCache.get(operationId);
  }

  const fileContent = await createFileContent(order);
  fileCache.set(operationId, fileContent);
  
  return fileContent;
}
```

## 6. Test Strategy

### 6.1 Test Cases

```javascript
describe('Order Processing', () => {
  // Happy Path
  test('should process valid order successfully', async () => {
    const order = createValidOrder();
    const result = await processOrder(order);
    expect(result.status).toBe('success');
  });

  // Edge Cases
  test('should handle empty product list', async () => {
    const order = createOrderWithNoProducts();
    await expect(processOrder(order)).rejects.toThrow();
  });

  // Error Scenarios
  test('should retry on FTP failure', async () => {
    mockFTPFailure();
    const order = createValidOrder();
    const result = await processOrder(order);
    expect(ftpClient.retryCount).toBe(3);
  });
});
```

### 6.2 Performance Tests

```javascript
const autocannon = require('autocannon');

async function runLoadTest() {
  const result = await autocannon({
    url: 'http://localhost:3000/api/orders',
    connections: 100,
    duration: 30,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  console.log(result.latency);
  console.log(result.throughput);
}
```

### 6.3 Recovery Procedures

```javascript
// Przykład procedury recovery dla FTP
async function uploadWithRecovery(file) {
  try {
    await ftpUpload(file);
  } catch (error) {
    // Zapisz do local storage
    await saveToLocalStorage(file);
    
    // Zaplanuj ponowną próbę
    await scheduleRetry({
      fileId: file.id,
      attempts: 0,
      maxAttempts: 5,
      delay: 5 * 60 * 1000 // 5 minut
    });
    
    // Powiadom monitoring
    await notifyMonitoring({
      type: 'FTP_FAILURE',
      fileId: file.id,
      error: error.message
    });
  }
}
```

## 7. Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - SENTRY_DSN=${SENTRY_DSN}
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```
