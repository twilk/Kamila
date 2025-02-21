import { BaseManager } from './BaseManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LogLevel } from './LogLevel.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { ThemeManager } from './ThemeManager.js';
import { EventManager } from './EventManager.js';

/**
 * @extends {BaseManager}
 * Base class for UI-related managers
 */
class UIManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #settings;
    #uiDependencies = [];
    
    /** @private */
    #components = new Map();
    
    /** @private */
    #toasts = new Map();
    
    /** @private */
    #modals = new Map();
    
    /** @private */
    #loadingElements = new Map();
    
    /** @private */
    #messageQueue = [];
    
    /** @private */
    #isProcessingQueue = false;
    
    /** @private */
    #messageTimeout = null;
    
    /** @private */
    #resizeObserver = null;
    
    /** @private */
    #mutationObserver = null;

    /** @private */
    #tooltips = new Map();
    #tooltipsInitialized = false;
    #modalsInitialized = false;
    #listenersInitialized = false;
    #errorHandler = null;
    
    /** @private */
    #eventListeners = new Map();
    
    /** @private */
    #animationFrame = null;
    
    /** @private */
    #modalStack = [];
    
    /** @private */
    #eventHandlers = new Map();

    /** @private */
    #eventManager = null;
    /** @private */
    #themeManager = null;
    /** @private */
    #storeManager = null;
    /** @private */
    #refreshManager = null;

    /**
     * @param {Array<IInitializable>} [coreDependencies=[]] - Core service dependencies
     * @param {Array<UIManager>} [uiDependencies=[]] - UI manager dependencies
     */
    constructor(registry) {
        if (UIManager.#instance) {
            return UIManager.#instance;
        }
        super(registry, 'UIManager');
        UIManager.#instance = this;
        UIManager._registry = registry;
        
        // Add dependencies
        this.addDependency('error');
        this.addDependency('event');
        this.addDependency('theme');
        this.addDependency('store');
        this.addDependency('refresh');
    }

    /**
     * Get singleton instance
     * @returns {UIManager}
     */
    static getInstance() {
        if (!UIManager.#instance && UIManager._registry) {
            UIManager.#instance = new UIManager(UIManager._registry);
        }
        return UIManager.#instance;
    }

    static setRegistry(registry) {
        UIManager._registry = registry;
    }

    /**
     * Handle UI-related errors
     * @override
     */
    async handleError(error, type = ErrorType.UI, severity = ErrorSeverity.HIGH, context = {}) {
        try {
            // Log error to console as backup
            console.error('[UIManager] Error:', error, context);

            // Get error handler
            const errorHandler = await this.getDependency('error');

            // Call error handler with proper context
            await errorHandler.handle(error, type, severity, {
                ...context,
                manager: 'UIManager',
                component: context.component || 'unknown'
            });

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
     * Initialize UI manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing UI manager...');
            
            // Get required dependencies
            const [eventManager, themeManager, storeManager, refreshManager] = await Promise.all([
                this.getDependency('event'),
                this.getDependency('theme'),
                this.getDependency('store'),
                this.getDependency('refresh')
            ]);

            // Store dependencies as instance variables
            this.#eventManager = eventManager;
            this.#themeManager = themeManager;
            this.#storeManager = storeManager;
            this.#refreshManager = refreshManager;

            // Validate required dependencies
            if (!this.#eventManager?.isInitialized()) {
                throw new Error('EventManager must be initialized');
            }
            if (!this.#themeManager?.isInitialized()) {
                throw new Error('ThemeManager must be initialized');
            }
            if (!this.#storeManager?.isInitialized()) {
                throw new Error('StoreManager must be initialized');
            }
            if (!this.#refreshManager?.isInitialized()) {
                throw new Error('RefreshManager must be initialized');
            }

            // Initialize UI components
            await this.initializeUI();
            await this.#initializeEventListeners();

            // Mark as initialized
            this.#tooltipsInitialized = true;
            this.#modalsInitialized = true;
            this.#listenersInitialized = true;

            this.log(LogLevel.SUCCESS, '✅ UI manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
                method: '_initialize'
            });
            return false;
        }
    }

    /**
     * Initialize UI elements
     * @private
     */
    async initializeUI() {
        try {
            // Initialize UI elements
            const elements = document.querySelectorAll('[data-ui-element]');
            
            for (const element of elements) {
                const type = element.getAttribute('data-ui-element');
                switch (type) {
                    case 'counter':
                        await this.initializeCounter(element);
                        break;
                    case 'progress':
                        await this.initializeProgress(element);
                        break;
                    case 'status':
                        await this.initializeStatus(element);
                        break;
                    default:
                        this.log(LogLevel.WARNING, `⚠️ Unknown UI element type: ${type}`);
                }
            }
            
            this.log(LogLevel.DEBUG, '🔄 UI elements initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'initializeUI'
            });
            throw error;
        }
    }

    /**
     * Initialize counter element
     * @private
     */
    async initializeCounter(element) {
        try {
            const id = element.getAttribute('data-counter-id');
            if (!id) {
                throw new Error('Counter ID not specified');
            }
            
            // Set initial value
            const value = await this.#storeManager.getValue(id) || 0;
            element.textContent = value;
            
            // Subscribe to updates
            await this.#eventManager.on(`counter:${id}:update`, async (event) => {
                const { value } = event;
                element.textContent = value;
            });
            
            this.log(LogLevel.DEBUG, '🔄 Counter initialized', { id });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'initializeCounter',
                element
            });
        }
    }

    /**
     * Initialize progress element
     * @private
     */
    async initializeProgress(element) {
        try {
            const id = element.getAttribute('data-progress-id');
            if (!id) {
                throw new Error('Progress ID not specified');
            }
            
            // Set initial value
            const value = await this.#storeManager.getValue(id) || 0;
            element.style.width = `${value}%`;
            element.setAttribute('aria-valuenow', value);
            
            // Subscribe to updates
            await this.#eventManager.on(`progress:${id}:update`, async (event) => {
                const { value } = event;
                element.style.width = `${value}%`;
                element.setAttribute('aria-valuenow', value);
            });
            
            this.log(LogLevel.DEBUG, '🔄 Progress initialized', { id });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'initializeProgress',
                element
            });
        }
    }

    /**
     * Initialize status element
     * @private
     */
    async initializeStatus(element) {
        try {
            const id = element.getAttribute('data-status-id');
            if (!id) {
                throw new Error('Status ID not specified');
            }
            
            // Set initial value
            const value = await this.#storeManager.getValue(id) || 'unknown';
            element.textContent = value;
            
            // Subscribe to updates
            await this.#eventManager.on(`status:${id}:update`, async (event) => {
                const { value } = event;
                element.textContent = value;
            });
            
            this.log(LogLevel.DEBUG, '🔄 Status initialized', { id });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'initializeStatus',
                element
            });
        }
    }

    /**
     * Update UI elements
     * @param {Array} elements Elements to update
     */
    async updateElements(elements) {
        try {
            for (const element of elements) {
                const { id, type, value } = element;
                const target = document.querySelector(`[data-${type}-id="${id}"]`);
                
                if (!target) {
                    this.log(LogLevel.WARNING, `⚠️ Element not found: ${id}`);
                    continue;
                }
                
                switch (type) {
                    case 'counter':
                        target.textContent = value;
                        break;
                    case 'progress':
                        target.style.width = `${value}%`;
                        target.setAttribute('aria-valuenow', value);
                        break;
                    case 'status':
                        target.textContent = value;
                        break;
                    default:
                        this.log(LogLevel.WARNING, `⚠️ Unknown element type: ${type}`);
                }
            }
            
            this.log(LogLevel.DEBUG, '🔄 Elements updated', { count: elements.length });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'updateElements',
                elements
            });
            throw error;
        }
    }

    /**
     * Refresh UI
     */
    async refreshUI() {
        try {
            // Re-initialize all UI elements
            await this.initializeUI();
            
            // Emit refresh event
            await this.#eventManager.emit('ui:refreshed');
            
            this.log(LogLevel.DEBUG, '🔄 UI refreshed');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'refreshUI'
            });
            throw error;
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
            this.#tooltips.clear();

            this.log(LogLevel.INFO, 'Creating new tooltips');
            // Initialize new tooltips
            document.querySelectorAll('[data-tooltip]').forEach(el => {
                try {
                    const tooltip = {
                        element: el,
                        content: el.getAttribute('data-tooltip'),
                        show: () => {
                            const tip = document.createElement('div');
                            tip.className = 'tooltip';
                            tip.textContent = tooltip.content;
                            document.body.appendChild(tip);
                            
                            const rect = el.getBoundingClientRect();
                            tip.style.top = `${rect.bottom + 5}px`;
                            tip.style.left = `${rect.left + (rect.width / 2) - (tip.offsetWidth / 2)}px`;
                            
                            tooltip.tip = tip;
                        },
                        hide: () => {
                            tooltip.tip?.remove();
                            tooltip.tip = null;
                        }
                    };
                    
                    el.addEventListener('mouseenter', () => tooltip.show());
                    el.addEventListener('mouseleave', () => tooltip.hide());
                    
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
            this.#modals.clear();

            this.log(LogLevel.INFO, 'Creating new modals');
            // Initialize new modals
            document.querySelectorAll('.modal').forEach(el => {
                try {
                    const modal = {
                        element: el,
                        isOpen: false,
                        show: () => {
                            el.style.display = 'block';
                            el.classList.add('show');
                            this.#modalStack.push(el);
                        },
                        hide: () => {
                            el.style.display = 'none';
                            el.classList.remove('show');
                            const index = this.#modalStack.indexOf(el);
                            if (index > -1) {
                                this.#modalStack.splice(index, 1);
                            }
                        }
                    };
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
            const eventManager = EventManager.getInstance();
            eventManager.emit('data:refresh', {
                timestamp: new Date().toISOString()
            });

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
            const eventManager = EventManager.getInstance();
            eventManager.emit('store:change', {
                storeId,
                timestamp: new Date().toISOString()
            });

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
        try {
            const eventManager = EventManager.getInstance();
            eventManager.emit('ui:message', {
                type,
                message,
                timestamp: new Date().toISOString()
            });
            this.log(LogLevel.DEBUG, `💬 Message shown: ${type}`);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Hide a message
     * @param {string} messageId - Message ID
     */
    hideMessage(messageId) {
        try {
            const eventManager = EventManager.getInstance();
            eventManager.emit('ui:hideMessage', {
                messageId,
                timestamp: new Date().toISOString()
            });
            this.log(LogLevel.DEBUG, `🚫 Message hidden: ${messageId}`);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Hide all messages
     */
    hideAllMessages() {
        try {
            const eventManager = EventManager.getInstance();
            eventManager.emit('ui:hideAllMessages', {
                timestamp: new Date().toISOString()
            });
            this.log(LogLevel.DEBUG, '🧹 All messages hidden');
        } catch (error) {
            this.handleError(error);
        }
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
            this.ready();
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

    /**
     * Emit UI ready event
     */
    ready() {
        try {
            const eventManager = EventManager.getInstance();
            eventManager.emit('ui:ready', {
                timestamp: new Date().toISOString()
            });
            this.log(LogLevel.SUCCESS, '✅ UI ready');
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Register UI component
     * @param {string} id Component ID
     * @param {HTMLElement} element Component element
     * @param {Object} [options] Component options
     */
    registerComponent(id, element, options = {}) {
        try {
            if (!id || !element) {
                throw new Error('Component ID and element are required');
            }

            const component = {
                id,
                element,
                options,
                state: {
                    visible: element.style.display !== 'none',
                    enabled: !element.disabled,
                    loading: false
                }
            };

            this.#components.set(id, component);
            
            // Add to resize observer if needed
            if (options.observeResize) {
                this.#resizeObserver?.observe(element);
            }
            
            this.log(LogLevel.DEBUG, `📝 Registered component: ${id}`);
            
            return component;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                operation: 'registerComponent',
                id
            });
            throw error;
        }
    }

    /**
     * Show component
     * @param {string} id Component ID
     * @param {Object} [options] Show options
     */
    async show(id, options = {}) {
        try {
            const eventManager = await this.getDependency('event');
            const element = this.#components.get(id);
            
            if (!element) {
                throw new Error(`Component ${id} not found`);
            }
            
            element.style.display = options.display || 'block';
            
            if (options.animate) {
                await this.#animateShow(element, options.animation);
            }
            
            await eventManager.emit('ui:show', {
                id,
                options,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
            return false;
        }
    }

    /**
     * Hide component
     * @param {string} id Component ID
     * @param {Object} [options] Hide options
     */
    async hide(id, options = {}) {
        try {
            const eventManager = await this.getDependency('event');
            const element = this.#components.get(id);
            
            if (!element) {
                throw new Error(`Component ${id} not found`);
            }
            
            if (options.animate) {
                await this.#animateHide(element, options.animation);
            }
            
            element.style.display = 'none';
            
            await eventManager.emit('ui:hide', {
                id,
                options,
                timestamp: Date.now()
            });
            
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
            return false;
        }
    }

    /**
     * Show modal
     * @param {string} id Modal ID
     * @param {Object} [options] Modal options
     */
    async showModal(id, options = {}) {
        try {
            const modal = this.#modals.get(document.getElementById(id));
            if (!modal) {
                throw new Error(`Modal not found: ${id}`);
            }

            // Add overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);

            // Show modal
            modal.show();
            
            await this.#eventManager.emit('ui:modal:show', { 
                modalId: id 
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                operation: 'showModal',
                id
            });
            throw error;
        }
    }

    /**
     * Hide modal
     * @param {string} id Modal ID
     */
    async hideModal(id) {
        try {
            const modal = this.#modals.get(document.getElementById(id));
            if (!modal) return;

            // Hide modal
            modal.hide();

            // Remove overlay if no more modals
            if (this.#modalStack.length === 0) {
                document.querySelector('.modal-overlay')?.remove();
            }
            
            await this.#eventManager.emit('ui:modal:hide', { 
                modalId: id 
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                operation: 'hideModal',
                id
            });
            throw error;
        }
    }

    /**
     * Show toast notification
     * @param {string} message Toast message
     * @param {Object} [options] Toast options
     */
    async showToast(message, options = {}) {
        try {
            const {
                type = 'info',
                duration = UI_CONFIG.TOAST_DURATION,
                position = 'bottom-right'
            } = options;

            // Remove old toasts if too many
            while (this.#toasts.length >= UI_CONFIG.MAX_TOASTS) {
                const oldToast = this.#toasts.shift();
                await this.hide(oldToast.id);
            }

            // Create toast element
            const id = `toast-${Date.now()}`;
            const toast = document.createElement('div');
            toast.className = `toast toast-${type} toast-${position}`;
            toast.textContent = message;

            // Register toast
            this.registerComponent(id, toast);
            document.body.appendChild(toast);

            // Show toast
            await this.show(id, { animate: true });

            // Add to toasts array
            this.#toasts.push({ id, timer: null });

            // Set auto-hide timer
            const timer = setTimeout(async () => {
                await this.hideToast(id);
            }, duration);

            // Update timer reference
            const toastData = this.#toasts.find(t => t.id === id);
            if (toastData) {
                toastData.timer = timer;
            }
            
            await managers.eventManager.emit('ui:toast:show', {
                id,
                message,
                type
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'showToast',
                message
            });
            throw error;
        }
    }

    /**
     * Hide toast notification
     * @param {string} id Toast ID
     */
    async hideToast(id) {
        try {
            const index = this.#toasts.findIndex(t => t.id === id);
            if (index === -1) return;

            const toast = this.#toasts[index];
            
            // Clear timer if exists
            if (toast.timer) {
                clearTimeout(toast.timer);
            }

            // Hide and remove toast
            await this.hide(id, { animate: true });
            const component = this.#components.get(id);
            if (component) {
                component.element.remove();
                this.#components.delete(id);
            }

            // Remove from toasts array
            this.#toasts.splice(index, 1);
            
            await managers.eventManager.emit('ui:toast:hide', { id });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'hideToast',
                id
            });
            throw error;
        }
    }

    /**
     * Set component loading state
     * @param {string} id Component ID
     * @param {boolean} loading Loading state
     */
    async setLoading(id, loading) {
        try {
            const component = this.#components.get(id);
            if (!component) {
                throw new Error(`Component not found: ${id}`);
            }

            component.state.loading = loading;
            component.element.classList.toggle('loading', loading);
            
            if (loading) {
                component.element.setAttribute('aria-busy', 'true');
            } else {
                component.element.removeAttribute('aria-busy');
            }
            
            await managers.eventManager.emit('ui:loading', {
                componentId: id,
                loading
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'setLoading',
                id,
                loading
            });
            throw error;
        }
    }

    /**
     * Set component enabled state
     * @param {string} id Component ID
     * @param {boolean} enabled Enabled state
     */
    async setEnabled(id, enabled) {
        try {
            const component = this.#components.get(id);
            if (!component) {
                throw new Error(`Component not found: ${id}`);
            }

            component.state.enabled = enabled;
            component.element.disabled = !enabled;
            component.element.classList.toggle('disabled', !enabled);
            
            if (!enabled) {
                component.element.setAttribute('aria-disabled', 'true');
            } else {
                component.element.removeAttribute('aria-disabled');
            }
            
            await managers.eventManager.emit('ui:enabled', {
                componentId: id,
                enabled
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'setEnabled',
                id,
                enabled
            });
            throw error;
        }
    }

    /**
     * Setup resize observer
     * @private
     */
    #setupResizeObserver() {
        if (!window.ResizeObserver) return;

        this.#resizeObserver = new ResizeObserver(
            this.#debounce(entries => {
                for (const entry of entries) {
                    const component = Array.from(this.#components.values())
                        .find(c => c.element === entry.target);
                    
                    if (component) {
                        managers.eventManager.emit('ui:resize', {
                            componentId: component.id,
                            contentRect: entry.contentRect
                        });
                    }
                }
            }, UI_CONFIG.DEBOUNCE_DELAY)
        );
    }

    /**
     * Setup event handlers
     * @private
     */
    #setupEventHandlers() {
        // Handle escape key for modals
        this.#eventHandlers.set('keydown', event => {
            if (event.key === 'Escape' && this.#modalStack.length > 0) {
                const topModalId = this.#modalStack[this.#modalStack.length - 1];
                this.hideModal(topModalId);
            }
        });

        // Add event listeners
        for (const [event, handler] of this.#eventHandlers) {
            document.addEventListener(event, handler);
        }
    }

    /**
     * @private
     */
    async #animateShow(element, animation = {}) {
        const { duration = UI_CONFIG.ANIMATION_DURATION } = animation;
        element.style.opacity = '0';
        
        await this.#animate(() => {
            element.style.opacity = '1';
        }, duration);
    }

    /**
     * @private
     */
    async #animateHide(element, animation = {}) {
        const { duration = UI_CONFIG.ANIMATION_DURATION } = animation;
        
        await this.#animate(() => {
            element.style.opacity = '0';
        }, duration);
    }

    /**
     * @private
     */
    #animate(callback, duration) {
        return new Promise(resolve => {
            const startTime = performance.now();
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                callback(progress);
                
                if (progress < 1) {
                    this.#animationFrame = requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            this.#animationFrame = requestAnimationFrame(animate);
        });
    }

    /**
     * Debounce function
     * @private
     */
    #debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    /**
     * Get UI manager stats
     */
    getStats() {
        return {
            components: this.#components.size,
            modals: this.#modalStack.length,
            toasts: this.#toasts.length,
            eventHandlers: this.#eventHandlers.size
        };
    }
}

// Export both class and instance
export { UIManager };
export const uiManager = UIManager.getInstance(); 
