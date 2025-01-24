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

// Import constants from configuration
import { INTERVALS } from './config/intervals.js';
import { STATUS_MAP } from './services/core/StatusManager.js';
import { API_CONFIG, getDarwinaCredentials, sendLogToPopup } from './config/api.js';

// Initialize static fields
BaseManager.initLogger = new InitLogger();

// Initialize services
let orderService = null;

/**
 * Initialize the application
 * @returns {Promise<void>}
 */
async function initialize() {
    try {
        // Initialize base functionality
        BaseManager.initLogger = new InitLogger();
        
        // Initialize all managers
        const success = await initializationManager.initialize('startup');
        if (!success) {
            throw new Error('Initialization manager failed to initialize');
        }

        // Verify all required managers are initialized
        await verifyManagerInitialization();
        
        // Set up event listeners
        await setupEventListeners();
        
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('[ERROR] ❌ Initialization failed:', error);
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
document.addEventListener('DOMContentLoaded', initialize);

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

            // Log API request details
            console.log('[DEBUG] 🔍 API Request Details:', {
                baseUrl: API_CONFIG.DARWINA.BASE_URL,
                endpoint: API_CONFIG.DARWINA.ENDPOINTS.ORDERS,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${credentials.token}`,
                    'Content-Type': 'application/json'
                },
                storeId: currentStore.id
            });
            
            // Initialize or reinitialize OrderService with fresh credentials
            if (!orderService) {
                orderService = new OrderService(credentials);
                await orderService.initialize();
            } else {
                // Update credentials if service exists
                orderService.updateCredentials(credentials);
            }
            
            // Fetch orders
            const orders = await orderService.fetchOrders(currentStore);
            if (!orders) {
                throw new Error('Failed to fetch orders');
            }

            // Calculate counts
            const counts = calculateOrderCounts(orders);

            // Save new data
            data = {
                orders,
                counts,
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

// Helper function to calculate order counts
function calculateOrderCounts(orders) {
    const counts = {
        '1': 0,  // SUBMITTED
        '2': 0,  // CONFIRMED
        '3': 0,  // ACCEPTED
        'READY': 0,
        'OVERDUE': 0
    };

    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

    orders.forEach(order => {
        const status = order.status_id?.toString();
        if (!status) return;

        // For READY status, check if it's overdue
        if (status === '5') {
            const readyDate = order.ready_date || order.status_change_date || order.modified_at;
            if (readyDate) {
                const orderDate = new Date(readyDate.replace(' ', 'T'));
                if (orderDate < twoWeeksAgo) {
                    counts['OVERDUE']++;
                } else {
                    counts['READY']++;
                }
            }
        } else if (['1', '2', '3'].includes(status)) {
            counts[status]++;
        }
    });

    return counts;
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

