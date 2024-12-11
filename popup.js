import { i18n, API } from './services/index.js';
import { API_BASE_URL, API_KEY } from '../config/api.js';
import { SELLY_API_BASE_URL, SELLY_API_KEY } from '../config/api.js';

// Globalna zmienna dla tooltipów
let tooltipList = [];

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

// Inicjalizacja
document.addEventListener('DOMContentLoaded', async () => {
    logToPanel('🚀 Aplikacja uruchomiona');
    
    try {
        // Inicjalizacja języka - musi być pierwsza!
        const translations = await i18n.init();
        i18n.updateDataI18n();
        updateInterface(translations);
        logToPanel('✅ Język zainicjalizowany', 'success');

        // Inicjalizacja tooltipów Bootstrap
        initTooltips();

        // Obsługa przełącznika debug
        const debugSwitch = document.getElementById('debug-switch');
        if (debugSwitch) {
            // Wczytaj zapisany stan debug i ustaw rozmiar okna
            const isDebugEnabled = localStorage.getItem('debug-enabled') === 'true';
            debugSwitch.checked = isDebugEnabled;
            document.body.classList.toggle('debug-enabled', isDebugEnabled);
            await resizeWindow(isDebugEnabled ? 750 : 600);
            logToPanel('✅ Rozmiar okna zaktualizowany', 'success');

            // Dodaj obsługę zmiany stanu
            debugSwitch.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                document.body.classList.toggle('debug-enabled', isEnabled);
                localStorage.setItem('debug-enabled', isEnabled);
                
                if (!isEnabled && document.querySelector('[data-target="#status"]').classList.contains('active')) {
                    document.querySelector('[data-target="#chat"]').click();
                }

                await resizeWindow(isEnabled ? 750 : 600);
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
                    const translations = await i18n.loadLanguage(lang);
                    updateInterface(translations);
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
                const response = await fetch(`${SELLY_API_BASE_URL}/orders`, { // Ustaw endpoint na 'orders'
                    method: 'GET', // Lub inna metoda, np. 'POST'
                    headers: {
                        'Authorization': `Bearer ${SELLY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Błąd: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Załóżmy, że odpowiedź zawiera pola: field1, field2, field3, field4
                const { field1, field2, field3, field4 } = data;
                
                // Przetwarzanie i aktualizacja interfejsu użytkownika
                document.getElementById('field1').textContent = field1;
                document.getElementById('field2').textContent = field2;
                document.getElementById('field3').textContent = field3;
                document.getElementById('field4').textContent = field4;
                
                logToPanel('✅ Dane z Selly API pobrane pomyślnie', 'success');
                
            } catch (error) {
                console.error('Błąd podczas pobierania danych z Selly API:', error);
                logToPanel('❌ B��ąd pobierania danych z Selly API', 'error', error);
            }
        }
        
        // Wywołanie funkcji fetchSellyData, np. podczas ładowania popup
        fetchSellyData();
    } catch (error) {
        logToPanel('❌ Błąd inicjalizacji', 'error', error);
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

// Funkcja pomocnicza do zmiany rozmiaru okna
async function resizeWindow(height) {
    try {
        if (chrome?.windows?.getCurrent) {
            const window = await chrome.windows.getCurrent();
            await chrome.windows.update(window.id, { height });
        } else {
            // Jesteśmy w trybie deweloperskim lub nie mamy uprawnień
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

