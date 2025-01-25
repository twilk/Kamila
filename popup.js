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
        
        // Initialize language support first
        await i18n.init();
        await languageManager.initialize();
        
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
                console.log('[DEBUG] 🔄 Refresh button clicked - starting data refresh');
                
                // Show loading state
                const refreshButton = document.getElementById('refresh-button');
                refreshButton.classList.add('loading');
                refreshButton.disabled = true;

                // Log the action
                eventManager.emit('refreshData', {
                    action: 'manual_refresh',
                    timestamp: new Date().toISOString(),
                    source: 'refresh_button'
                });

                // Force refresh data
                await loadAndUpdateData(true);

                // Reset button state
                refreshButton.classList.remove('loading');
                refreshButton.disabled = false;
                
                console.log('[DEBUG] ✅ Data refresh completed');
            } catch (error) {
                console.error('[ERROR] ❌ Refresh failed:', error);
                errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'refreshButton',
                    action: 'manual_refresh'
                });
                
                // Reset button state even on error
                const refreshButton = document.getElementById('refresh-button');
                if (refreshButton) {
                    refreshButton.classList.remove('loading');
                    refreshButton.disabled = false;
                }
            }
        });

        // Store selector
        document.getElementById('store-select')?.addEventListener('change', async (event) => {
            try {
                const oldStore = await getSelectedStore();
                const newStore = event.target.value;
                
                console.log('[DEBUG] 🏪 Store change initiated:', JSON.stringify({
                    from: oldStore.id,
                    to: newStore,
                    timestamp: new Date().toISOString()
                }, null, 2));

                // Show loading state
                progressManager.show(i18n.translate('orders.counters.updating'));
                
                // Change store
                await storeManager.changeStore(newStore);
                
                // Force refresh data
                await loadAndUpdateData(true);
                
                // Show success message
                progressManager.setSuccess(i18n.translate('logs.storeChanged', { store: newStore }));
                
                console.log('[DEBUG] ✅ Store changed successfully');
            } catch (error) {
                console.error('[ERROR] ❌ Store change failed:', error);
                progressManager.setError(i18n.translate('errors.unknown'));
                
                errorHandler?.handleError(error, ErrorType.UI, ErrorSeverity.WARNING, {
                    method: 'storeSelect',
                    context: 'changeStore'
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
        // Show loading state in counters
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '...';
            counter.classList.remove('count-error', 'count-zero', 'count-changed');
        });

        // Check if orderService is initialized
        if (!orderService) {
            throw new Error('OrderService not initialized');
        }

        // Get current timestamp
        const now = Date.now();

        // Try to get data from cache first
        const cached = await chrome.storage.local.get(['orderCounts', 'lastUpdate']);
        const lastUpdate = cached.lastUpdate || 0;
        const hasCachedData = cached.orderCounts?.data && typeof cached.orderCounts.data === 'object';

        let currentCounts = null;

        // If we have cached data, use it immediately
        if (hasCachedData) {
            currentCounts = cached.orderCounts.data;
            console.log('[DEBUG] 📦 Using cached data:', JSON.stringify({
                data: currentCounts,
                timestamp: new Date(cached.orderCounts.timestamp).toISOString(),
                age: Math.floor((now - cached.orderCounts.timestamp) / 1000) + 's',
                metadata: cached.orderCounts.metadata
            }, null, 2));
            
            // Update UI with cached data
            await updateCounters(currentCounts, currentCounts);
        }

        // Check if we need to fetch new data
        const shouldFetchNewData = forceRefresh || !hasCachedData || (now - lastUpdate >= 300000);
        
        if (shouldFetchNewData) {
            // Show progress only if we're fetching new data
            progressManager.show(i18n.translate('orders.counters.updating'));

            // Get selected store
            const store = await getSelectedStore();
            
            // Prepare request parameters
            const params = {};
            if (store.id !== 'ALL' && store.deliveryId) {
                params.delivery_id = store.deliveryId;
            }
            
            // Only include modified_from if we have valid cached data and it's not a force refresh
            if (hasCachedData && !forceRefresh) {
                params.modified_from = new Date(lastUpdate).toISOString();
            }

            // Log request details
            console.log('[DEBUG] 🔄 Fetching orders:', JSON.stringify({
                store,
                params,
                lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
                forceRefresh
            }, null, 2));

            // Fetch orders from API
            const response = await orderService.fetchOrders(store.id, params);
            
            // Log raw response
            console.log('[DEBUG] 📥 Raw API response:', JSON.stringify(response, null, 2));

            // Validate response
            if (!response || !response.orders) {
                throw new Error('Invalid API response format');
            }

            // Use pre-calculated counts from API if available, otherwise calculate them
            const newCounts = response.counts || calculateOrderCounts(response.orders);

            // Log processed counts
            console.log('[DEBUG] 📊 Processed counts:', JSON.stringify({
                apiCounts: response.counts,
                calculatedCounts: newCounts,
                metadata: response.metadata
            }, null, 2));

            // Update UI with new counts, comparing with previous counts
            await updateCounters(newCounts, currentCounts || {});

            // Show success message
            progressManager.setSuccess(i18n.translate('orders.counters.updated'));

            // Cache the data and update timestamp
            const cacheData = {
                'orderCounts': {
                    data: newCounts,
                    timestamp: now,
                    storeId: store.id,
                    metadata: response.metadata,
                    orders: response.orders
                },
                'lastUpdate': now
            };

            await chrome.storage.local.set(cacheData);
            currentCounts = newCounts;

            // Log cache update
            console.log('[DEBUG] 💾 Updated cache with new data:', JSON.stringify({
                counts: newCounts,
                metadata: response.metadata,
                timestamp: new Date(now).toISOString(),
                storeId: store.id,
                ordersCount: response.orders.length
            }, null, 2));
        }

        return currentCounts;
    } catch (error) {
        // Log error details
        console.error('[ERROR] ❌ Failed to load data:', {
            message: error.message || 'Unknown error',
            stack: error.stack,
            error: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });

        // Show error message using the correct method
        progressManager.setError(
            error.message || i18n.translate('errors.unknown')
        );

        // Handle error with error handler
        errorHandler.handleError(error, ErrorType.DATA, ErrorSeverity.HIGH, {
            method: 'loadAndUpdateData',
            context: 'fetchOrders'
        });

        // Try to load cached data
        try {
            const cached = await chrome.storage.local.get('orderCounts');
            if (cached.orderCounts?.data && typeof cached.orderCounts.data === 'object') {
                console.log('[DEBUG] 📦 Using cached data as fallback:', JSON.stringify({
                    data: cached.orderCounts.data,
                    timestamp: new Date(cached.orderCounts.timestamp).toISOString(),
                    metadata: cached.orderCounts.metadata
                }, null, 2));
                await updateCounters(cached.orderCounts.data, cached.orderCounts.data);
                return cached.orderCounts.data;
            } else {
                console.warn('[WARNING] ⚠️ No valid cached data available');
                // Show error in counters
                document.querySelectorAll('.lead-count').forEach(counter => {
                    counter.textContent = '-';
                    counter.classList.add('count-error');
                });
                return null;
            }
        } catch (cacheError) {
            console.error('[ERROR] ❌ Failed to load cached data:', JSON.stringify(cacheError, Object.getOwnPropertyNames(cacheError)));
            return null;
        }
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
    const refreshButton = document.getElementById('refresh-store-data');
    if (refreshButton) {
        refreshButton.disabled = isLoading;
        refreshButton.innerHTML = isLoading ? 
            '<span class="spinner-border spinner-border-sm"></span>' : 
            '<i class="fas fa-sync-alt"></i>';
    }
}

// Update counters in UI with proper translations
async function updateCounters(counts, oldCounts = {}) {
    try {
        // Map status codes to element IDs and their translations
        const statusMap = {
            '1': { 
                id: 'count-1', 
                translation: 'leadStatuses.submitted',
                elementStatus: 'submitted',
                tooltip: 'tooltips.leadStatuses.submitted',
                indicator: 'newOrders',
                icon: '📤',
                notify: true  // Notify on changes for new orders
            },
            '2': { 
                id: 'count-2', 
                translation: 'leadStatuses.confirmed',
                elementStatus: 'confirmed',
                tooltip: 'tooltips.leadStatuses.confirmed',
                indicator: 'confirmedOrders',
                icon: '✅',
                notify: true  // Notify on changes for confirmed orders
            },
            '3': { 
                id: 'count-3', 
                translation: 'leadStatuses.accepted',
                elementStatus: 'accepted',
                tooltip: 'tooltips.leadStatuses.accepted',
                indicator: 'acceptedOrders',
                icon: '📦'
            },
            'READY': { 
                id: 'count-ready', 
                translation: 'leadStatuses.ready',
                elementStatus: 'ready',
                tooltip: 'tooltips.leadStatuses.ready',
                indicator: 'readyOrders',
                icon: '📬'
            },
            'OVERDUE': { 
                id: 'count-overdue', 
                translation: 'leadStatuses.overdue',
                elementStatus: 'overdue',
                tooltip: 'tooltips.leadStatuses.overdue',
                indicator: 'overdueOrders',
                icon: '⏳'
            }
        };

        // Log counts before update
        console.log('[DEBUG] 📊 Updating counters:', JSON.stringify({
            newCounts: counts,
            oldCounts: oldCounts,
            changes: Object.entries(counts).reduce((acc, [status, count]) => {
                acc[status] = {
                    from: oldCounts[status] || 0,
                    to: count,
                    diff: count - (oldCounts[status] || 0)
                };
                return acc;
            }, {})
        }, null, 2));

        // Update each counter
        for (const [status, count] of Object.entries(counts)) {
            const statusInfo = statusMap[status];
            if (!statusInfo) {
                console.warn(`[WARNING] ⚠️ Unknown status: ${status}`);
                continue;
            }

            const countElement = document.getElementById(statusInfo.id);
            if (countElement) {
                const oldCount = oldCounts[status] || 0;
                const hasChanged = count !== oldCount;
                
                // Update counter value
                countElement.textContent = count;
                countElement.classList.toggle('count-zero', count === 0);
                
                // Add change animation if value changed
                if (hasChanged) {
                    countElement.classList.remove('count-changed');
                    // Force reflow
                    void countElement.offsetWidth;
                    countElement.classList.add('count-changed');
                    setTimeout(() => countElement.classList.remove('count-changed'), 1000);
                }

                // Show notification for significant changes in status 1 or 2
                if (statusInfo.notify && count > oldCount) {
                    await notificationManager.showStatusNotification(
                        statusInfo.elementStatus,
                        oldCount,
                        count
                    );
                }

                // Update tooltip
                countElement.title = i18n.translate(statusInfo.tooltip);
            } else {
                console.warn(`[WARNING] ⚠️ Counter element not found: ${statusInfo.id}`);
            }

            // Update status indicator
            const indicator = document.querySelector(`.status-indicator.${statusInfo.indicator}`);
            if (indicator) {
                indicator.classList.toggle('active', count > 0);
            }

            // Update parent status element
            const statusElement = document.querySelector(`.lead-status[data-status="${statusInfo.elementStatus}"]`);
            if (statusElement) {
                statusElement.classList.toggle('has-items', count > 0);
                
                // Update status label with translation and icon
                const labelElement = statusElement.querySelector('.status-label');
                if (labelElement) {
                    labelElement.textContent = `${statusInfo.icon} ${i18n.translate(statusInfo.translation)}`;
                    labelElement.title = i18n.translate(statusInfo.tooltip);
                }
            }
        }

        // Update total count
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const totalElement = document.getElementById('total-count');
        if (totalElement) {
            const oldTotal = Object.values(oldCounts).reduce((sum, count) => sum + count, 0);
            const hasChanged = total !== oldTotal;

            totalElement.textContent = total;
            totalElement.classList.toggle('count-zero', total === 0);
            
            // Add change animation if total changed
            if (hasChanged) {
                totalElement.classList.remove('count-changed');
                // Force reflow
                void totalElement.offsetWidth;
                totalElement.classList.add('count-changed');
                setTimeout(() => totalElement.classList.remove('count-changed'), 1000);
            }
        }

        // Log final state
        console.log('[DEBUG] ✅ Counters updated successfully:', JSON.stringify({
            total,
            counts,
            indicators: Object.entries(statusMap).reduce((acc, [status, info]) => {
                acc[info.indicator] = counts[status] > 0;
                return acc;
            }, {})
        }, null, 2));

    } catch (error) {
        console.error('[ERROR] ❌ Failed to update counters:', error);
        document.querySelectorAll('.lead-count').forEach(counter => {
            counter.textContent = '-';
            counter.classList.add('count-error');
        });
        
        errorHandler.handleError(error, ErrorType.UI, ErrorSeverity.HIGH, {
            method: 'updateCounters',
            context: {
                counts,
                oldCounts
            }
        });
    }
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
        console.log('[DEBUG] 🏪 Selected store:', JSON.stringify({
            id: storeId,
            name: selectedOption.text,
            deliveryId: store?.deliveryId,
            index: storeSelect.selectedIndex,
            config: store ? {
                id: store.id,
                name: store.name,
                deliveryId: store.deliveryId,
                drwn: store.drwn
            } : null
        }, null, 2));

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

