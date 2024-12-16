import { API } from './services/index.js';
import { API_BASE_URL, API_CONFIG } from '../config/api.js';
import { getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { i18n } from './services/i18n.js';
import { CacheService } from './services/cache.js';
import { UserCardService } from './services/userCard.js';

const CACHE_KEY = 'darwina_orders_data';

// Globalna zmienna dla tooltipów
let tooltipList = [];

// Tymczasowo dla testów - 1 minuta
const REFRESH_INTERVAL = 60000;
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
        console.log('📝 Log received:', { message: logMessage, type, data }); // Debug
        logToPanel(logMessage, type, data);
    }
    if (message.type === 'USER_CHANGED') {
        // Zaktualizuj wybór w selektorze użytkownika
        const userSelect = document.getElementById('user-select');
        if (userSelect) {
            userSelect.value = message.payload;
        }
        // Odśwież kartę użytkownika
        updateUserCard();
    }
});

// Inicjalizacja
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOMContentLoaded event fired');
    logToPanel('🚀 Aplikacja uruchomiona');
    
    try {
        // Inicjalizacja tłumaczeń
        await i18n.init();
        
        // Inicjalizacja konfiguracji DARWINA
        const darwinaConfig = await getDarwinaCredentials();
        console.log('🔑 Got Darwina config:', {
            hasConfig: !!darwinaConfig,
            hasApiKey: !!darwinaConfig?.DARWINA_API_KEY,
            baseUrl: darwinaConfig?.DARWINA_API_BASE_URL
        });

        // Pierwsze pobranie danych
        console.log('📡 Starting initial data fetch...');
        await fetchDarwinaData();

        // Bezpieczna inicjalizacja komponentów UI
        initializeUIComponents();
        
        // Inicjalizacja języka
        i18n.updateDataI18n();
        updateInterface(i18n.translations);
        logToPanel('✅ Język zainicjalizowany', 'success');

        // Inicjalizacja tooltipów Bootstrap
        initTooltips();

        await updateUserCard();

    } catch (error) {
        logToPanel('❌ Błąd inicjalizacji', 'error', error.message);
    }
});

// Nowa funkcja do bezpiecznej inicjalizacji komponentów UI
async function initializeUIComponents() {
    // Debug switch
    const debugSwitch = document.getElementById('debug-switch');
    if (debugSwitch) {
        const isDebugEnabled = localStorage.getItem('debug-enabled') === 'true';
        debugSwitch.checked = isDebugEnabled;
        document.body.classList.toggle('debug-enabled', isDebugEnabled);
        
        setTimeout(adjustWindowHeight, 50);
    
        debugSwitch.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            document.body.classList.toggle('debug-enabled', isEnabled);
            localStorage.setItem('debug-enabled', isEnabled);
            setTimeout(adjustWindowHeight, 50);
        });
    }

    // Clear logs button
    const clearLogsBtn = document.getElementById('clear-logs');
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            const debugLogs = document.getElementById('debug-logs');
            if (debugLogs) {
                debugLogs.innerHTML = '';
                logToPanel('🧹 Logi wyczyszczone', 'success');
            }
        });
    }

    // Wallpaper upload
    const wallpaperInput = document.getElementById('wallpaper-upload');
    if (wallpaperInput) {
        wallpaperInput.addEventListener('change', handleWallpaperUpload);
    }

    // Instructions button
    const instructionsButton = document.getElementById('instructions-button');
    const instructionsModal = document.getElementById('instructionsModal');
    if (instructionsButton && instructionsModal && typeof bootstrap !== 'undefined') {
        instructionsButton.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(instructionsModal) || 
                         new bootstrap.Modal(instructionsModal);
            modal.show();
            logToPanel('📋 Otwarto instrukcję', 'info');
        });
    }

    // Query input and send button
    const queryInput = document.getElementById('query');
    const sendButton = document.getElementById('send');
    if (queryInput && sendButton) {
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
            }
        });

        sendButton.addEventListener('click', handleQuerySubmit);
    }

    // Initialize store select
    initializeStoreSelect();

    // Inicjalizacja tabów
    initializeTabs();

    // Inicjalizacja przełącznika języka
    initializeLanguageSwitcher();
    
    // Inicjalizacja przełącznika motywu
    initializeThemeSwitcher();

    // Inicjalizacja selektora użytkowników
    await initializeUserSelector();
}

