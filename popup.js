// Import all services from index
import { 
    API,
    InitLogger,
    MetricsManager,
    BaseManager,
    CacheManager,
    DataManager,
    MenuManager,
    LoadingManager,
    ProgressManager,
    UpdateManager,
    InterfaceManager,
    StatusManager,
    i18n,
    stores,
    UserCardService,
    DrwnService,
    LanguageManager,
    RankingManager,
    VolumeManager,
    RefreshManager,
    UIManager,
    UserManager,
    ErrorHandler
} from './services/index.js';

// Config imports
import { API_BASE_URL, API_CONFIG, getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from './services/storage.js';

// Test Runner
import testRunner from './services/testRunner.js';

// Tests
import './tests/integration/translation.test.js';

import { themeService } from './services/theme.js';

const REFRESH_INTERVAL = 300000; // 5 minut
let refreshCount = 0;

// Status mapping for different lead statuses
const STATUS_MAP = {
    'submitted': '1',
    'confirmed': '2',
    'accepted': '3',
    'ready': 'READY',
    'overdue': 'OVERDUE'
};

// Globalna zmienna dla tooltipów
let tooltipList = [];

// Initialize static fields of BaseManager
BaseManager.initLogger = new InitLogger();
BaseManager.metricsManager = new MetricsManager();

// Inicjalizacja menedżerów
let progressManager, loadingManager, uiManager, menuManager, volumeManager,
    dataManager, statusManager, debugManager, userManager, interfaceManager,
    updateManager, languageManager, refreshManager;

// Initialize managers
const errorHandler = new ErrorHandler();

// Initialize error handler first
await errorHandler.initialize();

// Funkcja inicjalizująca menedżerów
async function initializeManagers() {
    try {
        // Core managers
        progressManager = new ProgressManager();
        loadingManager = new LoadingManager();
        
        // UI managers
        uiManager = new UIManager();
        
        // Feature managers
        menuManager = new MenuManager();
        volumeManager = new VolumeManager();
        dataManager = new DataManager(uiManager);
        statusManager = new StatusManager(uiManager);
        debugManager = new DebugManager(uiManager);
        userManager = new UserManager(uiManager);
        interfaceManager = new InterfaceManager(uiManager);
        updateManager = new UpdateManager();
        languageManager = new LanguageManager();
        refreshManager = new RefreshManager(dataManager);

        // Initialize all managers
        await Promise.all([
            progressManager.initialize(),
            loadingManager.initialize(),
            uiManager.initialize(),
            menuManager.initialize(),
            volumeManager.initialize(),
            dataManager.initialize(),
            statusManager.initialize(),
            debugManager.initialize(),
            userManager.initialize(),
            interfaceManager.initialize(),
            updateManager.initialize(),
            languageManager.initialize(),
            refreshManager.initialize()
        ]);

        return true;
    } catch (error) {
        console.error('Error initializing managers:', error);
        return false;
    }
}

// Funkcja czyszcząca zasoby menedżerów
function disposeManagers() {
    console.log('🧹 Czyszczenie zasobów menedżerów...');
    
    try {
        // Dispose wszystkich menedżerów w odwrotnej kolejności
        [
            languageManager,
            updateManager,
            interfaceManager,
            userManager,
            debugManager,
            statusManager,
            dataManager,
            volumeManager,
            menuManager,
            uiManager,
            loadingManager,
            progressManager
        ].forEach(manager => {
            try {
                manager?.dispose();
            } catch (error) {
                console.error(`Error disposing manager:`, error);
            }
        });

        // Wyczyść referencje
        languageManager = null;
        updateManager = null;
        interfaceManager = null;
        userManager = null;
        debugManager = null;
        statusManager = null;
        dataManager = null;
        volumeManager = null;
        menuManager = null;
        uiManager = null;
        loadingManager = null;
        progressManager = null;

        // Na końcu dispose ErrorHandler
        errorHandler?.dispose();
        
        console.log('✅ Zasoby menedżerów wyczyszczone');
    } catch (error) {
        console.error('❌ Błąd podczas czyszczenia zasobów:', error);
    }
}

// Funkcja obsługująca aktualizacje postępu
function handleProgressUpdate(data) {
    console.log('Handling progress update:', data); // Debug log
    if (!progressManager) {
        console.error('Progress manager not initialized');
        return;
    }

    if (!data) {
        console.warn('Received undefined progress data');
        return;
    }

    switch (data.type) {
        case 'START_TASK':
            progressManager.show();
            progressManager.startTask(data.data?.taskName, data.data?.totalSteps);
            break;
        case 'UPDATE_TASK':
            progressManager.updateTask(data.data?.increment, data.data?.status);
            break;
        case 'UPDATE_STATUS':
            progressManager.setStatus(data.data?.status);
            break;
        case 'ERROR':
            progressManager.setError(data.data?.message);
            break;
        case 'SUCCESS':
            progressManager.setSuccess(data.data?.message);
            break;
        case 'WARNING':
            progressManager.setWarning(data.data?.message);
            break;
        case 'COMPLETE':
            progressManager.setProgress(100, 'Zakończono');
            break;
        default:
            console.warn('Unknown progress update type:', data.type);
    }
}

// Modify the message listener to properly handle progress updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message); // Debug log
    
    if (message.type === 'PROGRESS_UPDATE' && message.data) {
        handleProgressUpdate(message.data);
        sendResponse({ received: true });
        return true;
    }
    if (message.type === 'LOG') {
        const { text, level, data } = message;
        appendLog(text, level, data);
        sendResponse({ received: true });
        return true;
    }
});

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

// Modify the notifyPopupOpened function to handle counter updates
async function notifyPopupOpened() {
    try {
        // Pokaż loader w licznikach podczas ładowania
        const loaderIds = [];
        document.querySelectorAll('.lead-count').forEach(counter => {
            const loaderId = loadingManager.showLoader(counter);
            if (loaderId) loaderIds.push(loaderId);
            counter.classList.remove('count-error', 'count-zero');
        });

        // Try to get data from cache first
        const { leadCounts } = await chrome.storage.local.get('leadCounts');
        if (leadCounts) {
            console.log('[DEBUG] 📊 Używam danych z cache:', leadCounts);
            updateCounters(leadCounts);
        }

        const response = await chrome.runtime.sendMessage({ type: 'POPUP_OPENED' });
        
        // Ukryj wszystkie loadery
        loaderIds.forEach(id => loadingManager.hideLoader(id));
        
        if (!response?.success) {
            throw new Error(response?.error || 'Nieznany błąd');
        }

        // Update counters with new data if available
        if (response.counts) {
            console.log('[DEBUG] 📊 Otrzymane nowe dane:', response.counts);
            updateCounters(response.counts);
            
            // Save the new counts to storage
            await chrome.storage.local.set({ leadCounts: response.counts });
        }

        logToPanel('✅ Zaktualizowano liczniki', 'success');
    } catch (error) {
        console.error('Error in notifyPopupOpened:', error);
        logToPanel('❌ Błąd podczas ładowania liczników', 'error', error.message);
        
        // Show error in counters
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '-';
            counter.classList.add('count-error');
        });
    }
}

// Add message listener for logs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOG') {
        const { text, level, data } = message;
        appendLog(text, level, data);
        sendResponse({ received: true });
        return true;
    }
});

