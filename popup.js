import { API } from './services/index.js';
//import { API_BASE_URL, API_KEY } from '../config/api.js';
import { API_BASE_URL, API_KEY } from '../config/api.js';
import { getSellyCredentials } from './config/api.js';
import { i18n } from './services/i18n.js';

// Globalna zmienna dla tooltipów
let tooltipList = [];

// Tymczasowo dla testów - 10 sekund
const REFRESH_INTERVAL = 10000;
let refreshCount = 0;

// Funkcja logowania
function logToPanel(message, type = 'info', data = null) {
    // Formatuj timestamp w formacie [HH:MM:SS]
    const now = new Date();
    const timestamp = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join(':');

    // Formatuj wiadomość
    let logMessage = message;
    if (data) {
        if (typeof data === 'string') {
            logMessage += `: ${data}`;
        } else if (data instanceof Error) {
            logMessage += `: ${data.message}`;
        } else if (typeof data === 'object') {
            logMessage += `: ${JSON.stringify(data)}`;
        }
    }

    // Dodaj prefix z tłumaczenia tylko jeśli i18n jest zainicjalizowany
    if (i18n.translations && Object.keys(i18n.translations).length > 0) {
        const prefix = i18n.translate(`debugPanel${type.charAt(0).toUpperCase() + type.slice(1)}`);
        logMessage = `${prefix} ${logMessage}`;
    } else {
        // Fallback gdy nie ma jeszcze tłumaczeń
        logMessage = `[${type.toUpperCase()}] ${logMessage}`;
    }
    
    // Log do konsoli
    console.log(`[${timestamp}] ${logMessage}`);
    
    // Log do panelu debugowego
    const debugLogs = document.getElementById('debug-logs');
    if (debugLogs) {
        // Usuń komunikat o braku logów jeśli istnieje
        const emptyLog = debugLogs.querySelector('.log-entry.log-empty');
        if (emptyLog) {
            emptyLog.remove();
        }

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `[${timestamp}] ${logMessage}`;
        debugLogs.appendChild(logEntry);
        debugLogs.scrollTop = debugLogs.scrollHeight;
    }
}

// Dodaj obsługę logów z background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOG_MESSAGE') {
        const { message: logMessage, type, data } = message.payload;
        logToPanel(logMessage, type, data);
    }
});

