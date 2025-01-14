// Constants
const REFRESH_INTERVAL = 300000; // 5 minut
const STATUS_MAP = {
    'submitted': '1',
    'confirmed': '2',
    'accepted': '3',
    'ready': 'READY',
    'overdue': 'OVERDUE'
};

// Import all services from index
import { 
    InitLogger,
    MetricsManager,
    BaseManager,
    CacheManager,
    DataManager,
    MenuManager,
    LoadingManager,
    ProgressManager,
    UpdateManager,
    InterfaceManager,
    StatusManager,
    i18n,
    stores,
    UserCardService,
    OrderService,
    LanguageManager,
    RankingManager,
    VolumeManager,
    RefreshManager,
    UIManager,
    UserManager,
    ErrorHandler,
    DebugManager,
    EventManager,
    ErrorType,
    ErrorSeverity,
    ConnectionManager,
    storeManager,
    storageManager
} from './services/index.js';

// Config imports
import { API_CONFIG, getDarwinaCredentials } from './config/api.js';
import { STORAGE_KEYS } from './config/storage.js';
import { DEFAULT_INTERVALS, getIntervalSettings } from './config/intervals.js';

// Make stores available globally
window.stores = stores;

// Declare all managers and services
let metricsManager, errorHandler, uiManager, debugManager, eventManager,
    connectionManager, cacheManager, progressManager, loadingManager,
    menuManager, volumeManager, dataManager, statusManager, userManager,
    interfaceManager, updateManager, languageManager, refreshManager, orderService;

// Initialize static fields
BaseManager.initLogger = new InitLogger();
metricsManager = new MetricsManager();
BaseManager.metricsManager = metricsManager;

// Initialize core services first
async function initializeManagers() {
    try {
        // 1. Core Services
        await metricsManager.initialize();
        
        errorHandler = new ErrorHandler();
        uiManager = new UIManager();
        debugManager = new DebugManager();
        eventManager = new EventManager();
        connectionManager = new ConnectionManager();
        cacheManager = new CacheManager({ compression: true });

        // Initialize OrderService
        const credentials = await getDarwinaCredentials();
        orderService = new OrderService(credentials);

        // Set error handlers for core services
        uiManager.setErrorHandler(errorHandler);
        debugManager.setErrorHandler(errorHandler);
        eventManager.setErrorHandler(errorHandler);
        connectionManager.setErrorHandler(errorHandler);
        cacheManager.setErrorHandler(errorHandler);

        // Initialize core services
        await errorHandler.initialize();
        await uiManager.initialize();
        await debugManager.initialize();
        await eventManager.initialize();
        await connectionManager.initialize();
        await cacheManager.initialize();
        await storeManager.initialize();

        // 2. Base Managers
        loadingManager = new LoadingManager(eventManager);
        progressManager = new ProgressManager(eventManager);
        menuManager = new MenuManager(eventManager);
        volumeManager = new VolumeManager(eventManager);

        // Set error handlers for base managers
        loadingManager.setErrorHandler(errorHandler);
        progressManager.setErrorHandler(errorHandler);
        menuManager.setErrorHandler(errorHandler);
        volumeManager.setErrorHandler(errorHandler);

        // Initialize base managers
        await loadingManager.initialize();
        await progressManager.initialize();
        await menuManager.initialize();
        await volumeManager.initialize();

        // 3. Feature Managers
        dataManager = new DataManager(uiManager);
        statusManager = new StatusManager(eventManager);
        userManager = new UserManager(uiManager);
        interfaceManager = new InterfaceManager(uiManager, eventManager, debugManager);
        updateManager = new UpdateManager(eventManager);
        languageManager = new LanguageManager(eventManager);
        refreshManager = new RefreshManager(dataManager);

        // Set error handlers for feature managers
        dataManager.setErrorHandler(errorHandler);
        statusManager.setErrorHandler(errorHandler);
        userManager.setErrorHandler(errorHandler);
        interfaceManager.setErrorHandler(errorHandler);
        updateManager.setErrorHandler(errorHandler);
        languageManager.setErrorHandler(errorHandler);
        refreshManager.setErrorHandler(errorHandler);

        // Add dependencies
        dataManager.addDependency(uiManager);
        dataManager.addDependency(cacheManager);

        // Initialize feature managers
        await dataManager.initialize();
        await statusManager.initialize();
        await userManager.initialize();
        await interfaceManager.initialize();
        await updateManager.initialize();
        await languageManager.initialize();
        await refreshManager.initialize();

        // Set up event handlers
        eventManager.on('data:updated', (data) => {
            updateCounters(data.counts);
        });

        eventManager.on('store:changed', async (storeId) => {
            await loadAndUpdateData(true);
        });

        eventManager.on('error', (error) => {
            errorHandler.handleError(error);
        });

        console.log('[SUCCESS] ✅ All managers initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Manager initialization failed:', error);
        throw error;
    }
}