// Aktualizujemy główny event listener
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicjalizacja tłumaczeń
        await i18n.init();
        
        // Inicjalizacja managerów
        await initializeManagers();
        
        // Aktualizacja interfejsu
        i18n.updateDataI18n();
        interfaceManager.updateInterface(i18n.translations);
        
        // Inicjalizacja karty użytkownika
        await userManager.updateUserCard();
        
        // Inicjalizacja trybu debug
        debugManager.initializeDebugPanel();
        debugManager.initializeDebugSwitch();
        
        // Inicjalizacja przycisku aktualizacji
        updateManager.initializeUpdateButton();
        
        // Załadowanie danych
        await notifyPopupOpened();
        
        // Inicjalizacja ustawień interwałów
        await interfaceManager.initializeIntervalSettings();
        
        debugManager.logToPanel('✅ Aplikacja zainicjalizowana pomyślnie', 'success');
    } catch (error) {
        console.error('❌ Błąd inicjalizacji:', error);
        if (debugManager) {
            debugManager.logToPanel('Błąd inicjalizacji: ' + error.message, 'error');
        }
    }
});

// Nowa, skonsolidowana funkcja do zarządzania danymi
async function loadAndUpdateData(forceRefresh = false) {
    try {
        // Get data from cache first
        const { leadCounts } = await chrome.storage.local.get('leadCounts');
        const lastFetchTime = localStorage.getItem('last_fetch_time');
        const now = Date.now();
        
        // If we have cached data, use it immediately
        if (leadCounts) {
            updateCounters(leadCounts);
        }

        // Check if we need to fetch new data
        const shouldFetchNewData = forceRefresh || !lastFetchTime || (now - parseInt(lastFetchTime)) >= REFRESH_INTERVAL;
        
        if (shouldFetchNewData) {
            // Show progress only if we're fetching new data
            progressManager.show(i18n.translate('logs.refreshingData'));
            progressManager.setProgress(30, i18n.translate('logs.checkingDeliveryForms'));

            try {
                const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                if (response?.success) {
                    progressManager.setProgress(50, i18n.translate('logs.updatingCounters'));
                    logToPanel(i18n.translate('logs.deliveryFormsUpdated'), 'success');
                }
            } catch (error) {
                progressManager.setWarning(i18n.translate('logs.deliveryFormsError'));
                logToPanel(i18n.translate('logs.deliveryFormsError'), 'warning', error.message);
            }

            progressManager.setProgress(70, i18n.translate('logs.fetchingData'));
            
            // Fetch new data
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            const store = selectedStore || 'ALL';

            const response = await chrome.runtime.sendMessage({
                type: 'FETCH_DARWINA_DATA',
                selectedStore: store
            });

            if (!response || response.error) {
                throw new Error(response?.error || i18n.translate('logs.dataFetchGenericError'));
            }

            if (response.counts) {
                updateCounters(response.counts);
                await chrome.storage.local.set({ leadCounts: response.counts });
                localStorage.setItem('last_fetch_time', now.toString());
            }

            progressManager.setSuccess(i18n.translate('logs.dataUpdated'));
            setTimeout(() => progressManager.hide(), 2000);
        } else {
            logToPanel(i18n.translate('logs.dataUpToDate'), 'info');
        }
        
    } catch (error) {
        progressManager.setError(i18n.translate('logs.dataFetchError'));
        logToPanel(i18n.translate('logs.dataFetchError'), 'error', error.message);
        setTimeout(() => progressManager.hide(), 3000);
    }
}

// Nowa funkcja do ładowania danych w tle
async function loadDataInBackground() {
    try {
        progressManager.show(i18n.translate('logs.appStarted'));
        progressManager.setProgress(10);

        const darwinaConfig = await getDarwinaCredentials();
        if (!darwinaConfig) {
            throw new Error(i18n.translate('logs.initError'));
        }
        progressManager.setProgress(30, i18n.translate('logs.refreshingData'));

        progressManager.setProgress(50, i18n.translate('logs.checkingDeliveryForms'));
        try {
            const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
            if (response?.success) {
                progressManager.setProgress(70, i18n.translate('logs.updatingCounters'));
                logToPanel(i18n.translate('logs.deliveryFormsUpdated'), 'success');
            } else {
                throw new Error(response?.error || i18n.translate('logs.dataFetchGenericError'));
            }
        } catch (error) {
            progressManager.setWarning(i18n.translate('logs.deliveryFormsError'));
            logToPanel(i18n.translate('logs.deliveryFormsError'), 'warning', error.message);
        }

        progressManager.setProgress(80, i18n.translate('logs.fetchingData'));
        try {
            await fetchDarwinaData();
            progressManager.setProgress(90, i18n.translate('logs.updatingCounters'));
        } catch (error) {
            progressManager.setError(i18n.translate('logs.dataFetchError'));
            logToPanel(i18n.translate('logs.dataFetchError'), 'error', error.message);
            throw error;
        }

        progressManager.setSuccess(i18n.translate('logs.dataUpdated'));
        
        setTimeout(() => {
            progressManager.hide();
        }, 2000);

    } catch (error) {
        progressManager.setError(i18n.translate('logs.dataFetchError'));
        logToPanel(i18n.translate('logs.dataFetchError'), 'error', error.message);
        
        setTimeout(() => {
            progressManager.hide();
        }, 3000);
    }
}

// Modify fetchDarwinaData to handle background loading
async function fetchDarwinaData() {
    try {
        logToPanel(i18n.translate('logs.dataFetchStarted'), 'info');
        
        const { selectedStore } = await chrome.storage.local.get('selectedStore');
        const store = selectedStore || 'ALL';
        
        const lastFetchTime = localStorage.getItem('last_fetch_time');
        const now = Date.now();
        
        if (lastFetchTime && (now - parseInt(lastFetchTime)) < REFRESH_INTERVAL) {
            logToPanel(i18n.translate('logs.dataUpToDate'), 'info');
            return;
        }

        if (!progressManager.isVisible) {
            progressManager.show(i18n.translate('logs.refreshingData'));
            progressManager.setProgress(20);
        }

        progressManager.setProgress(40, i18n.translate('logs.fetchingData'));

        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_DARWINA_DATA',
            selectedStore: store
        });

        if (!response || response.error) {
            throw new Error(response?.error || i18n.translate('logs.dataFetchGenericError'));
        }

        progressManager.setProgress(70, i18n.translate('logs.updatingCounters'));

        if (response.counts) {
            updateCounters(response.counts);
            // Save the new counts to storage
            await chrome.storage.local.set({ leadCounts: response.counts });
        }

        localStorage.setItem('last_fetch_time', now.toString());
        refreshCount++;

        const storeName = store === 'ALL' ? 
            i18n.translate('allStores') : 
            i18n.translate('interface.storeStock', { value: store });
            
        logToPanel(i18n.translate('logs.storeDataRefreshed', { store: storeName }), 'success');

        progressManager.setSuccess(i18n.translate('logs.dataUpdated'));
        
        setTimeout(() => {
            progressManager.hide();
        }, 2000);

    } catch (error) {
        progressManager.setError(i18n.translate('logs.dataFetchError'));
        handleError(error);
        
        setTimeout(() => {
            progressManager.hide();
        }, 3000);
        
        throw error;
    }
}

