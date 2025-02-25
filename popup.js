// Import base classes and core functionality
import { BaseManager } from './services/core/BaseManager.js';
import { InitLogger } from './services/core/InitLogger.js';
import { ManagerRegistry } from './services/core/managers.js';

// Import all managers
import { ErrorHandler } from './services/core/ErrorHandler.js';
import { EventManager } from './services/core/EventManager.js';
import { LogManager } from './services/core/LogManager.js';
import { StorageManager } from './services/core/StorageManager.js';
import { InitialLoadingManager } from './services/core/LoadingManager.js';
import { ConnectionManager } from './services/core/ConnectionManager.js';
import { CacheManager } from './services/core/CacheManager.js';
import { UIManager } from './services/core/UIManager.js';
import { ThemeManager } from './services/core/ThemeManager.js';
import { MenuManager } from './services/core/MenuManager.js';
import { NotificationManager } from './services/core/NotificationManager.js';
import { DebugManager } from './services/core/DebugManager.js';
import { VolumeManager } from './services/core/VolumeManager.js';
import { UpdateManager } from './services/core/UpdateManager.js';
import { DataManager } from './services/core/DataManager.js';
import { StoreManager } from './services/core/StoreManager.js';
import { StatusManager } from './services/core/StatusManager.js';
import { UserManager } from './services/core/UserManager.js';
import { LanguageManager } from './services/core/LanguageManager.js';
import { SettingsManager } from './services/core/SettingsManager.js';
import { MessageManager } from './services/core/MessageManager.js';
import { OperationProgressManager } from './services/core/OperationProgressManager.js';
import { InterfaceManager } from './services/core/InterfaceManager.js';
import { AlarmManager } from './services/core/AlarmManager.js';
import { CounterManager } from './services/core/CounterManager.js';
import { OrderService, createOrderService } from './services/api/OrderService.js';
import { APIManager } from './services/core/APIManager.js';
import { UserCardService } from './services/userCard.js';
import { RefreshManager } from './services/core/RefreshManager.js';

// Import types and constants
import { ErrorType, ErrorSeverity, LogLevel } from './services/core/EventType.js';
import { STATUS_MAP } from './services/core/StatusManager.js';
import { INTERVALS } from './config/intervals.js';
import { API_CONFIG, getDarwinaCredentials, sendLogToPopup } from './config/api.js';
import { stores } from './services/stores.js';

// Core events
const EVENTS = {
    STORE_CHANGED: 'store:change',
    COUNTERS_UPDATED: 'counters:updated',
    ERROR_OCCURRED: 'error:occurred',
    TAB_CHANGED: 'tab:changed'
};

// Constants for cache and refresh
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 60 * 1000; // 1 minute

// Initialize static fields and core managers
BaseManager.initLogger = new InitLogger();

// Create registry instance
const registry = ManagerRegistry.getInstance();

// Global manager instances
let managerInstances = null;

// Define manager registration map
const MANAGERS = [
    ['error', ErrorHandler],
    ['event', EventManager],
    ['log', LogManager],
    ['storage', StorageManager],
    ['loading', InitialLoadingManager],
    ['connection', ConnectionManager],
    ['cache', CacheManager],
    ['api', APIManager],
    ['store', StoreManager],
    ['order', createOrderService],
    ['data', DataManager],
    ['status', StatusManager],
    ['theme', ThemeManager],
    ['ui', UIManager],
    ['menu', MenuManager],
    ['notification', NotificationManager],
    ['debug', DebugManager],
    ['volume', VolumeManager],
    ['update', UpdateManager],
    ['refresh', RefreshManager],
    ['user', UserManager],
    ['language', LanguageManager],
    ['settings', SettingsManager],
    ['message', MessageManager],
    ['progress', OperationProgressManager],
    ['interface', InterfaceManager],
    ['alarm', AlarmManager],
    ['counter', CounterManager],
    ['userCard', UserCardService]
];

// Set registry for all managers
for (const [, Manager] of MANAGERS) {
    if (typeof Manager.setRegistry === 'function') {
        Manager.setRegistry(registry);
    } else {
        console.warn(`Manager ${Manager.name} doesn't have setRegistry method`);
    }
}