// Inicjalizacja
document.addEventListener('DOMContentLoaded', async () => {
    logToPanel('🚀 Aplikacja uruchomiona');
    
    try {
        // Inicjalizacja tłumaczeń
        await i18n.init();
        
        // Inicjalizacja konfiguracji Selly
        const sellyConfig = await getSellyCredentials();

        // Teraz można kontynuować inicjalizację aplikacji korzystając z sellyConfig
        // Przykład:
        // API.init(sellyConfig); // Jeśli API potrzebuje konfiguracji

        // Inicjalizacja języka - musi być pierwsza!
        i18n.updateDataI18n();
        updateInterface(i18n.translations);
        logToPanel('✅ Język zainicjalizowany', 'success');

        // Inicjalizacja tooltipów Bootstrap
        initTooltips();

        // Obsługa przełącznika debug
        const debugSwitch = document.getElementById('debug-switch');
        if (debugSwitch) {
            const isDebugEnabled = localStorage.getItem('debug-enabled') === 'true';
            debugSwitch.checked = isDebugEnabled;
            document.body.classList.toggle('debug-enabled', isDebugEnabled);
            
            // Daj czas na inicjalizację UI
            setTimeout(adjustWindowHeight, 50);
        
            debugSwitch.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                document.body.classList.toggle('debug-enabled', isEnabled);
                localStorage.setItem('debug-enabled', isEnabled);
                setTimeout(adjustWindowHeight, 50);
            });
        }
        

        // Obsługa czyszczenia logów
        document.getElementById('clear-logs')?.addEventListener('click', () => {
            const debugLogs = document.getElementById('debug-logs');
            if (debugLogs) {
                debugLogs.innerHTML = '';
                logToPanel('🧹 Logi wyczyszczone', 'success');
            }
        });

        // Reszta inicjalizacji...
        const tabs = document.querySelectorAll('.nav-link');
        logToPanel(`📑 Znaleziono ${tabs.length} zakładek`);
        
        // Obsługa zakładek
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                logToPanel(`🔄 Przełączanie na zakładkę: ${tab.textContent.trim()}`, 'info');
                
                // 1. Dezaktywuj wszystkie zakładki i panele
                tabs.forEach(t => {
                    t.classList.remove('active');
                    const panel = document.querySelector(t.getAttribute('data-target'));
                    if (panel) {
                        panel.classList.remove('active', 'show');
                    }
                });
                
                // 2. Aktywuj kliknięty tab i jego panel
                tab.classList.add('active');
                const targetPanel = document.querySelector(tab.getAttribute('data-target'));
                if (targetPanel) {
                    targetPanel.classList.add('active', 'show');
                    logToPanel(`✅ Aktywowano panel: ${tab.getAttribute('data-target')}`, 'success');
                } else {
                    logToPanel(`❌ Nie znaleziono panelu: ${tab.getAttribute('data-target')}`, 'error');
                }
            });
        });

        // Obsługa motywu
        const themeRadios = document.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isDark = e.target.value === 'dark';
                document.body.classList.remove('light-theme', 'dark-theme');
                document.body.classList.add(isDark ? 'dark-theme' : 'light-theme');
                localStorage.setItem('theme', e.target.value);
                logToPanel(`🎨 Zmieniono motyw na: ${isDark ? 'ciemny' : 'jasny'}`, 'success');
                
                // Odśwież tooltips po zmianie motywu
                initTooltips();
            });
        });

        // Wczytaj zapisany motyw przy starcie
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(savedTheme === 'dark' ? 'dark-theme' : 'light-theme');
        const themeInput = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (themeInput) {
            themeInput.checked = true;
        }

        // Obsługa języków
        const flags = document.querySelectorAll('.flag');
        flags.forEach(flag => {
            flag.addEventListener('click', async (e) => {
                const lang = e.target.getAttribute('data-lang');
                try {
                    // Zapisz wybrany język
                    localStorage.setItem('language', lang);
                    
                    // Załaduj tłumaczenia dla nowego języka
                    await i18n.init();
                    
                    // Zaktualizuj interfejs i flagi
                    i18n.updateDataI18n();
                    updateInterface(i18n.translations);
                    i18n.updateFlags(lang);
                    
                    logToPanel(`✅ Język zmieniony na: ${lang}`, 'success');
                } catch (error) {
                    logToPanel(`❌ Błąd zmiany języka: ${error.message}`, 'error');
                }
            });
        });

        // Obsługa statusów
        const checkStatusButton = document.getElementById('check-status');
        if (checkStatusButton) {
            checkStatusButton.addEventListener('click', async () => {
                logToPanel('🔄 Sprawdzanie statusów...', 'info');
                try {
                    const statuses = await API.checkStatus();
                    Object.entries(statuses).forEach(([service, status]) => {
                        const dot = document.getElementById(`${service}-status`);
                        if (dot) {
                            dot.className = `status-dot status-${status}`;
                            logToPanel(`✅ Status ${service}: ${status}`, 'success');
                        }
                    });
                } catch (error) {
                    logToPanel('❌ Błąd sprawdzania statusów', 'error');
                }
            });
        }

        // Obsługa testów
        const runTestsButton = document.getElementById('run-tests');
        if (runTestsButton) {
            runTestsButton.addEventListener('click', async () => {
                logToPanel('🔍 Uruchamianie testów...', 'info');
                runTestsButton.disabled = true;
                checkStatusButton.disabled = true;
                
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    logToPanel('✅ Testy zakończone pomyślnie', 'success');
                } catch (error) {
                    logToPanel('❌ Błąd podczas testów', 'error');
                } finally {
                    runTestsButton.disabled = false;
                    checkStatusButton.disabled = false;
                }
            });
        }

        // Obsługa przesyłania tapet
        const wallpaperInput = document.getElementById('wallpaper-upload');
        wallpaperInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Sprawdź rozmiar (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                logToPanel(i18n.translate('errorFileSize'), 'error');
                return;
            }

            // Rozszerzona lista obsługiwanych formatów
            const validTypes = [
                'image/jpeg', 'image/jpg', 'image/pjpeg',
                'image/png', 'image/gif', 'image/webp',
                'image/bmp', 'image/tiff'
            ];

            if (!validTypes.includes(file.type)) {
                logToPanel(i18n.translate('errorFileType').replace('{type}', file.type), 'error');
                return;
            }

            try {
                const formData = new FormData();
                formData.append('wallpaper', file);

                const response = await chrome.runtime.sendMessage({
                    type: 'SAVE_WALLPAPER',
                    data: formData,
                    mimeType: file.type
                });

                if (response.success) {
                    handleWallpaper(response.url);
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                logToPanel(i18n.translate('errorWallpaperSave'), 'error', error);
            }
        });

        // Inicjalizacja tapety
        const savedWallpaper = localStorage.getItem('wallpaper');
        if (savedWallpaper) {
            handleWallpaper(savedWallpaper, true);
        }

        // Funkcja do pobierania danych z API Selly
        async function fetchSellyData() {
            try {
                refreshCount++;
                logToPanel(`🔄 Odświeżanie #${refreshCount}`, 'info');
                
                const response = await chrome.runtime.sendMessage({
                    type: 'FETCH_SELLY_DATA',
                    dateFrom: '2024-01-01',
                    page: '1'
                });
                
                if (response.success) {
                    const { statusCounts, responseDetails } = response;
                    
                    // Log szczegółów odpowiedzi API
                    logToPanel('📡 Status API:', 'info', `${responseDetails.status} ${responseDetails.statusText}`);
                    logToPanel('🔗 URL:', 'info', responseDetails.url);
                    
                    // Log nagłówków odpowiedzi
                    if (responseDetails.headers) {
                        const headers = [];
                        if (responseDetails.headers['content-type']) {
                            headers.push(`Content-Type: ${responseDetails.headers['content-type']}`);
                        }
                        if (responseDetails.headers['x-total-count']) {
                            headers.push(`Total: ${responseDetails.headers['x-total-count']}`);
                        }
                        if (headers.length > 0) {
                            logToPanel('📨 Nagłówki:', 'info', headers.join(', '));
                        }
                    }

                    // Aktualizacja liczników w interfejsie
                    Object.entries(statusCounts).forEach(([statusId, count]) => {
                        const element = document.querySelector(`[data-status="${statusId}"] .lead-count`);
                        if (element) {
                            element.textContent = count;
                            element.classList.remove('count-error');
                        }
                    });
                    
                    logToPanel('✅ Dane zaktualizowane', 'success');
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                console.error('Błąd podczas pobierania danych z Selly API:', error);
                logToPanel('❌ Błąd pobierania danych z Selly API', 'error', error.message);
                
                // W przypadku błędu, oznacz wszystkie liczniki jako niedostępne
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '-';
                    counter.classList.add('count-error');
                });
            }
        }

        // Funkcja obsługująca kliknięcie w status
        async function handleStatusClick() {
            try {
                logToPanel('🔄 Ręczne odświeżanie statusów...', 'info');
                await fetchSellyData();
                // Dodaj efekt wizualny potwierdzający odświeżenie
                this.classList.add('refreshed');
                setTimeout(() => this.classList.remove('refreshed'), 1000);
            } catch (error) {
                logToPanel('❌ Błąd podczas ręcznego odświeżania', 'error', error.message);
            }
        }

        // Dodaj po inicjalizacji fetchSellyData
        function initStatusClickHandlers() {
            document.querySelectorAll('.lead-status').forEach(element => {
                element.removeEventListener('click', handleStatusClick);
                element.addEventListener('click', handleStatusClick);
            });
            logToPanel('✅ Zainicjalizowano obsługę kliknięć na statusy', 'success');
        }

        // Pierwsze pobranie danych
        await fetchSellyData();
        initStatusClickHandlers();
        logToPanel('🔄 Uruchomiono automatyczne odświeżanie (co 5 minut)', 'info');

        // Ustaw interwał odświeżania
        const refreshInterval = setInterval(fetchSellyData, REFRESH_INTERVAL);

        // Dodaj czyszczenie interwału przy zamknięciu popup
        window.addEventListener('unload', () => {
            clearInterval(refreshInterval);
            logToPanel('🛑 Zatrzymano automatyczne odświeżanie', 'info');
        });
    } catch (error) {
        logToPanel('❌ Błąd inicjalizacji', 'error', error.message);
    }
});

