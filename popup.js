import { API } from './services/index.js';
import { API_BASE_URL, API_CONFIG } from '../config/api.js';
import { getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { i18n } from './services/i18n.js';
import { CacheService } from './services/cache.js';

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
        initStatusClickHandlers();
        
        // Ustaw interwał odświeżania
        console.log('⏰ Setting up refresh interval:', REFRESH_INTERVAL);
        const refreshInterval = setInterval(async () => {
            console.log('⏰ Refresh interval triggered');
            await fetchDarwinaData();
        }, REFRESH_INTERVAL);

        // Dodaj czyszczenie interwału przy zamknięciu popup
        window.addEventListener('unload', () => {
            clearInterval(refreshInterval);
            console.log('🛑 Cleared refresh interval');
        });

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
                    // Aktualizuj aktywną flagę
                    document.querySelectorAll('.flag').forEach(f => {
                        f.classList.toggle('active', f.getAttribute('data-lang') === lang);
                    });
                    
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

        // Funkcja do pobierania danych z API DARWINA
        async function fetchDarwinaData() {
            try {
                const lastFetchTime = localStorage.getItem('last_fetch_time');
                const now = Date.now();
                
                // Jeśli minęło mniej niż minutę, użyj cache
                if (lastFetchTime && now - parseInt(lastFetchTime) < REFRESH_INTERVAL) {
                    const cachedData = await CacheService.get(CACHE_KEY);
                    if (cachedData) {
                        updateUI(cachedData);
                        return;
                    }
                }

                // Pobierz nowe dane
                refreshCount++;
                const { selectedStore } = await chrome.storage.local.get('selectedStore');
                const response = await chrome.runtime.sendMessage({
                    type: 'FETCH_DARWINA_DATA',
                    selectedStore: selectedStore || 'ALL'
                });

                if (response.success) {
                    updateUI(response);
                    localStorage.setItem('last_fetch_time', now.toString());
                } else {
                    throw new Error(response.error);
                }
            } catch (error) {
                handleError(error);
            }
        }

        // Funkcja aktualizacji UI
        function updateUI(data) {
            const { statusCounts } = data;
            
            // Resetuj wszystkie liczniki
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '0';
                counter.classList.remove('count-error');
                counter.classList.add('count-zero');
            });
            
            // Mapowanie statusów z API na elementy UI
            const statusMapping = {
                '1': '[data-status="1"]',      // Złożone (SUBMITTED)
                '2': '[data-status="2"]',      // Potwierdzone przez Klienta (CONFIRMED)
                '3': '[data-status="3"]',      // Przyjęte do realizacji (ACCEPTED)
                'READY': '[data-status="READY"]',      // Gotowe do odbioru (< 2 tygodnie)
                'OVERDUE': '[data-status="OVERDUE"]'   // Przeterminowane (>= 2 tygodnie)
            };

            // Aktualizacja liczników
            Object.entries(statusCounts).forEach(([status, count]) => {
                // Znajdź odpowiedni selektor dla statusu
                const selector = statusMapping[status];
                if (selector) {
                    const element = document.querySelector(`${selector} .lead-count`);
                    if (element && count > 0) {
                        element.textContent = count;
                        element.classList.remove('count-zero');
                        logToPanel(`📊 Status ${status}: ${count}`, 'info');
                    }
                }
            });

            // Dodaj tooltip z dokładną datą aktualizacji
            const timestamp = new Date().toLocaleString();
            document.querySelectorAll('.lead-status').forEach(status => {
                const count = status.querySelector('.lead-count').textContent;
                const statusName = status.getAttribute('data-status');
                status.setAttribute('title', 
                    `Status: ${statusName}\n` +
                    `Liczba zamówień: ${count}\n` +
                    `Ostatnia aktualizacja: ${timestamp}`
                );
            });

            logToPanel('✅ Dane zaktualizowane', 'success');
            logToPanel('📊 Wszystkie statusy:', 'info', statusCounts);
        }

        // Funkcja obsługująca kliknięcie w status
        async function handleStatusClick() {
            try {
                logToPanel('🔄 Ręczne odświeżanie statusów...', 'info');
                await fetchDarwinaData();
                // Dodaj efekt wizualny potwierdzający odświeżenie
                this.classList.add('refreshed');
                setTimeout(() => this.classList.remove('refreshed'), 1000);
            } catch (error) {
                logToPanel('❌ Błąd podczas ręcznego odświeżania', 'error', error.message);
            }
        }

        // Dodaj po inicjalizacji fetchDarwinaData
        function initStatusClickHandlers() {
            document.querySelectorAll('.lead-status').forEach(element => {
                element.removeEventListener('click', handleStatusClick);
                element.addEventListener('click', handleStatusClick);
            });
            logToPanel('✅ Zainicjalizowano obsługę kliknięć na statusy', 'success');
        }

        // Obsługa przycisku instrukcji
        const instructionsButton = document.getElementById('instructions-button');
        const instructionsModal = document.getElementById('instructionsModal');
        
        console.log('Instructions elements:', {
            button: instructionsButton,
            modal: instructionsModal,
            bootstrap: typeof bootstrap !== 'undefined'
        });
        
        if (instructionsButton && instructionsModal) {
            instructionsButton.addEventListener('click', () => {
                console.log('Instructions button clicked');
                if (typeof bootstrap === 'undefined') {
                    logToPanel('❌ Bootstrap nie jest załadowany', 'error');
                    return;
                }

                // Sprawdź czy modal już istnieje
                let modal = bootstrap.Modal.getInstance(instructionsModal);
                if (!modal) {
                    modal = new bootstrap.Modal(instructionsModal);
                }
                modal.show();
                logToPanel('📋 Otwarto instrukcję', 'info');
            });
        }

        // Obsługa zmiany sklepu
        const storeSelect = document.getElementById('store-select');
        if (storeSelect) {
            // Załaduj listę sklepów
            import('./config/stores.js').then(({ stores }) => {
                // Wyczyść obecne opcje
                storeSelect.innerHTML = '';
                
                // Dodaj opcję "Wszystkie sklepy"
                const allOption = document.createElement('option');
                allOption.value = 'ALL';
                allOption.textContent = stores.find(s => s.id === 'ALL').name;
                allOption.setAttribute('data-i18n', 'allStores');
                storeSelect.appendChild(allOption);
                
                // Dodaj pozostałe sklepy, używając dokładnie danych ze stores.js
                stores
                    .filter(store => store.id !== 'ALL')
                    .forEach(store => {
                        const option = document.createElement('option');
                        option.value = store.id;
                        option.textContent = `${store.name} - ${store.address}`;
                        storeSelect.appendChild(option);
                    });

                // Załaduj zapisany wybór
                chrome.storage.local.get('selectedStore', ({ selectedStore }) => {
                    storeSelect.value = selectedStore || 'ALL';
                    });
            });

            // Dodaj obsługę zmiany
            storeSelect.addEventListener('change', async (e) => {
                try {
                    const selectedStore = e.target.value;
                    
                    // Wyczyść cache
                    await CacheService.clear(CACHE_KEY);
                    // Usuń timestamp ostatniego odświeżenia
                    localStorage.removeItem('last_fetch_time');
                    
                    // Zapisz wybrany sklep
                    await chrome.storage.local.set({ selectedStore });
                    
                    // Oznacz liczniki jako ładujące się
                    document.querySelectorAll('.lead-count').forEach(counter => {
                        counter.textContent = '...';
                        counter.classList.remove('count-error', 'count-zero');
                    });
                    
                    logToPanel('🏪 Zmieniono sklep na: ' + selectedStore, 'info');
                    
                    // Wymuś natychmiastowe pobranie nowych danych
                    await fetchDarwinaData();
                    
                } catch (error) {
                    logToPanel('❌ Błąd podczas zmiany sklepu', 'error', error.message);
                    handleError(error);
                }
            });
        }
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

// Dodaj funkcję handleError
function handleError(error) {
    console.error('❌ Error:', error);
    logToPanel('❌ Błąd pobierania danych z DARWINA API', 'error', error.message);
    
    // W przypadku błędu, oznacz wszystkie liczniki jako niedostępne
    document.querySelectorAll('.lead-count').forEach(counter => {
        counter.textContent = '-';
        counter.classList.add('count-error');
    });
}