// Nowa funkcja do aktualizacji liczników
function updateCounters(counts) {
    logToPanel('📊 Aktualizuję liczniki zamówień...', 'info');
    
    // Define expected status types and their mappings
    const statusMap = {
        '1': 'submitted',
        '2': 'confirmed',
        '3': 'accepted',
        'READY': 'ready',
        'OVERDUE': 'overdue'
    };
    
    // Initialize all counters to 0 first
    Object.values(statusMap).forEach(status => {
        const statusElement = document.querySelector(`.lead-status[data-status="${status}"]`);
        const counter = statusElement?.querySelector('.lead-count');
        if (counter) {
            counter.textContent = '0';
            counter.classList.add('count-zero');
            counter.classList.remove('count-error');
        }
    });
    
    // Update counters with actual values
    Object.entries(counts).forEach(([status, count]) => {
        const mappedStatus = statusMap[status];
        if (mappedStatus) {
            const statusElement = document.querySelector(`.lead-status[data-status="${mappedStatus}"]`);
            const counter = statusElement?.querySelector('.lead-count');
            if (counter) {
                const numericCount = parseInt(count, 10);
                if (isNaN(numericCount)) {
                    logToPanel(`⚠️ Nieprawidłowa wartość dla statusu ${mappedStatus}`, 'error');
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
}

// Nowa funkcja do bezpiecznej inicjalizacji komponentów UI
async function initializeUIComponents() {
    try {
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

        // Initialize refresh button
        initializeRefreshButton();

        // Przycisk sprawdzania zamówień
        const checkOrdersBtn = document.getElementById('check-orders');
        if (checkOrdersBtn) {
            checkOrdersBtn.addEventListener('click', async () => {
                logToPanel('📦 Sprawdzam i aktualizuję formy dostawy...', 'info');
                try {
                    const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                    if (response?.success) {
                        logToPanel('✅ Zaktualizowano formy dostawy', 'success');
                        // Odśwież dane po aktualizacji
                        await fetchDarwinaData();
                    } else {
                        throw new Error(response?.error || 'Nieznany błąd');
                    }
                } catch (error) {
                    logToPanel('❌ Błąd podczas aktualizacji form dostawy', 'error', error.message);
                }
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

        // Inicjalizacja przycisków statusu
        initializeStatusButtons();
        
        // Pierwsze sprawdzenie statusów i aktualizacja liczników
        await updateAllStatuses();

        // Inicjalizacja elementów statusów
        initializeStatusElements();

        // Inicjalizacja linków statusów
        initializeLeadStatusLinks();

        // Resetuj stan debug mode przy starcie
        document.body.classList.remove('debug-enabled');
        if (debugSwitch) {
            debugSwitch.checked = false;
        }
        await chrome.storage.local.set({ debugMode: false });

    } catch (error) {
        console.error('Error initializing UI components:', error);
        logToPanel('❌ Błąd podczas inicjalizacji komponentów UI', 'error', error);
    }
}

// Funkcja inicjalizująca selektor użytkowników
async function initializeUserSelector() {
    const userSelect = document.getElementById('user-select');
    if (!userSelect) return;

    try {
        // Pobierz aktualnie wybranego użytkownika
        const { selectedUserId } = await chrome.storage.local.get('selectedUserId');

        // Wyczyść obecne opcje
        userSelect.innerHTML = `<option value="" data-i18n="noUserSelected">${i18n.translate('noUserSelected')}</option>`;

        // Lista dostępnych użytkowników
        const userIds = [
            '2', '4', '5', '6', '7', '8', '9', '10', '11', '13', '14', '15', 
            '17', '18', '19', '23', '24', '25', '26', '27', '29', '31', '32', 
            '33', '34', '38', '39', '40', '42', '43', '47', '50', '55', '57', 
            '58', '60', '62', '65', '67', '69', '70', '71', '72', '73', '76', 
            '81', '82', '83', '84'
        ];

        // Pobierz dane wszystkich użytkowników
        const users = [];
        for (const userId of userIds) {
            const response = await fetch(chrome.runtime.getURL(`users/${userId}.json`));
            if (response.ok) {
                const userData = await response.json();
                users.push({ id: userId, ...userData });
            }
        }

        // Sortuj użytkowników alfabetycznie po fullName
        users.sort((a, b) => a.fullName.localeCompare(b.fullName));

        // Dodaj posortowane opcje
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.fullName;
            if (selectedUserId === user.id) {
                option.selected = true;
            }
            userSelect.appendChild(option);
        });

        // Jeśli był zapamiętany użytkownik, załaduj jego kartę od razu
        if (selectedUserId) {
            const selectedUser = users.find(u => u.id === selectedUserId);
            if (selectedUser) {
                await updateUserCard(selectedUser);
            }
        }

        // Obsługa zmiany użytkownika
        userSelect.addEventListener('change', async (e) => {
            const selectedId = e.target.value;
            await chrome.storage.local.set({ selectedUserId: selectedId });
            
            if (selectedId) {
                const selectedUser = users.find(u => u.id === selectedId);
                if (selectedUser) {
                    updateUserCard(selectedUser);
                }
            } else {
                updateUserCard(null);
            }

            // Odśwież content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_USER_DATA' });
                }
            });
        });

    } catch (error) {
        console.error('Error initializing user selector:', error);
        logToPanel('❌ Błąd podczas inicjalizacji selektora użytkowników', 'error', error);
    }
}

// Funkcja aktualizująca kartę użytkownika
async function updateUserCard(userData = null) {
    const cardInner = document.querySelector('.user-card-inner');
    const nameElement = document.querySelector('.user-card-front .user-name');
    const qrElement = document.querySelector('.user-card-back .qr-code');
    
    try {
        // Jeśli nie dostaliśmy danych użytkownika, spróbuj załadować z pamięci
        if (!userData) {
            const { selectedUserId } = await chrome.storage.local.get('selectedUserId');
            if (selectedUserId) {
                const response = await fetch(chrome.runtime.getURL(`users/${selectedUserId}.json`));
                if (response.ok) {
                    userData = await response.json();
                    userData.id = selectedUserId; // Dodaj ID do danych użytkownika
                }
            }
        }

        // Jeśli nadal nie mamy danych użytkownika, pokaż stan domyślny
        if (!userData) {
            if (nameElement) {
                nameElement.textContent = i18n.translate('noUserSelected');
            }
            if (qrElement) {
                qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
            }
            if (cardInner) {
                cardInner.classList.add('no-user');
            }
            return;
        }

        // Aktualizuj kartę danymi użytkownika
        if (nameElement) {
            nameElement.textContent = userData.fullName;
        }
        
        if (qrElement) {
            // Pokaż loader podczas ładowania QR kodu
            const loaderWrapper = document.createElement('div');
            loaderWrapper.className = 'loader-wrapper';
            loaderWrapper.innerHTML = `
                <div class="loader-circle"></div>
                <div class="loader-circle"></div>
                <div class="loader-circle"></div>
                <div class="loader-shadow"></div>
                <div class="loader-shadow"></div>
                <div class="loader-shadow"></div>
            `;
            qrElement.parentElement.appendChild(loaderWrapper);
            
            // Załaduj QR kod bezpośrednio z pliku
            const qrImage = new Image();
            qrImage.onload = () => {
                qrElement.src = qrImage.src;
                qrElement.style.maxWidth = 'none';
                qrElement.style.width = '100%';
                loaderWrapper.remove();
            };
            
            qrImage.onerror = () => {
                console.error(`Failed to load QR code for user ${userData.id}`);
                qrElement.src = chrome.runtime.getURL('assets/default-avatar.jpg');
                loaderWrapper.remove();
                logToPanel(`❌ Nie udało się załadować kodu QR dla użytkownika ${userData.id}`, 'error');
            };
            
            qrImage.src = chrome.runtime.getURL(`qrcodes/${userData.id}.png`);
        }
        
        if (cardInner) {
            cardInner.classList.remove('no-user');
        }

        // Dodajemy obsługę animacji flip
        const cardFlip = document.querySelector('.user-card-flip');
        if (cardFlip) {
            cardFlip.addEventListener('click', () => {
                cardInner.style.transform = 
                    cardInner.style.transform === 'rotateY(180deg)' ? 
                    'rotateY(0)' : 'rotateY(180deg)';
            });
        }
    } catch (error) {
        console.error('Error updating user card:', error);
        logToPanel('❌ Błąd aktualizacji karty użytkownika', 'error', error);
    }
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
    try {
        console.log(`🔍 Szukam elementu: ${selector}`);
        const element = document.querySelector(selector);
        if (element) {
            console.log(`✅ Znaleziono element: ${selector}`);
            console.log(`📝 Obecna zawartość:`, element.innerHTML);
            updateFn(element);
            console.log(`✨ Zaktualizowana zawartość:`, element.innerHTML);
        } else {
            console.warn(`⚠️ Nie znaleziono elementu: ${selector}`);
        }
    } catch (error) {
        console.error(`❌ Błąd aktualizacji elementu ${selector}:`, error);
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
    console.log('🖥 Rozpoczynam aktualizację interfejsu...');
    
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

    // Zaktualizuj menu używając MenuManager
    menuManager.updateMenuItems();
    menuManager.initializeTooltips();
    menuManager.initializeMenu();
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
    const debugPanel = document.querySelector('.debug-panel');
    if (debugPanel && document.body.classList.contains('debug-enabled')) {
        const debugPanelHeight = debugPanel.offsetHeight;
        document.body.style.height = `calc(var(--window-height) + ${debugPanelHeight/2}px)`;
    } else {
        document.body.style.height = 'var(--window-height)';
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

// Modify store selection handler
async function initializeStoreSelect() {
    const storeSelect = document.getElementById('store-select');
    if (!storeSelect) {
        logToPanel(' Nie znaleziono elementu store-select', 'error');
        return;
    }

    try {
        // Import stores dynamically
        const { stores } = await import('./services/stores.js');
        
        // Clear existing options
        storeSelect.innerHTML = '';
        
        // Add "All stores" option
        const allOption = document.createElement('option');
        allOption.value = 'ALL';
        allOption.textContent = i18n.translate('allStores');
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
                await chrome.storage.local.set({ selectedStore });
                
                // Force refresh data for new store
                await loadAndUpdateData(true);
                
                logToPanel('🏪 Zmieniono sklep na: ' + selectedStore, 'info');
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

// Funkcja inicjalizująca przełącznik języka
function initializeLanguageSwitcher() {
    const languageButtons = document.querySelectorAll('[data-lang]');
    
    // Pobierz aktualny język z localStorage lub użyj domyślnego
    const currentLang = localStorage.getItem('language') || 'polish';
    
    // Usuń klasę active ze wszystkich przycisków
    languageButtons.forEach(btn => {
        btn.classList.remove('active');
        
        // Dodaj klasę active do przycisku odpowiadającego aktualnemu językowi
        if (btn.dataset.lang === currentLang) {
            btn.classList.add('active');
        }
        
        // Dodaj obsługę kliknięcia
        btn.addEventListener('click', async function() {
            const lang = this.dataset.lang;
            
            // Usuń klasę active ze wszystkich przycisków
            languageButtons.forEach(b => b.classList.remove('active'));
            
            // Dodaj klasę active do klikniętego przycisku
            this.classList.add('active');
            
            // Zapisz wybrany język
            localStorage.setItem('language', lang);
            
            try {
                // Załaduj nowe tłumaczenia
                await i18n.init();
                
                // Zaktualizuj interfejs
                updateInterface();
                
                // Odśwież tooltips
                initializeTooltips();
                
                logToPanel(`🌍 Zmieniono język na: ${lang}`, 'success');
            } catch (error) {
                logToPanel('❌ Błąd podczas zmiany języka', 'error');
                console.error('Language switch error:', error);
            }
        });
    });

    // Inicjalizacja tooltipów przy starcie
    initializeTooltips();
}

// Inicjalizacja przełącznika motywu
function initializeThemeSwitcher() {
    const themeSwitch = document.getElementById('theme-switch');
    if (!themeSwitch) return;

    // Ustaw początkowy stan
    const currentTheme = themeService.getCurrentTheme();
    themeSwitch.checked = currentTheme === 'dark';

    // Obsługa zmiany motywu
    themeSwitch.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        themeService.applyTheme(newTheme);
    });
}

// Modify the function that updates counters to use the loader
function showLoader(counter) {
    counter.innerHTML = `
        <div class="loading-dots">
            <div class="loading-dots--dot"></div>
            <div class="loading-dots--dot"></div>
            <div class="loading-dots--dot"></div>
        </div>
    `;
    counter.classList.add('loading');
}

// Dodaj tę funkcję do initializeUIComponents
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.nav-link');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const targetId = button.getAttribute('data-target');
            
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('show', 'active'));
            
            // Add active class to clicked button and its target pane
            button.classList.add('active');
            document.querySelector(targetId)?.classList.add('show', 'active');

            // If DRWN tab is activated, update its data
            if (targetId === '#drwn') {
                await updateDrwnData();
            }
        });
    });
}