// Bezpieczna aktualizacja elementu
function safeUpdateElement(selector, updateFn) {
    const element = document.querySelector(selector);
    if (element) {
        updateFn(element);
    }
}

// Bezpieczna aktualizacja wielu elementów
function safeUpdateElements(selector, updateFn) {
    try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            elements.forEach((element, index) => {
                try {
                    updateFn(element, index);
                } catch (error) {
                    console.warn(`Error updating element at index ${index}:`, error);
                }
            });
        }
    } catch (error) {
        console.error('Error in safeUpdateElements:', error);
    }
}

function updateInterface(translations) {
    // Najpierw aktualizujemy wszystkie elementy z data-i18n
    i18n.updateDataI18n();

    // Nagłówek
    safeUpdateElement('#welcome-message', el => el.innerHTML = i18n.translate('welcome'));
    
    // Panel zapytań
    safeUpdateElement('label[for="query"]', el => el.textContent = i18n.translate('queryLabel'));
    safeUpdateElement('#query', el => el.placeholder = i18n.translate('queryPlaceholder'));
    safeUpdateElement('#send', el => el.textContent = i18n.translate('send'));
    
    // Zakładki
    safeUpdateElement('[data-target="#chat"]', el => el.textContent = i18n.translate('chat'));
    safeUpdateElement('[data-target="#settings"]', el => el.textContent = i18n.translate('settings'));
    safeUpdateElement('[data-target="#about"]', el => el.textContent = i18n.translate('about'));
    safeUpdateElement('[data-target="#status"]', el => el.textContent = i18n.translate('status'));
    
    // Ustawienia
    safeUpdateElement('.settings-section h6:nth-of-type(1)', el => el.textContent = i18n.translate('theme'));
    safeUpdateElement('input[value="light"] + label', el => el.textContent = i18n.translate('themeLight'));
    safeUpdateElement('input[value="dark"] + label', el => el.textContent = i18n.translate('themeDark'));
    safeUpdateElement('.settings-section h6:nth-of-type(2)', el => el.textContent = i18n.translate('background'));
    safeUpdateElement('.default-wallpaper span', el => el.textContent = i18n.translate('defaultBackground'));
    safeUpdateElement('label[for="wallpaper-upload"]', el => el.innerHTML = `<i class="fas fa-upload"></i> ${i18n.translate('addCustomWallpaper')}`);
    safeUpdateElement('.custom-wallpaper small', el => el.textContent = i18n.translate('wallpaperRequirements'));
    safeUpdateElement('label[for="debug-switch"]', el => el.textContent = i18n.translate('debugMode'));
    
    // O aplikacji
    safeUpdateElement('#about h5', el => el.textContent = i18n.translate('about'));
    safeUpdateElement('#about p:nth-of-type(1)', el => el.textContent = i18n.translate('creator'));
    safeUpdateElement('#about p:nth-of-type(2)', el => el.textContent = i18n.translate('purpose'));
    safeUpdateElement('#update-button', el => el.textContent = i18n.translate('checkUpdates'));
    safeUpdateElement('#instructions-button', el => el.textContent = i18n.translate('instructions'));
    
    // Status
    safeUpdateElement('#status h5', el => el.textContent = i18n.translate('serviceStatus'));
    safeUpdateElements('.service-name', (el, index) => {
        const keys = ['apiSelly', 'authorization', 'orders', 'cache'];
        el.textContent = i18n.translate(keys[index]);
    });
    safeUpdateElements('.legend-item span:not(.status-dot)', (el, index) => {
        const keys = ['workingProperly', 'hasIssues', 'notWorking'];
        el.textContent = i18n.translate(keys[index]);
    });
    safeUpdateElement('#run-tests', el => el.textContent = i18n.translate('runTests'));
    safeUpdateElement('#check-status', el => el.textContent = i18n.translate('refreshStatus'));
    
    // Panel debugowania
    safeUpdateElement('.debug-header span', el => el.textContent = i18n.translate('debugPanelTitle'));
    safeUpdateElement('#clear-logs', el => el.textContent = i18n.translate('debugPanelClear'));
    safeUpdateElement('.log-entry.log-empty', el => el.textContent = i18n.translate('debugPanelEmpty'));

    // Modalne okna
    safeUpdateElement('#leadDetailsModal .modal-title', el => el.textContent = i18n.translate('leadDetails'));
    safeUpdateElement('#updateModal .modal-title', el => el.textContent = i18n.translate('updateAvailable'));
    safeUpdateElement('#instructionsModal .modal-title', el => el.textContent = i18n.translate('instructionsTitle'));
    safeUpdateElement('#cancelUpdate', el => el.textContent = i18n.translate('cancel'));
    safeUpdateElement('#confirmUpdate', el => el.textContent = i18n.translate('update'));

    // Statusy leadów
    safeUpdateElements('[data-bs-toggle="tooltip"]', (el, index) => {
        const statusKeys = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
        const key = statusKeys[index];
        if (key && i18n.translations?.leadStatuses?.[key]) {
            const status = i18n.translate(`leadStatuses.${key}`);
            if (status) {
                el.title = status;
            }
        }
    });

    // Tooltips dla statusów leadów
    safeUpdateElements('.lead-status', (el, index) => {
        const statusKeys = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
        const key = statusKeys[index];
        if (key && i18n.translations?.leadStatuses?.[key]) {
            const status = i18n.translate(`leadStatuses.${key}`);
            if (status) {
                el.setAttribute('title', status);
            }
        }
    });

    // Komunikaty błędów i ładowania
    safeUpdateElements('.loading-message', el => el.textContent = i18n.translate('loading'));
    safeUpdateElements('.error-empty-query', el => el.textContent = i18n.translate('errorEmptyQuery'));
    safeUpdateElements('.error-connection', el => el.textContent = i18n.translate('errorConnection'));

    // Wersja
    safeUpdateElement('#version', el => el.textContent = i18n.translate('version').replace('{version}', '1.0.0'));

    // Instrukcja aktualizacji
    for (let i = 1; i <= 6; i++) {
        safeUpdateElement(`#instructionsModal .modal-body ol li:nth-child(${i})`, el => {
            const keys = ['instructionUnzip', 'instructionGoTo', 'instructionRemove', 'instructionDevMode', 'instructionLoad', 'instructionSelect'];
            el.textContent = i18n.translate(keys[i-1]);
        });
    }

    // Aktualizacja tooltipów po zmianie języka
    initTooltips();
}

