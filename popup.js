// Import all managers and services from central point
import {
    // Core services
    InitLogger,
    BaseManager,
    errorHandler,
    initializationManager,
    LogLevel,
    ErrorType,
    ErrorSeverity,
    
    // Core managers
    eventManager,
    loadingManager,
    connectionManager,
    cacheManager,
    uiManager,
    debugManager,
    themeManager,
    progressManager,
    menuManager,
    interfaceManager,
    
    // Feature managers
    dataManager,
    storeManager,
    statusManager,
    userManager,
    languageManager,
    updateManager,
    refreshManager,
    rankingManager,
    settingsManager,
    messageManager,
    notificationManager
} from './services/index.js';

import { OrderService } from './services/api/OrderService.js';
import { i18n } from './services/i18n.js';
import { stores } from './services/stores.js';
import { STATUS_MAP } from './services/core/StatusManager.js';

// Import constants from configuration
import { INTERVALS } from './config/intervals.js';
import { API_CONFIG, getDarwinaCredentials, sendLogToPopup } from './config/api.js';

// Initialize static fields
BaseManager.initLogger = new InitLogger();

// Initialize service instances
let orderService = null;

// Add at the top with imports
const CACHE_SCHEMA = {
    data: {
        '1': 'number',
        '2': 'number',
        '3': 'number',
        'READY': 'number',
        'OVERDUE': 'number'
    },
    timestamp: 'number',
    metadata: {
        store: 'string',
        forceRefresh: 'boolean',
        total: 'number',
        originalFormat: 'object'
    }
};

// Dodaj stałą dla TTL cache'u (5 minut)
const CACHE_TTL = 5 * 60 * 1000;
// Dodaj stałą dla interwału odświeżania (1 minuta)
const REFRESH_INTERVAL = 60 * 1000;

/**
 * Initialize the application
 * @returns {Promise<void>}
 */
async function initialize() {
    try {
        // Initialize base functionality
        BaseManager.initLogger = new InitLogger();
        
        // Initialize language support first
        await i18n.init();
        
        // Initialize all managers
        const success = await initializationManager.initialize('startup');
        if (!success) {
            throw new Error('Initialization manager failed to initialize');
        }

        // Initialize store manager first
        await storeManager.initialize();
        console.log('[DEBUG] 🏪 Store manager initialized');

        // Initialize interface manager
        await interfaceManager.initialize();
        console.log('[DEBUG] 🖥️ Interface manager initialized');

        // Initialize OrderService
        const credentials = await getDarwinaCredentials();
        if (!credentials) {
            throw new Error('Failed to get DARWINA credentials');
        }

        console.log('[DEBUG] 🔑 Got credentials, initializing OrderService');
        orderService = new OrderService(credentials);

        try {
            await orderService.initialize();
            console.log('[DEBUG] ✅ OrderService initialized successfully');
        } catch (error) {
            console.error('[ERROR] ❌ OrderService initialization failed:', error);
            errorHandler.handleError(error, ErrorType.SERVICE, ErrorSeverity.HIGH, {
                method: 'initialize',
                context: 'OrderService'
            });
            throw error;
        }

        // Verify all required managers are initialized
        await verifyManagerInitialization();
        
        // Set up event listeners
        await setupEventListeners();
        
        // Update UI with current language
        await i18n.updateInterface();
        
        // Load initial data
        await loadAndUpdateData();

        // Update UI with current language
        const currentLang = languageManager.getCurrentLanguage();
        document.querySelectorAll('#language-switcher .flag-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
        
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Initialization failed:', error);
        errorHandler.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
        throw error;
    }
}

/**
 * Verify all required managers are initialized
 * @returns {Promise<void>}
 * @throws {Error} If verification fails
 */
async function verifyManagerInitialization() {
    const requiredManagers = {
        connectionManager,
        loadingManager,
        dataManager,
        errorHandler,
        debugManager,
        uiManager,
        themeManager,
        menuManager,
        statusManager
    };

    const uninitializedManagers = Object.entries(requiredManagers)
        .filter(([, manager]) => !manager?.isInitialized())
        .map(([name]) => name);

    if (uninitializedManagers.length > 0) {
        throw new Error(`Required managers not initialized: ${uninitializedManagers.join(', ')}`);
    }
}

/**
 * Set up event listeners
 * @returns {Promise<void>}
 */
async function setupEventListeners() {
    try {
        // Initialize Bootstrap tabs
        const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
        tabElements.forEach(tab => {
            new bootstrap.Tab(tab);
        });

        // Refresh button
        document.getElementById('refresh-store-data')?.addEventListener('click', async () => {
            try {
                console.log('[DEBUG] 🔄 Refresh button clicked - clearing cache and refreshing data');
                
                // Show loading state
                const refreshButton = document.getElementById('refresh-store-data');
                refreshButton.classList.add('loading');
                refreshButton.disabled = true;

                // Clear all caches first
                await orderService.clearAllCaches();
                
                // Force refresh data without modified_from limitation
                const store = await getSelectedStore();
                const params = {};
                if (store?.id !== 'ALL' && store?.deliveryId) {
                    params.delivery_id = store.deliveryId;
                }
                
                // Force refresh data
                await loadAndUpdateData(true);

                // Reset button state
                refreshButton.classList.remove('loading');
                refreshButton.disabled = false;
                
                console.log('[DEBUG] ✅ Cache cleared and data refreshed');
            } catch (error) {
                console.error('[ERROR] ❌ Refresh failed:', error);
                errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'refreshButton',
                    action: 'manual_refresh'
                });
                
                // Reset button state even on error
                const refreshButton = document.getElementById('refresh-store-data');
                if (refreshButton) {
                    refreshButton.classList.remove('loading');
                    refreshButton.disabled = false;
                }
            }
        });

        // Store selector
        const storeSelect = document.getElementById('store-select');
        if (storeSelect) {
            storeSelect.addEventListener('change', async () => {
                try {
                    progressManager.show(i18n.translate('stores.changing'));
                    await loadAndUpdateData(true);
                    progressManager.setSuccess(i18n.translate('stores.changed'));
                } catch (error) {
                    progressManager.setError(error.message || i18n.translate('errors.unknown'));
                    errorHandler.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM);
                }
            });
        }

        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('change', (event) => {
            try {
                const isDarkTheme = event.target.checked;
                themeManager.setTheme(isDarkTheme ? 'dark' : 'light', false);
            } catch (error) {
                errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'themeToggle',
                    context: error.message
                });
            }
        });

        // Debug toggle
        document.getElementById('debug-toggle')?.addEventListener('change', (event) => {
            try {
                const isDebugEnabled = event.target.checked;
                debugManager.setDebugMode(isDebugEnabled);
            } catch (error) {
                errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'debugToggle',
                    context: error.message
                });
            }
        });
    } catch (error) {
        errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
            method: 'setupEventListeners'
        });
        throw error;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initialize();
        setupAutoRefresh();
    } catch (error) {
        console.error('Initialization failed:', error);
        errorHandler.handleError(error);
    }
});

