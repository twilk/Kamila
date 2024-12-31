import { i18nService } from '../services/I18nService.js';
import { CacheService } from './index.js';
import { logToPanel } from '../utils/logging.js';
import { stores } from '../config/stores.js';

// Globalna zmienna dla tooltipów
let tooltipList = [];

// Cache key dla danych
const CACHE_KEY = 'darwina_orders_data';

export const UIComponents = {
    async initializeDebugPanel() {
        const debugPanel = document.querySelector('.debug-panel');
        const debugSwitch = document.getElementById('debug-switch');
        
        if (debugPanel && debugSwitch) {
            // Restore debug mode state
            const debugMode = localStorage.getItem('debugMode') === 'true';
            debugSwitch.checked = debugMode;
            document.body.classList.toggle('debug-enabled', debugMode);
            
            // Initialize debug switch
            debugSwitch.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                document.body.classList.toggle('debug-enabled', isEnabled);
                localStorage.setItem('debugMode', isEnabled);
                
                setTimeout(() => {
                    const popup = document.getElementById('drwn-popup');
                    if (popup) {
                        chrome.runtime.sendMessage({
                            type: 'RESIZE_POPUP',
                            height: popup.scrollHeight
                        });
                    }
                }, 50);
            });

            // Initialize clear logs button
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
        }
    },

    async initializeTabs() {
        const tabs = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                const target = document.querySelector(tab.getAttribute('data-bs-target'));
                
                // Remove active class from all tabs and panes
                document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active', 'show'));
                
                // Add active class to clicked tab and its pane
                tab.classList.add('active');
                if (target) {
                    target.classList.add('active', 'show');
                }
            });
        });

        // Activate default tab
        const defaultTab = document.querySelector('.nav-link.active');
        if (defaultTab) {
            defaultTab.click();
        }
    },

    async initializeControls() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                try {
                    logToPanel('🔄 Odświeżam dane...', 'info');
                    await this.refreshData();
                    logToPanel('✅ Dane odświeżone', 'success');
                } catch (error) {
                    logToPanel('❌ Błąd odświeżania danych', 'error', error.message);
                }
            });
        }

        // Initialize refresh button
        await this.initializeRefreshButton();
    },

    async refreshData() {
        try {
            logToPanel('🔄 Odświeżam dane...', 'info');
            
            // Pobierz aktualny sklep
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            if (!selectedStore) {
                throw new Error('Nie wybrano sklepu');
            }

            // Wyczyść cache dla wybranego sklepu
            await CacheService.clear(CACHE_KEY + '_' + selectedStore);
            
            // Pobierz nowe dane
            await this.notifyPopupOpened();
            
            logToPanel('✅ Dane odświeżone', 'success');
        } catch (error) {
            logToPanel('❌ Błąd odświeżania danych', 'error', error);
            throw error;
        }
    },

    async notifyPopupOpened() {
        try {
            // Pokaż loader w licznikach podczas ładowania
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '...';
                counter.classList.remove('count-error', 'count-zero');
            });

            const response = await chrome.runtime.sendMessage({ type: 'POPUP_OPENED' });
            
            if (!response?.success) {
                throw new Error(response?.error || 'Nieznany błąd');
            }

            // Aktualizuj liczniki otrzymanymi danymi
            if (response.counts) {
                this.updateLeadCounts(response.counts);
            }
        } catch (error) {
            console.error('Error in notifyPopupOpened:', error);
            logToPanel('❌ Błąd podczas ładowania liczników', 'error', error.message);
            
            // Pokaż błąd w licznikach
            document.querySelectorAll('.lead-count').forEach(counter => {
                counter.textContent = '-';
                counter.classList.add('count-error');
            });
        }
    },

    updateLeadCounts(counts) {
        // Mapowanie statusów na ID elementów
        const statusToElementId = {
            '1': 'count-1',
            '2': 'count-2',
            '3': 'count-3',
            'READY': 'count-ready',
            'OVERDUE': 'count-overdue'
        };

        Object.entries(counts).forEach(([status, count]) => {
            const elementId = statusToElementId[status];
            if (!elementId) {
                console.warn(`[WARNING] ⚠️ Nieznany status: ${status}`);
                return;
            }
            
            const counter = document.getElementById(elementId);
            if (counter) {
                counter.textContent = count;
                counter.classList.toggle('count-zero', count === 0);
                counter.classList.remove('count-error');
            }
        });
        
        logToPanel('✅ Zaktualizowano liczniki', 'success');
    },

    async initializeStoreSelect() {
        const storeSelect = document.getElementById('store-select');
        if (!storeSelect) return;

        try {
            // Pobierz zapisany sklep
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            
            // Wyczyść obecne opcje
            storeSelect.innerHTML = `<option value="" data-i18n="noStoreSelected">${i18nService.translate('noStoreSelected')}</option>`;
            
            // Dodaj opcje sklepów
            Object.entries(stores).forEach(([id, store]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = store.name;
                if (selectedStore === id) {
                    option.selected = true;
                }
                storeSelect.appendChild(option);
            });

            // Obsługa zmiany sklepu
            storeSelect.addEventListener('change', async (e) => {
                const selectedId = e.target.value;
                await chrome.storage.local.set({ selectedStore: selectedId });
                
                // Odśwież dane
                await this.refreshData();
            });

        } catch (error) {
            console.error('Error initializing store select:', error);
            logToPanel('❌ Błąd podczas inicjalizacji selektora sklepów', 'error', error);
        }
    },

    initializeLanguageSwitcher() {
        const langSwitch = document.getElementById('lang-switch');
        if (!langSwitch) return;

        // Ustaw aktualny język
        const currentLang = i18nService.getCurrentLanguage();
        langSwitch.value = currentLang;

        // Obsługa zmiany języka
        langSwitch.addEventListener('change', async (e) => {
            const newLang = e.target.value;
            await i18nService.setLanguage(newLang);
            this.updateInterface();
        });
    },

    updateInterface() {
        // Najpierw aktualizujemy wszystkie elementy z data-i18n
        i18nService.updateDataI18n();

        // Nagłówek
        this.safeUpdateElement('#welcome-message', el => el.innerHTML = i18nService.translate('welcome'));
        
        // Panel zapytań
        this.safeUpdateElement('label[for="query"]', el => el.textContent = i18nService.translate('queryLabel'));
        this.safeUpdateElement('#query', el => el.placeholder = i18nService.translate('queryPlaceholder'));
        this.safeUpdateElement('#send', el => el.textContent = i18nService.translate('send'));
        
        // Zakładki
        this.safeUpdateElement('[data-target="#chat"]', el => el.textContent = i18nService.translate('chat'));
        this.safeUpdateElement('[data-target="#settings"]', el => el.textContent = i18nService.translate('settings'));
        this.safeUpdateElement('[data-target="#about"]', el => el.textContent = i18nService.translate('about'));
        this.safeUpdateElement('[data-target="#status"]', el => el.textContent = i18nService.translate('status'));
        
        // Ustawienia
        this.safeUpdateElement('.settings-section h6:nth-of-type(1)', el => el.textContent = i18nService.translate('theme'));
        this.safeUpdateElement('input[value="light"] + label', el => el.textContent = i18nService.translate('themeLight'));
        this.safeUpdateElement('input[value="dark"] + label', el => el.textContent = i18nService.translate('themeDark'));
        
        // Reinicjalizuj tooltips po zmianie języka
        this.initializeTooltips();
    },

    // Helper functions
    safeUpdateElement(selector, updateFn) {
        const element = document.querySelector(selector);
        if (element) {
            updateFn(element);
        }
    },

    safeUpdateElements(selector, updateFn) {
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
    },

    async initializeRefreshButton() {
        const refreshButton = document.getElementById('refresh-store-data');
        if (!refreshButton) return;

        refreshButton.addEventListener('click', async () => {
            const selectedStore = document.getElementById('store-select')?.value;
            if (!selectedStore) {
                logToPanel('❌ Nie wybrano sklepu', 'error');
                return;
            }
            
            // Show loading state
            refreshButton.disabled = true;
            refreshButton.querySelector('i')?.classList.add('rotate');
            
            try {
                // Clear cache for the selected store
                await CacheService.clear(CACHE_KEY + '_' + selectedStore);
                // Remove last refresh timestamp
                localStorage.removeItem('last_fetch_time');
                // Refresh data
                await this.refreshData();
                logToPanel('🔄 Odświeżono dane dla sklepu: ' + selectedStore, 'success');
            } catch (error) {
                logToPanel('❌ Błąd odświeżania danych', 'error', error);
            } finally {
                // Reset button state
                refreshButton.disabled = false;
                refreshButton.querySelector('i')?.classList.remove('rotate');
            }
        });
    },

    initializeTooltips() {
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
}; 