// Konfiguracja
const CONFIG = {
    version: '1.0.0',
    webhookUrl: 'https://hook.eu2.make.com/gf28akjoeof22mrb2jma1puxl91k2udk',
    updateUrl: 'https://raw.githubusercontent.com/twilk/Kamila/main/version.json',
    refreshInterval: 5 * 60 * 1000 // 5 minut
};

// Elementy DOM
const elements = {
    // Główne elementy
    query: document.getElementById('query'),
    response: document.getElementById('response'),
    send: document.getElementById('send'),
    instructions: document.getElementById('instructions'),
    
    // Przyciski
    updateButton: document.getElementById('update-button'),
    instructionsButton: document.getElementById('instructions-button'),
    
    // Przełączniki
    flags: document.querySelectorAll('.flag'),
    themeRadios: document.querySelectorAll('input[name="theme"]'),
    
    // Liczniki leadów
    leadCounts: {
        submitted: document.getElementById('count-submitted'),
        confirmed: document.getElementById('count-confirmed'),
        accepted: document.getElementById('count-accepted'),
        ready: document.getElementById('count-ready'),
        overdue: document.getElementById('count-overdue')
    },
    
    // Modal
    modal: {
        container: document.getElementById('leadDetailsModal'),
        title: document.querySelector('#leadDetailsModal .modal-title'),
        body: document.getElementById('leadDetailsList')
    },
    
    // Status
    status: {
        api: document.getElementById('api-status'),
        auth: document.getElementById('auth-status'),
        orders: document.getElementById('orders-status'),
        cache: document.getElementById('cache-status'),
        checkButton: document.getElementById('check-status')
    },
    
    // Tapety
    wallpapers: {
        grid: document.getElementById('wallpapers-grid'),
        upload: document.getElementById('wallpaper-upload')
    },
    
    // Aktualizacja
    update: {
        button: document.getElementById('update-button'),
        status: document.getElementById('update-status'),
        notes: document.getElementById('update-notes')
    },
    
    // Testy
    runTests: document.getElementById('run-tests')
};

// Inicjalizacja managera tapet
const wallpaperManager = new WallpaperManager();

// Inicjalizacja
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicjalizacja Selly API
        await sellyApi.initialize();
        
        // Inicjalizacja Bootstrap
        initializeBootstrap();
        
        // Załaduj zapisane preferencje
        loadSavedPreferences();
        
        // Inicjalizacja liczników
        await updateLeadCounts();
        
        // Inicjalizacja managera tapet
        await wallpaperManager.initialize();
        await renderWallpapers();
        
        // Nasłuchiwanie zdarzeń
        setupEventListeners();
        
        // Automatyczne odświeżanie liczników
        setInterval(updateLeadCounts, CONFIG.refreshInterval);
        
        // Dodaj do inicjalizacji
        const statusChecker = new StatusChecker(sellyApi);
        
        // Dodaj pierwsze sprawdzenie statusu po załadowaniu
        await updateServiceStatus();
        
        // Sprawdź czy jest oczekująca aktualizacja
        const { pendingUpdate } = await chrome.storage.local.get('pendingUpdate');
        if (pendingUpdate) {
            showUpdateNotification(pendingUpdate);
        }
    } catch (error) {
        console.error('Błąd inicjalizacji:', error);
        showError('Nie udało się zainicjalizować aplikacji');
    }
});

// Inicjalizacja Bootstrap
function initializeBootstrap() {
    // Tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltips].forEach(el => new bootstrap.Tooltip(el));
    
    // Tabs
    const tabs = document.querySelectorAll('[data-bs-toggle="tab"]');
    [...tabs].forEach(el => new bootstrap.Tab(el));
}

// Ładowanie zapisanych preferencji
function loadSavedPreferences() {
    // Motyw
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', savedTheme === 'dark');
    document.querySelector(`input[value="${savedTheme}"]`).checked = true;
    
    // Język
    const savedLanguage = localStorage.getItem('language') || 'polish';
    loadTranslations(savedLanguage);
}

