// Import base classes
import { BaseManager } from './services/core/BaseManager.js';
import { InitLogger } from './services/core/InitLogger.js';
import { MenuManager } from './services/core/MenuManager.js';
import { CacheManager } from './services/core/CacheManager.js';

// Import all necessary services from central point
import {
    managers,
    errorHandler,
    menuManager,
    loadingManager,
    dataManager,
    uiManager,
    debugManager,
    themeManager,
    operationProgressManager,
    statusManager,
    apiManager,
    OrderService,
    i18n,
    stores,
    EventType,
    ErrorType,
    ErrorSeverity,
    initializationManager,
    UserCardService
} from './services/index.js';

// Import constants from configuration
import { INTERVALS } from './config/intervals.js';
import { API_CONFIG, getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { STATUS_MAP } from './services/core/StatusManager.js';

// Add EVENTS constant
const EVENTS = {
    TAB_CHANGED: 'menu:tabChanged',
    TAB_SHOW: 'menu:tabShow',
    MENU_READY: 'menu:ready',
    STORE_CHANGED: 'menu:storeChanged',
    DATA_UPDATED: 'menu:dataUpdated'
};

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

// Dodaj na początku pliku
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function initializeWithRetry(attempt = 1) {
    try {
        console.log('[DEBUG] 🚀 Starting initialization (attempt ' + attempt + '/' + MAX_RETRIES + ')');
        
        // Verify managers are available
        if (!managers || !managers.initializationManager) {
            throw new Error('Required managers not available: ' + 
                (!managers ? 'managers object missing' : 'initializationManager missing'));
        }

        // Initialize managers through initialization manager
        await managers.initializationManager.initialize();
        
        // Initialize OrderService
        orderService = new OrderService();
        await orderService.initialize();
        
        // Setup UI and events
        await setupEventListeners();
        setupAutoRefresh();

        console.log('[DEBUG] ✅ Initialization complete');
        
    } catch (error) {
        console.error(`[ERROR] ❌ Initialization failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
        
        if (attempt < MAX_RETRIES) {
            console.log(`[INFO] 🔄 Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return initializeWithRetry(attempt + 1);
        }
        throw error;
    }
}

async function checkBackgroundConnection() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'PING' });
        return response?.status === 'OK';
    } catch {
        return false;
    }
}

async function getCredentials() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS' });
        return response?.credentials;
    } catch {
        return null;
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
        // Wait for UI and Theme managers to be ready first
        await Promise.all([
            uiManager.waitForReady(),
            themeManager.waitForReady()
        ]);

        // Then wait for menu manager
        await menuManager.waitForReady();
        
        // Initialize user selector
        const userCardService = new UserCardService();
        await userCardService.initializeUserSelector();
        
        // Now setup other event listeners
        document.getElementById('refresh-store-data')?.addEventListener('click', async () => {
            try {
                console.log('[DEBUG] 🔄 Refresh button clicked - clearing cache and refreshing data');
                
                // Show loading state
                const refreshButton = document.getElementById('refresh-store-data');
                refreshButton.classList.add('loading');
                refreshButton.disabled = true;

                // Clear all caches first
                await orderService.clearAllCaches();
                
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
        console.error('[ERROR] ❌ Failed to setup event listeners:', error);
        errorHandler?.handleError(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH, {
            method: 'setupEventListeners'
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeWithRetry();
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
        if (loadAndUpdateData.isRunning) {
            console.log('[DEBUG] 🔄 Update already in progress, skipping');
            return;
        }
        
        loadAndUpdateData.isRunning = true;
        updateLoadingState(true);

        const store = await getSelectedStore();
        const menuManager = MenuManager.getInstance();
        await menuManager.waitForReady();

        if (!forceRefresh) {
            const cached = await chrome.storage.local.get([`orderCounts_${store.id}`, 'lastUpdate']);
            const data = cached[`orderCounts_${store.id}`];
            const lastUpdate = cached.lastUpdate;
            
            if (data && validateCacheData(data) && lastUpdate && (Date.now() - lastUpdate < CACHE_TTL)) {
                await updateCounters(data);
                return;
            }
        }

        // Request data update from background
        chrome.runtime.sendMessage({
            type: 'REQUEST_DATA_UPDATE',
            data: { storeId: store.id, forceRefresh }
        });

    } catch (error) {
        console.error('[ERROR] ❌ Failed to load data:', error);
        handleCounterError(error);
    } finally {
        loadAndUpdateData.isRunning = false;
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
        const storeSelector = document.getElementById('store-select') || document.getElementById('store-selector');
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
                try {
                    const menuManager = MenuManager.getInstance();
                    await menuManager.waitForReady();
                    
                    const newStoreId = event.target.value;
                    operationProgressManager.show(i18n.translate('stores.changing'));
                    
                    // Emit store change event through MenuManager
                    window.dispatchEvent(new CustomEvent(EVENTS.STORE_CHANGED, {
                        detail: {
                            previousStore: storeSelector.dataset.previousValue,
                            currentStore: newStoreId,
                            timestamp: new Date().toISOString()
                        }
                    }));
                    
                    // Update store in managers
                    await menuManager.setActiveStore(newStoreId);
                    await storeManager.changeStore(newStoreId);
                    
                    // Update data
                    await loadAndUpdateData(true);
                    
                    // Save current value for next change
                    storeSelector.dataset.previousValue = newStoreId;
                    
                    operationProgressManager.setSuccess(i18n.translate('stores.changed'));
                } catch (error) {
                    operationProgressManager.setError(error.message || i18n.translate('errors.unknown'));
                    errorHandler.handleError(error, ErrorType.UI, ErrorSeverity.MEDIUM);
                }
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
        const menuManager = MenuManager.getInstance();
        await menuManager.waitForReady();
        
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
        
        // Update active store in MenuManager
        await menuManager.setActiveStore(storeId);
        
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
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
        const lastUpdate = chrome.storage.local.get('lastUpdate')
            .then(cached => {
                if (!cached.lastUpdate || (Date.now() - cached.lastUpdate >= CACHE_TTL)) {
                    loadAndUpdateData(true);
                }
            })
            .catch(error => console.error('[ERROR] ❌ Auto-refresh check failed:', error));
    }, REFRESH_INTERVAL);
}

// Dodaj czyszczenie interwału przy zamknięciu
window.addEventListener('unload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Add message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.type === 'DATA_UPDATED') {
            const { counts, storeId } = message.data;
            if (counts && validateCacheData(counts)) {
                updateCounters(counts);
            }
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('[ERROR] ❌ Failed to handle message:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
});