// Register all managers
for (const [name, Manager] of MANAGERS) {
    if (name === 'order') {
        registry.register(name, (registry) => {
            if (!OrderService._registry) {
                OrderService.setRegistry(registry);
            }
            return new OrderService(registry);
        });
    } else {
    registry.register(name, Manager);
    }
}

/**
 * Initialize all managers and setup the application
 * @returns {Promise<Object>} Initialized manager instances
 */
async function initializeManagers() {
    console.log('🚀 Starting manager initialization...');
    
    try {
        // Initialize in correct dependency order
        const initOrder = [
            ['error'],    // No dependencies
            ['log'],      // Depends on error
            ['event'],    // Depends on error
            ['storage'],  // Depends on error, log, event
            ['store'],    // Depends on storage
            ['cache'],    // Depends on store
            ['api'],      // Depends on error, cache, event
            ['order'],    // Depends on storage, api, error
            ['data'],     // Depends on store, api, cache, order
            ['status'],   // Depends on store, data
            ['language'], // Depends on event
            ['theme'],    // Depends on storage
            ['refresh'],  // Depends on event, order
            ['alarm'],    // Depends on event, order, storage
            ['ui'],       // Depends on theme, refresh
            ['settings'], // Depends on storage
            ['notification'], // Depends on event, storage, language
            ['loading', 'connection', 'menu',
             'debug', 'volume', 'update', 'user',
             'message', 'progress', 'interface', 'counter', 'usercard']
        ];
        
        // Initialize managers in sequence
        for (const group of initOrder) {
            console.log(`🔄 Initializing group:`, group);
            await Promise.all(group.map(async (name) => {
                try {
                    console.log(`⚡ Initializing manager: ${name}`);
                    const manager = await registry.get(name);
                    if (!manager) {
                        throw new Error(`Manager ${name} not found in registry`);
                    }
                    if (!manager?.isInitialized()) {
                        await manager.initialize();
                    }
                    console.log(`✅ Initialized ${name}`);
                } catch (error) {
                    console.error(`❌ Failed to initialize ${name}:`, error);
                    throw error;
                }
            }));
            console.log(`✅ Group initialized:`, group);
        }
        
        // Create manager instances object
        const instances = {};
        for (const [name] of MANAGERS) {
            try {
                instances[name] = await registry.get(name);
            } catch (error) {
                console.error(`❌ Failed to get manager instance: ${name}`, error);
            }
        }
        
        // Print initialization report
        const report = registry.printInitializationReport();
        
        if (report.failed.length === 0) {
            console.log('✅ All managers initialized successfully');
        } else {
            console.error(`❌ ${report.failed.length} managers failed to initialize:`, report.failed.join(', '));
        }
        
        managerInstances = instances;
        
        if (report.failed.length > 0) {
            throw new Error(`Failed to initialize managers: ${report.failed.join(', ')}`);
        }
        
        return instances;
    } catch (error) {
        console.error('❌ Manager initialization failed:', error);
        registry.printInitializationReport();
        throw error;
    }
}

/**
 * Check if all required managers are initialized
 * @param {Object} instances Manager instances
 * @returns {boolean} True if all required managers are initialized
 */
function areManagersReady(instances) {
    const required = ['event', 'data', 'counter', 'ui'];
    const missing = required.filter(name => !instances[name]?.isInitialized());
    
    if (missing.length > 0) {
        console.log('⏳ Waiting for managers:', missing.join(', '));
        return false;
    }
    
    return true;
}

// Setup event listeners
async function setupEventListeners(instances) {
    if (!areManagersReady(instances)) {
        throw new Error('Required managers not ready');
    }

    const eventManager = await registry.get('event');
    const dataManager = await registry.get('data');
    const uiManager = await registry.get('ui');

    // Setup refresh button
    const refreshButton = document.getElementById('refresh-store-data');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            try {
                refreshButton.disabled = true;
                const interfaceManager = await registry.get('interface');
                await interfaceManager.showLoading();
                await dataManager.refreshData({ forceRefresh: true });
            } catch (error) {
                eventManager.emit(EVENTS.ERROR_OCCURRED, error);
            } finally {
                refreshButton.disabled = false;
                const interfaceManager = await registry.get('interface');
                await interfaceManager.hideLoading();
            }
        });
    }

    // Setup store selector
    const storeSelect = document.getElementById('store-select');
    if (storeSelect) {
        storeSelect.addEventListener('change', async () => {
            try {
                const storeId = storeSelect.value;
                await eventManager.emit(EVENTS.STORE_CHANGED, { storeId });
            } catch (error) {
                eventManager.emit(EVENTS.ERROR_OCCURRED, error);
            }
        });
    }

    // Setup tab navigation
    const tabLinks = document.querySelectorAll('.nav-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', async () => {
            const targetId = link.getAttribute('data-target');
            await eventManager.emit(EVENTS.TAB_CHANGED, { tabId: targetId });
        });
    });

    // Setup error handling
    eventManager.on(EVENTS.ERROR_OCCURRED, async (error) => {
        try {
            if (uiManager?.isInitialized()) {
                await uiManager.showMessage('error', error.message || 'An unexpected error occurred');
            } else {
                console.error('UIManager not initialized:', error);
            }
        } catch (e) {
            console.error('Failed to show error:', e);
        }
    });
}