// Inicjalizacja przycisków statusu
function initializeStatusButtons() {
    const runTestsButton = document.getElementById('run-tests');
    const checkStatusButton = document.getElementById('check-status');
    const checkOrdersBtn = document.getElementById('check-orders');

    if (runTestsButton) {
        runTestsButton.addEventListener('click', async () => {
            logToPanel('🔍 Uruchamiam testy...', 'info');
            await updateAllStatuses();
        });
    }

    if (checkStatusButton) {
        checkStatusButton.addEventListener('click', async () => {
            logToPanel('🔄 Odświeżam status...', 'info');
            await fetchDarwinaData();
        });
    }

    if (checkOrdersBtn) {
        checkOrdersBtn.addEventListener('click', async () => {
            try {
                logToPanel('📦 Sprawdzam i aktualizuję formy dostawy...', 'info');
                const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                
                if (response?.success) {
                    logToPanel('✅ Zaktualizowano formy dostawy', 'success');
                    // Odśwież dane po aktualizacji
                    await fetchDarwinaData();
                } else {
                    throw new Error(response?.error || 'Nieznany błąd');
                }
            } catch (error) {
                logToPanel('❌ Błąd podczas aktualizacji form dostawy', 'error', error.message);
            }
        });
    }
}

// Funkcja aktualizująca statusy
async function updateAllStatuses(fullTest = false) {
    try {
        // Pokaż loader dla wszystkich statusów
        ['api', 'auth', 'orders', 'cache'].forEach(service => {
            const dot = document.getElementById(`${service}-status`);
            if (dot) {
                dot.className = 'status-dot';
                dot.style.opacity = '0.5';
            }
        });

        const statuses = {
            'api-status': await checkApiStatus(),
            'auth-status': await checkAuthStatus(),
            'orders-status': await checkOrdersStatus(),
            'cache-status': await checkCacheStatus()
        };

        // Aktualizuj kropki statusu
        Object.entries(statuses).forEach(([id, status]) => {
            const dot = document.getElementById(id);
            if (dot) {
                dot.className = `status-dot status-${status ? 'green' : 'red'}`;
                dot.style.opacity = '1';
            }
        });

        // Pokaż powiadomienie o zakończeniu testów
        if (fullTest) {
            logToPanel(i18n.translate('testsCompleted'), 'success');
        }
    } catch (error) {
        logToPanel(i18n.translate('errorStatusCheck'), 'error', error);
    }
}

