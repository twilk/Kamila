import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../index.js';
import { UIManager } from './UIManager.js';

/**
 * Manages menu interactions and tab switching
 */
class MenuManager extends BaseManager {
    static _instance = null;
    #activeTab = null;
    #uiManager = null;

    constructor() {
        if (MenuManager._instance) {
            throw new Error('Use MenuManager.getInstance()');
        }
        super('MenuManager');
        MenuManager._instance = this;
        this.addDependency(UIManager.getInstance());
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
    async initialize() {
        try {
            if (this.isInitialized()) {
                this.log(LogLevel.WARNING, '⚠️ MenuManager already initialized');
                return true;
            }

            // Initialize base and dependencies
            await super.initialize();

            // Get and verify UIManager
            this.#uiManager = this.getDependency('UIManager');
            if (!this.#uiManager?.isInitialized()) {
                throw new Error('UIManager must be initialized before MenuManager');
            }

            // Set initial active tab
            this.#activeTab = '#chat';
            this.log(LogLevel.INFO, `📌 Initial active tab set to: ${this.#activeTab}`);

            // Initialize menu items
            await this.#initializeMenuItems();

            // Set initialized state
            this._setInitialized(true);
            this.log(LogLevel.SUCCESS, '✨ MenuManager initialized successfully');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Initialize menu items
     * @private
     */
    async #initializeMenuItems() {
        try {
            // Initialize menu tabs
            const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
            tabElements.forEach(tab => {
                new bootstrap.Tab(tab);
                
                // Add click handler
                tab.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.#activeTab = tab.getAttribute('href');
                    this.log(LogLevel.INFO, `📌 Active tab changed to: ${this.#activeTab}`);
                });
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Handle tab show event
     * @private
     */
    _handleTabShow(event) {
        try {
            const targetId = event.target.getAttribute('data-target');
            const currentTab = this.#activeTab;
            this.log(LogLevel.DEBUG, `🔄 Tab switch initiated: ${currentTab} -> ${targetId}`);
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
    _handleTabShown(event) {
        try {
            const targetId = event.target.getAttribute('data-target');
            const previousTab = this.#activeTab;
            this.#activeTab = targetId;
            
            // Update active states
            document.querySelectorAll('.menu .link').forEach(item => {
                item.classList.remove('active');
            });
            event.target.classList.add('active');

            this.log(LogLevel.SUCCESS, `✅ Tab switch completed: ${previousTab} -> ${targetId}`);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: '_handleTabShown',
                event: event
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
            const tabLinks = document.querySelectorAll('.menu .link[data-bs-toggle="tab"]');
            this.log(LogLevel.DEBUG, `📍 Found ${tabLinks.length} tabs to dispose`);

            tabLinks.forEach((link, index) => {
                const targetId = link.getAttribute('data-target');
                const tabInstance = bootstrap.Tab.getInstance(link);
                if (tabInstance) {
                    tabInstance.dispose();
                    this.log(LogLevel.DEBUG, `✅ Disposed tab ${index + 1}/${tabLinks.length}: ${targetId}`);
                }
            });

            this._setInitialized(false);
            this.log(LogLevel.SUCCESS, '✨ MenuManager disposed successfully');
        } catch (error) {
            this.log(LogLevel.ERROR, `❌ MenuManager disposal failed: ${error.message}`);
            this.handleError(error, ErrorType.CLEANUP, ErrorSeverity.LOW, {
                method: 'dispose'
            });
        }
    }
}

export { MenuManager };
export const menuManager = MenuManager.getInstance(); 