async function initializeUserSelector() {
    const userSelect = document.getElementById('user-select');
    if (!userSelect) return;

    const users = await UserCardService.getAllUsers();
    const currentUser = await UserCardService.loadCurrentUser();

    // Wyczyść obecne opcje
    userSelect.innerHTML = `<option value="" data-i18n="noUserSelected">Wybierz użytkownika</option>`;

    // Dodaj opcje dla każdego użytkownika
    Object.entries(users).forEach(([id, userData]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = userData.fullName;
        if (currentUser && currentUser.memberId === id) {
            option.selected = true;
        }
        userSelect.appendChild(option);
    });

    // Obsługa zmiany użytkownika
    userSelect.addEventListener('change', async (e) => {
        const selectedId = e.target.value;
        await UserCardService.setCurrentUser(selectedId);
        await updateUserCard();
    });
}

// Nowa funkcja do obsługi wysyłania zapytania
async function handleQuerySubmit() {
    const query = document.getElementById('query')?.value.trim();
    
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
}

// Nowa funkcja do obsługi przesyłania tapet
async function handleWallpaperUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Sprawdź rozmiar (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        logToPanel(i18n.translate('errorFileSize'), 'error');
        return;
    }

    // ... reszta kodu obsługi tapety ...
}

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
        const keys = ['apiDarwina', 'authorization', 'orders', 'cache'];
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

function adjustWindowHeight() {
    const isDebugEnabled = document.body.classList.contains('debug-enabled');
    const height = isDebugEnabled ? 800 : 600;
    
    if (chrome?.windows?.getCurrent) {
        chrome.windows.getCurrent(async (window) => {
            try {
                await chrome.windows.update(window.id, { height });
            } catch (error) {
                console.error('Error resizing window:', error);
            }
        });
    } else {
        // Fallback dla trybu dev
        document.body.style.height = `${height}px`;
    }
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
        const credentials = await getDarwinaCredentials();
        const response = await fetch(`${API_BASE_URL}/endpoint`, {
            headers: {
                'Authorization': `Bearer ${credentials.DARWINA_API_KEY}`
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

// Dodaj funkcję handleError
function handleError(error) {
    console.error('Error:', error); // Zachowujemy szczegółowy log w konsoli

    // Dla użytkownika pokazujemy uproszczoną wersję
    logToPanel('❌ Wystąpił błąd podczas pobierania danych', 'error');
    
    // Oznacz liczniki jako niedostępne
    document.querySelectorAll('.lead-count').forEach(counter => {
        counter.textContent = '-';
        counter.classList.add('count-error');
    });
}

// Add this new function to handle store select initialization
async function initializeStoreSelect() {
    const storeSelect = document.getElementById('store-select');
    if (!storeSelect) {
        logToPanel('�� Nie znaleziono elementu store-select', 'error');
        return;
    }

    try {
        // Import stores dynamically
        const { stores } = await import('./config/stores.js');
        
        // Clear existing options
        storeSelect.innerHTML = '';
        
        // Add "All stores" option
        const allOption = document.createElement('option');
        allOption.value = 'ALL';
        allOption.textContent = stores.find(s => s.id === 'ALL').name;
        allOption.setAttribute('data-i18n', 'allStores');
        storeSelect.appendChild(allOption);
        
        // Add remaining stores
        stores
            .filter(store => store.id !== 'ALL')
            .forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = `${store.name} - ${store.address}`;
                storeSelect.appendChild(option);
            });

        // Load saved selection
        const { selectedStore } = await chrome.storage.local.get('selectedStore');
        storeSelect.value = selectedStore || 'ALL';

        // Add change handler
        storeSelect.addEventListener('change', async (e) => {
            try {
                const selectedStore = e.target.value;
                
                // Clear cache
                await CacheService.clear(CACHE_KEY);
                // Remove last refresh timestamp
                localStorage.removeItem('last_fetch_time');
                
                // Save selected store
                await chrome.storage.local.set({ selectedStore });
                
                // Mark counters as loading
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '...';
                    counter.classList.remove('count-error', 'count-zero');
                });
                
                logToPanel('🏪 Zmieniono sklep na: ' + selectedStore, 'info');
                
                // Force immediate data refresh
                await fetchDarwinaData();
                
            } catch (error) {
                logToPanel('❌ Błąd podczas zmiany sklepu', 'error', error.message);
                handleError(error);
            }
        });

        logToPanel('✅ Zainicjalizowano wybór sklepu', 'success');
    } catch (error) {
        logToPanel('❌ Błąd inicjalizacji wyboru sklepu', 'error', error.message);
        handleError(error);
    }
}

