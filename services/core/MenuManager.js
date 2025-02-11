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
            this.log(LogLevel.WARNING, `⚠️ Failed to save tab state: ${error.message}`);
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

            // Initialize menu tabs
            const tabElements = document.querySelectorAll(SELECTORS.TAB);
            if (!tabElements.length) {
                this.log(LogLevel.WARNING, '⚠️ No tab elements found');
                return true;
            }

            this.log(LogLevel.INFO, `📌 Found ${tabElements.length} tab elements`);

            // Store tab instances
            this.#tabInstances = new Map();

            // Initialize Bootstrap tabs and add ARIA attributes
            tabElements.forEach((tab, index) => {
                try {
                    // Remove any existing instance
                    const existingInstance = bootstrap.Tab.getInstance(tab);
                    if (existingInstance) {
                        existingInstance.dispose();
                    }

                    // Create new instance
                    const instance = new bootstrap.Tab(tab);
                    this.#tabInstances.set(tab, instance);

                    // Set ARIA attributes
                    const targetId = tab.getAttribute('href')?.substring(1);
                    tab.setAttribute('role', 'tab');
                    tab.setAttribute('aria-selected', tab.classList.contains('active'));
                    tab.setAttribute('aria-controls', targetId);
                    tab.setAttribute('tabindex', tab.classList.contains('active') ? '0' : '-1');

                    // Find corresponding panel and add ARIA attributes
                    const panel = document.getElementById(targetId);
                    if (panel) {
                        panel.setAttribute('role', 'tabpanel');
                        panel.setAttribute('aria-labelledby', tab.id || `tab-${index}`);
                        if (!tab.id) tab.id = `tab-${index}`;
                    }
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                        method: 'initializeMenuItems',
                        tab: tab
                    });
                }
            });

            // Add keyboard navigation container
            const menuContainer = document.querySelector('.menu');
            if (menuContainer) {
                menuContainer.setAttribute('role', 'tablist');
                menuContainer.setAttribute('aria-label', 'Main menu');
            }

            // Register event handlers
            this.#registerTabEventHandlers();

            // Set initial active tab
            const activeTab = document.querySelector(SELECTORS.ACTIVE_TAB);
            if (activeTab) {
                this.#activeTab = activeTab.getAttribute('href');
                const tabPane = document.querySelector(this.#activeTab);
                if (tabPane) {
                    tabPane.classList.add('show', 'active');
                }
            }

            // Initialize user selector
            await this.#initializeUserSelector();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeMenuItems'
            });
            return false;
        }
    }

    /**
     * Register tab event handlers
     * @private
     */
    #registerTabEventHandlers() {
        // Remove any existing event listeners
        document.removeEventListener('show.bs.tab', this._handleTabShow);
        document.removeEventListener('shown.bs.tab', this._handleTabShown);

        // Add Bootstrap tab event listeners with proper binding
        document.addEventListener('show.bs.tab', this._handleTabShow.bind(this));
        document.addEventListener('shown.bs.tab', this._handleTabShown.bind(this));

        // Add click handlers
        const tabs = document.querySelectorAll(SELECTORS.TAB);
        tabs.forEach(tab => {
            tab.addEventListener('click', this.#handleTabClick.bind(this));
            tab.addEventListener('keydown', this.#handleTabKeydown.bind(this));
        });
    }

    /**
     * Handle tab click event
     * @private
     */
    #handleTabClick(event) {
        try {
            event.preventDefault();
            const tab = event.currentTarget;
            
            // Let Bootstrap handle the tab switching
            const bsTab = new bootstrap.Tab(tab);
            bsTab.show();
            
            // Update our state
            this.#activeTab = tab.getAttribute('href');
            this.#saveTabState();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'handleTabClick',
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
     * Handle tab show event
     * @private
     */
    _handleTabShow(event) {
        try {
            const tab = event.target;
            const relatedTarget = event.relatedTarget;
            const targetId = tab.getAttribute('data-target');
            const currentTab = this.#activeTab;

            this.log(LogLevel.DEBUG, `🔄 Tab switch initiated`, {
                from: {
                    tab: currentTab,
                    element: relatedTarget ? {
                        href: relatedTarget.getAttribute('href'),
                        target: relatedTarget.getAttribute('data-target'),
                        classes: Array.from(relatedTarget.classList)
                    } : null
                },
                to: {
                    tab: targetId,
                    element: {
                        href: tab.getAttribute('href'),
                        target: targetId,
                        classes: Array.from(tab.classList)
                    }
                },
                eventPhase: 'show.bs.tab'
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleTabShow',
                event: event
            });
        }
    }

    /**
     * Handle keyboard navigation
     * @private
     */
    #handleTabKeydown(event) {
        const tab = event.currentTarget;
        const tabs = Array.from(document.querySelectorAll(SELECTORS.TAB));
        const index = tabs.indexOf(tab);
        let nextTab = null;

        switch (event.key) {
            case KEYS.LEFT:
                event.preventDefault();
                nextTab = tabs[index - 1] || tabs[tabs.length - 1];
                break;
            case KEYS.RIGHT:
                event.preventDefault();
                nextTab = tabs[index + 1] || tabs[0];
                break;
            case KEYS.HOME:
                event.preventDefault();
                nextTab = tabs[0];
                break;
            case KEYS.END:
                event.preventDefault();
                nextTab = tabs[tabs.length - 1];
                break;
            case KEYS.ENTER:
            case KEYS.SPACE:
                event.preventDefault();
                this.#handleTabClick(event);
                return;
        }

        if (nextTab) {
            // Update tabindex
            tabs.forEach(t => t.setAttribute('tabindex', '-1'));
            nextTab.setAttribute('tabindex', '0');
            nextTab.focus();
            
            // Create new Tab instance for activation
            const bsTab = new bootstrap.Tab(nextTab);
            bsTab.show();
            
            // Update state
            this.#activeTab = nextTab.getAttribute('href');
            this.#saveTabState();
        }
    }

    /**
     * Handle tab shown event
     * @private
     */
    async _handleTabShown(event) {
        try {
            const tab = event.target;
            const relatedTarget = event.relatedTarget;
            const targetId = tab.getAttribute('href');
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

            // Remove event listeners
            document.removeEventListener('show.bs.tab', this._handleTabShow);
            document.removeEventListener('shown.bs.tab', this._handleTabShown);
            this.log(LogLevel.DEBUG, '✅ Event listeners removed');

            // Dispose all tab instances
            const tabLinks = document.querySelectorAll(SELECTORS.TAB);
            this.log(LogLevel.DEBUG, `📍 Found ${tabLinks.length} tabs to dispose`);

            tabLinks.forEach((link, index) => {
                const targetId = link.getAttribute('data-target');
                const tabInstance = bootstrap.Tab.getInstance(link);
                if (tabInstance) {
                    tabInstance.dispose();
                    this.log(LogLevel.DEBUG, `✅ Disposed tab ${index + 1}/${tabLinks.length}: ${targetId}`);
                }
            });

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

            // Initialize user selector
            await UserCardService.initializeUserSelector();

            // Listen for user changes
            userSelect.addEventListener('change', async (e) => {
                const selectedId = e.target.value;
                const success = await UserCardService.setCurrentUser(selectedId);
                
                if (success) {
                    window.dispatchEvent(new CustomEvent(EVENTS.USER_CHANGED, {
                        detail: {
                            userId: selectedId,
                            timestamp: new Date().toISOString()
                        }
                    }));
                }
            });

            this.log(LogLevel.SUCCESS, '✅ User selector initialized');
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeUserSelector'
            });
        }
    }
} 