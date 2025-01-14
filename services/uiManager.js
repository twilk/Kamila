import { i18n } from './i18n.js';
import { stores } from './stores.js';
import { BaseManager } from './core/BaseManager.js';
import { ErrorType, ErrorSeverity } from './core/ErrorTypes.js';
import { UIManager as CoreUIManager } from './core/UIManager.js';

export class UIManager extends CoreUIManager {
    constructor() {
        super();
        this.counters = new Map();
        this.selectedStore = null;
        this.tooltipList = [];
        this.messageTimeouts = new Map();
        this.debugPanelVisible = false;
        this.updateDebounceTimeout = null;
        this.resizeObserver = null;
        this.updateQueue = new Set();
        this.isUpdating = false;
        this.lastUpdateTimestamp = 0;
        this.MIN_UPDATE_INTERVAL = 100; // ms

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
            // Use more efficient selector and validate elements
            const counterElements = document.querySelectorAll('[data-counter]');
            if (!counterElements.length) {
                throw new Error('No counter elements found');
            }
                
            // Pre-allocate Map size and validate counter IDs
            const validCounters = Array.from(counterElements)
                .map(element => {
                    const id = element.getAttribute('data-counter');
                    if (!id) {
                        console.warn('Counter element without data-counter attribute:', element);
                        return null;
                    }
                    return [id, element];
                })
                .filter(item => item !== null);

            this.counters = new Map(validCounters);

            if (!this.counters.size) {
                throw new Error('No valid counter elements found');
            }

            // Initialize counter states
            this.counters.forEach((element, id) => {
                const countElement = element.querySelector('.count');
                if (countElement) {
                    countElement.textContent = '...';
                    countElement.classList.add('loading');
                    element.classList.remove('has-items', 'no-items', 'error');
                }
            });

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
        
        // Validate counts before updating
        if (!counts || typeof counts !== 'object') {
            console.error('Invalid counts data:', counts);
            return;
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
                console.log('[DEBUG] 🔄 Starting loadAndUpdateCounters with store:', store);
                
                if (!store) {
                    console.warn('[WARNING] ⚠️ No store selected in loadAndUpdateCounters');
                    throw new Error('No store selected');
                }

                // Show loading state using requestAnimationFrame
                requestAnimationFrame(() => {
                    console.log('[DEBUG] 🔄 Setting loading state for counters');
                    this.counters.forEach(counter => {
                        const countElement = counter.querySelector('.count');
                        if (countElement) {
                            countElement.textContent = '...';
                            countElement.classList.add('loading');
                            counter.classList.remove('has-items', 'no-items', 'error');
                        }
                    });
                });

                // Load saved counts from storage with store context
                console.log('[DEBUG] 📂 Fetching stored counts for store:', store);
                const { leadCounts, selectedStore } = await chrome.storage.local.get(['leadCounts', 'selectedStore']);
                console.log('[DEBUG] 📊 Stored data:', { leadCounts, selectedStore });
                
                // Only update if the stored data matches current store
                if (leadCounts && selectedStore === store) {
                    console.log('[DEBUG] ✅ Using stored counts for matching store');
                    this.debouncedUpdateCounters(leadCounts);
                }

                // Fetch new data
                console.log('[DEBUG] 🔄 Fetching new data from API');
                const response = await this.sendMessage({
                    type: 'FETCH_DARWINA_DATA',
                    selectedStore: store,
                    forceRefresh: true // Force refresh to ensure we get fresh data
                }, {
                    maxRetries: 3,
                    retryDelay: 1000,
                    timeout: 10000
                });
                console.log('[DEBUG] 📊 API Response:', response);

                if (response?.error) {
                    console.error('[ERROR] ❌ API Error:', response.error);
                    throw new Error(response.error);
                }

                if (response?.counts) {
                    console.log('[DEBUG] 🔍 Validating counts data:', response.counts);
                    // Validate counts before saving and updating
                    if (!this.validateCountsData(response.counts)) {
                        console.error('[ERROR] ❌ Invalid counter data:', response.counts);
                        throw new Error('Invalid counter data received');
                    }

                    console.log('[DEBUG] 💾 Saving new counts to storage');
                    // Save with store context
                    await chrome.storage.local.set({ 
                        leadCounts: response.counts,
                        selectedStore: store,
                        lastUpdate: Date.now()
                    });
                    
                    console.log('[DEBUG] 🔄 Updating UI with new counts');
                    this.debouncedUpdateCounters(response.counts);
                } else {
                    console.error('[ERROR] ❌ No counts data in response:', response);
                    throw new Error('No counts data received');
                }

                return true;
            } catch (error) {
                console.error('[ERROR] ❌ Error in loadAndUpdateCounters:', error, {
                    store,
                    stack: error.stack
                });
                
                this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'loadAndUpdateCounters',
                    store
                });