// Konfiguracja nasłuchiwania zdarzeń
function setupEventListeners() {
    // Obsługa zmiany motywu
    elements.themeRadios.forEach(radio => {
        radio.addEventListener('change', handleThemeChange);
    });
    
    // Obsługa zmiany języka
    elements.flags.forEach(flag => {
        flag.addEventListener('click', handleLanguageChange);
    });
    
    // Obsługa przycisków
    elements.send.addEventListener('click', handleSendQuery);
    elements.updateButton.addEventListener('click', handleUpdate);
    elements.instructionsButton.addEventListener('click', toggleInstructions);
    
    // Obsługa kliknięć w statusy leadów
    document.querySelectorAll('.lead-status').forEach(status => {
        status.addEventListener('click', () => {
            const type = status.querySelector('.lead-count').id.replace('count-', '');
            handleLeadClick(type);
        });
    });
    
    // Obsługa statusu
    elements.status.checkButton.addEventListener('click', updateServiceStatus);
    
    // Obsługa wyboru tapety
    elements.wallpapers.grid.addEventListener('click', (e) => {
        const preview = e.target.closest('.wallpaper-preview');
        if (!preview) return;

        const wallpaperId = preview.dataset.wallpaper;
        wallpaperManager.setWallpaper(wallpaperId);
        renderWallpapers();
    });

    // Obsługa usuwania własnej tapety
    elements.wallpapers.grid.addEventListener('click', (e) => {
        if (!e.target.matches('.remove-wallpaper')) return;
        
        const wallpaperId = e.target.dataset.wallpaper;
        wallpaperManager.removeCustomWallpaper(wallpaperId);
        renderWallpapers();
    });

    // Obsługa uploadu nowej tapety
    elements.wallpapers.upload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await wallpaperManager.addCustomWallpaper(file);
            await renderWallpapers();
        } catch (error) {
            showError(error.message);
        }
        
        e.target.value = ''; // Reset input
    });

    // Obsługa przycisku testów
    elements.runTests.addEventListener('click', async () => {
        // Wyłącz przyciski podczas testowania
        elements.runTests.classList.add('testing');
        elements.status.checkButton.disabled = true;

        // Resetuj wszystkie statusy na szary
        document.querySelectorAll('.status-dot').forEach(dot => {
            dot.className = 'status-dot testing';
        });

        try {
            await statusChecker.runTests();
        } catch (error) {
            console.error('Błąd podczas wykonywania testów:', error);
            showError('Nie udało się wykonać wszystkich testów');
        } finally {
            // Włącz z powrotem przyciski
            elements.runTests.classList.remove('testing');
            elements.status.checkButton.disabled = false;
        }
    });
}

// Obsługa zdarzeń
async function handleThemeChange(e) {
    const isDark = e.target.value === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('theme', e.target.value);
}

async function handleLanguageChange(e) {
    const language = e.target.getAttribute('data-lang');
    localStorage.setItem('language', language);
    await loadTranslations(language);
}

async function handleSendQuery() {
    const query = elements.query.value.trim();
    if (!query) {
        showError(await getTranslation('errorEmptyQuery'));
        return;
    }
    
    showLoading();
    try {
        const response = await fetchData(query);
        showResponse(response);
    } catch (error) {
        showError(error.message);
    }
}

async function handleUpdate() {
    try {
        const response = await fetch(CONFIG.updateUrl);
        const data = await response.json();
        
        if (data.version !== CONFIG.version) {
            if (confirm(await getTranslation('updateAvailable', { version: data.version }))) {
                window.open(data.downloadUrl, '_blank');
            }
        } else {
            alert(await getTranslation('updateLatest'));
        }
    } catch (error) {
        alert(await getTranslation('updateError', { message: error.message }));
    }
}

function toggleInstructions() {
    elements.instructions.classList.toggle('d-none');
}

// Funkcje pomocnicze
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error('Błąd ładowania tłumaczeń');
        
        const translations = await response.json();
        updateInterface(translations);
    } catch (error) {
        console.error('Błąd ładowania tłumaczeń:', error);
    }
}

