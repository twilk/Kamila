// Adres endpointu Make.com (zmień na swój):
const webhookUrl = 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk';

// Elementy z popup.html
const queryInput = document.getElementById('query');
const responseDiv = document.getElementById('response');
const sendButton = document.getElementById('send');

// TODO: W przyszłości dodać funkcję inicjalizującą wtyczkę i sprawdzającą autoryzację przy starcie.
//       Np. po załadowaniu popupu wywołać checkAuthStatus() i w zależności od wyniku:
//       - pozwolić zadawać pytania
//       - lub poprosić o login/hasło

sendButton.addEventListener('click', async () => {
  const query = queryInput.value.trim();
  if (!query) {
    responseDiv.textContent = 'Proszę wpisać pytanie.';
    return;
  }

  responseDiv.textContent = 'Wysyłam zapytanie...';

  // TODO: Sprawdzić autoryzację użytkownika przed wysłaniem zapytania (funkcjonalność autoryzacji powinna być gotowa wcześniej)
  // Jeśli brak autoryzacji, wyświetl komunikat i przerwij.
  
  const data = await fetchData(query);
  renderResponse(data);
});

/**
 * Sprawdza status autoryzacji użytkownika.
 * TODO:
 * - Najpierw potrzebne jest wdrożenie endpointu sprawdzającego zalogowanie na darwina.weblucy.com.
 * - Funkcja powinna zwracać true/false w zależności od statusu.
 * - Priorytet: wysoki, ponieważ bez autoryzacji nie chcemy udostępniać danych.
 */
async function checkAuthStatus() {
  // TODO: Wywołaj endpoint sprawdzający zalogowanie
  // const response = await fetch('https://darwina.weblucy.com/api/auth/status', { credentials: 'include' });
  // TODO: Przetwórz wynik, zwróć true/false
  // return true lub false
  return true; // Placeholder
}

/**
 * Wysyła zapytanie do Make.com z parametrem `req` i zwraca przetworzone dane.
 * TODO:
 * - Dodać obsługę błędów, jeśli serwer nie zwróci poprawnych danych.
 * - Priorytet: średni, bo podstawowa wersja już działa, ale obsługa błędów jest kluczowa przed wdrożeniem.
 * @param {string} query - Zapytanie wpisane przez użytkownika.
 * @returns {object} - Odpowiedź z API w formacie JSON.
 */
async function fetchData(query) {
  try {
    const url = `${webhookUrl}?req="${encodeURIComponent(query)}"`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      // TODO: Obsługa różnych kodów błędów, np. 401 (nieautoryzowany), 500 (błąd serwera), etc.
      return { error: 'Błąd: ' + response.status };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    // TODO: Lepsza obsługa błędów sieciowych, retry lub komunikat dla użytkownika.
    return { error: 'Błąd połączenia: ' + error.message };
  }
}

/**
 * Wyświetla odpowiedź w okienku wtyczki.
 * TODO:
 * - Jeśli odpowiedź zawiera Markdown lub HTML, rozważyć parsowanie i ładniejsze renderowanie.
 * - Jeśli odpowiedź to JSON z danymi leadów lub stanami magazynowymi, dodać funkcje formatowania.
 * - Priorytet: średni, dopiero po tym, jak upewnimy się, że komunikacja i autoryzacja działa.
 * @param {object} data - Dane zwrócone przez fetchData().
 */
function renderResponse(data) {
  if (data.error) {
    responseDiv.textContent = data.error;
    return;
  }
  // Na razie prosto: wyświetlamy JSON
  responseDiv.textContent = JSON.stringify(data, null, 2);
}

// TODO: Funkcja do pobrania leadów z Selly
//       Wymaga wcześniej w scenariuszu Make.com obsługi zapytań typu "pokaż leady".
//       Priorytet: niski na początku, bo musimy najpierw zapewnić autoryzację i podstawowy przepływ.
async function fetchLeads() {
  // TODO: W przyszłości: wysłać zapytanie do Make.com z parametrem typu "?req=lead" i zinterpretować wynik.
}

// TODO: Funkcja do pobrania dostępności towaru
//       Będziemy musieli w scenariuszu Make.com połączyć się z PC-Market i zwrócić wynik.
//       Priorytet: średni, po wdrożeniu autoryzacji i podstawowego Q&A.
async function checkProductAvailability(productName) {
  // TODO: W Make.com stworzyć logikę do wysłania zapytania do bazy i przetworzyć wynik przez OpenAI.
  // TODO: Tutaj tylko wywołaj fetchData z odpowiednim zapytaniem i sformatuj wyniki w renderResponse.
}

// TODO: Funkcja do generowania raportów i analiz
//       Priorytet: niski, funkcja zaawansowana, do wdrożenia później
async function generateReports(reportType) {
  // TODO: W przyszłości: rozbudowana logika promptów do OpenAI + dane z Google Sheets/Notion.
}

// TODO: Funkcja inicjalizacyjna (init)
//       Priorytet: średni
//       - sprawdzi autoryzację
//       - jeśli brak, poprosi o zalogowanie lub hasło
//       - w przeciwnym razie umożliwi zadawanie pytań.
async function init() {
  // TODO: checkAuthStatus, jeśli false → wyświetl komunikat lub poproś o hasło
  // Jeśli true → pozwól korzystać z fetchData(query)
}
