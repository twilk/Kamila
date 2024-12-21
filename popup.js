import { API } from './services/index.js';
import { API_BASE_URL, API_CONFIG } from '../config/api.js';
import { getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { i18n } from './services/i18n.js';
import { CacheService } from './services/cache.js';
import { UserCardService } from './services/userCard.js';
import { 
    checkApiStatus, 
    checkAuthStatus, 
    checkOrdersStatus, 
    checkCacheStatus 
} from './services/api.js';
import { stores, isPickupDelivery, formatPickupPoint } from './config/stores.js';
import { themeManager } from './services/theme.manager.js';
import { ThemePanel } from './services/theme.panel.js';
import { accessibilityService } from './services/accessibility.js';
import { performanceMonitor } from './services/performance.js';
import { performancePanel } from './components/performance-panel.js';
import { NotificationService } from './services/notification.service.js';
import { NotificationCenter } from './components/notification-center.js';
import { CustomThemeModal } from './components/custom-theme-modal.js';
import { DebugPanel } from './components/debug-panel.js';

// Constants
const CACHE_KEY = 'darwina_orders_data';
const REFRESH_INTERVAL = 60000;
const DEBUG_MODE = chrome.runtime.getManifest().version.includes('-dev') || 
                  new URLSearchParams(window.location.search).has('debug');

// Global variables
let tooltipList = [];
let refreshCount = 0;
let isInitialized = false;
let customThemeModal = null;
let debugPanel = null;

// Performance-monitored functions
async function fetchData(selectedStore) {
    performanceMonitor.startMeasure('api-fetch');
    try {
        const credentials = await getDarwinaCredentials();
        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_DARWINA_DATA',
            selectedStore,
            headers: {
                'Authorization': `Bearer ${credentials.DARWINA_API_KEY}`
            }
        });
        performanceMonitor.endMeasure('api-fetch');
        return response;
    } catch (error) {
        performanceMonitor.endMeasure('api-fetch');
        console.error('Błąd podczas pobierania danych z API:', error);
        throw error;
    }
}

async function getCachedData(key) {
    performanceMonitor.startMeasure('cache-read');
    try {
        const data = await chrome.storage.local.get(key);
        performanceMonitor.endMeasure('cache-read');
        return data[key];
    } catch (error) {
        performanceMonitor.endMeasure('cache-read');
        throw error;
    }
}

function updateUI(data) {
    performanceMonitor.startMeasure('ui-update');
    try {
        // Najpierw pokaż stan ładowania we wszystkich counterach
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '...';
            counter.classList.add('loading');
            counter.classList.remove('error', 'updated');
        });

        // UI update logic here
        updateInterface(data);

        // Aktualizuj countery tylko jeśli są dane
        if (data?.statusCounts) {
            updateCounters(data);
        } else {
            console.warn('No status counts in data');
            // Pokaż brak danych
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '-';
                counter.classList.remove('loading');
                counter.classList.add('empty');
            });
        }
    } catch (error) {
        console.error('Error updating UI:', error);
        // Pokaż błąd w counterach
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '-';
            counter.classList.remove('loading', 'updated');
            counter.classList.add('error');
        });
    } finally {
        performanceMonitor.endMeasure('ui-update');
    }
}

async function initializeUIComponents() {
    try {
        // 1. Najpierw serwisy podstawowe
        await i18n.init();
        await NotificationService.init();
        await themeManager.init();

        // 2. Komponenty UI w odpowiedniej kolejności
        await Promise.all([
            new NotificationCenter(),
            initializeLanguageSwitcher(),  // Wymaga i18n
            initializeThemeButtons(),      // Wymaga themeManager
        ]);
        
        // 3. Komponenty zależne od danych
        await Promise.all([
            initializeStoreSelect(),       // Wymaga stores i updateUI
            initializeUserSelector()       // Wymaga UserCardService
        ]);
        
        // 4. Debugowanie na końcu
        await initializeDebugMode();

        // 5. Finalne inicjalizacje
        initializeTooltips();
        await updateAllStatuses();
        
        logToPanel('Komponenty UI zainicjalizowane', 'success');
    } catch (error) {
        console.error('Error initializing UI components:', error);
        logToPanel('❌ Błąd podczas inicjalizacji komponentów UI: ' + error.message, 'error');
        throw error;
    }
}

// Rest of your code...

