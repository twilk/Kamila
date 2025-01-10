import { i18n } from './i18n.js';
import { stores } from './stores.js';
import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';

export class UIManager extends BaseManager {
    constructor() {
        super();
        this.counters = new Map();
        this.selectedStore = null;
        this.tooltipList = [];
        this.messageTimeouts = new Map();
        this.debugPanelVisible = false;
        this.updateDebounceTimeout = null;
        this.resizeObserver = null;

        // Bind methods
        this.adjustWindowHeight = this.adjustWindowHeight.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.debouncedUpdateCounters = this.debouncedUpdateCounters.bind(this);
    }

    async initialize() {
        return await BaseManager.metricsManager.trackOperation('UIManager_initialize', async () => {
        try {
            await super.initialize();
                
                // Initialize components in parallel
                await Promise.all([
                    this.initializeUIComponents(),
                    this.initializeCounters(),
                    this.initializeStoreSelect(),
                    this.initializeButtons(),
                    this.initializeDebugPanel()
                ]);
            
            // Add store change listener
            document.addEventListener('storeChange', async (event) => {
                console.log('🏪 Store changed event:', event.detail);
                await this.loadAndUpdateCounters(event.detail.store);
            });

                // Setup ResizeObserver instead of window resize event
                this.setupResizeObserver();
            this.adjustWindowHeight();

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                method: 'initialize'
            });
            return false;
        }
        });
    }

    setupResizeObserver() {
        // Use ResizeObserver for better performance
        this.resizeObserver = new ResizeObserver(entries => {
            requestAnimationFrame(() => {
                this.adjustWindowHeight();
            });
        });
        this.resizeObserver.observe(document.body);
    }

    async initializeUIComponents() {
        return await BaseManager.metricsManager.trackOperation('UIManager_initComponents', async () => {
            try {
                // Create document fragment for better performance
                const fragment = document.createDocumentFragment();
                
                // Initialize tooltips in batches
                const tooltipElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
                for (let i = 0; i < tooltipElements.length; i += 10) {
                    const batch = Array.from(tooltipElements).slice(i, i + 10);
                    await Promise.all(batch.map(el => {
                const tooltip = new bootstrap.Tooltip(el);
                this.tooltipList.push(tooltip);
                        return Promise.resolve();
                    }));
                }

                // Initialize popovers in batches
                const popoverElements = document.querySelectorAll('[data-bs-toggle="popover"]');
                for (let i = 0; i < popoverElements.length; i += 10) {
                    const batch = Array.from(popoverElements).slice(i, i + 10);
                    await Promise.all(batch.map(el => {
                new bootstrap.Popover(el);
                        return Promise.resolve();
                    }));
                }

            // Initialize modals
            document.querySelectorAll('.modal').forEach(modalElement => {
                new bootstrap.Modal(modalElement, {
                    backdrop: 'static',
                    keyboard: false
                });
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeUIComponents'
            });
            return false;
        }
        });
    }

    async initializeCounters() {
        return await BaseManager.metricsManager.trackOperation('UIManager_initCounters', async () => {
        try {
                // Use more efficient selector
            const counterElements = document.querySelectorAll('[data-counter]');
                
                // Pre-allocate Map size
                this.counters = new Map(
                    Array.from(counterElements).map(element => [
                        element.getAttribute('data-counter'),
                        element
                    ]).filter(([id]) => id)
                );

            // Load initial counter values
            await this.loadAndUpdateCounters(this.selectedStore);

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeCounters'
            });
            return false;
        }
        });
    }

    debouncedUpdateCounters(counts) {
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
        }
        
        this.updateDebounceTimeout = setTimeout(() => {
            requestAnimationFrame(() => {
                this.updateCounters(counts);
            });
        }, 100);
    }

    async loadAndUpdateCounters(store) {
        return await BaseManager.metricsManager.trackOperation('UIManager_loadCounters', async () => {
        try {
            if (!store) return;

                // Show loading state using requestAnimationFrame
                requestAnimationFrame(() => {
            this.counters.forEach(counter => {
                const countElement = counter.querySelector('.count');
                if (countElement) {
                    countElement.textContent = '...';
                    countElement.classList.add('loading');
                }
                    });
            });

            // Load saved counts from storage
            const { leadCounts } = await chrome.storage.local.get('leadCounts');
            if (leadCounts) {
                    this.debouncedUpdateCounters(leadCounts);
            }

            // Fetch new data
            const response = await this.sendMessage({
                type: 'FETCH_DARWINA_DATA',
                selectedStore: store
            }, {
                maxRetries: 3,
                retryDelay: 1000,
                timeout: 10000
            });

            if (response?.error) {
                throw new Error(response.error);
            }

            if (response?.counts) {
                await chrome.storage.local.set({ leadCounts: response.counts });
                    this.debouncedUpdateCounters(response.counts);
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'loadAndUpdateCounters',
                store
            });
            return false;
        }
        });
    }

    updateCounters(counts) {
        return BaseManager.metricsManager.trackOperation('UIManager_updateCounters', () => {
        try {
            if (!counts) return;

                // Create a document fragment for batch updates
                const updates = [];

                // Prepare all updates
            Object.entries(counts).forEach(([counterId, value]) => {
                const element = this.counters.get(counterId);
                if (element) {
                        updates.push(() => {
                    // Update count value
                    const countElement = element.querySelector('.count');
                    if (countElement) {
                        countElement.textContent = value;
                        countElement.classList.remove('loading');
                    }

                    // Update counter status
                    element.classList.toggle('has-items', value > 0);
                    element.classList.toggle('no-items', value === 0);
                        });
                }
            });

                // Apply updates in the next animation frame
                requestAnimationFrame(() => {
                    updates.forEach(update => update());
                });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateCounters',
                counts
            });
            return false;
        }
        });
    }

    async initializeStoreSelect() {
        try {
            const storeSelect = document.getElementById('store-select');
            if (!storeSelect) return false;

            // Clear existing options
            storeSelect.innerHTML = '';

            // Add "All stores" option
            const allOption = document.createElement('option');
            allOption.value = 'ALL';
            allOption.textContent = i18n.translate('allStores');
            storeSelect.appendChild(allOption);

            // Add store options
            stores
                .filter(store => store.id !== 'ALL')
                .forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = `${store.name} - ${store.address}`;
                    storeSelect.appendChild(option);
                });

            // Load saved store selection
            const { selectedStore } = await chrome.storage.local.get('selectedStore');
            if (selectedStore) {
                storeSelect.value = selectedStore;
                this.selectedStore = selectedStore;
            }

            // Add change handler
            storeSelect.addEventListener('change', async (e) => {
                const newStore = e.target.value;
                await this.handleStoreChange(newStore);
            });

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeStoreSelect'
            });
            return false;
        }
    }

    async handleStoreChange(newStore) {
        try {
            if (newStore === this.selectedStore) return;

            this.selectedStore = newStore;
            await chrome.storage.local.set({ selectedStore: newStore });
            await this.loadAndUpdateCounters(newStore);

            // Emit store change event
            const event = new CustomEvent('storeChange', { 
                detail: { store: newStore } 
            });
            document.dispatchEvent(event);

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleStoreChange',
                newStore
            });
            return false;
        }
    }

    async initializeButtons() {
        try {
            // Initialize action buttons
            document.querySelectorAll('[data-action]').forEach(button => {
                const action = button.getAttribute('data-action');
                if (action) {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleButtonAction(action, button);
                    });
                }
            });

            // Initialize clear logs button
            const clearLogsBtn = document.getElementById('clear-logs');
            if (clearLogsBtn) {
                clearLogsBtn.addEventListener('click', () => {
                    const debugLogs = document.getElementById('debug-logs');
                    if (debugLogs) {
                        debugLogs.innerHTML = '';
                    }
                });
            }

            // Initialize instructions button
            const instructionsButton = document.getElementById('instructions-button');
            const instructionsModal = document.getElementById('instructionsModal');
            if (instructionsButton && instructionsModal) {
                instructionsButton.addEventListener('click', () => {
                    const modal = bootstrap.Modal.getInstance(instructionsModal) || 
                                new bootstrap.Modal(instructionsModal);
                    modal.show();
                });
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeButtons'
            });
            return false;
        }
    }

    async handleButtonAction(action, button) {
        try {
            switch (action) {
                case 'refresh':
                    await this.emit('refreshRequested');
                    break;
                case 'settings':
                    await this.emit('settingsRequested');
                    break;
                case 'clear-logs':
                    this.clearDebugLogs();
                    break;
                default:
                    await this.emit('buttonClicked', { action, button });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'handleButtonAction',
                action
            });
        }
    }

    showMessage(type, message, timeout = 5000) {
        try {
            const messageElement = document.querySelector(`.${type}-message`);
            if (messageElement) {
                messageElement.textContent = message;
                messageElement.classList.remove('d-none');

                // Clear existing timeout
                const existingTimeout = this.messageTimeouts.get(type);
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                }

                // Set new timeout
                if (timeout > 0) {
                    const timeoutId = setTimeout(() => {
                        this.hideMessage(type);
                    }, timeout);
                    this.messageTimeouts.set(type, timeoutId);
                }
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'showMessage',
                type,
                message
            });
        }
    }

    hideMessage(type) {
        try {
            const messageElement = document.querySelector(`.${type}-message`);
            if (messageElement) {
                messageElement.classList.add('d-none');
            }

            // Clear timeout
            const timeoutId = this.messageTimeouts.get(type);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.messageTimeouts.delete(type);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideMessage',
                type
            });
        }
    }

    hideAllMessages() {
        try {
        document.querySelectorAll('.error-message, .loading-message').forEach(el => {
            el.classList.add('d-none');
        });

            // Clear all timeouts
            this.messageTimeouts.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            this.messageTimeouts.clear();
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'hideAllMessages'
            });
        }
    }

    clearDebugLogs() {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (debugLogs) {
                debugLogs.innerHTML = '';
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'clearDebugLogs'
            });
        }
    }

    async initializeDebugPanel() {
        try {
            const debugPanel = document.querySelector('.debug-panel');
            const debugToggle = document.getElementById('debug-toggle');
            
            if (debugPanel && debugToggle) {
                // Load debug state
                const { debugEnabled } = await chrome.storage.local.get('debugEnabled');
                this.debugPanelVisible = debugEnabled || false;
                
                // Update UI
                document.body.classList.toggle('debug-enabled', this.debugPanelVisible);
                debugToggle.checked = this.debugPanelVisible;
                
                // Add toggle handler
                debugToggle.addEventListener('change', (e) => {
                    this.toggleDebugPanel(e.target.checked);
                });

                // Initialize debug buttons
                this.initializeDebugButtons();

                // Initialize debug log
                this.initializeDebugLog();
            }

            return true;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeDebugPanel'
            });
            return false;
        }
    }

    async toggleDebugPanel(show) {
        try {
            this.debugPanelVisible = show;
            document.body.classList.toggle('debug-enabled', show);
            await chrome.storage.local.set({ debugEnabled: show });
            this.adjustWindowHeight();

            // Emit debug state change event
            this.emit('debugStateChanged', { enabled: show });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'toggleDebugPanel',
                show
            });
        }
    }

    initializeDebugButtons() {
        try {
            // Clear logs button
            const clearLogsBtn = document.getElementById('clear-debug-logs');
            if (clearLogsBtn) {
                clearLogsBtn.addEventListener('click', () => this.clearDebugLogs());
            }

            // Copy logs button
            const copyLogsBtn = document.getElementById('copy-debug-logs');
            if (copyLogsBtn) {
                copyLogsBtn.addEventListener('click', () => this.copyDebugLogs());
            }

            // Save logs button
            const saveLogsBtn = document.getElementById('save-debug-logs');
            if (saveLogsBtn) {
                saveLogsBtn.addEventListener('click', () => this.saveDebugLogs());
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeDebugButtons'
            });
        }
    }

    async copyDebugLogs() {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (debugLogs) {
                await navigator.clipboard.writeText(debugLogs.innerText);
                this.showMessage('success', 'Debug logs copied to clipboard', 2000);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'copyDebugLogs'
            });
        }
    }

    async saveDebugLogs() {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (debugLogs) {
                const blob = new Blob([debugLogs.innerText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `debug_logs_${new Date().toISOString()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'saveDebugLogs'
            });
        }
    }

    handleWindowResize() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
            this.adjustWindowHeight();
        }, 100);
    }

    adjustWindowHeight() {
        try {
        const debugPanel = document.querySelector('.debug-panel');
            if (debugPanel && this.debugPanelVisible) {
            const debugPanelHeight = debugPanel.offsetHeight;
                document.body.style.height = `calc(var(--window-height) + ${debugPanelHeight}px)`;
        } else {
            document.body.style.height = 'var(--window-height)';
            }

            // Emit height change event
            this.emit('heightChanged', { height: document.body.offsetHeight });
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'adjustWindowHeight'
            });
        }
    }

    async resizeWindow(height) {
        try {
            if (chrome?.windows?.getCurrent) {
                const window = await chrome.windows.getCurrent();
                await chrome.windows.update(window.id, { height });
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'resizeWindow',
                height
            });
        }
    }

    initializeDebugLog() {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (!debugLogs) return;

            // Clear old logs
            debugLogs.innerHTML = '';

            // Add initial log
            this.logToDebug('Debug panel initialized', 'info');

            // Override console methods
            if (this.debugPanelVisible) {
                this.overrideConsole();
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'initializeDebugLog'
            });
        }
    }

    overrideConsole() {
        try {
            const originalConsole = {
                log: console.log,
                info: console.info,
                warn: console.warn,
                error: console.error,
                debug: console.debug
            };

            // Override console methods
            console.log = (...args) => {
                originalConsole.log.apply(console, args);
                this.logToDebug(args, 'log');
            };

            console.info = (...args) => {
                originalConsole.info.apply(console, args);
                this.logToDebug(args, 'info');
            };

            console.warn = (...args) => {
                originalConsole.warn.apply(console, args);
                this.logToDebug(args, 'warning');
            };

            console.error = (...args) => {
                originalConsole.error.apply(console, args);
                this.logToDebug(args, 'error');
            };

            console.debug = (...args) => {
                originalConsole.debug.apply(console, args);
                this.logToDebug(args, 'debug');
            };

            // Store original methods for cleanup
            this.originalConsole = originalConsole;
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'overrideConsole'
            });
        }
    }

    restoreConsole() {
        try {
            if (this.originalConsole) {
                console.log = this.originalConsole.log;
                console.info = this.originalConsole.info;
                console.warn = this.originalConsole.warn;
                console.error = this.originalConsole.error;
                console.debug = this.originalConsole.debug;
                this.originalConsole = null;
            }
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'restoreConsole'
            });
        }
    }

    logToDebug(message, type = 'log') {
        try {
            const debugLogs = document.getElementById('debug-logs');
            if (!debugLogs) return;

            // Create log entry
            const entry = document.createElement('div');
            entry.className = `debug-log debug-${type}`;

            // Add timestamp
            const timestamp = new Date().toLocaleTimeString();
            entry.innerHTML = `<span class="debug-time">[${timestamp}]</span> `;

            // Add message
            if (Array.isArray(message)) {
                message.forEach((item, index) => {
                    if (index > 0) entry.innerHTML += ' ';
                    entry.innerHTML += this.formatDebugMessage(item);
                });
            } else {
                entry.innerHTML += this.formatDebugMessage(message);
            }

            // Add to log
            debugLogs.appendChild(entry);

            // Scroll to bottom
            debugLogs.scrollTop = debugLogs.scrollHeight;

            // Limit log size
            while (debugLogs.childNodes.length > 1000) {
                debugLogs.removeChild(debugLogs.firstChild);
            }
        } catch (error) {
            // Use original console to avoid infinite loop
            if (this.originalConsole) {
                this.originalConsole.error('Error in logToDebug:', error);
            }
        }
    }

    formatDebugMessage(message) {
        try {
            if (message === null) return 'null';
            if (message === undefined) return 'undefined';
            if (typeof message === 'object') {
                return JSON.stringify(message, null, 2)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;')
                    .replace(/\n/g, '<br>')
                    .replace(/\s/g, '&nbsp;');
            }
            return message.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        } catch (error) {
            // Use original console to avoid infinite loop
            if (this.originalConsole) {
                this.originalConsole.error('Error in formatDebugMessage:', error);
            }
            return '[Error formatting message]';
        }
    }

    /**
     * Clean up resources and dispose of the manager
     */
    async dispose() {
        // Clean up ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clear debounce timeout
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
        }

        // Dispose tooltips
            this.tooltipList.forEach(tooltip => {
            tooltip.dispose();
            });
            this.tooltipList = [];

        // Clear other resources
            this.counters.clear();
        this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
            this.messageTimeouts.clear();

        await super.dispose();
    }
} 