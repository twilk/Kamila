import { UIManager } from './core/UIManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { i18n } from './i18n.js';
import { themeService } from './theme.js';

export class InterfaceManager extends UIManager {
    constructor() {
        super();
        this.activeTab = null;
        this.menuItems = new Map();
        this.themeListeners = new Set();
        this.languageListeners = new Set();
    }

    async initialize() {
        try {
            await super.initialize();

            // Initialize interface components
            await this.initializeMenu();
            await this.initializeTheme();
            await this.initializeLanguage();
            await this.initializeTooltips();
            await this.initializeIntervalSettings();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
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
            const themeSwitch = document.getElementById('theme-switch');
            if (!themeSwitch) return;

            // Set initial state
            const currentTheme = themeService.getCurrentTheme();
            themeSwitch.checked = currentTheme === 'dark';
            document.body.setAttribute('data-theme', currentTheme);

            // Add change handler
            themeSwitch.addEventListener('change', (e) => {
                const newTheme = e.target.checked ? 'dark' : 'light';
                this.updateTheme(newTheme);
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeTheme'
            });
        }
    }

    updateTheme(theme) {
        try {
            themeService.applyTheme(theme);
            document.body.setAttribute('data-theme', theme);
            
            // Notify listeners
            this.themeListeners.forEach(listener => {
                try {
                    listener(theme);
                } catch (listenerError) {
                    this.handleError(listenerError, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'updateTheme',
                        listener: 'themeChange'
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateTheme',
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

            // Update tooltips
            this.updateTooltips();

            // Update menu items
            this.updateMenuItems();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateInterface'
            });
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
} 