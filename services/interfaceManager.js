import { UIManager } from './core/UIManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';
import { storeManager } from './storeManager.js';
import { DebugManager } from './core/DebugManager.js';
import { ThemeManager } from './themeManager.js';

export class InterfaceManager extends UIManager {
    constructor(uiManager, eventManager, debugManager) {
        super();
        this.uiManager = uiManager;
        this.eventManager = eventManager;
        this.debugManager = debugManager;
        this.activeTab = null;
        this.menuItems = new Map();
        this.themeListeners = new Set();
        this.languageListeners = new Set();
        this.tooltips = new Set();
        this.refreshInterval = 300000; // 5 minutes default
    }

    async initialize() {
        try {
            await super.initialize();

            // Initialize interface components in parallel
            await Promise.all([
                this.initializeMenu(),
                this.initializeTheme(),
                this.initializeLanguage(),
                this.initializeTooltips(),
                this.initializeStoreSelect(),
                this.initializeLeadStatusLinks(),
                this.initializeIntervalSettings()
            ]);

            // Set up event listeners
            this.setupEventListeners();
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
    }

    setupEventListeners() {
        try {
            // Listen for theme changes
            this.eventManager.delegate('change', '#theme-switch', async () => {
                const isDark = document.body.classList.toggle('dark-theme');
                await chrome.storage.local.set({ darkTheme: isDark });
                this.themeListeners.forEach(listener => listener(isDark));
            });

            // Listen for language changes
            this.eventManager.delegate('change', '#language-select', async (event, target) => {
                const language = target.value;
                await i18n.setLanguage(language);
                this.languageListeners.forEach(listener => listener(language));
            });

            // Listen for refresh interval changes
            this.eventManager.delegate('change', '#refresh-interval', async (event, target) => {
                const interval = parseInt(target.value, 10);
                if (!isNaN(interval)) {
                    this.refreshInterval = interval;
                    await chrome.storage.local.set({ refreshInterval: interval });
                    this.emit('refreshIntervalChanged', { interval });
                }
            });

            // Listen for store changes
            this.eventManager.delegate('change', '#store-select', async (event, target) => {
                const store = target.value;
                await this.handleStoreChange(store);
            });

        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'setupEventListeners'
            });
        }
    }

    async handleStoreChange(store) {
        try {
            // Save selected store
            await chrome.storage.local.set({ selectedStore: store });
            
            // Emit store change event
            const event = new CustomEvent('storeChange', { 
                detail: { store } 
            });
            document.dispatchEvent(event);
            
            // Update UI
            await this.updateStoreUI();
            
            this.debugManager?.logToPanel(i18n.translate('logs.storeChanged', { store }), 'info');
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'handleStoreChange',
                store
            });
            return false;
        }
    }

    async initializeMenu() {
        try {
            const menuLinks = document.querySelectorAll('.menu .link');
            menuLinks.forEach(link => {
                // Store menu item reference
                const targetId = link.getAttribute('data-target');
                if (targetId) {
                    this.menuItems.set(targetId, link);
                }

                // Add click handler
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.switchTab(targetId);
                });
            });

            // Set initial active tab
            const firstTab = this.menuItems.keys().next().value;
            if (firstTab) {
                await this.switchTab(firstTab);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeMenu'
            });
        }
    }

    async switchTab(tabId) {
        try {
            if (this.activeTab === tabId) return;

            // Update menu items
            this.menuItems.forEach((link, id) => {
                link.classList.toggle('active', id === tabId);
            });

            // Update tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => {
                pane.classList.remove('show', 'active');
            });

            const targetPane = document.querySelector(tabId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
                this.activeTab = tabId;

                // Handle special tab initialization
                await this.handleTabInitialization(tabId);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'switchTab',
                tabId
            });
        }
    }

    async handleTabInitialization(tabId) {
        try {
            // Najpierw sprawdź czy zakładka istnieje
            const tabPane = document.querySelector(tabId);
            if (!tabPane) {
                throw new Error(`Tab ${tabId} not found`);
            }

            // Zapisz aktywną zakładkę
            localStorage.setItem('lastActiveTab', tabId);

            // Inicjalizuj specyficzne zakładki
            switch (tabId) {
                case '#drwn':
                    await this.initializeDrwnContent();
                    break;
                case '#ranking':
                    await this.initializeRankingContent();
                    break;
                case '#settings':
                    await this.initializeSettingsContent();
                    break;
                case '#chat':
                    // Chat jest obecnie wyłączony
                    tabPane.classList.add('disabled');
                    break;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleTabInitialization',
                tabId
            });
        }
    }

    async initializeDrwnContent() {
        // Podstawowa inicjalizacja zakładki DRWN
        const drwnTab = document.querySelector('#drwn');
        if (!drwnTab) return;

        // Wyczyść zawartość
        const contentContainer = drwnTab.querySelector('.drwn-content') || drwnTab;
        contentContainer.innerHTML = '<div class="alert alert-info">DRWN jest obecnie wyłączony</div>';
    }

    async initializeRankingContent() {
        // Podstawowa inicjalizacja zakładki Ranking
        const rankingTab = document.querySelector('#ranking');
        if (!rankingTab) return;

        // Wyczyść zawartość
        const contentContainer = rankingTab.querySelector('.ranking-content') || rankingTab;
        contentContainer.innerHTML = '<div class="alert alert-info">Ranking jest obecnie wyłączony</div>';
    }

    async initializeSettingsContent() {
        // Podstawowa inicjalizacja zakładki Ustawienia
        const settingsTab = document.querySelector('#settings');
        if (!settingsTab) return;

        try {
            // Załaduj zapisane ustawienia
            const { refreshInterval, theme, language } = await chrome.storage.local.get([
                'refreshInterval',
                'theme',
                'language'
            ]);

            // Ustaw interwał odświeżania
            const intervalSelect = settingsTab.querySelector('#refresh-interval');
            if (intervalSelect && refreshInterval) {
                intervalSelect.value = refreshInterval;
            }

            // Ustaw motyw
            const themeSwitch = settingsTab.querySelector('#theme-switch');
            if (themeSwitch && theme) {
                themeSwitch.checked = theme === 'dark';
            }

            // Ustaw język
            const langButtons = settingsTab.querySelectorAll('[data-lang]');
            langButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === (language || 'polish'));
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeSettingsContent'
            });
        }
    }

    async initializeTheme() {
        try {
            this.themeManager = new ThemeManager();
            await this.themeManager.initialize();
            
            // Set up theme toggle
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    this.themeManager.toggleTheme();
                });
            }

            // Add theme listener
            this.themeManager.addThemeListener((theme) => {
                this.updateThemeUI(theme);
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeTheme'
            });
            return false;
        }
    }

    updateThemeUI(theme) {
        try {
            const currentTheme = this.themeManager.getCurrentTheme();
            const themeToggle = document.getElementById('theme-toggle');
            
            if (themeToggle) {
                themeToggle.setAttribute('aria-label', 
                    currentTheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
                );
                themeToggle.classList.toggle('theme-dark', currentTheme === 'dark');
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateThemeUI',
                theme
            });
        }
    }

    async initializeLanguage() {
        try {
        const languageButtons = document.querySelectorAll('[data-lang]');
        const currentLang = localStorage.getItem('language') || 'polish';
        
        languageButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === currentLang);
            
            btn.addEventListener('click', async () => {
                const lang = btn.dataset.lang;
                    await this.updateLanguage(lang);
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeLanguage'
            });
        }
    }

    async updateLanguage(lang) {
        try {
            // Update buttons state
            document.querySelectorAll('[data-lang]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });

            // Save selected language
                localStorage.setItem('language', lang);
                
            // Load new translations
            await i18n.init();

            // Update interface
            this.updateInterface();

            // Notify listeners
            this.languageListeners.forEach(listener => {
                try {
                    listener(lang);
                } catch (listenerError) {
                    this.handleError(listenerError, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'updateLanguage',
                        listener: 'languageChange'
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'updateLanguage',
                language: lang
            });
        }
    }

    async initializeIntervalSettings() {
        try {
            const intervalSelect = document.getElementById('refresh-interval');
            if (!intervalSelect) return;

            // Load saved interval
            const { refreshInterval } = await chrome.storage.local.get('refreshInterval');
            if (refreshInterval) {
                intervalSelect.value = refreshInterval;
            }

            // Add change handler
            intervalSelect.addEventListener('change', async (e) => {
                const interval = parseInt(e.target.value, 10);
                await chrome.storage.local.set({ refreshInterval: interval });
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeIntervalSettings'
            });
        }
    }

    updateInterface() {
        try {
            // Update all elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (key) {
                    element.textContent = i18n.translate(key);
                }
            });

            // Update store select options
            const storeSelect = document.getElementById('store-select');
            if (storeSelect) {
                const allStoresOption = storeSelect.querySelector('option[data-i18n="allStores"]');
                if (allStoresOption) {
                    allStoresOption.textContent = i18n.translate('allStores');
                }
            }

            // Update tooltips
            document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
                const tooltipKey = el.getAttribute('data-i18n-tooltip');
                if (tooltipKey) {
                    el.setAttribute('title', i18n.translate(`tooltips.${tooltipKey}`));
                    const tooltip = bootstrap.Tooltip.getInstance(el);
                    if (tooltip) {
                        tooltip.dispose();
                    }
                    new bootstrap.Tooltip(el);
                }
            });

            // Update menu items
            document.querySelectorAll('.menu-text[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (key) {
                    el.textContent = i18n.translate(key);
                }
            });

            // Update store UI
            this.updateStoreUI();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateInterface'
            });
            return false;
        }
    }

    updateMenuItems() {
        try {
            const menuItems = document.querySelectorAll('.menu .menu-text');
            menuItems.forEach(item => {
                const key = item.getAttribute('data-i18n');
                if (key) {
                    item.textContent = i18n.translate(key);
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateMenuItems'
            });
        }
    }

    updateTooltips() {
        try {
            // Dispose existing tooltips
            this.tooltips.forEach(tooltip => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    // Ignore disposal errors
                }
            });
            this.tooltips.clear();

            // Initialize new tooltips
            document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
                const key = el.getAttribute('data-i18n-tooltip');
                if (key) {
                    el.setAttribute('title', i18n.translate(`tooltips.${key}`));
                    const tooltip = new bootstrap.Tooltip(el);
                    this.tooltips.add(tooltip);
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateTooltips'
            });
        }
    }

    addThemeListener(callback) {
        this.themeListeners.add(callback);
        return () => this.themeListeners.delete(callback);
    }

    addLanguageListener(callback) {
        this.languageListeners.add(callback);
        return () => this.languageListeners.delete(callback);
    }

    dispose() {
        try {
            // Clear all listeners
            this.themeListeners.clear();
            this.languageListeners.clear();

            // Clear menu items
            this.menuItems.clear();

            super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'dispose'
            });
        }
    }

    async updateInterfaceForStore(selectedStore) {
        try {
            if (!selectedStore) return;

            // Update store selector
            const storeSelect = document.getElementById('store-select');
            if (storeSelect) {
                storeSelect.value = selectedStore;
            }

            // Update store-specific elements
            document.querySelectorAll('[data-store]').forEach(element => {
                const storeId = element.getAttribute('data-store');
                element.classList.toggle('d-none', storeId !== selectedStore);
            });

            // Update store name in UI
            document.querySelectorAll('.store-name').forEach(element => {
                element.textContent = selectedStore;
            });

            // Save selected store
            await chrome.storage.local.set({ selectedStore });

            // Notify about store change
            this.emit('storeChanged', selectedStore);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'updateInterfaceForStore',
                selectedStore
            });
        }
    }

    async initializeTabs() {
        try {
            // Get last active tab from storage
            const { lastActiveTab } = await chrome.storage.local.get('lastActiveTab');
            
            // Initialize tab containers
            const tabContainers = document.querySelectorAll('.tab-pane');
            tabContainers.forEach(container => {
                const tabId = container.id;
                if (tabId) {
                    // Create tab button if doesn't exist
                    let tabButton = document.querySelector(`[data-target="#${tabId}"]`);
                    if (!tabButton) {
                        tabButton = this.createTabButton(tabId);
                    }

                    // Add click handler
                    tabButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.switchTab(`#${tabId}`);
                });
            }
        });

            // Switch to last active tab or first available
            if (lastActiveTab && document.querySelector(lastActiveTab)) {
                await this.switchTab(lastActiveTab);
            } else {
                const firstTab = document.querySelector('.tab-pane');
                if (firstTab) {
                    await this.switchTab(`#${firstTab.id}`);
                }
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeTabs'
            });
            return false;
        }
    }

    createTabButton(tabId) {
        try {
            const button = document.createElement('button');
            button.className = 'nav-link';
            button.setAttribute('data-target', `#${tabId}`);
            button.setAttribute('data-i18n', `tabs.${tabId}`);
            button.textContent = i18n.translate(`tabs.${tabId}`);

            const tabList = document.querySelector('.nav-tabs');
            if (tabList) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.appendChild(button);
                tabList.appendChild(li);
            }

            return button;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'createTabButton',
                tabId
            });
            return null;
        }
    }

    async initializeStatusButtons() {
        try {
            const statusButtons = document.querySelectorAll('[data-status-action]');
            statusButtons.forEach(button => {
                const action = button.getAttribute('data-status-action');
                if (action) {
                    button.addEventListener('click', () => this.handleStatusAction(action));
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeStatusButtons'
            });
        }
    }

    async handleStatusAction(action) {
        try {
            switch (action) {
                case 'refresh':
                    await this.emit('refreshRequested');
                break;
                case 'clear':
                    await this.emit('clearRequested');
                break;
                default:
                    throw new Error(`Unknown status action: ${action}`);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleStatusAction',
                action
            });
        }
    }

    async initializeLeadStatusLinks() {
        try {
            const statusLinks = document.querySelectorAll('[data-lead-status]');
            statusLinks.forEach(link => {
                const status = link.getAttribute('data-lead-status');
                if (status) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleLeadStatusClick(status, link);
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeLeadStatusLinks'
            });
        }
    }

    async handleLeadStatusClick(status, element) {
        try {
            // Emit status click event
            await this.emit('leadStatusClicked', { status, element });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleLeadStatusClick',
                status
            });
        }
    }

    async initializeStoreSelect() {
        try {
            const storeSelect = document.getElementById('store-select');
            if (!storeSelect) {
                throw new Error('Store select element not found');
            }

            // Wait for translations to be loaded
            await i18n.waitForTranslations();

            // Clear existing options
            storeSelect.innerHTML = '';

            // Add "All stores" option
            const allOption = document.createElement('option');
            allOption.value = 'ALL';
            allOption.textContent = i18n.translate('allStores');
            allOption.setAttribute('data-i18n', 'allStores');
            storeSelect.appendChild(allOption);

            // Add store options
            const stores = storeManager.getAllStores();
            stores
                .filter(store => store.id !== 'ALL')
                .forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = `${store.name} - ${store.address}`;
                    option.setAttribute('data-store-id', store.deliveryId?.toString() || '');
                    storeSelect.appendChild(option);
                });

            // Load current store
            const currentStore = await storeManager.getCurrentStore();
            if (currentStore) {
                storeSelect.value = currentStore.id;
            }

            // Add change handler
            storeSelect.addEventListener('change', async (e) => {
                try {
                    const newStoreId = e.target.value;
                    await storeManager.changeStore(newStoreId);
                    this.debugManager.logToPanel(i18n.translate('logs.storeChanged', { store: newStoreId }), 'info');
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                        method: 'handleStoreChange'
                    });
                }
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeStoreSelect'
            });
            return false;
        }
    }

    // Update store-related UI elements
    async updateStoreUI() {
        try {
            const currentStore = await storeManager.getCurrentStore();
            if (!currentStore) return false;

            // Update store name in UI
            document.querySelectorAll('[data-store-name]').forEach(el => {
                el.textContent = currentStore.name;
            });

            // Update store address in UI
            document.querySelectorAll('[data-store-address]').forEach(el => {
                el.textContent = currentStore.address;
            });

            // Update store-specific elements visibility
            document.querySelectorAll('[data-store-visibility]').forEach(el => {
                const visibilityStore = el.getAttribute('data-store-visibility');
                el.style.display = visibilityStore === currentStore.id ? '' : 'none';
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateStoreUI'
            });
            return false;
        }
    }
} 