// Inicjalizacja tooltipów
function initTooltips() {
    try {
        if (typeof bootstrap === 'undefined') {
            throw new Error('Bootstrap nie jest załadowany');
        }

        // Usuń stare tooltips
        if (tooltipList?.length) {
            tooltipList.forEach(tooltip => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    // Ignoruj błędy przy usuwaniu tooltipów
                }
            });
        }
        
        // Inicjalizuj nowe
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipList = [...tooltipTriggerList].map(el => {
            try {
                // Aktualizuj tytuł tooltipa z tłumaczenia
                if (el.hasAttribute('data-i18n-tooltip')) {
                    const key = el.getAttribute('data-i18n-tooltip');
                    el.title = i18n.translate(key);
                }
                
                return new bootstrap.Tooltip(el, {
                    animation: true,
                    delay: { show: 100, hide: 100 },
                    placement: 'auto',
                    trigger: 'hover focus'
                });
            } catch (e) {
                logToPanel('❌ Błąd inicjalizacji tooltipa', 'error', e);
                return null;
            }
        }).filter(Boolean);
    } catch (error) {
        logToPanel('❌ Błąd inicjalizacji tooltipów', 'error', error);
    }
}

// Funkcje pomocnicze do obsługi komunikatów
function showMessage(type, key) {
    const message = document.querySelector(`.${type}-message`);
    if (message) {
        message.textContent = i18n.translate(key);
        message.classList.remove('d-none');
    }
}

