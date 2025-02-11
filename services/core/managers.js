import { ErrorHandler } from './ErrorHandler.js';
import { EventManager } from './EventManager.js';
import { InitialLoadingManager } from './LoadingManager.js';
import { InitializationManager } from './InitializationManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { CacheManager } from './CacheManager.js';
import { UIManager } from './UIManager.js';
import { ThemeManager } from './ThemeManager.js';
import { MenuManager } from './MenuManager.js';
import { NotificationManager } from './NotificationManager.js';
import { DebugManager } from './DebugManager.js';
import { VolumeManager } from './VolumeManager.js';
import { UpdateManager } from './UpdateManager.js';
import { RefreshManager } from './RefreshManager.js';
import { DataManager } from './DataManager.js';
import { StoreManager } from './StoreManager.js';
import { StatusManager } from './StatusManager.js';
import { UserManager } from './UserManager.js';
import { LanguageManager } from './LanguageManager.js';
import { SettingsManager } from './SettingsManager.js';
import { MessageManager } from './MessageManager.js';
import { OperationProgressManager } from './OperationProgressManager.js';
import { dependencyValidator } from './DependencyValidator.js';
import { InterfaceManager } from './InterfaceManager.js';
import { AlarmManager } from './AlarmManager.js';
import { CounterManager } from './CounterManager.js';

/**
 * Cache for optimal initialization order
 * @type {string[]}
 */
let _cachedOrder = null;

/**
 * Register all managers with the initialization manager
 */
export function registerManagers() {
    // Return cached order if available
    if (_cachedOrder) {
        console.log('📝 Using cached manager registration');
        return _cachedOrder;
    }

    console.log('📝 Registering managers...');
    
    // Clear any existing dependencies
    dependencyValidator.clear();

    // Core Layer (No UI dependencies)
    dependencyValidator.addDependencies('ErrorHandler', []);
    dependencyValidator.addDependencies('EventManager', ['ErrorHandler']);
    dependencyValidator.addDependencies('CacheManager', ['ErrorHandler']);
    // Register CounterManager with dependencies
    dependencyValidator.register('CounterManager', counterManager, ['CacheManager', 'ErrorHandler']);
    dependencyValidator.addDependencies('InitializationManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('InitialLoadingManager', ['ErrorHandler', 'EventManager', 'InitializationManager']);
    dependencyValidator.addDependencies('ConnectionManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('UIManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('OperationProgressManager', ['UIManager', 'EventManager']);

    // UI Foundation Layer (Must initialize early)
    dependencyValidator.addDependencies('ThemeManager', ['ErrorHandler', 'UIManager']);
    dependencyValidator.addDependencies('MenuManager', ['ErrorHandler', 'UIManager', 'ThemeManager', 'EventManager']);
    dependencyValidator.addDependencies('InterfaceManager', ['ErrorHandler', 'UIManager', 'MenuManager']);
    
    // Data Layer (After UI foundation)
    dependencyValidator.addDependencies('DataManager', ['ErrorHandler', 'CacheManager', 'ConnectionManager', 'UIManager', 'MenuManager']);
    dependencyValidator.addDependencies('StoreManager', ['ErrorHandler', 'DataManager', 'UIManager', 'MenuManager']);
    
    // UI Features Layer (After data layer)
    dependencyValidator.addDependencies('NotificationManager', ['ErrorHandler', 'AlarmManager', 'EventManager']);
    dependencyValidator.addDependencies('DebugManager', ['ErrorHandler', 'UIManager', 'EventManager']);
    dependencyValidator.addDependencies('VolumeManager', ['ErrorHandler', 'UIManager']);
    
    // Feature Layer (After UI and data)
    dependencyValidator.addDependencies('UpdateManager', ['ErrorHandler', 'ConnectionManager', 'NotificationManager', 'EventManager']);
    dependencyValidator.addDependencies('RefreshManager', ['ErrorHandler', 'EventManager', 'NotificationManager', 'DataManager']);
    dependencyValidator.addDependencies('UserManager', ['ErrorHandler', 'DataManager', 'UIManager']);
    dependencyValidator.addDependencies('LanguageManager', ['ErrorHandler', 'UIManager', 'EventManager']);
    dependencyValidator.addDependencies('SettingsManager', ['ErrorHandler', 'UIManager', 'StoreManager']);
    dependencyValidator.addDependencies('MessageManager', ['ErrorHandler', 'UIManager', 'EventManager']);
    
    // Status Layer (Must be last)
    dependencyValidator.addDependencies('StatusManager', ['ErrorHandler', 'DataManager', 'UIManager', 'StoreManager']);

    // Register AlarmManager with dependencies
    dependencyValidator.register('AlarmManager', alarmManager, ['ErrorHandler', 'EventManager']);

    // Get optimal initialization order
    _cachedOrder = dependencyValidator.getInitializationOrder();
    console.log('\n✨ Optimal initialization order:', _cachedOrder.join(' -> '));
    
    return _cachedOrder;
}

// Create instances in optimal order
export const errorHandler = ErrorHandler.getInstance();
export const eventManager = EventManager.getInstance();
export const initializationManager = InitializationManager.getInstance();
export const loadingManager = InitialLoadingManager.getInstance();
export const connectionManager = ConnectionManager.getInstance();
export const cacheManager = CacheManager.getInstance();
export const uiManager = UIManager.getInstance();
export const themeManager = ThemeManager.getInstance();
export const menuManager = MenuManager.getInstance();
export const notificationManager = NotificationManager.getInstance();
export const debugManager = DebugManager.getInstance();
export const volumeManager = VolumeManager.getInstance();
export const updateManager = UpdateManager.getInstance();
export const refreshManager = RefreshManager.getInstance();
export const dataManager = DataManager.getInstance();
export const storeManager = StoreManager.getInstance();
export const statusManager = StatusManager.getInstance();
export const userManager = UserManager.getInstance();
export const languageManager = LanguageManager.getInstance();
export const settingsManager = SettingsManager.getInstance();
export const messageManager = MessageManager.getInstance();
export const operationProgressManager = OperationProgressManager.getInstance();
export const interfaceManager = InterfaceManager.getInstance();
export const alarmManager = AlarmManager.getInstance();
export const counterManager = CounterManager.getInstance();

// Export managers object with all instances
export const managers = {
    errorHandler,
    eventManager,
    initializationManager,
    loadingManager,
    connectionManager,
    cacheManager,
    uiManager,
    themeManager,
    menuManager,
    notificationManager,
    debugManager,
    volumeManager,
    updateManager,
    refreshManager,
    dataManager,
    storeManager,
    statusManager,
    userManager,
    languageManager,
    settingsManager,
    messageManager,
    operationProgressManager,
    interfaceManager,
    alarmManager,
    counterManager
}; 