// Helper function to check if all required managers are initialized
function checkRequiredManagers() {
    const required = {
        connectionManager,
        loadingManager,
        dataManager,
        errorHandler,
        debugManager,
        uiManager
    };

    const missing = Object.entries(required)
        .filter(([, manager]) => !manager)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Required managers not initialized: ${missing.join(', ')}`);
    }

    return true;
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize all managers
        await initializeManagers();
        
        // Initial data load
        await loadAndUpdateData();
        
        // Set up refresh interval
        setInterval(async () => {
            await loadAndUpdateData(true);
        }, REFRESH_INTERVAL);
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('[SUCCESS] ✅ Popup initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Initialization failed:', error);
        errorHandler?.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.CRITICAL, {
            method: 'DOMContentLoaded'
        });
    }
});

// Set up event listeners
function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-button')?.addEventListener('click', async () => {
        try {
            await loadAndUpdateData(true);
        } catch (error) {
            errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'refreshButton'
            });
        }
    });

    // Store selector
    document.getElementById('store-select')?.addEventListener('change', async (event) => {
        try {
            const newStore = event.target.value;
            await storeManager.changeStore(newStore);
            await loadAndUpdateData(true);
        } catch (error) {
            errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                method: 'storeSelect'
            });
        }
    });

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('change', (event) => {
        try {
            const isDarkTheme = event.target.checked;
            document.body.classList.toggle('dark-theme', isDarkTheme);
            storageManager.save('theme', isDarkTheme ? 'dark' : 'light').catch(error => {
                console.warn('[WARNING] Failed to save theme preference:', error);
            });
        } catch (error) {
            console.warn('[WARNING] Theme toggle error:', error);
        }
    });
}

// UI Helper Functions
function safeUpdateElement(selector, updateFn) {
    try {
        const element = document.querySelector(selector);
        if (element) {
            updateFn(element);
        }
    } catch (error) {
        console.error(`Error updating element ${selector}:`, error);
    }
}

function safeUpdateElements(selector, updateFn) {
    try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            elements.forEach((element, index) => {
                try {
                    updateFn(element, index);
                } catch (error) {
                    console.warn(`Error updating element at index ${index}:`, error);
                }
            });
        }
    } catch (error) {
        console.error('Error in safeUpdateElements:', error);
    }
}

// Message Handling Functions
function showMessage(type, key) {
    const message = document.querySelector(`.${type}-message`);
    if (message) {
        message.textContent = i18n.translate(key);
        message.classList.remove('d-none');
    }
}

function hideMessage(type) {
    const message = document.querySelector(`.${type}-message`);
    if (message) {
        message.classList.add('d-none');
    }
}

function hideAllMessages() {
    document.querySelectorAll('.error-message, .loading-message').forEach(el => {
        el.classList.add('d-none');
    });
}

// Window Management Functions
function adjustWindowHeight() {
    const debugPanel = document.querySelector('.debug-panel');
    if (debugPanel && document.body.classList.contains('debug-enabled')) {
        const debugPanelHeight = debugPanel.offsetHeight;
        document.body.style.height = `calc(var(--window-height) + ${debugPanelHeight/2}px)`;
    } else {
        document.body.style.height = 'var(--window-height)';
    }
}

async function resizeWindow(height) {
    try {
        if (chrome?.windows?.getCurrent) {
            const window = await chrome.windows.getCurrent();
            await chrome.windows.update(window.id, { height });
        } else {
            document.body.style.height = `${height}px`;
        }
    } catch (error) {
        document.body.style.height = `${height}px`;
    }
}

// Load and update data
async function loadAndUpdateData(forceRefresh = false) {
    try {
        // Get current store
        const currentStore = await storeManager.getCurrentStore();
        if (!currentStore) {
            throw new Error('No store selected');
        }

        // Try to get cached data first
        const cacheKey = `data_${currentStore.id}`;
        let data = null;
        
        if (!forceRefresh) {
            data = await storageManager.load(cacheKey);
        }

        // If no cached data or force refresh, fetch new data
        if (!data || forceRefresh) {
            console.log('[INFO] 📥 Fetching fresh data for store:', currentStore.id);

        // Show loading state
            updateLoadingState(true);
            
            // Get fresh credentials
            const credentials = await getDarwinaCredentials();
            if (!credentials || !credentials.token) {
                throw new Error('Failed to obtain valid API token');
            }
            
            // Initialize OrderService with fresh credentials
            orderService = new OrderService({ token: credentials.token });
            
            // Fetch new data
            const result = await orderService.fetchAllOrders(currentStore);
            if (!result.success) {
                throw new Error('Failed to fetch orders');
            }

            // Save new data
            data = {
                orders: result.orders,
                counts: result.counts,
                timestamp: Date.now()
            };
            
            await storageManager.save(cacheKey, data);
        }

        // Update UI with counts
        updateCounters(data.counts);
        
        // Hide loading state
        updateLoadingState(false);

        console.log('[SUCCESS] ✅ Data updated successfully');
        return true;
    } catch (error) {
        console.error('[ERROR] ❌ Failed to load and update data:', error);
        updateLoadingState(false);
        return false;
    }
}

function updateLoadingState(isLoading) {
    const refreshButton = document.getElementById('refresh-store-data');
    if (refreshButton) {
        refreshButton.disabled = isLoading;
        refreshButton.innerHTML = isLoading ? 
            '<span class="spinner-border spinner-border-sm"></span>' : 
            '<i class="fas fa-sync-alt"></i>';
    }
}

// Update counters in UI
function updateCounters(counts) {
    if (!counts) {
        console.warn('[WARNING] ⚠️ No counts data provided');
        return;
    }

    // Map status codes to element IDs
    const statusMap = {
        '1': 'count-1',
        '2': 'count-2',
        '3': 'count-3',
        'READY': 'count-ready',
        'OVERDUE': 'count-overdue'
    };

    // Update each counter
    Object.entries(counts).forEach(([status, count]) => {
        const elementId = statusMap[status];
        if (!elementId) return;

        const countElement = document.getElementById(elementId);
        if (countElement) {
            // Update count value
            countElement.textContent = count;
            
            // Toggle classes based on count
            countElement.classList.toggle('has-count', count > 0);
            if (status === 'OVERDUE') {
                countElement.classList.toggle('overdue', count > 0);
            }

            // Add animation for changes
            countElement.classList.add('count-changed');
            setTimeout(() => {
                countElement.classList.remove('count-changed');
            }, 1000);
        }

        // Update parent status element
        const statusElement = document.querySelector(`[data-status="${status}"]`);
        if (statusElement) {
            statusElement.classList.toggle('has-items', count > 0);
        }
    });

    // Log update for debugging
    console.log('[DEBUG] 🔄 Updated counters:', counts);
}

// Update status indicators based on counts
function updateStatusIndicators(counts) {
    const indicators = {
        newOrders: counts['1'] > 0,
        confirmedOrders: counts['2'] > 0,
        acceptedOrders: counts['3'] > 0,
        readyOrders: counts['READY'] > 0,
        overdueOrders: counts['OVERDUE'] > 0
    };

    Object.entries(indicators).forEach(([indicator, active]) => {
        const element = document.querySelector(`.status-indicator.${indicator}`);
        if (element) {
            element.classList.toggle('active', active);
        }
    });
}

// Add refresh functionality
document.getElementById('refresh-button')?.addEventListener('click', async () => {
    try {
        // Show loading state
        const refreshButton = document.getElementById('refresh-button');
        refreshButton.classList.add('loading');
        refreshButton.disabled = true;

        // Force refresh data
        await loadAndUpdateData(true);

        // Reset button state
        refreshButton.classList.remove('loading');
        refreshButton.disabled = false;
    } catch (error) {
        console.error('[ERROR] ❌ Refresh failed:', error);
        errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
            method: 'refreshButton'
        });
    }
});

async function initializeUI() {
    try {
        // Initialize store manager first
        await storeManager.initialize();
        
        // Get current store
        const currentStore = await storeManager.getCurrentStore();
        if (!currentStore) {
            throw new Error('Failed to initialize store');
        }

        // Initialize store selector
        const storeSelector = document.getElementById('store-selector');
        if (storeSelector) {
            // Populate store options
            const stores = storeManager.getAllStores();
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                if (store.id === currentStore.id) {
                    option.selected = true;
                }
                storeSelector.appendChild(option);
            });

            // Add change listener
            storeSelector.addEventListener('change', async (event) => {
                const newStoreId = event.target.value;
                await storeManager.changeStore(newStoreId);
                await loadAndUpdateData();
            });
        }

        // Initialize refresh button
        const refreshButton = document.getElementById('refresh-store-data');
        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                await loadAndUpdateData(true); // Force refresh
            });
        }

        // Load initial data
        await loadAndUpdateData();

        console.log('[SUCCESS] ✅ UI initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Failed to initialize UI:', error);
        throw error;
    }
}