// Message Handling Functions
function showMessage(type, key) {
    uiManager.showMessage(type, key);
}

function hideMessage(type) {
    uiManager.hideMessage(type);
}

function hideAllMessages() {
    uiManager.hideAllMessages();
}

// Window Management Functions
function adjustWindowHeight() {
    uiManager.adjustWindowHeight();
}

async function resizeWindow(height) {
    await uiManager.resizeWindow(height);
}

// Load and update data
async function loadAndUpdateData(forceRefresh = false) {
    try {
        updateLoadingState(true);
        const store = await getSelectedStore();
        let data;

        if (!forceRefresh) {
            const cached = await chrome.storage.local.get([`orderCounts_${store.id}`, 'lastUpdate']);
            data = cached[`orderCounts_${store.id}`];
            const lastUpdate = cached.lastUpdate;
            
            // Sprawdź czy cache jest ważny (nie starszy niż CACHE_TTL)
            const isCacheValid = lastUpdate && (Date.now() - lastUpdate < CACHE_TTL);
            
            if (data && validateCacheData(data) && isCacheValid) {
                debugManager.log('📦 Using cached data', LogLevel.INFO);
                await updateCounters(data);
                updateLoadingState(false);
                return;
            }
            debugManager.log('🔄 Cache invalid or expired, fetching fresh data', LogLevel.INFO);
        }

        debugManager.log('🔄 Fetching fresh data from API', LogLevel.INFO);
        const response = await orderService.fetchOrders(store.id);
        
        if (response && response.counts && validateCacheData(response.counts)) {
            debugManager.log('📦 API Response:', LogLevel.DEBUG, response);
            debugManager.log('📊 Extracted counts:', LogLevel.DEBUG, response.counts);
            
            // Zapisz do cache'u z timestampem
            await chrome.storage.local.set({
                [`orderCounts_${store.id}`]: response.counts,
                lastUpdate: Date.now()
            });
            
            await updateCounters(response.counts);
        } else {
            throw new Error('Invalid data format received from API');
        }
    } catch (error) {
        debugManager.log('❌ Failed to load data:', LogLevel.ERROR, error);
        handleCounterError(error);
    } finally {
        updateLoadingState(false);
    }
}