// Store previous counts for animation
let previousCounts = {
    untouched: 0,
    called: 0,
    ready: 0,
    overdue: 0,
    critical: 0
};

/**
 * Update counters in UI
 * @param {Object} [counts] Optional counts to update directly
 * @returns {Promise<void>}
 */
async function updateCounters(counts) {
    try {
        // Show loading state
        document.querySelectorAll('.lead-status').forEach(status => {
            status.classList.add('loading');
        });

        // If counts not provided, fetch them
        if (!counts) {
            const orderService = await registry.get('order');
            const result = await orderService.getOrderStatuses();
            if (!result.success) {
                throw new Error(result.error);
            }
            counts = result.counts;
        }

        // Update each counter element
        const counterElements = {
            'count-untouched': counts.untouched || 0,
            'count-called': counts.called || 0,
            'count-ready': counts.ready || 0,
            'count-overdue': counts.overdue || 0,
            'count-critical': counts.critical || 0
        };

        const counterManager = await registry.get('counter');
        
        // Update each counter
        for (const [id, value] of Object.entries(counterElements)) {
            const element = document.getElementById(id);
            if (element) {
                // Register counter if not already registered
                await counterManager.registerCounter(element, value);
                // Update counter value with animation
                await counterManager.updateCounter(id, value, true);
            }
        }
        
        // Store current counts for next update
        previousCounts = { ...counts };
        
        // Update last refresh time
        const lastUpdateTime = document.getElementById('last-update-time');
        if (lastUpdateTime) {
            const now = new Date();
            lastUpdateTime.textContent = now.toLocaleTimeString();
            lastUpdateTime.setAttribute('datetime', now.toISOString());
        }

        // Emit counters updated event
        const eventManager = await registry.get('event');
        await eventManager.emit(EVENTS.COUNTERS_UPDATED, {
            counts,
            timestamp: Date.now()
        });

        // Log update
        console.log('✅ Updated all counters:', counts);
    } catch (error) {
        console.error('Error updating counters:', error);
        document.querySelectorAll('.lead-status').forEach(status => {
            status.classList.add('error');
        });

        // Emit error event
        const eventManager = await registry.get('event');
        await eventManager.emit(EVENTS.ERROR_OCCURRED, error);
    } finally {
        // Remove loading state
        document.querySelectorAll('.lead-status').forEach(status => {
            status.classList.remove('loading');
        });
    }
}

/**
 * Initialize click handlers and UI elements
 */
async function initializeUI() {
    // Refresh button
    const refreshButton = document.getElementById('refresh-counters');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refreshButton.classList.add('rotating');
            updateCounters().finally(() => {
                refreshButton.classList.remove('rotating');
            });
        });
    }

    // Status links
    document.querySelectorAll('.lead-status').forEach(status => {
        status.addEventListener('click', async () => {
            const statusType = status.dataset.status;
            if (statusType) {
                try {
                    // Get current store
                    const storeManager = await registry.get('store');
                    const store = await storeManager.getActiveStore();
                    const storeId = store?.id === 'ALL' ? '0' : store?.deliveryId?.toString() || '0';
                    
                    // Generate and open DARWINA URL
                    const interfaceManager = await registry.get('interface');
                    const url = interfaceManager.generateDarwinaUrl(statusType, storeId);
                    window.open(url, '_blank');
                } catch (error) {
                    console.error('Error opening DARWINA:', error);
                    const notificationManager = await registry.get('notification');
                    await notificationManager.show('Error', 'Could not open DARWINA', { type: 'error' });
                }
            }
        });
    });

    // Initial update
    await updateCounters();

    // Set up periodic refresh
    setInterval(updateCounters, REFRESH_INTERVAL);
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const instances = await initializeManagers();
        await setupEventListeners(instances);
        await initializeUI();
        
        // Initial data load
        const dataManager = await registry.get('data');
        await dataManager.refreshData({ forceRefresh: true });

        // Setup auto refresh
        setupAutoRefresh();

    } catch (error) {
        console.error('❌ Initialization failed:', error);
        const errorHandler = await registry.get('error');
        errorHandler?.handle(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
    }
});

