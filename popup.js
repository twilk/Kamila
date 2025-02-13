// Import base classes
import { BaseManager } from './services/core/BaseManager.js';
import { InitLogger } from './services/core/InitLogger.js';
import { MenuManager } from './services/core/MenuManager.js';
import { CacheManager } from './services/core/CacheManager.js';
import { ErrorType, ErrorSeverity, LogLevel } from './services/core/EventType.js';

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
    initializationManager,
    userCardService,
    counterManager,
    messageManager
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

// Constants for cache and refresh
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 60 * 1000; // 1 minute

// Initialize static fields
BaseManager.initLogger = new InitLogger();

// Initialize service instances
let orderService = null;
let refreshInterval = null;

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
        
        // Load credentials first
        const credentials = await getDarwinaCredentials();
        if (!credentials?.token) {
            throw new Error('Failed to load credentials');
        }
        
        // Initialize OrderService with credentials
        orderService = new OrderService(credentials);
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
        await userCardService.initializeUserSelector();
        
        // Setup tabs
        setupTabs();
        
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

/**
 * Load and update data
 * @param {boolean} forceRefresh - Whether to force a refresh
 * @returns {Promise<void>}
 */
async function loadAndUpdateData(forceRefresh = false) {
    try {
        updateLoadingState(true);
        
        const selectedStore = await getSelectedStore();
        
        // Update store in data manager
        await dataManager.setActiveStore(selectedStore.id);
        
        // Load data with or without force refresh
        if (forceRefresh) {
            await dataManager.clearCache();
            await dataManager.loadData(true);
        } else {
            await dataManager.loadData();
        }

        // Get updated counts from data manager
        const counts = await dataManager.getOrderCounts();
        await updateCounters(counts);
        
        // Emit data updated event
        window.dispatchEvent(new CustomEvent(EVENTS.DATA_UPDATED, {
            detail: {
                store: selectedStore.id,
                counts,
                timestamp: new Date().toISOString()
            }
        }));
    } catch (error) {
        console.error('[ERROR] ❌ Load and update failed:', error);
        errorHandler.handle(error, 'Error loading data');
        handleCounterError(error);
    } finally {
        updateLoadingState(false);
    }
}

/**
 * Update counters in UI
 * @param {Object} counts - Counter values
 * @returns {Promise<void>}
 */
async function updateCounters(counts) {
    try {
        // Update counter elements
        Object.entries(counts).forEach(([status, count]) => {
            const counter = document.querySelector(`[data-status="${status}"]`);
            if (counter) {
                const countElement = counter.querySelector('.count');
                if (countElement) {
                    countElement.textContent = count;
                    counter.classList.toggle('has-items', count > 0);
                }
            }
        });

        // Update status indicators
        updateStatusIndicators(counts);
        
        // Adjust window height
        await adjustWindowHeight();
        
    } catch (error) {
        errorHandler.handle(error, 'Error updating counters');
        handleCounterError(error);
    }
}

// Event Listeners
messageManager.addListener('COUNTERS_UPDATED', async (message) => {
    const { counts, store, timestamp } = message.payload;
    const selectedStore = await getSelectedStore();
    
    if (store === selectedStore) {
        await updateCounters(counts);
    }
});

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
    // Use proper error handling
    errorHandler.handle(error, ErrorType.DATA, ErrorSeverity.MEDIUM, {
        method: 'handleCounterError',
        details: error.message
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

// Update setupAutoRefresh function
function setupAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(async () => {
        try {
            const cached = await chrome.storage.local.get('lastUpdate');
            if (!cached.lastUpdate || (Date.now() - cached.lastUpdate >= CACHE_TTL)) {
                await loadAndUpdateData(true);
            }
        } catch (error) {
            console.error('[ERROR] ❌ Auto-refresh check failed:', error);
            errorHandler?.handleError(error, 'AUTO_REFRESH_ERROR');
        }
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

// Initialize OrderService and fetch data
async function initializeAndFetchData() {
    try {
        const credentials = await getDarwinaCredentials();
        if (!credentials?.token) {
            throw new Error('No API token available');
        }
        
        orderService = new OrderService(credentials);
        await orderService.initialize();
        
        // Force refresh on first load
        const result = await orderService.fetchOrders('ALL', { forceRefresh: true });
        
        // Setup refresh interval
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        
        refreshInterval = setInterval(async () => {
            try {
                await orderService.fetchOrders('ALL');
            } catch (error) {
                console.error('Error refreshing data:', error);
            }
        }, REFRESH_INTERVAL);
        
        return result;
    } catch (error) {
        console.error('Failed to initialize OrderService:', error);
        throw error;
    }
}

// Call initialization when popup opens
document.addEventListener('DOMContentLoaded', () => {
    initializeAndFetchData()
        .then(result => {
            console.log('Initial data fetch completed:', result);
        })
        .catch(error => {
            console.error('Error during initialization:', error);
        });
});

// Add this after the other event listeners in setupEventListeners function
function setupTabs() {
    const menu = document.querySelector('.menu');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    menu.addEventListener('click', (event) => {
        event.preventDefault();
        const link = event.target.closest('.link');
        if (!link) return;

        // Remove active class from all links and panes
        document.querySelectorAll('.link').forEach(l => l.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));

        // Add active class to clicked link and corresponding pane
        link.classList.add('active');
        const targetId = link.getAttribute('data-target');
        document.getElementById(targetId)?.classList.add('active');

        // Emit tab change event
        window.dispatchEvent(new CustomEvent(EVENTS.TAB_CHANGED, {
            detail: {
                tab: targetId,
                timestamp: new Date().toISOString()
            }
        }));
    });
}

