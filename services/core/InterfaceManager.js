import { i18n } from '../i18n.js';
import { stores } from '../stores.js';
import { BaseManager } from './BaseManager.js';
import { errorHandler } from './ErrorHandler.js';
import { eventManager } from './EventManager.js';
import { EventType } from './EventType.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';

export class InterfaceManager extends BaseManager {
    static instance = null;
    
    constructor() {
        super('InterfaceManager');
        if (InterfaceManager.instance) {
            return InterfaceManager.instance;
        }
        InterfaceManager.instance = this;
        this.initialized = false;
    }

    static getInstance() {
        if (!InterfaceManager.instance) {
            InterfaceManager.instance = new InterfaceManager();
        }
        return InterfaceManager.instance;
    }

    async initialize() {
        if (this.initialized) {
            return true;
        }

        try {
            console.log('[DEBUG] 🖥️ Initializing interface manager...');
            
            await this.initializeStoreSelect();
            this.initializeTabs();
            this.initializeLanguageSwitcher();
            this.initializeThemeSwitcher();
            this.initializeStatusButtons();
            this.initializeLeadStatusLinks();
            this.setupCounterClickHandlers();
            
            this.initialized = true;
            console.log('[DEBUG] ✅ Interface manager initialized successfully');
            return true;
        } catch (error) {
            console.error('[ERROR] ❌ Failed to initialize interface manager:', error);
            errorHandler.handleError(error);
            return false;
        }
    }

    async initializeStoreSelect() {
        const storeSelect = document.getElementById('store-select');
        if (!storeSelect) {
            console.warn('[WARNING] ⚠️ Store select element not found');
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
                    
                    console.log('[DEBUG] 🏪 Store changed to:', selectedStore);
                    
                    // Emit store change event
                    eventManager.emit(EventType.STORE_CHANGED, {
                        oldStore: selectedStore,
                        newStore: e.target.value,
                        timestamp: new Date().toISOString()
                    });
                    
                } catch (error) {
                    console.error('[ERROR] ❌ Failed to change store:', error);
                    errorHandler.handleError(error);
                }
            });

            console.log('[DEBUG] ✅ Store select initialized');
        } catch (error) {
            console.error('[ERROR] ❌ Failed to initialize store select:', error);
            errorHandler.handleError(error);
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

                // Emit tab change event
                eventManager.emit(EventType.TAB_CHANGED, {
                    tab: targetId,
                    timestamp: new Date().toISOString()
                });
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
                    
                    // Emit language change event
                    eventManager.emit(EventType.LANGUAGE_CHANGED, {
                        language: lang,
                        timestamp: new Date().toISOString()
                    });
                    
                    console.log('[DEBUG] 🌍 Language changed to:', lang);
                } catch (error) {
                    console.error('[ERROR] ❌ Failed to change language:', error);
                    errorHandler.handleError(error);
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
            
            // Emit theme change event
            eventManager.emit(EventType.THEME_CHANGED, {
                theme,
                timestamp: new Date().toISOString()
            });
            
            console.log('[DEBUG] 🎨 Theme changed to:', theme);
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
                console.log('[DEBUG] 🔍 Running tests...');
                eventManager.emit(EventType.RUN_TESTS);
            });
        }

        if (checkStatusButton) {
            checkStatusButton.addEventListener('click', async () => {
                console.log('[DEBUG] 🔄 Checking status...');
                eventManager.emit(EventType.CHECK_STATUS);
            });
        }

        if (checkOrdersBtn) {
            checkOrdersBtn.addEventListener('click', async () => {
                try {
                    console.log('[DEBUG] 📦 Checking orders...');
                    const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                    
                    if (response?.success) {
                        console.log('[DEBUG] ✅ Orders checked successfully');
                        eventManager.emit(EventType.ORDERS_CHECKED);
                    } else {
                        throw new Error(response?.error || 'Unknown error');
                    }
                } catch (error) {
                    console.error('[ERROR] ❌ Failed to check orders:', error);
                    errorHandler.handleError(error);
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
                statusElement.addEventListener('click', async () => {
                    try {
                        const storeSelect = document.getElementById('store-select');
                        const selectedStore = storeSelect?.value;
                        const selectedStoreId = selectedStore === 'ALL' ? '0' : this.getStoreId(selectedStore);
                        const url = this.generateOrdersUrl(status, selectedStoreId);
                        
                        // Log click event
                        console.log('[DEBUG] 👆 Lead status clicked:', {
                            status,
                            store: selectedStore,
                            storeId: selectedStoreId,
                            url
                        });
                        
                        // Emit lead status click event
                        eventManager.emit(EventType.LEAD_STATUS_CLICKED, {
                            status,
                            store: selectedStore,
                            url,
                            timestamp: new Date().toISOString()
                        });
                        
                        window.open(url, '_blank');
                    } catch (error) {
                        console.error('[ERROR] ❌ Failed to handle lead status click:', error);
                        errorHandler.handleError(error);
                    }
                });
            }
        });
    }

    getStoreId(storeCode) {
        const store = stores.find(s => s.id === storeCode);
        return store ? store.deliveryId.toString() : '0';
    }

    /**
     * Generate URL for orders page with filters
     * @param {string} status - Order status
     * @param {string} storeId - Store ID
     * @returns {string} URL for orders page
     */
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

        // Calculate date 14 days ago
        const date = new Date();
        date.setDate(date.getDate() - 14);
        const formattedDate = date.toISOString().split('T')[0];

        // Add appropriate parameters based on status
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
        eventManager.emit(EventType.INTERFACE_UPDATED, {
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Set up click handlers for order status counters
     */
    setupCounterClickHandlers() {
        try {
            document.querySelectorAll('.lead-status').forEach(statusElement => {
                const status = statusElement.getAttribute('data-status');
                if (status) {
                    statusElement.style.cursor = 'pointer';
                    statusElement.addEventListener('mouseup', async (event) => {
                        // Only handle left and middle mouse buttons
                        if (event.button !== 0 && event.button !== 1) return;
                        
                        // Get currently selected store
                        const store = await this.getSelectedStore();
                        const storeId = store?.id !== 'ALL' ? this.getStoreId(store.id) : '0';
                        
                        // Generate URL with store ID if available
                        const url = this.generateOrdersUrl(status, storeId);
                        
                        // Open in new tab
                        window.open(url, '_blank');
                        
                        // Prevent default for middle click
                        if (event.button === 1) {
                            event.preventDefault();
                        }
                    });
                }
            });

            this.log(LogLevel.DEBUG, '✅ Counter click handlers initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'setupCounterClickHandlers'
            });
        }
    }

    /**
     * Get currently selected store
     * @returns {Promise<Object|null>} Selected store object or null
     */
    async getSelectedStore() {
        try {
            const select = document.querySelector('#store-select, #store-selector');
            if (!select) {
                this.log(LogLevel.WARNING, '⚠️ Store select element not found');
                return null;
            }

            const selectedOption = select.options[select.selectedIndex];
            if (!selectedOption) {
                this.log(LogLevel.WARNING, '⚠️ No store option selected');
                return null;
            }

            const storeId = selectedOption.value;
            const store = stores.find(s => s.id === storeId);

            this.log(LogLevel.DEBUG, '🏪 Selected store:', {
                id: storeId,
                name: selectedOption.text,
                index: select.selectedIndex,
                delivery_id: store?.deliveryId
            });

            return store || { id: 'ALL' };
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'getSelectedStore'
            });
            return { id: 'ALL' };
        }
    }
}

// Export singleton instance
export const interfaceManager = InterfaceManager.getInstance();