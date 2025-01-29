import { BaseManager, InitState } from './BaseManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { ThemeManager } from './ThemeManager.js';

/**
 * @extends {BaseManager}
 * Base class for UI-related managers
 */
export class UIManager extends BaseManager {
    static #instance = null;
    #tooltips = new Map();
    #modals = new Map();
    #eventListeners = new Map();
    #tooltipsInitialized = false;
    #modalsInitialized = false;
    #listenersInitialized = false;
    #errorHandler = null;
    
    /**
     * @protected
     * @type {Array<UIManager>}
     */
    _uiDependencies = [];

    /**
     * @param {Array<IInitializable>} [coreDependencies=[]] - Core service dependencies
     * @param {Array<UIManager>} [uiDependencies=[]] - UI manager dependencies
     */
    constructor(coreDependencies = [], uiDependencies = []) {
        if (UIManager.#instance) {
            return UIManager.#instance;
        }
        super('UIManager');
        UIManager.#instance = this;
        this._dependencies = new Set(coreDependencies);
        this._uiDependencies = uiDependencies;
        
        // Initialize error handler in constructor
        this.#errorHandler = ErrorHandler.getInstance();
        this.#errorHandler.initialize().catch(err => {
            console.error('Failed to initialize error handler:', err);
        });
    }

    /**
     * Get singleton instance
     * @returns {UIManager}
     */
    static getInstance() {
        if (!UIManager.#instance) {
            UIManager.#instance = new UIManager();
        }
        return UIManager.#instance;
    }

    /**
     * Handle UI-related errors
     * @override
     */
    handleError(error, type = ErrorType.UI, severity = ErrorSeverity.HIGH, context = {}) {
        try {
            // Log error to console as backup
            console.error('[UIManager] Error:', error, context);

            // Ensure we have an error handler
            if (!this.#errorHandler) {
                console.warn('[UIManager] Error handler not initialized, creating new instance');
                this.#errorHandler = ErrorHandler.getInstance();
            }

            // Call error handler with proper context
            if (typeof this.#errorHandler.handle === 'function') {
                this.#errorHandler.handle(error, type, severity, {
                    ...context,
                    manager: 'UIManager',
                    component: context.component || 'unknown'
                });
            } else {
                console.error('[UIManager] Error handler missing handle method:', this.#errorHandler);
            }

            // Show error message in UI if appropriate
            if (severity >= ErrorSeverity.HIGH) {
                this.showMessage('error', error.message || 'An error occurred');
            }
        } catch (handlerError) {
            // If error handling fails, log to console as last resort
            console.error('[UIManager] Failed to handle UI error:', handlerError);
            console.error('[UIManager] Original error:', error);
        }
    }

    /**
     * Wait for Bootstrap to be loaded
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
     * Initialize UI manager and its dependencies
     * @returns {Promise<boolean>}
     */
    async onInitialize() {
        try {
            this.log(LogLevel.INFO, 'Starting UI manager initialization');

            // Ensure error handler is initialized
            this.#errorHandler = ErrorHandler.getInstance();
            
            // Wait for Bootstrap to be loaded
            await this.#waitForBootstrap();
            
            // Initialize UI components
            await this.#initializeTooltips();
            await this.#initializeModals();
            await this.#initializeEventListeners();

            // Check if all components are initialized
            const allInitialized = this.#tooltipsInitialized && 
                                 this.#modalsInitialized && 
                                 this.#listenersInitialized;
                                 
            if (!allInitialized) {
                throw new Error('Not all UI components were initialized');
            }

            this.log(LogLevel.SUCCESS, '🎨 UI manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Initialize tooltips
     * @private
     */
    async #initializeTooltips() {
        try {
            this.log(LogLevel.INFO, 'Disposing existing tooltips');
            // Clear existing tooltips
            this.#tooltips.forEach((tooltip, key) => {
                try {
                    tooltip?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeTooltips',
                        action: 'dispose',
                        key
                    });
                }
            });
            this.#tooltips.clear();

            this.log(LogLevel.INFO, 'Creating new tooltips');
            // Initialize new tooltips
            const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipTriggerList.forEach(el => {
                try {
                    const tooltip = new bootstrap.Tooltip(el, {
                        animation: true,
                        delay: { show: 100, hide: 100 },
                        placement: 'auto'
                    });
                    this.#tooltips.set(el, tooltip);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeTooltips',
                        element: el
                    });
                }
            });

            this.#tooltipsInitialized = true;
            this.log(LogLevel.SUCCESS, 'Tooltips initialized', {
                count: this.#tooltips.size
            });
            
            // Check if all components are initialized
            this.#checkInitializationState();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeTooltips'
            });
            throw error;
        }
    }

    /**
     * Initialize modals
     * @private
     */
    async #initializeModals() {
        try {
            this.log(LogLevel.INFO, 'Disposing existing modals');
            // Clear existing modals
            this.#modals.forEach((modal, key) => {
                try {
                    modal?.dispose();
                } catch (e) {
                    this.handleError(e, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeModals',
                        action: 'dispose',
                        key
                    });
                }
            });
            this.#modals.clear();

            this.log(LogLevel.INFO, 'Creating new modals');
            // Initialize new modals
            document.querySelectorAll('.modal').forEach(el => {
                try {
                    const modal = new bootstrap.Modal(el, {
                        backdrop: 'static',
                        keyboard: false
                    });
                    this.#modals.set(el, modal);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                        method: 'initializeModals',
                        element: el
                    });
                }
            });

            this.#modalsInitialized = true;
            this.log(LogLevel.SUCCESS, 'Modals initialized', {
                count: this.#modals.size
            });
            
            // Check if all components are initialized
            this.#checkInitializationState();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initializeModals'
            });
            throw error;
        }
    }

    /**
     * Setup event listeners
     * @private
     */
    async #initializeEventListeners() {
        try {
            // Clear existing listeners
            this.#eventListeners.forEach((listener, element) => {
                element.removeEventListener(listener.event, listener.handler);
            });
            this.#eventListeners.clear();

            // Refresh button
            this.setupButtonListener('#refreshButton', 'click', this.handleRefreshClick.bind(this));

            // Store selector
            this.setupButtonListener('#storeSelector', 'change', this.handleStoreChange.bind(this));

            // Theme toggle
            this.setupButtonListener('#themeToggle', 'click', this.handleThemeToggle.bind(this));

            // Debug panel toggle
            this.setupButtonListener('#debugToggle', 'click', this.handleDebugToggle.bind(this));

            this.#listenersInitialized = true;
            this.log(LogLevel.SUCCESS, 'Event listeners initialized', {
                count: this.#eventListeners.size
            });
            
            // Check if all components are initialized
            this.#checkInitializationState();
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'setupEventListeners'
            });
            return false;
        }
    }

    /**
     * Setup a button event listener with error handling
     * @param {string} selector - Element selector
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @private
     */
    setupButtonListener(selector, event, handler) {
        const element = document.querySelector(selector);
        if (element) {
            const wrappedHandler = async (e) => {
                try {
                    await handler(e);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: 'eventHandler',
                        selector,
                        event
                    });
                }
            };
            element.addEventListener(event, wrappedHandler);
            this.#eventListeners.set(element, { event, handler: wrappedHandler });
        }
    }

    /**
     * Handle refresh button click
     * @param {Event} event - Click event
     * @returns {Promise<void>}
     */
    async handleRefreshClick(event) {
        try {
            const button = event.target;
            button.disabled = true;
            
            // Emit event for data refresh
            const refreshEvent = new CustomEvent('data:refresh', {
                detail: { timestamp: Date.now() }
            });
            window.dispatchEvent(refreshEvent);

            // Re-enable after delay
            setTimeout(() => {
                button.disabled = false;
            }, 1000);

            this.log(LogLevel.DEBUG, '🔄 Refresh triggered');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleRefreshClick'
            });
        }
    }

    /**
     * Handle store selector change
     * @param {Event} event - Change event
     * @returns {Promise<void>}
     */
    async handleStoreChange(event) {
        try {
            const select = event.target;
            const storeId = select.value;

            // Emit store change event
            const storeEvent = new CustomEvent('store:change', {
                detail: { storeId }
            });
            window.dispatchEvent(storeEvent);

            this.log(LogLevel.DEBUG, '🏪 Store changed', { storeId });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleStoreChange'
            });
        }
    }

    /**
     * Handle theme toggle click
     * @param {Event} event - Click event
     * @returns {Promise<void>}
     */
    async handleThemeToggle(event) {
        try {
            const button = event.target;
            const themeManager = ThemeManager.getInstance();
            const { theme: currentTheme } = themeManager.getThemeSettings();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            // Update theme using ThemeManager
            await themeManager.setTheme(newTheme, false);
            
            // Update button state
            button.setAttribute('aria-pressed', String(newTheme === 'dark'));
            button.classList.toggle('theme-dark', newTheme === 'dark');

            // Update theme switch if exists
            const themeSwitch = document.getElementById('theme-switch');
            if (themeSwitch) {
                themeSwitch.checked = newTheme === 'dark';
            }

            this.log(LogLevel.DEBUG, '🎨 Theme toggled', { theme: newTheme });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleThemeToggle'
            });
        }
    }

    /**
     * Handle debug panel toggle
     * @param {Event} event - Click event
     * @returns {Promise<void>}
     */
    async handleDebugToggle(event) {
        try {
            const button = event.target;
            const debugPanel = document.querySelector('#debugPanel');
            if (!debugPanel) return;

            const isVisible = debugPanel.classList.toggle('show');
            button.setAttribute('aria-expanded', String(isVisible));
            
            // Adjust window height
            await this.adjustWindowHeight();

            this.log(LogLevel.DEBUG, '🔧 Debug panel toggled', { isVisible });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'handleDebugToggle'
            });
        }
    }

    /**
     * Adjust window height based on content
     * @returns {Promise<void>}
     */
    async adjustWindowHeight() {
        try {
            const body = document.body;
            const html = document.documentElement;
            const height = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                html.clientHeight,
                html.scrollHeight,
                html.offsetHeight
            );

            // Add padding for better UX
            const newHeight = height + 50;

            // Update window size
            await this.resizeWindow(newHeight);

            this.log(LogLevel.DEBUG, '📐 Window height adjusted', { height: newHeight });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'adjustWindowHeight'
            });
        }
    }

    /**
     * Resize window to specified height
     * @param {number} height - New height in pixels
     * @returns {Promise<void>}
     */
    async resizeWindow(height) {
        try {
            if (chrome?.windows?.getCurrent) {
                const window = await chrome.windows.getCurrent();
                await chrome.windows.update(window.id, { height });
            } else {
                document.body.style.height = `${height}px`;
            }
        } catch (error) {
            document.body.style.height = `${height}px`;
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'resizeWindow',
                height
            });
        }
    }

    /**
     * Safely update a UI element
     * @param {string} selector - Element selector
     * @param {function(HTMLElement): void} updateFn - Update function
     */
    safeUpdateElement(selector, updateFn) {
        try {
            const element = document.querySelector(selector);
            if (element) {
                updateFn(element);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'safeUpdateElement',
                selector
            });
        }
    }

    /**
     * Safely update multiple UI elements
     * @param {string} selector - Elements selector
     * @param {function(HTMLElement, number): void} updateFn - Update function
     */
    safeUpdateElements(selector, updateFn) {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element, index) => {
                try {
                    updateFn(element, index);
                } catch (error) {
                    this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                        method: 'safeUpdateElements',
                        selector,
                        index
                    });
                }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'safeUpdateElements',
                selector
            });
        }
    }

    /**
     * Cleanup and dispose of the UI manager
     * @returns {Promise<void>}
     */
    async dispose() {
        try {
            // Clear event listeners
            this.#eventListeners.forEach((listener, element) => {
                element.removeEventListener(listener.event, listener.handler);
            });
            this.#eventListeners.clear();

            // Dispose tooltips and modals
            await super.dispose();
        } catch (error) {
            this.handleError(error, ErrorType.DISPOSAL, ErrorSeverity.HIGH, {
                method: 'dispose'
            });
        }
    }

    /**
     * Add a UI dependency
     * @protected
     * @param {UIManager} dependency
     */
    _addUIDependency(dependency) {
        this._uiDependencies.push(dependency);
    }

    /**
     * Show a message
     * @param {string} type - Message type
     * @param {string} message - Message content
     */
    showMessage(type, message) {
        // Emit message event instead of direct call
        const event = new CustomEvent('ui:message', {
            detail: { type, message }
        });
        window.dispatchEvent(event);
    }

    /**
     * Hide a message
     * @param {string} type - Message type
     */
    hideMessage(type) {
        // Emit hide message event
        const event = new CustomEvent('ui:hideMessage', {
            detail: { type }
        });
        window.dispatchEvent(event);
    }

    /**
     * Hide all messages
     */
    hideAllMessages() {
        // Emit hide all messages event
        window.dispatchEvent(new CustomEvent('ui:hideAllMessages'));
    }

    /**
     * Check if all UI components are initialized
     * @private
     */
    #checkInitializationState() {
        const allInitialized = this.#tooltipsInitialized && 
                              this.#modalsInitialized && 
                              this.#listenersInitialized;
                              
        if (allInitialized) {
            this.log(LogLevel.SUCCESS, '✨ All UI components initialized');
            // Emit UI ready event
            window.dispatchEvent(new CustomEvent('ui:ready'));
        }
    }

    /**
     * Check if manager is fully initialized
     * @returns {boolean}
     */
    isInitialized() {
        const baseInitialized = super.isInitialized();
        const componentsInitialized = this.#tooltipsInitialized &&
                                     this.#modalsInitialized &&
                                     this.#listenersInitialized;
                                     
        return baseInitialized && componentsInitialized;
    }
}

// Export singleton instance
export const uiManager = UIManager.getInstance(); 