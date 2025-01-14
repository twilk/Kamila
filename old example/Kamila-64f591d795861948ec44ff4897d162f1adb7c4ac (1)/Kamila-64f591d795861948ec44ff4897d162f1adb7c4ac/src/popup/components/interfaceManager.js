import { i18n } from '../../services/i18n.js';
import { stores } from '../../config/stores.js';

export class InterfaceManager {
    constructor(uiManager, dataManager, statusManager) {
        this.uiManager = uiManager;
        this.dataManager = dataManager;
        this.statusManager = statusManager;
    }

    async initializeStoreSelect() {
        const storeSelect = document.getElementById('store-select');
        if (!storeSelect) {
            logToPanel(' Nie znaleziono elementu store-select', 'error');
            return;
        }

        try {
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
                    
                    // Save selected store
                    await chrome.storage.local.set({ selectedStore });
                    
                    // Mark counters as loading
                    document.querySelectorAll('.lead-count').forEach(counter => {
                        counter.textContent = '...';
                        counter.classList.remove('count-error', 'count-zero');
                    });
                    
                    logToPanel('🏪 Zmieniono sklep na: ' + selectedStore, 'info');
                    
                    // Force immediate data refresh
                    await this.dataManager.fetchDarwinaData();
                    
                } catch (error) {
                    logToPanel('❌ Błąd podczas zmiany sklepu', 'error', error.message);
                    this.uiManager.handleError(error);
                }
            });

            logToPanel('✅ Zainicjalizowano wybór sklepu', 'success');
        } catch (error) {
            logToPanel('❌ Błąd inicjalizacji wyboru sklepu', 'error', error.message);
            this.uiManager.handleError(error);
        }
    }

    initializeTabs() {
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
                    await this.dataManager.updateDrwnData();
                }
                // If ranking tab is activated, update its data
                if (targetId === '#ranking') {
                    await this.dataManager.updateRankingData();
                }
            });
        });
    }

    initializeLanguageSwitcher() {
        const languageButtons = document.querySelectorAll('[data-lang]');
        const currentLang = localStorage.getItem('language') || 'polish';
        
        languageButtons.forEach(btn => {
            btn.classList.remove('active');
            
            if (btn.dataset.lang === currentLang) {
                btn.classList.add('active');
            }
            
            btn.addEventListener('click', async () => {
                const lang = btn.dataset.lang;
                languageButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                localStorage.setItem('language', lang);
                
                try {
                    await i18n.init();
                    this.updateInterface();
                    this.uiManager.initializeTooltips();
                    logToPanel(`🌍 Zmieniono język na: ${lang}`, 'success');
                } catch (error) {
                    logToPanel('❌ Błąd podczas zmiany języka', 'error', error);
                }
            });
        });
    }

    initializeThemeSwitcher() {
        const lightTheme = document.getElementById('light-theme');
        const darkTheme = document.getElementById('dark-theme');
        
        if (!lightTheme || !darkTheme) return;

        const currentTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', currentTheme === 'dark');
        
        if (currentTheme === 'dark') {
            darkTheme.checked = true;
        } else {
            lightTheme.checked = true;
        }

        const handleThemeChange = (theme) => {
            document.body.classList.toggle('dark-theme', theme === 'dark');
            localStorage.setItem('theme', theme);
            logToPanel(`🎨 Zmieniono motyw na: ${theme === 'dark' ? 'ciemny' : 'jasny'}`, 'success');
        };

        lightTheme.addEventListener('change', () => handleThemeChange('light'));
        darkTheme.addEventListener('change', () => handleThemeChange('dark'));
    }

    initializeStatusButtons() {
        const runTestsButton = document.getElementById('run-tests');
        const checkStatusButton = document.getElementById('check-status');
        const checkOrdersBtn = document.getElementById('check-orders');

        if (runTestsButton) {
            runTestsButton.addEventListener('click', async () => {
                logToPanel('🔍 Uruchamiam testy...', 'info');
                await this.statusManager.updateAllStatuses(true);
            });
        }

        if (checkStatusButton) {
            checkStatusButton.addEventListener('click', async () => {
                logToPanel('🔄 Odświeżam status...', 'info');
                await this.dataManager.fetchDarwinaData();
            });
        }

        if (checkOrdersBtn) {
            checkOrdersBtn.addEventListener('click', async () => {
                try {
                    logToPanel('📦 Sprawdzam i aktualizuję formy dostawy...', 'info');
                    const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                    
                    if (response?.success) {
                        logToPanel('✅ Zaktualizowano formy dostawy', 'success');
                        await this.dataManager.fetchDarwinaData();
                    } else {
                        throw new Error(response?.error || 'Nieznany błąd');
                    }
                } catch (error) {
                    logToPanel('❌ Błąd podczas aktualizacji form dostawy', 'error', error.message);
                }
            });
        }
    }

    initializeLeadStatusLinks() {
        const statusMap = {
            '1': 'submitted',
            '2': 'confirmed',
            '3': 'accepted',
            'READY': 'ready',
            'OVERDUE': 'overdue'
        };

        document.querySelectorAll('.lead-status').forEach(statusElement => {
            const dataStatus = statusElement.getAttribute('data-status');
            const status = statusMap[dataStatus];
            
            if (status) {
                statusElement.style.cursor = 'pointer';
                statusElement.addEventListener('click', () => {
                    const storeSelect = document.getElementById('store-select');
                    const selectedStore = storeSelect?.value;
                    const selectedStoreId = selectedStore === 'ALL' ? '0' : this.getStoreId(selectedStore);
                    const url = this.generateOrdersUrl(status, selectedStoreId);
                    window.open(url, '_blank');
                });
            }
        });
    }

    getStoreId(storeCode) {
        const store = stores.find(s => s.id === storeCode);
        return store ? store.deliveryId.toString() : '0';
    }

    generateOrdersUrl(status, storeId) {
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

        const date = new Date();
        date.setDate(date.getDate() - 14);
        const formattedDate = date.toISOString().split('T')[0];

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
                params.set('dp', formattedDate);
                break;
            case 'overdue':
                params.set('st', '5');
                params.set('s[]', '5');
                params.set('dk', formattedDate);
                break;
        }

        return `${baseUrl}?${params.toString()}`;
    }

    updateInterface() {
        i18n.updateDataI18n();
        this.uiManager.initializeTooltips();
    }
} 