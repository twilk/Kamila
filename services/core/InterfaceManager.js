import { stores } from '../stores.js';
import { BaseManager } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { MenuManager } from './MenuManager.js';
import { EventManager } from './EventManager.js';
import { ThemeManager } from './ThemeManager.js';
import { LanguageManager } from './LanguageManager.js';
import { ErrorHandler } from './ErrorHandler.js';

// Import stałych z MenuManager
const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready'
};

const SELECTORS = {
    TAB: '.menu .link[data-bs-toggle="tab"]',
    TAB_PANE: '.tab-pane',
    ACTIVE_TAB: '.menu .link.active'
};

export class InterfaceManager extends BaseManager {
    static instance = null;
    #initialized = false;
    #dependencies = new Set();
    
    constructor() {
        super('InterfaceManager');
        if (InterfaceManager.instance) {
            return InterfaceManager.instance;
        }
        InterfaceManager.instance = this;
        
        // Add required dependencies
        this.addDependency(MenuManager.getInstance());
        this.addDependency(EventManager.getInstance());
        this.addDependency(ThemeManager.getInstance());
        this.addDependency(LanguageManager.getInstance());
    }

    static getInstance() {
        if (!InterfaceManager.instance) {
            InterfaceManager.instance = new InterfaceManager();
        }
        return InterfaceManager.instance;
    }