// Funkcja inicjalizująca selector użytkowników
function initializeUserSelect() {
    const userSelect = document.getElementById('user-select');
    if (!userSelect) return;

    // Pobierz listę użytkowników
    fetch('users/manifest.json')
        .then(response => response.json())
        .then(users => {
            // Sortuj użytkowników alfabetycznie po nazwie
            users.sort((a, b) => a.fullName.localeCompare(b.fullName));

            // Dodaj opcję domyślną
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.setAttribute('data-i18n', 'noUserSelected');
            defaultOption.textContent = i18n.get('noUserSelected');
            userSelect.appendChild(defaultOption);

            // Dodaj posortowanych użytkowników
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.fullName;
                userSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Błąd podczas ładowania listy użytkowników:', error);
            logToPanel('Błąd podczas ładowania listy użytkowników', 'error', error);
        });
}

// Funkcja aktualizująca liczniki z zapisem do pamięci
async function updateLeadCounts(newCounts, oldCounts = {}) {
    try {
        // Zapisz nowe liczniki do pamięci tylko jeśli są różne od poprzednich
        const { leadCounts: currentCounts } = await chrome.storage.local.get('leadCounts');
        if (JSON.stringify(newCounts) !== JSON.stringify(currentCounts)) {
            await chrome.storage.local.set({ leadCounts: newCounts });
            
            for (const [status, count] of Object.entries(newCounts)) {
                const countElement = document.getElementById(`count-${status}`);
                if (!countElement) continue;

                // Zapisz poprzednią wartość
                const previousCount = oldCounts[status] || 0;
                
                // Aktualizuj licznik
                countElement.textContent = count;
                countElement.classList.toggle('count-zero', count === 0);
                countElement.classList.add('count-updated');
                setTimeout(() => countElement.classList.remove('count-updated'), 1000);

                // Sprawdź czy licznik statusu 1 lub 2 się zwiększył
                if ((status === '1' || status === '2') && count > previousCount) {
                    chrome.notifications.create(`status-update-${status}`, {
                        type: 'basic',
                        iconUrl: 'icon128.png',
                        title: i18n.translate('statusUpdate'),
                        message: i18n.translate('statusChangeFormat', {
                            status: status,
                            previous: previousCount,
                            current: count
                        }),
                        priority: 1
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error updating lead counts:', error);
        logToPanel(i18n.translate('errorCounterUpdate'), 'error', error);
    }
}

// Funkcja ładująca liczniki z pamięci
async function loadLeadCounts() {
    try {
        const { leadCounts } = await chrome.storage.local.get('leadCounts');
        if (leadCounts) {
            // Aktualizuj UI bez powiadomień
            for (const [status, count] of Object.entries(leadCounts)) {
                const countElement = document.getElementById(`count-${status}`);
                if (countElement) {
                    countElement.textContent = count;
                    // Dodaj/usuń klasę count-zero w zależności od wartości
                    countElement.classList.toggle('count-zero', count === 0);
                }
            }
        }
    } catch (error) {
        console.error('Error loading lead counts:', error);
        logToPanel('❌ Błąd ładowania liczników', 'error', error);
    }
}

// Funkcja weryfikująca hasło debug mode
async function verifyDebugPassword() {
    const password = prompt(i18n.translate('debugPasswordPrompt'), '');
    return password === 'tango';
}

// Funkcja inicjalizująca przełącznik debug mode
function initializeDebugSwitch() {
    const debugButton = document.getElementById('debug-button');
    if (!debugButton) return;
    
    // Ustaw początkowy stan
    const isDebugEnabled = localStorage.getItem('debug-enabled') === 'true';
    document.body.classList.toggle('debug-enabled', isDebugEnabled);
    if (isDebugEnabled) {
        debugButton.classList.add('active');
    }
    
    debugButton.addEventListener('click', async () => {
        const isCurrentlyEnabled = document.body.classList.contains('debug-enabled');
        
        if (!isCurrentlyEnabled) {
            if (await verifyDebugPassword()) {
                document.body.classList.add('debug-enabled');
                debugButton.classList.add('active');
                await chrome.storage.local.set({ debugMode: true });
                localStorage.setItem('debug-enabled', 'true');
                logToPanel(i18n.translate('debugEnabled'), 'success');
            }
        } else {
            document.body.classList.remove('debug-enabled');
            debugButton.classList.remove('active');
            await chrome.storage.local.set({ debugMode: false });
            localStorage.setItem('debug-enabled', 'false');
            logToPanel(i18n.translate('debugDisabled'), 'info');
        }
        
        setTimeout(adjustWindowHeight, 50);
    });
}

// Funkcja inicjalizująca tooltips
function initializeTooltips() {
    // Usuń stare tooltips
    if (tooltipList.length > 0) {
        tooltipList.forEach(tooltip => tooltip.dispose());
        tooltipList = [];
    }

    // Zaktualizuj teksty tooltipów przed inicjalizacją
    const statusElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    statusElements.forEach((el, index) => {
        const statusKeys = ['submitted', 'confirmed', 'accepted', 'ready', 'overdue'];
        const key = statusKeys[index];
        if (key && i18n.translations?.leadStatuses?.[key]) {
            el.setAttribute('title', i18n.translate(`leadStatuses.${key}`));
        }
    });

    // Zainicjuj nowe tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => 
        new bootstrap.Tooltip(tooltipTriggerEl, {
            boundary: document.body,
            placement: 'right'
        })
    );
}

// Funkcja sprawdzająca dostęp do debug mode
async function checkDebugAccess() {
    const debugEnabled = document.body.classList.contains('debug-enabled');
    if (!debugEnabled) {
        if (await verifyDebugPassword()) {
            document.body.classList.add('debug-enabled');
            const debugSwitch = document.getElementById('debug-switch');
            if (debugSwitch) {
                debugSwitch.checked = true;
            }
            await chrome.storage.local.set({ debugMode: true });
            logToPanel(i18n.translate('debugEnabled'), 'success');
            return true;
        } else {
            alert(i18n.translate('debugPasswordIncorrect'));
            return false;
        }
    }
    return true;
}

// Modyfikacja obsługi kliknięcia w panel debug
document.querySelector('.debug-panel')?.addEventListener('mouseenter', async (e) => {
    if (!document.body.classList.contains('debug-enabled')) {
        if (!await checkDebugAccess()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }
});

// Funkcja generująca URL dla zamówień
function generateOrdersUrl(status, storeId) {
    const baseUrl = 'https://darwina.pl/adm/';
    const params = new URLSearchParams({
        'a': 'zamowienia',
        'sk': '',
        'opid': '0',
        'pcid': '0',
        'daid': storeId || '0',
        'sztyp': 'pid',
        'sztxt': '',
        'ptid': '',
        'dw': '0',
        'dp': '',
        'dk': ''
    });

    // Oblicz datę 14 dni wstecz
    const date = new Date();
    date.setDate(date.getDate() - 14);
    const formattedDate = date.toISOString().split('T')[0];

    // Dodaj odpowiednie parametry w zależności od statusu
    switch (status) {
        case 'submitted':
            params.set('st', '1');
            params.set('s[]', '1');
            break;
        case 'confirmed':
            params.set('st', '2');
            params.set('s[]', '2');
            break;
        case 'accepted':
            params.set('st', '3');
            params.set('s[]', '3');
            break;
        case 'ready':
            params.set('st', '5');
            params.set('s[]', '5');
            params.set('dp', formattedDate); // Pokaż tylko zamówienia od 14 dni wstecz
            break;
        case 'overdue':
            params.set('st', '5');
            params.set('s[]', '5');
            params.set('dk', formattedDate); // Pokaż tylko zamówienia starsze niż 14 dni
            break;
    }

    return `${baseUrl}?${params.toString()}`;
}

// Dodaj obsługę dla wszystkich statusów
document.querySelectorAll('.lead-status').forEach(statusElement => {
    const dataStatus = statusElement.getAttribute('data-status');
    const status = STATUS_MAP[dataStatus];
    
    if (status) {
        statusElement.style.cursor = 'pointer';
        statusElement.addEventListener('mouseup', (event) => {
            // Obsługuj tylko lewy (1) i środkowy (2) przycisk myszy
            if (event.button !== 0 && event.button !== 1) return;
            
            // Pobierz aktualnie wybrany sklep
            const storeSelect = document.getElementById('store-select');
            const selectedStore = storeSelect?.value;
            
            // Logowanie dla debugowania
            console.log('Selected store:', selectedStore);
            
            // Pobierz ID sklepu tylko jeśli nie jest to 'ALL'
            const selectedStoreId = selectedStore !== 'ALL' ? getStoreId(selectedStore) : null;
            console.log('Store ID:', selectedStoreId);
            
            // Generuj URL tylko z ID sklepu jeśli jest dostępne
            const url = generateOrdersUrl(status, selectedStoreId || '0');
            console.log('Generated URL:', url);
            
            // Otwórz link w nowej karcie
            window.open(url, '_blank');
            
            // Zapobiegaj domyślnej akcji dla środkowego przycisku
            if (event.button === 1) {
                event.preventDefault();
            }
        });
    }
});

// Funkcja pomocnicza do mapowania kodu sklepu na ID
function getStoreId(storeCode) {
    if (storeCode === 'ALL') return null;
    const store = stores.find(s => s.id === storeCode);
    return store ? store.deliveryId.toString() : null;
}

// Funkcja do aktualizacji danych DRWN
async function updateDrwnData() {
    const drwnTable = document.getElementById('drwn-data');
    if (drwnTable) {
        drwnTable.classList.add('loading');
    }

    try {
        const selectedStore = document.getElementById('store-select').value;
        if (!selectedStore || selectedStore === 'ALL') {
            const tbody = document.getElementById('drwn-body');
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Wybierz sklep aby zobaczyć dane</td></tr>';
            return;
        }

        // Znajdź sklep w konfiguracji
        const store = stores.find(s => s.id === selectedStore);
        if (!store || !store.drwn) {
            throw new Error(`Brak danych DRWN dla sklepu ${selectedStore}`);
        }

        // Pobierz dane z odpowiedniej zakładki
        const { headers, rows } = await DrwnService.getSheetData(store.drwn);
        
        // Indeksy kolumn które chcemy wyświetlić (B=1, C=2, E=4, G=6)
        const columnIndexes = [1, 2, 4, 6];
        const columnNames = ['Kod', 'Nazwa', 'Stan', 'MAG'];
        
        // Update headers - tylko wybrane kolumny
        const headerRow = document.getElementById('drwn-headers');
        headerRow.innerHTML = columnNames
            .map(name => `<th>${name}</th>`)
            .join('');
        
        // Filtruj i wyświetl wiersze
        const tbody = document.getElementById('drwn-body');
        if (rows.length > 0) {
            // Funkcja pomocnicza do określania minimalnej wartości dla kolumny G
            const getMinimumGValue = (productName) => {
                if (!productName) return 0;
                productName = productName.trim().toUpperCase();
                
                if (productName.endsWith('DRWN') && !productName.endsWith('DRWN2') && !productName.endsWith('DRWN3') && !productName.endsWith('DRWNG')) return 6;
                if (productName.endsWith('DRWN2')) return 3;
                if (productName.endsWith('DRWN3')) return 1;
                if (productName.endsWith('DRWNG')) return 2;
                return 0;
            };

            // Filtruj wiersze
            const filteredRows = rows.filter(row => {
                const shopStock = parseFloat(row[4] || '0'); // Kolumna E
                const drwnStock = parseFloat(row[6] || '0'); // Kolumna G
                const productName = String(row[2] || '').trim(); // Kolumna C
                
                // Jeśli nie ma nazwy produktu lub wartości są nieprawidłowe, pomiń wiersz
                if (!productName || isNaN(shopStock) || isNaN(drwnStock)) {
                    return false;
                }

                const minGValue = getMinimumGValue(productName);
                // console.log(`Product: ${productName}, Min G Value: ${minGValue}, Current G Value: ${drwnStock}, Shop Stock: ${shopStock}`);
                
                return shopStock <= 1 && drwnStock >= minGValue;
            });

            if (filteredRows.length > 0) {
                tbody.innerHTML = filteredRows
                    .map(row => {
                        const shopStock = parseFloat(row[4] || '0');
                        const drwnStock = parseFloat(row[6] || '0');
                        
                        return `<tr>
                            <td title="${row[1] || ''}">${row[1] || ''}</td>
                            <td title="${row[2] || ''}">${row[2] || ''}</td>
                            <td title="Stan w sklepie: ${shopStock}">${shopStock.toFixed(0)}</td>
                            <td title="Stan DRWN: ${drwnStock}">${drwnStock.toFixed(0)}</td>
                        </tr>`;
                    })
                    .join('');
                logToPanel(`✅ Znaleziono ${filteredRows.length} produktów spełniających warunki`, 'success');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Brak produktów spełniających warunki</td></tr>';
                logToPanel('ℹ️ Brak produktów spełniających warunki', 'info');
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Brak danych</td></tr>';
            logToPanel('ℹ️ Brak danych w arkuszu', 'info');
        }

        logToPanel(`✅ Zaktualizowano dane DRWN dla sklepu ${store.name}`, 'success');
    } catch (error) {
        console.error('Error updating DRWN data:', error);
        logToPanel('❌ Błąd aktualizacji danych DRWN', 'error', error.message);
        
        // Pokaż błąd w tabeli
        const tbody = document.getElementById('drwn-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-message text-danger">Błąd: ${error.message}</td></tr>`;
        }
    } finally {
        if (drwnTable) {
            drwnTable.classList.remove('loading');
        }
    }
}

// Funkcja do pobierania danych rankingu
async function updateRankingData() {
    const SHEET_ID = '1gRAuqAbHrFR76Not6tjKLfvNz8FS_S2Uzo0GTQnMTWI';
    const SHEET_NAME = '2024-12';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&range=B:C`;

    try {
        logToPanel('🔄 Pobieram dane rankingu...', 'info');
        const response = await fetch(url);
        const text = await response.text();
        
        // Wyciągamy właściwy JSON z odpowiedzi
        const jsonData = JSON.parse(text.substring(47).slice(0, -2));
        
        const tbody = document.querySelector('#ranking-data tbody');
        tbody.innerHTML = '';

        // Pomijamy pierwszy wiersz (nagłówki)
        jsonData.table.rows.forEach((row, index) => {
            // if (index === 0) return; // Pomijamy nagłówek
            
            const position = row.c[0]?.v || ''; // Kolumna B (pozycja)
            const name = row.c[1]?.v || '';     // Kolumna C (imię i nazwisko)
            
            if (position && name) { // Dodajemy wiersz tylko jeśli mamy pozycję i nazwisko
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${position}</td>
                    <td>${name}</td>
                `;
                tbody.appendChild(tr);
            }
        });
        
        logToPanel('✅ Zaktualizowano ranking', 'success');
    } catch (error) {
        console.error('Błąd podczas pobierania danych rankingu:', error);
        logToPanel('❌ Błąd podczas pobierania danych rankingu', 'error', error.message);
        
        const tbody = document.querySelector('#ranking-data tbody');
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-danger">Błąd podczas pobierania danych</td></tr>';
    }
}

// Funkcja czyszcząca ranking
function cleanupRanking() {
    if (rankingManager) {
        rankingManager.destroyCharts();
        rankingManager = null;
    }
}

// Initialize ranking functionality
document.querySelectorAll('.nav-link').forEach(tab => {
    tab.addEventListener('click', async function (event) {
        const targetId = this.getAttribute('data-target');
        if (targetId === '#ranking') {
            await initializeRanking();
        } else if (rankingManager) {
            cleanupRanking();
        }
    });
});

// Initialize refresh button functionality
function initializeRefreshButton() {
    const refreshButton = document.getElementById('refresh-store-data');
    if (!refreshButton) return;

    refreshButton.addEventListener('click', async () => {
        // Show loading state
        refreshButton.disabled = true;
        const icon = refreshButton.querySelector('.bi-arrow-clockwise');
        if (icon) {
            icon.classList.add('rotate');
        }
        
        try {
            // Force refresh data
            await loadAndUpdateData(true);
            logToPanel('🔄 Odświeżono dane', 'success');
        } catch (error) {
            logToPanel('❌ Błąd odświeżania danych', 'error', error);
        } finally {
            // Reset button state
            refreshButton.disabled = false;
            const icon = refreshButton.querySelector('.bi-arrow-clockwise');
            if (icon) {
                icon.classList.remove('rotate');
            }
        }
    });
}

// Funkcja inicjalizująca linki statusów
function initializeLeadStatusLinks() {
    document.querySelectorAll('.lead-status').forEach(statusElement => {
        const dataStatus = statusElement.getAttribute('data-status');
        const status = dataStatus; // We already have the correct status from data-status
        
        if (status) {
            statusElement.style.cursor = 'pointer';
            statusElement.addEventListener('mousedown', (event) => {
                // Obsługuj tylko lewy (0) i środkowy (1) przycisk myszy
                if (event.button !== 0 && event.button !== 1) return;
                
                // Zapobiegaj domyślnej akcji dla środkowego przycisku
                if (event.button === 1) {
                    event.preventDefault();
                }
                
                // Pobierz aktualnie wybrany sklep
                const storeSelect = document.getElementById('store-select');
                const selectedStore = storeSelect?.value;
                
                // Pobierz ID sklepu tylko jeśli nie jest to 'ALL'
                const selectedStoreId = selectedStore !== 'ALL' ? getStoreId(selectedStore) : null;
                
                // Generuj URL tylko z ID sklepu jeśli jest dostępne
                const url = generateOrdersUrl(status, selectedStoreId || '0');
                
                // Otwórz link w nowej karcie
                if (event.button === 1) {
                    // Dla środkowego przycisku używamy window.open aby zachować popup otwarty
                    window.open(url, '_blank');
                } else {
                    // Dla lewego przycisku używamy chrome.tabs.create aby zachować standardowe zachowanie
                    chrome.tabs.create({ url: url });
                }
            });
        }
    });
}

// Funkcja inicjalizująca elementy statusów
function initializeStatusElements() {
    const statusElements = document.querySelectorAll('.lead-status');
    const statusMap = {
        'count-1': 'submitted',
        'count-2': 'confirmed',
        'count-3': 'accepted',
        'count-ready': 'ready',
        'count-overdue': 'overdue'
    };

    statusElements.forEach(element => {
        const countElement = element.querySelector('.lead-count');
        if (countElement) {
            const countId = countElement.id;
            const status = statusMap[countId];
            if (status) {
                element.setAttribute('data-status', status);
            }
        }
    });
}

// Dodaj listener dla wiadomości z testRunner.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'show-alert') {
        alert(message.message);
    }
    
    // Obsługa wyników testów
    if (message.action === 'test-results' && message.results) {
        const results = message.results;
        
        // Aktualizuj liczniki
        document.querySelector('#passed-tests').textContent = results.passed;
        document.querySelector('#failed-tests').textContent = results.failed;
        document.querySelector('#test-duration').textContent = `${results.duration}ms`;

        // Aktualizuj szczegóły testów
        const detailsContainer = document.querySelector('#test-details');
        if (detailsContainer && results.testResults) {
            detailsContainer.innerHTML = ''; // Wyczyść poprzednie wyniki
            
            results.testResults.forEach(test => {
                const testElement = document.createElement('div');
                testElement.className = `test-item d-flex justify-content-between align-items-center p-2 ${
                    test.status === 'passed' ? 'text-success' : 'text-danger'
                }`;
                
                testElement.innerHTML = `
                    <div class="test-name">
                        <i class="bi ${test.status === 'passed' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
                        ${test.name}
                    </div>
                    <div class="test-info">
                        ${test.status === 'failed' ? `<span class="error-message me-2">${test.error}</span>` : ''}
                        <span class="duration">${test.duration}ms</span>
                    </div>
                `;
                
                detailsContainer.appendChild(testElement);
            });
        }
    }
    
    // Obsługa błędów testów
    if (message.action === 'test-error') {
        console.error('Test error:', message.error);
        alert(`Test error: ${message.error}`);
    }

    // Zawsze wysyłaj odpowiedź
    sendResponse({ received: true });
    return true; // Informuje Chrome, że odpowiedź będzie wysłana asynchronicznie
});

