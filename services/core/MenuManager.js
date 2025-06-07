import { BaseManager, InitState } from './BaseManager.js';
import { EventType, ErrorType, ErrorSeverity, LogLevel } from './EventType.js';
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
    TAB: '.menu .link[data-target]',
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
 * @extends {BaseManager}
 * Manages menu interactions and state
 */
export class MenuManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #activeTab = null;
    #activeStore = null;
    #activeUser = null;
    #eventManager = null;
    #uiManager = null;

    constructor(registry) {
        if (MenuManager.#instance) {
            return MenuManager.#instance;
        }
        super(registry, 'menu');
        MenuManager.#instance = this;
        MenuManager._registry = registry;
        
        // Add dependencies
        this.addDependency('event');
        this.addDependency('store');
        this.addDependency('theme');
        this.addDependency('ui');
    }

    static getInstance() {
        if (!MenuManager.#instance && MenuManager._registry) {
            MenuManager.#instance = new MenuManager(MenuManager._registry);
        }
        return MenuManager.#instance;
    }

    static setRegistry(registry) {
        MenuManager._registry = registry;
    }

    /**
     * Initialize menu manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing menu manager...');
            
            // Get required dependencies
            const [eventManager, uiManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('ui')
            ]);

            // Store dependencies
            this.#eventManager = eventManager;
            this.#uiManager = uiManager;

            // Validate required dependencies
            if (!this.#eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }
            if (!this.#uiManager?.isInitialized()) {
                throw new Error('UIManager must be initialized');
            }

            // Initialize menu
            await this.initializeMenu();
            
            // Restore state
            await this.#restoreStoreState();
            
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
            // Initialize tabs
            const tabs = document.querySelectorAll(SELECTORS.TAB);
            tabs.forEach(tab => {
                tab.addEventListener('click', (e) => this.handleTabChange(e));
            });

            // Set initial active tab
            const activeTab = document.querySelector(SELECTORS.ACTIVE_TAB);
            if (activeTab) {
                this.#activeTab = activeTab.getAttribute('data-target');
            }

            // Initialize keyboard navigation
            document.addEventListener('keydown', (e) => {
                if (e.target.closest(SELECTORS.TAB)) {
                    this.handleKeyboardNavigation(e);
                }
            });

            this.log(LogLevel.SUCCESS, '✅ Menu initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
                method: 'initializeMenu'
            });
            throw error;
        }
    }

    /**
     * Handle tab change
     * @param {Event} event Click event
     */
    async handleTabChange(event) {
        try {
            event.preventDefault();
            const tab = event.target.closest(SELECTORS.TAB);
            if (!tab) return;

            // Update active tab
            document.querySelectorAll(SELECTORS.TAB).forEach(t => 
                t.classList.remove('active')
            );
            tab.classList.add('active');

            // Update tab panes
            const targetId = tab.getAttribute('data-target');
            document.querySelectorAll(SELECTORS.TAB_PANE).forEach(pane => {
                pane.classList.remove('show', 'active');
                if (pane.id === targetId) {
                    pane.classList.add('show', 'active');
                }
            });

            // Store active tab
            this.#activeTab = targetId;

            // Emit event
            await this.#eventManager.emit(EVENTS.TAB_CHANGED, {
                tab: targetId,
                timestamp: new Date().toISOString()
            });

            this.log(LogLevel.INFO, `📑 Tab changed to: ${targetId}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'handleTabChange'
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
     * Handle keyboard navigation
     * @param {KeyboardEvent} event Keyboard event
     */
    handleKeyboardNavigation(event) {
        try {
            const tabs = Array.from(document.querySelectorAll(SELECTORS.TAB));
            const currentTab = document.activeElement;
            const currentIndex = tabs.indexOf(currentTab);
            
            let nextTab;
            
            switch (event.key) {
                case KEYS.LEFT:
                    event.preventDefault();
                    nextTab = tabs[currentIndex - 1] || tabs[tabs.length - 1];
                    break;
                    
                case KEYS.RIGHT:
                    event.preventDefault();
                    nextTab = tabs[currentIndex + 1] || tabs[0];
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
                    currentTab.click();
                    return;
            }
            
            if (nextTab) {
                nextTab.focus();
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleKeyboardNavigation'
            });
        }
    }
} 