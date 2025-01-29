import { BaseManager, InitState } from './BaseManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from '../index.js';
import { UIManager } from './UIManager.js';

/**
 * Manages menu interactions and tab switching
 */
class MenuManager extends BaseManager {
    static _instance = null;
    #activeTab = null;
    #uiManager = null;
    #tabInstances = null;

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
    async onInitialize() {
        try {
            if (this.isInitialized()) {
                this.log(LogLevel.WARNING, '⚠️ MenuManager already initialized');
                return true;
            }

            // Get and verify UIManager
            this.#uiManager = this.getDependency('UIManager');
            if (!this.#uiManager?.isInitialized()) {
                this.log(LogLevel.WARNING, '⚠️ Waiting for UIManager to initialize...');
                await this.#uiManager.waitForReady();
            }

            // Set initial active tab
            this.#activeTab = '#chat';
            this.log(LogLevel.INFO, `📌 Initial active tab set to: ${this.#activeTab}`);

            // Initialize menu items
            await this.#initializeMenuItems();

            // Emit menu ready event
            window.dispatchEvent(new CustomEvent('menu:ready'));
            
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
            const tabElements = document.querySelectorAll('.menu .link[data-bs-toggle="tab"]');
            if (!tabElements.length) {
                this.log(LogLevel.WARNING, '⚠️ No tab elements found');
                return true;
            }

            this.log(LogLevel.INFO, `📌 Found ${tabElements.length} tab elements`);

            // Store tab instances
            this.#tabInstances = new Map();

            // Initialize Bootstrap tabs
            tabElements.forEach(tab => {
                try {
                    // Create Bootstrap tab instance with proper binding
                    const tabInstance = new bootstrap.Tab(tab);
                    this.#tabInstances.set(tab, tabInstance);
                    
                    // Add click handler with proper binding
                    tab.addEventListener('click', (event) => {
                        event.preventDefault();
                        const oldTab = this.#activeTab;
                        const newTab = tab.getAttribute('href');
                        
                        // Show the tab using the stored instance
                        const instance = this.#tabInstances.get(tab);
                        if (instance) {
                            instance.show();
                        }
                        
                        this.log(LogLevel.INFO, `🔄 Tab click detected`, {
                            from: oldTab,
                            to: newTab,
                            hasInstance: !!this.#tabInstances.get(tab),
                            elementClasses: Array.from(tab.classList),
                            targetPaneExists: !!document.querySelector(newTab)
                        });
                    });
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeMenuItems',
                        element: tab
                    });
                }
            });

            // Add Bootstrap tab event listeners
            document.addEventListener('show.bs.tab', this._handleTabShow.bind(this));
            document.addEventListener('shown.bs.tab', this._handleTabShown.bind(this));
            
            // Set initial active tab
            const activeTab = document.querySelector('.menu .link.active');
            if (activeTab) {
                this.#activeTab = activeTab.getAttribute('href');
                const tabPane = document.querySelector(this.#activeTab);
                if (tabPane) {
                    tabPane.classList.add('show', 'active');
                }
                
                this.log(LogLevel.INFO, `📌 Initial active tab set`, {
                    tab: this.#activeTab,
                    hasInstance: !!this.#tabInstances.get(activeTab)
                });
            }

            this.log(LogLevel.SUCCESS, '✅ Menu items initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeMenuItems'
            });
            return false;
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
     * Handle tab shown event
     * @private
     */
    _handleTabShown(event) {
        try {
            const tab = event.target;
            const relatedTarget = event.relatedTarget;
            const targetId = tab.getAttribute('href');
            const previousTab = this.#activeTab;
            this.#activeTab = targetId;
            
            // Update active states for menu links
            const menuLinks = document.querySelectorAll('.menu .link');
            menuLinks.forEach(link => {
                const linkHref = link.getAttribute('href');
                link.classList.toggle('active', linkHref === targetId);
            });

            // Update active states for tab panes
            const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => {
                const isTargetPane = pane.id === targetId.substring(1);
                pane.classList.toggle('show', isTargetPane);
                pane.classList.toggle('active', isTargetPane);
            });

            this.log(LogLevel.SUCCESS, `✅ Tab switch completed`, {
                from: previousTab,
                to: targetId,
                activeTabsCount: document.querySelectorAll('.menu .link.active').length
            });

            // Emit tab change event
            window.dispatchEvent(new CustomEvent('menu:tabChanged', {
                detail: {
                    previousTab,
                    currentTab: targetId,
                    timestamp: new Date().toISOString()
                }
            }));
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

            super.dispose();
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