// Add this function after the imports and before other code
async function fetchDarwinaData() {
    try {
        logToPanel('�� Rozpoczynam pobieranie danych...', 'info');
        
        const { selectedStore } = await chrome.storage.local.get('selectedStore');
        const store = selectedStore || 'ALL';
        
        const lastFetchTime = localStorage.getItem('last_fetch_time');
        const now = Date.now();
        
        if (lastFetchTime && (now - parseInt(lastFetchTime)) < REFRESH_INTERVAL) {
            logToPanel('⏳ Dane są aktualne, używam zapisanej wersji', 'info');
            return;
        }

        // Show loaders in counters
        document.querySelectorAll('.lead-count').forEach(counter => {
            showLoader(counter);
            counter.classList.remove('count-error', 'count-zero');
        });

        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_DARWINA_DATA',
            selectedStore: store
        });

        if (!response || response.error) {
            throw new Error(response?.error || 'Nie udało się pobrać danych');
        }

        // Update counters with actual values
        if (response.counts) {
            logToPanel('📊 Aktualizuję liczniki zamówień...', 'info');
            
            // Define expected status types
            const expectedStatuses = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
            
            // Initialize all counters to 0 first
            expectedStatuses.forEach(status => {
                const counter = document.getElementById(`count-${status}`);
                if (counter) {
                    counter.textContent = '0';
                    counter.classList.add('count-zero');
                    counter.classList.remove('count-error');
                }
            });
            
            // Update counters with actual values
            Object.entries(response.counts).forEach(([status, count]) => {
                // Handle special case for READY and OVERDUE statuses
                if (status === 'READY' || status === 'OVERDUE') {
                    const targetStatus = status.toLowerCase();
                    const counter = document.getElementById(`count-${targetStatus}`);
                    if (counter) {
                        const numericCount = parseInt(count, 10);
                        if (isNaN(numericCount)) {
                            logToPanel(`⚠️ Nieprawidłowa wartość dla statusu ${targetStatus}`, 'error');
                            counter.textContent = '0';
                            counter.classList.add('count-error');
                            return;
                        }
                        
                        counter.textContent = numericCount.toString();
                        counter.classList.toggle('count-zero', numericCount === 0);
                        counter.classList.remove('count-error');
                    }
                } else {
                    const counter = document.getElementById(`count-${status}`);
                    if (counter) {
                        const numericCount = parseInt(count, 10);
                        if (isNaN(numericCount)) {
                            logToPanel(`⚠️ Nieprawidłowa wartość dla statusu ${status}`, 'error');
                            counter.textContent = '0';
                            counter.classList.add('count-error');
                            return;
                        }
                        
                        counter.textContent = numericCount.toString();
                        counter.classList.toggle('count-zero', numericCount === 0);
                        counter.classList.remove('count-error');
                    }
                }
            });

            // Calculate total from numeric values
            const total = Object.values(response.counts)
                .map(count => parseInt(count, 10))
                .filter(count => !isNaN(count))
                .reduce((a, b) => a + b, 0);
                
            logToPanel(`📦 Znaleziono ${total} zamówień w wybranym sklepie`, 'success');
        }

        localStorage.setItem('last_fetch_time', now.toString());
        refreshCount++;

        const storeName = store === 'ALL' ? 'wszystkich sklepów' : `sklepu ${store}`;
        logToPanel(`🔄 Zakończono pobieranie danych dla ${storeName}`, 'success');

    } catch (error) {
        handleError(error);
        throw error;
    }
}

