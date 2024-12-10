// Adres endpointu Make.com (zmień na swój):
const webhookUrl = 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk';

// Elementy z popup.html
const queryInput = document.getElementById('query');
const responseDiv = document.getElementById('response');
const sendButton = document.getElementById('send');
const settingsTab = document.getElementById('settings-tab');
const aboutTab = document.getElementById('about-tab');
const chatTab = document.getElementById('chat-tab');
const themeInputs = document.querySelectorAll('input[name="theme"]');
const tabLinks = document.querySelectorAll('.nav-link');
const tabContents = document.querySelectorAll('.tab-pane');

// Funkcja inicjalizująca wtyczkę
document.addEventListener('DOMContentLoaded', async () => {
    // Ustaw preferowany język z localStorage (domyślny: 'polish')
    const preferredLanguage = localStorage.getItem('language') || 'polish';
    await setLanguage(preferredLanguage); // Ładujemy tłumaczenia
    await updateLeadCounts(); // Pobierz dane leadów

    // Obsługa kart (Chat, Ustawienia, About)
    tabLinks.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            handleTabChange(tab);
        });
    });

    // Obsługa zmiany motywu (Ciemny/Jasny)
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    themeInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const selectedTheme = event.target.value;
            localStorage.setItem('theme', selectedTheme);
            applyTheme(selectedTheme);
        });
    });

    // Inicjalizacja tooltipów (Bootstrap)
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
});

// Funkcja do przełączania kart
function handleTabChange(tab) {
    // Usuń aktywne klasy ze wszystkich kart i zawartości
    tabLinks.forEach(t => t.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('show', 'active'));

    // Dodaj aktywne klasy do wybranej karty i jej zawartości
    tab.classList.add('active');
    const targetId = tab.id.split('-')[0]; // np. 'chat' z 'chat-tab'
    document.getElementById(targetId).classList.add('show', 'active');
}

// Funkcja stosująca motyw (ciemny/jasny)
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
}

// Funkcja pobierająca dane o leadach
async function updateLeadCounts() {
    try {
        const leadData = await fetchLeadData();
        document.getElementById('count-submitted').textContent = leadData.submitted || 0;
        document.getElementById('count-confirmed').textContent = leadData.confirmed || 0;
        document.getElementById('count-accepted').textContent = leadData.accepted || 0;
        document.getElementById('count-ready').textContent = leadData.ready || 0;
        document.getElementById('count-overdue').textContent = leadData.overdue || 0;
    } catch (error) {
        console.error('Błąd podczas aktualizacji leadów:', error);
    }
}

// Symulacja danych leadów (możesz zastąpić prawdziwymi danymi z API)
async function fetchLeadData() {
    return {
        submitted: 12,
        confirmed: 8,
        accepted: 5,
        ready: 15,
        overdue: 2
    };
}

// Funkcja ustawiania języka (symulowana)
async function setLanguage(lang) {
    localStorage.setItem('language', lang);
    // Możesz tutaj zaimplementować ładowanie tłumaczeń
}

// Obsługa wysyłania zapytań z pola czatu
sendButton.addEventListener('click', async () => {
    const query = queryInput.value.trim();
    if (!query) {
        responseDiv.textContent = 'Proszę wpisać pytanie.';
        return;
    }

    responseDiv.textContent = 'Wysyłam zapytanie...';

    try {
        const response = await fetch(`${webhookUrl}?req="${encodeURIComponent(query)}"`);
        if (!response.ok) throw new Error(`Błąd serwera: ${response.status}`);
        const data = await response.json();
        renderResponse(data);
    } catch (error) {
        responseDiv.textContent = `Błąd: ${error.message}`;
    }
});

// Funkcja wyświetlania odpowiedzi w czacie
function renderResponse(data) {
    if (data.error) {
        responseDiv.textContent = data.error;
        return;
    }
    responseDiv.textContent = JSON.stringify(data, null, 2);
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