// Add debug initialization
async function initializeDebugMode() {
    const debugSwitch = document.getElementById('debug-switch');
    const debugPanel = document.querySelector('.debug-panel');
    const debugLogs = document.getElementById('debug-logs');
    
    if (!debugSwitch || !debugPanel || !debugLogs) {
        console.error('Debug elements not found');
        return;
    }

    try {
        console.log('Initializing debug mode...');
        
        // Get debug state from storage
        const { debugMode } = await chrome.storage.local.get('debugMode');
        const enabled = debugMode || DEBUG_MODE;
        
        // Synchronizuj stan
        debugSwitch.checked = enabled;
        document.body.classList.toggle('debug-enabled', enabled);
        debugPanel.classList.toggle('show', enabled);
        localStorage.setItem('debug-enabled', enabled);

        // Inicjalizuj panel debugowania
        if (enabled && !debugPanel) {
            debugPanel = new DebugPanel();
        }

        debugSwitch.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            try {
                document.body.classList.toggle('debug-enabled', enabled);
                debugPanel.classList.toggle('show', enabled);
                
                // Synchronizuj storage
                await chrome.storage.local.set({ debugMode: enabled });
                localStorage.setItem('debug-enabled', enabled);
                
                if (enabled) {
                    logToPanel('🔧 Debug mode enabled', 'info');
                    performancePanel.show();
                    // Inicjalizuj panel jeśli nie istnieje
                    if (!debugPanel) {
                        debugPanel = new DebugPanel();
                    }
                } else {
                    logToPanel('🔧 Debug mode disabled', 'info');
                    performancePanel.hide();
                }
            } catch (error) {
                console.error('Failed to update debug mode:', error);
                // Przywróć poprzedni stan
                debugSwitch.checked = !enabled;
                document.body.classList.toggle('debug-enabled', !enabled);
                debugPanel.classList.toggle('show', !enabled);
            }
        });

        // Dodaj obsługę czyszczenia logów
        document.getElementById('clear-logs')?.addEventListener('click', () => {
            debugLogs.innerHTML = '';
            logToPanel('🧹 Logs cleared', 'info');
        });
        
        console.log('Debug mode initialized');
    } catch (error) {
        console.error('Failed to initialize debug mode:', error);
    }
}

async function initializeLanguageSwitcher() {
    const languageButtons = document.querySelectorAll('.flag[data-lang]');
    if (!languageButtons.length) {
        console.error('No language buttons found');
        return;
    }

    try {
        // Inicjalizacja i18n jeśli jeszcze nie zrobiona
        if (!i18n.initialized) {
            await i18n.init();
        }

        // Ustaw aktywny język
        const currentLang = i18n.getCurrentLanguage();
        languageButtons.forEach(button => {
            if (button.dataset.lang === currentLang) {
                button.classList.add('active');
            }

            button.addEventListener('click', async () => {
                try {
                    await i18n.setLanguage(button.dataset.lang);
                    languageButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    i18n.updateDataI18n();
                } catch (error) {
                    console.error('Language switch failed:', error);
                }
            });
        });
    } catch (error) {
        console.error('Failed to initialize language switcher:', error);
    }
}

async function initializeStoreSelect() {
    const storeSelect = document.getElementById('store-select');
    if (!storeSelect) {
        console.error('Store select element not found');
        return;
    }

    try {
        // Sprawdź czy mamy dane sklepów
        if (!stores || !stores.length) {
            throw new Error('No stores data available');
        }

        // Wyczyść istniejące opcje
        storeSelect.innerHTML = '';
        storeSelect.disabled = false;

        // Wypełnij listę sklepów
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            storeSelect.appendChild(option);
        });

        // Przywróć ostatnio wybrany sklep
        const lastSelected = await chrome.storage.local.get('selectedStore')
            .then(data => data.selectedStore || 'ALL')
            .catch(() => 'ALL');
        storeSelect.value = lastSelected;

        // Załaduj początkowe dane
        fetchData(lastSelected)
            .then(data => {
                if (data) updateUI(data);
            })
            .catch(error => {
                console.error('Failed to load initial store data:', error);
                // Pokaż b��ąd w UI
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '-';
                    counter.classList.add('error');
                });
            });

        // Obsługa zmiany sklepu
        storeSelect.addEventListener('change', async () => {
            const selectedStore = storeSelect.value;
            try {
                // Pokaż stan ładowania
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '...';
                    counter.classList.add('loading');
                });

                const data = await fetchData(selectedStore);
                if (data) {
                    updateUI(data);
                    await chrome.storage.local.set({ selectedStore });
                }
            } catch (error) {
                console.error('Store selection failed:', error);
                // Przywróć poprzednią wartość
                storeSelect.value = lastSelected;
                // Pokaż błąd w UI
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '-';
                    counter.classList.add('error');
                });
            }
        });
    } catch (error) {
        console.error('Failed to initialize store select:', error);
        storeSelect.innerHTML = '<option value="">Błąd ładowania</option>';
        storeSelect.disabled = true;
    }
}

