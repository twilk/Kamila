import { stores } from '../stores.js';
import { BaseManager } from './BaseManager.js';
import { ErrorType, ErrorSeverity } from './ErrorTypes.js';
import { LogLevel } from './LogLevel.js';
import { EventType } from './EventType.js';
import { MenuManager } from './MenuManager.js';
import { EventManager } from './EventManager.js';
import { ThemeManager } from './ThemeManager.js';
import { LanguageManager } from './LanguageManager.js';
import { ErrorHandler } from './ErrorHandler.js';

// Import stałych z MenuManager
const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready'
};

const SELECTORS = {
    TAB: '.menu .link[data-bs-toggle="tab"]',
    TAB_PANE: '.tab-pane',
    ACTIVE_TAB: '.menu .link.active'
};

const INTERFACE_CONFIG = {
    TRANSITION_DURATION: 300,
    SAVE_DELAY: 1000,
    MAX_HISTORY: 50,
    UNDO_TIMEOUT: 5000
};

/**
 * Manages high-level UI interactions and state
 * @extends BaseManager
 */
class InterfaceManager extends BaseManager {
    /** @private */
    static #instance = null;
    static _registry = null;

    /** @private */
    #currentView = null;
    /** @private */
    #views = new Map();
    /** @private */
    #eventManager = null;
    /** @private */
    #settings = null;

    // Private method declarations
    #handleViewChange = null;
    #handleUIUpdate = null;
    #setupEventListeners = null;