// Helper function to calculate order counts
function calculateOrderCounts(orders) {
    // Initialize counts
    const counts = {
        '1': 0,  // SUBMITTED (Nowe)
        '2': 0,  // CONFIRMED (Potwierdzone)
        '3': 0,  // ACCEPTED (Przyjęte)
        'READY': 0,
        'OVERDUE': 0
    };

    // Log initial state
    console.log('[DEBUG] 📊 Starting count calculation for', orders.length, 'orders');

    // Process each order
    orders.forEach(order => {
        // Log order details for debugging
        console.log('[DEBUG] 📦 Processing order:', {
            id: order.order_id,
            status: order.status_id,
            statusName: order.status_name,
            date: order.date,
            orderNumber: order.order_number
        });

        const status = order.status_id?.toString();
        if (!status) {
            console.warn('[WARNING] ⚠️ Order missing status:', order.order_id);
            return;
        }

        // For READY status (5), check if it's overdue
        if (status === '5') {
            const orderDate = new Date(order.date);
            const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
            
            if (orderDate < twoWeeksAgo) {
                counts['OVERDUE']++;
                console.log(`[DEBUG] ⏳ Order ${order.order_id} (${order.order_number}) marked as OVERDUE (${order.date})`);
            } else {
                counts['READY']++;
                console.log(`[DEBUG] 📬 Order ${order.order_id} (${order.order_number}) marked as READY (${order.date})`);
            }
        } else if (['1', '2', '3'].includes(status)) {
            counts[status]++;
            console.log(`[DEBUG] 📝 Order ${order.order_id} (${order.order_number}) counted for status ${status} (${order.status_name})`);
        } else {
            console.warn(`[WARNING] ⚠️ Unhandled status ${status} for order ${order.order_id} (${order.order_number})`);
        }
    });

    // Log final counts with detailed breakdown
    console.log('[DEBUG] 📊 Final counts:', {
        calculated: counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        statusBreakdown: orders.reduce((acc, order) => {
            const status = `${order.status_id} (${order.status_name})`;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {}),
        orderNumbers: orders.map(o => o.order_number)
    });

    return counts;
}

function updateLoadingState(isLoading) {
    // Aktualizuj przycisk odświeżania
    const refreshButton = document.getElementById('refresh-store-data');
    if (refreshButton) {
        refreshButton.disabled = isLoading;
        refreshButton.innerHTML = isLoading ? 
            '<span class="spinner-border spinner-border-sm"></span>' : 
            '<i class="fas fa-sync-alt"></i>';
    }

    // Aktualizuj select sklepu
    const storeSelect = document.getElementById('store-select');
    if (storeSelect) {
        storeSelect.disabled = isLoading;
    }
}

// Counter update function (using imported STATUS_MAP)
async function updateCounters(counts) {
    try {
        debugManager.log('📊 Aktualizuję liczniki zamówień...', LogLevel.INFO);

        // Initialize all counters to 0 first
        const statusValues = Object.values(STATUS_MAP);
        statusValues.forEach(status => {
            const statusElement = document.querySelector(`.lead-status[data-status="${status.toLowerCase()}"]`);
            const counter = statusElement?.querySelector('.lead-count');
            if (counter) {
                counter.textContent = '0';
                counter.classList.add('count-zero');
                counter.classList.remove('count-error', 'count-updated');
            }
        });

        // Add overdue status handling
        const overdueElement = document.querySelector('.lead-status[data-status="overdue"]');
        const overdueCounter = overdueElement?.querySelector('.lead-count');
        if (overdueCounter) {
            overdueCounter.textContent = '0';
            overdueCounter.classList.add('count-zero');
            overdueCounter.classList.remove('count-error', 'count-updated');
        }

        // Update counters with actual values
        Object.entries(counts).forEach(([status, count]) => {
            // Find the status key by value in STATUS_MAP
            const statusKey = Object.entries(STATUS_MAP).find(([key, val]) => val === status)?.[0] || status.toLowerCase();
            const statusElement = document.querySelector(`.lead-status[data-status="${statusKey}"]`);
            const counter = statusElement?.querySelector('.lead-count');
            
            if (counter) {
                const numericCount = parseInt(count, 10);
                if (isNaN(numericCount)) {
                    debugManager.log(`⚠️ Nieprawidłowa wartość dla statusu ${statusKey}`, LogLevel.ERROR);
                    counter.textContent = '0';
                    counter.classList.add('count-error');
                    return;
                }

                counter.textContent = numericCount.toString();
                counter.classList.toggle('count-zero', numericCount === 0);
                counter.classList.remove('count-error');
                counter.classList.add('count-updated');
                setTimeout(() => counter.classList.remove('count-updated'), 1000);
            }
        });

        debugManager.log('✅ Liczniki zaktualizowane pomyślnie', LogLevel.INFO);
    } catch (error) {
        debugManager.log(`❌ Błąd aktualizacji liczników: ${error.message}`, LogLevel.ERROR);
        throw error;
    }
}

// Function to show loader in counter
function showLoader(counter) {
    counter.innerHTML = `
        <div class="loading-dots">
            <div class="loading-dots--dot"></div>
            <div class="loading-dots--dot"></div>
            <div class="loading-dots--dot"></div>
        </div>
    `;
    counter.classList.add('loading');
    counter.classList.remove('count-error', 'count-zero', 'count-updated');
}

// Function to handle counter errors
function handleCounterError(error) {
    console.error('Counter error:', error);
    debugManager.log('❌ Błąd liczników', LogLevel.ERROR, error);

        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '-';
            counter.classList.add('count-error');
        counter.classList.remove('loading', 'count-zero', 'count-updated');
    });
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

