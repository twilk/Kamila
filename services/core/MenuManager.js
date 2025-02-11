import { BaseManager, InitState } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
import { UIManager } from './UIManager.js';
import { UserCardService } from '../userCard.js';

// Stałe dla zdarzeń
const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready',
    STORE_CHANGED: 'menu:storeChanged',
    DATA_UPDATED: 'menu:dataUpdated',
    USER_CHANGED: 'menu:userChanged'
};

// Stałe dla selektorów
const SELECTORS = {
    TAB: '.menu .link[data-bs-toggle="tab"]',
    TAB_PANE: '.tab-pane',
    ACTIVE_TAB: '.menu .link.active',
    USER_SELECT: '#user-select'
};

// Stałe dla klawiszy
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
    static _instance = null;
    #activeTab = null;
    #activeStore = null;
    #uiManager = null;
    #tabInstances = null;
    #storeData = new Map();
    #tabs = [];

    constructor() {
        if (MenuManager._instance) {
            throw new Error('Use MenuManager.getInstance()');
        }
        super('MenuManager');
        MenuManager._instance = this;
        this.addDependency(UIManager.getInstance());
        this.#uiManager = null;
        this.#activeTab = null;
        this.#activeStore = null;
        this.#tabInstances = null;
        this.#storeData = new Map();
        this.log(LogLevel.INFO, '🎯 MenuManager instance created');
    }

    /**
     * Get the singleton instance
     * @returns {MenuManager}
     */
    static getInstance() {
        if (!MenuManager._instance) {
            MenuManager._instance = new MenuManager();
        }
        return MenuManager._instance;
    }

    /**
     * Initialize the menu manager
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            if (this.isInitialized()) {
                this.log(LogLevel.WARNING, '⚠️ MenuManager already initialized');
                return true;
            }

            // Get and verify UIManager
            this.#uiManager = this.getDependency('UIManager');
            if (!this.#uiManager) {
                throw new Error('UIManager dependency not found');
            }

            // Wait for UIManager to be ready
            if (!this.#uiManager.isInitialized()) {
                this.log(LogLevel.INFO, '⏳ Waiting for UIManager to initialize...');
                await this.#uiManager.waitForReady();
            }

            // Restore states
            await Promise.all([
                this.#restoreTabState(),
                this.#restoreStoreState()
            ]);

            // Initialize menu items
            await this.#initializeMenuItems();

            // Setup store-related event listeners
            this.#setupStoreEventListeners();

            // Emit menu ready event
            window.dispatchEvent(new CustomEvent(EVENTS.MENU_READY));
            
            this.log(LogLevel.SUCCESS, '📋 Menu manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Setup store-related event listeners
     * @private
     */
    #setupStoreEventListeners() {
        window.addEventListener('menu:storeChanged', this.#handleStoreChange.bind(this));
        window.addEventListener('menu:dataUpdated', this.#handleDataUpdate.bind(this));
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

            // Setup store-related event listeners
            this.#setupStoreEventListeners();

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

            // Initialize Bootstrap tabs
            this.#tabs = Array.from(tabElements).map(element => {
                // Create new tab instance
                const tab = bootstrap.Tab.getOrCreateInstance(element);
                
                // Create a wrapper function that maintains the correct context
                const showTab = (event) => {
                    if (event) {
                        event.preventDefault();
                    }
                    tab.show.call(element);
                };
                
                // Add click handler
                element.addEventListener('click', showTab);

                // Add Bootstrap tab events
                element.addEventListener('show.bs.tab', this._handleTabShow.bind(this));
                element.addEventListener('shown.bs.tab', this._handleTabShown.bind(this));

                return {
                    element,
                    instance: tab,
                    show: showTab
                };
            });

            // Restore active tab after initialization
            await this.#restoreActiveTab();

            this.log(LogLevel.SUCCESS, '✅ Tabs initialized successfully');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: '#initializeTabs',
                details: error.message
            });
        }
    }

    /**
     * Handle tab show event
     * @private
     */
    async _handleTabShow(event) {
        try {
            const targetId = event.target.getAttribute('href');
            if (!targetId) return;

            this.log(LogLevel.INFO, `�� Tab show initiated: ${targetId}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleTabShow',
                event: event
            });
        }
    }

    /**
     * Handle tab shown event
     * @private
     */
    async _handleTabShown(event) {
        try {
            const tab = event.target;
            const targetId = tab.getAttribute('href');
            if (!targetId) return;

            const previousTab = this.#activeTab;
            this.#activeTab = targetId;
            
            // Update active states for menu links
            const menuLinks = document.querySelectorAll(SELECTORS.TAB);
            menuLinks.forEach(link => {
                const linkHref = link.getAttribute('href');
                link.classList.toggle('active', linkHref === targetId);
            });

            // Update active states for tab panes
            const tabPanes = document.querySelectorAll(SELECTORS.TAB_PANE);
            tabPanes.forEach(pane => {
                const isTargetPane = pane.id === targetId.substring(1);
                pane.classList.toggle('show', isTargetPane);
                pane.classList.toggle('active', isTargetPane);
            });

            // Save state to storage
            await this.#saveTabState();

            this.log(LogLevel.SUCCESS, `✅ Tab switch completed`, {
                from: previousTab,
                to: targetId,
                activeTabsCount: document.querySelectorAll(`${SELECTORS.TAB}.active`).length
            });

            // Emit tab change event
            window.dispatchEvent(new CustomEvent(EVENTS.TAB_CHANGED, {
                detail: {
                    previousTab,
                    currentTab: targetId,
                    timestamp: new Date().toISOString()
                }
            }));

            // Update ARIA states
            menuLinks.forEach(link => {
                const isActive = link.getAttribute('href') === targetId;
                link.setAttribute('aria-selected', isActive);
                link.setAttribute('tabindex', isActive ? '0' : '-1');
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleTabShown',
                event: event
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
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'setActiveStore',
                storeId
            });
        }
    }

    /**
     * Clear store data
     * @param {string} storeId
     */
    clearStoreData(storeId) {
        try {
            this.#storeData.delete(storeId);
            this.log(LogLevel.INFO, `🧹 Cleared data for store ${storeId}`);
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.LOW, {
                method: 'clearStoreData',
                storeId
            });
        }
    }

    /**
     * Clear all store data
     */
    clearAllStoreData() {
        try {
            this.#storeData.clear();
            this.log(LogLevel.INFO, '🧹 Cleared all store data');
        } catch (error) {
            this.handleError(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
                method: 'clearAllStoreData'
            });
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        try {
            this.log(LogLevel.INFO, '🧹 Starting MenuManager cleanup');

            // Remove event listeners from tabs
            if (this.#tabs) {
                this.#tabs.forEach(tab => {
                    tab.element.removeEventListener('show.bs.tab', this._handleTabShow);
                    tab.element.removeEventListener('shown.bs.tab', this._handleTabShown);
                    if (tab.instance) {
                        tab.instance.dispose();
                    }
                });
            }
            this.log(LogLevel.DEBUG, '✅ Tab instances disposed');

            // Clear tab references
            this.#tabs = [];
            this.#activeTab = null;

            super.dispose();
            this.log(LogLevel.SUCCESS, '✨ MenuManager disposed successfully');
        } catch (error) {
            this.log(LogLevel.ERROR, `❌ MenuManager disposal failed: ${error.message}`);
            this.handleError(error, ErrorType.CLEANUP, ErrorSeverity.LOW, {
                method: 'dispose'
            });
        }
    }

    /**
     * Initialize user selector
     * @private
     */
    async #initializeUserSelector() {
        try {
            const userSelect = document.querySelector(SELECTORS.USER_SELECT);
            if (!userSelect) {
                this.log(LogLevel.WARNING, '⚠️ User selector not found');
                return;
            }

            // Verify UserCardService is available
            if (typeof UserCardService === 'undefined') {
                throw new Error('UserCardService is not available');
            }

            // Initialize user selector
            this.log(LogLevel.INFO, '⏳ Initializing user selector...');
            await UserCardService.initializeUserSelector();

            // Listen for user changes
            userSelect.addEventListener('change', async (e) => {
                try {
                    const selectedId = e.target.value;
                    const success = await UserCardService.setCurrentUser(selectedId);
                    
                    if (success) {
                        window.dispatchEvent(new CustomEvent(EVENTS.USER_CHANGED, {
                            detail: {
                                userId: selectedId,
                                timestamp: new Date().toISOString()
                            }
                        }));
                        this.log(LogLevel.SUCCESS, `✅ User changed to: ${selectedId}`);
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                        method: 'userSelect.onChange',
                        details: error.message
                    });
                }
            });

            this.log(LogLevel.SUCCESS, '✅ User selector initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeUserSelector',
                details: error.message
            });
        }
    }

    /**
     * Restore active tab
     * @private
     */
    async #restoreActiveTab() {
        try {
            if (!this.#activeTab) {
                this.log(LogLevel.DEBUG, '⏭️ No active tab to restore');
                return;
            }
            
            const activeTabElement = document.querySelector(`${SELECTORS.TAB}[href="${this.#activeTab}"]`);
            if (!activeTabElement) {
                this.log(LogLevel.WARNING, `⚠️ Active tab element not found: ${this.#activeTab}`);
                return;
            }

            const tab = this.#tabs.find(t => t.element === activeTabElement);
            if (tab) {
                this.log(LogLevel.INFO, `🔄 Restoring active tab: ${this.#activeTab}`);
                tab.show();
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '#restoreActiveTab',
                activeTab: this.#activeTab
            });
        }
    }

    /**
     * Check if element is active
     * @param {HTMLElement} elem - Element to check
     * @returns {boolean}
     * @private
     */
    _elemIsActive(elem) {
        if (!elem) return false;
        return elem.classList.contains('active') || 
               elem.getAttribute('aria-selected') === 'true' ||
               elem.getAttribute('data-active') === 'true';
    }
} 