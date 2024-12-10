// Adres endpointu Make.com (zmień na swój):
const webhookUrl = 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk';

// Elementy z popup.html
const queryInput = document.getElementById('query');
const responseDiv = document.getElementById('response');
const sendButton = document.getElementById('send');
const flagElements = document.querySelectorAll('.flag'); // Flagi językowe

// Funkcja inicjalizująca wtyczkę
document.addEventListener('DOMContentLoaded', async () => {
  const preferredLanguage = localStorage.getItem('language') || 'polish'; // Domyślny język
  await setLanguage(preferredLanguage); // Ładujemy tłumaczenia

  // Obsługa kliknięcia flag
  flagElements.forEach(flag => {
    flag.addEventListener('click', async () => {
      const selectedLanguage = flag.getAttribute('data-lang');
      await setLanguage(selectedLanguage);
    });
  });
});

// Funkcja ustawiania języka
async function setLanguage(lang) {
  localStorage.setItem('language', lang); // Zapisz wybór w localStorage
  await loadTranslations(lang); // Wczytaj tłumaczenia
}

// Funkcja ładowania tłumaczeń
async function loadTranslations(lang = 'polish') {
  try {
    const response = await fetch(`locales/${lang}.json`);
    if (!response.ok) throw new Error('Błąd ładowania tłumaczeń');

    const translations = await response.json();

    // Aktualizacja interfejsu
    document.getElementById('welcome-message').innerText = translations.welcome;
    queryInput.placeholder = translations.queryPlaceholder;
    sendButton.innerText = translations.sendButton;
    document.getElementById('response-label').innerText = translations.responseLabel;
  } catch (error) {
    console.error('Błąd podczas ładowania tłumaczeń:', error);
  }
}

// Obsługa kliknięcia przycisku wysyłania zapytania
sendButton.addEventListener('click', async () => {
  const query = queryInput.value.trim();
  if (!query) {
    responseDiv.textContent = 'Proszę wpisać pytanie.';
    return;
  }

  responseDiv.textContent = 'Wysyłam zapytanie...';

  const data = await fetchData(query);
  renderResponse(data);
});

/**
 * Sprawdza status autoryzacji użytkownika.
 * TODO:
 * - Wdrożyć endpoint sprawdzający zalogowanie na darwina.weblucy.com.
 * - Zwraca true/false w zależności od statusu.
 */
async function checkAuthStatus() {
  // TODO: Wywołaj endpoint sprawdzający zalogowanie
  // const response = await fetch('https://darwina.weblucy.com/api/auth/status', { credentials: 'include' });
  // return response.ok;
  return true; // Placeholder
}

/**
 * Wysyła zapytanie do Make.com z parametrem `req` i zwraca przetworzone dane.
 */
async function fetchData(query) {
  try {
    const url = `${webhookUrl}?req="${encodeURIComponent(query)}"`;
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return { error: 'Błąd: ' + response.status };
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: 'Błąd połączenia: ' + error.message };
  }
}

/**
 * Wyświetla odpowiedź w okienku wtyczki.
 */
function renderResponse(data) {
  if (data.error) {
    responseDiv.textContent = data.error;
    return;
  }
  responseDiv.textContent = JSON.stringify(data, null, 2); // Wyświetl jako JSON
}

// TODO: Funkcje fetchLeads, checkProductAvailability i generateReports zostają bez zmian.
// TODO: Możesz rozbudować je w przyszłości na podstawie logiki tłumaczeń.

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