// Remove duplicate refresh button initialization
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
                console.log('[DEBUG] 🏪 Store changed to:', newStoreId);
                
                eventManager.emit('storeChanged', {
                    action: 'store_change',
                    oldStore: currentStore.id,
                    newStore: newStoreId,
                    timestamp: new Date().toISOString()
                });
                
                await storeManager.changeStore(newStoreId);
                await loadAndUpdateData(true); // Force refresh on store change
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

// Helper function to get selected store
async function getSelectedStore() {
    try {
        // Get store select element - check both possible IDs
        const storeSelect = document.getElementById('store-select') || document.getElementById('store-selector');
        if (!storeSelect) {
            console.warn('[WARNING] ⚠️ Store select element not found (tried both store-select and store-selector)');
            return { id: 'ALL', name: i18n.translate('allStores') };
        }

        // Get selected option
        const selectedOption = storeSelect.options[storeSelect.selectedIndex];
        if (!selectedOption) {
            console.warn('[WARNING] ⚠️ No store option selected');
            return { id: 'ALL', name: i18n.translate('allStores') };
        }

        // Get store ID
        const storeId = selectedOption.value;
        
        // Find store in configuration
        const store = stores.find(s => s.id === storeId);
        
        // Log selected store
        console.groupCollapsed('[DEBUG] 🏪 Selected store');
        console.dir(store, { depth: null, colors: true });
        console.groupEnd();

        return {
            id: storeId || 'ALL',
            name: selectedOption.text || i18n.translate('allStores'),
            deliveryId: store?.deliveryId
        };
    } catch (error) {
        console.error('[ERROR] ❌ Failed to get selected store:', error);
        return { id: 'ALL', name: i18n.translate('allStores') };
    }
}

// Add cache validation helper
function validateCacheData(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    // Sprawdź tylko wymagane pola dla liczników
    const requiredFields = ['1', '2', '3', 'READY', 'OVERDUE'];
    return requiredFields.every(field => 
        typeof data[field] === 'number' || 
        (typeof data[field] === 'string' && !isNaN(parseInt(data[field], 10)))
    );
}

// Update language switching
let languageChangeTimeout = null;
function handleLanguageChange(language) {
    if (languageChangeTimeout) {
        clearTimeout(languageChangeTimeout);
    }
    
    languageChangeTimeout = setTimeout(async () => {
        try {
            await i18n.changeLanguage(language);
            eventManager.emit('interface_updated');
            eventManager.emit('language_changed');
            debugManager.log(`🌍 Language changed to: ${language}`, LogLevel.INFO);
        } catch (error) {
            debugManager.log(`❌ Failed to change language: ${error.message}`, LogLevel.ERROR);
        }
    }, 300); // Debounce language changes
}

// Dodaj funkcję setupAutoRefresh
let refreshInterval = null;

function setupAutoRefresh() {
    // Wyczyść poprzedni interwał jeśli istnieje
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Ustaw nowy interwał
    refreshInterval = setInterval(async () => {
        try {
            const cached = await chrome.storage.local.get('lastUpdate');
            const lastUpdate = cached.lastUpdate;
            
            // Odśwież dane jeśli cache jest starszy niż CACHE_TTL
            if (!lastUpdate || (Date.now() - lastUpdate >= CACHE_TTL)) {
                debugManager.log('🔄 Auto-refresh: Cache expired, fetching new data', LogLevel.INFO);
                await loadAndUpdateData(true);
            }
        } catch (error) {
            debugManager.log('❌ Auto-refresh failed:', LogLevel.ERROR, error);
        }
    }, REFRESH_INTERVAL);
}

// Dodaj czyszczenie interwału przy zamknięciu
window.addEventListener('unload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