// Message Handling Functions
async function showMessage(type, key) {
    try {
        const languageManager = await registry.get('language');
        const uiManager = await registry.get('ui');
        
        if (!languageManager?.isInitialized() || !uiManager?.isInitialized()) {
            console.warn('Required managers not initialized');
            return;
        }
        
        const prefix = languageManager.translate(`debugPanel${type.charAt(0).toUpperCase() + type.slice(1)}`);
        uiManager.showMessage(type, key);
    } catch (error) {
        console.error('Failed to show message:', error);
    }
}

async function hideMessage(type) {
    try {
        const uiManager = await registry.get('ui');
        if (!uiManager?.isInitialized()) return;
        uiManager.hideMessage(type);
    } catch (error) {
        console.error('Failed to hide message:', error);
    }
}

async function hideAllMessages() {
    try {
        const uiManager = await registry.get('ui');
        if (!uiManager?.isInitialized()) return;
        uiManager.hideAllMessages();
    } catch (error) {
        console.error('Failed to hide all messages:', error);
    }
}

// Window Management Functions
async function adjustWindowHeight() {
    try {
        const uiManager = await registry.get('ui');
        if (!uiManager?.isInitialized()) return;
        uiManager.adjustWindowHeight();
    } catch (error) {
        console.error('Failed to adjust window height:', error);
    }
}

async function resizeWindow(height) {
    try {
        const uiManager = await registry.get('ui');
        if (!uiManager?.isInitialized()) return;
        await uiManager.resizeWindow(height);
    } catch (error) {
        console.error('Failed to resize window:', error);
    }
}

/**
 * Load and update data
 * @param {boolean} forceRefresh - Whether to force a refresh
 * @returns {Promise<void>}
 */
async function loadAndUpdateData(forceRefresh = false) {
    try {
        if (!managerInstances) throw new Error('Managers not initialized');
        
        managerInstances.logManager.log(LogLevel.INFO, '📥 Loading data...');
        
        if (!forceRefresh) {
            const cachedData = await managerInstances.cacheManager.get('data');
            if (validateCacheData(cachedData)) {
                managerInstances.logManager.log(LogLevel.INFO, '✨ Data up to date');
                return cachedData;
            }
        }

        managerInstances.operationProgressManager.show('logs.refreshingData');
        managerInstances.operationProgressManager.setProgress(40, 'logs.fetchingData');

        const store = await getSelectedStore();
        const response = await managerInstances.data.fetchData(store);

        if (!response?.success) {
            throw new Error(response?.error || 'Failed to fetch data');
        }

        managerInstances.operationProgressManager.setProgress(70, 'logs.updatingCounters');
        await updateCounters(response.data);

        const storeName = store === 'ALL' ? 
            managerInstances.languageManager.translate('allStores') :
            managerInstances.languageManager.translate('interface.storeStock', { value: store });

        managerInstances.logManager.log(LogLevel.SUCCESS, '✅ Data updated', { store: storeName });
        managerInstances.operationProgressManager.setSuccess('logs.dataUpdated');

        return response.data;
    } catch (error) {
        managerInstances?.operationProgressManager?.setError('logs.dataFetchError');
        managerInstances?.errorHandler?.handle(error, ErrorType.DATA_LOAD, ErrorSeverity.HIGH);
        throw error;
    }
}