    /** @private */
    #state = {
        currentView: null,
        previousView: null,
        navigationStack: [],
        viewStates: new Map(),
        undoStack: [],
        redoStack: [],
        lastSaved: null
    };
    
    /** @private */
    #saveTimeout = null;
    
    /** @private */
    #transitionPromise = null;

    constructor(registry) {
        if (InterfaceManager.#instance) {
            return InterfaceManager.#instance;
        }
        super(registry, 'InterfaceManager');
        InterfaceManager.#instance = this;
        InterfaceManager._registry = registry;

        // Add dependencies
        this.addDependency('event');
        this.addDependency('language');

        // Initialize private methods
        this.#handleViewChange = async (event) => {
            try {
                const { view } = event;
                await this.setView(view);
            } catch (error) {
                this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                    method: '#handleViewChange',
                    view: event?.view
                });
            }
        };

        this.#handleUIUpdate = async (event) => {
            try {
                const { elements } = event;
                await this.updateElements(elements);
            } catch (error) {
                this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                    method: '#handleUIUpdate',
                    elements: event?.elements
                });
            }
        };

        this.#setupEventListeners = async () => {
            try {
                const eventManager = await this.getDependency('event');
                
                // Listen for view change events
                await eventManager.on('interface:view-change', this.#handleViewChange.bind(this));
                
                // Listen for UI update events
                await eventManager.on('interface:update', this.#handleUIUpdate.bind(this));
                
                this.log(LogLevel.DEBUG, '🔄 Interface event listeners set up');
            } catch (error) {
                this.handleError(error, ErrorType.EVENT_LISTENER, ErrorSeverity.HIGH, {
                    method: '#setupEventListeners'
                });
                throw error;
            }
        };
    }

    static getInstance() {
        if (!InterfaceManager.#instance && InterfaceManager._registry) {
            InterfaceManager.#instance = new InterfaceManager(InterfaceManager._registry);
        }
        return InterfaceManager.#instance;
    }

    static setRegistry(registry) {
        InterfaceManager._registry = registry;
    }

    /**
     * Initialize interface manager
     * @returns {Promise<boolean>}
     */
    async _initialize() {
        try {
            this.log(LogLevel.INFO, '🔄 Initializing interface manager...');
            
            // Get dependencies
            const eventManager = await this.getDependency('event');
            
            // Set up event listeners
            await this.#setupEventListeners();

            // Initialize language switcher
            await this.initializeLanguageSwitcher();
            
            this.log(LogLevel.SUCCESS, '✅ Interface manager initialized');
            return true;
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
            return false;
        }
    }

    /**
     * Navigate to view
     * @param {string} viewId View ID
     * @param {Object} [params] Navigation parameters
     */
    async navigateTo(viewId, params = {}) {
        try {
            if (this.#transitionPromise) {
                await this.#transitionPromise;
            }

            const previousView = this.#state.currentView;
            
            this.#transitionPromise = (async () => {
                try {
                    // Hide current view
                    if (previousView) {
                        // Save view state
                        this.#state.viewStates.set(previousView, {
                            params: this.#state.navigationStack[this.#state.navigationStack.length - 1]?.params,
                            scrollPosition: window.scrollY
                        });
                        
                        await this.getDependency('ui').hide(previousView, {
                            duration: INTERFACE_CONFIG.TRANSITION_DURATION
                        });
                    }

                    // Update navigation stack
                    this.#state.navigationStack.push({ viewId, params });
                    this.#state.previousView = previousView;
                    this.#state.currentView = viewId;

                    // Show new view
                    await this.getDependency('ui').show(viewId, {
                        duration: INTERFACE_CONFIG.TRANSITION_DURATION
                    });

                    // Restore view state if exists
                    const viewState = this.#state.viewStates.get(viewId);
                    if (viewState) {
                        window.scrollTo(0, viewState.scrollPosition);
                    }

                    await this.getDependency('event').emit('interface:navigate', {
                        from: previousView,
                        to: viewId,
                        params
                    });

                    // Schedule state save
                    this.#scheduleSave();
                } finally {
                    this.#transitionPromise = null;
                }
            })();

            await this.#transitionPromise;
        } catch (error) {
            this.handleError(error, ErrorType.NAVIGATION, ErrorSeverity.MEDIUM, {
                operation: 'navigateTo',
                viewId
            });
            throw error;
        }
    }

    /**
     * Navigate back
     */
    async navigateBack() {
        try {
            if (this.#state.navigationStack.length <= 1) {
                throw new Error('Cannot navigate back: no previous view');
            }

            // Remove current view
            this.#state.navigationStack.pop();
            
            // Get previous view
            const previous = this.#state.navigationStack[this.#state.navigationStack.length - 1];
            
            // Navigate to previous view
            await this.navigateTo(previous.viewId, previous.params);
            
            await this.getDependency('event').emit('interface:back');
        } catch (error) {
            this.handleError(error, ErrorType.NAVIGATION, ErrorSeverity.MEDIUM, {
                operation: 'navigateBack'
            });
            throw error;
        }
    }

    /**
     * Record action for undo/redo
     * @param {Object} action Action to record
     */
    recordAction(action) {
        try {
            if (!action.undo || !action.redo) {
                throw new Error('Action must have undo and redo functions');
            }

            // Clear redo stack when new action is recorded
            this.#state.redoStack = [];
            
            // Add to undo stack
            this.#state.undoStack.push(action);
            
            // Trim stack if too large
            if (this.#state.undoStack.length > INTERFACE_CONFIG.MAX_HISTORY) {
                this.#state.undoStack.shift();
            }
            
            // Schedule state save
            this.#scheduleSave();
            
            this.getDependency('event').emit('interface:action', { action });
        } catch (error) {
            this.handleError(error, ErrorType.ACTION, ErrorSeverity.LOW, {
                operation: 'recordAction'
            });
            throw error;
        }
    }

    /**
     * Undo last action
     */
    async undo() {
        try {
            if (this.#state.undoStack.length === 0) {
                throw new Error('Nothing to undo');
            }

            const action = this.#state.undoStack.pop();
            
            try {
                await action.undo();
                this.#state.redoStack.push(action);
                
                await this.getDependency('event').emit('interface:undo', { action });
            } catch (error) {
                // Restore action to undo stack if failed
                this.#state.undoStack.push(action);
                throw error;
            }
            
            // Schedule state save
            this.#scheduleSave();
        } catch (error) {
            this.handleError(error, ErrorType.ACTION, ErrorSeverity.LOW, {
                operation: 'undo'
            });
            throw error;
        }
    }

    /**
     * Redo last undone action
     */
    async redo() {
        try {
            if (this.#state.redoStack.length === 0) {
                throw new Error('Nothing to redo');
            }

            const action = this.#state.redoStack.pop();
            
            try {
                await action.redo();
                this.#state.undoStack.push(action);
                
                await this.getDependency('event').emit('interface:redo', { action });
            } catch (error) {
                // Restore action to redo stack if failed
                this.#state.redoStack.push(action);
                throw error;
            }
            
            // Schedule state save
            this.#scheduleSave();
        } catch (error) {
            this.handleError(error, ErrorType.ACTION, ErrorSeverity.LOW, {
                operation: 'redo'
            });
            throw error;
        }
    }

    /**
     * Show loading overlay
     * @param {string} message Loading message
     */
    async showLoading(message) {
        try {
            await this.getDependency('ui').show('loading-overlay', {
                data: { message }
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'showLoading'
            });
            throw error;
        }
    }

    /**
     * Hide loading overlay
     */
    async hideLoading() {
        try {
            await this.getDependency('ui').hide('loading-overlay');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'hideLoading'
            });
            throw error;
        }
    }

    /**
     * Show confirmation dialog
     * @param {Object} options Dialog options
     * @returns {Promise<boolean>} User confirmation
     */
    async confirm(options) {
        try {
            const {
                title,
                message,
                confirmText = 'OK',
                cancelText = 'Cancel',
                type = 'info'
            } = options;

            return new Promise(resolve => {
                this.getDependency('ui').showModal('confirm-dialog', {
                    data: {
                        title,
                        message,
                        confirmText,
                        cancelText,
                        type,
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false)
                    }
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                operation: 'confirm'
            });
            throw error;
        }
    }

    /**
     * Load interface state
     * @private
     */
    async #loadState() {
        try {
            const storageManager = await this.getDependency('storage');
            const saved = await storageManager.get('interface_state');
            
            if (saved) {
                this.#state = {
                    ...this.#state,
                    ...saved,
                    lastSaved: new Date(saved.lastSaved)
                };
                
                // Restore current view if any
                if (this.#state.currentView) {
                    await this.navigateTo(
                        this.#state.currentView,
                        this.#state.navigationStack[this.#state.navigationStack.length - 1]?.params
                    );
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                operation: 'loadState'
            });
        }
    }

    /**
     * Save interface state
     * @private
     */
    async #saveState() {
        try {
            const storageManager = await this.getDependency('storage');
            
            this.#state.lastSaved = new Date();
            
            await storageManager.set('interface_state', {
                currentView: this.#state.currentView,
                previousView: this.#state.previousView,
                navigationStack: this.#state.navigationStack,
                viewStates: Array.from(this.#state.viewStates.entries()),
                lastSaved: this.#state.lastSaved
            });
            
            await this.getDependency('event').emit('interface:saved', {
                timestamp: this.#state.lastSaved
            });
        } catch (error) {
            this.handleError(error, ErrorType.STORAGE, ErrorSeverity.MEDIUM, {
                operation: 'saveState'
            });
        }
    }

    /**
     * Schedule state save
     * @private
     */
    #scheduleSave() {
        if (this.#saveTimeout) {
            clearTimeout(this.#saveTimeout);
        }
        
        this.#saveTimeout = setTimeout(
            () => this.#saveState(),
            INTERFACE_CONFIG.SAVE_DELAY
        );
    }

    /**
     * Get interface manager stats
     */
    getStats() {
        return {
            currentView: this.#state.currentView,
            navigationStackSize: this.#state.navigationStack.length,
            undoStackSize: this.#state.undoStack.length,
            redoStackSize: this.#state.redoStack.length,
            viewStatesCount: this.#state.viewStates.size,
            lastSaved: this.#state.lastSaved
        };
    }

    /**
     * Dispose interface manager
     */
    async dispose() {
        // Save final state
        await this.#saveState();
        
        if (this.#saveTimeout) {
            clearTimeout(this.#saveTimeout);
            this.#saveTimeout = null;
        }

        this.#state = {
            currentView: null,
            previousView: null,
            navigationStack: [],
            viewStates: new Map(),
            undoStack: [],
            redoStack: [],
            lastSaved: null
        };

        await super.dispose();
    }

    /**
     * Initialize language switcher
     */
    async initializeLanguageSwitcher() {
        try {
            const languageButtons = document.querySelectorAll('.lang-btn');
            const languageManager = await this.getDependency('language');
            const currentLang = languageManager.getCurrentLanguage();

            languageButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.lang === currentLang) {
                    btn.classList.add('active');
                }

                btn.addEventListener('click', async () => {
                    const lang = btn.dataset.lang;
                    languageButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    try {
                        await languageManager.setLanguage(lang);
                        this.log(LogLevel.INFO, `🌍 Language changed to: ${lang}`);
                    } catch (error) {
                        this.handleError(error, ErrorType.LANGUAGE, ErrorSeverity.MEDIUM, {
                            method: 'initializeLanguageSwitcher',
                            language: lang
                        });
                    }
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeLanguageSwitcher'
            });
        }
    }
}

// Export both class and instance
export { InterfaceManager };
export const interfaceManager = InterfaceManager.getInstance();