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
    ['order', createOrderService],
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
            ['cache'],    // Depends on storage
            ['api'],      // Depends on error, cache, event
            ['store'],    // Depends on storage
            ['data'],     // Depends on store, api
            ['status'],   // Depends on store, data
            ['language'], // Depends on event
            ['theme'],    // Depends on storage
            ['order'],    // Depends on storage, api, error
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
                    throw error; // Re-throw to stop initialization
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
        
        // Only show success if there are no failures
        if (report.failed.length === 0) {
            console.log('✅ All managers initialized successfully');
        } else {
            console.error(`❌ ${report.failed.length} managers failed to initialize:`, report.failed.join(', '));
        }
        
        // Assign to global variable
        managerInstances = instances;
        
        // Throw error if there were failures
        if (report.failed.length > 0) {
            throw new Error(`Failed to initialize managers: ${report.failed.join(', ')}`);
        }
        
        return instances;
    } catch (error) {
        // Print initialization report even if there was an error
        console.error('❌ Manager initialization failed:', error);
        registry.printInitializationReport();
        throw error;
    }
}

/**
 * Setup event listeners
 */
async function setupEventListeners(instances) {
    if (!instances?.eventManager?.isInitialized()) {
        console.warn('EventManager not ready, deferring event setup');
        return;
    }

    // Add store change event listener
    instances.eventManager.on(EVENTS.STORE_CHANGED, async ({ detail }) => {
        const { currentStore } = detail;
        if (instances.dataManager?.isInitialized()) {
            await instances.dataManager.setActiveStore(currentStore);
        }
        if (instances.storeManager?.isInitialized()) {
            await instances.storeManager.changeStore(currentStore);
        }
    });

    // Add other event listeners here...
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize managers first
        const managerInstances = await initializeManagers();
        
        // Then initialize UI and data
        await initializeAndFetchData();
        
        // Setup UI components
        setupTabs();
        setupAutoRefresh();
        initializeTooltips();
        
        // Update interface
        await updateInterface();
    } catch (error) {
        console.error('Failed to initialize popup:', error);
        showMessage('error', 'initializationError');
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
        const response = await managerInstances.dataManager.fetchData(store);

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

/**
 * Update counters in UI
 * @param {Object} counts - Counter values
 * @returns {Promise<void>}
 */
async function updateCounters(counts) {
    try {
        if (!managerInstances) throw new Error('Managers not initialized');

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
        await managerInstances.uiManager.adjustWindowHeight();
        
    } catch (error) {
        managerInstances?.errorHandler?.handle(error, ErrorType.UI, ErrorSeverity.MEDIUM, {
            method: 'updateCounters'
        });
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