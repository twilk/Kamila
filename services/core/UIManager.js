import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { BaseManager } from './BaseManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';

/**
 * @extends {BaseManager}
 * Base class for UI-related managers
 */
export class UIManager extends BaseManager {
    static _instance = null;
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
        if (UIManager._instance) {
            throw new Error('Use UIManager.getInstance()');
        }
        super('UIManager');
        UIManager._instance = this;
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
        if (!UIManager._instance) {
            UIManager._instance = new UIManager();
        }
        return UIManager._instance;
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
     * Initialize UI manager and its dependencies
     * @returns {Promise<boolean>}
     */
    async initialize() {
        try {
            this.log(LogLevel.INFO, 'Starting UI manager initialization');

            // Ensure error handler is initialized
            this.#errorHandler = ErrorHandler.getInstance();
            
            // Initialize base and dependencies
            await super.initialize();

            // Initialize UI components
            await this.#initializeComponents();

            this.log(LogLevel.SUCCESS, 'UI manager initialized', {
                tooltipsCount: this.#tooltips.size,
                modalsCount: this.#modals.size,
                listenersCount: this.#eventListeners.size
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initialize'
            });
            return false;
        }
    }

    /**
     * Initialize all UI components
     * @private
     */
    async #initializeComponents() {
        try {
            // Initialize tooltips
            this.log(LogLevel.INFO, 'Initializing tooltips');
            await this.#initializeTooltips();
            this.#tooltipsInitialized = true;

            // Initialize modals
            this.log(LogLevel.INFO, 'Initializing modals');
            await this.#initializeModals();
            this.#modalsInitialized = true;

            // Setup event listeners
            this.log(LogLevel.INFO, 'Setting up event listeners');
            await this.#setupEventListeners();
            this.#listenersInitialized = true;

            // Set initialized state if all components are ready
            this.#checkInitializationState();
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: 'initializeComponents'
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
            this.log(LogLevel.DEBUG, 'Checking Bootstrap availability');
            if (typeof bootstrap === 'undefined') {
                throw new Error('Bootstrap is not loaded');
            }

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
            this.log(LogLevel.DEBUG, 'Checking Bootstrap availability');
            if (typeof bootstrap === 'undefined') {
                throw new Error('Bootstrap is not loaded');
            }

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

            this.log(LogLevel.SUCCESS, 'Modals initialized', {
                count: this.#modals.size
            });
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
    async #setupEventListeners() {
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

            this.log(LogLevel.SUCCESS, 'Event listeners initialized', {
                count: this.#eventListeners.size
            });
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
            const isDark = document.body.classList.toggle('dark-theme');
            
            // Update button state
            button.setAttribute('aria-pressed', String(isDark));
            
            // Save preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');

            this.log(LogLevel.DEBUG, '🎨 Theme toggled', { isDark });
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
     * Adjust window height based on debug panel
     */
    adjustWindowHeight() {
        this.safeUpdateElement('.debug-panel', debugPanel => {
            if (document.body.classList.contains('debug-enabled')) {
                const debugPanelHeight = debugPanel.offsetHeight;
                document.body.style.height = `calc(var(--window-height) + ${debugPanelHeight/2}px)`;
            } else {
                document.body.style.height = 'var(--window-height)';
            }
        });
    }

    /**
     * Check if all UI components are initialized
     * @private
     */
    #checkInitializationState() {
        const allInitialized = this.#tooltipsInitialized && 
                              this.#modalsInitialized && 
                              this.#listenersInitialized;
                              
        if (allInitialized && !this.isInitialized()) {
            this._setInitialized(true);
            this.log(LogLevel.SUCCESS, '✨ All UI components initialized');
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