// Dodaj funkcję inicjalizacji języka
function initializeLanguageSwitcher() {
    const languageSwitcher = document.getElementById('language-switcher');
    if (!languageSwitcher) return;

    const flags = languageSwitcher.querySelectorAll('.flag');
    flags.forEach(flag => {
        flag.addEventListener('click', async () => {
            const lang = flag.getAttribute('data-lang');
            if (!lang) return;

            // Usuń aktywną klasę z wszystkich flag
            flags.forEach(f => f.classList.remove('active'));
            
            // Dodaj aktywną klasę do wybranej flagi
            flag.classList.add('active');
            
            // Zapisz wybrany język
            localStorage.setItem('language', lang);
            
            try {
                // Załaduj nowe tłumaczenia
                await i18n.init();
                
                // Zaktualizuj interfejs
                updateInterface(i18n.translations);
                
                logToPanel(`🌍 Zmieniono język na: ${lang}`, 'success');
            } catch (error) {
                logToPanel('❌ Błąd podczas zmiany języka', 'error');
                console.error('Language switch error:', error);
            }
        });
    });
}

// Dodaj funkcję inicjalizacji motywu
function initializeThemeSwitcher() {
    const lightTheme = document.getElementById('light-theme');
    const darkTheme = document.getElementById('dark-theme');
    
    if (!lightTheme || !darkTheme) return;

    // Ustaw początkowy stan
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', currentTheme === 'dark');
    
    if (currentTheme === 'dark') {
        darkTheme.checked = true;
    } else {
        lightTheme.checked = true;
    }

    // Obsługa zmiany motywu
    function handleThemeChange(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
        localStorage.setItem('theme', theme);
        logToPanel(`🎨 Zmieniono motyw na: ${theme === 'dark' ? 'ciemny' : 'jasny'}`, 'success');
    }

    lightTheme.addEventListener('change', () => handleThemeChange('light'));
    darkTheme.addEventListener('change', () => handleThemeChange('dark'));
}

// Modify the function that updates counters to use the loader
function showLoader(counter) {
    counter.innerHTML = `
        <div class="loader-wrapper">
            <div class="loader-circle"></div>
            <div class="loader-circle"></div>
            <div class="loader-circle"></div>
            <div class="loader-shadow"></div>
            <div class="loader-shadow"></div>
            <div class="loader-shadow"></div>
        </div>
    `;
}

// Dodaj tę funkcję do initializeUIComponents
function initializeTabs() {
    const tabLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-pane');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Usuń aktywną klasę ze wszystkich tabów
            tabLinks.forEach(tab => tab.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('show', 'active'));
            
            // Dodaj aktywną klasę do wybranego taba
            link.classList.add('active');
            
            // Pokaż odpowiednią zawartość
            const targetId = link.getAttribute('data-target');
            const targetContent = document.querySelector(targetId);
            if (targetContent) {
                targetContent.classList.add('show', 'active');
            }
            
            // Zapisz aktywny tab
            localStorage.setItem('activeTab', targetId);
            
            // Dostosuj wysokość okna
            setTimeout(adjustWindowHeight, 50);
        });
    });

    // Przywróć ostatnio wybrany tab
    const lastActiveTab = localStorage.getItem('activeTab');
    if (lastActiveTab) {
        const tabToActivate = document.querySelector(`[data-target="${lastActiveTab}"]`);
        if (tabToActivate) {
            tabToActivate.click();
        }
    }
}

// Zaktualizuj funkcję updateUserCard
async function updateUserCard() {
    const userData = await UserCardService.loadCurrentUser();
    const nameElement = document.querySelector('.user-name');
    const qrElement = document.querySelector('.qr-code');
    const cardInner = document.querySelector('.user-card-inner');

    if (!userData) {
        if (nameElement) {
            nameElement.textContent = 'Zaloguj się w DAPP';
        }
        if (qrElement) {
            qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
        }
        if (cardInner) {
            cardInner.classList.add('no-user');
        }
        return;
    }

    if (nameElement) {
        nameElement.textContent = userData.firstName;
    }
    if (qrElement && userData.qrCodeUrl) {
        // Konwertuj link do QR kodu na faktyczny obrazek QR
        qrElement.src = userData.qrCodeUrl;
    }
    if (cardInner) {
        cardInner.classList.remove('no-user');
    }
}