    async onInitialize() {
        if (this.#initialized) {
            return true;
        }

        try {
            this.log(LogLevel.INFO, '🖥️ Initializing interface manager...');
            
            await this.initializeStoreSelect();
            await this.initializeTabs();
            await this.initializeLanguageSwitcher();
            this.initializeThemeSwitcher();
            this.initializeStatusButtons();
            this.initializeLeadStatusLinks();
            this.setupCounterClickHandlers();
            
            this.#initialized = true;
            this.log(LogLevel.SUCCESS, '✅ Interface manager initialized successfully');
            return true;
        } catch (error) {
            this.log(LogLevel.ERROR, '❌ Failed to initialize interface manager:', error);
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'onInitialize'
            });
            return false;
        }
    }

    async initializeStoreSelect() {
        try {
            const storeSelect = document.querySelector('#store-select');
            if (!storeSelect) {
                console.log('[DEBUG] ⚠️ Store select not found');
                return;
            }

            // Load saved selection first
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            
            // Add change handler - use debounce to prevent multiple rapid changes
            let changeTimeout = null;
            storeSelect.addEventListener('change', async (e) => {
                if (changeTimeout) {
                    clearTimeout(changeTimeout);
                }
                
                changeTimeout = setTimeout(async () => {
                    try {
                        const selectedStore = e.target.value;
                        await chrome.storage.local.set({ selectedStore });
                        
                        // Emit store change event
                        managers.EventManager.emit(EventType.STORE_CHANGED, {
                            oldStore: e.target.dataset.previousValue,
                            newStore: selectedStore,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Save current value for next change
                        e.target.dataset.previousValue = selectedStore;
                        
                    } catch (error) {
                        console.error('[ERROR] ❌ Store change failed:', error);
                        managers.ErrorHandler.handleError(error);
                    }
                }, 300);
            });

            console.log('[DEBUG] ✅ Store select initialized');
        } catch (error) {
            console.warn('[WARNING] ⚠️ Store select initialization failed:', error);
        }
    }

    /**
     * Initialize tabs
     * @private
     */
    async initializeTabs() {
        try {
            // Get MenuManager instance
            const menuManager = this.getDependency('MenuManager');
            if (!menuManager?.isInitialized()) {
                this.log(LogLevel.INFO, '⏳ Waiting for MenuManager to initialize...');
                await menuManager.waitForReady();
            }

            // Add event listener for tab changes
            window.addEventListener(EVENTS.TAB_CHANGED, (event) => {
                const { previousTab, currentTab, timestamp } = event.detail;
                
                // Forward event to eventManager
                EventManager.getInstance().emit(EventType.TAB_CHANGED, {
                    previousTab,
                    currentTab,
                    timestamp
                });
            });

            this.log(LogLevel.SUCCESS, '✅ Tabs initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeTabs'
            });
        }
    }

    async initializeLanguageSwitcher() {
        try {
            const languageButtons = document.querySelectorAll('[data-lang]');
            const { language: currentLang } = await chrome.storage.local.get('language') || { language: 'polish' };
            
            languageButtons.forEach(btn => {
                btn.classList.remove('active');
                
                if (btn.dataset.lang === currentLang) {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', async () => {
                    const lang = btn.dataset.lang;
                    languageButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    try {
                        const languageManager = LanguageManager.getInstance();
                        await languageManager.setLanguage(lang);
                        
                        // Event will be emitted by LanguageManager.updateUI()
                        this.log(LogLevel.DEBUG, `🌍 Language changed to: ${lang}`);
                    } catch (error) {
                        this.handleError(error, ErrorType.LANGUAGE, ErrorSeverity.MEDIUM, {
                            method: 'initializeLanguageSwitcher',
                            language: lang
                        });
                    }
                });
            });

            this.log(LogLevel.DEBUG, '✅ Language switcher initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeLanguageSwitcher'
            });
        }
    }

    initializeThemeSwitcher() {
        try {
            const themeToggle = document.getElementById('theme-switch');
            
            if (!themeToggle) {
                this.log(LogLevel.WARNING, '⚠️ Theme toggle element not found');
                return;
            }

            // Get ThemeManager instance
            const themeManager = ThemeManager.getInstance();
            const { theme: currentTheme } = themeManager.getThemeSettings();
            
            // Set initial state of toggle
            themeToggle.checked = currentTheme === 'dark';

            const handleThemeChange = async (event) => {
                try {
                    const newTheme = event.target.checked ? 'dark' : 'light';
                    await themeManager.setTheme(newTheme);
                    this.log(LogLevel.DEBUG, '🎨 Theme changed', { theme: newTheme });
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: 'handleThemeChange',
                        theme: event.target.checked ? 'dark' : 'light'
                    });
                }
            };

            themeToggle.addEventListener('change', handleThemeChange);
            this.log(LogLevel.DEBUG, '✅ Theme switcher initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.LOW, {
                method: 'initializeThemeSwitcher'
            });
        }
    }

    initializeStatusButtons() {
        try {
            const runTestsButton = document.getElementById('run-tests');
            const checkStatusButton = document.getElementById('check-status');
            const checkOrdersBtn = document.getElementById('check-orders');
            
            // Get manager instances
            const eventManager = EventManager.getInstance();
            const errorHandler = ErrorHandler.getInstance();

            if (runTestsButton) {
                runTestsButton.addEventListener('click', async () => {
                    this.log(LogLevel.DEBUG, '🔍 Running tests...');
                    eventManager.emit(EventType.RUN_TESTS);
                });
            }

            if (checkStatusButton) {
                checkStatusButton.addEventListener('click', async () => {
                    this.log(LogLevel.DEBUG, '🔄 Checking status...');
                    eventManager.emit(EventType.CHECK_STATUS);
                });
            }

            if (checkOrdersBtn) {
                checkOrdersBtn.addEventListener('click', async () => {
                    try {
                        this.log(LogLevel.DEBUG, '📦 Checking orders...');
                        const response = await chrome.runtime.sendMessage({ type: 'CHECK_ORDERS_NOW' });
                        
                        if (response?.success) {
                            this.log(LogLevel.SUCCESS, '✅ Orders checked successfully');
                            eventManager.emit(EventType.ORDERS_CHECKED);
                        } else {
                            throw new Error(response?.error || 'Unknown error');
                        }
                    } catch (error) {
                        this.handleError(error, ErrorType.API, ErrorSeverity.MEDIUM, {
                            method: 'initializeStatusButtons',
                            button: 'checkOrders'
                        });
                    }
                });
            }

            this.log(LogLevel.DEBUG, '✅ Status buttons initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.LOW, {
                method: 'initializeStatusButtons'
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
                        managers.EventManager.emit(EventType.LEAD_STATUS_CLICKED, {
                            status,
                            store: selectedStore,
                            url,
                            timestamp: new Date().toISOString()
                        });
                        
                        window.open(url, '_blank');
                    } catch (error) {
                        console.error('[ERROR] ❌ Failed to handle lead status click:', error);
                        managers.ErrorHandler.handleError(error);
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
        try {
            const languageManager = LanguageManager.getInstance();
            const eventManager = EventManager.getInstance();
            
            // Update translations
            languageManager.updateUI();
            
            // Emit interface updated event
            eventManager.emit(EventType.INTERFACE_UPDATED, {
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'updateInterface'
            });
        }
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