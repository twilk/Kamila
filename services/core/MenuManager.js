import { BaseManager, InitState } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { UIManager } from './UIManager.js';
import { UserManager } from './UserManager.js';
import { EventManager } from './EventManager.js';

// Constants for events
const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready',
    STORE_CHANGED: 'menu:storeChanged',
    DATA_UPDATED: 'menu:dataUpdated',
    USER_CHANGED: 'menu:userChanged'
};

// Constants for selectors
const SELECTORS = {
    TAB: '.menu .link[data-bs-toggle="tab"]',
    TAB_PANE: '.tab-pane',
    ACTIVE_TAB: '.menu .link.active',
    USER_SELECT: '#user-select'
};

// Constants for keys
const KEYS = {
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    ENTER: 'Enter',
    SPACE: ' '
};

/**
 * Manages menu interactions and tab switching
 */
export class MenuManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #activeTab = null;
    /** @private */
    #settings = null;
    /** @private */
    #eventManager = null;
    /** @private */
    #storeManager = null;
    /** @private */
    #themeManager = null;
    /** @private */
    #activeStore = null;
    /** @private */
    #storeData = new Map();
    /** @private */
    #tabs = [];
    /** @private */
    #setupEventListeners = async () => {
        try {
            // Get event manager dependency
            this.#eventManager = await this.getDependency('event');
            
            // Listen for menu events
            await this.#eventManager.on('menu:tabChanged', async (event) => {
                const { tabId } = event;
                await this.handleTabChange(tabId);
            });
            
            await this.#eventManager.on('menu:ready', async () => {
                await this.initializeMenu();
            });
            
            // Initialize menu
            await this.initializeMenu();
            
            this.log(LogLevel.SUCCESS, '✅ Menu event listeners initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH);
            return false;
        }
    };

    constructor(registry) {
        if (MenuManager.#instance) {
            return MenuManager.#instance;
        }
        super(registry, 'MenuManager');
        MenuManager.#instance = this;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('store');
        this.addDependency('theme');
    }

    /**
     * Get singleton instance
     * @returns {MenuManager}
     */
    static getInstance() {
        const registry = BaseManager.getRegistry();
        if (!MenuManager.#instance && registry) {
            MenuManager.#instance = new MenuManager(registry);
        }
        return MenuManager.#instance;
    }

    /**
     * Set registry for all instances
     * @param {ManagerRegistry} registry Manager registry
     */
    static setRegistry(registry) {
        BaseManager.setRegistry(registry);
    }

    /**
     * Initialize menu manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing menu manager...');
            
            // Get dependencies
            this.#eventManager = await this.getDependency('event');
            this.#storeManager = await this.getDependency('store');
            this.#themeManager = await this.getDependency('theme');
            
            // Set up event listeners
            await this.#setupEventListeners();
            
            this.log(LogLevel.SUCCESS, '✅ Menu manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Initialize menu
     * @private
     */
    async initializeMenu() {
        try {
            // Get all menu items
            const menuItems = document.querySelectorAll(SELECTORS.TAB);
            
            // Add click handlers
            menuItems.forEach(item => {
                item.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const tabId = item.getAttribute('data-tab-id');
                    if (tabId) {
                        await this.handleTabChange(tabId);
                    }
                });
            });
            
            // Set initial active tab
            const activeTab = document.querySelector(SELECTORS.ACTIVE_TAB);
            if (activeTab) {
                const tabId = activeTab.getAttribute('data-tab-id');
                if (tabId) {
                    await this.handleTabChange(tabId);
                }
            }
            
            this.log(LogLevel.DEBUG, '🔄 Menu initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'initializeMenu'
            });
            throw error;
        }
    }

    /**
     * Handle tab change
     * @private
     */
    async handleTabChange(tabId) {
        try {
            // Hide all tab panes
            const panes = document.querySelectorAll(SELECTORS.TAB_PANE);
            panes.forEach(pane => pane.classList.remove('active', 'show'));
            
            // Show selected pane
            const selectedPane = document.querySelector(`#${tabId}`);
            if (selectedPane) {
                selectedPane.classList.add('active', 'show');
            }
            
            // Update active tab
            const tabs = document.querySelectorAll(SELECTORS.TAB);
            tabs.forEach(tab => {
                if (tab.getAttribute('data-tab-id') === tabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            // Emit event
            const eventManager = await this.getDependency('event');
            await eventManager.emit('menu:tabChanged', { tabId });
            
            this.log(LogLevel.DEBUG, '🔄 Tab changed', { tabId });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'handleTabChange',
                tabId
            });
            throw error;
        }
    }

    /**
     * Handle store change event
     * @private
     */
    async #handleStoreChange(event) {
        try {
            const { previousStore, currentStore } = event.detail;
            this.#activeStore = currentStore;
            await this.#saveStoreState();
            
            this.log(LogLevel.INFO, `📍 Store changed from ${previousStore} to ${currentStore}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'handleStoreChange',
                event: event
            });
        }
    }

    /**
     * Handle data update event
     * @private
     */
    async #handleDataUpdate(event) {
        try {
            const { storeId, counts, timestamp } = event.detail;
            this.#storeData.set(storeId, {
                counts,
                timestamp,
                lastUpdate: Date.now()
            });
            
            this.log(LogLevel.INFO, `📊 Updated data for store ${storeId}`);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'handleDataUpdate',
                event: event
            });
        }
    }

    /**
     * Restore tab state from storage
     * @private
     */
    async #restoreTabState() {
        try {
            const { activeTab } = await chrome.storage.local.get('activeTab');
            this.#activeTab = activeTab || '#chat';
            this.log(LogLevel.INFO, `📌 Restored active tab: ${this.#activeTab}`);
        } catch (error) {
            this.#activeTab = '#chat';
            this.log(LogLevel.WARNING, `⚠️ Failed to restore tab state: ${error.message}`);
        }
    }

    /**
     * Save current tab state to storage
     * @private
     */
    async #saveTabState() {
        try {
            await chrome.storage.local.set({ activeTab: this.#activeTab });
            this.log(LogLevel.DEBUG, `💾 Saved active tab: ${this.#activeTab}`);
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.LOW, {
                method: '#saveTabState'
            });
        }
    }

    /**
     * Restore store state from storage
     * @private
     */
    async #restoreStoreState() {
        try {
            const { activeStore } = await chrome.storage.local.get('activeStore');
            this.#activeStore = activeStore || null;
            this.log(LogLevel.INFO, `📌 Restored active store: ${this.#activeStore}`);
        } catch (error) {
            this.#activeStore = null;
            this.log(LogLevel.WARNING, `⚠️ Failed to restore store state: ${error.message}`);
        }
    }

    /**
     * Save current store state to storage
     * @private
     */
    async #saveStoreState() {
        try {
            await chrome.storage.local.set({ activeStore: this.#activeStore });
            this.log(LogLevel.DEBUG, `💾 Saved active store: ${this.#activeStore}`);
        } catch (error) {
            this.log(LogLevel.WARNING, `⚠️ Failed to save store state: ${error.message}`);
        }
    }

    /**
     * Initialize menu items
     * @private
     */
    async #initializeMenuItems() {
        try {
            // Wait for Bootstrap to be available
            if (typeof bootstrap === 'undefined') {
                this.log(LogLevel.WARNING, '⚠️ Waiting for Bootstrap to load...');
                await this.#waitForBootstrap();
            }

            // Initialize user selector first
            await this.#initializeUserSelector();

            // Initialize menu tabs
            await this.#initializeTabs();

            // Setup event listeners
            await this.#setupEventListeners();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeMenuItems',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Initialize tab functionality
     * @private
     */
    async #initializeTabs() {
        try {
            // Find all tab elements
            const tabElements = document.querySelectorAll(SELECTORS.TAB);
            this.log(LogLevel.INFO, `📌 Found ${tabElements.length} tab elements`);

            // Initialize tabs array
            this.#tabs = [];

            // Process each tab element
            tabElements.forEach(element => {
                // Create tab data object
                const tabData = {
                    element,
                    href: element.getAttribute('href'),
                    active: element.classList.contains('active')
                };

                // Add click handler
                element.addEventListener('click', (event) => {
                    event.preventDefault();
                    
                    try {
                        // Get target pane
                        const targetId = event.currentTarget.getAttribute('href');
                        if (!targetId) return;

                        // Hide all panes first
                        document.querySelectorAll(SELECTORS.TAB_PANE).forEach(pane => {
                            pane.classList.remove('show', 'active');
                        });

                        // Show target pane
                        const targetPane = document.querySelector(targetId);
                        if (targetPane) {
                            targetPane.classList.add('show', 'active');
                        }

                        // Update tab states
                        document.querySelectorAll(SELECTORS.TAB).forEach(tab => {
                            const isActive = tab.getAttribute('href') === targetId;
                            tab.classList.toggle('active', isActive);
                            tab.setAttribute('aria-selected', isActive.toString());
                            tab.setAttribute('tabindex', isActive ? '0' : '-1');
                        });

                        // Handle tab change
                        this._handleTabChange(event.currentTarget);
                    } catch (error) {
                        this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                            method: 'tabClickHandler',
                            href: event.currentTarget.getAttribute('href')
                        });
                    }
                });

                // Store tab data
                this.#tabs.push(tabData);
            });

            // Restore active tab after initialization
            if (this.#activeTab) {
                const activeElement = document.querySelector(`${SELECTORS.TAB}[href="${this.#activeTab}"]`);
                if (activeElement) {
                    // Get target pane
                    const targetId = activeElement.getAttribute('href');
                    if (targetId) {
                        // Show target pane
                        const targetPane = document.querySelector(targetId);
                        if (targetPane) {
                            // Hide all panes first
                            document.querySelectorAll(SELECTORS.TAB_PANE).forEach(pane => {
                                pane.classList.remove('show', 'active');
                            });
                            
                            // Show target pane
                            targetPane.classList.add('show', 'active');
                            
                            // Update tab states
                            document.querySelectorAll(SELECTORS.TAB).forEach(tab => {
                                const isActive = tab.getAttribute('href') === targetId;
                                tab.classList.toggle('active', isActive);
                                tab.setAttribute('aria-selected', isActive.toString());
                                tab.setAttribute('tabindex', isActive ? '0' : '-1');
                            });
                        }
                    }
                    this._handleTabChange(activeElement);
                }
            }

            this.log(LogLevel.SUCCESS, '✅ Tabs initialized successfully');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: '#initializeTabs',
                details: error.message
            });
        }
    }

    /**
     * Wait for Bootstrap to be available
     * @private
     * @returns {Promise<void>}
     */
    async #waitForBootstrap() {
        const maxAttempts = 10;
        const delayMs = 500;
        let attempts = 0;

        while (typeof bootstrap === 'undefined' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempts++;
            this.log(LogLevel.DEBUG, `Waiting for Bootstrap (attempt ${attempts}/${maxAttempts})`);
        }

        if (typeof bootstrap === 'undefined') {
            throw new Error('Bootstrap failed to load after multiple attempts');
        }
    }

    /**
     * Get store data
     * @param {string} storeId
     * @returns {Object|null}
     */
    getStoreData(storeId) {
        try {
            const data = this.#storeData.get(storeId);
            if (!data) {
                this.log(LogLevel.WARNING, `⚠️ No data found for store ${storeId}`);
                return null;
            }
            
            // Check if data is still valid
            const isValid = data.lastUpdate && (Date.now() - data.lastUpdate < 5 * 60 * 1000); // 5 minutes TTL
            if (!isValid) {
                this.log(LogLevel.WARNING, `⚠️ Data for store ${storeId} is outdated`);
                return null;
            }
            
            return data;
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'getStoreData',
                storeId
            });
            return null;
        }
    }

    /**
     * Get active store
     * @returns {string|null}
     */
    getActiveStore() {
        return this.#activeStore;
    }

    /**
     * Set active store
     * @param {string} storeId
     * @returns {Promise<void>}
     */
    async setActiveStore(storeId) {
        try {
            this.#activeStore = storeId;
            await this.#saveStoreState();
            this.log(LogLevel.INFO, `📍 Active store set to ${storeId}`);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM);
        }
    }

    async #loadInitialState() {
        try {
            const storeManager = await this.getDependency('store');
            const activeStore = storeManager.getActiveStore();
            
            if (activeStore) {
                await this.setActiveStore(activeStore.id);
            }

            this.log(LogLevel.INFO, '✅ Initial state loaded');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
        }
    }

    async #initializeUserSelector() {
        try {
            const userManager = await this.getDependency('user');
            const eventManager = await this.getDependency('event');

            if (!userManager?.isInitialized()) {
                throw new Error('UserManager must be initialized');
            }

            const userSelect = document.querySelector('#userSelect');
            if (!userSelect) {
                this.log(LogLevel.WARNING, '⚠️ User selector not found');
                return;
            }

            // Initialize user selector
            await userManager.initializeUserSelector();

            // Listen for user changes
            userSelect.addEventListener('change', async (e) => {
                try {
                    const selectedId = e.target.value;
                    const success = await userManager.setCurrentUser(selectedId);
                    
                    if (success) {
                        eventManager.emit('user:change', {
                            userId: selectedId,
                            timestamp: new Date().toISOString()
                        });
                        this.log(LogLevel.SUCCESS, `✅ User changed to: ${selectedId}`);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM);
                }
            });

            this.log(LogLevel.SUCCESS, '✅ User selector initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM);
        }
    }
}
export const menuManager = MenuManager.getInstance(); 