function updateCounters(data) {
    if (!data?.statusCounts || typeof data.statusCounts !== 'object') {
        console.warn('No status counts data available');
        return;
    }
    
    Object.entries(data.statusCounts).forEach(([status, count]) => {
        const counter = document.getElementById(`count-${status}`);
        if (counter) {
            // Usuń wszystkie stany
            counter.classList.remove('loading', 'error', 'empty');
            
            // Ustaw nową wartość
            const value = Number(count);
            counter.textContent = Number.isFinite(value) ? value.toString() : '-';
            
            // Dodaj klasę updated dla animacji
            counter.classList.add('updated');
        }
    });
}

function initializeThemeButtons() {
    const themeButtons = document.querySelectorAll('[data-theme]');
    if (!themeButtons.length) {
        console.error('No theme buttons found');
        return;
    }

    const currentTheme = themeManager.getCurrentTheme() || 'light';
    
    themeButtons.forEach(button => {
        // Ustaw aktywny przycisk
        if (button.dataset.theme === currentTheme) {
            button.classList.add('active');
        }
        
        button.addEventListener('click', () => {
            const theme = button.dataset.theme;
            if (theme === 'custom') {
                // Pokaż modal z ustawieniami własnego motywu
                showCustomThemeModal();
            } else {
                themeManager.setTheme(theme);
            }
            
            // Aktualizuj aktywny przycisk
            themeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

function showCustomThemeModal() {
    if (!customThemeModal) {
        customThemeModal = new CustomThemeModal(themeManager);
    }
    customThemeModal.show();
}

async function initializeUserSelector() {
    const userSelect = document.getElementById('user-select');
    if (!userSelect) {
        console.error('User select element not found');
        return;
    }

    try {
        // Pokaż stan ładowania
        userSelect.innerHTML = '<option value="">Ładowanie...</option>';
        userSelect.disabled = true;

        // Pobierz listę użytkowników
        const users = await UserCardService.getAllCards();
        
        // Wyczyść i wypełnij selector
        userSelect.innerHTML = '';
        userSelect.disabled = false;

        if (!users || !users.length) {
            userSelect.innerHTML = '<option value="">Brak użytkowników</option>';
            return;
        }

        // Wypełnij selector
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.memberId;
            option.textContent = `${user.firstName} ${user.lastName}`;
            userSelect.appendChild(option);
        });

        // Ustaw aktualnego użytkownika
        const currentUser = await UserCardService.getCurrentUser();
        if (currentUser) {
            userSelect.value = currentUser;
        }
    } catch (error) {
        console.error('Failed to initialize user selector:', error);
        userSelect.innerHTML = '<option value="">Błąd ładowania</option>';
    }

    userSelect.addEventListener('change', async () => {
        const selectedUser = userSelect.value;
        try {
            await UserCardService.setCurrentUser(selectedUser);
            // Odśwież UI
            const userData = await UserCardService.getUser(selectedUser);
            if (userData) {
                updateUserCard(userData);
            }
        } catch (error) {
            console.error('User selection failed:', error);
            // Przywróć poprzednią wartość
            const currentUser = await UserCardService.getCurrentUser();
            if (currentUser) {
                userSelect.value = currentUser;
            }
        }
    });
}

// Funkcja do logowania do panelu debug
function logToPanel(message, type = 'info', data = null) {
    const debugLogs = document.getElementById('debug-logs');
    if (!debugLogs) return;

    const log = document.createElement('div');
    log.className = `debug-log ${type}`;
    log.innerHTML = `
        <span class="debug-time">${new Date().toLocaleTimeString()}</span>
        <span class="debug-message">${message}</span>
        ${data ? `<pre class="debug-data">${JSON.stringify(data, null, 2)}</pre>` : ''}
    `;

    debugLogs.appendChild(log);
    debugLogs.scrollTop = debugLogs.scrollHeight;
}