function hideMessage(type) {
    const message = document.querySelector(`.${type}-message`);
    if (message) {
        message.classList.add('d-none');
    }
}

function hideAllMessages() {
    document.querySelectorAll('.error-message, .loading-message').forEach(el => {
        el.classList.add('d-none');
    });
}

// Obsługa wysyłania zapytania
document.getElementById('send')?.addEventListener('click', async () => {
    const query = document.getElementById('query').value.trim();
    
    if (!query) {
        showMessage('error', 'errorEmptyQuery');
        return;
    }

    hideAllMessages();
    showMessage('loading', 'loading');

    try {
        // TODO: Implementacja wysyłania zapytania do API
        await new Promise(resolve => setTimeout(resolve, 1000)); // Symulacja opóźnienia
        hideAllMessages();
    } catch (error) {
        hideMessage('loading');
        showMessage('error', 'errorConnection');
        logToPanel('❌ Błąd wysyłania zapytania', 'error', error);
    }
});

function adjustWindowHeight() {
    const isDebugEnabled = document.body.classList.contains('debug-enabled');
    const height = isDebugEnabled ? 750 : 600;
    resizeWindow(height);
}

// Funkcja pomocnicza do zmiany rozmiaru okna
async function resizeWindow(height) {
    try {
        // Aktualizacja okna w przeglądarce
        if (chrome?.windows?.getCurrent) {
            const window = await chrome.windows.getCurrent();
            await chrome.windows.update(window.id, { height });
        } else {
            // Dla trybu deweloperskiego lub braku uprawnień
            document.body.style.height = `${height}px`;
        }
    } catch (error) {
        logToPanel('❌ Błąd zmiany rozmiaru okna', 'error', error);
        // Fallback do zmiany wysokości body
        document.body.style.height = `${height}px`;
    }
}