// Update setupAutoRefresh function
function setupAutoRefresh() {
    if (!managerInstances) return;

    const refreshInterval = setInterval(async () => {
        try {
            const cached = await managerInstances.storageManager.get('lastUpdate');
            if (!cached?.lastUpdate || (Date.now() - cached.lastUpdate >= CACHE_TTL)) {
                await loadAndUpdateData(true);
            }
        } catch (error) {
            managerInstances?.errorHandler?.handle(error, ErrorType.AUTO_REFRESH, ErrorSeverity.LOW);
        }
    }, REFRESH_INTERVAL);

    // Cleanup on unload
    window.addEventListener('unload', async () => {
        clearInterval(refreshInterval);
        const eventManager = await registry.get('event');
        await eventManager.emit('popup:unload', {
            timestamp: new Date().toISOString()
        });
    });
}

// Initialize OrderService and fetch data
async function initializeAndFetchData() {
    try {
        if (!managerInstances) throw new Error('Managers not initialized');

        // Load and update data
        await loadAndUpdateData();
        
        // Setup auto refresh
        setupAutoRefresh();
        
        // Setup tabs
        setupTabs();
        
        // Initialize tooltips
        initializeTooltips();
        
    } catch (error) {
        managerInstances?.errorHandler?.handle(error, ErrorType.INITIALIZATION, ErrorSeverity.HIGH);
    }
}

// Add this after the other event listeners in setupEventListeners function
function setupTabs() {
    if (!managerInstances) return;

    const menu = document.querySelector('.menu');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    menu?.addEventListener('click', async (event) => {
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

        try {
            // Get event manager safely
            const eventManager = await registry.get('event');
            if (eventManager?.isInitialized()) {
                await eventManager.emit(EVENTS.TAB_CHANGED, {
                    tab: targetId,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to emit tab change event:', error);
        }
    });
}

// Update language switching
let languageChangeTimeout = null;
async function handleLanguageChange(language) {
    if (!managerInstances) return;

    if (languageChangeTimeout) {
        clearTimeout(languageChangeTimeout);
    }
    
    languageChangeTimeout = setTimeout(async () => {
        try {
            await managerInstances.languageManager.setLanguage(language);
            managerInstances.eventManager.emit('interface_updated');
            managerInstances.eventManager.emit('language_changed');
            managerInstances.debugManager.log(`🌍 Language changed to: ${language}`, LogLevel.INFO);
        } catch (error) {
            managerInstances.debugManager.log(`❌ Failed to change language: ${error.message}`, LogLevel.ERROR);
        }
    }, 300);
}

// Update interface
async function updateInterface() {
    // Implementation of updateInterface function
}

// Initialize tooltips
function initializeTooltips() {
    // Implementation of initializeTooltips function
}

// Update status indicators
function updateStatusIndicators(counts) {
    // Implementation of updateStatusIndicators function
}

// Get selected store
async function getSelectedStore() {
    // Implementation of getSelectedStore function
}

// Validate cache data
function validateCacheData(cachedData) {
    // Implementation of validateCacheData function
}

// Add these variables at the top with other declarations
let nextRefreshInterval;
let nextRefreshTime;

// Add this function to update the countdown timer
function updateNextRefreshTime() {
    const nextRefreshEl = document.getElementById('next-refresh-time');
    if (!nextRefreshTime) return;

    const now = Date.now();
    const timeLeft = Math.max(0, nextRefreshTime - now);
    
    if (timeLeft === 0) {
        nextRefreshEl.textContent = '-';
        return;
    }

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    nextRefreshEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Modify the updateLastRefreshTime function
function updateLastRefreshTime() {
    const lastUpdateEl = document.getElementById('last-update-time');
    const now = new Date();
    lastUpdateEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Update next refresh time
    const refreshManager = registry.get('refresh');
    const settings = refreshManager.getSettings();
    const checkFrequency = settings.check_frequency;
    
    // Convert check frequency to milliseconds
    const checkMs = typeof checkFrequency === 'string' ? 
        parseInt(checkFrequency) * (checkFrequency.endsWith('m') ? 60000 : 1000) : 
        checkFrequency;
    
    nextRefreshTime = now.getTime() + checkMs;
    
    // Clear existing interval and start new countdown
    if (nextRefreshInterval) {
        clearInterval(nextRefreshInterval);
    }
    updateNextRefreshTime();
    nextRefreshInterval = setInterval(updateNextRefreshTime, 1000);
}

// Add cleanup to the dispose function
async function dispose() {
    if (nextRefreshInterval) {
        clearInterval(nextRefreshInterval);
    }
    // ... rest of dispose function
}