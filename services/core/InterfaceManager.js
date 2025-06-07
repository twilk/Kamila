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
        this.addDependency('store');
        this.addDependency('theme');
        this.addDependency('status');

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

            // Initialize UI components
            await this.initializeStoreSelect();
            await this.initializeTabs();
            await this.initializeLanguageSwitcher();
            await this.initializeThemeSwitcher();
            await this.initializeStatusButtons();
            await this.initializeLeadStatusLinks();
            
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
     * Show loading state
     * @param {string} message Loading message
     */
    async showLoading(message) {
        try {
            const loadingElement = document.querySelector('.loading-container');
            if (loadingElement) {
                const messageElement = loadingElement.querySelector('.initialization-text');
                if (messageElement && message) {
                    messageElement.textContent = message;
                }
                loadingElement.classList.remove('d-none');
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
        }
    }

    /**
     * Hide loading state
     */
    async hideLoading() {
        try {
            const loadingElement = document.querySelector('.loading-container');
            if (loadingElement) {
                loadingElement.classList.add('d-none');
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW);
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

    /**
     * Initialize store selector
     */
    async initializeStoreSelect() {
        try {
            const storeSelect = document.getElementById('store-select');
            if (!storeSelect) return;

            const storeManager = await this.getDependency('store');
            const currentStore = await storeManager.getActiveStore();

            storeSelect.value = currentStore?.id || 'ALL';
            storeSelect.addEventListener('change', async (e) => {
                const store = e.target.value;
                await storeManager.setActiveStore(store);
                this.log(LogLevel.INFO, `🏪 Store changed to: ${store}`);
            });
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeStoreSelect'
            });
        }
    }

    /**
     * Initialize tabs
     * @returns {Promise<void>}
     */
    async initializeTabs() {
        try {
            const eventManager = await this.getDependency('event');
            const tabButtons = document.querySelectorAll('.link[data-target]');
            const tabPanes = document.querySelectorAll('.tab-pane');

            // Initialize tab click handlers
            tabButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    const targetId = button.getAttribute('data-target');
                    
                    // Remove active class from all buttons and panes
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabPanes.forEach(pane => {
                        pane.classList.remove('show', 'active');
                        // Add fade out
                        pane.style.opacity = '0';
                    });
                    
                    // Add active class to clicked button and its target pane
                    button.classList.add('active');
                    const targetPane = document.querySelector(targetId);
                    if (targetPane) {
                        targetPane.classList.add('show', 'active');
                        // Add fade in
                        setTimeout(() => {
                            targetPane.style.opacity = '1';
                        }, 50);
                    }

                    // Handle specific tab content loading
                    switch (targetId) {
                        case '#status':
                            await this.loadStatusContent();
                            break;
                        case '#drwn':
                            await this.loadDrwnContent();
                            break;
                        case '#ranking':
                            await this.loadRankingContent();
                            break;
                        case '#packing':
                            await this.loadPackingContent();
                            break;
                    }

                    // Emit tab change event
                    await eventManager.emit(EVENTS.TAB_CHANGED, {
                        tab: targetId.substring(1),
                        element: targetPane
                    });
                });
            });

            // Set initial active tab
            const activeTab = document.querySelector('.link.active[data-target]');
            if (activeTab) {
                const targetId = activeTab.getAttribute('data-target');
                const targetPane = document.querySelector(targetId);
                if (targetPane) {
                    targetPane.classList.add('show', 'active');
                    targetPane.style.opacity = '1';
                    
                    // Load initial content
                    switch (targetId) {
                        case '#status':
                            await this.loadStatusContent();
                            break;
                        case '#drwn':
                            await this.loadDrwnContent();
                            break;
                        case '#ranking':
                            await this.loadRankingContent();
                            break;
                        case '#packing':
                            await this.loadPackingContent();
                            break;
                    }
                }
            }

            // Add CSS for transitions
            const style = document.createElement('style');
            style.textContent = `
                .tab-pane {
                    transition: opacity 0.3s ease-in-out;
                    opacity: 0;
                }
                .tab-pane.show.active {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);

            this.log(LogLevel.SUCCESS, '✅ Tabs initialized');
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
                method: 'initializeTabs'
            });
        }
    }

    /**
     * Load status tab content
     * @private
     */
    async loadStatusContent() {
        try {
            const statusManager = await this.getDependency('status');
            await statusManager.updateStatus();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'loadStatusContent'
            });
        }
    }

    /**
     * Load DRWN tab content
     * @private
     */
    async loadDrwnContent() {
        try {
            const dataManager = await this.getDependency('data');
            await dataManager.updateDrwnData();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'loadDrwnContent'
            });
        }
    }

    /**
     * Load ranking tab content
     * @private
     */
    async loadRankingContent() {
        try {
            const dataManager = await this.getDependency('data');
            await dataManager.updateRankingData();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'loadRankingContent'
            });
        }
    }

    /**
     * Load packing tab content
     * @private
     */
    async loadPackingContent() {
        try {
            const packingContainer = document.getElementById('packing-container');
            if (packingContainer) {
                const packingComponent = new PackingRequests();
                await packingComponent.mount(packingContainer);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.LOW, {
                method: 'loadPackingContent'
            });
        }
    }

    /**
     * Initialize theme switcher
     */
    async initializeThemeSwitcher() {
        try {
            const themeSwitch = document.getElementById('theme-switch');
            if (!themeSwitch) return;

            const themeManager = await this.getDependency('theme');
            const { theme } = themeManager.getThemeSettings();

            themeSwitch.checked = theme === 'dark';
            themeSwitch.addEventListener('change', async () => {
                const newTheme = themeSwitch.checked ? 'dark' : 'light';
                await themeManager.setTheme(newTheme);
                this.log(LogLevel.INFO, `🎨 Theme changed to: ${newTheme}`);
            });
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeThemeSwitcher'
            });
        }
    }

    /**
     * Initialize status buttons
     */
    async initializeStatusButtons() {
        try {
            const statusButtons = document.querySelectorAll('[data-status]');
            const statusManager = await this.getDependency('status');
            const storeManager = await this.getDependency('store');

            statusButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const status = button.dataset.status;
                        
                        // Get current store
                        const store = await storeManager.getActiveStore();
                        const storeId = store?.id === 'ALL' ? '0' : store?.deliveryId?.toString() || '0';
                        
                        // Generate and open DARWINA URL
                        const url = this.generateDarwinaUrl(status, storeId);
                        window.open(url, '_blank');
                        
                        this.log(LogLevel.INFO, `🔗 Opening DARWINA for status: ${status}`);
                    } catch (error) {
                        this.handleError(error, ErrorType.NAVIGATION, ErrorSeverity.MEDIUM, {
                            method: 'initializeStatusButtons',
                            status: button.dataset.status
                        });
                    }
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeStatusButtons'
            });
        }
    }

    /**
     * Generate DARWINA URL for given status and store
     * @private
     */
    generateDarwinaUrl(status, storeId) {
        const baseUrl = 'https://darwina.pl/adm/';
        const params = new URLSearchParams({
            'a': 'zamowienia',
            'sk': '',
            'opid': '0',
            'pcid': '0',
            'daid': storeId || '0',
            'sztyp': 'pid',
            'sztxt': '',
            'ptid': '',
            'dw': '0'
        });

        // Get current date for date filters
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        // Format dates as YYYY-MM-DD
        const formatDate = (date) => {
            return date.toISOString().split('T')[0];
        };

        // Map status to DARWINA status IDs and date filters
        switch (status) {
            case 'untouched': {
                params.set('st', '1');
                ['1', '2'].forEach(s => params.append('s[]', s));
                break;
            }
            case 'called': {
                params.set('st', '3');
                ['3', '4'].forEach(s => params.append('s[]', s));
                break;
            }
            case 'ready': {
                params.set('st', '5');
                ['5', '8', '13'].forEach(s => params.append('s[]', s));
                break;
            }
            case 'overdue': {
                params.set('st', '1');
                ['1', '2', '3', '4', '5', '8', '13'].forEach(s => params.append('s[]', s));
                params.set('dp', formatDate(sevenDaysAgo));
                params.set('dk', formatDate(threeDaysAgo));
                break;
            }
            case 'critical': {
                params.set('st', '1');
                ['1', '2', '3', '4', '5', '8', '13'].forEach(s => params.append('s[]', s));
                params.set('dk', formatDate(sevenDaysAgo));
                break;
            }
        }

        console.log('💩 [INTERFACE] Generated URL:', {
            status,
            storeId,
            url: `${baseUrl}?${params.toString()}`
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Initialize lead status links
     */
    async initializeLeadStatusLinks() {
        try {
            const statusLinks = document.querySelectorAll('[data-lead-status]');
            const statusManager = await this.getDependency('status');

            statusLinks.forEach(link => {
                link.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const status = link.dataset.leadStatus;
                    await statusManager.setLeadStatus(status);
                    this.log(LogLevel.INFO, `📈 Lead status changed to: ${status}`);
                });
            });
        } catch (error) {
            this.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.MEDIUM, {
                method: 'initializeLeadStatusLinks'
            });
        }
    }
}

// Export both class and instance
export { InterfaceManager };
export const interfaceManager = InterfaceManager.getInstance();