// Obsługa wysyłania zapytania przez Enter
document.getElementById('query')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('send')?.click();
    }
});

// Funkcja do zarządzania tapetą
function handleWallpaper(imageUrl, isInitial = false) {
    try {
        // Stwórz lub zaktualizuj kontener tapety
        let container = document.querySelector('.wallpaper-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'wallpaper-container';
            document.body.appendChild(container);
        }

        // Stwórz lub zaktualizuj obraz tapety
        let image = container.querySelector('.wallpaper-image');
        if (!image) {
            image = document.createElement('img');
            image.className = 'wallpaper-image';
            container.appendChild(image);
        }

        // Obsługa błędów ładowania
        image.onerror = () => {
            logToPanel(i18n.translate('errorWallpaperLoad'), 'error');
            container.style.opacity = '0';
            setTimeout(() => {
                container.remove();
                localStorage.removeItem('wallpaper');
            }, 300);
        };

        // Obsługa udanego załadowania
        image.onload = () => {
            container.style.opacity = '1';
            if (!isInitial) {
                logToPanel(i18n.translate('successWallpaperUpdate'), 'success');
            }
        };

        // Ustaw nowe źródło obrazu
        container.style.opacity = '0';
        setTimeout(() => {
            image.src = imageUrl;
            localStorage.setItem('wallpaper', imageUrl);
        }, isInitial ? 0 : 300);

        return true;
    } catch (error) {
        logToPanel('❌ Błąd obsługi tapety', 'error', error);
        return false;
    }
}

async function fetchData() {
    try {
        const response = await fetch(`${API_BASE_URL}/endpoint`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        const data = await response.json();
        // Przetwarzanie danych
    } catch (error) {
        console.error('Błąd podczas pobierania danych z API:', error);
    }
}

// Funkcja pomocnicza do tworzenia elementu zamówienia
function createOrderElement(order) {
    const orderDiv = document.createElement('div');
    orderDiv.className = 'order-item';
    
    // Przykładowa struktura HTML dla zamówienia
    orderDiv.innerHTML = `
        <div class="order-header">
            <span class="order-id">Zamówienie #${order.id}</span>
            <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
        </div>
        <div class="order-details">
            <div class="order-status">Status: ${order.status}</div>
            <div class="order-customer">Klient: ${order.customer_name}</div>
            <div class="order-value">Wartość: ${order.total_value} PLN</div>
        </div>
    `;
    
    // Dodaj obsługę kliknięcia, jeśli potrzebna
    orderDiv.addEventListener('click', () => {
        showOrderDetails(order);
    });
    
    return orderDiv;
}

// Funkcja do wyświetlania szczegółów zamówienia
function showOrderDetails(order) {
    // Przykład użycia istniejącego modalu
    const modal = document.getElementById('leadDetailsModal');
    const modalBody = modal.querySelector('.modal-body');
    
    modalBody.innerHTML = `
        <div class="order-details-full">
            <h6>Szczegóły zamówienia #${order.id}</h6>
            <p><strong>Data utworzenia:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Klient:</strong> ${order.customer_name}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Telefon:</strong> ${order.customer_phone}</p>
            <p><strong>Wartość zamówienia:</strong> ${order.total_value} PLN</p>
            <div class="order-items-list">
                <h6>Produkty:</h6>
                <ul>
                    ${order.items.map(item => `
                        <li>${item.name} - ${item.quantity} szt. - ${item.price} PLN</li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
    
    // Pokaż modal używając Bootstrap
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

