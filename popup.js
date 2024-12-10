// Adres endpointu Make.com (zmień na swój):
const webhookUrl = 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk';

// Elementy z popup.html
const queryInput = document.getElementById('query');
const responseDiv = document.getElementById('response');
const sendButton = document.getElementById('send');

// Funkcja inicjalizująca wtyczkę
document.addEventListener('DOMContentLoaded', async () => {
    // Obsługa kart
    const tabLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-pane');

    tabLinks.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();

            // Dezaktywuj wszystkie linki i ukryj zawartość
            tabLinks.forEach(link => link.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('show', 'active'));

            // Aktywuj kliknięty link i jego zawartość
            tab.classList.add('active');
            const targetId = tab.id.replace('-tab', '');
            document.getElementById(targetId).classList.add('show', 'active');
        });
    });

    // Inne funkcjonalności (motyw, leady, zapytania itp.)
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const themeInputs = document.querySelectorAll('input[name="theme"]');
    themeInputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const selectedTheme = event.target.value;
            localStorage.setItem('theme', selectedTheme);
            applyTheme(selectedTheme);
        });
    });

    await updateLeadCounts();
    initTooltips();
});

// Funkcja stosująca motyw
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
}

// Funkcja pobierająca dane leadów
async function updateLeadCounts() {
    const leadData = await fetchLeadData();
    document.getElementById('count-submitted').textContent = leadData.submitted || 0;
    document.getElementById('count-confirmed').textContent = leadData.confirmed || 0;
    document.getElementById('count-accepted').textContent = leadData.accepted || 0;
    document.getElementById('count-ready').textContent = leadData.ready || 0;
    document.getElementById('count-overdue').textContent = leadData.overdue || 0;
}

// Symulacja danych leadów
async function fetchLeadData() {
    return {
        submitted: 12,
        confirmed: 8,
        accepted: 5,
        ready: 15,
        overdue: 2
    };
}

// Inicjalizacja tooltipów
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

// Obsługa wysyłania zapytań
sendButton.addEventListener('click', async () => {
    const query = queryInput.value.trim();
    if (!query) {
        responseDiv.textContent = 'Proszę wpisać pytanie.';
        return;
    }

    responseDiv.textContent = 'Wysyłam zapytanie...';

    try {
        const response = await fetch(`${webhookUrl}?req="${encodeURIComponent(query)}"`);
        const data = await response.json();
        responseDiv.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        responseDiv.textContent = `Błąd: ${error.message}`;
    }
});


// // Funkcja wyświetlania odpowiedzi w czacie
// function renderResponse(data) {
//     if (data.error) {
//         responseDiv.textContent = data.error;
//         return;
//     }
//     responseDiv.textContent = JSON.stringify(data, null, 2);
// }

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