// Modify the click handler
document.getElementById('run-all-tests')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ 
        action: 'run-all-tests',
        source: 'popup'
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('Expected message port closure');
            return;
        }
        console.log('Message sent, response:', response);
    });
});

// W listenerze wiadomości
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.action === 'show-alert') {
        alert(message.message);
        sendResponse({ received: true });
    }
    
    if (message.action === 'test-results' && message.results) {
        const results = message.results;
        updateTestResults(results);  // Wydzielamy aktualizację UI do osobnej funkcji
        sendResponse({ received: true });
    }
    
    if (message.action === 'test-error') {
        console.error('Test error:', message.error);
        alert(`Test error: ${message.error}`);
        sendResponse({ received: true });
    }

    return true;
});

// Nowa funkcja do aktualizacji UI z wynikami testów
function updateTestResults(results) {
    const passedElement = document.querySelector('#passed-tests');
    const failedElement = document.querySelector('#failed-tests');
    const durationElement = document.querySelector('#test-duration');
    const testPanel = document.querySelector('#testPanel');

    if (passedElement) passedElement.textContent = results.passed;
    if (failedElement) failedElement.textContent = results.failed;
    if (durationElement) durationElement.textContent = `${results.duration}ms`;

    if (testPanel && results.testResults) {
        // Zachowaj pozycję scrolla
        const oldDetails = document.querySelector('#test-details');
        const scrollTop = oldDetails ? oldDetails.scrollTop : 0;

        const detailsContainer = document.createElement('div');
        detailsContainer.id = 'test-details';
        detailsContainer.className = 'mt-2';
        
        results.testResults.forEach(test => {
            const testRow = document.createElement('div');
            testRow.className = `test-row d-flex justify-content-between align-items-center p-1 ${
                test.status === 'passed' ? 'text-success' : 'text-danger'
            }`;
            
            const statusIcon = test.status === 'passed' ? 
                '<i class="bi bi-check-circle-fill text-success"></i>' : 
                '<i class="bi bi-x-circle-fill text-danger"></i>';

            const errorDetails = test.error ? `
                <div class="error-details small text-danger mt-1">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    ${test.error}
                    ${test.details ? `
                        <div class="mt-1">
                            <strong>Expected:</strong> ${JSON.stringify(test.details.expected)}<br>
                            <strong>Actual:</strong> ${JSON.stringify(test.details.actual)}
                        </div>
                    ` : ''}
                </div>
            ` : '';
            
            testRow.innerHTML = `
                <div class="test-info flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="test-name">
                            ${statusIcon}
                            <span class="ms-2">${test.name}</span>
                        </span>
                        <span class="test-meta">
                            <small class="text-muted">${test.duration}ms</small>
                        </span>
                    </div>
                    ${errorDetails}
                </div>
            `;
            
            detailsContainer.appendChild(testRow);
        });

        // Usuń poprzednie wyniki jeśli istnieją
        if (oldDetails) {
            oldDetails.remove();
        }

        // Dodaj nowe wyniki
        testPanel.appendChild(detailsContainer);

        // Przywróć pozycję scrolla
        if (scrollTop > 0) {
            detailsContainer.scrollTop = scrollTop;
        }
    }
}