                // Show error state in UI
                requestAnimationFrame(() => {
                    console.log('[DEBUG] ⚠️ Setting error state in UI');
                    this.counters.forEach(counter => {
                        const countElement = counter.querySelector('.count');
                        if (countElement) {
                            countElement.textContent = '-';
                            countElement.classList.remove('loading');
                            counter.classList.add('error');
                        }
                    });
                });

                return false;
            }
        });
    }

    updateCounters(counts) {
        return BaseManager.metricsManager.trackOperation('UIManager_updateCounters', () => {
            try {
                console.log('[DEBUG] 🔄 Starting updateCounters with data:', counts);
                
                if (!counts || typeof counts !== 'object') {
                    console.error('[ERROR] ❌ Invalid counts data:', counts);
                    throw new Error('Invalid counts data');
                }

                // Create a document fragment for batch updates
                const updates = [];

                // Prepare all updates
                Object.entries(counts).forEach(([counterId, value]) => {
                    const element = this.counters.get(counterId);
                    if (!element) {
                        console.warn(`[WARNING] ⚠️ Counter element not found for ID: ${counterId}`);
                        return;
                    }

                    if (typeof value !== 'number' || isNaN(value)) {
                        console.error(`[ERROR] ❌ Invalid value for counter ${counterId}:`, value);
                        return;
                    }

                    console.log(`[DEBUG] 📊 Preparing update for counter ${counterId}:`, value);
                    updates.push(() => {
                        // Update count value
                        const countElement = element.querySelector('.count');
                        if (countElement) {
                            console.log(`[DEBUG] ✏️ Setting value for ${counterId}:`, value);
                            countElement.textContent = value;
                            countElement.classList.remove('loading');
                            
                            // Add animation for value changes
                            if (countElement.dataset.previousValue !== undefined && 
                                countElement.dataset.previousValue !== value.toString()) {
                                console.log(`[DEBUG] 🔄 Value changed for ${counterId}:`, {
                                    from: countElement.dataset.previousValue,
                                    to: value
                                });
                                element.classList.add('count-changed');
                                setTimeout(() => element.classList.remove('count-changed'), 1000);
                            }
                            countElement.dataset.previousValue = value.toString();
                        }

                        // Update counter status
                        element.classList.remove('has-items', 'no-items', 'error');
                        element.classList.add(value > 0 ? 'has-items' : 'no-items');
                    });
                });

                console.log('[DEBUG] 🔄 Applying updates in next animation frame');
                // Apply updates in the next animation frame
                requestAnimationFrame(() => {
                    updates.forEach(update => update());
                    console.log('[DEBUG] ✅ Counter updates completed');
                });

                return true;
            } catch (error) {
                console.error('[ERROR] ❌ Error in updateCounters:', error, {
                    counts,
                    stack: error.stack
                });
                
                this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'updateCounters',
                    counts
                });

                // Show error state
                requestAnimationFrame(() => {
                    console.log('[DEBUG] ⚠️ Setting error state for all counters');
                    this.counters.forEach(counter => {
                        const countElement = counter.querySelector('.count');
                        if (countElement) {
                            countElement.textContent = '-';
                            countElement.classList.remove('loading');
                            counter.classList.add('error');
                        }
                    });
                });

                return false;
            }
        });
    }

    validateCountsData(counts) {
        if (!counts || typeof counts !== 'object') return false;
        
        const requiredStatuses = ['1', '2', '3', 'READY', 'OVERDUE'];
        return requiredStatuses.every(status => 
            counts.hasOwnProperty(status) && 
            typeof counts[status] === 'number' &&
            !isNaN(counts[status]) &&
            counts[status] >= 0
        );
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
        return await BaseManager.metricsManager.trackOperation('UIManager_handleStoreChange', async () => {
            try {
                // Walidacja nowego sklepu
                if (!this.validateStoreId(newStore)) {
                    throw new Error(`Invalid store ID: ${newStore}`);
                }

                // Jeśli sklep się nie zmienił, nie rób nic
                if (newStore === this.selectedStore) {
                    return true;
                }

                // Pokaż stan ładowania
                this.showLoadingState();

                // Zapisz poprzedni sklep do porównania
                const previousStore = this.selectedStore;
                this.selectedStore = newStore;

                try {
                    // Zapisz wybór w storage
                    await chrome.storage.local.set({ 
                        selectedStore: newStore,
                        previousStore: previousStore 
                    });

                    // Wyczyść cache dla poprzedniego sklepu
                    if (previousStore) {
                        await this.clearStoreCache(previousStore);
                    }

                    // Załaduj dane dla nowego sklepu z retry mechanism
                    const success = await this.retryOperation(
                        () => this.loadAndUpdateCounters(newStore),
                        3, // max retries
                        1000 // delay between retries
                    );

                    if (!success) {
                        throw new Error('Failed to load data for new store');
                    }

                    // Emituj event zmiany sklepu
                    const event = new CustomEvent('storeChange', { 
                        detail: { 
                            store: newStore,
                            previousStore,
                            timestamp: Date.now()
                        } 
                    });
                    document.dispatchEvent(event);

                    // Aktualizuj UI
                    await this.updateStoreUI({
                        id: newStore,
                        name: stores.find(s => s.id === newStore)?.name || ''
                    });

                    return true;
                } catch (error) {
                    // W przypadku błędu, przywróć poprzedni sklep
                    this.selectedStore = previousStore;
                    await chrome.storage.local.set({ selectedStore: previousStore });
                    throw error;
                }
            } catch (error) {
                this.handleError(error, ErrorType.UI, ErrorSeverity.ERROR, {
                    method: 'handleStoreChange',
                    newStore
                });
                this.showMessage('error', i18n.translate('storeChangeError'));
                return false;
            } finally {
                this.hideLoadingState();
            }
        });
    }

    validateStoreId(storeId) {
        if (storeId === 'ALL') return true;
        return stores.some(store => store.id === storeId);
    }

    async clearStoreCache(storeId) {
        try {
            const cacheKey = `store_${storeId}`;
            await this._cacheManager?.remove(cacheKey);
            console.log(`[DEBUG] 🧹 Wyczyszczono cache dla sklepu ${storeId}`);
        } catch (error) {
            console.warn(`[WARNING] ⚠️ Błąd czyszczenia cache dla sklepu ${storeId}:`, error);
        }
    }

    async retryOperation(operation, maxRetries, delay) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`[WARNING] ⚠️ Próba ${i + 1}/${maxRetries} nie powiodła się:`, error);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                }
            }
        }
        throw lastError;
    }

    showLoadingState() {
        // Pokaż stan ładowania w UI
        const storeSelect = document.getElementById('store-select');
        if (storeSelect) {
            storeSelect.disabled = true;
            storeSelect.classList.add('loading');
        }
        this.showMessage('loading', i18n.translate('storeChangeLoading'));
    }

    hideLoadingState() {
        // Ukryj stan ładowania w UI
        const storeSelect = document.getElementById('store-select');
        if (storeSelect) {
            storeSelect.disabled = false;
            storeSelect.classList.remove('loading');
        }
        this.hideMessage('loading');
    }

    async updateStoreUI(data) {
        try {
            // Aktualizuj select
            const storeSelect = document.getElementById('store-select');
            if (storeSelect) {
                storeSelect.value = data.id;
            }

            // Aktualizuj nazwę sklepu w UI
            const storeNameElement = document.getElementById('store-name');
            if (storeNameElement) {
                storeNameElement.textContent = data.name || i18n.translate('allStores');
            }

            // Aktualizuj badge
            const storeBadge = document.getElementById('store-badge');
            if (storeBadge) {
                storeBadge.textContent = data.id === 'ALL' ? 'ALL' : data.name;
                storeBadge.classList.toggle('all-stores', data.id === 'ALL');
            }

            // Emituj event aktualizacji UI
            this.emit('storeUIUpdated', data);
        } catch (error) {
            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'updateStoreUI',
                data
            });
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

    async queueUpdate(type, data) {
        this.updateQueue.add({ type, data, timestamp: Date.now() });
        this.processUpdateQueue();
    }

    async processUpdateQueue() {
        if (this.isUpdating) return;

        try {
            this.isUpdating = true;
            const now = Date.now();

            // Skip if last update was too recent
            if (now - this.lastUpdateTimestamp < this.MIN_UPDATE_INTERVAL) {
                setTimeout(() => this.processUpdateQueue(), this.MIN_UPDATE_INTERVAL);
                return;
            }

            while (this.updateQueue.size > 0) {
                const updates = Array.from(this.updateQueue);
                this.updateQueue.clear();

                // Group updates by type
                const groupedUpdates = updates.reduce((acc, update) => {
                    if (!acc[update.type]) acc[update.type] = [];
                    acc[update.type].push(update.data);
                    return acc;
                }, {});

                // Process updates in requestAnimationFrame
                await new Promise(resolve => {
                    requestAnimationFrame(async () => {
                        try {
                            for (const [type, dataArray] of Object.entries(groupedUpdates)) {
                                const latestData = dataArray[dataArray.length - 1];
                                await this.updateComponent(type, latestData);
                            }
                        } catch (error) {
                            this.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                                method: 'processUpdateQueue'
                            });
                        }
                        resolve();
                    });
                });

                this.lastUpdateTimestamp = Date.now();
            }
        } finally {
            this.isUpdating = false;
        }
    }

    async updateComponent(type, data) {
        if (!this.validateUpdateData(type, data)) {
            throw new Error(`Invalid update data for type: ${type}`);
        }

        switch (type) {
            case 'counters':
                await this.updateCounters(data);
                break;
            case 'store':
                await this.updateStoreUI(data);
                break;
            case 'interface':
                await this.updateInterface(data);
                break;
            default:
                console.warn(`Unknown update type: ${type}`);
        }
    }

    validateUpdateData(type, data) {
        switch (type) {
            case 'counters':
                return data && typeof data === 'object' && 
                       Object.values(data).every(count => typeof count === 'number');
            case 'store':
                return data && typeof data === 'object' && 
                       typeof data.id === 'string' && 
                       typeof data.name === 'string';
            case 'interface':
                return true; // Interface updates don't require specific data
            default:
                return false;
        }
    }

    async sendMessage(message, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            timeout = 10000
        } = options;

        let attempt = 0;
        let lastError = null;

        while (attempt < maxRetries) {
            try {
                console.log(`[DEBUG] 📤 Sending message attempt (${attempt + 1}/${maxRetries}):`, message);

                // Check connection first
                const isConnected = await this.checkConnection();
                if (!isConnected) {
                    console.warn('[WARNING] ⚠️ Connection check failed, retrying...');
                    throw new Error('Connection check failed');
                }

                // Create a promise that will reject on timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Message timeout after ${timeout}ms`)), timeout);
                });

                // Create the message promise with port communication
                const messagePromise = new Promise((resolve) => {
                    const port = chrome.runtime.connect({ name: 'popup' });
                    
                    port.onMessage.addListener(function messageListener(response) {
                        port.onMessage.removeListener(messageListener);
                        port.disconnect();
                        resolve(response);
                    });

                    port.postMessage(message);

                    // Handle disconnection
                    port.onDisconnect.addListener(() => {
                        const error = chrome.runtime.lastError;
                        if (error) {
                            resolve({ error: error.message });
                        }
                    });
                });

                // Race between timeout and message
                const response = await Promise.race([messagePromise, timeoutPromise]);

                if (response?.error) {
                    throw new Error(response.error);
                }

                console.log('[DEBUG] ✅ Message sent successfully:', response);
                return response;

            } catch (error) {
                lastError = error;
                attempt++;

                if (attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(2, attempt - 1);
                    console.warn(`[WARNING] ⚠️ Send error (attempt ${attempt}/${maxRetries}):`, error);
                    console.log(`[DEBUG] ⏳ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.error('[ERROR] ❌ All message sending attempts failed:', lastError);
        throw lastError;
    }

    async checkConnection() {
        try {
            const port = chrome.runtime.connect({ name: 'connection_check' });
            return new Promise((resolve) => {
                port.onMessage.addListener(function messageListener(response) {
                    port.onMessage.removeListener(messageListener);
                    port.disconnect();
                    resolve(response?.connected === true);
                });

                port.postMessage({ type: 'CONNECTION_CHECK' });

                // Handle disconnection
                port.onDisconnect.addListener(() => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        resolve(false);
                    }
                });

                // Timeout after 2 seconds
                setTimeout(() => {
                    port.disconnect();
                    resolve(false);
                }, 2000);
            });
        } catch (error) {
            console.warn('[WARNING] ⚠️ Connection check error:', error);
            return false;
        }
    }
} 