async function fetchData(query) {
    const response = await fetch(`${CONFIG.webhookUrl}?req=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(await getTranslation('errorConnection'));
    return await response.json();
}

async function updateLeadCounts() {
    try {
        const counts = await sellyApi.fetchLeadCounts();
        
        Object.entries(counts).forEach(([key, value]) => {
            if (elements.leadCounts[key]) {
                elements.leadCounts[key].textContent = value;
            }
        });
    } catch (error) {
        console.error('Błąd aktualizacji liczników:', error);
        // Możemy dodać powiadomienie dla użytkownika
        showError('Błąd podczas aktualizacji statusów zamówień');
    }
}

// Funkcje UI
function showLoading() {
    elements.response.innerHTML = '<div class="text-center">Ładowanie...</div>';
}

function showError(message) {
    elements.response.innerHTML = `<div class="alert alert-danger">${message}</div>`;
}

function showResponse(data) {
    if (typeof data === 'string') {
        elements.response.innerHTML = `<pre>${data}</pre>`;
    } else {
        elements.response.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}

async function handleLeadClick(type) {
    try {
        const status = API_CONFIG.SELLY.STATUS_CODES[type.toUpperCase()];
        const details = await sellyApi.getLeadDetails(status);
        
        // Tu możemy dodać wyświetlanie szczegółów w modalu
        showLeadDetails(details);
    } catch (error) {
        console.error('Błąd pobierania szczegółów:', error);
        showError('Nie udało się pobrać szczegółów zamówień');
    }
}

function updateInterface(translations) {
    // Aktualizacja nagłówka
    document.getElementById('welcome-message').textContent = translations.welcome;
    
    // Aktualizacja chatu
    elements.query.placeholder = translations.queryPlaceholder;
    document.querySelector('label[for="query"]').textContent = translations.queryLabel;
    elements.send.textContent = translations.send;
    
    // Aktualizacja zakładek
    document.querySelector('[data-bs-target="#chat"]').textContent = translations.chat;
    document.querySelector('[data-bs-target="#settings"]').textContent = translations.settings;
    document.querySelector('[data-bs-target="#about"]').textContent = translations.about;
    
    // Aktualizacja ustawień
    document.querySelector('input[value="light"] + label').textContent = translations.themeLight;
    document.querySelector('input[value="dark"] + label').textContent = translations.themeDark;
    
    // Aktualizacja about
    document.querySelector('#about h5').textContent = translations.about;
    document.querySelector('#about p:nth-child(2)').textContent = translations.creator;
    document.querySelector('#about p:nth-child(3)').textContent = translations.purpose;
    document.querySelector('#version').textContent = translations.version.replace('{version}', CONFIG.version);
    elements.updateButton.textContent = translations.checkUpdate;
    elements.instructionsButton.textContent = translations.showInstructions;
    
    // Aktualizacja tooltipów statusów
    document.querySelectorAll('.lead-status').forEach(status => {
        const type = status.querySelector('.lead-count').id.replace('count-', '');
        status.setAttribute('title', translations.leadStatuses[type]);
    });
}

function showLeadDetails(details) {
    const modal = new bootstrap.Modal(elements.modal.container);
    
    // Formatowanie danych
    const html = details.map(order => `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between">
                <span>Zamówienie #${order.id}</span>
                <span class="badge bg-primary">${order.status}</span>
            </div>
            <div class="card-body">
                <h6>Klient</h6>
                <p class="mb-2">${order.customer.name}<br>${order.customer.email}</p>
                
                <h6>Produkty</h6>
                <ul class="list-unstyled">
                    ${order.items.map(item => `
                        <li>
                            ${item.quantity}x ${item.name}
                            <span class="float-end">${item.price} PLN</span>
                        </li>
                    `).join('')}
                </ul>
                
                <div class="text-end mt-3">
                    <strong>Suma: ${order.total} PLN</strong>
                </div>
            </div>
            <div class="card-footer text-muted">
                Data zamówienia: ${new Date(order.created_at).toLocaleString()}
            </div>
        </div>
    `).join('');
    
    elements.modal.body.innerHTML = html;
    modal.show();
}

// Dodaj funkcję aktualizacji statusu
async function updateServiceStatus() {
    const statuses = await statusChecker.checkAll();
    
    Object.entries(statuses).forEach(([service, status]) => {
        const element = elements.status[service.toLowerCase()];
        if (element) {
            element.className = 'status-dot status-' + status;
        }
    });
}

// Funkcja renderująca tapety
async function renderWallpapers() {
    const wallpapers = wallpaperManager.getAllWallpapers();
    const currentWallpaper = wallpaperManager.currentWallpaper;
    
    const html = wallpapers.map(wallpaper => `
        <div class="wallpaper-item">
            <div class="wallpaper-preview ${currentWallpaper === wallpaper.id ? 'active' : ''}"
                 style="background-image: url(${wallpaper.url})"
                 data-wallpaper="${wallpaper.id}">
                ${wallpaper.custom ? `
                    <button class="btn btn-sm btn-danger remove-wallpaper" 
                            data-wallpaper="${wallpaper.id}">
                        ×
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    elements.wallpapers.grid.innerHTML = html;
}

// Dodaj obsługę przycisku aktualizacji
elements.update.button.addEventListener('click', async () => {
    try {
        const updateInfo = await chrome.runtime.sendMessage({ type: 'CHECK_UPDATES' });
        if (updateInfo.hasUpdate) {
            const shouldUpdate = await showUpdateConfirmation(updateInfo);
            if (shouldUpdate) {
                await updateManager.downloadUpdate(updateInfo.downloadUrl);
                showUpdateInstructions();
            }
        } else {
            showMessage('Masz najnowszą wersję!');
        }
    } catch (error) {
        showError('Błąd sprawdzania aktualizacji: ' + error.message);
    }
});

function showUpdateNotification(updateInfo) {
    elements.update.status.innerHTML = `
        <div class="alert alert-info">
            <strong>Dostępna aktualizacja ${updateInfo.latestVersion}!</strong>
            <p>Kliknij przycisk "Aktualizuj", aby pobrać.</p>
        </div>
    `;
    elements.update.button.classList.add('btn-success');
}

function showUpdateConfirmation(updateInfo) {
    return new Promise((resolve) => {
        const modal = new bootstrap.Modal(document.getElementById('updateModal'));
        document.getElementById('updateVersion').textContent = updateInfo.latestVersion;
        document.getElementById('updateNotes').innerHTML = marked.parse(updateInfo.releaseNotes);
        
        document.getElementById('confirmUpdate').onclick = () => {
            modal.hide();
            resolve(true);
        };
        
        document.getElementById('cancelUpdate').onclick = () => {
            modal.hide();
            resolve(false);
        };
        
        modal.show();
    });
}

function showUpdateInstructions() {
    const modal = new bootstrap.Modal(document.getElementById('instructionsModal'));
    modal.show();
}