// Funkcja inicjalizująca paski postępu dla testów
function initializeTestProgress(tests) {
    const progressContainer = document.getElementById('test-progress');
    if (!progressContainer) return;

    progressContainer.classList.remove('hidden');
    progressContainer.innerHTML = '';

    tests.forEach((test, index) => {
        const progressItem = document.createElement('div');
        progressItem.className = 'test-progress-item';
        progressItem.id = `test-progress-${index}`;
        progressItem.innerHTML = `
            <div class="test-name">
                <span>${test.name}</span>
                <span class="duration">0ms</span>
            </div>
            <div class="progress">
                <div class="progress-bar" role="progressbar" style="width: 0%"></div>
            </div>
        `;
        progressContainer.appendChild(progressItem);
    });
}

// Funkcja aktualizująca pasek postępu dla testu
function updateTestProgress(index, progress, status, duration) {
    const progressItem = document.getElementById(`test-progress-${index}`);
    if (!progressItem) return;

    const progressBar = progressItem.querySelector('.progress-bar');
    const durationElement = progressItem.querySelector('.duration');

    progressBar.style.width = `${progress}%`;
    durationElement.textContent = `${duration}ms`;

    // Usuń poprzednie klasy statusu
    progressItem.classList.remove('completed', 'failed', 'running');

    // Dodaj odpowiednią klasę statusu
    switch (status) {
        case 'completed':
            progressItem.classList.add('completed');
            break;
        case 'failed':
            progressItem.classList.add('failed');
            break;
        case 'running':
            progressItem.classList.add('running');
            break;
    }
}

