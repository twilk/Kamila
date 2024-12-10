// Adres endpointu Make.com (zmień na swój):
const webhookUrl = 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk';

// Elementy z popup.html
const queryInput = document.getElementById('query');
const responseDiv = document.getElementById('response');
const sendButton = document.getElementById('send');
const settingsButton = document.getElementById('settings-button');
const aboutButton = document.getElementById('about-button');
const mainPanel = document.getElementById('main-panel');
const settingsPanel = document.getElementById('settings');
const aboutPanel = document.getElementById('about');

// Funkcja inicjalizująca wtyczkę
document.addEventListener('DOMContentLoaded', async () => {
    const preferredLanguage = localStorage.getItem('language') || 'polish'; // Domyślny język
    await setLanguage(preferredLanguage); // Ładujemy tłumaczenia
    await updateLeadCounts(); // Pobierz dane leadów

    // Obsługa przycisków nawigacyjnych
    settingsButton.addEventListener('click', () => showPanel('settings'));
    aboutButton.addEventListener('click', () => showPanel('about'));
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

// Funkcja do przełączania widoku paneli
function showPanel(panel) {
    mainPanel.style.display = 'none';
    settingsPanel.style.display = 'none';
    aboutPanel.style.display = 'none';

    if (panel === 'settings') {
        settingsPanel.style.display = 'block';
    } else if (panel === 'about') {
        aboutPanel.style.display = 'block';
    } else {
        mainPanel.style.display = 'block';
    }
}

// Funkcja obsługi wysyłania zapytania
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

// Funkcja pobierająca leady (przykład z symulowanymi danymi)
async function updateLeadCounts() {
    try {
        const leadData = await fetchLeadData();

        document.getElementById('count-submitted').textContent = ` ${leadData.submitted || 0} )`;
        document.getElementById('count-confirmed').textContent = ` ${leadData.confirmed || 0} )`;
        document.getElementById('count-accepted').textContent = ` ${leadData.accepted || 0} )`;
        document.getElementById('count-ready').textContent = ` ${leadData.ready || 0} )`;
        document.getElementById('count-overdue').textContent = ` ${leadData.overdue || 0} )`;
    } catch (error) {
        console.error('Błąd aktualizacji leadów:', error);
    }
}

// Funkcja symulująca dane leadów
async function fetchLeadData() {
    return {
        submitted: 12,
        confirmed: 8,
        accepted: 5,
        ready: 15,
        overdue: 2
    };
}

// Funkcja wyświetlania odpowiedzi
function renderResponse(data) {
    if (data.error) {
        responseDiv.textContent = data.error;
        return;
    }
    responseDiv.textContent = JSON.stringify(data, null, 2); // Wyświetl jako JSON
}
