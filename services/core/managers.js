import { ErrorHandler } from './ErrorHandler.js';
import { EventManager } from './EventManager.js';
import { InitialLoadingManager } from './LoadingManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { CacheManager } from './CacheManager.js';
import { UIManager } from './UIManager.js';
import { ThemeManager } from './ThemeManager.js';
import { MenuManager } from './MenuManager.js';
import { DebugManager } from './DebugManager.js';
import { DataManager } from './DataManager.js';
import { StoreManager } from './StoreManager.js';
import { StatusManager } from './StatusManager.js';
import { OperationProgressManager } from './ProgressManager.js';
import { NotificationManager } from './NotificationManager.js';
import { VolumeManager } from './VolumeManager.js';
import { UpdateManager } from './UpdateManager.js';
import { RefreshManager } from './RefreshManager.js';
import { UserManager } from './UserManager.js';
import { LanguageManager } from './LanguageManager.js';
import { SettingsManager } from './SettingsManager.js';
import { MessageManager } from './MessageManager.js';
import { dependencyValidator } from './DependencyValidator.js';

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
    dependencyValidator.addDependencies('InitialLoadingManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('ConnectionManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('CacheManager', ['ErrorHandler', 'ConnectionManager']);

    // UI Foundation Layer (Must initialize early)
    dependencyValidator.addDependencies('UIManager', ['ErrorHandler', 'EventManager']);
    dependencyValidator.addDependencies('ThemeManager', ['ErrorHandler', 'UIManager']);
    
    // Data Layer (After UI foundation)
    dependencyValidator.addDependencies('DataManager', ['ErrorHandler', 'CacheManager', 'ConnectionManager', 'UIManager']);
    dependencyValidator.addDependencies('StoreManager', ['ErrorHandler', 'DataManager', 'UIManager']);
    
    // UI Features Layer (After data layer)
    dependencyValidator.addDependencies('MenuManager', ['ErrorHandler', 'UIManager', 'ThemeManager', 'EventManager']);
    dependencyValidator.addDependencies('OperationProgressManager', ['ErrorHandler', 'UIManager']);
    dependencyValidator.addDependencies('NotificationManager', ['ErrorHandler', 'UIManager', 'EventManager']);
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

    // Get optimal initialization order
    _cachedOrder = dependencyValidator.getInitializationOrder();
    console.log('\n✨ Optimal initialization order:', _cachedOrder.join(' -> '));
    
    return _cachedOrder;
}

// Create instances in optimal order (following the dependency order)
export const errorHandler = ErrorHandler.getInstance();
export const eventManager = EventManager.getInstance();
export const loadingManager = InitialLoadingManager.getInstance();
export const connectionManager = ConnectionManager.getInstance();
export const cacheManager = CacheManager.getInstance();
export const uiManager = UIManager.getInstance();
export const themeManager = ThemeManager.getInstance();
export const dataManager = DataManager.getInstance();
export const storeManager = StoreManager.getInstance();
export const menuManager = MenuManager.getInstance();
export const progressManager = OperationProgressManager.getInstance();
export const notificationManager = NotificationManager.getInstance();
export const debugManager = DebugManager.getInstance();
export const volumeManager = VolumeManager.getInstance();
export const updateManager = UpdateManager.getInstance();
export const refreshManager = RefreshManager.getInstance();
export const userManager = UserManager.getInstance();
export const languageManager = LanguageManager.getInstance();
export const settingsManager = SettingsManager.getInstance();
export const messageManager = MessageManager.getInstance();
export const statusManager = StatusManager.getInstance();

// Map of manager instances
const managerInstances = {
    ErrorHandler: errorHandler,
    EventManager: eventManager,
    InitialLoadingManager: loadingManager,
    ConnectionManager: connectionManager,
    CacheManager: cacheManager,
    UIManager: uiManager,
    ThemeManager: themeManager,
    MenuManager: menuManager,
    OperationProgressManager: progressManager,
    NotificationManager: notificationManager,
    DebugManager: debugManager,
    VolumeManager: volumeManager,
    UpdateManager: updateManager,
    RefreshManager: refreshManager,
    DataManager: dataManager,
    StoreManager: storeManager,
    StatusManager: statusManager,
    UserManager: userManager,
    LanguageManager: languageManager,
    SettingsManager: settingsManager,
    MessageManager: messageManager
};

// Export managers object with optimal initialization order
export const managers = registerManagers().reduce((acc, name) => {
    acc[name] = managerInstances[name];
    return acc;
}, {}); 