// Cleanup on extension unload
window.addEventListener('unload', () => {
    if (rankingManager) {
        rankingManager.destroyCharts();
        rankingManager = null;
    }
});

// Volume Control Functionality
function initializeVolumeControl() {
    const volumeButton = document.getElementById('volume-button');
    const volumeSlider = document.getElementById('volume-slider');
    let previousVolume = 100;

    // Load saved volume settings
    chrome.storage.local.get(['volume', 'isMuted'], ({ volume, isMuted }) => {
        if (typeof volume === 'number') {
            volumeSlider.value = volume;
            previousVolume = volume;
        }
        if (isMuted) {
            volumeButton.classList.add('muted');
            volumeSlider.value = 0;
        }
    });

    // Handle mute button click
    volumeButton.addEventListener('click', () => {
        const isMuted = volumeButton.classList.toggle('muted');
        if (isMuted) {
            previousVolume = volumeSlider.value;
            volumeSlider.value = 0;
        } else {
            volumeSlider.value = previousVolume;
        }
        chrome.storage.local.set({ 
            isMuted,
            volume: isMuted ? 0 : previousVolume 
        });
    });

    // Handle volume slider change
    volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        if (volume === 0) {
            volumeButton.classList.add('muted');
        } else {
            volumeButton.classList.remove('muted');
            previousVolume = volume;
        }
        chrome.storage.local.set({ 
            volume,
            isMuted: volume === 0
        });
    });
}

// Zakładki
function updateMenuItems() {
    console.log('🔄 Aktualizuję elementy menu...');
    const menuItems = document.querySelectorAll('.menu .link');
    menuItems.forEach(item => {
        const menuText = item.querySelector('.menu-text');
        if (menuText) {
            const key = menuText.getAttribute('data-i18n');
            if (key) {
                console.log(`📝 Aktualizuję tekst menu dla klucza: ${key}`);
                menuText.textContent = i18n.translate(key);
            }
        }
    });
}

// ... existing code ...

// Dodaj wywołanie w funkcji updateInterface
// function updateInterface() {
//     console.log('🔄 Rozpoczynam aktualizację interfejsu...');
//     updateMenuItems();
//     initTooltips();
//     initializeMenu();
//     // ... reszta kodu updateInterface ...
// }

function initTooltips() {
    console.log('🔄 Inicjalizuję tooltips...');
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(element => {
        const tooltipKey = element.getAttribute('data-i18n-tooltip');
        if (tooltipKey) {
            console.log(`📝 Ustawiam tooltip dla klucza: ${tooltipKey}`);
            element.setAttribute('title', i18n.translate(`tooltips.${tooltipKey}`));
            new bootstrap.Tooltip(element);
        }
    });
}

// Inicjalizacja menu
function initializeMenu() {
    console.log('🔄 Inicjalizuję menu...');
    const menuLinks = document.querySelectorAll('.menu .link');
    
    // Wczytaj ostatnio aktywną zakładkę
    const lastActiveTab = localStorage.getItem('lastActiveTab') || '#orders';
    
    menuLinks.forEach(link => {
        const targetId = link.getAttribute('data-target');
        
        // Ustaw aktywną zakładkę
        if (targetId === lastActiveTab) {
            link.classList.add('active');
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
        }
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Usuń klasę active z wszystkich linków
            menuLinks.forEach(l => l.classList.remove('active'));
            
            // Dodaj klasę active do klikniętego linku
            link.classList.add('active');
            
            // Pokaż odpowiednią zakładkę
            const targetId = link.getAttribute('data-target');
            if (targetId) {
                // Zapisz aktywną zakładkę
                localStorage.setItem('lastActiveTab', targetId);
                
                const tabPanes = document.querySelectorAll('.tab-pane');
                tabPanes.forEach(pane => {
                    pane.classList.remove('show', 'active');
                });
                
                const targetPane = document.querySelector(targetId);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                }
            }
        });
    });
}

// Cleanup when popup is closed
window.addEventListener('unload', () => {
    disposeManagers();
});

// Add error listener for UI feedback
errorHandler.addListener((error) => {
    if (error.severity === 'critical' || error.severity === 'error') {
        uiManager.showMessage('error', error.message);
    }
});

